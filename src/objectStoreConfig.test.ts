import assert from "node:assert/strict";
import { test } from "node:test";
import { createObjectStore, objectStoreConfigFromEnvironment } from "./objectStoreConfig.ts";
import { LocalObjectStore } from "./objectStore.ts";
import { S3ObjectStore } from "./s3ObjectStore.ts";

test("parses a local development object store", () => {
  assert.deepEqual(objectStoreConfigFromEnvironment({
    NODE_ENV: "development",
    OBJECT_STORE_BACKEND: "local",
    OBJECT_STORE_LOCAL_ROOT: "/tmp/astryx-objects",
  }), { backend: "local", root: "/tmp/astryx-objects" });
});

test("rejects local storage in production and relative roots", () => {
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "production", OBJECT_STORE_BACKEND: "local", OBJECT_STORE_LOCAL_ROOT: "/objects",
  }), /local object storage.*production/i);
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "development", OBJECT_STORE_BACKEND: "local", OBJECT_STORE_LOCAL_ROOT: "data/objects",
  }), /absolute/i);
});

test("parses production S3 with the default credential chain", () => {
  assert.deepEqual(objectStoreConfigFromEnvironment({
    NODE_ENV: "production",
    OBJECT_STORE_BACKEND: "s3",
    OBJECT_STORE_S3_BUCKET: "astryx-production",
    OBJECT_STORE_S3_REGION: "ap-southeast-1",
    OBJECT_STORE_S3_PREFIX: "catalog/v1",
  }), {
    backend: "s3",
    bucket: "astryx-production",
    region: "ap-southeast-1",
    prefix: "catalog/v1",
    forcePathStyle: false,
  });
});

test("reads the AWS_S3_* namespaced credential pair when OBJECT_STORE_* creds are unset", () => {
  const config = objectStoreConfigFromEnvironment({
    NODE_ENV: "development",
    OBJECT_STORE_BACKEND: "s3",
    OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1",
    AWS_S3_ACCESS_KEY_ID: "aws-key",
    AWS_S3_SECRET_ACCESS_KEY: "aws-secret",
  });
  assert.equal(config.backend === "s3" && config.accessKeyId, "aws-key");
  assert.equal(config.backend === "s3" && config.secretAccessKey, "aws-secret");
  // A lone AWS_S3_* key is still an incomplete pair.
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "development", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1", AWS_S3_ACCESS_KEY_ID: "aws-key",
  }), /pair/);
});

test("requires complete S3 configuration and credential pairs", () => {
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "production", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_REGION: "us-east-1",
  }), /bucket/i);
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "production", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
  }), /region/i);
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "development", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1", OBJECT_STORE_ACCESS_KEY_ID: "key-only",
  }), /credential.*pair/i);
});

test("allows development MinIO but rejects insecure or path-style production endpoints", () => {
  assert.deepEqual(objectStoreConfigFromEnvironment({
    NODE_ENV: "development", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1", OBJECT_STORE_S3_ENDPOINT: "http://minio:9000",
    OBJECT_STORE_S3_FORCE_PATH_STYLE: "true", OBJECT_STORE_ACCESS_KEY_ID: "key",
    OBJECT_STORE_SECRET_ACCESS_KEY: "secret",
  }), {
    backend: "s3", bucket: "astryx", region: "us-east-1", prefix: "",
    endpoint: "http://minio:9000/", forcePathStyle: true,
    accessKeyId: "key", secretAccessKey: "secret",
  });
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "production", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1", OBJECT_STORE_S3_ENDPOINT: "http://minio:9000",
  }), /HTTPS/i);
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "production", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1", OBJECT_STORE_S3_FORCE_PATH_STYLE: "true",
  }), /path-style.*production/i);
});

test("parses a separate public endpoint for signing browser-facing URLs", () => {
  assert.deepEqual(objectStoreConfigFromEnvironment({
    NODE_ENV: "development", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1", OBJECT_STORE_S3_ENDPOINT: "http://minio:9000",
    OBJECT_STORE_S3_PUBLIC_ENDPOINT: "http://localhost:9000",
    OBJECT_STORE_S3_FORCE_PATH_STYLE: "true", OBJECT_STORE_ACCESS_KEY_ID: "key",
    OBJECT_STORE_SECRET_ACCESS_KEY: "secret",
  }), {
    backend: "s3", bucket: "astryx", region: "us-east-1", prefix: "",
    endpoint: "http://minio:9000/", publicEndpoint: "http://localhost:9000/", forcePathStyle: true,
    accessKeyId: "key", secretAccessKey: "secret",
  });
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "production", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1", OBJECT_STORE_S3_PUBLIC_ENDPOINT: "http://minio:9000",
  }), /HTTPS/i);
});

test("rejects unknown backends and unsafe prefixes", () => {
  assert.throws(() => objectStoreConfigFromEnvironment({ OBJECT_STORE_BACKEND: "memory" }), /backend/i);
  assert.throws(() => objectStoreConfigFromEnvironment({
    NODE_ENV: "development", OBJECT_STORE_BACKEND: "s3", OBJECT_STORE_S3_BUCKET: "astryx",
    OBJECT_STORE_S3_REGION: "us-east-1", OBJECT_STORE_S3_PREFIX: "../escape",
  }), /prefix/i);
});

test("constructs the configured local or S3 adapter without exposing configuration", () => {
  assert.ok(createObjectStore({ backend: "local", root: "/tmp/astryx-objects" }) instanceof LocalObjectStore);
  assert.ok(createObjectStore({
    backend: "s3", bucket: "astryx", region: "us-east-1", prefix: "catalog",
    forcePathStyle: false,
  }) instanceof S3ObjectStore);
});
