import type { StorageAdapter } from "@twodb/core-data/storage";

const PREFIX = "paintress/";

/**
 * Keys are stored in the DB (assets.s3_key) with the `paintress/` folder
 * already in them. The control plane's S3 adapter (and the local fallback)
 * add that same prefix, so strip it here to keep existing objects reachable
 * at exactly the same final key.
 */
function stripPrefix(inner: StorageAdapter): StorageAdapter {
  const k = (key: string) => (key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key);
  return {
    put: (key, data, opts) => inner.put(k(key), data, opts).then((o) => ({ ...o, key })),
    get: (key) => inner.get(k(key)),
    getStream: (key) => inner.getStream(k(key)),
    delete: (key) => inner.delete(k(key)),
    list: (prefix) => inner.list(k(prefix)),
    getSignedUrl: inner.getSignedUrl ? (key, exp) => inner.getSignedUrl!(k(key), exp) : undefined,
  };
}

/**
 * Blob storage. The control plane hands us a storage already scoped to this
 * app's prefix (`paintress/`) — S3 is mandatory (paintress refuses to boot
 * without it), there is no local-disk path.
 */
export function createBlobStorage(s3: StorageAdapter): StorageAdapter {
  return stripPrefix(s3);
}

/** Folder layout required by the product: paintress/{workspaceId}/{boardId}/{assetId} */
export const assetKey = (workspaceId: string, boardId: string, assetId: string) => `${PREFIX}${workspaceId}/${boardId}/${assetId}`;
