import { createHmac, timingSafeEqual } from "node:crypto";

export interface MediaClaims {
  userId: number;
  app: string;
  hash: string;
  expiresAt: number;
}

const payload = ({ userId, app, hash, expiresAt }: MediaClaims): string =>
  `${userId}:${app}:${hash}:${expiresAt}`;

export function createMediaToken(secret: string, claims: MediaClaims): string {
  return createHmac("sha256", secret).update(payload(claims)).digest("base64url");
}

export function verifyMediaToken(
  secret: string,
  token: string,
  claims: MediaClaims,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (claims.expiresAt <= nowSeconds) return false;
  const expected = Buffer.from(createMediaToken(secret, claims));
  const supplied = Buffer.from(token);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
