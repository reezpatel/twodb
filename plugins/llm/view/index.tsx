import type { ViewPlugin } from "@twodb/shared-frontend";
import { LlmSettings } from "./sections/settings/llm-settings";

const LlmViewPlugin = {
  id: "io.twodb.llm",
  name: "LLM Providers",

  workspace: {
    settings: <LlmSettings />,
  },
} satisfies ViewPlugin;

export default LlmViewPlugin;
