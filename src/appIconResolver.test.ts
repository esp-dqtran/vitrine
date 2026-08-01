import assert from "node:assert/strict";
import test from "node:test";
import {
  appleAppStoreId,
  appleAppStoreCountry,
  extractGooglePlayIconUrls,
  extractManifestIconCandidates,
  extractWebsiteIconCandidates,
} from "./appIconResolver.ts";

test("extracts an App Store id only from an official Apple URL", () => {
  assert.equal(appleAppStoreId("https://apps.apple.com/us/app/linear/id1494420048"), "1494420048");
  assert.equal(appleAppStoreId("https://itunes.apple.com/us/app/wwdc/id640199958?mt=8"), "640199958");
  assert.equal(appleAppStoreId("https://example.com/id1494420048"), null);
});

test("uses the App Store link country for regional apps", () => {
  assert.equal(appleAppStoreCountry("https://apps.apple.com/gb/app/example/id123"), "gb");
  assert.equal(appleAppStoreCountry("https://apps.apple.com/app/example/id123"), "us");
});

test("extracts the SoftwareApplication image from Google Play structured data", () => {
  const html = `<script type="application/ld+json">{
    "@type":"SoftwareApplication",
    "name":"Example",
    "image":"https://play-lh.googleusercontent.com/example=s512-rw"
  }</script>`;
  assert.deepEqual(extractGooglePlayIconUrls(html, "https://play.google.com/store/apps/details?id=example"), [
    "https://play-lh.googleusercontent.com/example=s512-rw",
  ]);
});

test("finds manifests, touch icons, and favicons with resolved public URLs", () => {
  const result = extractWebsiteIconCandidates(`
    <link rel="manifest" href="/site.webmanifest">
    <link sizes="32x32" href="/favicon.png" rel="shortcut icon">
    <link rel="apple-touch-icon" sizes="180x180" href="icons/touch.png?x=1&amp;y=2">
  `, "https://example.com/product/");
  assert.deepEqual(result.manifests, ["https://example.com/site.webmanifest"]);
  assert.deepEqual(result.icons, [
    {
      url: "https://example.com/product/icons/touch.png?x=1&y=2",
      source: "apple-touch-icon",
      declaredSize: 180,
    },
    {
      url: "https://example.com/favicon.png",
      source: "website-icon",
      declaredSize: 32,
    },
  ]);
});

test("selects and resolves high resolution manifest icons", () => {
  assert.deepEqual(extractManifestIconCandidates({ icons: [
    { src: "icon-192.png", sizes: "192x192" },
    { src: "/icon-512.png", sizes: "512x512", purpose: "maskable" },
    { src: "javascript:alert(1)", sizes: "1024x1024" },
  ] }, "https://example.com/app.webmanifest"), [
    { url: "https://example.com/icon-512.png", source: "web-manifest", declaredSize: 512 },
    { url: "https://example.com/icon-192.png", source: "web-manifest", declaredSize: 192 },
  ]);
});
