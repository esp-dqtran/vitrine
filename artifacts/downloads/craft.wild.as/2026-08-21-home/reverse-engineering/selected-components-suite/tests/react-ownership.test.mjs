import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../src/components/TetrisFooter.jsx", import.meta.url), "utf8");
const ambient = readFileSync(new URL("../src/hooks/useAmbientField.js", import.meta.url), "utf8");
const hero = readFileSync(new URL("../src/components/HeroSection.jsx", import.meta.url), "utf8");
const heroField = readFileSync(new URL("../src/hooks/useHeroField.js", import.meta.url), "utf8");
const carousel = readFileSync(new URL("../src/components/CarouselSection.jsx", import.meta.url), "utf8");
const process = readFileSync(new URL("../src/components/ProcessFlowSection.jsx", import.meta.url), "utf8");

const sourceFiles = readdirSync(new URL("../src", import.meta.url), { recursive: true })
  .filter((name) => /\.(?:js|jsx)$/.test(name))
  .map((name) => readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8"))
  .join("\n");

test("does not inject extracted runtime scripts", () => {
  assert.doesNotMatch(app, /createElement\(["']script["']\)/);
  assert.doesNotMatch(app, /data-source-runtime/);
  assert.doesNotMatch(app, /-runtime\.js/);
  assert.doesNotMatch(ambient, /document\.createElement/);
  assert.doesNotMatch(sourceFiles, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(sourceFiles, /createElement\(["']script["']\)/);
});

test("keeps interactive markup under React", () => {
  assert.match(footer, /id="tetris"/);
  assert.match(footer, /aria-label="Move left"/);
  assert.match(footer, /aria-label="Hard drop"/);
  assert.match(footer, /useTetrisFooter/);
});

test("keeps the source cursor charge and pixel shockwave in React hooks", () => {
  for (const hook of [ambient, heroField]) {
    assert.match(hook, /pointerdown/);
    assert.match(hook, /pointerup/);
    assert.match(hook, /dblclick/);
    assert.match(hook, /2\.2/);
    assert.match(hook, /1\.5/);
    assert.match(hook, /Math\.hypot\(width, height\) \* 1\.7/);
  }
});

test("renders every selected section as a React component", () => {
  for (const component of [
    "HeroSection",
    "WorkCarouselSection",
    "ProcessFlowSection",
    "ProtocolPartsSection",
    "ExperimentsCarouselSection",
  ]) {
    assert.match(app, new RegExp(`<${component}`), component);
  }
  assert.match(hero, /useHeroField/);
  assert.match(process, /id="process"/);
  assert.match(carousel, /aria-label="Previous slides"/);
  assert.match(carousel, /aria-label="Next slides"/);
  assert.match(carousel, /onPointerDown/);
});

test("bundles the downloaded source media locally", () => {
  for (const name of [
    "work/replit-agent-3.mp4",
    "work/serve-robotics.mp4",
    "experiments/wild-week-athens.mp4",
    "experiments/very-fluffy.mp4",
    "wild-logo.svg",
  ]) {
    assert.equal(existsSync(new URL(`../public/assets/${name}`, import.meta.url)), true, name);
  }
});

test("removes the public imperative runtime bundle", () => {
  for (const name of ["ambient-runtime.js", "button-runtime.js", "footer-runtime.js", "protocol-runtime.js"]) {
    assert.equal(existsSync(new URL(`../public/${name}`, import.meta.url)), false, name);
  }
});
