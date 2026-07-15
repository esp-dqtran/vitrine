import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { BrowserContext } from "playwright";

export type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export function decodeSessionKey(encodedKey: string): Buffer {
  const value = encodedKey.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error("CRAWL_SESSION_ENCRYPTION_KEY must be canonical base64 encoding of exactly 32 bytes");
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("CRAWL_SESSION_ENCRYPTION_KEY must be canonical base64 encoding of exactly 32 bytes");
  }
  return key;
}

export function encryptStorageState(state: StorageState, encodedKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", decodeSessionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptStorageState(value: string, encodedKey: string): StorageState {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) {
    throw new Error("Invalid encrypted crawl session");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", decodeSessionKey(encodedKey), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8")) as StorageState;
  } catch (error) {
    throw new Error("Unable to authenticate or decrypt crawl session", { cause: error });
  }
}
