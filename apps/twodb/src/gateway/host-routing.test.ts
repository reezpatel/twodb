import { test } from "node:test";
import assert from "node:assert/strict";
import { createHostRouter } from "./host-routing.js";

function request(host: string | undefined, url = "/boards/1?view=full") {
  return { url, headers: host ? { host } : {} };
}

test("routes a ROOT_DOMAIN service host through /apps/:slug", () => {
  const route = createHostRouter({ ROOT_DOMAIN: ".twodb.io" });
  assert.equal(route(request("artisan.twodb.io")), "/apps/artisan/boards/1?view=full");
  assert.equal(route(request("Artisan.TwoDB.io:443", "/")), "/apps/artisan/");
});

test("leaves the root, nested hosts, and control-plane hosts unchanged", () => {
  const route = createHostRouter({ ROOT_DOMAIN: "twodb.io" });
  assert.equal(route(request("twodb.io")), "/boards/1?view=full");
  assert.equal(route(request("console.twodb.io")), "/boards/1?view=full");
  assert.equal(route(request("twodb.twodb.io")), "/boards/1?view=full");
  assert.equal(route(request("foo.bar.twodb.io")), "/boards/1?view=full");
});

test("routes outside hosts to CATCH_ALL_SERVICE and preserves the URL", () => {
  const route = createHostRouter({ ROOT_DOMAIN: "twodb.io", CATCH_ALL_SERVICE: "artisan" });
  assert.equal(route(request("customer.example.com", "/share/a?x=1")), "/apps/artisan/share/a?x=1");
  assert.equal(route(request("unknown.twodb.io")), "/apps/unknown/boards/1?view=full");
});

test("CATCH_ALL_HOST_REGEX limits catch-all routing", () => {
  const route = createHostRouter({
    ROOT_DOMAIN: "twodb.io",
    CATCH_ALL_SERVICE: "artisan",
    CATCH_ALL_HOST_REGEX: "(^|\\.)example\\.com$",
  });
  assert.equal(route(request("customer.example.com")), "/apps/artisan/boards/1?view=full");
  assert.equal(route(request("example.net")), "/boards/1?view=full");
});

test("missing or malformed hosts pass through", () => {
  const route = createHostRouter({ ROOT_DOMAIN: "twodb.io", CATCH_ALL_SERVICE: "artisan" });
  assert.equal(route(request(undefined)), "/boards/1?view=full");
  assert.equal(route(request("not a host")), "/boards/1?view=full");
});

test("invalid catch-all configuration fails at startup", () => {
  assert.throws(() => createHostRouter({ CATCH_ALL_SERVICE: "Bad Service" }), /kebab-case/);
  assert.throws(() => createHostRouter({ CATCH_ALL_SERVICE: "artisan", CATCH_ALL_HOST_REGEX: "[" }), /invalid/);
});
