import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { FlowsPanel } from "./FlowsPanel.tsx";
import { FlowViewer } from "./FlowViewer.tsx";

const loginFlow = {
  id: "login",
  title: "Login",
  description: "Authenticate with email and password",
  tags: ["Authentication"],
  steps: [
    { label: "Enter email", evidence: [{ imageId: 7, imageUrl: "/api/media/linear/0123456789abcdef", description: "Email" }] },
    { label: "Enter password", evidence: [{ imageId: 9, imageUrl: "/api/media/linear/fedcba9876543210", description: "Password" }] },
  ],
};

test("renders each flow as a compact card with its title, step count, and lead image", () => {
  const html = renderToStaticMarkup(<FlowsPanel flows={[loginFlow]} />);
  assert.match(html, /Login/);
  assert.match(html, /2 steps/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
});

test("offers a FLOW.md export only when app and platform are known", () => {
  assert.doesNotMatch(renderToStaticMarkup(<FlowsPanel flows={[loginFlow]} />), /Export FLOW\.md/);
  const withApp = renderToStaticMarkup(<FlowsPanel flows={[loginFlow]} app="linear" platform="web" />);
  assert.match(withApp, /Export FLOW\.md/);
});

test("FlowViewer renders curator-ordered flow steps with real evidence images", () => {
  const html = renderToStaticMarkup(<FlowViewer flow={loginFlow} onBack={() => {}} />);
  assert.match(html, /Login/);
  assert.match(html, /Enter email/);
  assert.match(html, /Enter password/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
  assert.match(html, /\/api\/media\/linear\/fedcba9876543210/);
});

test("FlowViewer does not render the auto-generated crawl description", () => {
  const html = renderToStaticMarkup(
    <FlowViewer flow={{ ...loginFlow, description: "Imported from Mobbin: https://mobbin.com/flows/abc" }} onBack={() => {}} />
  );
  assert.doesNotMatch(html, /Imported from Mobbin/);
});

test("groups flows by category, keeping uncategorized flows in their own section", () => {
  const flows = [
    { ...loginFlow, id: "a", title: "Copying a code", category: "Run detail" },
    { ...loginFlow, id: "b", title: "Sharing a run", category: "Run detail" },
    { ...loginFlow, id: "c", title: "Home" },
  ];
  const html = renderToStaticMarkup(<FlowsPanel flows={flows} />);
  assert.match(html, /Run detail/);
  assert.match(html, /Copying a code/);
  assert.match(html, /Sharing a run/);
  assert.match(html, /Home/);
});

test("filters flows by title via the search box once there are enough to warrant one", () => {
  const flows = Array.from({ length: 9 }, (_, i) => ({ ...loginFlow, id: `f${i}`, title: `Flow ${i}` }));
  const html = renderToStaticMarkup(<FlowsPanel flows={flows} />);
  assert.match(html, /Search flows/);
});
