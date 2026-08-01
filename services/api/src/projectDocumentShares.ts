import { createHash, randomBytes } from "node:crypto";

export function createProjectDocumentShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function validProjectDocumentShareToken(
  value: unknown,
): string | undefined {
  return typeof value === "string" &&
      value.length === 43 &&
      /^[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : undefined;
}

export function projectDocumentShareHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
