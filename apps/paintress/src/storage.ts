import { createLocalStorage, createS3Storage, type StorageAdapter } from "@twodb/core-data/storage";
import type { PaintressConfig } from "./config.js";

export async function createBlobStorage(config: PaintressConfig): Promise<StorageAdapter> {
  if (config.STORAGE === "s3") {
    return createS3Storage({
      bucket: config.S3_BUCKET,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
    });
  }
  return createLocalStorage({ rootDir: config.LOCAL_STORAGE_DIR });
}

/** Folder layout required by the product: paintress/{workspaceId}/{boardId}/{assetId} */
export const assetKey = (workspaceId: string, boardId: string, assetId: string) => `paintress/${workspaceId}/${boardId}/${assetId}`;
