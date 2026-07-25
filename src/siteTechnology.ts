import type {
  SiteEvidence,
  SiteTechnologyState,
} from "./siteAnalysis.ts";

const MAX_SIGNALS_PER_GROUP = 256;
const MAX_EVIDENCE_VALUE = 512;
const MAX_EVIDENCE_PER_FINDING = 3;

export interface SiteTechnologySignals {
  generator: string[];
  htmlAttributes: Record<string, string>;
  scriptUrls: string[];
  stylesheetUrls: string[];
  resourceUrls: string[];
  inlineScripts: string[];
  sourceMapSources: string[];
  runtimes: Record<string, string>;
  activeRuntimeSignals: string[];
}

export interface DetectedTechnology {
  name: string;
  version?: string;
  category:
    | "framework"
    | "renderer"
    | "bundler"
    | "animation"
    | "media"
    | "service";
  state: SiteTechnologyState;
  evidence: Array<{ kind: SiteEvidence["kind"]; value: string }>;
  confidence: number;
}

type Category = DetectedTechnology["category"];
type Evidence = DetectedTechnology["evidence"][number];

interface TechnologyDefinition {
  name: string;
  category: Category;
  direct?: RegExp[];
  loaded?: RegExp[];
  indirect?: RegExp[];
  active?: RegExp[];
  runtimeKeys?: string[];
  versionPatterns?: RegExp[];
}

interface Signal {
  channel:
    | "generator"
    | "attribute"
    | "script"
    | "stylesheet"
    | "resource"
    | "inline"
    | "source-map"
    | "runtime"
    | "active";
  value: string;
  searchable: string;
}

const REGISTRY: TechnologyDefinition[] = [
  {
    name: "Framer Sites",
    category: "service",
    direct: [/\bframer\b/i, /data-framer-(?:hydrate|name|component|appear-id)/i],
    loaded: [/framer(?:usercontent|static)\.com/i],
  },
  {
    name: "React",
    category: "framework",
    direct: [/\breact(?:\.production)?(?:\.min)?\.js\b/i, /node_modules\/react\//i],
    active: [/^react:/i],
    runtimeKeys: ["react"],
    versionPatterns: [/\breact[^\d]{0,8}v?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "React DOM",
    category: "renderer",
    direct: [
      /\breact-dom\b/i,
      /rendererPackageName\s*[:=]\s*[`'"]react-dom/i,
    ],
    active: [/^react-dom:/i],
    runtimeKeys: ["reactDom", "react-dom"],
    versionPatterns: [/\breact-dom[^\d]{0,8}v?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "Framer Motion",
    category: "animation",
    direct: [/\bframer-motion\b/i],
    loaded: [/(?:^|[/.-])motion(?:[.-]|\.m?js|$)/i],
    active: [/^framer-motion:/i],
    runtimeKeys: ["framerMotion", "framer-motion"],
    versionPatterns: [/\bframer-motion[^\d]{0,8}v?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "Webflow",
    category: "service",
    direct: [/\bwebflow\b/i, /data-wf-(?:site|page|domain)/i],
    loaded: [/webflow(?:\.com|\.js)/i],
  },
  {
    name: "Webflow IX2",
    category: "animation",
    direct: [/\bwebflow\.require\(['"]ix2/i],
    indirect: [/\bw-mod-ix(?:2|3)\b/i, /\bdata-w-id\b/i, /\bwebflow\b/i],
    active: [/^(?:webflow-)?ix2:/i],
    runtimeKeys: ["webflowIx2", "ix2"],
  },
  {
    name: "GSAP",
    category: "animation",
    direct: [/\bgsap\b/i],
    loaded: [/(?:^|[/.-])gsap(?:[./-]|$)/i],
    active: [/^gsap:/i],
    runtimeKeys: ["gsap"],
    versionPatterns: [/\bgsap[/@-](?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "ScrollTrigger",
    category: "animation",
    direct: [/\bScrollTrigger\b/i],
    loaded: [/(?:^|[/.-])scrolltrigger(?:[./-]|$)/i],
    active: [/^scroll-trigger:/i, /^scrolltrigger:/i],
    runtimeKeys: ["scrollTrigger", "ScrollTrigger"],
    versionPatterns: [/\bscrolltrigger[/@-](?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "SplitText",
    category: "animation",
    direct: [/\bSplitText\b/i],
    loaded: [/(?:^|[/.-])splittext(?:[./-]|$)/i],
    active: [/^split-text:/i, /^splittext:/i],
    runtimeKeys: ["splitText", "SplitText"],
    versionPatterns: [/\bsplittext[/@-](?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "Three.js",
    category: "media",
    direct: [/\bthree(?:\.min)?\.js\b/i, /node_modules\/three\//i],
    loaded: [/(?:^|[/@-])three(?:[./@-]|$)/i],
    active: [/^three:/i],
    runtimeKeys: ["three", "THREE"],
    versionPatterns: [/\bthree[/@-](?:r)?(\d+(?:\.\d+)*)/i],
  },
  {
    name: "Lottie",
    category: "media",
    direct: [/\blottie(?:-web)?\b/i],
    loaded: [/(?:^|[/@-])lottie(?:-web)?(?:[./@-]|$)/i],
    active: [/^lottie:/i],
    runtimeKeys: ["lottie", "bodymovin"],
    versionPatterns: [/\blottie(?:-web)?[/@-](?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "Rive",
    category: "media",
    direct: [/\b(?:rive-js|@rive-app|rive\.wasm)\b/i],
    loaded: [/(?:^|[/@-])rive(?:[./@-]|$)/i],
    active: [/^rive:/i],
    runtimeKeys: ["rive"],
    versionPatterns: [/\brive[/@-](?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "Spline",
    category: "media",
    direct: [/\b(?:@splinetool|spline-viewer)\b/i],
    loaded: [/(?:^|[/@-])spline(?:[./@-]|$)/i],
    active: [/^spline:/i],
    runtimeKeys: ["spline"],
    versionPatterns: [/\bspline[/@-](?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "Swiper",
    category: "animation",
    direct: [/node_modules\/swiper\//i],
    loaded: [/(?:^|[/@-])swiper(?:[./@-]|$)/i],
    active: [/^swiper:/i],
    runtimeKeys: ["swiper"],
    versionPatterns: [/\bswiper@(?:v)?(\d+\.\d+(?:\.\d+)?|\d+)/i],
  },
  {
    name: "Embla",
    category: "animation",
    direct: [/\bembla-carousel\b/i],
    loaded: [/(?:^|[/@-])embla(?:-carousel)?(?:[./@-]|$)/i],
    active: [/^embla:/i],
    runtimeKeys: ["embla"],
    versionPatterns: [/\bembla(?:-carousel)?@(?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "Lenis",
    category: "animation",
    direct: [/\b(?:@studio-freight\/lenis|lenis)\b/i],
    loaded: [/(?:^|[/@-])lenis(?:[./@-]|$)/i],
    active: [/^lenis:/i],
    runtimeKeys: ["lenis"],
    versionPatterns: [/\blenis@(?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "Anime.js",
    category: "animation",
    direct: [/\banime(?:\.min)?\.js\b/i],
    loaded: [/(?:^|[/@-])animejs?(?:[./@-]|$)/i],
    active: [/^anime(?:\.js)?:/i],
    runtimeKeys: ["anime", "animejs"],
    versionPatterns: [/\banimejs?@(?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "React Spring",
    category: "animation",
    direct: [/\b(?:@react-spring|react-spring)\b/i],
    loaded: [/(?:^|[/@-])react-spring(?:[./@-]|$)/i],
    active: [/^react-spring:/i],
    runtimeKeys: ["reactSpring", "react-spring"],
    versionPatterns: [/\breact-spring@(?:v)?(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    name: "CSS Keyframes",
    category: "animation",
    direct: [/@(?:-webkit-)?keyframes\b/i],
    active: [/^css-(?:animation|keyframes):/i],
  },
  {
    name: "Web Animations API",
    category: "animation",
    direct: [/\.animate\s*\(/i, /\bgetAnimations\s*\(/i],
    active: [/^(?:waapi|web-animations):/i],
  },
  {
    name: "Custom JavaScript Motion",
    category: "animation",
    indirect: [
      /\brequestAnimationFrame\s*\(/i,
      /\b(?:transform|opacity)\b/i,
      /\b(?:scroll|pointermove|mousemove)\b/i,
    ],
    active: [/^(?:custom-motion|mutation-motion|raf-motion):/i],
  },
];

export function detectSiteTechnology(
  input: SiteTechnologySignals,
): DetectedTechnology[] {
  const signals = collectSignals(input);
  return REGISTRY.map((definition) => detectDefinition(definition, signals, input));
}

function detectDefinition(
  definition: TechnologyDefinition,
  signals: Signal[],
  input: SiteTechnologySignals,
): DetectedTechnology {
  const active = matching(signals, definition.active, ["active"]);
  const runtime = runtimeMatches(signals, definition.runtimeKeys);
  const direct = matching(signals, definition.direct, [
    "generator",
    "attribute",
    "inline",
    "source-map",
  ]);
  const loaded = matching(signals, definition.loaded, [
    "script",
    "stylesheet",
    "resource",
  ]);
  const indirect = matching(signals, definition.indirect);

  let state: SiteTechnologyState = "not-detected";
  if (active.length > 0) state = "observed-in-use";
  else if (runtime.length > 0 || direct.length > 0) state = "confirmed";
  else if (loaded.length > 0) state = "loaded";
  else if (independentChannels(indirect) >= 2) state = "inferred";

  const evidenceSignals = uniqueSignals([
    ...active,
    ...runtime,
    ...direct,
    ...loaded,
    ...indirect,
  ]).slice(0, MAX_EVIDENCE_PER_FINDING);
  const version = extractVersion(definition, input, [
    ...runtime,
    ...loaded,
    ...direct.filter((item) => item.channel === "source-map"),
  ]);

  return {
    name: definition.name,
    ...(version ? { version } : {}),
    category: definition.category,
    state,
    evidence: evidenceSignals.map(toEvidence),
    confidence: confidenceFor(state, evidenceSignals.length),
  };
}

function collectSignals(input: SiteTechnologySignals): Signal[] {
  const result: Signal[] = [];
  pushStrings(result, "generator", input.generator);
  for (const [key, value] of Object.entries(input.htmlAttributes)
    .slice(0, MAX_SIGNALS_PER_GROUP)) {
    pushSignal(result, "attribute", `${key}=${value}`);
  }
  pushStrings(result, "script", input.scriptUrls);
  pushStrings(result, "stylesheet", input.stylesheetUrls);
  pushStrings(result, "resource", input.resourceUrls);
  pushStrings(result, "inline", input.inlineScripts);
  pushStrings(result, "source-map", input.sourceMapSources);
  for (const [key, value] of Object.entries(input.runtimes)
    .slice(0, MAX_SIGNALS_PER_GROUP)) {
    pushSignal(result, "runtime", `${key}=${value}`);
  }
  pushStrings(result, "active", input.activeRuntimeSignals);
  return result;
}

function pushStrings(
  result: Signal[],
  channel: Signal["channel"],
  values: string[],
): void {
  for (const value of values.slice(0, MAX_SIGNALS_PER_GROUP)) {
    pushSignal(result, channel, value);
  }
}

function pushSignal(
  result: Signal[],
  channel: Signal["channel"],
  value: unknown,
): void {
  if (typeof value !== "string" || value.length === 0) return;
  result.push({
    channel,
    value: safeValue(channel, value),
    searchable: value.slice(0, 8_192),
  });
}

function matching(
  signals: Signal[],
  patterns: RegExp[] | undefined,
  channels?: Signal["channel"][],
): Signal[] {
  if (!patterns?.length) return [];
  return signals.filter((signal) => {
    if (channels && !channels.includes(signal.channel)) return false;
    return patterns.some((pattern) => pattern.test(signal.searchable));
  });
}

function runtimeMatches(
  signals: Signal[],
  keys: string[] | undefined,
): Signal[] {
  if (!keys?.length) return [];
  const prefixes = keys.map((key) => `${key.toLowerCase()}=`);
  return signals.filter((signal) =>
    signal.channel === "runtime" &&
    prefixes.some((prefix) => signal.searchable.toLowerCase().startsWith(prefix))
  );
}

function independentChannels(signals: Signal[]): number {
  return new Set(signals.map((signal) => signal.channel)).size;
}

function uniqueSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.channel}:${signal.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toEvidence(signal: Signal): Evidence {
  let kind: SiteEvidence["kind"];
  switch (signal.channel) {
    case "generator":
      kind = "metadata";
      break;
    case "attribute":
      kind = "dom";
      break;
    case "script":
    case "stylesheet":
    case "resource":
      kind = "script-url";
      break;
    case "source-map":
      kind = "source-map";
      break;
    case "inline":
    case "runtime":
    case "active":
      kind = "runtime";
      break;
  }
  return { kind, value: signal.value };
}

function safeValue(channel: Signal["channel"], value: string): string {
  const trimmed = value.trim();
  if (
    channel === "script" ||
    channel === "stylesheet" ||
    channel === "resource" ||
    channel === "source-map"
  ) {
    return redactUrl(trimmed).slice(0, MAX_EVIDENCE_VALUE);
  }
  return trimmed.slice(0, MAX_EVIDENCE_VALUE);
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of url.searchParams.keys()) {
      url.searchParams.set(key, "[redacted]");
    }
    return url.toString();
  } catch {
    return value.replace(/([?&][^=&\s]+)=([^&#\s]*)/g, "$1=[redacted]");
  }
}

function extractVersion(
  definition: TechnologyDefinition,
  input: SiteTechnologySignals,
  directSignals: Signal[],
): string | undefined {
  for (const key of definition.runtimeKeys ?? []) {
    const value = input.runtimes[key];
    if (typeof value === "string") {
      const version = cleanVersion(value);
      if (version) return version;
    }
  }
  for (const signal of directSignals) {
    for (const pattern of definition.versionPatterns ?? []) {
      const match = signal.searchable.match(pattern);
      const version = cleanVersion(match?.[1]);
      if (version) return version;
    }
  }
  return undefined;
}

function cleanVersion(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(?:v|r)?(\d+(?:\.\d+){0,3}(?:[-+][\w.-]+)?)$/i);
  return match?.[1];
}

function confidenceFor(
  state: SiteTechnologyState,
  evidenceCount: number,
): number {
  if (state === "observed-in-use") return 0.99;
  if (state === "confirmed") return evidenceCount > 1 ? 0.98 : 0.94;
  if (state === "loaded") return 0.82;
  if (state === "inferred") return 0.68;
  return 1;
}
