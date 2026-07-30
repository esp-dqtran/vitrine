import assert from "node:assert/strict";
import test from "node:test";
import {
  appWebsiteDestinationKind,
  extractMobbinAppWebsiteMetadata,
  mobbinRscUrl,
  verifiedAppleDestination,
  verifiedAppWebsiteUrl,
} from "./appWebsiteBackfill.ts";

test("extracts the official destination from Mobbin's escaped RSC payload", () => {
  const payload = String.raw`7:["$","x",null,{"app":{"appStoreUrl":"https://aboardhr.com/","appName":"Aboard"}}]`;

  assert.deepEqual(extractMobbinAppWebsiteMetadata(payload), {
    appName: "Aboard",
    appStoreUrl: "https://aboardhr.com/",
    hasAppStoreUrlField: true,
  });
});

test("extracts ordinary JSON fields and distinguishes a missing destination", () => {
  assert.deepEqual(
    extractMobbinAppWebsiteMetadata('{"appName":"Linear","appStoreUrl":"https:\\/\\/linear.app\\/"}'),
    {
      appName: "Linear",
      appStoreUrl: "https://linear.app/",
      hasAppStoreUrlField: true,
    },
  );
  assert.deepEqual(extractMobbinAppWebsiteMetadata('{"appName":"Unknown"}'), {
    appName: "Unknown",
    appStoreUrl: null,
    hasAppStoreUrlField: false,
  });
});

test("accepts only public destinations outside Mobbin's media infrastructure", () => {
  assert.equal(verifiedAppWebsiteUrl("https://linear.app"), "https://linear.app/");
  assert.equal(verifiedAppWebsiteUrl("salesforce.com"), "https://salesforce.com/");
  assert.equal(
    verifiedAppWebsiteUrl("https://apps.apple.com/us/app/example/id123?mt=8#details"),
    "https://apps.apple.com/us/app/example/id123?mt=8",
  );
  for (const unsafe of [
    "javascript:alert(1)",
    "http://localhost:3000",
    "https://user:password@example.com",
    "mobbin.com",
    "https://mobbin.com/apps/example",
    "https://cdn.example.supabase.co/file.png",
  ]) {
    assert.equal(verifiedAppWebsiteUrl(unsafe), null);
  }
});

test("classifies official marketplace destinations separately from websites", () => {
  assert.equal(appWebsiteDestinationKind("https://apps.apple.com/us/app/example/id123"), "apple-app-store");
  assert.equal(appWebsiteDestinationKind("https://play.google.com/store/apps/details?id=example"), "google-play");
  assert.equal(appWebsiteDestinationKind("https://linear.app/"), "website");
});

test("accepts one exact Apple software match and prefers its developer website", () => {
  assert.deepEqual(
    verifiedAppleDestination("Airtable", [{
      trackName: "Airtable",
      sellerUrl: "https://airtable.com",
      trackViewUrl: "https://apps.apple.com/us/app/airtable/id586683407",
    }]),
    { url: "https://airtable.com/", matchedName: "Airtable" },
  );
});

test("accepts one branded prefix but rejects ambiguous Apple matches", () => {
  assert.deepEqual(
    verifiedAppleDestination("Rocket Money", [{
      trackName: "Rocket Money - Bills & Budgets",
      sellerUrl: "https://www.rocketmoney.com/",
    }]),
    {
      url: "https://www.rocketmoney.com/",
      matchedName: "Rocket Money - Bills & Budgets",
    },
  );
  assert.equal(verifiedAppleDestination("Matter", [
    { trackName: "Matter Formula", sellerUrl: "https://matterformula.com" },
    { trackName: "Matter: Reading App", sellerUrl: "https://getmatter.com" },
  ]), null);
});

test("uses the App Store page when an exact Apple result has no developer website", () => {
  assert.deepEqual(
    verifiedAppleDestination("Example", [{
      trackName: "Example",
      trackViewUrl: "https://apps.apple.com/us/app/example/id123?uo=4",
    }]),
    {
      url: "https://apps.apple.com/us/app/example/id123?uo=4",
      matchedName: "Example",
    },
  );
});

test("builds a bounded Mobbin RSC request URL", () => {
  assert.equal(
    mobbinRscUrl("https://mobbin.com/apps/linear-web-id/latest/screens"),
    "https://mobbin.com/apps/linear-web-id/latest/screens?_rsc=website-backfill",
  );
  assert.throws(() => mobbinRscUrl("https://example.com/apps/linear"));
  assert.throws(() => mobbinRscUrl("http://mobbin.com/apps/linear"));
});
