import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CanvasObjectToolbar,
  CanvasObjectToolbarDivider,
} from "./components/CanvasObjectToolbar.tsx";

test("provides one shared contextual toolbar shell for every selected canvas object", () => {
  const html = renderToStaticMarkup(
    <CanvasObjectToolbar ariaLabel="Image properties" className="image-toolbar">
      <button type="button">Crop</button>
      <CanvasObjectToolbarDivider />
      <button type="button">Duplicate</button>
    </CanvasObjectToolbar>,
  );

  assert.match(html, /class="canvas-object-toolbar project-object-toolbar image-toolbar"/);
  assert.match(html, /role="toolbar"/);
  assert.match(html, /aria-label="Image properties"/);
  assert.match(html, /canvas-object-toolbar__divider project-object-toolbar__divider/);
});
