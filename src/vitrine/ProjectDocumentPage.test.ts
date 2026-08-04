import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const componentUrl = new URL(
  "./components/ProjectDocumentPage.tsx",
  import.meta.url,
);
const cssUrl = new URL("./components/projectDocument.css", import.meta.url);

test("presents the BlockNote document as a Notion-like native page", async () => {
  const [component, css] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(component, /aria-label="Document breadcrumb"/);
  assert.match(component, /icon="chevronLeft"/);
  assert.match(component, /Comment on selection/);
  assert.match(component, /Insert from Vitrines/);
  assert.match(component, /insertProjectDocumentEvidenceBlock\(editor\)/);
  assert.match(component, /evidence=\{evidence\}/);
  assert.match(component, /label=\{copied \? "Copied" : "Copy link"\}/);
  assert.match(component, /aria-label="Document title"/);
  assert.match(component, /<textarea[\s\S]*aria-label="Document title"/);
  assert.match(component, /cancelTitleCommitRef\.current = true/);
  assert.match(component, /window\.addEventListener\("resize", resizeTitle\)/);
  assert.match(
    component,
    /window\.removeEventListener\("resize", resizeTitle\)/,
  );
  assert.match(
    component,
    /new Map\(next\.map\(\(user\) => \[user\.name, user\]\)\)/,
  );
  assert.match(component, /Page width/);
  assert.match(component, /Contextual review/);
  assert.match(component, /parentCommentId/);
  assert.match(component, /deleteProjectDocumentCommentById/);
  assert.match(component, /label="Reply"/);
  assert.match(component, /label="Delete"/);
  assert.match(component, /editor\.getSelectedText\(\)/);
  assert.match(component, /aria-label="Document settings"/);
  assert.match(component, /project-document-action--favorite/);
  assert.match(component, /project-document-action--share/);
  assert.match(component, /project-document-actions-menu__mobile-action/);
  assert.match(
    component,
    /data-testid="project-document-connection"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-label=\{saveStatusLabel\[displayedSaveState\]\}/,
  );
  assert.match(component, /onStateless: \(\{ payload \}\) =>/);
  assert.match(component, /projectDocumentStateVectorCoversDocument/);
  assert.match(component, /<DocumentSaveIcon state=\{displayedSaveState\} \/>/);
  assert.doesNotMatch(component, /\{connectionLabel\}/);
  assert.match(css, /\.project-document__connection--saved/);
  assert.match(component, /project-document-discussion__error/);
  assert.match(component, /label="Retry"/);
  assert.match(component, /editable=\{document\.role === "editor"\}/);
  assert.match(component, /readOnly=\{document\.role !== "editor"\}/);
  assert.match(component, /formattingToolbar/);
  assert.match(component, /linkToolbar/);
  assert.match(component, /slashMenu/);
  assert.match(component, /sideMenu/);
  assert.match(component, /filePanel/);
  assert.match(component, /tableHandles/);
  assert.match(component, /emojiPicker/);
  assert.match(component, /theme=\{resolvedTheme\}/);
  assert.match(component, /useResolvedThemeMode/);
  assert.match(
    component,
    /\{document\.icon !== "none"[\s\S]*?<IconButton[\s\S]*?label="Change page icon"[\s\S]*?<div className="project-document__page-controls">/,
  );
  assert.match(css, /\.project-document-page__topbar/);
  assert.match(css, /\.project-document__title/);
  assert.match(
    css,
    /\.project-document-discussion__composer textarea[\s\S]*background: var\(--project-document-surface/,
  );
  assert.match(
    css,
    /\.project-document-comment p[\s\S]*color: var\(--project-document-text/,
  );
  assert.match(css, /--project-document-surface:\s*var\(--vitrine-color-surface\)/);
  assert.match(
    css,
    /\.project-document__editor \.bn-container\[data-color-scheme\][\s\S]*?--bn-colors-editor-background:\s*transparent;/,
  );
  assert.match(
    css,
    /\.project-document__page-icon\s*\{[^}]*width:\s*72px;[^}]*height:\s*72px;/s,
  );
  assert.match(
    css,
    /\.project-document__page-icon \.astryx-icon\s*\{[^}]*width:\s*48px;[^}]*height:\s*48px;[^}]*font-size:\s*48px;/s,
  );
  assert.match(
    css,
    /\.project-document__page-controls\s*\{[^}]*opacity:\s*1;/s,
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*\.project-document__page-controls[\s\S]*opacity: 1/,
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*\.project-document-action--favorite[\s\S]*display: none/,
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*\.project-document-breadcrumb__root-label[\s\S]*display: none/,
  );
  assert.doesNotMatch(css, /box-shadow:\s*0 18px 55px/);
});
