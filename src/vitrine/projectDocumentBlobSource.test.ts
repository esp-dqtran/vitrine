import assert from "node:assert/strict";
import test from "node:test";

import { ProjectDocumentHttpBlobSource } from "./projectDocumentBlobSource.ts";

test("uploads, lists, downloads, and deletes Project document blobs", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchPort: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (!init) {
      if (url.endsWith("/blobs")) {
        return Response.json({ ids: ["source_1"] });
      }
      return new Response(new Blob(["image"], { type: "image/png" }), {
        headers: { "content-type": "image/png" },
      });
    }
    return new Response(null, {
      status: init.method === "PUT" ? 201 : 204,
    });
  };
  const source = new ProjectDocumentHttpBlobSource(
    "/api/research-projects/7/document/41/blobs",
    { fetch: fetchPort },
  );

  assert.equal(
    await source.set(
      "source_1",
      new Blob(["image"], { type: "image/png" }),
    ),
    "source_1",
  );
  assert.deepEqual(await source.list(), ["source_1"]);
  assert.equal((await source.get("source_1"))?.type, "image/png");
  await source.delete("source_1");

  assert.equal(calls[0]?.init?.method, "PUT");
  assert.equal(
    new Headers(calls[0]?.init?.headers).get("content-type"),
    "application/octet-stream",
  );
  assert.equal(
    new Headers(calls[0]?.init?.headers).get(
      "x-astryx-blob-content-type",
    ),
    "image/png",
  );
  assert.equal(calls.at(-1)?.init?.method, "DELETE");
});

test("maps missing blobs to null and rejects writes for public shares", async () => {
  const source = new ProjectDocumentHttpBlobSource(
    "/api/project-document-shares/token/blobs",
    {
      readOnly: true,
      fetch: async () => new Response(null, { status: 404 }),
    },
  );

  assert.equal(await source.get("missing"), null);
  await assert.rejects(
    source.set("source_1", new Blob(["image"])),
    /read-only/,
  );
});
