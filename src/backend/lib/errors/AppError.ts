import { ERROR_CODES } from "./errorCodes";

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = ERROR_CODES.INTERNAL) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
