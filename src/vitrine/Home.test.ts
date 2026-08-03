import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("shows the completed crawl totals in the public homepage statistics", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  assert.match(source, /\{ n: ["']465["'], label: ["']apps["'] \}/);
  assert.match(source, /\{ n: ["']137K\+["'], label: ["']screens["'] \}/);
  assert.match(source, /\{ n: ["']647["'], label: ["']UI elements["'] \}/);
});

test("exposes Build in public from every landing navigation mode", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  assert.match(source, /onBuildInPublic: \(\) => void/);
  assert.equal(
    (source.match(/label: ["']Build in public["']/g) ?? []).length,
    1,
  );
  assert.equal((source.match(/label="Build in public"/g) ?? []).length, 2);
});

test("uses the canonical Vitrines brand asset in the landing chrome", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  assert.equal((source.match(/src="\/favicon\.svg"/g) ?? []).length, 2);
  assert.doesNotMatch(source, /linear-gradient\(155deg,#4c7cf9,#2955d8\)/);
});

test("renders the Vitrines landing header logo at the large button size", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /label="Vitrines"[\s\S]*?variant="ghost"[\s\S]*?size="lg"/,
  );
});

test("renders Log in as the primary action in both header layouts", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  assert.equal(
    (source.match(/label="Log in"\s+variant="primary"/g) ?? []).length,
    2,
  );
});

test("uses real catalog icons in the looping product carousel", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
  const styles = await readFile(
    new URL("./styles.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /className="home-logo-carousel"/);
  assert.match(source, /src=\{app\.iconUrl\}/);
  assert.match(source, /\{\[0, 1\]\.map\(\(group\)/);
  assert.doesNotMatch(source, /proofNames/);
  assert.match(styles, /\.home-logo-carousel__track/);
  assert.match(styles, /animation: hmMarqueeL 30s linear infinite/);
});

test("presents the complete evidence-to-handoff product workflow", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  assert.match(source, /Product research for decisions that ship/);
  assert.match(source, /Start with the product, not a blank search box/);
  assert.match(source, /See what happens before and after the perfect screen/);
  assert.match(source, /Collect the references\. Keep the reasoning attached/);
  assert.match(source, /Apps & sites/);
  assert.match(source, /Living canvas/);
  assert.match(source, /A full product research platform/);
  assert.match(source, /Patterns found in real products/);
  assert.match(source, /Your next decision starts here/);
});

test("uses the generated Vitrines product demo with a real catalog poster", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  assert.match(source, /<video/);
  assert.match(source, /autoPlay/);
  assert.match(source, /muted/);
  assert.match(source, /loop/);
  assert.match(source, /\/landing\/astryx-product-demo\.mp4/);
  assert.match(source, /poster="\/landing\/astryx-apps-catalog\.png"/);
});

test("embeds the live catalog as the desktop hero, ambient and click-through", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  // Real product in the hero: same-origin iframe of /apps, not a recording.
  assert.match(source, /<iframe/);
  assert.match(source, /src="\/apps"/);
  // Ambient, not a scroll trap: no pointer events, reduced-motion respected,
  // and the whole frame acts as a link into the real page.
  assert.match(source, /pointerEvents: "none"/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /aria-label="Open the live Vitrines catalog"/);
  // Mobile keeps the recorded demo instead of a second React instance.
  assert.match(source, /isMobile \? \(\s*<video/);
});

test("hands the landing prompt to the catalog search", async () => {
  const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

  assert.match(source, /aria-label="What are you researching\?"/);
  assert.match(source, /sessionStorage\.setItem\(["']astryx:q["'], trimmed\)/);
  assert.equal(
    (source.match(/<PromptSearch onBrowse=\{onBrowse\}/g) ?? []).length,
    1,
  );
});
