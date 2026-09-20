import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { ClineSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.cline", ClineSetup);

const ClineViewPlugin = {
  id: "io.twodb.llm.cline",
} satisfies ViewPlugin;

export default ClineViewPlugin;
