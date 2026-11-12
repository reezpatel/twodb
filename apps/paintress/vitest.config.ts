import { defineConfig } from "vitest/config";
import * as path from "node:path";

export default defineConfig({
  resolve: { alias: { "@shared": path.resolve(__dirname, "src/shared") } },
  test: { include: ["src/**/*.test.ts", "webapp/src/**/*.test.ts"] },
});
