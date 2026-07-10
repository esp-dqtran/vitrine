import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ComponentsPanel } from "./ComponentsPanel.tsx";

test("renders app-specific components with real evidence images", () => {
  const html = renderToStaticMarkup(<ComponentsPanel components={[{
    id: "button",
    name: "Button",
    category: "Actions",
    description: "Rounded action control",
    variants: [{
      id: "button-primary",
      name: "Primary",
      description: "Filled purple button",
      evidence: [{ imageId: 7, imageUrl: "/api/media/linear/0123456789abcdef", description: "Toolbar" }],
    }],
  }]} />);
  assert.match(html, /Button/);
  assert.match(html, /1 observed variant/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
});
