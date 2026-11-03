// Errors thrown by the data layer. Actions turn them into ActionErrors, pages into 404s.
// Messages are German translation keys (tk), translated where they are shown.
import { tk } from "../../i18n";

export type DataErrorCode = "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN";

export class DataError extends Error {
  constructor(
    readonly code: DataErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}

export function notFound(message = tk("Nicht gefunden.")): never {
  throw new DataError("NOT_FOUND", message);
}

export function badRequest(message: string): never {
  throw new DataError("BAD_REQUEST", message);
}

export const newId = () => crypto.randomUUID();
