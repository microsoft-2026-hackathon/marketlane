export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(entity: string): never {
  throw new AppError(404, "NOT_FOUND", `${entity} was not found.`);
}
