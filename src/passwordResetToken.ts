import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validPasswordResetToken(token: string): boolean {
  return PASSWORD_RESET_TOKEN_PATTERN.test(token);
}
