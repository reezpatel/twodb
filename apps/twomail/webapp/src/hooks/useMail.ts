import {useEffect,useRef,useState} from "react";
export interface Account{id:string;name:string;address:string}
export interface Message{id:string;sender:string;recipient:string;subject:string;text:string;date:string;status:string}
export interface Setup{spaceId:string;name:string;address:string;username:string;password:string;imapHost:string;smtpHost:string;smtpPort:number;smtpSecure:boolean}
export interface Compose{requestId:string;to:string;subject:string;text:string}
const base="/apps/twomail";
async function api<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch(path,{credentials:"include",...init,headers:{"Content-Type":"application/json"}});if(!r.ok){const b=await r.json().catch(()=>({}));throw new Error(r.status===401?"Sign in to TwoDB and reload.":b.error??`Request failed (${r.status})`);}return r.json();}
export function useMail(){
 const [accounts,setAccounts]=useState<Account[]>([]),[accountId,setAccountId]=useState("");
 const [spaces,setSpaces]=useState<{id:string;name:string}[]>([]);
 const [setup,setSetup]=useState<Setup>({spaceId:"",name:"",address:"",username:"",password:"",imapHost:"",smtpHost:"",smtpPort:465,smtpSecure:true});
 const [showSetup,setShowSetup]=useState(false),[folder,setFolder]=useState("inbox"),[messages,setMessages]=useState<Message[]>([]),[selected,setSelected]=useState<Message|null>(null),[compose,setCompose]=useState<Compose|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0);
 const lock=useRef(false);
 useEffect(()=>{let active=true;Promise.all([api<Account[]>(`${base}/accounts`),api<{spaces:{id:string;name:string}[]}>("/registry/spaces")]).then(([a,s])=>{if(active){setAccounts(a);setAccountId(a[0]?.id??"");setSpaces(s.spaces);setSetup(v=>({...v,spaceId:s.spaces[0]?.id??""}));setShowSetup(!a.length);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setSelected(null);if(!accountId){setMessages([]);return;}setLoading(true);api<Message[]>(`${base}/messages?${new URLSearchParams({accountId,folder})}`).then(rows=>{if(active)setMessages(rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[accountId,folder,revision]);
 async function perform(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError("");setNotice("");try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);lock.current=false;}}
 return {accounts,accountId,selectAccount:(id:string)=>{setAccountId(id);setCompose(null);},spaces,setup,setSetup,showSetup,setShowSetup,folder,setFolder,messages,selected,setSelected,compose,setCompose,busy,loading,error,notice,
 connect:()=>perform(async()=>{const {spaceId,name,address,...connection}=setup;const a=await api<Account>(`${base}/accounts`,{method:"POST",body:JSON.stringify({spaceId,name,address,connection})});setAccounts(rows=>[...rows,a]);setAccountId(a.id);setSetup(v=>({...v,password:""}));setShowSetup(false);setNotice("Account verified. Sync inbox to import messages.");}),
 sync:()=>perform(async()=>{const result=await api<{imported:number}>(`${base}/accounts/${accountId}/sync`,{method:"POST"});setNotice(`Imported ${result.imported} messages.`);setRevision(r=>r+1);}),
 newMessage:()=>setCompose({requestId:crypto.randomUUID(),to:"",subject:"",text:""}),
 send:()=>perform(async()=>{if(!compose)return;await api(`${base}/send`,{method:"POST",body:JSON.stringify({...compose,accountId})});setCompose(null);setFolder("sent");setRevision(r=>r+1);setNotice("SMTP server accepted the message. This does not guarantee recipient delivery.");}),
 };
}
