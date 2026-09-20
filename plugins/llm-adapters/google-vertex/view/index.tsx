import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { GoogleVertexSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.google-vertex", GoogleVertexSetup);

const GoogleVertexViewPlugin = {
  id: "io.twodb.llm.google-vertex",
} satisfies ViewPlugin;

export default GoogleVertexViewPlugin;
