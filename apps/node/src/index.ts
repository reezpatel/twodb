import { NODE_SECRET } from "./config";
import { ConnectionManager } from "./connection_manager";

const secret = NODE_SECRET;

const init = async () => {
  if (secret) {
    const cm = new ConnectionManager(secret);

    cm.begin()
      .then(() => {
        console.log("Bye!");
      })
      .catch((e) => {
        throw new Error("Connection Manager errored", e);
      });
  } else {
    throw new Error(
      "NODE_SECRET is missing, can't connect to controller, exiting...",
    );
  }
};

init();
