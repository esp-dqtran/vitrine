export type ForcedPseudoClass =
  | "active"
  | "checked"
  | "disabled"
  | "enabled"
  | "focus"
  | "focus-visible"
  | "focus-within"
  | "hover"
  | "invalid"
  | "required"
  | "target"
  | "valid";

export interface DomComponentViewport {
  name: string;
  width: number;
  height: number;
}

export interface DomComponentStateSpec {
  name: string;
  targetSelector?: string;
  forcePseudoClasses?: ForcedPseudoClass[];
  waitMs?: number;
}

export type DomComponentAction =
  | { type: "click"; selector?: string }
  | { type: "hover"; selector?: string }
  | { type: "focus"; selector?: string }
  | { type: "press"; selector?: string; key: string }
  | { type: "fill"; selector: string; value: string };

export interface DomComponentInteractionSpec {
  name: string;
  actions: DomComponentAction[];
  viewport?: string;
  waitMs?: number;
}

export interface DomComponentCaptureLimits {
  maxNodes?: number;
  maxHtmlBytes?: number;
  maxStylesheetBytes?: number;
  maxTotalStylesheetBytes?: number;
  maxMutationRecords?: number;
  maxNetworkRecords?: number;
  maxScreenshotHeight?: number;
}

export interface CaptureDomComponentEvidenceOptions {
  selector: string;
  viewports?: DomComponentViewport[];
  states?: DomComponentStateSpec[];
  interactions?: DomComponentInteractionSpec[];
  limits?: DomComponentCaptureLimits;
}

export interface CapturedBoxModel {
  content: number[];
  padding: number[];
  border: number[];
  margin: number[];
  width: number;
  height: number;
}

export interface CapturedFont {
  familyName: string;
  postScriptName: string;
  isCustomFont: boolean;
  glyphCount: number;
}

export interface CapturedEventListener {
  type: string;
  useCapture: boolean;
  passive: boolean;
  once: boolean;
  scriptId?: string;
  lineNumber?: number;
  columnNumber?: number;
  backendNodeId?: number;
}

export interface CapturedPseudoComputedStyle {
  content?: string;
  properties: Record<string, string>;
}

export interface CapturedDomNode {
  id: string;
  parentId?: string;
  nodeId: number;
  backendNodeId?: number;
  path: string;
  tagName: string;
  attributes: Record<string, string>;
  directText: string;
  matchedStyles: Record<string, unknown>;
  computedStyles: Record<string, string>;
  pseudoComputedStyles: Record<string, CapturedPseudoComputedStyle>;
  boxModel?: CapturedBoxModel;
  fonts: CapturedFont[];
  eventListeners: CapturedEventListener[];
  animatedStyles?: Record<string, unknown>;
}

export interface CapturedStylesheet {
  styleSheetId: string;
  sourceUrl?: string;
  origin?: string;
  title?: string;
  disabled?: boolean;
  isInline?: boolean;
  isConstructed?: boolean;
  sha256: string;
  byteSize: number;
  text: string;
  truncated: boolean;
}

export interface CapturedAsset {
  url: string;
  kinds: string[];
  nodeIds: string[];
}

export interface CapturedScript {
  url?: string;
  type?: string;
  async?: boolean;
  defer?: boolean;
  inlineText?: string;
}

export interface CapturedMutation {
  type: "attributes" | "childList" | "characterData";
  target: string;
  attributeName?: string;
  oldValue?: string | null;
  addedNodes?: number;
  removedNodes?: number;
}

export interface CapturedNetworkRequest {
  url: string;
  method: string;
  resourceType: string;
}

export interface CapturedComponentScreenshot {
  contentType: "image/png";
  width: number;
  height: number;
  base64: string;
}

export interface DomComponentStateEvidence {
  id: string;
  viewport: DomComponentViewport;
  state: string;
  kind: "state" | "interaction";
  outerHtml: string;
  nodes: CapturedDomNode[];
  mutations: CapturedMutation[];
  networkRequests: CapturedNetworkRequest[];
  screenshot?: CapturedComponentScreenshot;
}

export interface DomComponentEvidence {
  schemaVersion: 1;
  source: {
    url: string;
    selector: string;
    title: string;
    capturedAt: string;
  };
  states: DomComponentStateEvidence[];
  stylesheets: CapturedStylesheet[];
  assets: CapturedAsset[];
  scripts: CapturedScript[];
  warnings: string[];
}

export interface WrittenDomComponentEvidence {
  outputDirectory: string;
  manifestPath: string;
  statePaths: string[];
  stylesheetPaths: string[];
  screenshotPaths: string[];
}
