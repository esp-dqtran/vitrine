import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "./markdownToHtml.ts";

test("escapes raw HTML and drops dangerous link schemes", () => {
  const html = markdownToHtml("<script>alert(1)</script>\n\n[x](javascript:alert(1)) [ok](https://a.com)");
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.match(html, /href="https:\/\/a\.com"/);
});

test("renders the FLOW.md block grammar", () => {
  const html = markdownToHtml("# Title\n\n1. **a** step\n2. b\n\n> note\n\n- one\n- two");
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<strong>a<\/strong>/);
  assert.match(html, /<blockquote>note<\/blockquote>/);
  assert.match(html, /<ul>/);
});

test("renders a leading --- frontmatter block verbatim", () => {
  const html = markdownToHtml("---\ntitle: X\nflows: 2\n---\n\n# Body");
  assert.match(html, /<pre class="fm">title: X\nflows: 2<\/pre>/);
  assert.match(html, /<h1>Body<\/h1>/);
});
