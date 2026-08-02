import assert from "node:assert/strict";
import { test } from "node:test";
import { BlockNoteEditor, type Block } from "@blocknote/core";
import { withCollaboration } from "@blocknote/core/yjs";
import * as Y from "yjs";

const blockText = (block: Block): string => {
  if (!Array.isArray(block.content)) return "";
  return block.content.map((item) => {
    if (item.type === "text") return item.text;
    if (item.type === "link") return item.content.map((content) => content.text).join("");
    return "";
  }).join("");
};

function createCollaborativeEditor() {
  const document = new Y.Doc();
  const editor = BlockNoteEditor.create(withCollaboration({
    defaultStyles: true,
    collaboration: {
      fragment: document.getXmlFragment("document-store"),
      user: { name: "po@example.com", color: "#5b67f1" },
      showCursorLabels: "activity",
    },
  }));
  return { document, editor };
}

test("reorders blocks through the collaborative BlockNote editor", () => {
  const { document, editor } = createCollaborativeEditor();
  const first = editor.updateBlock(editor.document[0], {
    type: "paragraph",
    content: "First",
  });
  editor.insertBlocks([
    { type: "paragraph", content: "Second" },
    { type: "paragraph", content: "Third" },
  ], first, "after");

  editor.moveBlocksDown(first);
  assert.deepEqual(editor.document.map(blockText), ["Second", "First", "Third"]);

  editor.moveBlocksUp(editor.document[2]);
  assert.deepEqual(editor.document.map(blockText), ["Second", "Third", "First"]);
  document.destroy();
});

test("formats and links selected collaborative BlockNote content", () => {
  const { document, editor } = createCollaborativeEditor();
  const first = editor.updateBlock(editor.document[0], {
    type: "paragraph",
    content: "First",
  });
  const [second] = editor.insertBlocks([
    { type: "paragraph", content: "Second" },
  ], first, "after");

  editor.setSelection(first, second);
  editor.addStyles({ bold: true, italic: true, underline: true });
  editor.setSelection(first, second);
  editor.createLink("https://example.com/requirements");

  for (const block of editor.document) {
    assert.equal(Array.isArray(block.content), true);
    const content = Array.isArray(block.content) ? block.content[0] : undefined;
    assert.equal(content?.type, "link");
    if (content?.type !== "link") continue;
    assert.equal(content.href, "https://example.com/requirements");
    assert.deepEqual(content.content[0]?.styles, {
      bold: true,
      italic: true,
      underline: true,
    });
  }
  document.destroy();
});
