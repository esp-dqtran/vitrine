import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { ObjectMetadata } from "./objectStore.ts";
import { S3ObjectStore } from "./s3ObjectStore.ts";

const body = Buffer.from("fixture");
const metadata: ObjectMetadata = {
  key: "images/301/fixture.png",
  sha256: createHash("sha256").update(body).digest("hex"),
  byteSize: body.byteLength,
  contentType: "image/png",
  accessClass: "protected",
};

function headOutput(value: ObjectMetadata = metadata) {
  return {
    ContentLength: value.byteSize,
    ContentType: value.contentType,
    ChecksumSHA256: Buffer.from(value.sha256, "hex").toString("base64"),
    Metadata: { sha256: value.sha256, "access-class": value.accessClass },
  };
}

test("put sends verified private object metadata and confirms it with head", async () => {
  const commands: unknown[] = [];
  let heads = 0;
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "astryx/prod",
    send: async (command) => {
      commands.push(command);
      if (command instanceof HeadObjectCommand) return heads++ === 0 ? undefined : headOutput();
      return {};
    },
    sign: async () => "unused",
  });

  assert.deepEqual(await store.put({ ...metadata, body }), { created: true, metadata });
  const put = commands.find((command) => command instanceof PutObjectCommand) as PutObjectCommand;
  assert.deepEqual(put.input, {
    Bucket: "private-media",
    Key: "astryx/prod/images/301/fixture.png",
    Body: body,
    ContentLength: body.byteLength,
    ContentType: "image/png",
    ChecksumAlgorithm: "SHA256",
    ChecksumSHA256: Buffer.from(metadata.sha256, "hex").toString("base64"),
    Metadata: { sha256: metadata.sha256, "access-class": "protected" },
    IfNoneMatch: "*",
  });
  assert.equal("ACL" in put.input, false);
});

test("put accepts MP4 objects from the shared object-store contract", async () => {
  const videoBody = Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70]);
  const video: ObjectMetadata = {
    key: `sites/site/versions/version/preview/preview/${createHash("sha256").update(videoBody).digest("hex")}.mp4`,
    sha256: createHash("sha256").update(videoBody).digest("hex"),
    byteSize: videoBody.byteLength,
    contentType: "video/mp4",
    accessClass: "protected",
  };
  let heads = 0;
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "objects",
    send: async (command) =>
      command instanceof HeadObjectCommand
        ? (heads++ === 0 ? undefined : headOutput(video))
        : {},
    sign: async () => "unused",
  });

  assert.deepEqual(await store.put({ ...video, body: videoBody }), {
    created: true,
    metadata: video,
  });
});

test("put is idempotent only when existing head metadata matches exactly", async () => {
  const commands: unknown[] = [];
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "objects/",
    send: async (command) => {
      commands.push(command);
      return headOutput();
    },
    sign: async () => "unused",
  });

  assert.deepEqual(await store.put({ ...metadata, body }), { created: false, metadata });
  assert.equal(commands.some((command) => command instanceof PutObjectCommand), false);

  const mismatch = new S3ObjectStore({
    bucket: "private-media",
    prefix: "objects",
    send: async () => ({ ...headOutput(), ContentType: "image/jpeg" }),
    sign: async () => "unused",
  });
  await assert.rejects(() => mismatch.put({ ...metadata, body }), /different metadata/);
});

test("put rejects a post-write head mismatch", async () => {
  let heads = 0;
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "objects",
    send: async (command) => {
      if (command instanceof HeadObjectCommand) {
        return heads++ === 0
          ? undefined
          : { ...headOutput(), ContentLength: metadata.byteSize + 1 };
      }
      return {};
    },
    sign: async () => "unused",
  });

  await assert.rejects(() => store.put({ ...metadata, body }), /post-write metadata mismatch/);
});

test("put retries one S3 conditional-request conflict", async () => {
  let puts = 0;
  let heads = 0;
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "objects",
    send: async (command) => {
      if (command instanceof HeadObjectCommand) return heads++ < 2 ? undefined : headOutput();
      if (command instanceof PutObjectCommand && puts++ === 0) {
        throw { name: "ConditionalRequestConflict", $metadata: { httpStatusCode: 409 } };
      }
      return {};
    },
    sign: async () => "unused",
  });
  assert.deepEqual(await store.put({ ...metadata, body }), { created: true, metadata });
  assert.equal(puts, 2);
});

test("head rejects incomplete or inexact S3 metadata", async () => {
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "objects",
    send: async () => ({ ...headOutput(), Metadata: { ...headOutput().Metadata, unexpected: "value" } }),
    sign: async () => "unused",
  });
  await assert.rejects(() => store.head(metadata.key), /Invalid S3 object metadata/);
});

test("head does not hide bucket-level 404 failures as missing objects", async () => {
  const store = new S3ObjectStore({
    bucket: "missing-bucket",
    prefix: "objects",
    send: async () => { throw { name: "NoSuchBucket", $metadata: { httpStatusCode: 404 } }; },
    sign: async () => "unused",
  });
  await assert.rejects(() => store.head(metadata.key), (error: unknown) => (
    typeof error === "object" && error !== null && "name" in error && error.name === "NoSuchBucket"
  ));
});

test("get verifies downloaded bytes against checksum and size", async () => {
  const commands: unknown[] = [];
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "objects",
    send: async (command) => {
      commands.push(command);
      if (command instanceof HeadObjectCommand) return headOutput();
      return { Body: { transformToByteArray: async () => body } };
    },
    sign: async () => "unused",
  });
  assert.deepEqual(await store.get(metadata.key), { metadata, body });
  assert.ok(commands.some((command) => command instanceof GetObjectCommand));

  const corrupt = new S3ObjectStore({
    bucket: "private-media",
    prefix: "objects",
    send: async (command) => command instanceof HeadObjectCommand
      ? headOutput()
      : { Body: { transformToByteArray: async () => Buffer.from("corrupt") } },
    sign: async () => "unused",
  });
  await assert.rejects(() => corrupt.get(metadata.key), /bytes do not match metadata/);
});

test("list paginates within the configured prefix and heads each object", async () => {
  const commands: unknown[] = [];
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "tenant/a",
    send: async (command) => {
      commands.push(command);
      if (command instanceof ListObjectsV2Command) {
        return command.input.ContinuationToken
          ? { Contents: [{ Key: "tenant/a/images/301/fixture.png" }], IsTruncated: false }
          : { Contents: [{ Key: "tenant/a/images/300/fixture.png" }], IsTruncated: true, NextContinuationToken: "next" };
      }
      if (command instanceof HeadObjectCommand) {
        const key = command.input.Key!;
        return headOutput({ ...metadata, key: key.replace("tenant/a/", "") });
      }
      throw new Error("unexpected command");
    },
    sign: async () => "unused",
  });

  const listed: ObjectMetadata[] = [];
  for await (const item of store.list("images/")) listed.push(item);
  assert.deepEqual(listed.map((item) => item.key), ["images/300/fixture.png", "images/301/fixture.png"]);
  const lists = commands.filter((command) => command instanceof ListObjectsV2Command) as ListObjectsV2Command[];
  assert.deepEqual(lists.map((command) => command.input), [
    { Bucket: "private-media", Prefix: "tenant/a/images/" },
    { Bucket: "private-media", Prefix: "tenant/a/images/", ContinuationToken: "next" },
  ]);
});

test("list rejects provider keys outside the configured prefix", async () => {
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "tenant/a",
    send: async () => ({ Contents: [{ Key: "tenant/b/stolen.png" }] }),
    sign: async () => "unused",
  });
  await assert.rejects(async () => {
    for await (const _item of store.list()) void _item;
  }, /outside configured prefix/);
});

test("delete checks and deletes only a confined key", async () => {
  const commands: unknown[] = [];
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "tenant/a",
    send: async (command) => {
      commands.push(command);
      return command instanceof HeadObjectCommand ? headOutput() : {};
    },
    sign: async () => "unused",
  });
  assert.equal(await store.delete(metadata.key), true);
  const deletion = commands.find((command) => command instanceof DeleteObjectCommand) as DeleteObjectCommand;
  assert.deepEqual(deletion.input, {
    Bucket: "private-media",
    Key: "tenant/a/images/301/fixture.png",
  });
  await assert.rejects(() => store.delete("../stolen.png"), /Invalid object key/);
});

test("signed URLs use only GetObject and clamp expiry to 30-300 seconds", async () => {
  const signed: Array<{ command: unknown; expiresSeconds: number }> = [];
  const store = new S3ObjectStore({
    bucket: "private-media",
    prefix: "tenant/a",
    send: async () => ({}),
    sign: async (command, expiresSeconds) => {
      signed.push({ command, expiresSeconds });
      return "https://signed.invalid/read";
    },
  });
  assert.equal(await store.signedGetUrl(metadata.key, 1), "https://signed.invalid/read");
  assert.equal(await store.signedGetUrl(metadata.key, 999), "https://signed.invalid/read");
  assert.deepEqual(signed.map(({ expiresSeconds }) => expiresSeconds), [30, 300]);
  assert.ok(signed.every(({ command }) => command instanceof GetObjectCommand));
});
