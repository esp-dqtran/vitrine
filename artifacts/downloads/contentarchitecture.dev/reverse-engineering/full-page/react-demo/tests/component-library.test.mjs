import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("component catalog contains the reconstructed export inventory", async () => {
  const catalog = await source("src/componentCatalog.js");
  const components = [...catalog.matchAll(/\n\s*id: "/g)];
  assert.equal(components.length, 32);
  for (const group of ["page", "ui", "effects", "system"]) {
    assert.match(catalog, new RegExp(`group: "${group}"`));
  }
});

test("component catalog route is available in the app shell", async () => {
  const app = await source("src/App.jsx");
  assert.match(app, /ComponentLibraryPage/);
  assert.match(app, /pathname === "\/components"/);
  assert.match(app, /pathname === "\/components\/all"/);
});
