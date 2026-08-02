import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const componentUrl = new URL("./components/ProjectDocumentPage.tsx", import.meta.url);
const cssUrl = new URL("./components/projectDocument.css", import.meta.url);

test("presents the BlockNote document as a Notion-like native page", async () => {
  const [component, css] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(component, /aria-label="Document breadcrumb"/);
  assert.match(component, /Add comment/);
  assert.match(component, /aria-label="Copy link"/);
  assert.match(component, /aria-label="Document title"/);
  assert.match(component, /<textarea[\s\S]*aria-label="Document title"/);
  assert.match(component, /cancelTitleCommitRef\.current = true/);
  assert.match(component, /window\.addEventListener\("resize", resizeTitle\)/);
  assert.match(component, /window\.removeEventListener\("resize", resizeTitle\)/);
  assert.match(component, /new Map\(next\.map\(\(user\) => \[user\.name, user\]\)\)/);
  assert.match(component, /Page width/);
  assert.match(component, /Page discussion/);
  assert.match(component, /aria-label="Document settings"/);
  assert.match(component, /editable=\{document\.role === "editor"\}/);
  assert.match(component, /readOnly=\{document\.role !== "editor"\}/);
  assert.match(component, /formattingToolbar/);
  assert.match(component, /linkToolbar/);
  assert.match(component, /slashMenu/);
  assert.match(component, /sideMenu/);
  assert.match(component, /filePanel/);
  assert.match(component, /tableHandles/);
  assert.match(component, /emojiPicker/);
  assert.match(css, /\.project-document-page__topbar/);
  assert.match(css, /\.project-document__title/);
  assert.match(css, /\.project-document-discussion__composer textarea[\s\S]*background: #fff/);
  assert.match(css, /\.project-document-comment p[\s\S]*color: #37352f/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.project-document__page-controls[\s\S]*opacity: 1/);
  assert.doesNotMatch(css, /box-shadow:\s*0 18px 55px/);
});
