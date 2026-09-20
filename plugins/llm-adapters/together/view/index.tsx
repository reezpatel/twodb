import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { TogetherSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.together", TogetherSetup);

const TogetherViewPlugin = {
  id: "io.twodb.llm.together",
} satisfies ViewPlugin;

export default TogetherViewPlugin;
