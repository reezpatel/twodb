import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
export function secretBox(hex:string) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error("TWOMAIL_DATA_KEY must be 32 random bytes encoded as 64 hex characters");
  const key=Buffer.from(hex,"hex");
  return {
    seal(value:unknown) { const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm",key,iv); const body=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]); return [iv,cipher.getAuthTag(),body].map(b=>b.toString("base64")).join(":"); },
    open<T>(value:string):T { const [iv,tag,body]=value.split(":").map(s=>Buffer.from(s,"base64")); const cipher=createDecipheriv("aes-256-gcm",key,iv); cipher.setAuthTag(tag); return JSON.parse(Buffer.concat([cipher.update(body),cipher.final()]).toString()); },
  };
}
