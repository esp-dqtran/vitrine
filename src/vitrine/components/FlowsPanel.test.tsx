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
  assert.match(html, /data-reference-gallery="section"/);
  assert.match(html, /data-reference-gallery="grid"/);
  assert.match(html, /Login/);
  assert.match(html, /2 steps/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
  assert.match(html, /aria-label="Open Login flow"/);
});

test("keeps the empty flows state inside the shared gallery section", () => {
  const html = renderToStaticMarkup(<FlowsPanel flows={[]} />);
  assert.match(html, /data-reference-gallery="section"/);
  assert.match(html, /No captured flows yet/);
});

test("offers the FLOW.md editor only when app and platform are known", () => {
  assert.doesNotMatch(renderToStaticMarkup(<FlowsPanel flows={[loginFlow]} />), /Open FLOW\.md/);
  const withApp = renderToStaticMarkup(<FlowsPanel flows={[loginFlow]} app="linear" platform="web" />);
  assert.match(withApp, /Open FLOW\.md/);
});

test("FlowViewer renders curator-ordered flow steps with real evidence images", () => {
  const html = renderToStaticMarkup(<FlowViewer flow={loginFlow} onBack={() => {}} />);
  assert.match(html, /Login/);
  assert.match(html, /Enter email/);
  assert.match(html, /Enter password/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
  assert.match(html, /\/api\/media\/linear\/fedcba9876543210/);
});

test("FlowViewer offers Feature Document creation only with exact source context", () => {
  assert.doesNotMatch(renderToStaticMarkup(<FlowViewer flow={loginFlow} onBack={() => {}} />), /Create Feature Document/);
  const html = renderToStaticMarkup(
    <FlowViewer flow={loginFlow} app="linear" platform="web" version={3} onBack={() => {}} />,
  );
  assert.match(html, /Create Feature Document/);
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

test("renders only the first flow batch before the scroll sentinel is reached", () => {
  const flows = Array.from(
    { length: 30 },
    (_, i) => ({ ...loginFlow, id: `f${i}`, title: `Flow ${i + 1}` }),
  );
  const html = renderToStaticMarkup(<FlowsPanel flows={flows} />);
  assert.equal((html.match(/aria-label="Open Flow \d+ flow"/g) ?? []).length, 24);
  assert.match(html, /Open Flow 24 flow/);
  assert.doesNotMatch(html, /Open Flow 25 flow/);
});

test("keeps the full category total while progressively rendering its cards", () => {
  const flows = Array.from(
    { length: 30 },
    (_, i) => ({ ...loginFlow, id: `f${i}`, title: `Flow ${i + 1}`, category: "Settings" }),
  );
  const html = renderToStaticMarkup(<FlowsPanel flows={flows} />);
  assert.match(html, />Settings<\/span><span[^>]*>30<\/span>/);
});
