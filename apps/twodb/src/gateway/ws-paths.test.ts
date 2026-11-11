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
