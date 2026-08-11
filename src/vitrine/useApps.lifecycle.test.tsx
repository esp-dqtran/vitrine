import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useApps } from "./useApps.ts";

class FakeNode {
  readonly nodeType = 1;
  readonly nodeName: string;
  readonly tagName: string;
  readonly style = {};
  readonly childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  textContent = "";
  ownerDocument: FakeDocument;
  constructor(name: string, document: FakeDocument) {
    this.nodeName = name.toUpperCase();
    this.tagName = this.nodeName;
    this.ownerDocument = document;
  }
  appendChild(node: FakeNode) { node.parentNode = this; this.childNodes.push(node); return node; }
  insertBefore(node: FakeNode, before: FakeNode | null) {
    node.parentNode = this;
    const index = before ? this.childNodes.indexOf(before) : -1;
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
    return node;
  }
  removeChild(node: FakeNode) {
    this.childNodes.splice(this.childNodes.indexOf(node), 1);
    node.parentNode = null;
    return node;
  }
  addEventListener() {}
  removeEventListener() {}
  setAttribute() {}
  removeAttribute() {}
}

class FakeDocument {
  readonly nodeType = 9;
  readonly documentElement = new FakeNode("html", this);
  readonly body = new FakeNode("body", this);
  activeElement: FakeNode | null = null;
  defaultView: unknown;
  createElement(name: string) { return new FakeNode(name, this); }
  createTextNode(text: string) {
    const node = new FakeNode("#text", this);
    node.textContent = text;
    return node;
  }
  addEventListener() {}
  removeEventListener() {}
}

function installDom() {
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    reactAct: (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
  };
  const document = new FakeDocument();
  const window = {
    document,
    HTMLElement: FakeNode,
    HTMLIFrameElement: FakeNode,
    addEventListener() {},
    removeEventListener() {},
  };
  document.defaultView = window;
  Object.assign(globalThis, {
    document,
    window,
    HTMLElement: FakeNode,
    HTMLIFrameElement: FakeNode,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return {
    container: new FakeNode("div", document),
    restore: () => Object.assign(globalThis, original),
  };
}

const app = (id: string) => ({
  id,
  app: id,
  categories: [],
  accent: "#000",
  totalScreens: 0,
  platforms: ["web"],
  screens: [],
});

const publicPage = (id: string, nextCursor: string | null) => ({
  items: [{ ...app(id), previewScreens: [] }],
  nextCursor,
  totalCount: 1,
  facets: [],
});

function settle() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

test("aborts pending load-more on unmount and reloads when public source becomes admin", async () => {
  const dom = installDom();
  const originalFetch = globalThis.fetch;
  const endpoints: string[] = [];
  const loadMoreSignals: AbortSignal[] = [];
  let exposed: ReturnType<typeof useApps> | undefined;
  globalThis.fetch = (async (input, init) => {
    const endpoint = String(input);
    endpoints.push(endpoint);
    if (endpoint.includes("cursor=")) {
      if (init?.signal) loadMoreSignals.push(init.signal);
      return new Promise<Response>(() => undefined);
    }
    if (endpoint === "/api/apps") {
      return new Response(JSON.stringify({
        apps: [app("admin")],
        nextCursor: "admin-next",
        total: 1,
      }));
    }
    return new Response(JSON.stringify(publicPage("public", "next")));
  }) as typeof fetch;

  function Probe({ role }: { role: "admin" | "user" }) {
    exposed = useApps(role, true);
    return null;
  }

  const root = createRoot(dom.container as never);
  try {
    await act(async () => {
      root.render(<Probe role="user" />);
      await settle();
    });
    assert.equal(exposed?.apps?.[0]?.id, "public");
    await act(async () => {
      void exposed?.loadMore();
      await Promise.resolve();
    });
    assert.equal(loadMoreSignals[0]?.aborted, false);
    await act(async () => {
      root.render(<Probe role="admin" />);
      await settle();
    });
    assert.equal(loadMoreSignals[0]?.aborted, true);
    assert.equal(exposed?.apps?.[0]?.id, "admin");
    assert.deepEqual(endpoints.slice(0, 3), [
      "/api/apps",
      "/api/apps?cursor=next",
      "/api/apps",
    ]);
    await act(async () => {
      void exposed?.loadMore();
      await Promise.resolve();
    });
    assert.equal(loadMoreSignals[1]?.aborted, false);
    await act(async () => root.unmount());
    assert.equal(loadMoreSignals[1]?.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
    dom.restore();
  }
});
