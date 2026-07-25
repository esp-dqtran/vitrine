import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { Page, Response } from "playwright";
import {
  createSiteResourceCollector,
  sanitizeSiteResourceUrl,
  sourceMapReferences,
  sourceMapSources,
} from "./siteResourceEvidence.ts";

test("redacts resource query values and fragments", () => {
  assert.equal(
    sanitizeSiteResourceUrl(
      "https://user:password@cdn.example/motion.mjs?v=secret#source",
    ),
    "https://cdn.example/motion.mjs",
  );
});

test("retains source-map names without source contents", () => {
  assert.deepEqual(sourceMapSources(JSON.stringify({
    version: 3,
    sources: ["framer-motion.mjs", "react.mjs"],
    sourcesContent: ["private source", "private source"],
  })), ["framer-motion.mjs", "react.mjs"]);
});

test("resolves only declared public source maps", () => {
  assert.deepEqual(
    sourceMapReferences(
      [
        "console.log(1);",
        "//# sourceMappingURL=motion.mjs.map",
        "//# sourceMappingURL=data:application/json;base64,private",
      ].join("\n"),
      "https://cdn.example/assets/motion.mjs",
    ),
    ["https://cdn.example/assets/motion.mjs.map"],
  );
});

test("collector enforces per-resource and count limits", async () => {
  const page = new EventEmitter();
  const collector = createSiteResourceCollector({
    validateNavigation: async () => undefined,
    maximumResources: 128,
    maximumResourceBytes: 512 * 1_024,
    maximumTotalBytes: 8 * 1_024 * 1_024,
  });
  collector.attach(page as unknown as Page);

  page.emit("response", fakeResponse(
    "https://cdn.example/too-large.js",
    Buffer.alloc(513 * 1_024),
  ));
  for (let index = 0; index < 129; index += 1) {
    page.emit("response", fakeResponse(
      `https://cdn.example/${index}.js`,
      Buffer.from(`console.log(${index})`),
    ));
  }

  const snapshot = await collector.snapshot();
  assert.equal(snapshot.length, 128);
  assert.equal(
    snapshot.some((item) => item.url.endsWith("/too-large.js")),
    false,
  );
  assert.equal(
    snapshot.some((item) => item.url.endsWith("/128.js")),
    false,
  );
});

test("collector validates source maps and retains only source names", async () => {
  const page = new EventEmitter();
  const validated: string[] = [];
  const collector = createSiteResourceCollector({
    validateNavigation: async (url) => {
      validated.push(url);
    },
    requestText: async (url) => ({
      url,
      status: 200,
      headers: { "content-type": "application/json" },
      body: Buffer.from(JSON.stringify({
        version: 3,
        sources: ["webpack:///src/hero.ts", "framer-motion.mjs"],
        sourcesContent: ["private", "private"],
      })),
    }),
  });
  collector.attach(page as unknown as Page);
  page.emit("response", fakeResponse(
    "https://cdn.example/motion.js?token=private",
    Buffer.from("motion();\n//# sourceMappingURL=motion.js.map?key=secret"),
  ));

  const snapshot = await collector.snapshot();
  const map = snapshot.find((item) => item.kind === "source-map");
  assert.deepEqual(validated, [
    "https://cdn.example/motion.js.map?key=secret",
  ]);
  assert.deepEqual(JSON.parse(map?.text ?? "[]"), [
    "webpack:///src/hero.ts",
    "framer-motion.mjs",
  ]);
  assert.equal(map?.url, "https://cdn.example/motion.js.map");
  assert.equal(snapshot.some((item) => item.text.includes("private")), false);
});

function fakeResponse(url: string, body: Buffer): Response {
  return {
    url: () => url,
    status: () => 200,
    headers: () => ({
      "content-length": String(body.byteLength),
      "content-type": "application/javascript",
    }),
    request: () => ({ resourceType: () => "script" }),
    body: async () => body,
  } as unknown as Response;
}
