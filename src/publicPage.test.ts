import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPublicPageUrl,
  parsePublicPageCapture,
  PublicPageValidationError,
} from "./publicPage.ts";

test("canonicalizes one public page and derives a stable App identity", () => {
  assert.deepEqual(
    canonicalPublicPageUrl("https://www.Example.com/pricing?plan=pro#faq"),
    {
      requestedUrl: "https://www.example.com/pricing?plan=pro",
      sourceDomain: "example.com",
      appSlug: "example-com",
    },
  );
});

test("retains a non-default port and normalizes an empty path", () => {
  assert.deepEqual(canonicalPublicPageUrl("http://www.example.com:8080"), {
    requestedUrl: "http://www.example.com:8080/",
    sourceDomain: "example.com",
    appSlug: "example-com",
  });
});

test("rejects credentials, localhost, and literal private addresses", () => {
  for (const url of [
    "https://user:secret@example.com/",
    "http://localhost:3000/",
    "http://site.local/",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://172.16.0.1/",
    "http://192.168.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
  ]) {
    assert.throws(() => canonicalPublicPageUrl(url), PublicPageValidationError, url);
  }
});

test("normalizes one ordered rendered capture", () => {
  const capture = parsePublicPageCapture({
    requestedUrl: "https://example.com/pricing",
    canonicalUrl: "https://example.com/pricing",
    metadata: {
      name: " Example ",
      description: " Plans ",
      category: "Website",
      accent: "#112233",
    },
    viewport: { width: 1440, height: 900 },
    document: { width: 1440, height: 3000 },
    html: "<html></html>",
    sections: [
      {
        position: 0,
        selector: "main > section",
        tagName: "SECTION",
        heading: " Pricing ",
        text: " Pricing plans ",
        bounds: { x: 0, y: 100, width: 1440, height: 600 },
      },
      {
        position: 1,
        selector: "footer",
        tagName: "footer",
        role: "contentinfo",
        text: " Footer links ",
        bounds: { x: 0, y: 700, width: 1440, height: 300 },
      },
    ],
  });

  assert.equal(capture.metadata.name, "Example");
  assert.equal(capture.sections[0].tagName, "section");
  assert.equal(capture.sections[0].heading, "Pricing");
  assert.equal(capture.sections[1].role, "contentinfo");
});

test("rejects unordered, overlapping, or unbounded sections", () => {
  const base = {
    requestedUrl: "https://example.com/",
    canonicalUrl: "https://example.com/",
    metadata: { name: "Example", description: "Site", category: "Website", accent: "#112233" },
    viewport: { width: 1440, height: 900 },
    document: { width: 1440, height: 3000 },
    html: "<html></html>",
  };
  assert.throws(() => parsePublicPageCapture({
    ...base,
    sections: [
      { position: 1, selector: "main", tagName: "main", text: "A", bounds: { x: 0, y: 0, width: 1440, height: 500 } },
    ],
  }), PublicPageValidationError);
  assert.throws(() => parsePublicPageCapture({
    ...base,
    sections: [
      { position: 0, selector: "main", tagName: "main", text: "A", bounds: { x: 0, y: 0, width: 1440, height: 500 } },
      { position: 1, selector: "footer", tagName: "footer", text: "B", bounds: { x: 0, y: 400, width: 1440, height: 500 } },
    ],
  }), PublicPageValidationError);
});
