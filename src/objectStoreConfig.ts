import { isAbsolute, resolve } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { LocalObjectStore, type ObjectStore } from "./objectStore.ts";
import { S3ObjectStore } from "./s3ObjectStore.ts";

export type ObjectStoreConfig =
  | { backend: "local"; root: string }
  | {
      backend: "s3";
      bucket: string;
      region: string;
      prefix: string;
      endpoint?: string;
      forcePathStyle: boolean;
      accessKeyId?: string;
      secretAccessKey?: string;
    };

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  if (value.includes("\0")) throw new Error(`${name} is invalid`);
  return value;
}

function booleanValue(value: string | undefined, name: string): boolean {
  if (value === undefined || value.trim() === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function safePrefix(value: string | undefined): string {
  const prefix = value?.trim().replace(/\/+$/, "") ?? "";
  if (!prefix) return "";
  if (prefix && !/^[a-z0-9][a-z0-9/_=.@-]{0,511}$/.test(prefix)) {
    throw new Error("OBJECT_STORE_S3_PREFIX is invalid");
  }
  if (prefix.split("/").some((part) => part === "." || part === ".." || part === "")) {
    throw new Error("OBJECT_STORE_S3_PREFIX is invalid");
  }
  return prefix;
}

export function objectStoreConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ObjectStoreConfig {
  const backend = environment.OBJECT_STORE_BACKEND?.trim();
  const production = environment.NODE_ENV === "production";
  if (backend === "local") {
    if (production) throw new Error("Local object storage is not allowed in production");
    const root = required(environment, "OBJECT_STORE_LOCAL_ROOT");
    if (!isAbsolute(root)) throw new Error("OBJECT_STORE_LOCAL_ROOT must be absolute");
    return { backend: "local", root: resolve(root) };
  }
  if (backend !== "s3") throw new Error("OBJECT_STORE_BACKEND must be local or s3");

  const bucket = required(environment, "OBJECT_STORE_S3_BUCKET");
  const region = required(environment, "OBJECT_STORE_S3_REGION");
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("OBJECT_STORE_S3_BUCKET is invalid");
  }
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(region)) {
    throw new Error("OBJECT_STORE_S3_REGION is invalid");
  }
  const prefix = safePrefix(environment.OBJECT_STORE_S3_PREFIX);
  const forcePathStyle = booleanValue(
    environment.OBJECT_STORE_S3_FORCE_PATH_STYLE,
    "OBJECT_STORE_S3_FORCE_PATH_STYLE",
  );
  if (production && forcePathStyle) {
    throw new Error("S3 path-style endpoints are not allowed in production");
  }

  let endpoint: string | undefined;
  if (environment.OBJECT_STORE_S3_ENDPOINT?.trim()) {
    let parsed: URL;
    try {
      parsed = new URL(environment.OBJECT_STORE_S3_ENDPOINT.trim());
    } catch {
      throw new Error("OBJECT_STORE_S3_ENDPOINT must be a valid URL");
    }
    if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("OBJECT_STORE_S3_ENDPOINT is invalid");
    }
    if (production && parsed.protocol !== "https:") {
      throw new Error("Production object storage endpoint must use HTTPS");
    }
    if (!production && parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Object storage endpoint must use HTTP or HTTPS");
    }
    endpoint = parsed.toString();
  }

  const accessKeyId = environment.OBJECT_STORE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = environment.OBJECT_STORE_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("Object storage credentials must be provided as a pair");
  }
  return {
    backend: "s3",
    bucket,
    region,
    prefix,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
    ...(accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : {}),
  };
}

export function createObjectStore(config: ObjectStoreConfig): ObjectStore {
  if (config.backend === "local") return new LocalObjectStore(config.root);
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    ...(config.accessKeyId && config.secretAccessKey
      ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }
      : {}),
  });
  return new S3ObjectStore({
    bucket: config.bucket,
    prefix: config.prefix,
    send: (command) => client.send(command as never),
    sign: (command, expiresSeconds) => getSignedUrl(client, command, { expiresIn: expiresSeconds }),
  });
}
