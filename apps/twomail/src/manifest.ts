import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";
const host = z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.-]+$/);
export const connectionInput = z.object({ username: z.string().min(1).max(320), password: z.string().min(1).max(4096), imapHost: host, imapPort: z.number().int().min(1).max(65535).default(993), smtpHost: host, smtpPort: z.number().int().min(1).max(65535).default(465), smtpSecure: z.boolean().default(true) });
export const accountInput = z.object({ spaceId: z.string().min(1), name: z.string().trim().min(1).max(200), address: z.string().email().transform(v=>v.toLowerCase()), connection: connectionInput });
export const sendInput = z.object({ accountId:z.string().min(1), requestId:z.string().uuid(), to:z.string().email(), subject:z.string().max(998).refine(v=>!/[\r\n]/.test(v)), text:z.string().min(1).max(100000) });
export const messageQuery = z.object({ accountId:z.string().min(1), folder:z.enum(["inbox","sent"]).default("inbox"), limit:z.coerce.number().int().min(1).max(200).default(100), offset:z.coerce.number().int().min(0).default(0) });
const account = z.object({id:z.string(),spaceId:z.string(),name:z.string(),address:z.string(),createdAt:z.string()});
const message = z.object({id:z.string(),accountId:z.string(),folder:z.string(),sender:z.string(),recipient:z.string(),subject:z.string(),text:z.string(),date:z.string(),status:z.string()});
const auth = "session-or-apiKey" as const;
export const manifest = defineAppManifest({name:"TwoMail",slug:"twomail",version:"0.1.0",shape:"backend+webapp",description:"IMAP inbox and SMTP mail with encrypted account credentials.",capabilities:[],coreDeps:["core-data","core-platform","core-async"],basePath:"/apps/twomail",endpoints:[
  defineEndpoint({name:"listAccounts",method:"GET",path:"/accounts",auth,description:"List accounts in accessible spaces; secrets never returned.",response:z.array(account)}),
  defineEndpoint({name:"createAccount",method:"POST",path:"/accounts",auth,description:"Verify IMAP and SMTP credentials, then save encrypted connection. TLS mandatory.",request:accountInput,response:account}),
  defineEndpoint({name:"syncInbox",method:"POST",path:"/accounts/:id/sync",auth,description:"Fetch latest 100 INBOX messages (max 2 MB each). Snapshot import, not full mailbox reconciliation.",response:z.object({imported:z.number()})}),
  defineEndpoint({name:"listMessages",method:"GET",path:"/messages",auth,description:"Query accountId, folder (inbox/sent), limit and offset. Plain text only; attachments omitted.",response:z.array(message)}),
  defineEndpoint({name:"sendMail",method:"POST",path:"/send",auth,description:"Send plain text to one recipient. requestId prevents duplicate submissions. Unknown delivery is never automatically retried.",request:sendInput,response:message}),
]});
export default manifest;
