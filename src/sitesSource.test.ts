import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decodeMobbinSitesSource } from "./sitesSource.ts";

const fixtureUrl = new URL(
  "../tests/fixtures/mobbin-sites-v7-rsc.txt",
  import.meta.url,
);

type FixtureSection = Record<string, unknown>;

function mutateCapturedSections(
  raw: string,
  mutate: (sections: FixtureSection[]) => void,
): string {
  const lines = raw.trimEnd().split("\n");
  const rootIndex = lines.findIndex((line) => line.startsWith("4:"));
  assert.notEqual(rootIndex, -1);
  const root = JSON.parse(lines[rootIndex].slice(2)) as [
    string,
    unknown,
    null,
    { sections: FixtureSection[] },
  ];
  mutate(root[3].sections);
  lines[rootIndex] = `4:${JSON.stringify(root)}`;
  return `${lines.join("\n")}\n`;
}

test("decodes the inspected V7 graph exactly", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const result = decodeMobbinSitesSource(raw);
  const sections = result.pages.flatMap((page) => page.sections);

  assert.equal(result.site.name, "V7");
  assert.equal(result.site.description, "AI for private equity and finance");
  assert.equal(result.site.logoUrl, "https://cdn.fixture/asset-0039.webp");
  assert.deepEqual(result.site.styles, ["Minimal"]);
  assert.equal(result.site.popularity, 193);
  assert.equal(result.version.sourceId, "f4e176f7-aeb6-4f9a-9689-e4379fc357b1");
  assert.equal(result.pages.length, 16);
  assert.equal(sections.length, 46);
  assert.equal(sections.filter((item) => item.mediaKind === "image").length, 35);
  assert.equal(sections.filter((item) => item.mediaKind === "video").length, 11);
  assert.equal(sections.flatMap((item) => item.ocrBoxes).length, 3146);
  assert.deepEqual(sections[0].sourceMetadata?.patterns, ["Hero Section"]);
  assert.deepEqual(sections[1].sourceMetadata?.patterns, ["Navigation Section"]);
  assert.deepEqual(result.pages.map((page) => page.position), [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  ]);
});

test("normalizes one-based Mobbin section display order", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    for (const section of sections) {
      section.display_order = Number(section.display_order) + 1;
    }
  });

  const result = decodeMobbinSitesSource(changed);

  for (const page of result.pages) {
    assert.deepEqual(
      page.sections.map((section) => section.position),
      page.sections.map((_, index) => index),
    );
  }
});

test("normalizes sparse Mobbin section display order", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    sections.forEach((section, index) => {
      section.display_order = index * 7 + 3;
    });
  });

  const result = decodeMobbinSitesSource(changed);

  for (const page of result.pages) {
    assert.deepEqual(
      page.sections.map((section) => section.position),
      page.sections.map((_, index) => index),
    );
  }
});

test("decodes Mobbin custom images without OCR or crop metadata", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    const image = sections.find((section) => section.type === "page_image");
    assert.ok(image);
    image.type = "custom_image";
    delete image.metadata;
    delete image.image_position_y_start;
    delete image.image_position_y_end;
  });

  const result = decodeMobbinSitesSource(changed);
  const customImage = result.pages
    .flatMap((page) => page.sections)
    .find((section) => section.sourceMetadata?.sourceType === "custom_image");

  assert.ok(customImage);
  assert.equal(customImage.mediaKind, "image");
  assert.deepEqual(customImage.ocrBoxes, []);
  assert.equal(customImage.cropTop, undefined);
  assert.equal(customImage.cropBottom, undefined);
});

test("treats the React Server Components undefined sentinel as missing metadata", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    const image = sections.find((section) => section.type === "page_image");
    assert.ok(image);
    image.metadata = "$undefined";
  });

  const result = decodeMobbinSitesSource(changed);
  const image = result.pages
    .flatMap((page) => page.sections)
    .find((section) => section.mediaKind === "image");

  assert.ok(image);
  assert.deepEqual(image.ocrBoxes, []);
  assert.equal(image.sourceMetadata?.sourceWidth, undefined);
  assert.equal(image.sourceMetadata?.sourceHeight, undefined);
});

test("decodes legacy image-only Sites using the normalized rendered source URL", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    for (const section of sections) {
      section.page_url = null;
      section.type = "custom_image";
      section.custom_image_url = section.page_image_url;
      delete section.page_video_url;
      delete section.video_timestamp_start_ms;
      delete section.video_timestamp_end_ms;
      delete section.metadata;
    }
  });

  const result = decodeMobbinSitesSource(changed, {
    sourceUrl: "http://legacy.example/",
  });

  assert.equal(result.site.sourceUrl, "https://legacy.example/");
  assert.equal(result.version.previewMediaKind, "image");
  assert.match(result.version.previewVideoUrl, /^https:\/\//);
  assert.equal(result.pages.every((page) => page.url === "https://legacy.example/"), true);
  assert.deepEqual(result.pages.slice(0, 2).map((page) => page.title), ["Page 1", "Page 2"]);
  assert.equal(
    result.pages.flatMap((page) => page.sections)
      .every((section) => section.mediaKind === "image"),
    true,
  );
});

test("preserves anchored Mobbin source-page URLs", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    const pageId = sections[0].site_page_id;
    for (const section of sections) {
      if (section.site_page_id === pageId) {
        section.page_url = "https://v7labs.com/pricing/#api";
      }
    }
  });

  const result = decodeMobbinSitesSource(changed);

  assert.equal(result.pages[0].url, "https://v7labs.com/pricing/#api");
});

test("upgrades legacy HTTP page URLs when Mobbin links to the same HTTPS Site", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    const pageId = sections[0].site_page_id;
    for (const section of sections) {
      if (section.site_page_id === pageId) {
        section.page_url = "http://v7labs.com/faqs";
      }
    }
  });

  const result = decodeMobbinSitesSource(changed, {
    sourceUrl: "https://www.v7labs.com/",
  });

  assert.equal(result.pages[0].url, "https://v7labs.com/faqs");
});

test("upgrades legacy HTTP page URLs after the Site moves to a different HTTPS hostname", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    const pageId = sections[0].site_page_id;
    for (const section of sections) {
      if (section.site_page_id === pageId) {
        section.page_url = "http://legacy.example/resources";
      }
    }
  });

  const result = decodeMobbinSitesSource(changed, {
    sourceUrl: "https://current.example/",
  });

  assert.equal(result.pages[0].url, "https://legacy.example/resources");
});

test("repairs Mobbin's single-label captured hostname from the rendered Site URL", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    const pageId = sections[0].site_page_id;
    for (const section of sections) {
      if (section.site_page_id === pageId) {
        section.page_url = "https://v7labs/404";
      }
    }
  });

  const result = decodeMobbinSitesSource(changed, {
    sourceUrl: "https://www.v7labs.com/",
  });

  assert.equal(result.pages[0].url, "https://www.v7labs.com/404");
});

test("upgrades Mobbin's rendered HTTP Site URL before persistence", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const result = decodeMobbinSitesSource(raw, {
    sourceUrl: "http://v7labs.com/",
  });

  assert.equal(result.site.sourceUrl, "https://v7labs.com/");
});

test("accepts bounded Mobbin source payloads larger than the former 2 MiB ceiling", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const lines = raw.trimEnd().split("\n");
  const rootIndex = lines.findIndex((line) => line.startsWith("4:"));
  assert.notEqual(rootIndex, -1);
  const root = JSON.parse(lines[rootIndex].slice(2)) as [
    string,
    unknown,
    null,
    Record<string, unknown>,
  ];
  root[3].ignoredPadding = "x".repeat(3 * 1024 * 1024);
  lines[rootIndex] = `4:${JSON.stringify(root)}`;

  const result = decodeMobbinSitesSource(`${lines.join("\n")}\n`);

  assert.equal(result.site.name, "V7");
  assert.equal(result.pages.length, 16);
});

test("decodes videos when source media, page image, and timestamps are incomplete", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const changed = mutateCapturedSections(raw, (sections) => {
    const video = sections.find((section) => section.type === "page_video");
    assert.ok(video);
    const pageId = video.site_page_id;
    for (const section of sections) {
      if (section.site_page_id === pageId) delete section.page_image_url;
    }
    delete video.page_video_url;
    delete video.video_timestamp_start_ms;
    delete video.video_timestamp_end_ms;
  });

  const result = decodeMobbinSitesSource(changed);
  const video = result.pages
    .flatMap((page) => page.sections)
    .find((section) => section.mediaKind === "video");

  assert.ok(video);
  assert.equal(video.posterUrl, undefined);
  assert.equal(video.videoStartSeconds, undefined);
  assert.equal(video.videoEndSeconds, undefined);
  assert.match(video.mediaUrl, /^https:\/\//);
  assert.match(result.pages[0].fullPageImageUrl, /^https:\/\//);
});

test("maps exact image crops, video boundaries, and OCR geometry", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const result = decodeMobbinSitesSource(raw);
  const sections = result.pages.flatMap((page) => page.sections);
  const image = sections.find((item) => item.mediaKind === "image");
  const video = sections.find((item) => item.mediaKind === "video");

  assert.ok(image);
  assert.ok(video);
  assert.equal(typeof image.cropTop, "number");
  assert.equal(typeof image.cropBottom, "number");
  assert.ok(image.cropBottom! > image.cropTop!);
  assert.ok(image.ocrBoxes[0].width > 0);
  assert.ok(image.ocrBoxes[0].height > 0);
  assert.equal(image.ocrBoxes[0].text, "ocr-0001");
  assert.ok(video.videoEndSeconds! > video.videoStartSeconds!);
  assert.equal(video.cropTop, undefined);
});

test("rejects truncation and source-schema drift", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  assert.throws(
    () => decodeMobbinSitesSource(raw.slice(0, raw.length / 2)),
    /Mobbin Sites source/i,
  );
  assert.throws(
    () => decodeMobbinSitesSource(raw.replaceAll('"sections"', '"changedSections"')),
    /Mobbin Sites source/i,
  );
});

test("rejects cross-row injection instead of evaluating it", () => {
  assert.throws(
    () => decodeMobbinSitesSource('4:(globalThis.compromised = true)\n'),
    /Mobbin Sites source/i,
  );
  assert.equal((globalThis as { compromised?: boolean }).compromised, undefined);
});
