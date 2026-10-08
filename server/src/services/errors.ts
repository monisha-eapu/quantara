export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "ERROR") {
    super(message);
  }
}
export const notFound = (what: string) => new HttpError(404, `${what} not found`, "NOT_FOUND");
export const badRequest = (msg: string) => new HttpError(400, msg, "BAD_REQUEST");
export const conflict = (msg: string) => new HttpError(409, msg, "CONFLICT");
