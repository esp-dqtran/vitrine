import type { Page } from "playwright";
import {
  parseSiteAnalysis,
  type SiteAnalysis,
  type SiteEvidence,
  type SiteMotionFinding,
} from "./siteAnalysis.ts";
import type { SiteResourceEvidence } from "./siteResourceEvidence.ts";
import {
  detectSiteTechnology,
  type SiteTechnologySignals,
} from "./siteTechnology.ts";

const MAXIMUM_STRUCTURE_NODES = 500;
const MAXIMUM_ANIMATION_SAMPLES = 500;
const MAXIMUM_SCROLL_POSITIONS = 6;

export interface SiteAnimationSample {
  targetId: string;
  key: string;
  scrollChanged: boolean;
  timeChanged: boolean;
  sticky: boolean;
  threeDimensional: boolean;
  properties: string[];
  states: Array<Record<string, string | number>>;
  durationMs?: number;
  delayMs?: number;
  easing?: string;
  iterations?: number | "infinite";
  scrollRange?: { start: number; end: number };
}

export interface SiteViewportInspection {
  viewport: "desktop" | "mobile";
  width: number;
  height: number;
  document: { width: number; height: number };
  structure: Array<Record<string, unknown> & {
    id: string;
    key: string;
    visible?: boolean;
  }>;
  visualTokens: Array<Record<string, unknown> & { id: string }>;
  animationSamples: SiteAnimationSample[];
  technologySignals: SiteTechnologySignals;
  mutations: { attributes: number; childNodes: number };
  warnings: string[];
}

export interface MotionClassificationInput {
  scrollChanged: boolean;
  timeChanged: boolean;
  sticky: boolean;
  threeDimensional: boolean;
  properties: string[];
}

interface ResponsiveNode {
  key: string;
  visible?: boolean;
  media?: string;
  order?: number;
  position?: string;
  fontSize?: string;
}

export function classifyMotionSample(
  sample: MotionClassificationInput,
): SiteMotionFinding["type"] {
  if (sample.threeDimensional) return "three-dimensional";
  if (sample.sticky) return "sticky";
  if (sample.timeChanged) return "continuous";
  if (sample.scrollChanged) {
    if (sample.properties.includes("transform")) return "parallax";
    if (
      sample.properties.includes("clipPath") ||
      sample.properties.includes("maskImage")
    ) return "mask-reveal";
    return "scroll-linked";
  }
  return "unknown";
}

export function responsiveDifferences(
  desktop: ResponsiveNode[],
  mobile: ResponsiveNode[],
): Array<Record<string, string | number>> {
  const desktopByKey = new Map(desktop.map((item) => [item.key, item]));
  const mobileByKey = new Map(mobile.map((item) => [item.key, item]));
  const differences: Array<Record<string, string | number>> = [];
  for (const key of new Set([...desktopByKey.keys(), ...mobileByKey.keys()])) {
    const wide = desktopByKey.get(key);
    const narrow = mobileByKey.get(key);
    if (wide?.visible && !narrow?.visible) {
      differences.push({ key, change: "hidden-on-mobile" });
      continue;
    }
    if (!wide?.visible && narrow?.visible) {
      differences.push({ key, change: "mobile-only" });
      continue;
    }
    if (!wide || !narrow || !wide.visible || !narrow.visible) continue;
    if (
      typeof wide.order === "number" &&
      typeof narrow.order === "number" &&
      wide.order !== narrow.order
    ) {
      differences.push({
        key,
        change: "reordered",
        desktopOrder: wide.order,
        mobileOrder: narrow.order,
      });
    }
    if (wide.position && narrow.position && wide.position !== narrow.position) {
      differences.push({
        key,
        change: "position-changed",
        desktop: wide.position,
        mobile: narrow.position,
      });
    }
    if (wide.fontSize && narrow.fontSize && wide.fontSize !== narrow.fontSize) {
      differences.push({
        key,
        change: "type-scale-changed",
        desktop: wide.fontSize,
        mobile: narrow.fontSize,
      });
    }
  }
  return differences.slice(0, 500);
}

export async function inspectSiteViewport(
  page: Page,
  viewport: "desktop" | "mobile",
  resources: SiteResourceEvidence[],
  maximumElements = 10_000,
): Promise<SiteViewportInspection> {
  const safeResources = resources.slice(0, 128).map((item) => ({
    url: item.url,
    kind: item.kind,
    text: item.text.slice(0, 512),
  }));
  const raw = await page.evaluate(async ({ viewportName, resourceEvidence, elementLimit }) => {
    type StructureNode = Record<string, unknown> & {
      id: string;
      key: string;
      visible: boolean;
    };
    type AnimationState = Record<string, string | number>;
    type AnimationSample = {
      targetId: string;
      key: string;
      scrollChanged: boolean;
      timeChanged: boolean;
      sticky: boolean;
      threeDimensional: boolean;
      properties: string[];
      states: AnimationState[];
      durationMs?: number;
      delayMs?: number;
      easing?: string;
      iterations?: number | "infinite";
      scrollRange?: { start: number; end: number };
    };
    const warnings: string[] = [];
    const [clean] = [(value: unknown, maximum = 500) =>
      typeof value === "string"
        ? value.replace(/\s+/g, " ").trim().slice(0, maximum)
        : ""] as const;
    const [headingLabel] = [(value: string): string => {
      const words = value.split(" ").filter(Boolean);
      if (words.length < 6) return value;
      for (let size = 3; size <= Math.floor(words.length / 2); size += 1) {
        if (words.length % size !== 0) continue;
        let repeated = true;
        for (let index = size; index < words.length; index += 1) {
          if (words[index] !== words[index % size]) {
            repeated = false;
            break;
          }
        }
        if (repeated) return words.slice(0, size).join(" ");
      }
      return value;
    }] as const;
    const [rounded] = [(value: number) =>
      Number.isFinite(value) ? Math.round(value * 100) / 100 : 0] as const;
    const [selectorFor] = [(element: Element): string => {
      if (element.id && /^[A-Za-z][\w-]{0,80}$/.test(element.id)) {
        return `#${CSS.escape(element.id)}`;
      }
      for (const attribute of ["data-framer-name", "data-w-id", "aria-label"]) {
        const value = element.getAttribute(attribute);
        if (value && value.length <= 80) {
          return `${element.tagName.toLowerCase()}[${attribute}="${CSS.escape(value)}"]`;
        }
      }
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.documentElement && parts.length < 6) {
        const tag = current.tagName.toLowerCase();
        const parent: Element | null = current.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const same = [...parent.children].filter((child) =>
          child.tagName === current!.tagName
        );
        const suffix = same.length > 1
          ? `:nth-of-type(${same.indexOf(current) + 1})`
          : "";
        parts.unshift(tag + suffix);
        current = parent;
      }
      return parts.join(" > ").slice(0, 500);
    }] as const;
    const [visible] = [(element: Element): boolean => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0 &&
        rect.width > 0 &&
        rect.height > 0;
    }] as const;
    const semanticTags = new Set([
      "body",
      "header",
      "nav",
      "main",
      "section",
      "article",
      "aside",
      "footer",
      "h1",
      "h2",
      "h3",
      "a",
      "button",
      "input",
      "select",
      "textarea",
      "label",
      "dialog",
      "video",
      "canvas",
      "svg",
      "picture",
      "form",
    ]);
    const allElements = [
      document.body,
      ...document.body.querySelectorAll("*"),
    ].filter((element): element is Element => Boolean(element)).slice(0, elementLimit);
    const retainedElements: Element[] = [];
    for (const element of allElements) {
      if (retainedElements.length >= 1_000) break;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const semantic = semanticTags.has(element.tagName.toLowerCase()) ||
        Boolean(element.getAttribute("role"));
      const boundary = visible(element) &&
        rect.width * rect.height >= window.innerWidth * window.innerHeight * 0.04;
      const positioned = style.position === "fixed" || style.position === "sticky";
      const animated = element.getAnimations().length > 0;
      const responsiveMedia = ["VIDEO", "CANVAS", "PICTURE", "IMG", "SVG"]
        .includes(element.tagName);
      if (semantic || boundary || positioned || animated || responsiveMedia) {
        retainedElements.push(element);
      }
    }
    const idByElement = new Map<Element, string>();
    retainedElements.forEach((element, index) => {
      idByElement.set(element, `STRUCTURE-${index}`);
    });
    const structure: StructureNode[] = retainedElements.map((element, order) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      let parent: Element | null = element.parentElement;
      while (parent && !idByElement.has(parent)) parent = parent.parentElement;
      const heading = element.matches("h1,h2,h3")
        ? element
        : element.querySelector("h1,h2,h3");
      const headingText = heading instanceof HTMLElement
        ? heading.innerText
        : heading?.textContent;
      const tag = element.tagName.toLowerCase();
      return {
        id: idByElement.get(element)!,
        key: selectorFor(element),
        ...(parent ? { parentId: idByElement.get(parent) } : {}),
        order,
        tag,
        classNames: [...element.classList].slice(0, 20),
        role: clean(element.getAttribute("role"), 100) || undefined,
        accessibleName: clean(
          element.getAttribute("aria-label") ||
            element.getAttribute("title"),
          200,
        ) || undefined,
        heading: headingLabel(clean(headingText, 200)) || undefined,
        text: clean(element.textContent, 500),
        visible: visible(element),
        media: ["video", "canvas", "picture", "img", "svg"].includes(tag)
          ? tag
          : undefined,
        bounds: {
          x: rounded(rect.left + window.scrollX),
          y: rounded(rect.top + window.scrollY),
          width: rounded(rect.width),
          height: rounded(rect.height),
          viewportX: rounded(rect.left),
          viewportY: rounded(rect.top),
        },
        display: style.display,
        position: style.position,
        overflow: style.overflow,
        zIndex: style.zIndex,
        lazy: element instanceof HTMLImageElement ||
            element instanceof HTMLIFrameElement
          ? element.loading === "lazy"
          : undefined,
      };
    });
    const customProperties: Record<string, string> = {};
    let customPropertyCount = 0;
    const rootStyle = getComputedStyle(document.documentElement);
    for (let index = 0; index < rootStyle.length; index += 1) {
      const property = rootStyle.item(index);
      if (!property.startsWith("--") || customPropertyCount >= 100) continue;
      const value = clean(rootStyle.getPropertyValue(property), 500);
      if (value) {
        customProperties[property] = value;
        customPropertyCount += 1;
      }
    }
    const visualTokens = retainedElements.map((element, index) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        id: `VISUAL-${index}`,
        structureId: `STRUCTURE-${index}`,
        display: style.display,
        position: style.position,
        flexDirection: style.flexDirection,
        flexWrap: style.flexWrap,
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        gridTemplateColumns: style.gridTemplateColumns.slice(0, 500),
        gap: style.gap,
        width: rounded(rect.width),
        height: rounded(rect.height),
        margin: style.margin,
        padding: style.padding,
        border: style.border,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow.slice(0, 500),
        background: style.background.slice(0, 500),
        color: style.color,
        fontFamily: style.fontFamily.slice(0, 300),
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform,
        objectFit: style.objectFit,
        aspectRatio: style.aspectRatio,
        transform: style.transform.slice(0, 500),
        opacity: style.opacity,
        filter: style.filter.slice(0, 500),
        clipPath: style.clipPath.slice(0, 500),
        maskImage: style.maskImage.slice(0, 500),
        overflow: style.overflow,
        zIndex: style.zIndex,
        willChange: style.willChange.slice(0, 300),
        ...(index === 0 && customPropertyCount
          ? { customProperties }
          : {}),
      };
    });

    const keyframeRules: string[] = [];
    for (const sheet of [...document.styleSheets].slice(0, 128)) {
      try {
        for (const rule of [...(sheet.cssRules ?? [])].slice(0, 1_000)) {
          if (rule.type === CSSRule.KEYFRAMES_RULE) {
            keyframeRules.push(clean(rule.cssText, 2_048));
            if (keyframeRules.length >= 100) break;
          }
        }
      } catch {
        warnings.push(`Stylesheet rules unavailable: ${clean(sheet.href, 300) || "inline"}`);
      }
      if (keyframeRules.length >= 100) break;
    }

    const mutations = { attributes: 0, childNodes: 0 };
    const observer = new MutationObserver((records) => {
      for (const record of records.slice(0, 1_000)) {
        if (record.type === "attributes") mutations.attributes += 1;
        if (record.type === "childList") {
          mutations.childNodes += record.addedNodes.length + record.removedNodes.length;
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      childList: true,
    });

    const sampledProperties = [
      "transform",
      "opacity",
      "filter",
      "clipPath",
      "maskImage",
      "backgroundPosition",
      "left",
      "top",
      "width",
      "height",
    ] as const;
    const [captureStates] = [(): Map<string, AnimationState> => {
      const states = new Map<string, AnimationState>();
      retainedElements.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        if (rect.bottom < -window.innerHeight || rect.top > window.innerHeight * 2) {
          return;
        }
        const style = getComputedStyle(element);
        states.set(`STRUCTURE-${index}`, {
          transform: style.transform.slice(0, 500),
          opacity: style.opacity,
          filter: style.filter.slice(0, 500),
          clipPath: style.clipPath.slice(0, 500),
          maskImage: style.maskImage.slice(0, 500),
          backgroundPosition: style.backgroundPosition.slice(0, 500),
          left: rounded(rect.left),
          top: rounded(rect.top),
          width: rounded(rect.width),
          height: rounded(rect.height),
        });
      });
      return states;
    }] as const;
    const [changedProperties] = [(
      first: AnimationState | undefined,
      second: AnimationState | undefined,
    ): string[] => {
      if (!first || !second) return [];
      return sampledProperties.filter((property) =>
        String(first[property]) !== String(second[property])
      );
    }] as const;
    const documentHeight = Math.min(
      100_000,
      Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
      ),
    );
    const maximumScroll = Math.max(0, documentHeight - window.innerHeight);
    const boundaryPositions = structure
      .map((item) => {
        const bounds = item.bounds as { y?: unknown };
        return typeof bounds.y === "number"
          ? Math.max(0, Math.min(maximumScroll, Math.round(bounds.y)))
          : 0;
      });
    const positionCount = Math.min(6, maximumScroll > 0 ? 6 : 1);
    const evenPositions = Array.from(
      { length: positionCount },
      (_, index) =>
        positionCount === 1
          ? 0
          : Math.round(maximumScroll * index / (positionCount - 1)),
    );
    const positions = [...new Set([0, ...boundaryPositions, ...evenPositions, maximumScroll])]
      .sort((left, right) => left - right)
      .filter((_, index, values) => {
        if (values.length <= 6) return true;
        const stride = Math.max(1, Math.floor(values.length / 5));
        return index === 0 || index === values.length - 1 || index % stride === 0;
      })
      .slice(0, 6);
    if (positions.at(-1) !== maximumScroll && positions.length > 1) {
      positions[positions.length - 1] = maximumScroll;
    }

    const sampleByTarget = new Map<string, AnimationSample>();
    let baseline: Map<string, AnimationState> | undefined;
    for (const y of positions) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 80));
      const state0 = captureStates();
      if (!baseline) baseline = state0;
      await new Promise((resolve) => setTimeout(resolve, 250));
      const state250 = captureStates();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const state500 = captureStates();
      for (let index = 0; index < retainedElements.length; index += 1) {
        const targetId = `STRUCTURE-${index}`;
        const first = state0.get(targetId);
        const middle = state250.get(targetId);
        const last = state500.get(targetId);
        const timeProperties = [
          ...changedProperties(first, middle),
          ...changedProperties(middle, last),
        ];
        const scrollProperties = changedProperties(baseline.get(targetId), first);
        const properties = [...new Set([...timeProperties, ...scrollProperties])];
        const element = retainedElements[index]!;
        const style = getComputedStyle(element);
        const sticky = style.position === "sticky" || style.position === "fixed";
        if (properties.length === 0 && !sticky) continue;
        const existing = sampleByTarget.get(targetId);
        const states = [first, middle, last].filter(
          (state): state is AnimationState => Boolean(state),
        );
        const transforms = states.map((state) => String(state.transform ?? ""));
        const next: AnimationSample = existing ?? {
          targetId,
          key: structure[index]!.key,
          scrollChanged: false,
          timeChanged: false,
          sticky,
          threeDimensional: false,
          properties: [],
          states: [],
        };
        next.scrollChanged ||= scrollProperties.length > 0;
        next.timeChanged ||= timeProperties.length > 0;
        next.sticky ||= sticky;
        next.threeDimensional ||= transforms.some((value) =>
          /matrix3d|perspective|rotate[XYZ]/i.test(value)
        );
        next.properties = [...new Set([...next.properties, ...properties])];
        next.states = [...next.states, ...states].slice(0, 6);
        next.scrollRange = {
          start: Math.min(next.scrollRange?.start ?? y, y),
          end: Math.max(next.scrollRange?.end ?? y, y),
        };
        sampleByTarget.set(targetId, next);
      }
    }

    const pageAnimations = document.getAnimations().slice(0, 200);
    for (const animation of pageAnimations) {
      const effect = animation.effect;
      if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof Element)) {
        continue;
      }
      const targetId = idByElement.get(effect.target);
      if (!targetId) continue;
      const targetIndex = Number(targetId.split("-").at(-1));
      const keyframes = effect.getKeyframes().slice(0, 20);
      const properties = [...new Set(keyframes.flatMap((keyframe) =>
        Object.keys(keyframe).filter((key) =>
          !["offset", "computedOffset", "easing", "composite"].includes(key)
        )
      ))];
      const timing = effect.getTiming();
      const existing = sampleByTarget.get(targetId);
      const sample: AnimationSample = existing ?? {
        targetId,
        key: structure[targetIndex]?.key ?? selectorFor(effect.target),
        scrollChanged: false,
        timeChanged: false,
        sticky: ["fixed", "sticky"].includes(getComputedStyle(effect.target).position),
        threeDimensional: false,
        properties: [],
        states: [],
      };
      sample.timeChanged ||= animation.playState === "running";
      sample.properties = [...new Set([...sample.properties, ...properties])];
      sample.states = [
        ...sample.states,
        ...keyframes.map((frame) => Object.fromEntries(
          Object.entries(frame)
            .filter(([, value]) =>
              typeof value === "string" || typeof value === "number"
            )
            .map(([key, value]) => [key, value as string | number]),
        )),
      ].slice(0, 20);
      if (typeof timing.duration === "number") sample.durationMs = timing.duration;
      if (typeof timing.delay === "number") sample.delayMs = timing.delay;
      if (typeof timing.easing === "string") sample.easing = timing.easing.slice(0, 200);
      if (timing.iterations === Infinity) sample.iterations = "infinite";
      else if (typeof timing.iterations === "number") sample.iterations = timing.iterations;
      sample.threeDimensional ||= sample.states.some((state) =>
        /matrix3d|perspective|rotate[XYZ]/i.test(String(state.transform ?? ""))
      );
      sampleByTarget.set(targetId, sample);
    }
    observer.disconnect();
    window.scrollTo(0, 0);

    const htmlAttributes: Record<string, string> = {};
    for (const element of allElements.slice(0, 2_000)) {
      for (const attribute of [...element.attributes]) {
        if (
          /^(?:data-framer-|data-wf-|data-w-id$|class$)/i.test(attribute.name) &&
          Object.keys(htmlAttributes).length < 200
        ) {
          htmlAttributes[attribute.name] = clean(attribute.value, 500);
        }
      }
    }
    const generators = [
      ...document.querySelectorAll<HTMLMetaElement>('meta[name="generator"]'),
    ].map((meta) => clean(meta.content, 200)).filter(Boolean);
    const scriptUrls = [
      ...document.querySelectorAll<HTMLScriptElement>("script[src]"),
    ].map((script) => script.src);
    const stylesheetUrls = [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'),
    ].map((link) => link.href);
    const performanceUrls = performance.getEntriesByType("resource")
      .slice(0, 256)
      .map((entry) => entry.name)
      .filter((url) => /^https?:/i.test(url));
    const inlineScripts = [
      ...document.querySelectorAll<HTMLScriptElement>("script:not([src])"),
    ].slice(0, 64).map((script) => clean(script.textContent, 512)).filter(Boolean);
    inlineScripts.push(...keyframeRules.map((rule) => rule.slice(0, 512)));

    const globalObject = window as typeof window & Record<string, unknown>;
    const runtimes: Record<string, string> = {};
    const [readVersion] = [(key: string, value: unknown) => {
      if (typeof value === "string" || typeof value === "number") {
        runtimes[key] = String(value).slice(0, 100);
      }
    }] as const;
    const gsap = globalObject.gsap as {
      version?: unknown;
      globalTimeline?: { getChildren?: () => unknown[] };
    } | undefined;
    const scrollTrigger = globalObject.ScrollTrigger as {
      version?: unknown;
      getAll?: () => unknown[];
    } | undefined;
    const splitText = globalObject.SplitText as { version?: unknown } | undefined;
    const three = globalObject.THREE as { REVISION?: unknown } | undefined;
    const swiper = globalObject.Swiper as { version?: unknown } | undefined;
    const lottie = globalObject.lottie as { version?: unknown } | undefined;
    readVersion("gsap", gsap?.version);
    readVersion("scrollTrigger", scrollTrigger?.version);
    readVersion("splitText", splitText?.version);
    readVersion("three", three?.REVISION);
    readVersion("swiper", swiper?.version);
    readVersion("lottie", lottie?.version);
    const reactHook = globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__ as {
      renderers?: Map<unknown, { version?: unknown; rendererPackageName?: unknown }>;
    } | undefined;
    for (const renderer of reactHook?.renderers?.values?.() ?? []) {
      if (renderer.rendererPackageName === "react-dom") {
        readVersion("reactDom", renderer.version);
        break;
      }
    }
    const activeRuntimeSignals: string[] = [];
    if (keyframeRules.length > 0) {
      activeRuntimeSignals.push(`css-keyframes:${keyframeRules.length}`);
    }
    if (pageAnimations.length > 0) {
      activeRuntimeSignals.push(`waapi:${pageAnimations.length}`);
    }
    try {
      const count = gsap?.globalTimeline?.getChildren?.().length ?? 0;
      if (count > 0) activeRuntimeSignals.push(`gsap:timeline:${count}`);
    } catch {
      warnings.push("GSAP runtime activity was unavailable");
    }
    try {
      const count = scrollTrigger?.getAll?.().length ?? 0;
      if (count > 0) activeRuntimeSignals.push(`scroll-trigger:${count}`);
    } catch {
      warnings.push("ScrollTrigger runtime activity was unavailable");
    }
    const swiperCount = document.querySelectorAll(".swiper-initialized").length;
    if (swiperCount > 0) activeRuntimeSignals.push(`swiper:${swiperCount}`);
    if (document.querySelector("canvas") && three?.REVISION) {
      activeRuntimeSignals.push("three:canvas");
    }
    if (mutations.attributes + mutations.childNodes > 0) {
      activeRuntimeSignals.push(
        `custom-motion:mutations:${mutations.attributes + mutations.childNodes}`,
      );
    }

    const resourceUrls = resourceEvidence
      .filter((item) => item.kind !== "source-map")
      .map((item) => item.url);
    const sourceMapSources = resourceEvidence
      .filter((item) => item.kind === "source-map")
      .flatMap((item) => {
        try {
          const parsed = JSON.parse(item.text) as unknown;
          return Array.isArray(parsed)
            ? parsed.filter((value): value is string => typeof value === "string")
            : [];
        } catch {
          return [];
        }
      });
    inlineScripts.push(
      ...resourceEvidence
        .filter((item) => item.kind === "script")
        .map((item) => item.text.slice(0, 512)),
    );
    return {
      viewport: viewportName,
      width: window.innerWidth,
      height: window.innerHeight,
      document: {
        width: Math.min(
          100_000,
          Math.max(
            document.documentElement.scrollWidth,
            document.body?.scrollWidth ?? 0,
          ),
        ),
        height: documentHeight,
      },
      structure,
      visualTokens,
      animationSamples: [...sampleByTarget.values()].slice(0, 500),
      technologySignals: {
        generator: generators,
        htmlAttributes,
        scriptUrls: [...new Set(scriptUrls)],
        stylesheetUrls: [...new Set(stylesheetUrls)],
        resourceUrls: [...new Set([...performanceUrls, ...resourceUrls])].slice(0, 256),
        inlineScripts: inlineScripts.slice(0, 256),
        sourceMapSources: [...new Set(sourceMapSources)].slice(0, 512),
        runtimes,
        activeRuntimeSignals: [...new Set(activeRuntimeSignals)],
      },
      mutations,
      warnings: [...new Set(warnings)].slice(0, 100),
    };
  }, {
    viewportName: viewport,
    resourceEvidence: safeResources,
    elementLimit: Math.max(1, Math.min(10_000, Math.floor(maximumElements))),
  });
  return raw as SiteViewportInspection;
}

export function buildSiteAnalysis(
  desktop: SiteViewportInspection,
  mobile?: SiteViewportInspection,
): SiteAnalysis {
  const evidence: SiteEvidence[] = [];
  for (const node of desktop.structure.slice(0, MAXIMUM_STRUCTURE_NODES)) {
    evidence.push({
      id: node.id,
      kind: "dom",
      value: boundedEvidenceValue({
        key: node.key,
        tag: node.tag,
        role: node.role,
        heading: node.heading,
        bounds: node.bounds,
      }),
    });
  }
  const motion: SiteMotionFinding[] = [];
  const desktopIdByKey = new Map(
    desktop.structure
      .slice(0, MAXIMUM_STRUCTURE_NODES)
      .map((item) => [item.key, item.id]),
  );
  const motionSamples = [
    ...desktop.animationSamples.map((sample) => ({
      ...sample,
      viewport: "desktop" as const,
    })),
    ...(mobile?.animationSamples ?? []).map((sample) => ({
      ...sample,
      viewport: "mobile" as const,
    })),
  ].slice(0, MAXIMUM_ANIMATION_SAMPLES);
  const motionByIdentity = new Map<string, SiteMotionFinding>();
  let motionEvidencePosition = 0;
  for (const sample of motionSamples) {
    const targetEvidenceId = desktopIdByKey.get(sample.key);
    if (!targetEvidenceId) continue;
    const type = classifyMotionSample(sample);
    const identity = `${targetEvidenceId}:${type}`;
    const prior = motionByIdentity.get(identity);
    const evidenceId = `MOTION-EVIDENCE-${motionEvidencePosition++}`;
    evidence.push({
      id: evidenceId,
      kind: "animation",
      value: boundedEvidenceValue({
        key: sample.key,
        type,
        properties: sample.properties,
        scrollChanged: sample.scrollChanged,
        timeChanged: sample.timeChanged,
        viewport: sample.viewport,
      }),
    });
    if (prior) {
      prior.viewports = [...new Set([...prior.viewports, sample.viewport])];
      prior.evidenceIds.push(evidenceId);
      prior.properties = [...new Set([...prior.properties, ...sample.properties])];
      continue;
    }
    const finding: SiteMotionFinding = {
      id: `MOTION-FINDING-${motionByIdentity.size}`,
      targetEvidenceId,
      type,
      trigger: sample.timeChanged
        ? "time"
        : sample.scrollChanged || sample.sticky
        ? "scroll-progress"
        : "unknown",
      properties: sample.properties.slice(0, 40),
      states: safeMotionStates(sample.states),
      viewports: [sample.viewport],
      evidenceIds: [evidenceId],
      confidence: type === "unknown" ? 0.5 : 0.92,
      ...(sample.durationMs !== undefined
        ? { durationMs: sample.durationMs }
        : {}),
      ...(sample.delayMs !== undefined ? { delayMs: sample.delayMs } : {}),
      ...(sample.easing ? { easing: sample.easing } : {}),
      ...(sample.iterations !== undefined
        ? { iterations: sample.iterations }
        : {}),
      ...(sample.scrollRange ? { scrollRange: sample.scrollRange } : {}),
    };
    motionByIdentity.set(identity, finding);
    motion.push(finding);
  }

  const signals = mergeTechnologySignals(
    desktop.technologySignals,
    mobile?.technologySignals,
  );
  const detected = detectSiteTechnology(signals);
  let technologyEvidencePosition = 0;
  const technology = detected.map((item, index) => {
    const evidenceIds = item.evidence.map((itemEvidence) => {
      const id = `TECHNOLOGY-EVIDENCE-${technologyEvidencePosition++}`;
      evidence.push({ id, ...itemEvidence });
      return id;
    });
    return {
      id: `TECHNOLOGY-FINDING-${index}`,
      name: item.name,
      ...(item.version ? { version: item.version } : {}),
      category: item.category,
      state: item.state,
      evidenceIds,
      confidence: item.confidence,
    };
  });

  const differences = mobile
    ? responsiveDifferences(
      desktop.structure as ResponsiveNode[],
      mobile.structure as ResponsiveNode[],
    )
    : [];
  const responsive = differences.map((difference, index) => {
    const id = `RESPONSIVE-${index}`;
    evidence.push({
      id,
      kind: "frame",
      value: boundedEvidenceValue(difference),
    });
    return { id, ...difference };
  });

  return parseSiteAnalysis({
    schemaVersion: 1,
    status: "evidence-only",
    evidence,
    structure: jsonSafeRecords(
      desktop.structure.slice(0, MAXIMUM_STRUCTURE_NODES),
    ),
    visualTokens: jsonSafeRecords(
      desktop.visualTokens.slice(0, MAXIMUM_STRUCTURE_NODES),
    ),
    motion,
    technology,
    responsive,
    synthesis: null,
    warnings: [...new Set([
      ...desktop.warnings,
      ...(mobile?.warnings ?? []),
      ...(!mobile ? ["Mobile Site inspection was unavailable"] : []),
    ])].slice(0, 100),
  });
}

function mergeTechnologySignals(
  desktop: SiteTechnologySignals,
  mobile?: SiteTechnologySignals,
): SiteTechnologySignals {
  const second = mobile ?? {
    generator: [],
    htmlAttributes: {},
    scriptUrls: [],
    stylesheetUrls: [],
    resourceUrls: [],
    inlineScripts: [],
    sourceMapSources: [],
    runtimes: {},
    activeRuntimeSignals: [],
  };
  return {
    generator: unique([...desktop.generator, ...second.generator]),
    htmlAttributes: { ...second.htmlAttributes, ...desktop.htmlAttributes },
    scriptUrls: unique([...desktop.scriptUrls, ...second.scriptUrls]),
    stylesheetUrls: unique([
      ...desktop.stylesheetUrls,
      ...second.stylesheetUrls,
    ]),
    resourceUrls: unique([...desktop.resourceUrls, ...second.resourceUrls]),
    inlineScripts: unique([...desktop.inlineScripts, ...second.inlineScripts]),
    sourceMapSources: unique([
      ...desktop.sourceMapSources,
      ...second.sourceMapSources,
    ]),
    runtimes: { ...second.runtimes, ...desktop.runtimes },
    activeRuntimeSignals: unique([
      ...desktop.activeRuntimeSignals,
      ...second.activeRuntimeSignals,
    ]),
  };
}

function safeMotionStates(
  states: Array<Record<string, string | number>>,
): Array<Record<string, string | number>> {
  return states.slice(0, 40).map((state) =>
    Object.fromEntries(
      Object.entries(state)
        .slice(0, 40)
        .filter(([, value]) =>
          typeof value === "string" ||
          (typeof value === "number" && Number.isFinite(value))
        )
        .map(([key, value]) => [
          key.slice(0, 100),
          typeof value === "string" ? value.slice(0, 2_048) : value,
        ]),
    )
  );
}

function boundedEvidenceValue(value: unknown): string {
  return JSON.stringify(value).slice(0, 2_048);
}

function jsonSafeRecords<T extends Record<string, unknown>>(records: T[]): T[] {
  return JSON.parse(JSON.stringify(records)) as T[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
