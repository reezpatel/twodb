import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { MinimaxSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.minimax", MinimaxSetup);

const MinimaxViewPlugin = {
  id: "io.twodb.llm.minimax",
} satisfies ViewPlugin;

export default MinimaxViewPlugin;
