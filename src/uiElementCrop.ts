import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  validateComponentCropRegion,
  type DerivedComponentCrop,
  type PixelRegion,
} from "./appKnowledgeCrop.ts";
import type { UiElementCandidate } from "./uiElementExtraction.ts";

export type UiElementCropQualityIssue =
  | "content-clipped"
  | "excess-padding"
  | "implausible-geometry"
  | "semantic-type-mismatch"
  | "too-small";

export interface UiElementCropQuality {
  passed: boolean;
  issues: UiElementCropQualityIssue[];
  refined: boolean;
  contentBounds: PixelRegion;
}

export interface DerivedUiElementCrop extends DerivedComponentCrop {
  quality: UiElementCropQuality;
}

const EDGE_REFINABLE_TYPES = new Set([
  "Avatar",
  "Badge",
  "Checkbox",
  "Icon",
  "Loading Indicator",
  "Logo",
  "Map Pin",
  "Radio Button",
  "Status Dot",
  "Switch",
]);

const MAX_EDGE_EXPANSIONS = 4;
const EDGE_TOLERANCE_PIXELS = 1;

function expandedRegion(
  region: PixelRegion,
  touched: { left: boolean; top: boolean; right: boolean; bottom: boolean },
  sourceWidth: number,
  sourceHeight: number,
  horizontalStep: number,
  verticalStep: number,
): PixelRegion {
  const left = touched.left ? Math.max(0, region.left - horizontalStep) : region.left;
  const top = touched.top ? Math.max(0, region.top - verticalStep) : region.top;
  const right = touched.right
    ? Math.min(sourceWidth, region.left + region.width + horizontalStep)
    : region.left + region.width;
  const bottom = touched.bottom
    ? Math.min(sourceHeight, region.top + region.height + verticalStep)
    : region.top + region.height;
  return { left, top, width: right - left, height: bottom - top };
}

function sameRegion(left: PixelRegion, right: PixelRegion): boolean {
  return left.left === right.left
    && left.top === right.top
    && left.width === right.width
    && left.height === right.height;
}

async function contentBounds(body: Buffer): Promise<PixelRegion> {
  const { info } = await sharp(body)
    .trim({ threshold: 10, lineArt: true })
    .png({ palette: false })
    .toBuffer({ resolveWithObject: true });
  return {
    left: Math.max(0, -(info.trimOffsetLeft ?? 0)),
    top: Math.max(0, -(info.trimOffsetTop ?? 0)),
    width: info.width,
    height: info.height,
  };
}

function touchedEdges(bounds: PixelRegion, width: number, height: number) {
  return {
    left: bounds.left <= EDGE_TOLERANCE_PIXELS,
    top: bounds.top <= EDGE_TOLERANCE_PIXELS,
    right: bounds.left + bounds.width >= width - EDGE_TOLERANCE_PIXELS,
    bottom: bounds.top + bounds.height >= height - EDGE_TOLERANCE_PIXELS,
  };
}

function anyTouched(touched: ReturnType<typeof touchedEdges>): boolean {
  return touched.left || touched.top || touched.right || touched.bottom;
}

function paddedContentRegion(cropRegion: PixelRegion, bounds: PixelRegion): PixelRegion {
  const padding = Math.max(8, Math.round(Math.min(bounds.width, bounds.height) * 0.08));
  const left = Math.max(cropRegion.left, cropRegion.left + bounds.left - padding);
  const top = Math.max(cropRegion.top, cropRegion.top + bounds.top - padding);
  const right = Math.min(
    cropRegion.left + cropRegion.width,
    cropRegion.left + bounds.left + bounds.width + padding,
  );
  const bottom = Math.min(
    cropRegion.top + cropRegion.height,
    cropRegion.top + bounds.top + bounds.height + padding,
  );
  return { left, top, width: right - left, height: bottom - top };
}

// Container/layout types legitimately carry generous internal whitespace by design
// (a Dialog's padding, a Carousel's inter-card gaps), so the excess-padding check would
// false-positive on them. Everything else is a compact, self-contained control or glyph
// that should fill most of its own crop.
const PADDING_TOLERANT_TYPES = new Set([
  "Banner",
  "Card",
  "Carousel",
  "Coach Marks",
  "Context Menu",
  "Dialog",
  "Drawer",
  "Dropdown Menu",
  "Full-Screen Overlay",
  "Gallery",
  "Grid List",
  "Navigation Menu",
  "Popover",
  "Side Navigation",
  "Stacked List",
  "Table",
  "Table of Contents",
  "Toolbar",
  "Top Navigation Bar",
  "Tree",
]);

// ponytail: one-sided threshold (content touches the opposite edge while leaving a wide
// gap on this one) rather than a flat fill-ratio, so a Card with even, deliberate padding
// on both sides doesn't get flagged as loose. Raise the tolerated-gap fraction if compact
// controls start false-positiving on legitimate internal padding.
const EXCESS_PADDING_GAP_FRACTION = 0.15;
// validateComponentCropRegion pads the requested region by a few pixels before extraction,
// so a genuinely flush side rarely lands at exactly 0px — this tolerates that jitter without
// being loose enough to miss a real wide gap on the opposite side.
const NEAR_EDGE_FRACTION = 0.05;

function hasExcessPadding(type: string, cropRegion: PixelRegion, bounds: PixelRegion): boolean {
  if (PADDING_TOLERANT_TYPES.has(type)) return false;
  const leftGap = bounds.left;
  const rightGap = cropRegion.width - (bounds.left + bounds.width);
  const topGap = bounds.top;
  const bottomGap = cropRegion.height - (bounds.top + bounds.height);
  const wideHorizontalGap = cropRegion.width * EXCESS_PADDING_GAP_FRACTION;
  const wideVerticalGap = cropRegion.height * EXCESS_PADDING_GAP_FRACTION;
  const nearHorizontalEdge = Math.max(2, cropRegion.width * NEAR_EDGE_FRACTION);
  const nearVerticalEdge = Math.max(2, cropRegion.height * NEAR_EDGE_FRACTION);
  const oneSidedHorizontal = (leftGap > wideHorizontalGap && rightGap <= nearHorizontalEdge)
    || (rightGap > wideHorizontalGap && leftGap <= nearHorizontalEdge);
  const oneSidedVertical = (topGap > wideVerticalGap && bottomGap <= nearVerticalEdge)
    || (bottomGap > wideVerticalGap && topGap <= nearVerticalEdge);
  return oneSidedHorizontal || oneSidedVertical;
}

function compactGeometryIsPlausible(type: string, bounds: PixelRegion): boolean {
  const ratio = bounds.width / bounds.height;
  if (type === "Status Dot") return ratio >= 0.72 && ratio <= 1.38;
  return true;
}

function semanticTypeIsPlausible(candidate: UiElementCandidate): boolean {
  if (candidate.type !== "Status Dot") return true;
  const evidence = [
    candidate.variant,
    candidate.purpose,
    ...candidate.anatomy,
    ...candidate.observedProperties,
  ].join(" ").toLowerCase();
  return !/\bcheck(?:mark)?\b/.test(evidence);
}

function menuGeometryIsPlausible(input: {
  type: string;
  platform: "ios" | "android" | "web";
  candidate: UiElementCandidate;
}): boolean {
  if (input.type !== "Dropdown Menu" || input.platform === "web") return true;
  return input.candidate.region.width < 0.85;
}

export async function deriveUiElementCrop(input: {
  source: Uint8Array;
  candidate: UiElementCandidate;
  platform: "ios" | "android" | "web";
}): Promise<DerivedUiElementCrop> {
  let oriented: Buffer;
  let sourceWidth: number | undefined;
  let sourceHeight: number | undefined;
  try {
    oriented = await sharp(input.source)
      .autoOrient()
      .png({ palette: false, compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    ({ width: sourceWidth, height: sourceHeight } = await sharp(oriented).metadata());
  } catch {
    throw new Error("UI element crop source must be a valid raster image");
  }
  if (!sourceWidth || !sourceHeight) {
    throw new Error("UI element crop source must be a valid raster image");
  }

  const initialRegion = validateComponentCropRegion({
    region: input.candidate.region,
    sourceWidth,
    sourceHeight,
  });
  let cropRegion = initialRegion;
  let body = await sharp(oriented).extract(cropRegion).png({ palette: false }).toBuffer();
  let bounds = await contentBounds(body);
  let touched = touchedEdges(bounds, cropRegion.width, cropRegion.height);
  const edgeRefinable = EDGE_REFINABLE_TYPES.has(input.candidate.type);

  if (edgeRefinable) {
    const horizontalStep = Math.max(4, Math.ceil(initialRegion.width * 0.25));
    const verticalStep = Math.max(4, Math.ceil(initialRegion.height * 0.25));
    for (let attempt = 0; attempt < MAX_EDGE_EXPANSIONS && anyTouched(touched); attempt += 1) {
      const next = expandedRegion(
        cropRegion,
        touched,
        sourceWidth,
        sourceHeight,
        horizontalStep,
        verticalStep,
      );
      if (sameRegion(next, cropRegion)) break;
      cropRegion = next;
      body = await sharp(oriented).extract(cropRegion).png({ palette: false }).toBuffer();
      bounds = await contentBounds(body);
      touched = touchedEdges(bounds, cropRegion.width, cropRegion.height);
    }
    if (!anyTouched(touched)) {
      cropRegion = paddedContentRegion(cropRegion, bounds);
      body = await sharp(oriented)
        .extract(cropRegion)
        .png({ palette: false, compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
      bounds = await contentBounds(body);
      touched = touchedEdges(bounds, cropRegion.width, cropRegion.height);
    }
  }

  const issues: UiElementCropQualityIssue[] = [];
  if (cropRegion.width < 24 || cropRegion.height < 24) issues.push("too-small");
  if (edgeRefinable && anyTouched(touched)) issues.push("content-clipped");
  // Symmetric edge-touching (e.g. a genuinely full-width filter row) is fine and left to
  // the check above; this catches the asymmetric case content-clipped never covered — one
  // side flush against the crop boundary while the opposite side has a wide gap, which is
  // what a misplaced (not intentionally full-bleed) crop boundary looks like.
  if (hasExcessPadding(input.candidate.type, cropRegion, bounds)) issues.push("excess-padding");
  if (
    !compactGeometryIsPlausible(input.candidate.type, bounds)
    || !menuGeometryIsPlausible({
      type: input.candidate.type,
      platform: input.platform,
      candidate: input.candidate,
    })
  ) {
    issues.push("implausible-geometry");
  }
  if (!semanticTypeIsPlausible(input.candidate)) issues.push("semantic-type-mismatch");

  return {
    body,
    sha256: createHash("sha256").update(body).digest("hex"),
    byteSize: body.byteLength,
    contentType: "image/png",
    sourceRegionPixels: cropRegion,
    quality: {
      passed: issues.length === 0,
      issues,
      refined: !sameRegion(cropRegion, initialRegion),
      contentBounds: bounds,
    },
  };
}
