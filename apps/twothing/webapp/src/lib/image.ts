/**
 * Downscale a photo on the client before upload: phone shots are 4–12 MB,
 * an inventory thumbnail needs ~200 KB. Longest edge 1600px, WebP (JPEG
 * fallback where the browser can't encode WebP).
 */
export async function shrinkImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
  if (blob && blob.type === "image/webp") return blob;
  return (await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality))) ?? file;
}
