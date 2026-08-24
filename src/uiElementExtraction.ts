import type { AppKnowledgeNormalizedRegion } from "./appKnowledgeService.ts";
import {
  parseScreenAnalysisValue,
  type ScreenAnalysis,
} from "./screenAnalysis.ts";
import { SCREEN_CATEGORIES } from "./vitrine/screenCategories.ts";

export const UI_ELEMENT_PROMPT_VERSION = 10;
export const UI_ELEMENT_AUTO_ACCEPT_CONFIDENCE = 0.95;
export const UI_ELEMENT_MINIMUM_CONFIDENCE = 0.55;

export const UI_ELEMENT_TYPES = [
  { name: "Accordion", group: "Control" },
  { name: "Breadcrumbs", group: "Control" },
  { name: "Button", group: "Control" },
  { name: "Checkbox", group: "Control" },
  { name: "Color Picker", group: "Control" },
  { name: "Combobox", group: "Control" },
  { name: "Date Picker", group: "Control" },
  { name: "Editable Text", group: "Control" },
  { name: "File Upload", group: "Control" },
  { name: "Floating Action Button", group: "Control" },
  { name: "Link", group: "Control" },
  { name: "Pagination", group: "Control" },
  { name: "Radio Button", group: "Control" },
  { name: "Rating Control", group: "Control" },
  { name: "Search Bar", group: "Control" },
  { name: "Segmented Control", group: "Control" },
  { name: "Select", group: "Control" },
  { name: "Slider", group: "Control" },
  { name: "Stepper", group: "Control" },
  { name: "Switch", group: "Control" },
  { name: "Tab", group: "Control" },
  { name: "Text Field", group: "Control" },
  { name: "Tile", group: "Control" },
  { name: "Time Picker", group: "Control" },
  { name: "Badge", group: "View" },
  { name: "Banner", group: "View" },
  { name: "Card", group: "View" },
  { name: "Carousel", group: "View" },
  { name: "Chip", group: "View" },
  { name: "Divider", group: "View" },
  { name: "Gallery", group: "View" },
  { name: "Grid List", group: "View" },
  { name: "Keyboard Key", group: "View" },
  { name: "Loading Indicator", group: "View" },
  { name: "Map Pin", group: "View" },
  { name: "Progress Indicator", group: "View" },
  { name: "Side Navigation", group: "View" },
  { name: "Skeleton", group: "View" },
  { name: "Stacked List", group: "View" },
  { name: "Status Dot", group: "View" },
  { name: "Table", group: "View" },
  { name: "Table of Contents", group: "View" },
  { name: "Toolbar", group: "View" },
  { name: "Top Navigation Bar", group: "View" },
  { name: "Tree", group: "View" },
  { name: "Logo Wall", group: "View" },
  { name: "Coach Marks", group: "Overlay" },
  { name: "Context Menu", group: "Overlay" },
  { name: "Dialog", group: "Overlay" },
  { name: "Drawer", group: "Overlay" },
  { name: "Dropdown Menu", group: "Overlay" },
  { name: "Full-Screen Overlay", group: "Overlay" },
  { name: "Navigation Menu", group: "Overlay" },
  { name: "Popover", group: "Overlay" },
  { name: "Toast", group: "Overlay" },
  { name: "Tooltip", group: "Overlay" },
  { name: "Avatar", group: "Imagery" },
  { name: "Icon", group: "Imagery" },
  { name: "Illustration", group: "Imagery" },
  { name: "Hero Image", group: "Imagery" },
  { name: "Logo", group: "Imagery" },
  { name: "Photo", group: "Imagery" },
  { name: "Product Image", group: "Imagery" },
] as const;

const TYPE_NAMES = new Set<string>(UI_ELEMENT_TYPES.map(({ name }) => name));
const SUPPORTED_SCREEN_TYPES = SCREEN_CATEGORIES.flatMap(({ children }) => children);
const SCREEN_TYPE_BY_KEY = new Map(
  SUPPORTED_SCREEN_TYPES.map((screenType) => [screenType.toLocaleLowerCase(), screenType]),
);
const TYPE_BY_GROUP_PREFIX = new Map<string, string>(
  UI_ELEMENT_TYPES.map(({ group, name }) => [`${group}: ${name}`, name]),
);
const TYPE_ALIASES = new Map<string, string>([
  ["Accordion & Collapse", "Accordion"],
  ["Navigation Bar", "Top Navigation Bar"],
  ["Switch & Toggle", "Switch"],
]);

export type UiElementLayer = "whole-screen" | "outer-presentation" | "embedded-ui";

export interface UiElementCandidate {
  type: string;
  layer: UiElementLayer;
  variant: string;
  purpose: string;
  anatomy: string[];
  observedProperties: string[];
  region: AppKnowledgeNormalizedRegion;
  confidence: number;
}

export interface UiElementExtraction {
  summary: string;
  components: UiElementCandidate[];
}

export interface ScreenPatternOption {
  slug: string;
  name: string;
  section: string;
}

export interface ScreenPatternCandidate {
  slug: string;
  confidence: number;
}

export interface UiElementScreenExtraction extends UiElementExtraction {
  screenAnalysis: ScreenAnalysis;
  screenPatterns: ScreenPatternCandidate[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new Error(`${label} must be non-empty text no longer than ${maximum} characters`);
  }
  return value.trim();
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 12) {
    throw new Error(`${label} must be an array with at most 12 values`);
  }
  return [...new Set(value.map((item, index) => text(item, `${label}[${index}]`, 240)))];
}

function region(value: unknown): AppKnowledgeNormalizedRegion {
  const raw = record(value, "region");
  const result = {
    x: Number(raw.x),
    y: Number(raw.y),
    width: Number(raw.width),
    height: Number(raw.height),
  };
  if (
    Object.values(result).some((coordinate) => !Number.isFinite(coordinate))
    || result.x < 0
    || result.y < 0
    || result.width <= 0
    || result.height <= 0
    || result.x + result.width > 1
    || result.y + result.height > 1
  ) {
    throw new Error("region must be normalized and stay inside the image");
  }
  return result;
}

function layer(value: unknown, label: string): UiElementLayer {
  const result = value === undefined ? "whole-screen" : text(value, label, 40);
  if (!["whole-screen", "outer-presentation", "embedded-ui"].includes(result)) {
    throw new Error(`${label} is unsupported: ${result}`);
  }
  return result as UiElementLayer;
}

function normalizedUiElementType(input: {
  type: string;
  variant: string;
  purpose: string;
  anatomy: readonly string[];
}): string {
  if (input.type !== "Status Dot") return input.type;
  const evidence = [
    input.variant,
    input.purpose,
    ...input.anatomy,
  ].join(" ").toLowerCase();
  return /\bcheck(?:mark)?\b/.test(evidence) ? "Icon" : input.type;
}

export function parseUiElementExtraction(value: unknown): UiElementExtraction {
  const raw = record(value, "UI element extraction");
  if (!Array.isArray(raw.components) || raw.components.length > 12) {
    throw new Error("components must be an array with at most 12 values");
  }
  const components = raw.components.map((item, index): UiElementCandidate => {
    const candidate = record(item, `components[${index}]`);
    const rawType = text(candidate.type, `components[${index}].type`, 120);
    const unprefixedType = TYPE_BY_GROUP_PREFIX.get(rawType) ?? rawType;
    const parsedType = TYPE_ALIASES.get(unprefixedType) ?? unprefixedType;
    if (!TYPE_NAMES.has(parsedType)) throw new Error(`Unsupported UI element type: ${parsedType}`);
    const confidence = Number(candidate.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error(`components[${index}].confidence must be between zero and one`);
    }
    const variant = text(candidate.variant, `components[${index}].variant`, 160);
    const purpose = text(candidate.purpose, `components[${index}].purpose`, 1_000);
    const anatomy = strings(candidate.anatomy, `components[${index}].anatomy`);
    return {
      type: normalizedUiElementType({ type: parsedType, variant, purpose, anatomy }),
      layer: layer(candidate.layer, `components[${index}].layer`),
      variant,
      purpose,
      anatomy,
      observedProperties: strings(
        candidate.observedProperties,
        `components[${index}].observedProperties`,
      ),
      region: region(candidate.region),
      confidence,
    };
  });
  return {
    summary: text(raw.summary, "summary", 1_000),
    components: suppressNestedUiElementCandidates(
      excludeComponentsOccludedByOverlay(
        collapseRepeatedUiElementCandidates(
          deduplicateUiElementCandidates(components),
        ),
      ),
    ),
  };
}

export function parseUiElementScreenExtraction(
  value: unknown,
  screenPatternOptions: readonly ScreenPatternOption[],
): UiElementScreenExtraction {
  const raw = record(value, "UI element and screen extraction");
  if (raw.screenPatterns !== undefined && !Array.isArray(raw.screenPatterns)) {
    throw new Error("screenPatterns must be an array with at most 4 values");
  }
  const rawScreenPatterns = (raw.screenPatterns ?? []) as unknown[];
  if (rawScreenPatterns.length > 4) {
    throw new Error("screenPatterns must be an array with at most 4 values");
  }
  const allowedSlugs = new Set(screenPatternOptions.map(({ slug }) => slug));
  const seen = new Set<string>();
  const screenPatterns = rawScreenPatterns.map((item, index): ScreenPatternCandidate => {
    const pattern = record(item, `screenPatterns[${index}]`);
    const slug = text(pattern.slug, `screenPatterns[${index}].slug`, 160);
    if (!allowedSlugs.has(slug)) {
      throw new Error(`Unsupported screen pattern slug: ${slug}`);
    }
    if (seen.has(slug)) throw new Error(`Duplicate screen pattern slug: ${slug}`);
    seen.add(slug);
    const confidence = Number(pattern.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error(`screenPatterns[${index}].confidence must be between zero and one`);
    }
    return { slug, confidence };
  });
  const parsedScreenAnalysis = parseScreenAnalysisValue(raw.screenAnalysis);
  const pageType = SCREEN_TYPE_BY_KEY.get(parsedScreenAnalysis.pageType.toLocaleLowerCase());
  if (!pageType) {
    throw new Error(`Unsupported Vitrines screen category: ${parsedScreenAnalysis.pageType}`);
  }
  const embeddedPageType = parsedScreenAnalysis.embeddedPageType
    ? SCREEN_TYPE_BY_KEY.get(parsedScreenAnalysis.embeddedPageType.toLocaleLowerCase())
    : undefined;
  if (parsedScreenAnalysis.embeddedPageType && !embeddedPageType) {
    throw new Error(
      `Unsupported embedded Vitrines screen category: ${parsedScreenAnalysis.embeddedPageType}`,
    );
  }
  if (
    parsedScreenAnalysis.sourcePresentation === "marketing-composite"
    && !embeddedPageType
  ) {
    throw new Error("Marketing composites require embeddedPageType");
  }
  if (
    parsedScreenAnalysis.sourcePresentation === "marketing-composite"
    && pageType !== "Feature Info"
  ) {
    throw new Error("Marketing composites require pageType Feature Info");
  }
  if (
    parsedScreenAnalysis.sourcePresentation !== "marketing-composite"
    && embeddedPageType
  ) {
    throw new Error("Only marketing composites may set embeddedPageType");
  }
  if (
    parsedScreenAnalysis.sourcePresentation !== "direct-screen"
    && (parsedScreenAnalysis.confidence ?? 0.5) > 0.9
  ) {
    throw new Error(
      "Device mockups, marketing composites, and unknown presentations require confidence at or below 0.90",
    );
  }
  const screenAnalysis: ScreenAnalysis = {
    ...parsedScreenAnalysis,
    pageType,
    ...(embeddedPageType ? { embeddedPageType } : {}),
  };
  const extraction = parseUiElementExtraction(raw);
  if (
    screenAnalysis.sourcePresentation === "direct-screen"
    && extraction.components.some(({ layer }) => layer !== "whole-screen")
  ) {
    throw new Error("Direct-screen UI elements must use the whole-screen layer");
  }
  if (
    ["device-mockup", "marketing-composite"].includes(screenAnalysis.sourcePresentation)
    && extraction.components.some(({ layer }) => layer === "whole-screen")
  ) {
    throw new Error("Mockup and marketing-composite UI elements must identify their visual layer");
  }
  return {
    ...extraction,
    screenAnalysis,
    screenPatterns,
  };
}

function intersectionOverUnion(
  left: AppKnowledgeNormalizedRegion,
  right: AppKnowledgeNormalizedRegion,
): number {
  const intersectionWidth = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  const intersection = intersectionWidth * intersectionHeight;
  const union = left.width * left.height + right.width * right.height - intersection;
  return union > 0 ? intersection / union : 0;
}

export function deduplicateUiElementCandidates(
  candidates: readonly UiElementCandidate[],
): UiElementCandidate[] {
  const accepted: UiElementCandidate[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.confidence - a.confidence)) {
    if (candidate.confidence < UI_ELEMENT_MINIMUM_CONFIDENCE) continue;
    if (
      accepted.some((existing) =>
        existing.type === candidate.type
        && existing.layer === candidate.layer
        && intersectionOverUnion(existing.region, candidate.region) >= 0.72)
    ) continue;
    accepted.push(candidate);
  }
  return accepted.sort((a, b) =>
    a.region.y - b.region.y || a.region.x - b.region.x || a.type.localeCompare(b.type));
}

const OCCLUDING_OVERLAY_TYPES = new Set(["Dialog", "Full-Screen Overlay"]);
const COMPOSITE_COMPONENT_TYPES = new Set([
  "Accordion",
  "Banner",
  "Card",
  "Carousel",
  "Coach Marks",
  "Context Menu",
  "Dialog",
  "Drawer",
  "Dropdown Menu",
  "File Upload",
  "Full-Screen Overlay",
  "Gallery",
  "Grid List",
  "Navigation Menu",
  "Popover",
  "Search Bar",
  "Segmented Control",
  "Side Navigation",
  "Stacked List",
  "Table",
  "Toolbar",
  "Top Navigation Bar",
  "Tree",
]);

function centerInside(
  candidate: AppKnowledgeNormalizedRegion,
  container: AppKnowledgeNormalizedRegion,
): boolean {
  const centerX = candidate.x + candidate.width / 2;
  const centerY = candidate.y + candidate.height / 2;
  return centerX >= container.x
    && centerX <= container.x + container.width
    && centerY >= container.y
    && centerY <= container.y + container.height;
}

export function excludeComponentsOccludedByOverlay(
  candidates: readonly UiElementCandidate[],
): UiElementCandidate[] {
  const overlays = candidates.filter(({ type }) => OCCLUDING_OVERLAY_TYPES.has(type));
  if (overlays.length === 0) return [...candidates];
  return candidates.filter((candidate) => {
    if (OCCLUDING_OVERLAY_TYPES.has(candidate.type)) return true;
    const layerOverlays = overlays.filter(({ layer }) => layer === candidate.layer);
    return layerOverlays.length === 0
      || layerOverlays.some((overlay) => centerInside(candidate.region, overlay.region));
  });
}

function coveredRatio(
  child: AppKnowledgeNormalizedRegion,
  parent: AppKnowledgeNormalizedRegion,
): number {
  const width = Math.max(
    0,
    Math.min(child.x + child.width, parent.x + parent.width) - Math.max(child.x, parent.x),
  );
  const height = Math.max(
    0,
    Math.min(child.y + child.height, parent.y + parent.height) - Math.max(child.y, parent.y),
  );
  return (width * height) / (child.width * child.height);
}

export function suppressNestedUiElementCandidates(
  candidates: readonly UiElementCandidate[],
): UiElementCandidate[] {
  return candidates.filter((candidate) =>
    !candidates.some((parent) =>
      parent !== candidate
      && parent.layer === candidate.layer
      && COMPOSITE_COMPONENT_TYPES.has(parent.type)
      && parent.region.width * parent.region.height > candidate.region.width * candidate.region.height
      && coveredRatio(candidate.region, parent.region) >= 0.85));
}

function representativeCandidate(
  items: readonly UiElementCandidate[],
): UiElementCandidate {
  return items.reduce((best, candidate) =>
    candidate.confidence > best.confidence ? candidate : best);
}

function collapseKeyboardKeys(candidates: readonly UiElementCandidate[]): UiElementCandidate[] {
  const keys = candidates.filter(({ type }) => type === "Keyboard Key");
  if (keys.length < 3) return [...candidates];
  const layers = [...new Set(keys.map(({ layer }) => layer))];
  const collapsedLayers = new Set(
    layers.filter((layer) => keys.filter((key) => key.layer === layer).length >= 3),
  );
  if (collapsedLayers.size === 0) return [...candidates];
  return [
    ...candidates.filter(({ type, layer }) =>
      type !== "Keyboard Key" || !collapsedLayers.has(layer)),
    ...layers
      .filter((layer) => collapsedLayers.has(layer))
      .map((layer) => representativeCandidate(keys.filter((key) => key.layer === layer))),
  ];
}

function horizontalCoverage(left: UiElementCandidate, right: UiElementCandidate): number {
  const overlap = Math.max(
    0,
    Math.min(left.region.x + left.region.width, right.region.x + right.region.width)
      - Math.max(left.region.x, right.region.x),
  );
  return overlap / Math.min(left.region.width, right.region.width);
}

function collapseStackedButtons(candidates: readonly UiElementCandidate[]): UiElementCandidate[] {
  const buttons = candidates
    .filter(({ type }) => type === "Button")
    .sort((left, right) => left.region.y - right.region.y);
  if (buttons.length < 3) return [...candidates];
  const groups: UiElementCandidate[][] = [];
  for (const button of buttons) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (
      previous
      && previous.layer === button.layer
      && horizontalCoverage(previous, button) >= 0.8
      && button.region.y - (previous.region.y + previous.region.height)
        <= Math.max(previous.region.height, button.region.height, 0.04)
    ) {
      group!.push(button);
    } else {
      groups.push([button]);
    }
  }
  const collapsed = groups.filter((group) => group.length >= 3);
  if (collapsed.length === 0) return [...candidates];
  const removed = new Set(collapsed.flat());
  return [
    ...candidates.filter((candidate) => !removed.has(candidate)),
    ...collapsed.map(representativeCandidate),
  ];
}

export function collapseRepeatedUiElementCandidates(
  candidates: readonly UiElementCandidate[],
): UiElementCandidate[] {
  return collapseStackedButtons(collapseKeyboardKeys(candidates));
}

export function buildUiElementExtractionPrompt(
  platform: string,
  _screenPatternOptions: readonly ScreenPatternOption[] = [],
): string {
  const taxonomy = [...new Set(UI_ELEMENT_TYPES.map(({ group }) => group))]
    .map((group) => {
      const names = UI_ELEMENT_TYPES
        .filter((type) => type.group === group)
        .map(({ name }) => `- ${name}`)
        .join("\n");
      return `${group}\n${names}`;
    })
    .join("\n\n");
  const screenTypes = JSON.stringify(SUPPORTED_SCREEN_TYPES);
  return `Analyze this ${platform} screenshot once for both its screen classification and its visibly present reusable UI components.

Return raw JSON only with this exact shape:
{
  "summary": "brief description of the visible screen",
  "screenAnalysis": {
    "description": "what is visibly present",
    "purpose": "the primary user goal supported by this screen",
    "pageType": "category for the complete supplied image",
    "sourcePresentation": "direct-screen, device-mockup, marketing-composite, or unknown",
    "embeddedPageType": "page type of embedded app UI when this is a marketing composite, otherwise null",
    "productArea": "short product area",
    "theme": "light, dark, or mixed",
    "visibleStates": ["only states visibly present"],
    "componentNames": ["prominent visible component names"],
    "visibleText": ["important visible text"],
    "layoutPatterns": ["visible layout patterns"],
    "icons": ["recognizable visible icons"],
    "imagery": ["visible imagery types"],
    "contentPatterns": ["visible content patterns"],
    "interactionPatterns": ["pixel-grounded visible affordances, never assumed runtime behavior"],
    "responsiveViewport": "desktop, tablet, mobile, or unknown",
    "confidence": 0.0
  },
  "components": [{
    "type": "one exact taxonomy name below",
    "layer": "whole-screen, outer-presentation, or embedded-ui",
    "variant": "short visible variant such as Primary, Disabled, Filled, Modal, or Default",
    "purpose": "what this visible occurrence enables or communicates",
    "anatomy": ["visible parts inside the component"],
    "observedProperties": ["concrete visual properties"],
    "region": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0},
    "confidence": 0.0
  }]
}

Extract at most six clearly bounded, high-value component occurrences. Select the type from
the taxonomy exactly; omit an occurrence when none of the types fits. Regions use normalized
top-left coordinates from zero to one. Make each region a tight crop around exactly one
component, including its necessary label or internal content but excluding unrelated neighbors.
Use parent-wins hierarchy: select the largest meaningful reusable composite and do not also
return ordinary children inside it. A Dialog suppresses its buttons, icons, imagery, and controls;
a Grid List or Stacked List suppresses its repeated items; a navigation bar or Toolbar suppresses
its icons; and a Card, Banner, Carousel, Gallery, or menu suppresses ordinary nested primitives.
When three or more visually equivalent controls repeat, keep one representative occurrence with
its original taxonomy type. Repeated social-login controls remain one representative Button;
repeated keypad keys remain one representative Keyboard Key. Do not relabel repeated primitives
as Grid List or Stacked List. Use Grid List or Stacked List only when the visible container itself
is the meaningful reusable component. Preserve separately styled or stateful variants, such as a
primary button beside repeated social buttons. For dialogs and overlays, crop the complete visible
surface and exclude both nested children and the dimmed background. For navigation bars, include
the complete bar. Classify Dropdown Menu only when an expanded floating menu or list is visibly
open; a horizontal filter-chip row is not a Dropdown Menu. A Status Dot must be a complete,
compact circular status indicator with no glyph inside, not a clipped semicircle or decorative
shape. Classify a large checkmark inside a coloured circle as Icon, not Status Dot. A Loading
Indicator must include the complete spinner or progress glyph, not a partial decorative arc.
Compact components must be fully enclosed with visible background margin on every side.
For Button, Link, Banner, and other text-bearing components, include the complete visible label;
omit the component when its complete visible text cannot be bounded cleanly. An isolated arrow,
chevron, or glyph without a visibly bounded button surface is an Icon, not a Button. Native status
bars, dynamic islands, browser chrome, and device frames are never Logos. Do not use Hero Image,
Illustration, Photo, or Product Image for a whole device render or for an area that contains app UI;
outer-presentation imagery must exclude the embedded device and its interface.
Do not crop the whole screen. Do not infer hidden behavior, unobserved states,
or off-screen content. A marketing composite contains promotional copy, branding, decoration,
or multiple device renders around embedded app UI; describe and classify both layers separately.
For a marketing composite, set screenAnalysis.pageType to Feature Info and embeddedPageType to
the primary embedded app UI category. Otherwise set embeddedPageType to null.
For a direct screen, set every component layer to whole-screen. For a device mockup or marketing
composite, set promotional artwork and controls to outer-presentation and app controls visible
inside a device to embedded-ui; never use whole-screen for those presentations. Parent-wins and
overlap suppression apply within one layer only.
Do not claim scrolling, navigation, selection, submission, or gesture behavior from appearance
alone. Cap screenAnalysis confidence at 0.90 for device mockups, marketing composites, and unknown presentations.
Prefer a few dominant components over duplicate instances.

Set screenAnalysis.pageType to exactly one supported Vitrines screen category from this list.
Do not invent, combine, or paraphrase labels. Use Misc only when none of the other categories fit:
${screenTypes}

Page-type precedence rules:
- Classify the primary foreground task or content surface, not the product's industry or the fact
  that it is business, admin, developer, CRM, or internal software.
- Use Settings & Preferences whenever the primary surface changes configuration, preferences,
  connections, providers, repositories, integrations, or workspace settings. Do not use Internal
  Tool for those screens.
- Use Internal Tool only as a last-resort operational workspace, record, or data-table category
  when no more specific supported category describes the primary task.
- Use Post Detail for one visible post, draft, or social content item with its metadata, comments,
  or item actions. Other Content is a last resort and must not replace Post Detail.
- Use Add & Create only when the primary task is creating a new record, asset, or content item,
  including an active AI generation composer.
- Use Media Editor only when the user is visibly modifying existing media with editing controls
  such as a timeline, crop, trim, layers, adjustments, or transformations. A generation prompt
  and generated-output gallery alone are Add & Create, not Media Editor.
- Use Canvas only for a freeform spatial workspace where users arrange multiple objects. A media
  gallery, generated-output panel, board, or prompt composer is not a Canvas.
- A dominant modal may determine pageType when it contains the primary task, such as Create,
  Settings, or Confirmation. An incidental menu or popover does not change the underlying type.
- Keep pageType consistent across near-identical screens that differ only by selection, an open
  menu, or generated output unless that foreground state changes the primary task.

Taxonomy:
${taxonomy}`;
}
