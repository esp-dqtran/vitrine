import { chromium } from "playwright";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizeUrl(value) {
  const input = String(value || "").trim();
  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const parsed = new URL(candidate);
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS pages are supported");
  }
  return parsed.toString();
}

function dataUrl(buffer, mime = "image/png") {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export function playwrightBrowserPlugin() {
  let browser;
  let context;
  let page;
  let pagePromise;
  let navigationPromise;
  let navigationUrl;
  let currentUrl = "";
  let latestSelection;
  const eventClients = new Set();
  const configuredPages = new WeakSet();

  function sendEvent(res, event) {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      eventClients.delete(res);
    }
  }

  function broadcast(event) {
    for (const res of eventClients) sendEvent(res, event);
  }

  async function stateFor(activePage) {
    const state = await activePage.evaluate(() => ({
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      inspectMode: Boolean(window.__vitrinesInspector),
    }));
    return {
      ...state,
      url: activePage.url(),
      connected: true,
    };
  }

  async function captureSelection(sourcePage, rawSelection) {
    if (rawSelection?.cancelled) {
      broadcast({ type: "inspect", active: false });
      return;
    }

    let image = await sourcePage
      .locator(rawSelection.selector)
      .first()
      .screenshot({ type: "png", animations: "disabled", timeout: 15_000 })
      .catch(() => null);
    const pageRect = rawSelection.pageRect;
    if (!image && pageRect && pageRect.width > 0 && pageRect.height > 0) {
      const padding = 8;
      const clip = {
        x: Math.max(0, pageRect.x - padding),
        y: Math.max(0, pageRect.y - padding),
        width: Math.max(1, Math.min(1200, pageRect.width + padding * 2)),
        height: Math.max(1, Math.min(800, pageRect.height + padding * 2)),
      };
      image = await sourcePage
        .screenshot({ type: "png", clip, timeout: 15_000 })
        .catch(() => null);
    }

    latestSelection = {
      ...rawSelection,
      preview: image ? dataUrl(image) : null,
      sourceUrl: sourcePage.url(),
    };
    delete latestSelection.pageRect;
    broadcast({ type: "selection", selection: latestSelection });
    broadcast({ type: "inspect", active: false });
  }

  async function configurePage(activePage) {
    if (configuredPages.has(activePage)) return;
    configuredPages.add(activePage);
    activePage.setDefaultTimeout(30_000);
    await activePage.exposeBinding(
      "__vitrinesSubmitSelection",
      async ({ page: sourcePage }, payload) => captureSelection(sourcePage, payload),
    );
    activePage.on("framenavigated", (frame) => {
      if (frame !== activePage.mainFrame()) return;
      currentUrl = activePage.url();
      setTimeout(async () => {
        if (activePage.isClosed()) return;
        const state = await stateFor(activePage).catch(() => null);
        if (state) broadcast({ type: "page", page: state });
      }, 250);
    });
    activePage.on("close", () => {
      if (page === activePage) page = undefined;
      broadcast({ type: "browser", connected: false });
    });
  }

  async function ensurePage() {
    if (page && !page.isClosed()) return page;
    if (pagePromise) return pagePromise;
    pagePromise = (async () => {
      if (!browser) {
        browser = await chromium.launch({
          headless: false,
          args: ["--window-position=20,70", "--window-size=1240,840"],
        });
        browser.once("disconnected", () => {
          browser = undefined;
          context = undefined;
          page = undefined;
          broadcast({ type: "browser", connected: false });
        });
      }
      context ||= await browser.newContext({
        viewport: null,
        ignoreHTTPSErrors: true,
      });
      context.on("page", async (nextPage) => {
        await configurePage(nextPage);
        page = nextPage;
        await nextPage.bringToFront().catch(() => {});
      });
      page = await context.newPage();
      await configurePage(page);
      return page;
    })();
    try {
      return await pagePromise;
    } finally {
      pagePromise = undefined;
    }
  }

  async function pageState() {
    return stateFor(await ensurePage());
  }

  async function stopInspect(activePage = page) {
    if (!activePage || activePage.isClosed()) return { active: false };
    await activePage
      .evaluate(() => window.__vitrinesInspector?.cleanup?.())
      .catch(() => {});
    broadcast({ type: "inspect", active: false });
    return { active: false };
  }

  async function openPage(url) {
    const normalized = normalizeUrl(url);
    if (navigationPromise && navigationUrl === normalized) return navigationPromise;
    if (navigationPromise) await navigationPromise.catch(() => {});
    navigationUrl = normalized;
    navigationPromise = (async () => {
      const activePage = await ensurePage();
      await stopInspect(activePage);
      latestSelection = undefined;
      broadcast({ type: "selection", selection: null });
      try {
        await activePage.goto(normalized, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
      } catch (error) {
        const abortedAfterCommit =
          error instanceof Error &&
          error.message.includes("net::ERR_ABORTED") &&
          activePage.url() !== "about:blank";
        if (!abortedAfterCommit) throw error;
      }
      await activePage.waitForTimeout(450);
      await activePage.bringToFront();
      currentUrl = activePage.url();
      const state = await stateFor(activePage);
      broadcast({ type: "page", page: state });
      broadcast({ type: "browser", connected: true });
      return state;
    })();
    try {
      return await navigationPromise;
    } finally {
      navigationPromise = undefined;
      navigationUrl = undefined;
    }
  }

  async function startInspect() {
    const activePage = await ensurePage();
    await activePage.bringToFront();
    await activePage.evaluate(() => {
      window.__vitrinesInspector?.cleanup?.();

      const overlay = document.createElement("div");
      const label = document.createElement("div");
      overlay.setAttribute("data-vitrines-inspector", "overlay");
      overlay.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "pointer-events:none",
        "border:2px solid #6e6aff",
        "background:rgba(110,106,255,.12)",
        "box-shadow:0 0 0 1px rgba(15,15,16,.45)",
        "display:none",
      ].join(";");
      label.style.cssText = [
        "position:absolute",
        "left:-2px",
        "top:-27px",
        "padding:5px 8px",
        "border-radius:6px 6px 6px 0",
        "background:#6e6aff",
        "color:white",
        "font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
        "white-space:nowrap",
      ].join(";");
      overlay.appendChild(label);
      document.documentElement.appendChild(overlay);

      let target = null;
      const stableClass = (value) =>
        value &&
        value.length < 48 &&
        !/[0-9a-f]{8,}/i.test(value) &&
        !/^css-|^jsx-|^sc-/i.test(value);

      const selectorFor = (element) => {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const parts = [];
        let current = element;
        while (current && current !== document.body && parts.length < 6) {
          let part = current.tagName.toLowerCase();
          const classes = [...current.classList].filter(stableClass).slice(0, 2);
          if (classes.length) {
            part += classes.map((value) => `.${CSS.escape(value)}`).join("");
          }
          const parent = current.parentElement;
          if (parent) {
            const siblings = [...parent.children].filter(
              (child) => child.tagName === current.tagName,
            );
            if (siblings.length > 1) {
              part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
          }
          parts.unshift(part);
          current = parent;
        }
        return parts.join(" > ");
      };

      const updateOverlay = () => {
        if (!target || !target.isConnected) return;
        const rect = target.getBoundingClientRect();
        overlay.style.display = "block";
        overlay.style.left = `${rect.x}px`;
        overlay.style.top = `${rect.y}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        label.textContent = target.tagName.toLowerCase();
      };

      const onMove = (event) => {
        const nextTarget = document.elementFromPoint(event.clientX, event.clientY);
        if (!nextTarget || nextTarget === overlay || overlay.contains(nextTarget)) return;
        target = nextTarget;
        updateOverlay();
      };

      const cleanup = () => {
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("click", onClick, true);
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("scroll", updateOverlay, true);
        overlay.remove();
        delete window.__vitrinesInspector;
      };

      const onClick = async (event) => {
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const rect = target.getBoundingClientRect();
        const style = getComputedStyle(target);
        const text = (target.innerText || target.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const attributes = Object.fromEntries(
          [...target.attributes]
            .filter(({ name }) => !name.startsWith("data-react") && name !== "style")
            .slice(0, 12)
            .map(({ name, value }) => [name, value.slice(0, 180)]),
        );
        const componentName =
          target.getAttribute("aria-label") ||
          target.id ||
          [...target.classList].find(stableClass) ||
          (target.tagName === "BUTTON" ? text : "") ||
          target.tagName.toLowerCase();
        const payload = {
          componentName: componentName.slice(0, 80),
          selector: selectorFor(target),
          tag: target.tagName.toLowerCase(),
          role: target.getAttribute("role") || target.getAttribute("aria-label") || null,
          text: text.slice(0, 240),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          pageRect: {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height,
          },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          attributes,
          styles: {
            display: style.display,
            position: style.position,
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            borderRadius: style.borderRadius,
          },
          childCount: target.children.length,
          html: target.outerHTML.slice(0, 1600),
        };
        cleanup();
        await window.__vitrinesSubmitSelection(payload);
      };

      const onKey = async (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        cleanup();
        await window.__vitrinesSubmitSelection({ cancelled: true });
      };

      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("click", onClick, true);
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("scroll", updateOverlay, true);
      window.__vitrinesInspector = { cleanup };
    });
    broadcast({ type: "inspect", active: true });
    return { active: true };
  }

  async function clickAt(xRatio, yRatio) {
    const activePage = await ensurePage();
    const viewport = await activePage.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    await activePage.mouse.click(
      Math.max(0, Math.min(viewport.width - 1, Number(xRatio) * viewport.width)),
      Math.max(0, Math.min(viewport.height - 1, Number(yRatio) * viewport.height)),
    );
    await activePage.waitForTimeout(250);
    return stateFor(activePage);
  }

  return {
    name: "playwright-direct-browser-session",
    configureServer(server) {
      server.httpServer?.once("close", () => {
        for (const res of eventClients) res.end();
        eventClients.clear();
        browser?.close().catch(() => {});
      });

      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || "/", "http://localhost").pathname;
        if (!pathname.startsWith("/api/browser/") && pathname !== "/api/reverse-engineer") {
          next();
          return;
        }

        try {
          if (pathname === "/api/browser/events" && req.method === "GET") {
            res.statusCode = 200;
            res.setHeader("content-type", "text/event-stream");
            res.setHeader("cache-control", "no-cache, no-transform");
            res.setHeader("connection", "keep-alive");
            res.flushHeaders?.();
            eventClients.add(res);
            if (page && !page.isClosed()) {
              sendEvent(res, { type: "browser", connected: true });
            }
            if (latestSelection) {
              sendEvent(res, { type: "selection", selection: latestSelection });
            }
            const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 15_000);
            req.on("close", () => {
              clearInterval(keepAlive);
              eventClients.delete(res);
            });
            return;
          }

          if (pathname === "/api/browser/open" && req.method === "POST") {
            const body = await readJson(req);
            json(res, 200, await openPage(body.url));
            return;
          }

          if (pathname === "/api/browser/state" && req.method === "GET") {
            if (!currentUrl) {
              json(res, 409, { error: "Open a page first" });
              return;
            }
            json(res, 200, await pageState());
            return;
          }

          if (pathname === "/api/browser/selection" && req.method === "GET") {
            if (!latestSelection) {
              json(res, 404, { error: "No component has been selected" });
              return;
            }
            json(res, 200, latestSelection);
            return;
          }

          if (pathname === "/api/browser/focus" && req.method === "POST") {
            const activePage = await ensurePage();
            await activePage.bringToFront();
            json(res, 200, await stateFor(activePage));
            return;
          }

          if (pathname === "/api/browser/inspect/start" && req.method === "POST") {
            json(res, 200, await startInspect());
            return;
          }

          if (pathname === "/api/browser/inspect/stop" && req.method === "POST") {
            json(res, 200, await stopInspect());
            return;
          }

          if (pathname === "/api/browser/click" && req.method === "POST") {
            const body = await readJson(req);
            json(res, 200, await clickAt(body.xRatio, body.yRatio));
            return;
          }

          if (pathname === "/api/browser/reload" && req.method === "POST") {
            const activePage = await ensurePage();
            await activePage.reload({ waitUntil: "domcontentloaded" });
            await activePage.waitForTimeout(350);
            json(res, 200, await stateFor(activePage));
            return;
          }

          if (pathname === "/api/browser/back" && req.method === "POST") {
            const activePage = await ensurePage();
            await activePage.goBack({ waitUntil: "domcontentloaded" });
            json(res, 200, await stateFor(activePage));
            return;
          }

          if (pathname === "/api/browser/forward" && req.method === "POST") {
            const activePage = await ensurePage();
            await activePage.goForward({ waitUntil: "domcontentloaded" });
            json(res, 200, await stateFor(activePage));
            return;
          }

          if (pathname === "/api/reverse-engineer" && req.method === "POST") {
            const body = await readJson(req);
            const requestId = `rev_${Date.now().toString(36)}`;
            json(res, 200, {
              requestId,
              status: "ready",
              createdAt: new Date().toISOString(),
              sourceUrl: body.selection?.sourceUrl,
              selector: body.selection?.selector,
              componentName: body.selection?.componentName,
              scope: body.scope,
              instructions: String(body.instructions || "").trim(),
              deliverables: [
                "React component",
                "Component-scoped styles",
                "Asset inventory",
                "Interaction and responsive behavior notes",
              ],
            });
            return;
          }

          json(res, 404, { error: "Unknown browser endpoint" });
        } catch (error) {
          json(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}
