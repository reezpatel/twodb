import { HEARTBEAT_MS, NODE_SECRET, ROOT_DIR, controllerWsUrl } from "./config";
import { ConnectionManager } from "./connection_manager";

const init = async () => {
  // if (!NODE_SECRET) {
  // 	console.warn(
  // 		"[node] TWODB_NODE_SECRET is not set — node agent is disabled.",
  // 	);
  // 	console.warn(
  // 		"[node] create apps/node/.env with TWODB_NODE_SECRET=<secret> and restart to enable.",
  // 	);
  // 	// Stay alive so `turbo dev` doesn't treat this package as crashed.
  // 	await new Promise(() => {});
  // 	return;
  // }

  const cm = new ConnectionManager({
    url: controllerWsUrl(),
    token: NODE_SECRET || "...",
    rootDir: ROOT_DIR,
    heartbeatMs: HEARTBEAT_MS,
  });

  const shutdown = () => {
    console.log("[node] shutting down...");
    void cm.stop();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await cm.begin();
  console.log("Bye!");
};

init().catch((error) => {
  console.error(error);
  process.exit(1);
});
