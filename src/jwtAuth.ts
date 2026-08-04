import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import type { AuthUser, UserRole } from "./authStore.ts";

const JWT_ALGORITHM = "HS256";
const JWT_TYPE = "JWT";
const JWT_KEY_ID = "v1";
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;

export interface JwtAuthConfig {
  secret: string;
  issuer: string;
  audience: string;
  ttlSeconds?: number;
  clockToleranceSeconds?: number;
  now?: () => Date;
}

export interface IssuedAuthToken {
  token: string;
  expiresAt: Date;
}

export interface JwtAuth {
  issueAuthToken(user: AuthUser): Promise<IssuedAuthToken>;
  verifyAuthToken(token: string): Promise<AuthUser | undefined>;
}

function required(environment: Record<string, string | undefined>, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function jwtAuthConfigFromEnv(
  environment: Record<string, string | undefined>,
): JwtAuthConfig {
  const secret = required(environment, "JWT_SIGNING_SECRET");
  if (secret.length < 32) {
    throw new Error("JWT_SIGNING_SECRET must contain at least 32 characters");
  }
  const issuer = environment.JWT_ISSUER?.trim()
    || environment.APP_URL?.trim().replace(/\/$/, "");
  if (!issuer) throw new Error("JWT_ISSUER or APP_URL is required");
  return {
    secret,
    issuer,
    audience: environment.JWT_AUDIENCE?.trim() || "vitrines",
  };
}

function validUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthUser>;
  return Number.isSafeInteger(user.id)
    && Number(user.id) > 0
    && typeof user.email === "string"
    && user.email.length > 0
    && user.email.length <= 320
    && (user.role === "admin" || user.role === "user");
}

export function createJwtAuth(config: JwtAuthConfig): JwtAuth {
  if (config.secret.length < 32) {
    throw new Error("JWT signing secret must contain at least 32 characters");
  }
  if (!config.issuer.trim()) throw new Error("JWT issuer is required");
  if (!config.audience.trim()) throw new Error("JWT audience is required");
  const ttlSeconds = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("JWT TTL must be a positive integer");
  }
  const key = new TextEncoder().encode(config.secret);
  const now = config.now ?? (() => new Date());
  const clockTolerance = config.clockToleranceSeconds ?? 5;

  return {
    async issueAuthToken(user) {
      if (!validUser(user)) throw new Error("Cannot issue JWT for an invalid user");
      const issuedAt = Math.floor(now().getTime() / 1_000);
      const expiresAt = new Date((issuedAt + ttlSeconds) * 1_000);
      const token = await new SignJWT({ email: user.email, role: user.role })
        .setProtectedHeader({ alg: JWT_ALGORITHM, typ: JWT_TYPE, kid: JWT_KEY_ID })
        .setSubject(String(user.id))
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + ttlSeconds)
        .setJti(randomUUID())
        .sign(key);
      return { token, expiresAt };
    },

    async verifyAuthToken(token) {
      if (!token || token.length > 8_192) return undefined;
      try {
        const { payload, protectedHeader } = await jwtVerify(token, key, {
          algorithms: [JWT_ALGORITHM],
          issuer: config.issuer,
          audience: config.audience,
          currentDate: now(),
          clockTolerance,
        });
        if (
          protectedHeader.typ !== JWT_TYPE
          || protectedHeader.kid !== JWT_KEY_ID
          || typeof payload.sub !== "string"
          || typeof payload.email !== "string"
          || typeof payload.role !== "string"
          || typeof payload.jti !== "string"
        ) return undefined;
        const user = {
          id: Number(payload.sub),
          email: payload.email,
          role: payload.role as UserRole,
        };
        return validUser(user) ? user : undefined;
      } catch {
        return undefined;
      }
    },
  };
}
