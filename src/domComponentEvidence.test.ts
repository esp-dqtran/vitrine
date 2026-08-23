import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import {
  captureDomComponentEvidence,
  writeDomComponentEvidence,
} from "./domComponentEvidence/index.ts";

test("captures complete DOM component evidence from the Chromium CSS engine", async (context) => {
  const fixture = await startFixtureServer();
  const browser = await chromium.launch({ headless: true });
  context.after(async () => {
    await browser.close();
    await closeServer(fixture.server);
  });
  const page = await browser.newPage({ viewport: { width: 720, height: 640 } });
  await page.goto(fixture.url, { waitUntil: "domcontentloaded" });

  const evidence = await captureDomComponentEvidence(page, {
    selector: "#target",
    viewports: [
      { name: "desktop", width: 720, height: 640 },
      { name: "mobile", width: 390, height: 640 },
    ],
    states: [
      { name: "default" },
      { name: "hover", forcePseudoClasses: ["hover"] },
    ],
    interactions: [{
      name: "clicked",
      viewport: "desktop",
      actions: [{ type: "click", selector: "button" }],
      waitMs: 100,
    }],
  });

  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.source.selector, "#target");
  assert.equal(evidence.states.length, 5);
  assert.ok(evidence.stylesheets.some((sheet) => sheet.text.includes("#target:hover")));
  assert.ok(evidence.stylesheets.some((sheet) => sheet.text.includes("@media (max-width: 500px)")));

  const desktop = requiredState(evidence, "desktop-default");
  const root = requiredNode(desktop, ":scope");
  const button = requiredNode(desktop, ":scope > button");
  assert.equal(root.tagName, "section");
  assert.equal(root.attributes.id, "target");
  assert.equal(root.computedStyles.display, "grid");
  assert.equal(root.computedStyles["row-gap"], "12px");
  assert.equal(root.computedStyles["column-gap"], "12px");
  assert.ok(root.boxModel?.width);
  assert.ok(root.fonts.some((font) => font.familyName.length > 0));
  assert.match(JSON.stringify(root.matchedStyles), /#target/);
  assert.match(JSON.stringify(root.matchedStyles), /pseudoType[^}]*before/);
  assert.equal(root.pseudoComputedStyles["::before"]?.content, '"badge"');
  assert.ok(button.eventListeners.some((listener) => listener.type === "click"));
  assert.ok(desktop.screenshot?.base64.length);

  const hover = requiredState(evidence, "desktop-hover");
  assert.equal(requiredNode(hover, ":scope").computedStyles["outline-width"], "4px");

  const mobile = requiredState(evidence, "mobile-default");
  assert.notEqual(
    requiredNode(mobile, ":scope").computedStyles["grid-template-columns"],
    root.computedStyles["grid-template-columns"],
  );

  const clicked = requiredState(evidence, "desktop-clicked");
  assert.equal(requiredNode(clicked, ":scope").attributes["data-state"], "clicked");
  assert.ok(clicked.mutations.some((mutation) =>
    mutation.type === "attributes" && mutation.attributeName === "data-state"
  ));
  assert.ok(clicked.networkRequests.some((request) => request.url.endsWith("/event")));
  assert.ok(evidence.assets.some((asset) => asset.url.endsWith("/bg.svg")));
  assert.ok(evidence.assets.some((asset) => asset.url.endsWith("/icon.svg")));
  assert.ok(evidence.scripts.some((script) => script.inlineText?.includes("data-state")));
});

test("writes a portable component evidence package", async (context) => {
  const fixture = await startFixtureServer();
  const browser = await chromium.launch({ headless: true });
  context.after(async () => {
    await browser.close();
    await closeServer(fixture.server);
  });
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  await page.goto(fixture.url, { waitUntil: "domcontentloaded" });
  const evidence = await captureDomComponentEvidence(page, {
    selector: "#target",
    states: [{ name: "default" }],
  });
  const output = await mkdtemp(join(tmpdir(), "vitrines-dom-evidence-"));
  const written = await writeDomComponentEvidence(evidence, output);

  assert.ok((await stat(written.manifestPath)).isFile());
  assert.equal(written.statePaths.length, 1);
  assert.equal(written.screenshotPaths.length, 1);
  assert.ok(written.stylesheetPaths.length >= 1);
  const manifest = JSON.parse(await readFile(written.manifestPath, "utf8")) as {
    source: { selector: string };
    states: Array<{ path: string; screenshotPath: string }>;
    stylesheets: Array<{ path: string; text?: string }>;
  };
  assert.equal(manifest.source.selector, "#target");
  assert.equal(manifest.states[0]?.path, "states/current-default.json");
  assert.equal(manifest.states[0]?.screenshotPath, "screenshots/current-default.png");
  assert.ok(manifest.stylesheets.every((stylesheet) => stylesheet.path.endsWith(".css")));
  assert.ok(manifest.stylesheets.every((stylesheet) => stylesheet.text == null));
  const stateJson = await readFile(written.statePaths[0]!, "utf8");
  assert.doesNotMatch(stateJson, /"base64"/);
  assert.match(await readFile(join(output, "subtree.html"), "utf8"), /id="target"/);
});

function requiredState(
  evidence: Awaited<ReturnType<typeof captureDomComponentEvidence>>,
  id: string,
) {
  const state = evidence.states.find((candidate) => candidate.id === id);
  assert.ok(state, `Missing state ${id}`);
  return state;
}

function requiredNode(
  state: ReturnType<typeof requiredState>,
  path: string,
) {
  const node = state.nodes.find((candidate) => candidate.path === path);
  assert.ok(node, `Missing node ${path}`);
  return node;
}

async function startFixtureServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    if (request.url === "/styles.css") {
      response.writeHead(200, { "content-type": "text/css" });
      response.end(`
        :root { --fixture-accent: rgb(18, 52, 86); }
        #target {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          width: 420px;
          padding: 16px;
          color: var(--fixture-accent);
          font-family: Arial, sans-serif;
          background: url('/bg.svg') center / cover no-repeat;
          border: 2px solid currentColor;
          animation: fixture-pulse 2s linear infinite;
        }
        #target::before { content: "badge"; display: block; }
        #target:hover { outline: 4px solid rgb(200, 20, 20); }
        #target.clicked { border-radius: 18px; }
        @media (max-width: 500px) {
          #target { grid-template-columns: 1fr; width: 320px; }
        }
        @keyframes fixture-pulse { from { opacity: .99; } to { opacity: 1; } }
      `);
      return;
    }
    if (request.url === "/bg.svg" || request.url === "/icon.svg") {
      response.writeHead(200, { "content-type": "image/svg+xml" });
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="blue"/></svg>');
      return;
    }
    if (request.url === "/event") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html>
      <html>
        <head><title>DOM evidence fixture</title><link rel="stylesheet" href="/styles.css"></head>
        <body>
          <section id="target">
            <button type="button">Activate</button>
            <img src="/icon.svg" alt="Fixture icon">
          </section>
          <script>
            document.querySelector('#target button').addEventListener('click', () => {
              const target = document.querySelector('#target');
              target.classList.add('clicked');
              target.setAttribute('data-state', 'clicked');
              fetch('/event');
            });
          </script>
        </body>
      </html>`);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
