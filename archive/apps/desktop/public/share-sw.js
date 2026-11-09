// Share-target handler, importScripts()'d into the generated service worker.
//
// The manifest's share_target POSTs multipart/form-data to /share-target.
// Service workers can't pass a POST body through a navigation, so we stash the
// FormData in a throwaway cache and 303-redirect to the /share page, which
// fetches it back via GET /share-inbox/<id> (handled here, one-shot).

const SHARE_CACHE = "twodb-share-inbox";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const id = crypto.randomUUID();
          const cache = await caches.open(SHARE_CACHE);
          await cache.put(`/share-inbox/${id}`, new Response(formData));
          return Response.redirect(`/share?share=${id}`, 303);
        } catch (err) {
          return Response.redirect("/share?error=share_read_failed", 303);
        }
      })(),
    );
    return;
  }

  if (event.request.method === "GET" && url.pathname.startsWith("/share-inbox/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHARE_CACHE);
        const res = await cache.match(url.pathname);
        if (!res) return new Response("share payload not found", { status: 404 });
        // One-shot: shared payloads are read exactly once, then dropped.
        await cache.delete(url.pathname);
        return res;
      })(),
    );
  }
});
