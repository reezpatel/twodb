import type {Setup} from "../hooks/useMail";
export function AccountForm({value,onChange,spaces,busy,onSubmit,onClose}:{value:Setup;onChange:(v:Setup)=>void;spaces:{id:string;name:string}[];busy:boolean;onSubmit:()=>void;onClose:()=>void}){
 return <form className="panel" onSubmit={e=>{e.preventDefault();onSubmit();}}><h2>Connect IMAP / SMTP</h2><p>Hosts must be approved by the operator. IMAP uses TLS on port 993. Use an app password where required.</p><fieldset disabled={busy}>
 <label>Space<select required value={value.spaceId} onChange={e=>onChange({...value,spaceId:e.target.value})}>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 {([['name','Account name'],['address','Email address'],['username','Login username'],['password','Password'],['imapHost','IMAP host'],['smtpHost','SMTP host']] as const).map(([key,label])=><label key={key}>{label}<input required type={key==='password'?'password':key==='address'?'email':'text'} autoComplete={key==='password'?'new-password':'off'} value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>)}
 <label>SMTP mode<select value={value.smtpSecure?'465':'587'} onChange={e=>onChange({...value,smtpSecure:e.target.value==='465',smtpPort:Number(e.target.value)})}><option value="465">TLS · port 465</option><option value="587">Required STARTTLS · port 587</option></select></label>
 <footer><button className="primary" disabled={!value.spaceId}>{busy?'Verifying…':'Verify and connect'}</button><button type="button" onClick={onClose}>Cancel</button></footer></fieldset></form>;
}
