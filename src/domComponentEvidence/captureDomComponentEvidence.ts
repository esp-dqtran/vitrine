import { createHash } from "node:crypto";
import type { CDPSession, Page, Request } from "playwright";
import type {
  CaptureDomComponentEvidenceOptions,
  CapturedAsset,
  CapturedBoxModel,
  CapturedDomNode,
  CapturedEventListener,
  CapturedFont,
  CapturedMutation,
  CapturedNetworkRequest,
  CapturedScript,
  CapturedStylesheet,
  DomComponentAction,
  DomComponentCaptureLimits,
  DomComponentEvidence,
  DomComponentInteractionSpec,
  DomComponentStateEvidence,
  DomComponentStateSpec,
  DomComponentViewport,
} from "./types.ts";

interface ProtocolNode {
  nodeId: number;
  backendNodeId?: number;
  nodeType: number;
  nodeName: string;
  localName?: string;
  nodeValue?: string;
  attributes?: string[];
  children?: ProtocolNode[];
  shadowRoots?: ProtocolNode[];
  pseudoElements?: ProtocolNode[];
  contentDocument?: ProtocolNode;
}

interface CapturableNode {
  protocol: ProtocolNode;
  parentNodeId?: number;
  path: string;
}

interface EffectiveLimits {
  maxNodes: number;
  maxHtmlBytes: number;
  maxStylesheetBytes: number;
  maxTotalStylesheetBytes: number;
  maxMutationRecords: number;
  maxNetworkRecords: number;
  maxScreenshotHeight: number;
}

type CdpRecord = Record<string, unknown>;

const DEFAULT_LIMITS: EffectiveLimits = {
  maxNodes: 300,
  maxHtmlBytes: 2_000_000,
  maxStylesheetBytes: 2_000_000,
  maxTotalStylesheetBytes: 10_000_000,
  maxMutationRecords: 500,
  maxNetworkRecords: 250,
  maxScreenshotHeight: 12_000,
};

const PSEUDO_SELECTORS = ["::before", "::after", "::marker", "::placeholder"];
const ASSET_ATTRIBUTES = new Set(["src", "poster", "data", "href", "xlink:href"]);
const ASSET_TAGS = new Set([
  "audio",
  "embed",
  "image",
  "img",
  "link",
  "object",
  "script",
  "source",
  "track",
  "use",
  "video",
]);

export async function captureDomComponentEvidence(
  page: Page,
  options: CaptureDomComponentEvidenceOptions,
): Promise<DomComponentEvidence> {
  if (!options.selector.trim()) throw new Error("Component selector is required");
  const limits = effectiveLimits(options.limits);
  const warnings = new Set<string>();
  const stylesheetHeaders = new Map<string, CdpRecord>();
  const referencedStyleSheetIds = new Set<string>();
  const originalViewport = page.viewportSize();
  const session = await page.context().newCDPSession(page);
  session.on("CSS.styleSheetAdded", (event: CdpRecord) => {
    const header = asRecord(event.header);
    const styleSheetId = stringValue(header.styleSheetId);
    if (styleSheetId) stylesheetHeaders.set(styleSheetId, header);
  });

  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    await session.send("Animation.enable").catch((error: unknown) => {
      warnings.add(`Animation domain unavailable: ${message(error)}`);
    });

    const viewports = await captureViewports(page, options.viewports);
    const states = normalizeStates(options.states);
    const stateEvidence: DomComponentStateEvidence[] = [];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await settleLayout(page);

      for (const state of states) {
        const rootNodeId = await resolveRootNodeId(session, options.selector);
        const forcedNodeId = await resolveStateTargetNodeId(session, rootNodeId, state);
        await session.send("CSS.forcePseudoState", {
          nodeId: forcedNodeId,
          forcedPseudoClasses: state.forcePseudoClasses ?? [],
        });
        try {
          if (state.waitMs) await page.waitForTimeout(state.waitMs);
          await settleLayout(page);
          stateEvidence.push(await captureState({
            page,
            session,
            selector: options.selector,
            viewport,
            state: state.name,
            kind: "state",
            limits,
            warnings,
            referencedStyleSheetIds,
            mutations: [],
            networkRequests: [],
          }));
        } finally {
          // DOM.getDocument can refresh CDP node ids while a state is captured.
          // Resolve the target again before clearing the forced pseudo state.
          const currentRootNodeId = await resolveRootNodeId(session, options.selector);
          const currentForcedNodeId = await resolveStateTargetNodeId(
            session,
            currentRootNodeId,
            state,
          );
          await session.send("CSS.forcePseudoState", {
            nodeId: currentForcedNodeId,
            forcedPseudoClasses: [],
          });
        }
      }

      for (const interaction of options.interactions ?? []) {
        if (interaction.viewport && interaction.viewport !== viewport.name) continue;
        const interactionEvidence = await captureInteraction({
          page,
          session,
          selector: options.selector,
          viewport,
          interaction,
          limits,
          warnings,
          referencedStyleSheetIds,
        });
        stateEvidence.push(interactionEvidence);
      }
    }

    const stylesheets = await captureStylesheets({
      session,
      stylesheetHeaders,
      referencedStyleSheetIds,
      limits,
      warnings,
    });
    const scripts = await captureScripts(page);
    const sourceUrl = page.url();
    const assets = collectAssets(sourceUrl, stateEvidence, stylesheets);

    return {
      schemaVersion: 1,
      source: {
        url: sourceUrl,
        selector: options.selector,
        title: await page.title(),
        capturedAt: new Date().toISOString(),
      },
      states: stateEvidence,
      stylesheets,
      assets,
      scripts,
      warnings: [...warnings],
    };
  } finally {
    if (originalViewport) {
      await page.setViewportSize(originalViewport).catch(() => undefined);
    }
    await session.detach().catch(() => undefined);
  }
}

async function captureState(input: {
  page: Page;
  session: CDPSession;
  selector: string;
  viewport: DomComponentViewport;
  state: string;
  kind: "state" | "interaction";
  limits: EffectiveLimits;
  warnings: Set<string>;
  referencedStyleSheetIds: Set<string>;
  mutations: CapturedMutation[];
  networkRequests: CapturedNetworkRequest[];
}): Promise<DomComponentStateEvidence> {
  const rootNodeId = await resolveRootNodeId(input.session, input.selector);
  const rootTree = await describeNodeTree(input.session, rootNodeId);
  const nodes = collectCapturableNodes(rootTree, input.limits.maxNodes, input.warnings);
  const capturedNodes = await mapLimit(nodes, 8, async (node, index) =>
    captureNode(
      input.session,
      node,
      index,
      nodes,
      input.warnings,
      input.referencedStyleSheetIds,
    )
  );
  const outerHtmlResponse = asRecord(await input.session.send("DOM.getOuterHTML", {
    nodeId: rootNodeId,
  }));
  const outerHtml = truncateUtf8(
    stringValue(outerHtmlResponse.outerHTML) ?? "",
    input.limits.maxHtmlBytes,
  );
  if (Buffer.byteLength(stringValue(outerHtmlResponse.outerHTML) ?? "") > input.limits.maxHtmlBytes) {
    input.warnings.add(`Outer HTML exceeded ${input.limits.maxHtmlBytes} bytes and was truncated`);
  }
  const screenshot = await captureComponentScreenshot(
    input.page,
    input.selector,
    input.limits,
    input.warnings,
  );

  return {
    id: `${safeName(input.viewport.name)}-${safeName(input.state)}`,
    viewport: input.viewport,
    state: input.state,
    kind: input.kind,
    outerHtml,
    nodes: capturedNodes,
    mutations: input.mutations,
    networkRequests: input.networkRequests,
    ...(screenshot ? { screenshot } : {}),
  };
}

async function captureNode(
  session: CDPSession,
  node: CapturableNode,
  index: number,
  allNodes: CapturableNode[],
  warnings: Set<string>,
  referencedStyleSheetIds: Set<string>,
): Promise<CapturedDomNode> {
  const nodeId = node.protocol.nodeId;
  const [attributeResponse, matchedResponse, computedResponse, boxResponse, fontsResponse] =
    await Promise.all([
      optionalSend(session, "DOM.getAttributes", { nodeId }, warnings, "attributes"),
      optionalSend(session, "CSS.getMatchedStylesForNode", { nodeId }, warnings, "matched styles"),
      optionalSend(session, "CSS.getComputedStyleForNode", { nodeId }, warnings, "computed styles"),
      optionalSend(session, "DOM.getBoxModel", { nodeId }, warnings, "box model", true),
      optionalSend(session, "CSS.getPlatformFontsForNode", { nodeId }, warnings, "fonts", true),
    ]);
  const matchedStyles = matchedResponse ?? {};
  collectStyleSheetIds(matchedStyles, referencedStyleSheetIds);
  const resolved = await optionalSend(
    session,
    "DOM.resolveNode",
    { nodeId },
    warnings,
    "runtime node",
    true,
  );
  const objectId = stringValue(asRecord(resolved?.object).objectId);
  let pseudoComputedStyles: CapturedDomNode["pseudoComputedStyles"] = {};
  let eventListeners: CapturedEventListener[] = [];
  let animatedStyles: CdpRecord | undefined;
  if (objectId) {
    [pseudoComputedStyles, eventListeners, animatedStyles] = await Promise.all([
      capturePseudoComputedStyles(session, objectId, warnings),
      captureEventListeners(session, objectId, warnings),
      optionalSend(
        session,
        "CSS.getAnimatedStylesForNode",
        { nodeId },
        warnings,
        "animated styles",
        true,
      ),
    ]);
  }
  if (animatedStyles) collectStyleSheetIds(animatedStyles, referencedStyleSheetIds);
  const parentIndex = node.parentNodeId == null
    ? -1
    : allNodes.findIndex((candidate) => candidate.protocol.nodeId === node.parentNodeId);
  const attributes = alternatingRecord(
    arrayValue(attributeResponse?.attributes).length
      ? arrayValue(attributeResponse?.attributes)
      : node.protocol.attributes ?? [],
  );

  return {
    id: `NODE-${index}`,
    ...(parentIndex >= 0 ? { parentId: `NODE-${parentIndex}` } : {}),
    nodeId,
    ...(node.protocol.backendNodeId == null
      ? {}
      : { backendNodeId: node.protocol.backendNodeId }),
    path: node.path,
    tagName: (node.protocol.localName || node.protocol.nodeName).toLowerCase(),
    attributes,
    directText: directText(node.protocol).slice(0, 2_000),
    matchedStyles,
    computedStyles: computedStyleRecord(computedResponse),
    pseudoComputedStyles,
    boxModel: boxModel(boxResponse),
    fonts: capturedFonts(fontsResponse),
    eventListeners,
    ...(animatedStyles ? { animatedStyles } : {}),
  };
}

async function captureInteraction(input: {
  page: Page;
  session: CDPSession;
  selector: string;
  viewport: DomComponentViewport;
  interaction: DomComponentInteractionSpec;
  limits: EffectiveLimits;
  warnings: Set<string>;
  referencedStyleSheetIds: Set<string>;
}): Promise<DomComponentStateEvidence> {
  const mutationToken = `vitrines-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await installMutationRecorder(input.page, input.selector, mutationToken);
  const requests: CapturedNetworkRequest[] = [];
  const requestListener = (request: Request) => {
    if (requests.length >= input.limits.maxNetworkRecords) return;
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
  };
  input.page.on("request", requestListener);
  try {
    for (const action of input.interaction.actions) {
      await performAction(input.page, input.selector, action);
    }
    if (input.interaction.waitMs) await input.page.waitForTimeout(input.interaction.waitMs);
    await settleLayout(input.page);
  } finally {
    input.page.off("request", requestListener);
  }
  const mutations = await takeMutationRecords(
    input.page,
    mutationToken,
    input.limits.maxMutationRecords,
  );
  if (mutations.length >= input.limits.maxMutationRecords) {
    input.warnings.add(
      `Interaction ${input.interaction.name} reached the mutation record limit`,
    );
  }
  return captureState({
    page: input.page,
    session: input.session,
    selector: input.selector,
    viewport: input.viewport,
    state: input.interaction.name,
    kind: "interaction",
    limits: input.limits,
    warnings: input.warnings,
    referencedStyleSheetIds: input.referencedStyleSheetIds,
    mutations,
    networkRequests: requests,
  });
}

async function performAction(
  page: Page,
  rootSelector: string,
  action: DomComponentAction,
): Promise<void> {
  const root = page.locator(rootSelector);
  const target = action.selector ? root.locator(action.selector) : root;
  if (action.type === "click") await target.click();
  if (action.type === "hover") await target.hover();
  if (action.type === "focus") await target.focus();
  if (action.type === "press") await target.press(action.key);
  if (action.type === "fill") await target.fill(action.value);
}

async function installMutationRecorder(
  page: Page,
  selector: string,
  token: string,
): Promise<void> {
  await page.evaluate(({ selector: selected, token: key }) => {
    const root = document.querySelector(selected);
    if (!root) throw new Error(`Selected component not found: ${selected}`);
    const storage = globalThis as typeof globalThis & {
      __vitrinesDomMutationRecorders?: Record<string, {
        observer: MutationObserver;
        records: Array<Record<string, unknown>>;
      }>;
    };
    storage.__vitrinesDomMutationRecorders ??= {};
    const records: Array<Record<string, unknown>> = [];
    const selectorFor = (node: Node): string => {
      if (!(node instanceof Element)) return node.parentElement?.tagName.toLowerCase() ?? "#text";
      if (node.id) return `#${CSS.escape(node.id)}`;
      const classes = [...node.classList].slice(0, 2).map((value) => `.${CSS.escape(value)}`);
      return `${node.tagName.toLowerCase()}${classes.join("")}`;
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        records.push({
          type: mutation.type,
          target: selectorFor(mutation.target),
          ...(mutation.type === "attributes"
            ? {
              attributeName: mutation.attributeName ?? undefined,
              oldValue: mutation.oldValue,
            }
            : {}),
          ...(mutation.type === "childList"
            ? {
              addedNodes: mutation.addedNodes.length,
              removedNodes: mutation.removedNodes.length,
            }
            : {}),
          ...(mutation.type === "characterData" ? { oldValue: mutation.oldValue } : {}),
        });
      }
    });
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });
    storage.__vitrinesDomMutationRecorders[key] = { observer, records };
  }, { selector, token });
}

async function takeMutationRecords(
  page: Page,
  token: string,
  limit: number,
): Promise<CapturedMutation[]> {
  return page.evaluate(({ token: key, limit: maximum }) => {
    const storage = globalThis as typeof globalThis & {
      __vitrinesDomMutationRecorders?: Record<string, {
        observer: MutationObserver;
        records: Array<Record<string, unknown>>;
      }>;
    };
    const recorder = storage.__vitrinesDomMutationRecorders?.[key];
    if (!recorder) return [];
    recorder.observer.disconnect();
    const records = recorder.records.slice(0, maximum);
    delete storage.__vitrinesDomMutationRecorders?.[key];
    return records;
  }, { token, limit }) as unknown as Promise<CapturedMutation[]>;
}

async function captureStylesheets(input: {
  session: CDPSession;
  stylesheetHeaders: Map<string, CdpRecord>;
  referencedStyleSheetIds: Set<string>;
  limits: EffectiveLimits;
  warnings: Set<string>;
}): Promise<CapturedStylesheet[]> {
  const stylesheets: CapturedStylesheet[] = [];
  let totalBytes = 0;
  for (const styleSheetId of input.referencedStyleSheetIds) {
    if (totalBytes >= input.limits.maxTotalStylesheetBytes) {
      input.warnings.add("Total stylesheet capture limit reached");
      break;
    }
    const response = await optionalSend(
      input.session,
      "CSS.getStyleSheetText",
      { styleSheetId },
      input.warnings,
      "stylesheet text",
      true,
    );
    if (!response) continue;
    const fullText = stringValue(response.text) ?? "";
    const byteSize = Buffer.byteLength(fullText);
    const remaining = input.limits.maxTotalStylesheetBytes - totalBytes;
    const maximum = Math.min(input.limits.maxStylesheetBytes, remaining);
    const text = truncateUtf8(fullText, maximum);
    const header = input.stylesheetHeaders.get(styleSheetId) ?? {};
    stylesheets.push({
      styleSheetId,
      ...(stringValue(header.sourceURL) ? { sourceUrl: stringValue(header.sourceURL) } : {}),
      ...(stringValue(header.origin) ? { origin: stringValue(header.origin) } : {}),
      ...(stringValue(header.title) ? { title: stringValue(header.title) } : {}),
      ...(typeof header.disabled === "boolean" ? { disabled: header.disabled } : {}),
      ...(typeof header.isInline === "boolean" ? { isInline: header.isInline } : {}),
      ...(typeof header.isConstructed === "boolean"
        ? { isConstructed: header.isConstructed }
        : {}),
      sha256: createHash("sha256").update(fullText).digest("hex"),
      byteSize,
      text,
      truncated: Buffer.byteLength(text) < byteSize,
    });
    totalBytes += Buffer.byteLength(text);
  }
  return stylesheets;
}

async function capturePseudoComputedStyles(
  session: CDPSession,
  objectId: string,
  warnings: Set<string>,
): Promise<CapturedDomNode["pseudoComputedStyles"]> {
  const response = await optionalSend(
    session,
    "Runtime.callFunctionOn",
    {
      objectId,
      functionDeclaration: `function() {
        const result = {};
        for (const pseudo of ${JSON.stringify(PSEUDO_SELECTORS)}) {
          const style = getComputedStyle(this, pseudo);
          const properties = {};
          for (let index = 0; index < style.length; index += 1) {
            const property = style.item(index);
            properties[property] = style.getPropertyValue(property);
          }
          if (style.content !== 'none' || pseudo === '::marker') {
            result[pseudo] = { content: style.content, properties };
          }
        }
        return result;
      }`,
      returnByValue: true,
    },
    warnings,
    "pseudo-element styles",
    true,
  );
  return asRecord(asRecord(response?.result).value) as CapturedDomNode["pseudoComputedStyles"];
}

async function captureEventListeners(
  session: CDPSession,
  objectId: string,
  warnings: Set<string>,
): Promise<CapturedEventListener[]> {
  const response = await optionalSend(
    session,
    "DOMDebugger.getEventListeners",
    { objectId, depth: 1, pierce: true },
    warnings,
    "event listeners",
    true,
  );
  return arrayValue(response?.listeners).map((value) => {
    const listener = asRecord(value);
    return {
      type: stringValue(listener.type) ?? "unknown",
      useCapture: Boolean(listener.useCapture),
      passive: Boolean(listener.passive),
      once: Boolean(listener.once),
      ...(stringValue(listener.scriptId) ? { scriptId: stringValue(listener.scriptId) } : {}),
      ...(numberValue(listener.lineNumber) == null
        ? {}
        : { lineNumber: numberValue(listener.lineNumber) }),
      ...(numberValue(listener.columnNumber) == null
        ? {}
        : { columnNumber: numberValue(listener.columnNumber) }),
      ...(numberValue(listener.backendNodeId) == null
        ? {}
        : { backendNodeId: numberValue(listener.backendNodeId) }),
    };
  });
}

async function captureComponentScreenshot(
  page: Page,
  selector: string,
  limits: EffectiveLimits,
  warnings: Set<string>,
): Promise<DomComponentStateEvidence["screenshot"]> {
  const locator = page.locator(selector);
  const box = await locator.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) {
    warnings.add("Selected component had no visible screenshot bounds");
    return undefined;
  }
  if (box.height > limits.maxScreenshotHeight) {
    warnings.add(
      `Selected component exceeded screenshot height limit (${Math.round(box.height)}px)`,
    );
    return undefined;
  }
  try {
    const body = await locator.screenshot({ type: "png", animations: "allow" });
    return {
      contentType: "image/png",
      width: Math.round(box.width),
      height: Math.round(box.height),
      base64: body.toString("base64"),
    };
  } catch (error) {
    warnings.add(`Component screenshot unavailable: ${message(error)}`);
    return undefined;
  }
}

async function captureScripts(page: Page): Promise<CapturedScript[]> {
  return page.evaluate(() =>
    [...document.scripts].slice(0, 256).map((script) => ({
      ...(script.src ? { url: script.src } : {}),
      ...(script.type ? { type: script.type } : {}),
      async: script.async,
      defer: script.defer,
      ...(!script.src && script.textContent
        ? { inlineText: script.textContent.slice(0, 16_384) }
        : {}),
    }))
  );
}

function collectAssets(
  sourceUrl: string,
  states: DomComponentStateEvidence[],
  stylesheets: CapturedStylesheet[],
): CapturedAsset[] {
  const assets = new Map<string, { kinds: Set<string>; nodeIds: Set<string> }>();
  const add = (candidate: string, kind: string, nodeId?: string) => {
    const cleaned = candidate.trim().replace(/^['"]|['"]$/g, "");
    if (!cleaned || cleaned === "none" || cleaned.startsWith("#")) return;
    let url: string;
    try {
      url = new URL(cleaned, sourceUrl).href;
    } catch {
      return;
    }
    const entry = assets.get(url) ?? { kinds: new Set<string>(), nodeIds: new Set<string>() };
    entry.kinds.add(kind);
    if (nodeId) entry.nodeIds.add(nodeId);
    assets.set(url, entry);
  };
  const firstState = states[0];
  for (const node of firstState?.nodes ?? []) {
    if (ASSET_TAGS.has(node.tagName)) {
      for (const [name, value] of Object.entries(node.attributes)) {
        if (name === "srcset") {
          for (const item of value.split(",")) add(item.trim().split(/\s+/)[0] ?? "", "srcset", node.id);
        } else if (ASSET_ATTRIBUTES.has(name)) {
          add(value, `${node.tagName}:${name}`, node.id);
        }
      }
    }
    collectCssUrls(JSON.stringify(node.matchedStyles), (value) => add(value, "matched-css", node.id));
    for (const [property, value] of Object.entries(node.computedStyles)) {
      if (property.includes("background") || property.includes("image") || property === "cursor") {
        collectCssUrls(value, (url) => add(url, `computed:${property}`, node.id));
      }
    }
  }
  for (const stylesheet of stylesheets) {
    collectCssUrls(stylesheet.text, (value) => add(value, "stylesheet"));
  }
  return [...assets.entries()].map(([url, value]) => ({
    url,
    kinds: [...value.kinds].sort(),
    nodeIds: [...value.nodeIds].sort(),
  }));
}

function collectCssUrls(text: string, add: (value: string) => void): void {
  for (const match of text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
    if (match[2]) add(match[2]);
  }
}

async function resolveRootNodeId(session: CDPSession, selector: string): Promise<number> {
  const documentResponse = asRecord(await session.send("DOM.getDocument", {
    depth: -1,
    pierce: true,
  }));
  const root = asRecord(documentResponse.root);
  const documentNodeId = numberValue(root.nodeId);
  if (!documentNodeId) throw new Error("Browser DOM document was unavailable");
  const response = asRecord(await session.send("DOM.querySelector", {
    nodeId: documentNodeId,
    selector,
  }));
  const nodeId = numberValue(response.nodeId);
  if (!nodeId) throw new Error(`Selected component not found: ${selector}`);
  return nodeId;
}

async function resolveStateTargetNodeId(
  session: CDPSession,
  rootNodeId: number,
  state: DomComponentStateSpec,
): Promise<number> {
  if (!state.targetSelector) return rootNodeId;
  const response = asRecord(await session.send("DOM.querySelector", {
    nodeId: rootNodeId,
    selector: state.targetSelector,
  }));
  const nodeId = numberValue(response.nodeId);
  if (!nodeId) {
    throw new Error(
      `State target not found for ${state.name}: ${state.targetSelector}`,
    );
  }
  return nodeId;
}

async function describeNodeTree(session: CDPSession, nodeId: number): Promise<ProtocolNode> {
  const response = asRecord(await session.send("DOM.describeNode", {
    nodeId,
    depth: -1,
    pierce: true,
  }));
  return response.node as ProtocolNode;
}

function collectCapturableNodes(
  root: ProtocolNode,
  maximum: number,
  warnings: Set<string>,
): CapturableNode[] {
  const nodes: CapturableNode[] = [];
  const visitChildren = (
    children: ProtocolNode[],
    parentNodeId: number,
    parentPath: string,
    shadow: boolean,
  ) => {
    const elementChildren = children.filter((child) => child.nodeType === 1);
    const counts = new Map<string, number>();
    for (const child of elementChildren) {
      const tag = (child.localName || child.nodeName).toLowerCase();
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const positions = new Map<string, number>();
    for (const child of elementChildren) {
      const tag = (child.localName || child.nodeName).toLowerCase();
      const position = (positions.get(tag) ?? 0) + 1;
      positions.set(tag, position);
      const suffix = (counts.get(tag) ?? 0) > 1 ? `:nth-of-type(${position})` : "";
      visit(child, parentNodeId, `${parentPath}${shadow ? " >>> " : " > "}${tag}${suffix}`);
    }
    for (const child of children.filter((candidate) => candidate.nodeType !== 1)) {
      if (child.children?.length) visitChildren(child.children, parentNodeId, parentPath, shadow);
    }
  };
  const visit = (node: ProtocolNode, parentNodeId?: number, path = ":scope") => {
    if (nodes.length >= maximum) return;
    if (node.nodeType === 1) nodes.push({ protocol: node, parentNodeId, path });
    const currentParentId = node.nodeType === 1 ? node.nodeId : parentNodeId;
    const currentPath = node.nodeType === 1 ? path : ":scope";
    if (node.children?.length && currentParentId != null) {
      visitChildren(node.children, currentParentId, currentPath, false);
    }
    if (node.shadowRoots?.length && currentParentId != null) {
      for (const shadowRoot of node.shadowRoots) {
        visitChildren(shadowRoot.children ?? [], currentParentId, currentPath, true);
      }
    }
    if (node.contentDocument?.children?.length && currentParentId != null) {
      visitChildren(node.contentDocument.children, currentParentId, `${currentPath} >>> iframe`, true);
    }
  };
  visit(root);
  if (nodes.length >= maximum) warnings.add(`Component node capture reached the ${maximum} node limit`);
  return nodes;
}

function collectStyleSheetIds(value: unknown, output: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectStyleSheetIds(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "styleSheetId" && typeof item === "string") output.add(item);
    else collectStyleSheetIds(item, output);
  }
}

function computedStyleRecord(response: CdpRecord | undefined): Record<string, string> {
  const output: Record<string, string> = {};
  for (const value of arrayValue(response?.computedStyle)) {
    const property = asRecord(value);
    const name = stringValue(property.name);
    const propertyValue = stringValue(property.value);
    if (name && propertyValue != null) output[name] = propertyValue;
  }
  return output;
}

function boxModel(response: CdpRecord | undefined): CapturedBoxModel | undefined {
  const model = asRecord(response?.model);
  if (!Array.isArray(model.content)) return undefined;
  return {
    content: numberArray(model.content),
    padding: numberArray(model.padding),
    border: numberArray(model.border),
    margin: numberArray(model.margin),
    width: numberValue(model.width) ?? 0,
    height: numberValue(model.height) ?? 0,
  };
}

function capturedFonts(response: CdpRecord | undefined): CapturedFont[] {
  return arrayValue(response?.fonts).map((value) => {
    const font = asRecord(value);
    return {
      familyName: stringValue(font.familyName) ?? "",
      postScriptName: stringValue(font.postScriptName) ?? "",
      isCustomFont: Boolean(font.isCustomFont),
      glyphCount: numberValue(font.glyphCount) ?? 0,
    };
  });
}

function effectiveLimits(overrides: DomComponentCaptureLimits | undefined): EffectiveLimits {
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
  return limits;
}

async function captureViewports(
  page: Page,
  configured: DomComponentViewport[] | undefined,
): Promise<DomComponentViewport[]> {
  if (configured?.length) {
    for (const viewport of configured) {
      if (!viewport.name.trim()) throw new Error("Viewport name is required");
      if (!Number.isSafeInteger(viewport.width) || viewport.width <= 0) {
        throw new Error(`Viewport ${viewport.name} width must be positive`);
      }
      if (!Number.isSafeInteger(viewport.height) || viewport.height <= 0) {
        throw new Error(`Viewport ${viewport.name} height must be positive`);
      }
    }
    return configured;
  }
  const current = page.viewportSize() ?? await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  return [{ name: "current", width: current.width, height: current.height }];
}

function normalizeStates(states: DomComponentStateSpec[] | undefined): DomComponentStateSpec[] {
  const configured = states?.length ? states : [{ name: "default" }];
  const names = new Set<string>();
  for (const state of configured) {
    if (!state.name.trim()) throw new Error("State name is required");
    if (names.has(state.name)) throw new Error(`Duplicate state name: ${state.name}`);
    names.add(state.name);
  }
  return configured;
}

async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function optionalSend(
  session: CDPSession,
  method: string,
  parameters: Record<string, unknown>,
  warnings: Set<string>,
  label: string,
  quiet = false,
): Promise<CdpRecord | undefined> {
  try {
    const dynamicSession = session as unknown as {
      send(method: string, parameters?: Record<string, unknown>): Promise<unknown>;
    };
    return asRecord(await dynamicSession.send(method, parameters));
  } catch (error) {
    if (!quiet) warnings.add(`${label} unavailable: ${message(error)}`);
    return undefined;
  }
}

async function mapLimit<T, U>(
  input: T[],
  concurrency: number,
  map: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const output = new Array<U>(input.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, input.length) }, async () => {
    while (cursor < input.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await map(input[index]!, index);
    }
  });
  await Promise.all(workers);
  return output;
}

function directText(node: ProtocolNode): string {
  return (node.children ?? [])
    .filter((child) => child.nodeType === 3)
    .map((child) => child.nodeValue ?? "")
    .join("")
    .trim();
}

function alternatingRecord(values: unknown[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (typeof name === "string" && typeof value === "string") output[name] = value;
  }
  return output;
}

function truncateUtf8(value: string, maximumBytes: number): string {
  if (Buffer.byteLength(value) <= maximumBytes) return value;
  return Buffer.from(value).subarray(0, maximumBytes).toString("utf8").replace(/\uFFFD+$/g, "");
}

function safeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "state";
}

function asRecord(value: unknown): CdpRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as CdpRecord
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
