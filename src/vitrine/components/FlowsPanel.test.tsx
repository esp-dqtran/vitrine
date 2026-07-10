import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { FlowsPanel } from "./FlowsPanel.tsx";

test("renders curator-ordered flow steps with real evidence images", () => {
  const html = renderToStaticMarkup(<FlowsPanel flows={[{
    id: "login",
    title: "Login",
    description: "Authenticate with email and password",
    tags: ["Authentication"],
    steps: [
      { label: "Enter email", evidence: [{ imageId: 7, imageUrl: "/api/media/linear/0123456789abcdef", description: "Email" }] },
      { label: "Enter password", evidence: [{ imageId: 9, imageUrl: "/api/media/linear/fedcba9876543210", description: "Password" }] },
    ],
  }]} />);

  assert.match(html, /Login/);
  assert.match(html, /Enter email/);
  assert.match(html, /Enter password/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
  assert.match(html, /\/api\/media\/linear\/fedcba9876543210/);
});
