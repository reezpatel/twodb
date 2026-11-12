import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeclaredWebsocketPath } from "./ws-paths.js";

const manifest = JSON.stringify({ websocketPaths: ["/boards/:id/ws", "/live"] });

test("matches declared patterns with params", () => {
  assert.equal(isDeclaredWebsocketPath(manifest, "/boards/abc/ws"), true);
  assert.equal(isDeclaredWebsocketPath(manifest, "/live"), true);
});
test("rejects undeclared / wrong-shaped paths", () => {
  assert.equal(isDeclaredWebsocketPath(manifest, "/boards/abc/items"), false);
  assert.equal(isDeclaredWebsocketPath(manifest, "/boards/abc/ws/x"), false);
  assert.equal(isDeclaredWebsocketPath("", "/live"), false);
  assert.equal(isDeclaredWebsocketPath("{bad", "/live"), false);
  assert.equal(isDeclaredWebsocketPath(JSON.stringify({}), "/live"), false);
});

import { isInternalPath } from "./ws-paths.js";
test("isInternalPath flags only whole `internal` segments", () => {
  assert.equal(isInternalPath("/internal/x"), true);
  assert.equal(isInternalPath("/apps/twoday/internal/x?y=1"), true);
  assert.equal(isInternalPath("/apps/twoday/internal"), true);
  assert.equal(isInternalPath("/apps/twoday/internals"), false);
  assert.equal(isInternalPath("/apps/twoday/foo?next=/internal/x"), false);
  assert.equal(isInternalPath("/registry/apps"), false);
});
