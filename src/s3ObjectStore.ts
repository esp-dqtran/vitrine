import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { ObjectAccessClass, ObjectMetadata, ObjectStore, StoredContentType } from "./objectStore.ts";

type Command =
  | DeleteObjectCommand
  | GetObjectCommand
  | HeadObjectCommand
  | ListObjectsV2Command
  | PutObjectCommand;

export interface S3ObjectStoreOptions {
  bucket: string;
  prefix: string;
  send(command: Command): Promise<unknown>;
  sign(command: GetObjectCommand, expiresSeconds: number): Promise<string>;
}

const MAX_BYTES = 64 * 1024 * 1024;
const KEY_PATTERN = /^[a-z0-9][a-z0-9/_=.@-]{0,1023}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CONTENT_TYPES = new Set<StoredContentType>([
  "image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "application/json",
  "application/zip", "text/css", "text/javascript", "text/typescript",
]);
const ACCESS_CLASSES = new Set<ObjectAccessClass>(["protected", "public-preview", "internal"]);

function validateKey(key: string): void {
  const segments = key.split("/");
  if (!KEY_PATTERN.test(key) || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Invalid object key: ${JSON.stringify(key)}`);
  }
}

function validateListPrefix(prefix: string): void {
  if (prefix) validateKey(prefix.endsWith("/") ? `${prefix}x` : prefix);
}

function validateMetadata(metadata: ObjectMetadata): void {
  validateKey(metadata.key);
  if (!SHA256_PATTERN.test(metadata.sha256)) throw new Error("Invalid SHA-256");
  if (!Number.isSafeInteger(metadata.byteSize) || metadata.byteSize <= 0 || metadata.byteSize > MAX_BYTES) {
    throw new Error("Invalid byte size");
  }
  if (!CONTENT_TYPES.has(metadata.contentType)) throw new Error(`Unsupported content type: ${metadata.contentType}`);
  if (!ACCESS_CLASSES.has(metadata.accessClass)) throw new Error(`Unsupported access class: ${metadata.accessClass}`);
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

function missing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string };
  return value.name === "NotFound" || value.name === "NoSuchKey";
}

function preconditionFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === "PreconditionFailed" || value.$metadata?.httpStatusCode === 412;
}

function conditionalConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === "ConditionalRequestConflict" || value.$metadata?.httpStatusCode === 409;
}

export class S3ObjectStore implements ObjectStore {
  readonly #bucket: string;
  readonly #prefix: string;
  readonly #send: S3ObjectStoreOptions["send"];
  readonly #sign: S3ObjectStoreOptions["sign"];

  constructor(options: S3ObjectStoreOptions) {
    if (!options.bucket) throw new Error("S3 bucket is required");
    const prefix = options.prefix.replace(/\/+$/, "");
    if (prefix) validateKey(prefix);
    this.#bucket = options.bucket;
    this.#prefix = prefix;
    this.#send = options.send;
    this.#sign = options.sign;
  }

  async put(input: ObjectMetadata & { body: Uint8Array }): Promise<{ created: boolean; metadata: ObjectMetadata }> {
    const metadata = this.#inputMetadata(input);
    const body = Buffer.from(input.body.buffer, input.body.byteOffset, input.body.byteLength);
    if (body.byteLength !== metadata.byteSize) throw new Error("Byte size mismatch");
    if (createHash("sha256").update(body).digest("hex") !== metadata.sha256) throw new Error("SHA-256 mismatch");

    const existing = await this.head(metadata.key);
    if (existing) {
      if (!sameMetadata(existing, metadata)) throw new Error("Object already exists with different metadata");
      return { created: false, metadata: existing };
    }

    const putCommand = () => new PutObjectCommand({
        Bucket: this.#bucket,
        Key: this.#fullKey(metadata.key),
        Body: body,
        ContentLength: metadata.byteSize,
        ContentType: metadata.contentType,
        ChecksumAlgorithm: "SHA256",
        ChecksumSHA256: Buffer.from(metadata.sha256, "hex").toString("base64"),
        Metadata: { sha256: metadata.sha256, "access-class": metadata.accessClass },
        IfNoneMatch: "*",
      });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.#send(putCommand());
        break;
      } catch (error) {
        if (!preconditionFailed(error) && !conditionalConflict(error)) throw error;
        const raced = await this.head(metadata.key);
        if (raced && sameMetadata(raced, metadata)) return { created: false, metadata: raced };
        if (raced || preconditionFailed(error) || attempt === 1) {
          throw new Error("Object already exists with different metadata", { cause: error });
        }
      }
    }

    const written = await this.head(metadata.key);
    if (!written || !sameMetadata(written, metadata)) throw new Error("S3 post-write metadata mismatch");
    return { created: true, metadata: written };
  }

  async head(key: string): Promise<ObjectMetadata | undefined> {
    validateKey(key);
    let output: unknown;
    try {
      output = await this.#send(new HeadObjectCommand({
        Bucket: this.#bucket,
        Key: this.#fullKey(key),
        ChecksumMode: "ENABLED",
      }));
    } catch (error) {
      if (missing(error)) return undefined;
      throw error;
    }
    if (output === undefined) return undefined;
    return this.#metadataFromOutput(key, output);
  }

  async get(key: string): Promise<{ metadata: ObjectMetadata; body: Buffer }> {
    const metadata = await this.head(key);
    if (!metadata) throw new Error(`Object not found: ${key}`);
    const output = await this.#send(new GetObjectCommand({ Bucket: this.#bucket, Key: this.#fullKey(key) })) as {
      Body?: { transformToByteArray?: () => Promise<Uint8Array> };
    };
    if (!output.Body?.transformToByteArray) throw new Error(`S3 object body is missing for ${key}`);
    const body = Buffer.from(await output.Body.transformToByteArray());
    if (body.byteLength !== metadata.byteSize
      || createHash("sha256").update(body).digest("hex") !== metadata.sha256) {
      throw new Error(`S3 object bytes do not match metadata for ${key}`);
    }
    return { metadata, body };
  }

  async signedGetUrl(key: string, expiresSeconds: number): Promise<string> {
    validateKey(key);
    const expires = Math.min(300, Math.max(30, Math.trunc(expiresSeconds)));
    return this.#sign(
      new GetObjectCommand({ Bucket: this.#bucket, Key: this.#fullKey(key) }),
      expires,
    );
  }

  async *list(prefix = ""): AsyncIterable<ObjectMetadata> {
    validateListPrefix(prefix);
    const fullPrefix = this.#fullPrefix(prefix);
    let continuationToken: string | undefined;
    do {
      const output = await this.#send(new ListObjectsV2Command({
        Bucket: this.#bucket,
        Prefix: fullPrefix,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      })) as {
        Contents?: Array<{ Key?: string }>;
        IsTruncated?: boolean;
        NextContinuationToken?: string;
      };
      for (const item of output.Contents ?? []) {
        if (!item.Key) continue;
        const key = this.#logicalKey(item.Key);
        const metadata = await this.head(key);
        if (metadata) yield metadata;
      }
      if (!output.IsTruncated) break;
      if (!output.NextContinuationToken) throw new Error("S3 listing is truncated without a continuation token");
      continuationToken = output.NextContinuationToken;
    } while (true);
  }

  async delete(key: string): Promise<boolean> {
    validateKey(key);
    if (!await this.head(key)) return false;
    await this.#send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: this.#fullKey(key) }));
    return true;
  }

  #inputMetadata(input: ObjectMetadata): ObjectMetadata {
    const metadata: ObjectMetadata = {
      key: input.key,
      sha256: input.sha256,
      byteSize: input.byteSize,
      contentType: input.contentType,
      accessClass: input.accessClass,
    };
    validateMetadata(metadata);
    return metadata;
  }

  #metadataFromOutput(key: string, value: unknown): ObjectMetadata {
    const output = value as {
      ContentLength?: number;
      ContentType?: string;
      ChecksumSHA256?: string;
      Metadata?: Record<string, string | undefined>;
    };
    const sha256 = output.Metadata?.sha256;
    const accessClass = output.Metadata?.["access-class"];
    const metadata: ObjectMetadata = {
      key,
      sha256: sha256 ?? "",
      byteSize: output.ContentLength ?? 0,
      contentType: output.ContentType as StoredContentType,
      accessClass: accessClass as ObjectAccessClass,
    };
    const metadataKeys = Object.keys(output.Metadata ?? {}).sort();
    try {
      validateMetadata(metadata);
      if (metadataKeys.length !== 2 || metadataKeys[0] !== "access-class" || metadataKeys[1] !== "sha256") {
        throw new Error("Unexpected S3 metadata fields");
      }
      if (output.ChecksumSHA256 !== Buffer.from(metadata.sha256, "hex").toString("base64")) {
        throw new Error("S3 checksum metadata does not match");
      }
    } catch (error) {
      throw new Error(`Invalid S3 object metadata for ${key}`, { cause: error });
    }
    return metadata;
  }

  #fullKey(key: string): string {
    return this.#prefix ? `${this.#prefix}/${key}` : key;
  }

  #fullPrefix(prefix: string): string {
    if (!this.#prefix) return prefix;
    return prefix ? `${this.#prefix}/${prefix}` : `${this.#prefix}/`;
  }

  #logicalKey(fullKey: string): string {
    if (!this.#prefix) {
      validateKey(fullKey);
      return fullKey;
    }
    const expected = `${this.#prefix}/`;
    if (!fullKey.startsWith(expected)) throw new Error("S3 object key is outside configured prefix");
    const key = fullKey.slice(expected.length);
    validateKey(key);
    return key;
  }
}
