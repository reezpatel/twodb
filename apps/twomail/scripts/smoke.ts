import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {createPgDb,sql} from "@twodb/core-data/db";
import {buildServer,type MailDb} from "../src/server.js";
import {secretBox} from "../src/crypto.js";
import type {MailProvider} from "../src/provider.js";
const databaseUrl=process.env.TEST_DATABASE_URL;if(!databaseUrl)throw new Error("Set TEST_DATABASE_URL to a disposable database");
const schema=`mail_test_${Date.now()}`,admin=createPgDb({connectionString:databaseUrl,schema:"public"});await sql`create schema ${sql.id(schema)}`.execute(admin);
const db=createPgDb<MailDb>({connectionString:databaseUrl,schema});
let sent=0,fail=false,verified=0;
const fake:MailProvider={async verify(){verified++;},async inbox(){return [{providerId:"inbox:1:1",sender:"sender@example.com",recipient:"me@example.com",subject:"Test",text:"Plain text",date:new Date().toISOString()}];},async send(){sent++;if(fail)throw new Error("uncertain");}};
const key=randomBytes(32).toString("hex"),box=secretBox(key),sealed=box.seal({password:"test-secret"});assert.equal(box.open<{password:string}>(sealed).password,"test-secret");assert.throws(()=>secretBox(randomBytes(32).toString("hex")).open(sealed));
const app=await buildServer({databaseUrl,dataKey:key,allowedHosts:["mail.example.com"]},db,fake);
const headers={"x-twodb-auth-kind":"session","x-twodb-workspace-id":"w1","x-twodb-space-ids":"s1"};
const payload={spaceId:"s1",name:"Mail",address:"me@example.com",connection:{username:"me",password:"test-secret",imapHost:"mail.example.com",smtpHost:"mail.example.com"}};
try{
 assert.equal((await app.inject({url:"/accounts"})).statusCode,401);
 assert.equal((await app.inject({method:"POST",url:"/accounts",headers,payload:{...payload,spaceId:"s2"}})).statusCode,403);
 assert.equal((await app.inject({method:"POST",url:"/accounts",headers,payload:{...payload,connection:{...payload.connection,imapHost:"localhost"}}})).statusCode,400);assert.equal(verified,0);
 const created=await app.inject({method:"POST",url:"/accounts",headers,payload});assert.equal(created.statusCode,201);assert.ok(!created.body.includes("secret"));const accountId=created.json().id;
 const stored=await db.selectFrom("account").selectAll().executeTakeFirstOrThrow();assert.ok(!stored.secret.includes("test-secret"));
 const sync=()=>app.inject({method:"POST",url:`/accounts/${accountId}/sync`,headers});assert.equal((await sync()).json().imported,1);assert.equal((await sync()).json().imported,0);
 assert.equal((await app.inject({url:`/messages?accountId=${accountId}`,headers})).json().length,1);
 const send={accountId,requestId:randomUUID(),to:"recipient@example.com",subject:"Hello",text:"Test mail"};
 for(const isolated of [{...headers,"x-twodb-workspace-id":"w2"},{...headers,"x-twodb-space-ids":"s2"},{...headers,"x-twodb-space-ids":""}]){
  assert.equal((await app.inject({url:"/accounts",headers:isolated})).json().length,0);
  assert.equal((await app.inject({url:`/messages?accountId=${accountId}`,headers:isolated})).statusCode,404);
  assert.equal((await app.inject({method:"POST",url:`/accounts/${accountId}/sync`,headers:isolated})).statusCode,404);
  assert.equal((await app.inject({method:"POST",url:"/send",headers:isolated,payload:send})).statusCode,404);
 }
 const results=await Promise.all([app.inject({method:"POST",url:"/send",headers,payload:send}),app.inject({method:"POST",url:"/send",headers,payload:send})]);assert.ok(results.some(r=>r.statusCode===200));assert.equal(sent,1);
 assert.equal((await app.inject({method:"POST",url:"/send",headers,payload:send})).statusCode,200);assert.equal(sent,1);
 assert.equal((await app.inject({method:"POST",url:"/send",headers,payload:{...send,text:"different"}})).statusCode,409);
 fail=true;const uncertain={...send,requestId:randomUUID()};assert.equal((await app.inject({method:"POST",url:"/send",headers,payload:uncertain})).statusCode,502);assert.equal((await app.inject({method:"POST",url:"/send",headers,payload:uncertain})).statusCode,409);assert.equal(sent,2);
 assert.equal((await app.inject({method:"POST",url:"/send",headers,payload:{...send,subject:"Header\r\nInjected"}})).statusCode,400);
 console.log("PASS: encryption, host allowlist, scoped accounts, inbox dedupe, concurrent send idempotency, uncertain delivery and tenant isolation (stub mail provider)");
}finally{await app.close();await db.destroy();await sql`drop schema ${sql.id(schema)} cascade`.execute(admin);await admin.destroy();}
