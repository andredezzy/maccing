import type { RoleName } from "../source.ts";

/** A role's rows could not be fetched, with the role named and the cause kept. */
export class SourceError extends Error {
  readonly role: RoleName;

  constructor(role: RoleName, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SourceError";
    this.role = role;
  }
}
