import { createHash, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

export type StoredContentType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "application/json"
  | "application/zip"
  | "text/css"
  | "text/javascript"
  | "text/typescript"
  | "text/markdown";

export type ObjectAccessClass = "protected" | "public-preview" | "internal";

export interface ObjectMetadata {
  key: string;
  sha256: string;
  byteSize: number;
  contentType: StoredContentType;
  accessClass: ObjectAccessClass;
}

export interface ObjectStore {
  put(input: ObjectMetadata & { body: Uint8Array }): Promise<{ created: boolean; metadata: ObjectMetadata }>;
  head(key: string): Promise<ObjectMetadata | undefined>;
  get(key: string): Promise<{ metadata: ObjectMetadata; body: Buffer }>;
  signedGetUrl(key: string, expiresSeconds: number): Promise<string | undefined>;
  list(prefix?: string): AsyncIterable<ObjectMetadata>;
  delete(key: string): Promise<boolean>;
}

const MAX_BYTES = 64 * 1024 * 1024;
const KEY_PATTERN = /^[a-z0-9][a-z0-9/_=.@-]{0,1023}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const METADATA_SUFFIX = ".metadata.json";
const CONTENT_TYPES = new Set<StoredContentType>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/json",
  "application/zip",
  "text/css",
  "text/javascript",
  "text/typescript",
  "text/markdown",
]);
const ACCESS_CLASSES = new Set<ObjectAccessClass>(["protected", "public-preview", "internal"]);
const EXTENSIONS = new Set(["png", "jpg", "webp", "json", "zip", "css", "js", "tsx"]);

function encodeKeyPart(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length === 0 || bytes.length > 120) throw new Error("Invalid object-key identity part");
  return bytes.toString("hex");
}

function checkedExtension(extension: string): string {
  if (!EXTENSIONS.has(extension)) throw new Error("Invalid object extension");
  return extension;
}

export function imageObjectKey(imageId: number, sha256: string, extension: string): string {
  if (!Number.isSafeInteger(imageId) || imageId <= 0 || !SHA256_PATTERN.test(sha256)) {
    throw new Error("Invalid image object identity");
  }
  return `images/${imageId}/${sha256}.${checkedExtension(extension)}`;
}

export function thumbnailObjectKey(imageId: number, sha256: string): string {
  if (!Number.isSafeInteger(imageId) || imageId <= 0 || !SHA256_PATTERN.test(sha256)) {
    throw new Error("Invalid image object identity");
  }
  return `thumbnails/${imageId}/${sha256}.jpg`;
}

export function failureObjectKey(runId: string, flowId: string, stepId: string, sha256: string): string {
  if (!/^[1-9][0-9]*$/.test(runId) || !SHA256_PATTERN.test(sha256)) {
    throw new Error("Invalid failure object identity");
  }
  return `crawl-failures/${runId}/${encodeKeyPart(flowId)}/${encodeKeyPart(stepId)}/${sha256}.png`;
}

export function exportObjectKey(exportId: string, sha256: string, extension: string): string {
  if (!/^[1-9][0-9]*$/.test(exportId) || !SHA256_PATTERN.test(sha256)) {
    throw new Error("Invalid export object identity");
  }
  return `exports/${exportId}/${sha256}.${checkedExtension(extension)}`;
}

export function researchUploadObjectKey(userId: number, sha256: string, extension: string): string {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !SHA256_PATTERN.test(sha256)) {
    throw new Error("Invalid research upload identity");
  }
  return `research/${userId}/${sha256}.${checkedExtension(extension)}`;
}

function validateKey(key: string): void {
  const segments = key.split("/");
  if (!KEY_PATTERN.test(key) || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Invalid object key: ${JSON.stringify(key)}`);
  }
}

export function validateObjectMetadata(metadata: ObjectMetadata): void {
  validateKey(metadata.key);
  if (!SHA256_PATTERN.test(metadata.sha256)) throw new Error("Invalid SHA-256");
  if (!Number.isSafeInteger(metadata.byteSize) || metadata.byteSize <= 0) throw new Error("Invalid byte size");
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

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export class LocalObjectStore implements ObjectStore {
  readonly #root: string;
  readonly #locks = new Map<string, Promise<void>>();

  constructor(root: string) {
    this.#root = path.resolve(root);
  }

  async put(input: ObjectMetadata & { body: Uint8Array }): Promise<{ created: boolean; metadata: ObjectMetadata }> {
    const metadata: ObjectMetadata = {
      key: input.key,
      sha256: input.sha256,
      byteSize: input.byteSize,
      contentType: input.contentType,
      accessClass: input.accessClass,
    };
    validateObjectMetadata(metadata);
    if (input.body.byteLength > MAX_BYTES) throw new Error("Object exceeds the 64 MiB media ceiling");
    if (input.byteSize !== input.body.byteLength) throw new Error("Byte size mismatch");
    const body = Buffer.from(input.body.buffer, input.body.byteOffset, input.body.byteLength);
    if (createHash("sha256").update(body).digest("hex") !== input.sha256) throw new Error("SHA-256 mismatch");

    return this.#withKeyLock(input.key, async () => {
      const objectPath = await this.#path(input.key, true);
      const metadataPath = objectPath + METADATA_SUFFIX;
      let existingMetadata = await this.#readMetadata(input.key, metadataPath);
      let existingBody = await this.#readBody(objectPath);
      if (existingMetadata && !sameMetadata(existingMetadata, metadata)) {
        throw new Error("Object already exists with different metadata");
      }
      if (existingBody) this.#assertBody(existingBody, metadata);

      let bodyCreated = false;
      let metadataCreated = false;
      if (!existingBody) {
        bodyCreated = await this.#publishExclusive(objectPath, body);
        existingBody = await this.#readBody(objectPath);
        if (!existingBody) throw new Error("Object bytes could not be published");
        this.#assertBody(existingBody, metadata);
      }
      if (!existingMetadata) {
        metadataCreated = await this.#publishExclusive(
          metadataPath,
          Buffer.from(JSON.stringify(metadata)),
        );
        existingMetadata = await this.#readMetadata(input.key, metadataPath);
        if (!existingMetadata || !sameMetadata(existingMetadata, metadata)) {
          throw new Error("Object already exists with different metadata");
        }
      }
      return { created: bodyCreated && metadataCreated, metadata: existingMetadata };
    });
  }

  async head(key: string): Promise<ObjectMetadata | undefined> {
    const objectPath = await this.#path(key, false);
    const metadataPath = objectPath + METADATA_SUFFIX;
    const metadata = await this.#readMetadata(key, metadataPath);
    const body = await this.#readBody(objectPath);
    if (!metadata && !body) return undefined;
    if (!metadata) throw new Error(`Object metadata is missing for ${key}`);
    if (!body) throw new Error(`Object bytes are missing for ${key}`);
    if (body.byteLength !== metadata.byteSize) throw new Error(`Object bytes do not match metadata for ${key}`);
    return metadata;
  }

  async get(key: string): Promise<{ metadata: ObjectMetadata; body: Buffer }> {
    const metadata = await this.head(key);
    if (!metadata) throw new Error(`Object not found: ${key}`);
    const body = await this.#readBody(await this.#path(key, false));
    if (!body) throw new Error(`Object bytes are missing for ${key}`);
    if (createHash("sha256").update(body).digest("hex") !== metadata.sha256) {
      throw new Error(`Object checksum does not match metadata for ${key}`);
    }
    return { metadata, body };
  }

  async signedGetUrl(key: string, _expiresSeconds: number): Promise<undefined> {
    validateKey(key);
    return undefined;
  }

  async *list(prefix = ""): AsyncIterable<ObjectMetadata> {
    if (prefix) validateKey(prefix.endsWith("/") ? prefix + "x" : prefix);
    const keys: string[] = [];
    await this.#collectMetadataKeys(this.#root, keys);
    keys.sort();
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      const metadata = await this.head(key);
      if (metadata) yield metadata;
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.#withKeyLock(key, async () => {
      const objectPath = await this.#path(key, false);
      let removed = false;
      try {
        await unlink(objectPath);
        removed = true;
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      try {
        await unlink(objectPath + METADATA_SUFFIX);
        removed = true;
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      return removed;
    });
  }

  async #path(key: string, createParents: boolean): Promise<string> {
    validateKey(key);
    const resolved = path.resolve(this.#root, key);
    if (!resolved.startsWith(this.#root + path.sep)) throw new Error(`Invalid object key: ${JSON.stringify(key)}`);
    if (createParents) await mkdir(this.#root, { recursive: true, mode: 0o700 });
    let current = this.#root;
    for (const segment of key.split("/").slice(0, -1)) {
      current = path.join(current, segment);
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink()) throw new Error("Object storage path contains a symlink");
        if (!info.isDirectory()) throw new Error("Object storage parent is not a directory");
      } catch (error) {
        if (!isMissing(error)) throw error;
        if (!createParents) break;
        try {
          await mkdir(current, { mode: 0o700 });
        } catch (mkdirError) {
          if (!(mkdirError instanceof Error && "code" in mkdirError && mkdirError.code === "EEXIST")) {
            throw mkdirError;
          }
          const info = await lstat(current);
          if (info.isSymbolicLink()) throw new Error("Object storage path contains a symlink");
          if (!info.isDirectory()) throw new Error("Object storage parent is not a directory");
        }
      }
    }
    if (createParents) {
      const [realRoot, realParent] = await Promise.all([
        realpath(this.#root),
        realpath(path.dirname(resolved)),
      ]);
      if (realParent !== realRoot && !realParent.startsWith(realRoot + path.sep)) {
        throw new Error("Object storage path escapes the storage root");
      }
    }
    return resolved;
  }

  async #readMetadata(key: string, metadataPath: string): Promise<ObjectMetadata | undefined> {
    const raw = await this.#readFile(metadataPath);
    if (!raw) return undefined;
    let metadata: ObjectMetadata;
    try {
      metadata = JSON.parse(raw.toString("utf8")) as ObjectMetadata;
      validateObjectMetadata(metadata);
    } catch (error) {
      throw new Error(`Invalid object metadata for ${key}`, { cause: error });
    }
    if (metadata.key !== key) throw new Error(`Invalid object metadata for ${key}`);
    return metadata;
  }

  async #readBody(objectPath: string): Promise<Buffer | undefined> {
    return this.#readFile(objectPath);
  }

  async #readFile(filePath: string): Promise<Buffer | undefined> {
    try {
      const info = await lstat(filePath);
      if (info.isSymbolicLink() || !info.isFile()) throw new Error("Object storage entry is not a regular file");
      return await readFile(filePath);
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  #assertBody(body: Buffer, metadata: ObjectMetadata): void {
    if (body.byteLength !== metadata.byteSize) throw new Error("Object bytes do not match metadata");
    if (createHash("sha256").update(body).digest("hex") !== metadata.sha256) {
      throw new Error("Object checksum does not match metadata");
    }
  }

  async #withKeyLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolveGate) => { release = resolveGate; });
    const queued = previous.then(() => gate);
    this.#locks.set(key, queued);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.#locks.get(key) === queued) this.#locks.delete(key);
    }
  }

  async #publishExclusive(destination: string, content: Uint8Array): Promise<boolean> {
    const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await link(temporary, destination);
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") return false;
      throw error;
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  async #collectMetadataKeys(directory: string, keys: string[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await this.#collectMetadataKeys(entryPath, keys);
      else if (entry.isFile() && entry.name.endsWith(METADATA_SUFFIX)) {
        const relative = path.relative(this.#root, entryPath);
        keys.push(relative.slice(0, -METADATA_SUFFIX.length).split(path.sep).join("/"));
      }
    }
  }
}
