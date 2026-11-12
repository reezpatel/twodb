import { connectTwoDb } from "@twodb/twodb-core";
import {manifest} from "./manifest.js";
import {buildServer} from "./server.js";
async function main(){
 const port=Number(process.env.PORT??6402),httpUrl=process.env.HTTP_URL??`http://localhost:${port}`;
 const allowedHosts=(process.env.TWOMAIL_ALLOWED_HOSTS??"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 // Register + heartbeat with the control plane; Postgres config and the stable data key come from it.
 const twodb=await connectTwoDb({manifest,httpUrl,skipConnections:true});
 if(!twodb.dataKey)throw new Error("control plane did not return a data key for twomail");
 const app=await buildServer({databaseUrl:twodb.config.postgres.connectionString,dataKey:twodb.dataKey,allowedHosts});
 await app.listen({host:"0.0.0.0",port});
 for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>{void app.close();void twodb.close();});
}
main().catch(err=>{console.error(err);process.exitCode=1;});
