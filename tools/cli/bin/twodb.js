#!/usr/bin/env node
// dist first (published package), src as fallback (running from a checkout via tsx/node --experimental-strip-types).
import("../dist/main.js").catch(() => {
  import("../src/main.ts").catch((err) => {
    console.error(String(err?.stack ?? err));
    process.exit(1);
  });
});
