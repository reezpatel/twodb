import { fetchDatabaseCredentials, registerWithGateway } from "@twodb/core-platform/manifest";
import {manifest} from "./manifest.js";
import {buildServer} from "./server.js";
async function main(){
 const port=Number(process.env.PORT??6402),gatewayUrl=process.env.TWODB_GATEWAY_URL??"http://localhost:6400",registrationToken=process.env.TWOMAIL_PROVISION_TOKEN??process.env.TWODB_PROVISION_TOKEN??"",httpUrl=process.env.HTTP_URL??`http://localhost:${port}`;
 const allowedHosts=(process.env.TWOMAIL_ALLOWED_HOSTS??"").split(",").map(s=>s=>s.trim().toLowerCase()).filter(Boolean);
 // Dev on the host: fetch everything from the gateway with the registration
 // token (db credentials + the app's stable data key). Env wins when set —
 // docker installs inject DATABASE_URL/TWODB_DATA_KEY directly.
 let dataKey=process.env.TWOMAIL_DATA_KEY;
 let databaseUrl=process.env.TWOMAIL_DATABASE_URL??process.env.DATABASE_URL;
 if(!databaseUrl||!dataKey){
  const creds=await fetchDatabaseCredentials({gatewayUrl,registrationToken,slug:"twomail"});
  databaseUrl??=creds.connectionString;
  dataKey??=creds.dataKey;
 }
 const app=await buildServer({databaseUrl,registrationToken,httpUrl,dataKey,allowedHosts});
 await app.listen({host:"0.0.0.0",port});
 for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>{void app.close();});
 await registerWithGateway(manifest,{gatewayUrl,registrationToken,httpUrl}).catch(()=>app.log.warn("Gateway registration failed"));
}
main().catch(err=>{console.error(err);process.exitCode=1;});
