import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import type { z } from "zod";
import type { connectionInput } from "./manifest.js";
export type Connection=z.infer<typeof connectionInput>;
export interface Incoming { providerId:string; sender:string; recipient:string; subject:string; text:string; date:string }
export interface MailProvider { verify(c:Connection):Promise<void>; inbox(c:Connection):Promise<Incoming[]>; send(c:Connection,mail:{from:string;to:string;subject:string;text:string;messageId:string}):Promise<void> }
// Only operator-approved hosts can be dialed. This also prevents tenant-supplied
// connections from being used as arbitrary internal network probes.
export function checkHosts(c:Connection,allowed:string[]) {
  if (![c.imapHost,c.smtpHost].every(h=>allowed.includes(h.toLowerCase()))) throw new Error("Mail host not allowed by operator");
}
function transport(c:Connection) { return nodemailer.createTransport({host:c.smtpHost,port:c.smtpPort,secure:c.smtpSecure,requireTLS:true,auth:{user:c.username,pass:c.password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,disableFileAccess:true,disableUrlAccess:true}); }
async function withImap<T>(c:Connection,run:(client:ImapFlow)=>Promise<T>) {
  const client=new ImapFlow({host:c.imapHost,port:c.imapPort,secure:true,auth:{user:c.username,pass:c.password},logger:false,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});
  client.on("error",()=>{});
  try { await client.connect(); return await run(client); } finally { await client.logout().catch(()=>client.close()); }
}
export const provider:MailProvider={
  async verify(c) { await withImap(c,async client=>{await client.mailboxOpen("INBOX",{readOnly:true});}); const smtp=transport(c); try {await smtp.verify();} finally {smtp.close();} },
  async inbox(c) { return withImap(c,async client=>{
    const lock=await client.getMailboxLock("INBOX",{readOnly:true});
    try {
      const box=client.mailbox; if (!box || !box.exists) return [];
      const metadata=[];
      for await (const item of client.fetch(`${Math.max(1,box.exists-99)}:*`,{uid:true,size:true})) if ((item.size ?? Infinity)<=2_000_000) metadata.push(item.uid);
      const result:Incoming[]=[];
      if(!metadata.length) return result;
      for await(const item of client.fetch(metadata.join(","),{uid:true,source:true,internalDate:true},{uid:true})) {
        if(!item.source || item.source.length>2_000_000) continue;
        const parsed=await simpleParser(item.source,{skipHtmlToText:true,skipTextToHtml:true});
        result.push({providerId:`inbox:${box.uidValidity}:${item.uid}`,sender:parsed.from?.text ?? "",recipient:Array.isArray(parsed.to)?parsed.to.map(t=>t.text).join(", "):parsed.to?.text ?? "",subject:parsed.subject ?? "(no subject)",text:(parsed.text ?? "[HTML-only message; HTML rendering is not enabled]").slice(0,100000),date:(parsed.date && Number.isFinite(parsed.date.getTime()) ? parsed.date : new Date()).toISOString()});
      }
      return result;
    } finally {lock.release();}
  }); },
  async send(c,mail) { const smtp=transport(c); try {const result=await smtp.sendMail(mail); if(result.rejected.length || !result.accepted.length) throw new Error("Recipient not accepted");} finally {smtp.close();} },
};
