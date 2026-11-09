import { defineAppMessages } from "@twodb/core-async/registry";

// Declare this app's queue jobs / broadcast events here as they're added —
// see apps/twodb/src/messages.ts for a worked example. Run `pnpm gen:docs`
// after any change to regenerate MESSAGES.md/messages.json.
export const messages = defineAppMessages({ name: "Paintress", slug: "paintress", jobs: [], events: [] });

export default messages;
