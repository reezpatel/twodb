import Fastify,{type FastifyRequest} from "fastify";
import {createPgDb,type Kysely} from "@twodb/core-data/db";
import {ulid} from "ulid";

import {manifest,accountInput,sendInput,messageQuery} from "./manifest.js";
import {secretBox} from "./crypto.js";
import {provider,checkHosts,type Connection,type MailProvider} from "./provider.js";
interface Account {id:string;workspaceId:string;spaceId:string;name:string;address:string;secret:string;createdAt:string}
interface Message {id:string;accountId:string;providerId:string;folder:string;sender:string;recipient:string;subject:string;text:string;date:string;status:string}
export interface MailDb {account:Account;message:Message}
function publicAccount({secret,workspaceId,...row}:Account){return row;}
function publicMessage({providerId,...row}:Message){return row;}
function context(req:FastifyRequest){const kind=req.headers["x-twodb-auth-kind"],workspaceId=req.headers["x-twodb-workspace-id"],spaces=req.headers["x-twodb-space-ids"];if((kind!=="session"&&kind!=="apiKey")||typeof workspaceId!=="string"||!workspaceId)return null;return {workspaceId,spaces:typeof spaces==="string"?spaces.split(",").map(s=>s.trim()).filter(Boolean):[]};}
export async function buildServer(config:{databaseUrl:string;dataKey:string;allowedHosts:string[]},injectedDb?:Kysely<MailDb>,mail:MailProvider=provider){
  const box=secretBox(config.dataKey);
  const db=injectedDb??createPgDb<MailDb>({connectionString:config.databaseUrl,schema:"twomail"});
  await db.schema.createTable("account").ifNotExists().addColumn("id","text",c=>c.primaryKey()).addColumn("workspaceId","text",c=>c.notNull()).addColumn("spaceId","text",c=>c.notNull()).addColumn("name","text",c=>c.notNull()).addColumn("address","text",c=>c.notNull()).addColumn("secret","text",c=>c.notNull()).addColumn("createdAt","text",c=>c.notNull()).execute();
  await db.schema.createIndex("account_scope_idx").ifNotExists().on("account").columns(["workspaceId","spaceId"]).execute();
  await db.schema.createTable("message").ifNotExists().addColumn("id","text",c=>c.primaryKey()).addColumn("accountId","text",c=>c.notNull().references("account.id").onDelete("cascade")).addColumn("providerId","text",c=>c.notNull()).addColumn("folder","text",c=>c.notNull()).addColumn("sender","text",c=>c.notNull()).addColumn("recipient","text",c=>c.notNull()).addColumn("subject","text",c=>c.notNull()).addColumn("text","text",c=>c.notNull()).addColumn("date","text",c=>c.notNull()).addColumn("status","text",c=>c.notNull()).execute();
  await db.schema.createIndex("message_provider_idx").ifNotExists().on("message").columns(["accountId","providerId"]).unique().execute();
  const app=Fastify({logger:!injectedDb,bodyLimit:150000});
  app.addHook("onClose",async()=>{if(!injectedDb)await db.destroy();});
  app.setErrorHandler<Error & {statusCode?:number}>((error,_req,reply)=>{ app.log.error({name:error.name},"Mail request failed"); return reply.code(error.statusCode??500).send({error:"Request failed"}); });
  app.get("/healthz",async()=>({ok:true,app:"twomail"}));
  app.register(async routes=>{
    routes.addHook("preHandler",async(req,reply)=>{if(!context(req))return reply.code(401).send({error:"unauthorized"});});
    const accounts=(req:FastifyRequest)=>{const ctx=context(req)!;return db.selectFrom("account").selectAll().where("workspaceId","=",ctx.workspaceId).where("spaceId","in",ctx.spaces.length?ctx.spaces:[""]);};
    routes.get("/accounts",async req=>(await accounts(req).orderBy("name").execute()).map(publicAccount));
    routes.post("/accounts",async(req,reply)=>{
      const parsed=accountInput.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:"Invalid account fields"});
      const {connection,...input}=parsed.data,ctx=context(req)!;
      if(!ctx.spaces.includes(input.spaceId))return reply.code(403).send({error:"space_forbidden"});
      try{checkHosts(connection,config.allowedHosts);}catch{return reply.code(400).send({error:"Mail host not allowed by operator"});}
      try{await mail.verify(connection);}catch{return reply.code(502).send({error:"IMAP/SMTP verification failed. Check hosts, credentials, and TLS."});}
      const row={...input,id:ulid(),workspaceId:ctx.workspaceId,secret:box.seal(connection),createdAt:new Date().toISOString()};await db.insertInto("account").values(row).execute();return reply.code(201).send(publicAccount(row));
    });
    routes.post<{Params:{id:string}}>("/accounts/:id/sync",async(req,reply)=>{
      const account=await accounts(req).where("id","=",req.params.id).executeTakeFirst();if(!account)return reply.code(404).send({error:"account_not_found"});
      let incoming;try{const connection=box.open<Connection>(account.secret);checkHosts(connection,config.allowedHosts);incoming=await mail.inbox(connection);}catch{return reply.code(502).send({error:"Inbox sync failed"});}
      let imported=0;await db.transaction().execute(async trx=>{for(const item of incoming){const row=await trx.insertInto("message").values({...item,id:ulid(),accountId:account.id,folder:"inbox",status:"received"}).onConflict(oc=>oc.columns(["accountId","providerId"]).doNothing()).returning("id").executeTakeFirst();if(row)imported++;}});return {imported};
    });
    routes.get("/messages",async(req,reply)=>{const parsed=messageQuery.safeParse(req.query);if(!parsed.success)return reply.code(400).send({error:"Invalid message query"});const {accountId,folder,limit,offset}=parsed.data;if(!await accounts(req).where("id","=",accountId).executeTakeFirst())return reply.code(404).send({error:"account_not_found"});return(await db.selectFrom("message").selectAll().where("accountId","=",accountId).where("folder","=",folder).orderBy("date","desc").orderBy("id").limit(limit).offset(offset).execute()).map(publicMessage);});
    routes.post("/send",async(req,reply)=>{
      const parsed=sendInput.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:"Invalid message fields"});const input=parsed.data;
      const account=await accounts(req).where("id","=",input.accountId).executeTakeFirst();if(!account)return reply.code(404).send({error:"account_not_found"});
      const connection=box.open<Connection>(account.secret);try{checkHosts(connection,config.allowedHosts);}catch{return reply.code(400).send({error:"Mail host not allowed by operator"});}
      const providerId=`send:${input.requestId}`;
      const row:Message={id:ulid(),accountId:account.id,providerId,folder:"sent",sender:account.address,recipient:input.to,subject:input.subject,text:input.text,date:new Date().toISOString(),status:"sending"};
      const inserted=await db.insertInto("message").values(row).onConflict(oc=>oc.columns(["accountId","providerId"]).doNothing()).returning("id").executeTakeFirst();
      if(!inserted){const existing=await db.selectFrom("message").selectAll().where("accountId","=",account.id).where("providerId","=",providerId).executeTakeFirstOrThrow();if(existing.recipient!==input.to||existing.subject!==input.subject||existing.text!==input.text)return reply.code(409).send({error:"requestId already used for a different message"});if(existing.status!=="sent")return reply.code(409).send({error:"Delivery is pending or uncertain; check the recipient before sending a new message."});return publicMessage(existing);}
      try{await mail.send(connection,{from:account.address,to:input.to,subject:input.subject,text:input.text,messageId:`<${row.id}@twomail.local>`});}catch{await db.updateTable("message").set({status:"unknown"}).where("id","=",row.id).execute();return reply.code(502).send({error:"Delivery could not be confirmed. Do not resend until checked; the server may have accepted it."});}
      await db.updateTable("message").set({status:"sent"}).where("id","=",row.id).execute();return publicMessage({...row,status:"sent"});
    });
  });return app;
}
