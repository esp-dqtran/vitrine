import assert from "node:assert/strict";
import test from "node:test";
import {
  googlePlayListing,
  googlePlayOriginalScreenshotUrl,
  googlePlayPhoneScreenshots,
  googlePlayListingsInHtml,
  googlePlayScreenshots,
  googlePlayTitleMatches,
  googlePlayWebsiteMatches,
} from "./googlePlayImport.ts";

test("canonicalizes an official Google Play listing while preserving its locale", () => {
  assert.deepEqual(
    googlePlayListing("https://play.google.com/store/apps/details?id=com.aaptiv.android&hl=en_SG&gl=US&utm_source=test"),
    {
      packageId: "com.aaptiv.android",
      url: "https://play.google.com/store/apps/details?id=com.aaptiv.android&hl=en_SG&gl=US",
    },
  );
});

test("rejects non-Play listings and invalid package ids", () => {
  assert.throws(
    () => googlePlayListing("https://example.com/store/apps/details?id=com.aaptiv.android"),
    /official Google Play/,
  );
  assert.throws(
    () => googlePlayListing("https://play.google.com/store/apps/details?id=aaptiv"),
    /valid Android package/,
  );
});

test("requests the original Google Play screenshot asset", () => {
  assert.equal(
    googlePlayOriginalScreenshotUrl(
      "https://play-lh.googleusercontent.com/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=w526-h296-rw",
    ),
    "https://play-lh.googleusercontent.com/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=s0",
  );
});

test("keeps screenshot shelf order and removes duplicate renditions", () => {
  const one = "https://play-lh.googleusercontent.com/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const two = "https://play-lh.googleusercontent.com/0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  assert.deepEqual(googlePlayScreenshots([
    `${one}=w526-h296-rw`,
    `${one}=s0`,
    `${two}=w526-h296-rw`,
  ]), [
    { index: 1, url: `${one}=s0` },
    { index: 2, url: `${two}=s0` },
  ]);
});

test("matches a store title only when it starts with the complete app name", () => {
  assert.equal(googlePlayTitleMatches("Notion", "Notion: Notes, Tasks, AI"), true);
  assert.equal(googlePlayTitleMatches("Notion", "Notion Calendar"), true);
  assert.equal(googlePlayTitleMatches("Notion Calendar", "Notion: Notes, Tasks, AI"), false);
});

test("matches official website subdomains but not unrelated domains", () => {
  assert.equal(googlePlayWebsiteMatches("https://notion.so", "http://www.notion.so/mobile"), true);
  assert.equal(googlePlayWebsiteMatches("https://support.example.com", "https://example.com/app"), true);
  assert.equal(googlePlayWebsiteMatches("https://notion.so", "https://notion-calendar.example"), false);
});

test("extracts unique Google Play listings from official-site HTML", () => {
  const listings = googlePlayListingsInHtml(`
    <a href="https://play.google.com/store/apps/details?id=notion.id&amp;hl=en_US">Play</a>
    <script>"https://play.google.com/store/apps/details?id=notion.id\\u0026gl=US"</script>
  `);
  assert.deepEqual(listings, [{ packageId: "notion.id", url: "https://play.google.com/store/apps/details?id=notion.id&hl=en_US" }]);
});

test("keeps the dominant phone screenshot orientation and excludes other device groups", () => {
  const base = "https://play-lh.googleusercontent.com/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  assert.deepEqual(googlePlayPhoneScreenshots([
    { url: `${base}01=w526-h296-rw`, width: 166, height: 296 },
    { url: `${base}02=w526-h296-rw`, width: 296, height: 166 },
    { url: `${base}05=w526-h296-rw`, width: 166, height: 296 },
    { url: `${base}03=w526-h296-rw`, width: 208, height: 296 },
    { url: `${base}04=w526-h296-rw`, width: 296, height: 296 },
  ]), [
    { index: 1, url: `${base}01=s0` },
    { index: 2, url: `${base}05=s0` },
  ]);
});

test("keeps landscape screenshots when the phone shelf is landscape", () => {
  const base = "https://play-lh.googleusercontent.com/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  assert.deepEqual(googlePlayPhoneScreenshots([
    { url: `${base}01=w526-h296-rw`, width: 296, height: 166 },
    { url: `${base}02=w526-h296-rw`, width: 296, height: 166 },
  ]), [
    { index: 1, url: `${base}01=s0` },
    { index: 2, url: `${base}02=s0` },
  ]);
});

test("keeps only the first Google Play phone device group", () => {
  const base = "https://play-lh.googleusercontent.com/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const screenshots = googlePlayPhoneScreenshots(Array.from({ length: 16 }, (_, index) => ({
    url: `${base}${String(index).padStart(2, "0")}=w526-h296-rw`,
    width: 166,
    height: 296,
  })));
  assert.equal(screenshots.length, 8);
  assert.match(screenshots[7]?.url ?? "", /07=s0$/);
});
