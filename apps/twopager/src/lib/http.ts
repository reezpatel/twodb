export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}
export const notFound = (what = "not_found", msg?: string) => new HttpError(404, what, msg);
export const badRequest = (msg: string) => new HttpError(400, "bad_request", msg);
export const conflict = (code: string, msg: string) => new HttpError(409, code, msg);
export const forbidden = (msg: string) => new HttpError(403, "forbidden", msg);
export const tooLarge = (msg: string) => new HttpError(413, "too_large", msg);
