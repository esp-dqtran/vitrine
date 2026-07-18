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
      // Presigned GetObject URLs are handed to browsers, which can't resolve a Docker-internal
      // hostname (e.g. "minio") the way the server itself can — this lets signing use a
      // separately-reachable host/port while the server's own S3 calls keep using `endpoint`.
      // SigV4 validates against whatever Host the request actually carries, so signing with a
      // different host than `endpoint` is safe as long as both route to the same object store.
      publicEndpoint?: string;
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

function parseEndpoint(environment: NodeJS.ProcessEnv, name: string, production: boolean): string | undefined {
  const raw = environment[name]?.trim();
  if (!raw) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name} is invalid`);
  }
  if (production && parsed.protocol !== "https:") {
    throw new Error(`Production object storage endpoint (${name}) must use HTTPS`);
  }
  if (!production && parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Object storage endpoint (${name}) must use HTTP or HTTPS`);
  }
  return parsed.toString();
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

  const endpoint = parseEndpoint(environment, "OBJECT_STORE_S3_ENDPOINT", production);
  const publicEndpoint = parseEndpoint(environment, "OBJECT_STORE_S3_PUBLIC_ENDPOINT", production);

  // Prefer the OBJECT_STORE_* names; fall back to the AWS_S3_* namespaced pair
  // (our .env convention) so several services' AWS keys can coexist in one file.
  // Both unset → the SDK's default credential chain (AWS_PROFILE / ~/.aws) still applies.
  const accessKeyId = (environment.OBJECT_STORE_ACCESS_KEY_ID ?? environment.AWS_S3_ACCESS_KEY_ID)?.trim();
  const secretAccessKey = (environment.OBJECT_STORE_SECRET_ACCESS_KEY ?? environment.AWS_S3_SECRET_ACCESS_KEY)?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("Object storage credentials must be provided as a pair");
  }
  return {
    backend: "s3",
    bucket,
    region,
    prefix,
    ...(endpoint ? { endpoint } : {}),
    ...(publicEndpoint ? { publicEndpoint } : {}),
    forcePathStyle,
    ...(accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : {}),
  };
}

export function createObjectStore(config: ObjectStoreConfig): ObjectStore {
  if (config.backend === "local") return new LocalObjectStore(config.root);
  const credentials = config.accessKeyId && config.secretAccessKey
    ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }
    : {};
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    ...credentials,
  });
  // Presigned URLs are handed to browsers, which need a host they can actually reach —
  // sign with a second client pointed at `publicEndpoint` when the server's own reachable
  // endpoint differs from it (e.g. a Docker-internal hostname vs. the host-published port).
  const signingClient = config.publicEndpoint
    ? new S3Client({ region: config.region, endpoint: config.publicEndpoint, forcePathStyle: config.forcePathStyle, ...credentials })
    : client;
  return new S3ObjectStore({
    bucket: config.bucket,
    prefix: config.prefix,
    send: (command) => client.send(command as never),
    sign: (command, expiresSeconds) => getSignedUrl(signingClient, command, { expiresIn: expiresSeconds }),
  });
}
