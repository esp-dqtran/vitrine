import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { apiFetch } from "../apiFetch.ts";
import { createPortal } from "react-dom";
import {
  Button,
  Icon,
  IconButton,
  TextInput,
  type IconName,
} from "@astryxdesign/core";
import {
  ChevronSmallDownIcon,
  CogIcon,
  CommandIcon,
  DragIcon,
  EditIcon,
  EyeCloseIcon,
  EyeIcon,
  GridIcon,
  LockIcon,
  MergeIcon,
  PlusIcon,
  PointerDefaultIcon,
  SearchIcon,
  UndoIcon,
  UnlockIcon,
} from "@storybook/icons";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  Excalidraw,
  hashElementsVersion,
  hashString,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  Collaborator,
  DataURL,
  ExcalidrawImperativeAPI,
  ExcalidrawProps,
  PointerDownState,
  SocketId,
  ToolType,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FileId,
} from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";

import type {
  ResearchProjectItem,
  ResearchProjectWorkspace,
} from "../../researchProject.ts";
import {
  normalizeDesignerCanvasComments,
  type DesignerCanvasCommentThread,
} from "../../designerCanvas.ts";
import type { Platform } from "../../platformFromUrl.ts";
import type { AppsDiscoveryScreenResult } from "../appsDiscovery.ts";
import type { FlowCatalogItem } from "../flowCatalogApi.ts";
import { getResearchProject } from "../researchProjectsApi.ts";
import {
  DesignerCanvasApiError,
  getDesignerCanvas,
  getDesignerCanvasFile,
  saveDesignerCanvas,
  saveDesignerCanvasFile,
} from "../designerCanvasApi.ts";
import {
  openDesignerCanvasCollaboration,
  type DesignerCanvasCollaborator,
  type DesignerCanvasCollaborationSession,
  type DesignerCanvasCollaborationStatus,
  type DesignerCanvasRemoteCursor,
} from "../designerCanvasCollaboration.ts";
import {
  projectCanvasAssetUrl,
  uploadProjectCanvasAsset,
} from "../projectCanvasAssets.ts";
import { navigate } from "../router.ts";
import { ProjectAccessButton } from "./ProjectAccessDialog.tsx";
import { useApplicationToast } from "./ApplicationToast.tsx";
import {
  ProjectCanvasCommentGlyph,
  ProjectCanvasCommentInbox,
  ProjectCanvasCommentPanel,
  ProjectCanvasCommentPin,
} from "./ProjectCanvasComments.tsx";
import {
  ProjectReferencePanel,
  type ProjectReferenceState,
} from "./ProjectReferencePanel.tsx";
import {
  catalogDragMimeType,
  ProjectScreenLibrary,
  projectScreenKey,
  type CatalogDragPayload,
} from "./ProjectScreenLibrary.tsx";
import {
  ProjectCanvasDocumentEditor,
  type ProjectCanvasDocumentData,
  type ProjectCanvasDocumentTemplateId,
} from "./ProjectCanvasDocumentEditor.tsx";
import {
  defaultProjectStickyNoteColor,
  projectStickyNoteColors,
  ProjectStickyNotePicker,
  StickyNoteGlyph,
  StickyNotesCollageGlyph,
  type ProjectStickyNoteColor,
} from "./ProjectStickyNotePicker.tsx";
import {
  defaultProjectStickyNoteCollaboration,
  defaultProjectStickyNoteFormat,
  normalizeProjectStickyNoteFormat,
  normalizeProjectStickyNoteCollaboration,
  projectStickyNoteFontForFamily,
  projectStickyNoteFontFamilies,
  stickyNoteUsesRichTextOverlay,
  ProjectStickyNoteMetadata,
  ProjectObjectToolbar,
  ProjectObjectToolbarColorPicker,
  ProjectSelectionToolbar,
  type ProjectStickyNoteCollaboration,
  type ProjectStickyNoteFormat,
} from "./ProjectStickyNoteToolbar.tsx";
import { CanvasObjectToolbarDivider } from "./CanvasObjectToolbar.tsx";
import {
  stickyNoteBoundTextPosition,
  stickyNoteTextContentWidth,
  stickyNoteTextHorizontalInset,
  stickyNoteTextVerticalInset,
} from "./stickyNoteTextLayout.ts";
import {
  ProjectTemplateLibrary,
  type ProjectCanvasTemplate,
} from "./ProjectTemplateLibrary.tsx";
import {
  ProjectResearchFramePicker,
  type ProjectResearchFrameItem,
  type ProjectResearchFramePreset,
  type ProjectResearchFrameType,
} from "./ProjectResearchFramePicker.tsx";
import eraserToolIcon from "../assets/figjam-eraser-tool.svg";
import highlighterToolIconSource from "../assets/figjam-highlighter-tool.svg?raw";
import markerToolIconSource from "../assets/figjam-marker-tool.svg?raw";
import thickStrokeIcon from "../assets/figjam-thick-stroke.svg";
import thinStrokeIcon from "../assets/figjam-thin-stroke.svg";
import figjamBentConnectorIcon from "../assets/figjam-bent-connector.svg";
import figjamCurvedConnectorIcon from "../assets/figjam-curved-connector.svg";
import figjamConnectorIcon from "../assets/figjam-connector.svg";
import figjamConnectorNoEndpointsIcon from "../assets/figjam-connector-no-endpoints.svg";
import figjamSquareIcon from "../assets/figjam-square.svg";
import figjamEllipseIcon from "../assets/figjam-ellipse.svg";
import figjamDiamondIcon from "../assets/figjam-diamond.svg";
import figjamRoundedRectangleIcon from "../assets/figjam-rounded-rectangle.svg";
import figjamTriangleIcon from "../assets/figjam-triangle.svg";
import figjamDownTriangleIcon from "../assets/figjam-down-triangle.svg";
import figjamCylinderIcon from "../assets/figjam-cylinder.svg";
import figjamMindMapIcon from "../assets/figjam-mind-map.svg";
import figjamSectionToolIcon from "../assets/figjam-section-tool.svg";
import figjamTableToolIcon from "../assets/figjam-table-tool.svg";
import figjamStampToolIcon from "../assets/figjam-stamp-tool.svg";
import figjamStampWheel from "../assets/figjam-stamp-wheel.svg";
import figjamActionsToolIcon from "../assets/figjam-actions-tool.svg";
import figjamWidgetsToolIcon from "../assets/figjam-widgets-tool.svg";
import figjamStampThumbsUp from "../assets/figjam-stamp-thumbs-up.png";
import figjamStampPlusOne from "../assets/figjam-stamp-plus-one.png";
import figjamStampStar from "../assets/figjam-stamp-star.png";
import figjamStampQuestion from "../assets/figjam-stamp-question.png";
import figjamStampThumbsDown from "../assets/figjam-stamp-thumbs-down.png";
import figjamStampDot from "../assets/figjam-stamp-dot.png";
import figjamStampProfile from "../assets/figjam-stamp-profile.svg";
import figjamStampHeart from "../assets/figjam-stamp-heart.png";

const canvasMediaMimeTypeSet = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const canvasSource = "https://astryx.design";
// Keep the rendered board opaque so Excalidraw can composite every scene element.
const canvasSceneBackground = "#f7f8fa";
const canvasTheme: "light" = "light";
const stickyNoteSize = 240;
const canvasDocumentWidth = 760;
const canvasDocumentHeight = 1_080;
const expandedCanvasDocumentWidth = 920;
const expandedCanvasDocumentHeight = 1_240;
const canvasDocumentViewportTopSafeArea = 124;
const canvasDocumentViewportSideSafeArea = 16;
const researchFrameWidth = 960;
const researchFrameHeight = 640;
const defaultSectionSize = 420;
const defaultSectionFill = "#ffffff";
const defaultSectionStroke = "#757575";
const canvasCollaborationColors = [
  { background: "#5b67f1", stroke: "#3f46bc" },
  { background: "#0f9f6e", stroke: "#087454" },
  { background: "#d97706", stroke: "#a95605" },
  { background: "#db2777", stroke: "#a81d5b" },
  { background: "#7c3aed", stroke: "#5d2bb4" },
  { background: "#0284c7", stroke: "#03699c" },
] as const;

type ElementSkeleton = NonNullable<
  Parameters<typeof convertToExcalidrawElements>[0]
>[number];
type StickyPlacementMode = "single" | "stack";
type CanvasPointerUpdate = Parameters<
  NonNullable<ExcalidrawProps["onPointerUpdate"]>
>[0];

function canvasCollaboratorColor(identity: string) {
  let hash = 0;
  for (const character of identity) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return canvasCollaborationColors[
    Math.abs(hash) % canvasCollaborationColors.length
  ];
}

function canvasCollaboratorInitials(name: string): string {
  return (
    name
      .split(/[@\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

interface StickyPlacement {
  color: ProjectStickyNoteColor;
  mode: StickyPlacementMode;
}

interface StickyDraft {
  x: number;
  y: number;
  width?: number;
  height?: number;
  editingElementId?: string;
  editingTextElementId?: string;
  color: ProjectStickyNoteColor;
  value: string;
  format: ProjectStickyNoteFormat;
}

function stickyNotePlacementCursor(
  color: ProjectStickyNoteColor,
  mode: StickyPlacementMode,
): string {
  const stack =
    mode === "stack"
      ? `<path d="M8 5h17v17H8z" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1.5" opacity=".55"/>`
      : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${stack}<path d="M5 8h19v13l-6 6H5z" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1.5" stroke-linejoin="round"/><path d="M18 27v-6h6" fill="none" stroke="${color.stroke}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 5 8, crosshair`;
}

const commentPlacementCursor = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 5h20v15H13l-7 6V5Z" fill="white" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/><path d="M11 10h10M11 14h7" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="5" r="3" fill="#2563eb" stroke="white" stroke-width="1.5"/></svg>',
)}") 6 5, crosshair`;

type ProjectCanvasTool =
  | "research-frames"
  | "screens"
  | "sticky"
  | "comments"
  | "document"
  | "templates"
  | "more";

type CanvasShapeTool = Extract<
  ToolType,
  "rectangle" | "ellipse" | "diamond" | "line" | "arrow"
>;
type CanvasShapeOptionId =
  | "bent-connector"
  | "curved-connector"
  | "connector"
  | "line"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "rounded-rectangle"
  | "triangle"
  | "down-triangle"
  | "cylinder"
  | "mind-map";

type CanvasCustomShapeId = Extract<
  CanvasShapeOptionId,
  "triangle" | "down-triangle" | "cylinder" | "mind-map"
>;

interface CanvasShapeOption {
  id: CanvasShapeOptionId;
  tool?: CanvasShapeTool;
  customShape?: CanvasCustomShapeId;
  label: string;
  group: "Connectors" | "Basic";
  icon: string;
  glyphFill?: "rectangle" | "rounded-rectangle" | "ellipse";
  arrowType?: "round" | "sharp" | "elbow";
  roundness?: "round" | "sharp";
}

type CanvasSelectableShapeType = "rectangle" | "ellipse" | "diamond";
type CanvasShapeLineStyle = "solid" | "dashed" | "dotted";

interface CanvasShapeReference {
  elementId: string;
  type: CanvasSelectableShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeStyle: CanvasShapeLineStyle;
  opacity: number;
}

interface CanvasMarkerColor {
  label: string;
  value: string;
}

type CanvasMarkerMode = "marker" | "highlighter" | "washi" | "eraser";
type CanvasMarkerStrokeWeight = "thin" | "thick";

interface CanvasFreeLineReference {
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  mode: Exclude<CanvasMarkerMode, "eraser">;
  weight: CanvasMarkerStrokeWeight;
}

type CanvasStampId =
  | "thumbs-up"
  | "plus-one"
  | "star"
  | "question"
  | "thumbs-down"
  | "dot"
  | "profile"
  | "heart";

interface CanvasStampOption {
  id: CanvasStampId;
  label: string;
  asset: string;
}

const canvasStampOptions: readonly CanvasStampOption[] = [
  { id: "thumbs-up", label: "Thumbs up", asset: figjamStampThumbsUp },
  { id: "plus-one", label: "+1", asset: figjamStampPlusOne },
  { id: "star", label: "Star", asset: figjamStampStar },
  { id: "question", label: "Question", asset: figjamStampQuestion },
  { id: "thumbs-down", label: "Thumbs down", asset: figjamStampThumbsDown },
  { id: "dot", label: "Dot", asset: figjamStampDot },
  { id: "profile", label: "Profile", asset: figjamStampProfile },
  { id: "heart", label: "Heart", asset: figjamStampHeart },
] as const;

const defaultCanvasStamp = canvasStampOptions[0];
type CanvasWidgetsTab =
  | "all"
  | "stickers"
  | "templates"
  | "widgets"
  | "plugins"
  | "more";

const canvasShapeOptions: readonly CanvasShapeOption[] = [
  {
    id: "bent-connector",
    tool: "arrow",
    label: "Bent connector",
    group: "Connectors",
    icon: figjamBentConnectorIcon,
    arrowType: "elbow",
    roundness: "sharp",
  },
  {
    id: "curved-connector",
    tool: "arrow",
    label: "Curved connector",
    group: "Connectors",
    icon: figjamCurvedConnectorIcon,
    arrowType: "round",
    roundness: "round",
  },
  {
    id: "connector",
    tool: "arrow",
    label: "Arrow",
    group: "Connectors",
    icon: figjamConnectorIcon,
    arrowType: "sharp",
    roundness: "sharp",
  },
  {
    id: "line",
    tool: "line",
    label: "Connector, no endpoints",
    group: "Connectors",
    icon: figjamConnectorNoEndpointsIcon,
    roundness: "sharp",
  },
  {
    id: "rectangle",
    tool: "rectangle",
    label: "Rectangle",
    group: "Basic",
    icon: figjamSquareIcon,
    glyphFill: "rectangle",
    roundness: "sharp",
  },
  {
    id: "ellipse",
    tool: "ellipse",
    label: "Circle",
    group: "Basic",
    icon: figjamEllipseIcon,
    glyphFill: "ellipse",
    roundness: "round",
  },
  {
    id: "diamond",
    tool: "diamond",
    label: "Diamond",
    group: "Basic",
    icon: figjamDiamondIcon,
    roundness: "sharp",
  },
  {
    id: "triangle",
    customShape: "triangle",
    label: "Triangle",
    group: "Basic",
    icon: figjamTriangleIcon,
  },
  {
    id: "down-triangle",
    customShape: "down-triangle",
    label: "Down triangle",
    group: "Basic",
    icon: figjamDownTriangleIcon,
  },
  {
    id: "rounded-rectangle",
    tool: "rectangle",
    label: "Rounded rectangle",
    group: "Basic",
    icon: figjamRoundedRectangleIcon,
    glyphFill: "rounded-rectangle",
    roundness: "round",
  },
  {
    id: "cylinder",
    customShape: "cylinder",
    label: "Cylinder",
    group: "Basic",
    icon: figjamCylinderIcon,
  },
  {
    id: "mind-map",
    customShape: "mind-map",
    label: "Mind map",
    group: "Connectors",
    icon: figjamMindMapIcon,
  },
];

const canvasShapePreviewOptions = {
  rectangle: canvasShapeOptions[4],
  connector: canvasShapeOptions[2],
  ellipse: canvasShapeOptions[5],
} as const;

/* The catalog opens screens and flows, so its FigJam-style collage uses real
   product app icons rather than an abstract SVG. These are stored catalog
   assets, served from the same origin as the canvas. */
const canvasCatalogAppIcons = [
  {
    id: "snapchat",
    app: "Snapchat",
    src: "/assets/icons/333964/36c1273d578ac87b2ddedc30d977f5645e74fd9287a754168c736b0c4e72abc7.webp",
  },
  {
    id: "messenger",
    app: "Messenger",
    src: "/assets/icons/846658/612216f6541903a31c1635a32ad1af65899ddb7f274d2af448fdf0b8bae21417.webp",
  },
  {
    id: "claude",
    app: "Claude",
    src: "/assets/icons/118663/4c9974274cc611500dcc274bbf5ba78080a9af038548b02439f4def68833e0f4.webp",
  },
] as const;

/* FigJam's Marker palette, kept as named source colours so the custom strip
   remains a direct control for Excalidraw's free-draw tool. */
const canvasFigJamYellow = "#ffee00";

const canvasMarkerColors: readonly CanvasMarkerColor[] = [
  { label: "Black", value: "#1e1e1e" },
  { label: "Red", value: "#f24822" },
  { label: "Orange", value: "#ff9e0d" },
  { label: "Yellow", value: canvasFigJamYellow },
  { label: "Green", value: "#14ae5c" },
  { label: "Blue", value: "#0d99ff" },
  { label: "Violet", value: "#9747ff" },
  { label: "White", value: "#ffffff" },
];

/* FigJam's exact Section palette, measured from the live color selector. */
const canvasSectionColors: readonly CanvasMarkerColor[] = [
  { label: "Black", value: "#1e1e1e" },
  { label: "Dark gray", value: "#757575" },
  { label: "Red", value: "#f24822" },
  { label: "Orange", value: "#ff9e42" },
  { label: "Yellow", value: "#ffc943" },
  { label: "Green", value: "#66d575" },
  { label: "Teal", value: "#5ad8cc" },
  { label: "Blue", value: "#3dadff" },
  { label: "Violet", value: "#874fff" },
  { label: "Pink", value: "#f849c1" },
  { label: "White", value: defaultSectionFill },
  { label: "Gray", value: "#b3b3b3" },
  { label: "Light gray", value: "#d9d9d9" },
  { label: "Light red", value: "#ffc7c2" },
  { label: "Light orange", value: "#ffe0c2" },
  { label: "Light yellow", value: "#ffecbd" },
  { label: "Light green", value: "#cdf4d3" },
  { label: "Light teal", value: "#c6faf6" },
  { label: "Light blue", value: "#c2e5ff" },
  { label: "Light violet", value: "#dcccff" },
  { label: "Light pink", value: "#ffc2ec" },
];

/* Shapes use FigJam's complete 21-color palette. White is the default fill,
   while the array retains FigJam's visual order inside the picker. */
const canvasShapeColors = canvasSectionColors;

function canvasTableTextColor(fill: string): string {
  const value = fill.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 < 142
    ? "#ffffff"
    : "#1e1e1e";
}

const canvasTableColors: readonly ProjectStickyNoteColor[] =
  canvasSectionColors.map(({ label, value }) => ({
    id: `table-${label.toLowerCase().replaceAll(" ", "-")}`,
    name: label.toLowerCase(),
    fill: value,
    stroke: "#d9d9d9",
    text: canvasTableTextColor(value),
  }));

type CanvasSectionLineStyle = "solid" | "dashed" | "none";

/* The object toolbar uses the same exact source colours as the Canvas tools,
   so a text object's swatch and its rendered ink never drift apart. */
const canvasTextColors: readonly ProjectStickyNoteColor[] =
  canvasMarkerColors.map(({ label, value }) => ({
    id: `text-${label.toLowerCase()}`,
    name: label.toLowerCase(),
    fill: value,
    stroke: value,
    text: value,
  }));

const canvasHighlighterColors: readonly CanvasMarkerColor[] = [
  { label: "Gray", value: "#979797" },
  { label: "Pink", value: "#ff99f8" },
  { label: "Peach", value: "#ffae4f" },
  { label: "Yellow", value: canvasFigJamYellow },
  { label: "Lime", value: "#86fa16" },
  { label: "Aqua", value: "#6ffff6" },
  { label: "Lavender", value: "#b38fff" },
  { label: "White", value: "#ffffff" },
];

const canvasHighlighterToolbarColors: readonly ProjectStickyNoteColor[] =
  canvasHighlighterColors.map(({ label, value }) => ({
    id: `highlighter-${label.toLowerCase()}`,
    name: label.toLowerCase(),
    fill: value,
    stroke: value,
    text: value,
  }));

function canvasMarkerStrokeWidth(
  mode: CanvasMarkerMode,
  weight: CanvasMarkerStrokeWeight,
): number {
  if (mode === "highlighter") return weight === "thin" ? 8 : 16;
  if (mode === "washi") return weight === "thin" ? 12 : 20;
  return weight === "thin" ? 2 : 4;
}

function canvasMarkerOpacity(mode: CanvasMarkerMode): number {
  // The toolbar previews show the selected swatch at full strength. Keep the
  // rendered stroke fully opaque too, so a chosen color is identical in the
  // tool, swatch, and on-canvas mark.
  if (mode === "highlighter") return 100;
  if (mode === "washi") return 70;
  return 100;
}

function canvasFreeLineMode(
  strokeWidth: number,
  opacity: number,
): Exclude<CanvasMarkerMode, "eraser"> {
  if (opacity < 100) return "washi";
  if (strokeWidth === 8 || strokeWidth === 16) return "highlighter";
  return "marker";
}

function canvasFreeLineWeight(
  mode: Exclude<CanvasMarkerMode, "eraser">,
  strokeWidth: number,
): CanvasMarkerStrokeWeight {
  return strokeWidth > canvasMarkerStrokeWidth(mode, "thin") ? "thick" : "thin";
}

function coloredFigJamFreehandToolIcon(
  mode: CanvasMarkerMode,
  color: string,
): string {
  if (mode === "eraser") return eraserToolIcon;
  const source =
    mode === "highlighter"
      ? highlighterToolIconSource.replaceAll("rgba(255, 238, 0, 1)", color)
      : markerToolIconSource.replace("rgba(30, 30, 30, 1)", color);
  // Figma's copied highlighter omits the namespace because it lives inside an
  // HTML document. Add it before using the fragment as a standalone SVG image.
  const standaloneSource = source.includes('xmlns="http://www.w3.org/2000/svg"')
    ? source
    : source.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  return `data:image/svg+xml,${encodeURIComponent(standaloneSource)}`;
}

interface CanvasWidgetsLauncherItem {
  id: string;
  title: string;
  description: string;
  category: Exclude<CanvasWidgetsTab, "all" | "plugins">;
  tool: ProjectCanvasTool | "stamp";
}

const canvasWidgetsTabs: readonly {
  id: CanvasWidgetsTab;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "stickers", label: "Stickers" },
  { id: "templates", label: "Templates" },
  { id: "widgets", label: "Widgets" },
  { id: "plugins", label: "Plugins" },
  { id: "more", label: "More" },
];

const canvasWidgetsLauncherItems: readonly CanvasWidgetsLauncherItem[] = [
  {
    id: "stamps",
    title: "Quick stamps",
    description: "React with FigJam-style stamps.",
    category: "stickers",
    tool: "stamp",
  },
  {
    id: "templates",
    title: "Designer templates",
    description: "Start a reusable research or decision layout.",
    category: "templates",
    tool: "templates",
  },
  {
    id: "research-frames",
    title: "Research frames",
    description: "Group evidence, ideas, and decisions.",
    category: "widgets",
    tool: "research-frames",
  },
  {
    id: "comments",
    title: "Comments",
    description: "Place a discussion anywhere on the board.",
    category: "widgets",
    tool: "comments",
  },
  {
    id: "catalog",
    title: "Catalog",
    description: "Browse Screens and Flows for this canvas.",
    category: "more",
    tool: "screens",
  },
  {
    id: "document",
    title: "Document",
    description: "Add a structured working document.",
    category: "more",
    tool: "document",
  },
];

const canvasWidgetsLauncherGroups = [
  {
    id: "brainstorm",
    title: "Brainstorm together",
    description: "Find inspiration, organize ideas, and react together.",
    itemIds: ["stamps", "templates", "research-frames"],
  },
  {
    id: "work-together",
    title: "Work together",
    description: "Discuss references and turn research into clear direction.",
    itemIds: ["comments", "catalog", "document"],
  },
] as const;

const projectCanvasToolIcons: Record<
  Exclude<ProjectCanvasTool, "sticky" | "comments">,
  IconName
> = {
  "research-frames": "viewColumns",
  screens: "viewColumns",
  document: "copy",
  templates: "checkDouble",
  more: "moreHorizontal",
};

function ProjectCanvasToolGlyph({
  tool,
  stickyColor,
}: {
  tool: ProjectCanvasTool;
  stickyColor?: ProjectStickyNoteColor;
}) {
  if (tool === "sticky") {
    return <StickyNotesCollageGlyph color={stickyColor} />;
  }
  if (tool === "comments") return <ProjectCanvasCommentGlyph />;
  return <Icon icon={projectCanvasToolIcons[tool]} size="sm" />;
}

function CanvasShapeGlyph({
  icon,
  color,
  className,
  fill,
}: {
  icon: string;
  color?: string;
  className?: string;
  fill?: CanvasShapeOption["glyphFill"];
}) {
  return (
    <span
      className={`project-canvas-shape-glyph${fill ? ` project-canvas-shape-glyph--filled project-canvas-shape-glyph--fill-${fill}` : ""}${className ? ` ${className}` : ""}`}
      style={
        {
          "--project-canvas-shape-icon": `url("${icon}")`,
          "--project-canvas-shape-icon-color": color ?? "#1e1e1e",
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}

function CanvasShapesCollageGlyph({ color }: { color: string }) {
  return (
    <span className="project-canvas-shapes-collage" aria-hidden="true">
      <ShapeLibraryGlyph
        shape={canvasShapePreviewOptions.rectangle}
        color={color}
        className="project-canvas-shapes-collage__rectangle"
      />
      <CanvasShapeGlyph
        icon={canvasShapePreviewOptions.connector.icon}
        color={color}
        className="project-canvas-shapes-collage__connector"
      />
      <ShapeLibraryGlyph
        shape={canvasShapePreviewOptions.ellipse}
        color={color}
        className="project-canvas-shapes-collage__ellipse"
      />
    </span>
  );
}

function CanvasCatalogAppsCollageGlyph() {
  return (
    <span className="project-canvas-catalog-apps-collage" aria-hidden="true">
      {canvasCatalogAppIcons.map((app) => (
        <img
          key={app.id}
          className={`project-canvas-catalog-apps-collage__${app.id}`}
          src={app.src}
          alt=""
        />
      ))}
    </span>
  );
}

function ShapeLibraryGlyph({
  shape,
  color,
  className,
}: {
  shape: CanvasShapeOption;
  color?: string;
  className?: string;
}) {
  if (color) {
    return (
      <span
        className={`project-canvas-shape-source-icon project-canvas-shape-source-icon--colored${className ? ` ${className}` : ""}`}
        style={
          {
            "--project-canvas-shape-source": `url("${shape.icon}")`,
            "--project-canvas-shape-source-color": color,
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <img src={shape.icon} alt="" />
      </span>
    );
  }
  return (
    <img
      src={shape.icon}
      alt=""
      className={`project-canvas-shape-source-icon${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    />
  );
}

function createCanvasCustomShapeElements({
  shape,
  x,
  y,
  color,
  width,
  height,
}: {
  shape: CanvasShapeOption;
  x: number;
  y: number;
  color: string;
  width?: number;
  height?: number;
}): ExcalidrawElement[] {
  const common = {
    strokeColor: color,
    strokeWidth: 2,
    roughness: 0,
  } as const;
  const shapeWidth = Math.max(80, width ?? 160);
  const shapeHeight = Math.max(60, height ?? 120);
  const left = x - shapeWidth / 2;
  const top = y - shapeHeight / 2;

  switch (shape.customShape) {
    case "triangle":
      return convertToExcalidrawElements([
        {
          type: "line",
          x: left,
          y: top,
          points: [
            [0, shapeHeight],
            [shapeWidth / 2, 0],
            [shapeWidth, shapeHeight],
            [0, shapeHeight],
          ],
          ...common,
        } as ElementSkeleton,
      ]) as ExcalidrawElement[];
    case "down-triangle":
      return convertToExcalidrawElements([
        {
          type: "line",
          x: left,
          y: top,
          points: [
            [0, 0],
            [shapeWidth, 0],
            [shapeWidth / 2, shapeHeight],
            [0, 0],
          ],
          ...common,
        } as ElementSkeleton,
      ]) as ExcalidrawElement[];
    case "cylinder": {
      const capHeight = Math.max(20, Math.min(48, shapeHeight * 0.27));
      return convertToExcalidrawElements([
        {
          type: "rectangle",
          x: left,
          y: top + capHeight / 2,
          width: shapeWidth,
          height: shapeHeight - capHeight,
          backgroundColor: "transparent",
          fillStyle: "solid",
          ...common,
        } as ElementSkeleton,
        {
          type: "ellipse",
          x: left,
          y: top,
          width: shapeWidth,
          height: capHeight,
          backgroundColor: "#ffffff",
          fillStyle: "solid",
          ...common,
        } as ElementSkeleton,
        {
          type: "ellipse",
          x: left,
          y: top + shapeHeight - capHeight,
          width: shapeWidth,
          height: capHeight,
          backgroundColor: "transparent",
          fillStyle: "solid",
          ...common,
        } as ElementSkeleton,
      ]) as ExcalidrawElement[];
    }
    case "mind-map":
      return convertToExcalidrawElements([
        {
          type: "ellipse",
          x: x - 48,
          y: y - 32,
          width: 96,
          height: 64,
          backgroundColor: "transparent",
          fillStyle: "solid",
          ...common,
        } as ElementSkeleton,
        {
          type: "arrow",
          x,
          y,
          points: [
            [44, -16],
            [144, -72],
          ],
          ...common,
        } as ElementSkeleton,
        {
          type: "arrow",
          x,
          y,
          points: [
            [48, 0],
            [156, 0],
          ],
          ...common,
        } as ElementSkeleton,
        {
          type: "arrow",
          x,
          y,
          points: [
            [44, 16],
            [144, 72],
          ],
          ...common,
        } as ElementSkeleton,
      ]) as ExcalidrawElement[];
    default:
      return [];
  }
}

function createCanvasTableCells({
  left,
  top,
  rows,
  columns,
  tableId,
  groupId,
  startRow = 0,
  startColumn = 0,
  cellWidth = 160,
  cellHeight = 54,
  color = canvasTableColors[10],
  format = defaultProjectStickyNoteFormat,
}: {
  left: number;
  top: number;
  rows: number;
  columns: number;
  tableId: string;
  groupId: string;
  startRow?: number;
  startColumn?: number;
  cellWidth?: number;
  cellHeight?: number;
  color?: ProjectStickyNoteColor;
  format?: ProjectStickyNoteFormat;
}): ExcalidrawElement[] {
  return convertToExcalidrawElements(
    Array.from({ length: rows * columns }, (_, index) => {
      const row = startRow + Math.floor(index / columns);
      const column = startColumn + (index % columns);
      return {
        type: "rectangle",
        x: left + (column - startColumn) * cellWidth,
        y: top + (row - startRow) * cellHeight,
        width: cellWidth,
        height: cellHeight,
        strokeColor: color.stroke,
        backgroundColor: color.fill,
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        roundness: null,
        groupIds: [groupId],
        customData: {
          astryxReference: {
            kind: "table-cell",
            tableId,
            groupId,
            row,
            column,
            rowSpan: 1,
            columnSpan: 1,
            color: color.id,
            format,
          },
        },
      } as ElementSkeleton;
    }),
  ) as ExcalidrawElement[];
}

function createCanvasTableElements({
  x,
  y,
  rows = 2,
  columns = 2,
}: {
  x: number;
  y: number;
  rows?: number;
  columns?: number;
}): ExcalidrawElement[] {
  const cellWidth = 160;
  const cellHeight = 54;
  const tableId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const left = x - (columns * cellWidth) / 2;
  const top = y - (rows * cellHeight) / 2;

  return createCanvasTableCells({
    left,
    top,
    rows,
    columns,
    tableId,
    groupId,
  });
}

function createCanvasStampElement({
  x,
  y,
  fileId,
  stamp,
}: {
  x: number;
  y: number;
  fileId: FileId;
  stamp: CanvasStampOption;
}): ExcalidrawElement {
  const size = 40;
  const [image] = convertToExcalidrawElements([
    {
      type: "image",
      x: x - size / 2,
      y: y - size / 2,
      width: size,
      height: size,
      fileId,
      status: "saved",
      customData: {
        astryxReference: {
          kind: "stamp",
          stampId: stamp.id,
          label: stamp.label,
        },
      },
    } as ElementSkeleton,
  ]);
  return image as ExcalidrawElement;
}

function createCanvasProfileStampElements({
  x,
  y,
  userName,
}: {
  x: number;
  y: number;
  userName: string;
}): ExcalidrawElement[] {
  const size = 40;
  const color = canvasCollaboratorColor(userName).background;
  return convertToExcalidrawElements([
    {
      type: "ellipse",
      x: x - size / 2,
      y: y - size / 2,
      width: size,
      height: size,
      strokeColor: "#ffffff",
      backgroundColor: color,
      fillStyle: "solid",
      strokeWidth: 3,
      roughness: 0,
      label: {
        text: canvasCollaboratorInitials(userName).slice(0, 1),
        fontSize: 16,
        fontFamily: 2,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#ffffff",
      },
      customData: {
        astryxReference: {
          kind: "stamp",
          stampId: "profile",
          label: "Profile",
        },
      },
    } as ElementSkeleton,
  ]) as ExcalidrawElement[];
}

function createStickyNoteElements({
  x,
  y,
  color,
  text,
  format = defaultProjectStickyNoteFormat,
  collaboration = defaultProjectStickyNoteCollaboration(),
}: {
  x: number;
  y: number;
  color: ProjectStickyNoteColor;
  text: string;
  format?: ProjectStickyNoteFormat;
  collaboration?: ProjectStickyNoteCollaboration;
}): ExcalidrawElement[] {
  const noteId = crypto.randomUUID();
  const normalizedFormat = {
    ...normalizeProjectStickyNoteFormat(format),
    textAlign: "left" as const,
  };
  const elements = convertToExcalidrawElements([
    {
      type: "rectangle",
      x: x - stickyNoteSize / 2,
      y: y - stickyNoteSize / 2,
      width: stickyNoteSize,
      height: stickyNoteSize,
      strokeColor: color.stroke,
      backgroundColor: color.fill,
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      link: normalizedFormat.link || null,
      locked: normalizedFormat.locked,
      label: {
        text,
        fontSize: normalizedFormat.fontSize,
        fontFamily: projectStickyNoteFontFamilies[normalizedFormat.font],
        textAlign: "left",
        verticalAlign: "top",
        strokeColor: color.text,
      },
      customData: {
        astryxReference: {
          kind: "sticky-note",
          noteId,
          color: color.id,
          format: normalizedFormat,
          collaboration,
          createdAt: new Date().toISOString(),
        },
      },
    } as ElementSkeleton,
  ]) as ExcalidrawElement[];
  const container = elements.find((element) => element.type === "rectangle");
  const boundText = elements.find((element) => element.type === "text");
  if (!container || !boundText || boundText.type !== "text") return elements;
  const position = stickyNoteBoundTextPosition(container, {
    ...boundText,
    textAlign: "left",
  });
  return elements.map((element) =>
    element.id === boundText.id
      ? withCanvasElementUpdate(element, {
          ...position,
          textAlign: "left",
        } as Partial<ExcalidrawElement>)
      : element,
  );
}

function stickyNoteTextDimensionsForContainer(
  container: Pick<ExcalidrawElement, "width" | "height">,
  textElement: ExcalidrawTextElement,
  text: string,
) {
  // The public converter is also what constructs a bound label initially. Use
  // it to remeasure edited text without reaching into Excalidraw internals.
  const elements = convertToExcalidrawElements([
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: container.width,
      height: container.height,
      label: {
        text,
        fontSize: textElement.fontSize,
        fontFamily: textElement.fontFamily,
        textAlign: "left",
        verticalAlign: "top",
        strokeColor: textElement.strokeColor,
      },
    } as ElementSkeleton,
  ]) as ExcalidrawElement[];
  const measuredText = elements.find((element) => element.type === "text");
  return measuredText?.type === "text"
    ? {
        text: measuredText.text,
        width: measuredText.width,
        height: measuredText.height,
      }
    : { text, width: textElement.width, height: textElement.height };
}

function stickyNoteContainerForBoundText(
  container: ExcalidrawElement,
  textHeight: number,
) {
  /* Match Excalidraw's rectangle-label rule: its bound text has a 5px inset
   * on each edge, and the rectangle grows rather than clipping a taller
   * label. */
  const minimumHeight = textHeight + stickyNoteTextVerticalInset * 2;
  return minimumHeight > container.height
    ? withCanvasElementUpdate(container, { height: minimumHeight })
    : container;
}

interface AstryxStickyNoteReference {
  elementId: string;
  textElementId?: string;
  noteId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: ProjectStickyNoteColor;
  format: ProjectStickyNoteFormat;
  collaboration: ProjectStickyNoteCollaboration;
}

interface CanvasTextReference {
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: ProjectStickyNoteColor;
  format: ProjectStickyNoteFormat;
}

interface CanvasTableCellReference {
  elementId: string;
  textElementId?: string;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: ProjectStickyNoteColor;
  format: ProjectStickyNoteFormat;
}

interface CanvasTableReference {
  tableId: string;
  groupId: string;
  cells: readonly CanvasTableCellReference[];
  selectedCellIds: readonly string[];
  rows: number;
  columns: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: ProjectStickyNoteColor;
  format: ProjectStickyNoteFormat;
}

function canvasTableCellMetadata(element: ExcalidrawElement) {
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as
    | Record<string, unknown>
    | undefined;
  if (
    element.isDeleted ||
    element.type !== "rectangle" ||
    reference?.kind !== "table-cell" ||
    typeof reference.tableId !== "string" ||
    typeof reference.row !== "number" ||
    typeof reference.column !== "number"
  )
    return undefined;
  return {
    tableId: reference.tableId,
    groupId:
      typeof reference.groupId === "string"
        ? reference.groupId
        : (element.groupIds[0] ?? reference.tableId),
    row: reference.row,
    column: reference.column,
    rowSpan:
      typeof reference.rowSpan === "number" && reference.rowSpan > 0
        ? reference.rowSpan
        : 1,
    columnSpan:
      typeof reference.columnSpan === "number" && reference.columnSpan > 0
        ? reference.columnSpan
        : 1,
    colorId: typeof reference.color === "string" ? reference.color : undefined,
    format: reference.format as Partial<ProjectStickyNoteFormat> | undefined,
  };
}

function canvasTableReferenceForSelection(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): CanvasTableReference | undefined {
  const selectedIds = new Set(Object.keys(appState.selectedElementIds));
  if (appState.editingTextElement)
    selectedIds.add(appState.editingTextElement.id);
  const selectedTableIds = new Set<string>();
  const selectedCellIds = new Set<string>();

  for (const element of elements) {
    if (element.isDeleted || !selectedIds.has(element.id)) continue;
    const direct = canvasTableCellMetadata(element);
    if (direct) {
      selectedTableIds.add(direct.tableId);
      selectedCellIds.add(element.id);
      continue;
    }
    const containerId = (element as { containerId?: string | null })
      .containerId;
    if (!containerId) continue;
    const container = elements.find(
      (candidate) => candidate.id === containerId,
    );
    if (!container) continue;
    const metadata = canvasTableCellMetadata(container);
    if (metadata) {
      selectedTableIds.add(metadata.tableId);
      selectedCellIds.add(container.id);
    }
  }
  if (selectedTableIds.size !== 1) return undefined;
  return canvasTableReferenceForTableId(elements, [...selectedTableIds][0], [
    ...selectedCellIds,
  ]);
}

function canvasTableReferenceForTableId(
  elements: readonly ExcalidrawElement[],
  tableId: string,
  selectedCellIds: readonly string[],
): CanvasTableReference | undefined {
  const selectedCellIdSet = new Set(selectedCellIds);
  const tableCells = elements.flatMap((element) => {
    const metadata = canvasTableCellMetadata(element);
    if (!metadata || metadata.tableId !== tableId) return [];
    return [
      {
        element,
        metadata,
        textElementId: element.boundElements?.find(
          (bound) => bound.type === "text",
        )?.id,
      },
    ];
  });
  if (tableCells.length === 0) return undefined;
  const x = Math.min(...tableCells.map(({ element }) => element.x));
  const y = Math.min(...tableCells.map(({ element }) => element.y));
  const right = Math.max(
    ...tableCells.map(({ element }) => element.x + element.width),
  );
  const bottom = Math.max(
    ...tableCells.map(({ element }) => element.y + element.height),
  );
  const first = tableCells[0];
  const tableCellReference = ({
    element,
    metadata,
    textElementId,
  }: (typeof tableCells)[number]): CanvasTableCellReference => ({
    elementId: element.id,
    textElementId,
    row: metadata.row,
    column: metadata.column,
    rowSpan: metadata.rowSpan,
    columnSpan: metadata.columnSpan,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    color: canvasTableColors.find(
      (option) => option.id === metadata.colorId,
    ) ?? {
      ...canvasTableColors[10],
      fill: element.backgroundColor,
      text: canvasTableTextColor(element.backgroundColor),
    },
    format: {
      ...defaultProjectStickyNoteFormat,
      ...metadata.format,
    },
  });
  const cells = tableCells.map(tableCellReference);
  const firstSelectedCell =
    cells.find((cell) => selectedCellIdSet.has(cell.elementId)) ?? cells[0];
  return {
    tableId,
    groupId: first.metadata.groupId,
    cells,
    selectedCellIds: [...selectedCellIdSet],
    rows: Math.max(
      ...tableCells.map(({ metadata }) => metadata.row + metadata.rowSpan),
    ),
    columns: Math.max(
      ...tableCells.map(
        ({ metadata }) => metadata.column + metadata.columnSpan,
      ),
    ),
    x,
    y,
    width: right - x,
    height: bottom - y,
    color: firstSelectedCell.color,
    format: firstSelectedCell.format,
  };
}

function canvasTableWithSelectedCells(
  table: CanvasTableReference,
  cellIds: readonly string[],
): CanvasTableReference {
  const validCellIds = [...new Set(cellIds)].filter((id) =>
    table.cells.some((cell) => cell.elementId === id),
  );
  const firstSelectedCell = table.cells.find((cell) =>
    validCellIds.includes(cell.elementId),
  );
  return {
    ...table,
    selectedCellIds: validCellIds,
    color: firstSelectedCell?.color ?? table.color,
    format: firstSelectedCell?.format ?? table.format,
  };
}

function canvasTableCellAtScenePoint(
  table: CanvasTableReference,
  sceneX: number,
  sceneY: number,
): CanvasTableCellReference | undefined {
  return table.cells.find(
    (cell) =>
      sceneX >= cell.x &&
      sceneX <= cell.x + cell.width &&
      sceneY >= cell.y &&
      sceneY <= cell.y + cell.height,
  );
}

function canvasTableReferencesEqual(
  left?: CanvasTableReference,
  right?: CanvasTableReference,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canvasTextWithBulletedList(text: string, enabled: boolean): string {
  return text
    .split("\n")
    .map((line) => {
      const plainLine = line.replace(/^\s*•\s?/, "");
      if (!enabled || !plainLine) return plainLine;
      return `• ${plainLine}`;
    })
    .join("\n");
}

function canvasTextReferenceForElement(
  element: ExcalidrawElement,
): CanvasTextReference | undefined {
  if (element.isDeleted || element.type !== "text") return undefined;
  const color = canvasTextColors.find(
    (option) => option.text === element.strokeColor,
  ) ?? {
    ...canvasTextColors[0],
    fill: element.strokeColor,
    stroke: element.strokeColor,
    text: element.strokeColor,
  };
  const savedFormat = element.customData?.astryxTextFormat as
    | Partial<ProjectStickyNoteFormat>
    | undefined;
  return {
    elementId: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    text: element.text,
    color,
    format: {
      font: projectStickyNoteFontForFamily(element.fontFamily),
      fontSize: element.fontSize,
      textAlign:
        element.textAlign === "center" || element.textAlign === "right"
          ? element.textAlign
          : "left",
      bold: savedFormat?.bold === true,
      strikethrough: savedFormat?.strikethrough === true,
      bulletedList: savedFormat?.bulletedList === true,
      link: element.link ?? "",
      locked: element.locked,
    },
  };
}

function canvasTextReferencesEqual(
  left?: CanvasTextReference,
  right?: CanvasTextReference,
): boolean {
  return (
    left?.elementId === right?.elementId &&
    left?.x === right?.x &&
    left?.y === right?.y &&
    left?.width === right?.width &&
    left?.height === right?.height &&
    left?.text === right?.text &&
    left?.color.text === right?.color.text &&
    left?.format.font === right?.format.font &&
    left?.format.fontSize === right?.format.fontSize &&
    left?.format.textAlign === right?.format.textAlign &&
    left?.format.bold === right?.format.bold &&
    left?.format.strikethrough === right?.format.strikethrough &&
    left?.format.bulletedList === right?.format.bulletedList &&
    left?.format.link === right?.format.link &&
    left?.format.locked === right?.format.locked
  );
}

function canvasTextReferenceListsEqual(
  left: readonly CanvasTextReference[],
  right: readonly CanvasTextReference[],
) {
  return (
    left.length === right.length &&
    left.every((reference, index) =>
      canvasTextReferencesEqual(reference, right[index]),
    )
  );
}

function stickyNoteReferenceForElement(
  element: ExcalidrawElement,
  sceneElements?: readonly ExcalidrawElement[],
): AstryxStickyNoteReference | undefined {
  if (element.isDeleted || element.type !== "rectangle") return undefined;
  const reference = element.customData?.astryxReference as
    | {
        kind?: string;
        noteId?: string;
        color?: string;
        format?: Partial<ProjectStickyNoteFormat>;
        collaboration?: Partial<ProjectStickyNoteCollaboration>;
      }
    | undefined;
  if (reference?.kind !== "sticky-note" || !reference.noteId) return undefined;
  const paletteColor =
    projectStickyNoteColors.find((option) => option.id === reference.color) ??
    defaultProjectStickyNoteColor;
  // The element is the source of truth for a saved note. Palette IDs evolved
  // with the FigJam-style picker, but an existing note must keep the exact
  // fill and border the person chose when it was inserted.
  const color = {
    ...paletteColor,
    fill: element.backgroundColor || paletteColor.fill,
    stroke: element.strokeColor || paletteColor.stroke,
  };
  const textElementId =
    element.boundElements?.find((bound) => bound.type === "text")?.id ??
    sceneElements?.find(
      (candidate) =>
        candidate.type === "text" &&
        (candidate as { containerId?: string | null }).containerId ===
          element.id,
    )?.id ??
    sceneElements?.find(
      (candidate) =>
        candidate.type === "text" &&
        candidate.x >= element.x &&
        candidate.y >= element.y &&
        candidate.x + candidate.width <= element.x + element.width &&
        candidate.y + candidate.height <= element.y + element.height,
    )?.id;
  const textElement = sceneElements?.find(
    (candidate) => candidate.id === textElementId && candidate.type === "text",
  );
  return {
    elementId: element.id,
    textElementId,
    noteId: reference.noteId,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    text: textElement?.type === "text" ? textElement.text : "",
    color,
    format: {
      ...normalizeProjectStickyNoteFormat(reference.format),
      // Alignment is a text-tool capability. FigJam Sticky Notes always
      // begin at the top-left, so existing notes migrate to that behavior.
      textAlign: "left",
    },
    collaboration: normalizeProjectStickyNoteCollaboration(
      reference.collaboration,
    ),
  };
}

function stickyNoteReferenceForTextElement(
  element: ExcalidrawElement,
  sceneElements: readonly ExcalidrawElement[],
): AstryxStickyNoteReference | undefined {
  if (element.type !== "text") return undefined;
  return sceneElements
    .map((candidate) => stickyNoteReferenceForElement(candidate, sceneElements))
    .find(
      (note): note is AstryxStickyNoteReference =>
        Boolean(note) &&
        element.x >= note.x &&
        element.y >= note.y &&
        element.x + element.width <= note.x + note.width &&
        element.y + element.height <= note.y + note.height,
    );
}

function stickyNoteReferencesEqual(
  left?: AstryxStickyNoteReference,
  right?: AstryxStickyNoteReference,
): boolean {
  return (
    left?.elementId === right?.elementId &&
    left?.textElementId === right?.textElementId &&
    left?.x === right?.x &&
    left?.y === right?.y &&
    left?.width === right?.width &&
    left?.height === right?.height &&
    left?.text === right?.text &&
    left?.color.id === right?.color.id &&
    left?.color.fill === right?.color.fill &&
    left?.color.stroke === right?.color.stroke &&
    left?.color.text === right?.color.text &&
    left?.format.font === right?.format.font &&
    left?.format.fontSize === right?.format.fontSize &&
    left?.format.textAlign === right?.format.textAlign &&
    left?.format.bold === right?.format.bold &&
    left?.format.strikethrough === right?.format.strikethrough &&
    left?.format.bulletedList === right?.format.bulletedList &&
    left?.format.link === right?.format.link &&
    left?.format.locked === right?.format.locked &&
    JSON.stringify(left?.collaboration) === JSON.stringify(right?.collaboration)
  );
}

function stickyNoteReferenceListsEqual(
  left: readonly AstryxStickyNoteReference[],
  right: readonly AstryxStickyNoteReference[],
): boolean {
  return (
    left.length === right.length &&
    left.every((reference, index) =>
      stickyNoteReferencesEqual(reference, right[index]),
    )
  );
}

interface AstryxCanvasDocumentReference extends ProjectCanvasDocumentData {
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AstryxResearchFrameReference extends ProjectResearchFrameItem {
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeStyle: CanvasSectionLineStyle;
  hidden: boolean;
  locked: boolean;
  backdropElementId?: string;
}

function sectionBackdropReference(
  element: ExcalidrawElement,
): { parentFrameId?: string } | undefined {
  const reference = element.customData?.astryxReference as
    | { kind?: string; parentFrameId?: string }
    | undefined;
  return reference?.kind === "section-backdrop" ? reference : undefined;
}

function createSectionBackdrop(
  frame: ExcalidrawElement,
  {
    fillColor = defaultSectionFill,
    hidden = false,
  }: { fillColor?: string; hidden?: boolean } = {},
): ExcalidrawElement {
  const [backdrop] = convertToExcalidrawElements([
    {
      type: "rectangle",
      x: frame.x,
      y: frame.y,
      width: Math.max(1, frame.width),
      height: Math.max(1, frame.height),
      strokeColor: hidden ? "#b3b3b3" : "transparent",
      backgroundColor: hidden ? "#757575" : fillColor,
      fillStyle: hidden ? "hachure" : "solid",
      roughness: 0,
      opacity: hidden ? 32 : 100,
      locked: true,
      frameId: frame.id,
      groupIds: [frame.id],
      customData: {
        astryxReference: {
          kind: "section-backdrop",
          parentFrameId: frame.id,
        },
      },
    } as ElementSkeleton,
  ]);
  return backdrop;
}

function researchFrameReferenceForElement(
  element: ExcalidrawElement,
  allElements: readonly ExcalidrawElement[],
): AstryxResearchFrameReference | undefined {
  if (element.isDeleted || element.type !== "frame") return undefined;
  const reference = element.customData?.astryxReference as
    | {
        kind?: string;
        frameType?: ProjectResearchFrameType;
        fillColor?: string;
        strokeColor?: string;
        strokeStyle?: CanvasSectionLineStyle;
        hidden?: boolean;
      }
    | undefined;
  const type =
    reference?.kind === "research-frame" && reference.frameType
      ? reference.frameType
      : "custom";
  const backdrop = allElements.find(
    (candidate) =>
      !candidate.isDeleted &&
      sectionBackdropReference(candidate)?.parentFrameId === element.id,
  );
  return {
    elementId: element.id,
    type,
    title: element.name?.trim() || "Untitled frame",
    itemCount: allElements.filter(
      (candidate) =>
        !candidate.isDeleted &&
        candidate.frameId === element.id &&
        candidate.type !== "text" &&
        !sectionBackdropReference(candidate),
    ).length,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    fillColor:
      reference?.fillColor ?? backdrop?.backgroundColor ?? defaultSectionFill,
    strokeColor:
      reference?.strokeColor ?? element.strokeColor ?? defaultSectionStroke,
    strokeStyle: reference?.strokeStyle ?? element.strokeStyle ?? "solid",
    hidden: reference?.hidden === true,
    locked: element.locked,
    backdropElementId: backdrop?.id,
  };
}

function researchFrameReferencesEqual(
  left: readonly AstryxResearchFrameReference[],
  right: readonly AstryxResearchFrameReference[],
): boolean {
  return (
    left.length === right.length &&
    left.every((frame, index) => {
      const other = right[index];
      return (
        frame.elementId === other?.elementId &&
        frame.type === other.type &&
        frame.title === other.title &&
        frame.itemCount === other.itemCount &&
        frame.x === other.x &&
        frame.y === other.y &&
        frame.width === other.width &&
        frame.height === other.height &&
        frame.fillColor === other.fillColor &&
        frame.strokeColor === other.strokeColor &&
        frame.strokeStyle === other.strokeStyle &&
        frame.hidden === other.hidden &&
        frame.locked === other.locked &&
        frame.backdropElementId === other.backdropElementId
      );
    })
  );
}

function canvasDocumentReferencesEqual(
  left: readonly AstryxCanvasDocumentReference[],
  right: readonly AstryxCanvasDocumentReference[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((document, index) => {
    const other = right[index];
    return (
      document.elementId === other?.elementId &&
      document.documentId === other.documentId &&
      document.title === other.title &&
      document.body === other.body &&
      document.templateId === other.templateId &&
      document.expanded === other.expanded &&
      document.x === other.x &&
      document.y === other.y &&
      document.width === other.width &&
      document.height === other.height
    );
  });
}

function canvasDocumentPreview(document: ProjectCanvasDocumentData): string {
  if (document.body.trim()) {
    const body = document.body.trim().slice(0, document.expanded ? 1_400 : 700);
    return `${document.title.trim() || "Untitled doc"}\n\n${body}`;
  }
  return [
    document.title.trim() || "Untitled doc",
    "",
    "Press / for options or start writing",
    "",
    "Choose a starting template",
    "Retrospective Summary",
    "Product Brief",
    "Research Synthesis",
    "Meeting Notes",
  ].join("\n");
}

function createCanvasDocumentElements({
  x,
  y,
  document,
}: {
  x: number;
  y: number;
  document: ProjectCanvasDocumentData;
}): ExcalidrawElement[] {
  const width = document.expanded
    ? expandedCanvasDocumentWidth
    : canvasDocumentWidth;
  const height = document.expanded
    ? expandedCanvasDocumentHeight
    : canvasDocumentHeight;
  return convertToExcalidrawElements([
    {
      type: "rectangle",
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
      strokeColor: "#d7dce3",
      backgroundColor: "#ffffff",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      label: {
        text: canvasDocumentPreview(document),
        fontSize: 16,
        fontFamily: 2,
        textAlign: "left",
        verticalAlign: "top",
        strokeColor: "#27364d",
      },
      customData: {
        astryxReference: {
          kind: "document",
          ...document,
        },
      },
    } as ElementSkeleton,
  ]) as ExcalidrawElement[];
}

export interface ExcalidrawProjectSnapshot {
  type: "excalidraw";
  version: number;
  source: string;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  comments: readonly DesignerCanvasCommentThread[];
}

type CanvasSaveState =
  | "loading"
  | "saving"
  | "saved"
  | "offline"
  | "unavailable";

interface AstryxScreenReference {
  elementId: string;
  appId: string;
  appName: string;
  screenId: number;
  screenType: string;
  platform: string;
}

type AstryxCanvasDataPayload =
  | {
      kind: "app";
      appId: string;
      appName: string;
      description: string;
      category: string;
      platform: Platform;
      totalScreens: number;
    }
  | {
      kind: "flow";
      appId: string;
      appName: string;
      flowId: string;
      flowTitle: string;
      category: string;
      description: string;
      platform: Platform;
      version: number;
      stepCount: number;
    };

type AstryxCanvasDataReference = AstryxCanvasDataPayload & {
  elementId: string;
};

/*
 * A catalog card as a group of real Excalidraw elements rather than one
 * rectangle with a multi-line label. The label approach centred everything and
 * gave no room for a thumbnail, so an app, a screen and a flow all looked the
 * same on the board.
 *
 * Every part shares a groupId, so the card moves, copies and deletes as one
 * object while staying editable — and the container keeps the astryxReference
 * so selection and "open source" keep working.
 */
interface CatalogCardImage {
  fileId: FileId;
  width: number;
  height: number;
}

const catalogCardLayout = {
  width: 420,
  padding: 20,
  mediaHeight: 210,
  gap: 14,
} as const;

/* A journey is easier to compare as a sequence of the actual screens than as
   one large metadata card. Keep the cells compact, but preserve each capture's
   aspect ratio and let the designer select or rearrange every step freely. */
const flowStoryboardLayout = {
  columns: 4,
  cellWidth: 300,
  cellHeight: 260,
  gap: 32,
  padding: 16,
} as const;

function truncateCardText(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function blobDataUrl(blob: Blob): Promise<DataURL> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result) as DataURL);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/* Stamps remain active for repeated placement, just as they do in FigJam. The
 * files themselves are static UI assets, so decode each one once and give each
 * placed element a fresh Excalidraw file id that reuses the cached data URL. */
const canvasStampAssetCache = new Map<
  string,
  Promise<Pick<BinaryFileData, "mimeType" | "dataURL">>
>();

async function cachedCanvasStampAsset(asset: string) {
  const cached = canvasStampAssetCache.get(asset);
  if (cached) return cached;
  const load = (async () => {
    const response = await fetch(asset);
    if (!response.ok)
      throw new Error(`Stamp asset returned ${response.status}`);
    const blob = await response.blob();
    return {
      mimeType: (blob.type || "image/png") as BinaryFileData["mimeType"],
      dataURL: await blobDataUrl(blob),
    };
  })();
  canvasStampAssetCache.set(asset, load);
  try {
    return await load;
  } catch (error) {
    if (canvasStampAssetCache.get(asset) === load)
      canvasStampAssetCache.delete(asset);
    throw error;
  }
}

const canvasAssetResolveTimeoutMs = 1_500;

async function resolvedCanvasImageBlob(
  source: string,
): Promise<Blob | undefined> {
  const response = await apiFetch(source, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(canvasAssetResolveTimeoutMs),
  });
  const blob = await response.blob();
  return response.ok && canvasMediaMimeTypeSet.has(blob.type)
    ? blob
    : undefined;
}

/*
 * Excalidraw's BinaryFileData needs decoded bytes, not an authenticated API
 * path. Resolve older persisted asset paths as well so pre-existing cards stop
 * showing its broken-image glyph after a reload.
 */
function screenMediaUrlsByFileId(
  elements: readonly ExcalidrawElement[],
): Map<string, string> {
  const mediaUrlByGroupId = new Map<string, string>();
  const mediaUrlByFileId = new Map<string, string>();
  for (const element of elements) {
    const reference = (
      element.customData as
        | { astryxReference?: { mediaUrl?: unknown } }
        | undefined
    )?.astryxReference;
    if (typeof reference?.mediaUrl !== "string") continue;
    if (element.type === "image" && element.fileId) {
      mediaUrlByFileId.set(element.fileId, reference.mediaUrl);
    }
    for (const groupId of element.groupIds ?? [])
      mediaUrlByGroupId.set(groupId, reference.mediaUrl);
  }
  for (const element of elements) {
    if (element.type !== "image" || !element.fileId) continue;
    const mediaUrl = (element.groupIds ?? [])
      .map((groupId) => mediaUrlByGroupId.get(groupId))
      .find((value): value is string => Boolean(value));
    if (mediaUrl && !mediaUrlByFileId.has(element.fileId))
      mediaUrlByFileId.set(element.fileId, mediaUrl);
  }
  return mediaUrlByFileId;
}

async function resolveCanvasAssetDataUrls(
  files: BinaryFiles,
  elements: readonly ExcalidrawElement[],
): Promise<BinaryFiles> {
  const screenMediaUrls = screenMediaUrlsByFileId(elements);
  const entries = await Promise.all(
    Object.entries(files).map(async ([id, file]) => {
      if (file.dataURL.startsWith("data:")) return [id, file] as const;
      try {
        const blob = await resolvedCanvasImageBlob(file.dataURL);
        if (blob) {
          return [id, { ...file, dataURL: await blobDataUrl(blob) }] as const;
        }
      } catch {
        // The asset might predate asset storage. Try the catalog media recorded
        // on its screen card before leaving the historical card unresolved.
      }
      const mediaUrl = screenMediaUrls.get(id);
      if (!mediaUrl) return [id, file] as const;
      try {
        const blob = await resolvedCanvasImageBlob(
          canvasMediaFetchUrl(mediaUrl),
        );
        if (!blob) return [id, file] as const;
        return [id, { ...file, dataURL: await blobDataUrl(blob) }] as const;
      } catch {
        return [id, file] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as BinaryFiles;
}

/*
 * Fetch a catalog image into an Excalidraw file. Returns undefined rather
 * than throwing: a card without its image is still a useful card, and a dead
 * media URL should not stop one being placed.
 */
async function loadCatalogCardImage(
  url: string | undefined,
  projectId: string,
): Promise<
  | {
      file: BinaryFileData;
      image: CatalogCardImage;
      stored: boolean;
      assetUrl?: string;
    }
  | undefined
> {
  if (!url) return undefined;
  try {
    const response = await apiFetch(canvasMediaFetchUrl(url), {
      credentials: "same-origin",
    });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    if (!canvasMediaMimeTypeSet.has(blob.type)) return undefined;
    const fileId = `asset:${crypto.randomUUID()}` as FileId;
    /* Store the asset for the project, but keep decoded bytes in the scene.
       Passing the authenticated asset path as `dataURL` is what produced the
       broken-image card: it is a URL, not a data URL Excalidraw can decode. */
    const dataURL = await blobDataUrl(blob);
    let assetUrl: string | undefined;
    try {
      assetUrl = await uploadProjectCanvasAsset(projectId, fileId, blob);
    } catch {
      // Keep the decoded bytes in the current editor even when persistence is
      // unavailable; the caller shows that local-only state clearly.
    }
    const dimensions = await imageDimensions(blob);
    return {
      file: {
        id: fileId,
        mimeType: blob.type as BinaryFileData["mimeType"],
        dataURL,
        created: Date.now(),
      },
      image: { fileId, width: dimensions.width, height: dimensions.height },
      stored: Boolean(assetUrl),
      assetUrl,
    };
  } catch {
    return undefined;
  }
}

function createCatalogCardElements({
  x,
  y,
  eyebrow,
  title,
  meta,
  accent,
  image,
  reference,
}: {
  x: number;
  y: number;
  eyebrow: string;
  title: string;
  meta: string;
  accent: { stroke: string; fill: string };
  image?: CatalogCardImage;
  reference: Record<string, unknown>;
}): ExcalidrawElement[] {
  const { width, padding, mediaHeight, gap } = catalogCardLayout;
  const hasMedia = Boolean(image);
  const textTop = padding + (hasMedia ? mediaHeight + gap : 0);
  const height = textTop + 74 + padding;
  const left = x - width / 2;
  const top = y - height / 2;
  const groupId = `astryx-card-${Math.random().toString(36).slice(2, 10)}`;

  const elements: Parameters<typeof convertToExcalidrawElements>[0] = [
    {
      type: "rectangle",
      x: left,
      y: top,
      width,
      height,
      strokeColor: accent.stroke,
      backgroundColor: accent.fill,
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      groupIds: [groupId],
      customData: { astryxReference: reference },
    },
  ];

  if (image) {
    /* Contain the screen image in the media band rather than stretching it — these
       are screenshots, and squashed screenshots are unreadable. */
    const scale = Math.min(
      (width - padding * 2) / image.width,
      mediaHeight / image.height,
    );
    const drawWidth = Math.max(1, Math.round(image.width * scale));
    const drawHeight = Math.max(1, Math.round(image.height * scale));
    elements.push({
      type: "image",
      x: left + (width - drawWidth) / 2,
      y: top + padding + (mediaHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
      fileId: image.fileId,
      status: "saved",
      groupIds: [groupId],
    });
  }

  elements.push({
    type: "text",
    x: left + padding,
    y: top + textTop,
    text: eyebrow.toUpperCase(),
    fontSize: 12,
    fontFamily: 2,
    strokeColor: accent.stroke,
    groupIds: [groupId],
  });
  elements.push({
    type: "text",
    x: left + padding,
    y: top + textTop + 20,
    text: truncateCardText(title, 34),
    fontSize: 20,
    fontFamily: 2,
    strokeColor: "#1b1b1f",
    groupIds: [groupId],
  });
  elements.push({
    type: "text",
    x: left + padding,
    y: top + textTop + 50,
    text: truncateCardText(meta, 46),
    fontSize: 14,
    fontFamily: 2,
    strokeColor: "#5b6478",
    groupIds: [groupId],
  });

  return convertToExcalidrawElements(elements) as ExcalidrawElement[];
}

function createCanvasDataCardElements(
  reference: AstryxCanvasDataPayload,
  x: number,
  y: number,
): ExcalidrawElement[] {
  const isApp = reference.kind === "app";
  const width = isApp ? 440 : 560;
  const height = isApp ? 250 : 320;
  const label = isApp
    ? [
        "ASTRYX APP",
        "",
        reference.appName,
        `${reference.category || reference.platform} · ${reference.totalScreens} screens`,
        "",
        reference.description || "Open the source app to continue research.",
      ].join("\n")
    : [
        "ASTRYX FLOW",
        "",
        reference.flowTitle,
        `${reference.appName} · ${reference.category}`,
        "",
        `${reference.stepCount} ${reference.stepCount === 1 ? "step" : "steps"}`,
        reference.description ||
          "Open the source flow to inspect the full journey.",
      ].join("\n");
  return convertToExcalidrawElements([
    {
      type: "rectangle",
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
      strokeColor: isApp ? "#9cb6df" : "#9d94d8",
      backgroundColor: isApp ? "#eef4ff" : "#f2efff",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      label: {
        text: label,
        fontSize: 18,
        fontFamily: 2,
        textAlign: "left",
        verticalAlign: "top",
        strokeColor: "#22304a",
      },
      customData: {
        astryxReference: reference,
      },
    } as ElementSkeleton,
  ]) as ExcalidrawElement[];
}

function canvasDataReferenceForElement(
  element: ExcalidrawElement,
): AstryxCanvasDataReference | undefined {
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as
    | Record<string, unknown>
    | undefined;
  if (
    reference?.kind === "app" &&
    typeof reference.appId === "string" &&
    typeof reference.appName === "string" &&
    typeof reference.description === "string" &&
    typeof reference.category === "string" &&
    typeof reference.platform === "string" &&
    Number.isSafeInteger(reference.totalScreens)
  ) {
    return {
      kind: "app",
      elementId: element.id,
      appId: reference.appId,
      appName: reference.appName,
      description: reference.description,
      category: reference.category,
      platform: reference.platform as Platform,
      totalScreens: reference.totalScreens as number,
    };
  }
  if (
    reference?.kind === "flow" &&
    typeof reference.appId === "string" &&
    typeof reference.appName === "string" &&
    typeof reference.flowId === "string" &&
    typeof reference.flowTitle === "string" &&
    typeof reference.category === "string" &&
    typeof reference.description === "string" &&
    typeof reference.platform === "string" &&
    Number.isSafeInteger(reference.version) &&
    Number.isSafeInteger(reference.stepCount)
  ) {
    return {
      kind: "flow",
      elementId: element.id,
      appId: reference.appId,
      appName: reference.appName,
      flowId: reference.flowId,
      flowTitle: reference.flowTitle,
      category: reference.category,
      description: reference.description,
      platform: reference.platform as Platform,
      version: reference.version as number,
      stepCount: reference.stepCount as number,
    };
  }
  return undefined;
}

function screenReferenceForElement(
  element: ExcalidrawElement,
): AstryxScreenReference | undefined {
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as
    | Record<string, unknown>
    | undefined;
  if (
    reference?.kind !== "screen" ||
    typeof reference.appId !== "string" ||
    typeof reference.appName !== "string" ||
    !Number.isSafeInteger(reference.screenId) ||
    typeof reference.screenType !== "string" ||
    typeof reference.platform !== "string"
  )
    return undefined;
  return {
    elementId: element.id,
    appId: reference.appId,
    appName: reference.appName,
    screenId: reference.screenId as number,
    screenType: reference.screenType,
    platform: reference.platform,
  };
}

function withCanvasElementUpdate(
  element: ExcalidrawElement,
  patch: Partial<ExcalidrawElement>,
): ExcalidrawElement {
  return {
    ...element,
    ...patch,
    version: element.version + 1,
    versionNonce: Math.floor(Math.random() * 0x7fffffff),
    updated: Date.now(),
  } as ExcalidrawElement;
}

function canvasShapeReferenceForElement(
  element: ExcalidrawElement,
): CanvasShapeReference | undefined {
  if (
    element.type !== "rectangle" &&
    element.type !== "ellipse" &&
    element.type !== "diamond"
  )
    return undefined;
  if (stickyNoteReferenceForElement(element)) return undefined;
  if (sectionBackdropReference(element)) return undefined;
  const customData = element.customData as Record<string, unknown> | undefined;
  if (customData?.astryxReference) return undefined;
  const shape = element as ExcalidrawElement & {
    backgroundColor: string;
    strokeColor: string;
    strokeStyle: CanvasShapeLineStyle;
    opacity: number;
  };
  return {
    elementId: shape.id,
    type: shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    fillColor: shape.backgroundColor,
    strokeColor: shape.strokeColor,
    strokeStyle: shape.strokeStyle,
    opacity: shape.opacity,
  };
}

function canvasShapeReferencesEqual(
  left?: CanvasShapeReference,
  right?: CanvasShapeReference,
) {
  return (
    left?.elementId === right?.elementId &&
    left?.type === right?.type &&
    left?.x === right?.x &&
    left?.y === right?.y &&
    left?.width === right?.width &&
    left?.height === right?.height &&
    left?.fillColor === right?.fillColor &&
    left?.strokeColor === right?.strokeColor &&
    left?.strokeStyle === right?.strokeStyle &&
    left?.opacity === right?.opacity
  );
}

function canvasFreeLineReferenceForElement(
  element: ExcalidrawElement,
): CanvasFreeLineReference | undefined {
  if (element.isDeleted || element.type !== "freedraw") return undefined;
  const freeLine = element as ExcalidrawElement & {
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
    points?: readonly (readonly [number, number])[];
  };
  const mode = canvasFreeLineMode(freeLine.strokeWidth, freeLine.opacity);
  const validPoints = (freeLine.points ?? []).filter(
    (point): point is readonly [number, number] =>
      Number.isFinite(point[0]) && Number.isFinite(point[1]),
  );
  const pointBounds = validPoints.length
    ? validPoints.reduce(
        (bounds, [pointX, pointY]) => ({
          minX: Math.min(bounds.minX, pointX),
          minY: Math.min(bounds.minY, pointY),
          maxX: Math.max(bounds.maxX, pointX),
          maxY: Math.max(bounds.maxY, pointY),
        }),
        {
          minX: validPoints[0][0],
          minY: validPoints[0][1],
          maxX: validPoints[0][0],
          maxY: validPoints[0][1],
        },
      )
    : undefined;
  const strokeInset = freeLine.strokeWidth / 2;
  const visualX = pointBounds
    ? freeLine.x + pointBounds.minX - strokeInset
    : freeLine.x;
  const visualY = pointBounds
    ? freeLine.y + pointBounds.minY - strokeInset
    : freeLine.y;
  const visualWidth = pointBounds
    ? pointBounds.maxX - pointBounds.minX + freeLine.strokeWidth
    : freeLine.width;
  const visualHeight = pointBounds
    ? pointBounds.maxY - pointBounds.minY + freeLine.strokeWidth
    : freeLine.height;
  return {
    elementId: freeLine.id,
    x: visualX,
    y: visualY,
    width: visualWidth,
    height: visualHeight,
    color: freeLine.strokeColor,
    mode,
    weight: canvasFreeLineWeight(mode, freeLine.strokeWidth),
  };
}

function canvasFreeLineReferencesEqual(
  left?: CanvasFreeLineReference,
  right?: CanvasFreeLineReference,
) {
  return (
    left?.elementId === right?.elementId &&
    left?.x === right?.x &&
    left?.y === right?.y &&
    left?.width === right?.width &&
    left?.height === right?.height &&
    left?.color === right?.color &&
    left?.mode === right?.mode &&
    left?.weight === right?.weight
  );
}

function documentReferenceForElement(
  element: ExcalidrawElement,
): AstryxCanvasDocumentReference | undefined {
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as
    | Record<string, unknown>
    | undefined;
  if (
    reference?.kind !== "document" ||
    typeof reference.documentId !== "string" ||
    typeof reference.title !== "string" ||
    typeof reference.body !== "string" ||
    typeof reference.expanded !== "boolean"
  )
    return undefined;
  return {
    elementId: element.id,
    documentId: reference.documentId,
    title: reference.title,
    body: reference.body,
    templateId:
      typeof reference.templateId === "string"
        ? (reference.templateId as ProjectCanvasDocumentTemplateId)
        : undefined,
    expanded: reference.expanded,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

const saveLabels: Record<CanvasSaveState, string> = {
  loading: "Loading canvas",
  saving: "Saving",
  saved: "Saved",
  offline: "Offline — changes saved in this browser",
  unavailable: "Project canvas unavailable",
};

const saveStateIcons: Record<CanvasSaveState, IconName> = {
  loading: "clock",
  saving: "clock",
  saved: "success",
  offline: "warning",
  unavailable: "error",
};

const blankCanvas = (theme: "light" | "dark"): ExcalidrawProjectSnapshot => ({
  type: "excalidraw",
  version: 2,
  source: canvasSource,
  elements: [],
  appState: {
    theme,
    viewBackgroundColor: canvasSceneBackground,
    gridModeEnabled: true,
    gridSize: 20,
    gridStep: 5,
  },
  files: {},
  comments: [],
});

function withCanvasPresentation(
  snapshot: ExcalidrawProjectSnapshot,
  theme: "light" | "dark",
): ExcalidrawProjectSnapshot {
  return {
    ...snapshot,
    comments: normalizeDesignerCanvasComments(snapshot.comments),
    appState: {
      ...snapshot.appState,
      theme,
      viewBackgroundColor: canvasSceneBackground,
      gridModeEnabled: true,
      gridSize: 20,
      gridStep: 5,
    },
  };
}

function usesCanvasPresentation(
  snapshot: ExcalidrawProjectSnapshot,
  theme: "light" | "dark",
): boolean {
  return (
    snapshot.appState.theme === theme &&
    snapshot.appState.viewBackgroundColor === canvasSceneBackground &&
    snapshot.appState.gridModeEnabled === true &&
    snapshot.appState.gridSize === 20 &&
    snapshot.appState.gridStep === 5
  );
}

function isExcalidrawSnapshot(
  value: unknown,
): value is ExcalidrawProjectSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.type === "excalidraw" &&
    typeof snapshot.version === "number" &&
    Array.isArray(snapshot.elements) &&
    Boolean(
      snapshot.appState &&
      typeof snapshot.appState === "object" &&
      !Array.isArray(snapshot.appState),
    ) &&
    Boolean(
      snapshot.files &&
      typeof snapshot.files === "object" &&
      !Array.isArray(snapshot.files),
    )
  );
}

function serializeCanvas(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  comments: readonly DesignerCanvasCommentThread[] = [],
): ExcalidrawProjectSnapshot {
  const snapshot = JSON.parse(
    serializeAsJSON(elements, appState, files, "database"),
  ) as Omit<ExcalidrawProjectSnapshot, "files"> & { files?: BinaryFiles };
  return {
    ...snapshot,
    files: snapshot.files ?? files ?? {},
    comments,
  };
}

function canvasObjectFocusBounds(
  elements: readonly ExcalidrawElement[],
  selectedElementIds: readonly string[],
  viewport: { scrollX: number; scrollY: number; zoom: number },
) {
  if (!selectedElementIds.length) return undefined;
  const selectedIds = new Set(selectedElementIds);
  const selected = elements.filter(
    (element) => !element.isDeleted && selectedIds.has(element.id),
  );
  if (!selected.length) return undefined;
  /* A free line's stored bounds can include empty space around its points.
     Use its rendered stroke geometry so the FigJam-style focus frame hugs the
     line instead of drifting away from it. */
  const renderedBounds = selected.map((element) => {
    const freeLine = canvasFreeLineReferenceForElement(element);
    return freeLine ?? {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
  });
  const left = Math.min(...renderedBounds.map((bounds) => bounds.x));
  const top = Math.min(...renderedBounds.map((bounds) => bounds.y));
  const right = Math.max(
    ...renderedBounds.map((bounds) => bounds.x + bounds.width),
  );
  const bottom = Math.max(
    ...renderedBounds.map((bounds) => bounds.y + bounds.height),
  );
  return {
    left: (left + viewport.scrollX) * viewport.zoom,
    top: (top + viewport.scrollY) * viewport.zoom,
    width: Math.max(1, (right - left) * viewport.zoom),
    height: Math.max(1, (bottom - top) * viewport.zoom),
  };
}

/* Persist images as small asset URLs, never their base64 data. Excalidraw gets
   decoded bytes while editing; on the next load resolveCanvasAssetDataUrls
   hydrates these URLs back into the editor. This keeps a multi-screen Flow
   from overflowing the canvas document body limit. */
function externalizeCanvasAssets(
  snapshot: ExcalidrawProjectSnapshot,
  assetUrls: ReadonlyMap<string, string>,
): ExcalidrawProjectSnapshot {
  if (!assetUrls.size) return snapshot;
  let changed = false;
  const files = Object.fromEntries(
    Object.entries(snapshot.files).map(([id, file]) => {
      const assetUrl = assetUrls.get(id);
      if (!assetUrl || file.dataURL === assetUrl) return [id, file];
      changed = true;
      return [id, { ...file, dataURL: assetUrl as DataURL }];
    }),
  ) as BinaryFiles;
  return changed ? { ...snapshot, files } : snapshot;
}

const canvasSaveKey = (snapshot: ExcalidrawProjectSnapshot): string => {
  const fileVersions = Object.entries(snapshot.files ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, file]) => `${id}:${hashString(file.dataURL ?? "")}`)
    .join("|");
  const { gridModeEnabled, gridSize, gridStep, theme, viewBackgroundColor } =
    snapshot.appState;
  return [
    hashElementsVersion(snapshot.elements),
    hashString(fileVersions),
    hashString(
      JSON.stringify(normalizeDesignerCanvasComments(snapshot.comments)),
    ),
    gridModeEnabled,
    gridSize,
    gridStep,
    theme,
    viewBackgroundColor,
  ].join(":");
};

function imageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  return createImageBitmap(blob)
    .then((image) => {
      const dimensions = { width: image.width, height: image.height };
      image.close();
      return dimensions;
    })
    .catch(() => ({ width: 640, height: 400 }));
}

function canvasMediaFetchUrl(source: string): string {
  const url = new URL(source, window.location.origin);
  if (
    url.origin === window.location.origin &&
    (url.pathname.startsWith("/api/preview-media/") ||
      url.pathname.startsWith("/api/catalog/flow-media/"))
  ) {
    url.searchParams.set("inline", "1");
  }
  return url.toString();
}

export function ProjectPlayground({
  projectId,
  canvasId,
  userId,
  userName,
}: {
  projectId: string;
  canvasId?: string;
  userId: string | number;
  userName: string;
}) {
  const [saveState, setSaveState] = useState<CanvasSaveState>("loading");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [collaborationStatus, setCollaborationStatus] =
    useState<DesignerCanvasCollaborationStatus>("connecting");
  const [remoteCollaborators, setRemoteCollaborators] = useState<
    readonly DesignerCanvasCollaborator[]
  >([]);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [screensOpen, setScreensOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [researchFramesOpen, setResearchFramesOpen] = useState(false);
  const [researchFrameDrawing, setResearchFrameDrawing] = useState(false);
  const [tablePlacement, setTablePlacement] = useState(false);
  const [stampPickerOpen, setStampPickerOpen] = useState(false);
  const [activeStampId, setActiveStampId] = useState<CanvasStampId>(
    defaultCanvasStamp.id,
  );
  const [stampPlacement, setStampPlacement] = useState<CanvasStampOption>();
  const [stampPreviewPoint, setStampPreviewPoint] = useState<{
    x: number;
    y: number;
  }>();
  const [widgetsLauncherOpen, setWidgetsLauncherOpen] = useState(false);
  const [widgetsLauncherQuery, setWidgetsLauncherQuery] = useState("");
  const [widgetsLauncherTab, setWidgetsLauncherTab] =
    useState<CanvasWidgetsTab>("all");
  const [markerDrawing, setMarkerDrawing] = useState(false);
  const [markerMode, setMarkerMode] = useState<CanvasMarkerMode>("marker");
  const [markerStrokeWeight, setMarkerStrokeWeight] =
    useState<CanvasMarkerStrokeWeight>("thin");
  const [markerColor, setMarkerColor] = useState(canvasMarkerColors[0].value);
  const [highlighterColor, setHighlighterColor] = useState(
    canvasHighlighterColors[3].value,
  );
  const [markerColorTransition, setMarkerColorTransition] = useState(false);
  const markerStrokeColor =
    markerMode === "highlighter" ? highlighterColor : markerColor;
  const [researchFrames, setResearchFrames] = useState<
    readonly AstryxResearchFrameReference[]
  >([]);
  const [selectedResearchFrame, setSelectedResearchFrame] =
    useState<AstryxResearchFrameReference>();
  const [selectedFramePanel, setSelectedFramePanel] = useState<
    "color" | "line" | "rename"
  >();
  const [selectedFrameNameDraft, setSelectedFrameNameDraft] = useState("");
  const researchFrameStartIdsRef = useRef<Set<string>>(new Set());
  const orphanSectionCleanupScheduledRef = useRef(false);
  const [toolsCatalogOpen, setToolsCatalogOpen] = useState(false);
  const [toolsCatalogQuery, setToolsCatalogQuery] = useState("");
  const [canvasFindOpen, setCanvasFindOpen] = useState(false);
  const [canvasFindQuery, setCanvasFindQuery] = useState("");
  const [canvasReplaceQuery, setCanvasReplaceQuery] = useState("");
  const [canvasFindMatchIndex, setCanvasFindMatchIndex] = useState(0);
  const [canvasUiMinimized, setCanvasUiMinimized] = useState(true);
  const [canvasChromeVisible, setCanvasChromeVisible] = useState(true);
  const [canvasRemoteCursorsVisible, setCanvasRemoteCursorsVisible] =
    useState(true);
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [shapeLibraryOpen, setShapeLibraryOpen] = useState(false);
  const [shapeLibraryQuery, setShapeLibraryQuery] = useState("");
  const [canvasPagesOpen, setCanvasPagesOpen] = useState(false);
  // FigJam opens the family with Rectangle as its current tool; no element is
  // inserted until the user clicks or drags on the canvas.
  const [activeShapeOptionId, setActiveShapeOptionId] =
    useState<CanvasShapeOptionId>("rectangle");
  const [shapePlacement, setShapePlacement] = useState<CanvasShapeOption>();
  const shapePlacementPointerRef = useRef<{ x: number; y: number }>();
  const [shapeColor, setShapeColor] = useState(defaultSectionFill);
  const [shapeColorPickerOpen, setShapeColorPickerOpen] = useState(false);
  const [stickyPickerOpen, setStickyPickerOpen] = useState(false);
  const [stickyToolColor, setStickyToolColor] = useState(
    defaultProjectStickyNoteColor,
  );
  const [stickyPlacement, setStickyPlacement] = useState<StickyPlacement>();
  const [commentPlacement, setCommentPlacement] = useState(false);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [commentDraftAnchor, setCommentDraftAnchor] = useState<{
    x: number;
    y: number;
  }>();
  const [commentDraft, setCommentDraft] = useState("");
  const [canvasComments, setCanvasComments] = useState<
    readonly DesignerCanvasCommentThread[]
  >([]);
  const [selectedCommentId, setSelectedCommentId] = useState<string>();
  const [stickyDraft, setStickyDraft] = useState<StickyDraft>();
  const [canvasTextEditing, setCanvasTextEditing] = useState(false);
  const [textToolActive, setTextToolActive] = useState(false);
  const [textSelectionActive, setTextSelectionActive] = useState(false);
  const [selectedCanvasText, setSelectedCanvasText] =
    useState<CanvasTextReference>();
  const [canvasTexts, setCanvasTexts] = useState<CanvasTextReference[]>([]);
  const [selectedCanvasTable, setSelectedCanvasTable] =
    useState<CanvasTableReference>();
  const [selectedStickyNote, setSelectedStickyNote] =
    useState<AstryxStickyNoteReference>();
  /* The contextual toolbar can be clicked during the same pointer interaction
     that selects a note. Keep the canvas-derived reference available outside
     React's render cycle so that first action always targets that exact note. */
  const selectedStickyNoteRef = useRef<AstryxStickyNoteReference>();
  const [selectedCanvasShape, setSelectedCanvasShape] =
    useState<CanvasShapeReference>();
  const [selectedCanvasFreeLine, setSelectedCanvasFreeLine] =
    useState<CanvasFreeLineReference>();
  const selectedCanvasFreeLineRef = useRef<CanvasFreeLineReference>();
  const [selectedFreeLineColorOpen, setSelectedFreeLineColorOpen] =
    useState(false);
  const [selectedCanvasElementIds, setSelectedCanvasElementIds] = useState<
    readonly string[]
  >([]);
  const [selectedCanvasFocusBounds, setSelectedCanvasFocusBounds] =
    useState<ReturnType<typeof canvasObjectFocusBounds>>();
  const [selectedShapePanel, setSelectedShapePanel] = useState<
    "shape" | "fill" | "line"
  >();
  const [stickyNotes, setStickyNotes] = useState<
    readonly AstryxStickyNoteReference[]
  >([]);
  const [documentPlacement, setDocumentPlacement] = useState(false);
  const documentPlacementRef = useRef(false);
  useEffect(() => {
    documentPlacementRef.current = documentPlacement;
  }, [documentPlacement]);
  const [canvasDocuments, setCanvasDocuments] = useState<
    readonly AstryxCanvasDocumentReference[]
  >([]);
  const [selectedCanvasDocument, setSelectedCanvasDocument] =
    useState<AstryxCanvasDocumentReference>();
  const [canvasViewport, setCanvasViewport] = useState({
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
  });
  const [referencesState, setReferencesState] =
    useState<ProjectReferenceState>("idle");
  const [references, setReferences] = useState<ResearchProjectWorkspace>();
  const [referenceQuery, setReferenceQuery] = useState("");
  const [insertingReferenceId, setInsertingReferenceId] = useState<number>();
  const [referenceMessage, setReferenceMessage] = useState("");
  const [insertingScreenKey, setInsertingScreenKey] = useState<string>();
  const [screenMessage, setScreenMessage] = useState("");
  const showToast = useApplicationToast();
  const [selectedScreenReference, setSelectedScreenReference] =
    useState<AstryxScreenReference>();
  const [selectedDataReference, setSelectedDataReference] =
    useState<AstryxCanvasDataReference>();
  const [canvasToolbarHost, setCanvasToolbarHost] =
    useState<HTMLElement | null>(null);
  const [canvasOverlayHost, setCanvasOverlayHost] =
    useState<HTMLDivElement | null>(null);
  const editorRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const setCanvasRoot = useCallback((node: HTMLDivElement | null) => {
    canvasRootRef.current = node;
    setCanvasOverlayHost(node);
  }, []);
  const stickyComposerRef = useRef<HTMLDivElement | null>(null);
  const stickyInputRef = useRef<HTMLDivElement | null>(null);
  const canvasTextEditingRef = useRef(false);
  const stickyPlacementRef = useRef<StickyPlacement>();
  const canvasTableCellSelectionRef = useRef<{
    tableId: string;
    cellIds: readonly string[];
  }>();
  const tablePlacementRef = useRef(false);
  const stampPlacementRef = useRef<CanvasStampOption>();
  const canvasCommentsRef = useRef<readonly DesignerCanvasCommentThread[]>([]);
  const activeRef = useRef(true);
  const loadedRef = useRef(false);
  const savingRef = useRef(false);
  const pendingSnapshotRef = useRef<ExcalidrawProjectSnapshot | undefined>(
    undefined,
  );
  const lastQueuedSnapshotKeyRef = useRef<string | undefined>(undefined);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const uploadingFileIdsRef = useRef(new Set<string>());
  const persistedFileIdsRef = useRef(new Set<string>());
  const canvasAssetUrlsRef = useRef(new Map<string, string>());
  const collaborationRef = useRef<DesignerCanvasCollaborationSession | null>(
    null,
  );
  const remoteCollaboratorsRef = useRef(
    new Map<string, DesignerCanvasCollaborator>(),
  );
  const remoteCursorsRef = useRef(
    new Map<string, DesignerCanvasRemoteCursor>(),
  );
  const remoteElementsVersionRef = useRef<number | undefined>(undefined);
  const remoteBroadcastSuppressedUntilRef = useRef(0);

  useEffect(() => {
    const canvas =
      canvasRootRef.current?.querySelector<HTMLElement>(".excalidraw");
    if (!canvas) return;
    canvas.style.setProperty(
      "--canvas-marker-tool-icon",
      `url("${coloredFigJamFreehandToolIcon("marker", markerColor)}")`,
    );
    canvas.style.setProperty(
      "--canvas-highlighter-tool-icon",
      `url("${coloredFigJamFreehandToolIcon("highlighter", highlighterColor)}")`,
    );
  }, [highlighterColor, markerColor]);
  const localStorageKey = useMemo(
    () =>
      `astryx:project:${projectId}:canvas:${canvasId ?? "legacy"}:excalidraw:v1`,
    [canvasId, projectId],
  );
  const stickyDraftFocusKey = stickyDraft
    ? `${stickyDraft.x}:${stickyDraft.y}`
    : "";
  const onlineCollaborators = useMemo(() => {
    const collaborators = new Map<string, { id: string; name: string }>();
    collaborators.set(`user:${userId}`, {
      id: `user:${userId}`,
      name: userName,
    });
    for (const collaborator of remoteCollaborators) {
      const id = `user:${collaborator.userId}`;
      if (!collaborators.has(id))
        collaborators.set(id, { id, name: collaborator.name });
    }
    return [...collaborators.values()];
  }, [remoteCollaborators, userId, userName]);
  const collaborationStatusLabel =
    collaborationStatus === "live"
      ? `${onlineCollaborators.length} ${onlineCollaborators.length === 1 ? "person" : "people"} online`
      : collaborationStatus === "connecting"
        ? "Connecting"
        : "Collaboration offline";
  const canvasReadOnly =
    referencesState !== "ready" || references?.access?.role === "viewer";

  const syncCanvasCollaborators = useCallback(() => {
    const collaborators = new Map<SocketId, Collaborator>();
    for (const collaborator of remoteCollaboratorsRef.current.values()) {
      const cursor = remoteCursorsRef.current.get(collaborator.clientId);
      collaborators.set(collaborator.clientId as SocketId, {
        id: String(collaborator.userId),
        socketId: collaborator.clientId as SocketId,
        username: collaborator.name,
        color: canvasCollaboratorColor(collaborator.name),
        pointer:
          canvasRemoteCursorsVisible && cursor?.pointer
            ? { ...cursor.pointer, tool: "pointer", renderCursor: true }
            : undefined,
        button: cursor?.button,
        selectedElementIds: canvasRemoteCursorsVisible
          ? Object.fromEntries(
              (cursor?.selectedElementIds ?? []).map((id) => [id, true]),
            )
          : {},
      });
    }
    editorRef.current?.updateScene({ collaborators });
  }, [canvasRemoteCursorsVisible]);

  useEffect(() => {
    syncCanvasCollaborators();
  }, [syncCanvasCollaborators]);

  const handleCanvasPointerUpdate = useCallback(
    ({ pointer, button }: CanvasPointerUpdate) => {
      const editor = editorRef.current;
      const appState = editor?.getAppState();
      const selectedElementIds = Object.keys(
        appState?.selectedElementIds ?? {},
      );
      if (stampPlacementRef.current && appState) {
        setStampPreviewPoint({
          x: (pointer.x + appState.scrollX) * appState.zoom.value,
          y: (pointer.y + appState.scrollY) * appState.zoom.value,
        });
      } else {
        setStampPreviewPoint(undefined);
      }
      if (shapePlacement && button === "down") {
        shapePlacementPointerRef.current = { x: pointer.x, y: pointer.y };
      }
      collaborationRef.current?.publishCursor({
        pointer: { x: pointer.x, y: pointer.y },
        button,
        selectedElementIds,
      });
    },
    [shapePlacement],
  );

  useEffect(() => {
    if (!stickyDraftFocusKey) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const input = stickyInputRef.current;
      if (!input) return;
      input.textContent = stickyDraft?.value ?? "";
      input.focus();

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [stickyDraftFocusKey]);

  useEffect(() => {
    const root = canvasRootRef.current;
    if (!root) return undefined;

    const syncToolbarHost = () => {
      const nextHost = root.querySelector<HTMLElement>(
        ".App-toolbar > .Stack_horizontal",
      );
      setCanvasToolbarHost((current) =>
        current === nextHost ? current : nextHost,
      );
    };

    syncToolbarHost();
    const observer = new MutationObserver(syncToolbarHost);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      setCanvasToolbarHost(null);
    };
  }, [projectId]);

  const readLocalCanvas = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(localStorageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      return isExcalidrawSnapshot(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [localStorageKey]);

  const writeLocalCanvas = useCallback(
    (snapshot: ExcalidrawProjectSnapshot) => {
      try {
        window.localStorage.setItem(localStorageKey, JSON.stringify(snapshot));
      } catch {
        // Remote persistence still works when browser storage is unavailable.
      }
    },
    [localStorageKey],
  );

  const flushCanvas = useCallback(async () => {
    if (savingRef.current || !pendingSnapshotRef.current) return;
    savingRef.current = true;
    while (pendingSnapshotRef.current) {
      const snapshot = pendingSnapshotRef.current;
      pendingSnapshotRef.current = undefined;
      try {
        if (canvasId)
          await saveDesignerCanvasFile(projectId, canvasId, snapshot);
        else await saveDesignerCanvas(projectId, snapshot);
        if (activeRef.current) {
          setSaveErrorMessage("");
          setSaveState("saved");
        }
      } catch (error) {
        pendingSnapshotRef.current ??= snapshot;
        if (activeRef.current) {
          setSaveErrorMessage(
            error instanceof Error ? error.message : "Canvas save failed",
          );
          setSaveState(
            error instanceof DesignerCanvasApiError && error.status === 404
              ? "unavailable"
              : "offline",
          );
        }
        break;
      }
    }
    savingRef.current = false;
  }, [canvasId, projectId]);

  const queueSnapshot = useCallback(
    (snapshot: ExcalidrawProjectSnapshot) => {
      const compactSnapshot = externalizeCanvasAssets(
        snapshot,
        canvasAssetUrlsRef.current,
      );
      const snapshotKey = canvasSaveKey(compactSnapshot);
      if (snapshotKey === lastQueuedSnapshotKeyRef.current) return;
      lastQueuedSnapshotKeyRef.current = snapshotKey;
      writeLocalCanvas(compactSnapshot);
      pendingSnapshotRef.current = compactSnapshot;
      if (activeRef.current) setSaveState("saving");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void flushCanvas();
      }, 750);
    },
    [flushCanvas, writeLocalCanvas],
  );

  const commitCanvasComments = useCallback(
    (comments: readonly DesignerCanvasCommentThread[]) => {
      canvasCommentsRef.current = comments;
      setCanvasComments(comments);
      const editor = editorRef.current;
      if (!editor || !loadedRef.current) return;
      const snapshot = serializeCanvas(
        editor.getSceneElementsIncludingDeleted(),
        editor.getAppState(),
        editor.getFiles(),
        comments,
      );
      queueSnapshot(snapshot);
      collaborationRef.current?.publishScene(snapshot);
    },
    [queueSnapshot],
  );

  const initialData = useCallback(async () => {
    loadedRef.current = false;
    try {
      const canvas = canvasId
        ? await getDesignerCanvasFile(projectId, canvasId)
        : await getDesignerCanvas(projectId);
      const remote = isExcalidrawSnapshot(canvas.snapshot)
        ? canvas.snapshot
        : undefined;
      const sourceSnapshot =
        remote ?? readLocalCanvas() ?? blankCanvas(canvasTheme);
      /* Catalog assets use `asset:<uuid>` as both Excalidraw file ID and
         project asset ID. Remember their compact storage path when opening an
         older board that still has base64 bytes in its saved document. */
      Object.keys(sourceSnapshot.files).forEach((fileId) => {
        if (fileId.startsWith("asset:")) {
          canvasAssetUrlsRef.current.set(
            fileId,
            projectCanvasAssetUrl(projectId, fileId),
          );
        }
      });
      const snapshot = withCanvasPresentation(
        {
          ...sourceSnapshot,
          files: await resolveCanvasAssetDataUrls(
            sourceSnapshot.files,
            sourceSnapshot.elements,
          ),
        },
        canvasTheme,
      );
      canvasCommentsRef.current = snapshot.comments;
      if (activeRef.current) setCanvasComments(snapshot.comments);
      lastQueuedSnapshotKeyRef.current = canvasSaveKey(snapshot);
      writeLocalCanvas(snapshot);
      if (
        !remote ||
        !usesCanvasPresentation(remote, canvasTheme) ||
        canvasSaveKey(snapshot) !== canvasSaveKey(sourceSnapshot)
      ) {
        if (canvasId)
          await saveDesignerCanvasFile(projectId, canvasId, snapshot);
        else await saveDesignerCanvas(projectId, snapshot);
      }
      if (activeRef.current) setSaveState("saved");
      if (activeRef.current) setSaveErrorMessage("");
      loadedRef.current = true;
      return { ...snapshot, scrollToContent: true };
    } catch (error) {
      const snapshot = withCanvasPresentation(
        readLocalCanvas() ?? blankCanvas(canvasTheme),
        canvasTheme,
      );
      lastQueuedSnapshotKeyRef.current = canvasSaveKey(snapshot);
      canvasCommentsRef.current = snapshot.comments;
      if (activeRef.current) setCanvasComments(snapshot.comments);
      loadedRef.current = true;
      if (activeRef.current) {
        setSaveErrorMessage(
          error instanceof Error ? error.message : "Canvas load failed",
        );
        setSaveState(
          error instanceof DesignerCanvasApiError && error.status === 404
            ? "unavailable"
            : "offline",
        );
      }
      return { ...snapshot, scrollToContent: true };
    }
  }, [canvasId, projectId, readLocalCanvas, writeLocalCanvas]);

  useEffect(() => {
    editorRef.current?.updateScene({
      appState: {
        theme: canvasTheme,
        viewBackgroundColor: canvasSceneBackground,
        gridModeEnabled: true,
      },
    });
  }, []);

  useEffect(() => {
    activeRef.current = true;
    const saveBeforeExit = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      void flushCanvas();
    };
    window.addEventListener("pagehide", saveBeforeExit);
    return () => {
      activeRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      window.removeEventListener("pagehide", saveBeforeExit);
      void flushCanvas();
      // `flushCanvas` changes as the scene changes, so this cleanup can run
      // while Excalidraw remains mounted. The imperative API is still valid
      // and must remain available to contextual object toolbars.
    };
  }, [flushCanvas]);

  const loadReferences = useCallback(async () => {
    setReferencesState("loading");
    setReferenceMessage("");
    try {
      setReferences(await getResearchProject(projectId));
      setReferencesState("ready");
    } catch (error) {
      setReferencesState("error");
      setReferenceMessage((error as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  const persistEmbeddedFiles = useCallback(
    (files: BinaryFiles) => {
      const editor = editorRef.current;
      if (!editor) return;
      for (const file of Object.values(files)) {
        if (
          !file.dataURL.startsWith("data:") ||
          uploadingFileIdsRef.current.has(file.id) ||
          persistedFileIdsRef.current.has(file.id)
        )
          continue;
        uploadingFileIdsRef.current.add(file.id);
        void apiFetch(file.dataURL)
          .then((response) => response.blob())
          .then(async (blob) => {
            const assetId = `asset:${file.id}`;
            const assetUrl = await uploadProjectCanvasAsset(
              projectId,
              assetId,
              blob,
            );
            persistedFileIdsRef.current.add(file.id);
            canvasAssetUrlsRef.current.set(file.id, assetUrl);
          })
          .catch((error) => {
            if (activeRef.current)
              setReferenceMessage((error as Error).message);
          })
          .finally(() => uploadingFileIdsRef.current.delete(file.id));
      }
    },
    [projectId],
  );

  /* Sticky Notes is an exclusive placement mode. Keep its UI state separate
     from the editor tool change itself so the newly selected tool never gets
     reset back to Select while React is reconciling the toolbar. */
  const deactivateStickyTool = useCallback(() => {
    stickyPlacementRef.current = undefined;
    setStickyPickerOpen(false);
    setStickyPlacement(undefined);
  }, []);

  const deactivateTableTool = useCallback(() => {
    tablePlacementRef.current = false;
    setTablePlacement(false);
  }, []);

  const deactivateStampTool = useCallback(() => {
    stampPlacementRef.current = undefined;
    setStampPlacement(undefined);
    setStampPreviewPoint(undefined);
    setStampPickerOpen(false);
  }, []);

  const beginStickyNoteEditAt = useCallback(
    (clientX: number, clientY: number) => {
      if (canvasReadOnly) return false;
      const editor = editorRef.current;
      const root = canvasRootRef.current;
      const appState = editor?.getAppState();
      if (!editor || !root || !appState) return false;

      const bounds = root.getBoundingClientRect();
      const sceneX =
        (clientX - bounds.left) / appState.zoom.value - appState.scrollX;
      const sceneY =
        (clientY - bounds.top) / appState.zoom.value - appState.scrollY;
      const elements = editor.getSceneElements();
      const sticky = elements
        .map((element) => stickyNoteReferenceForElement(element, elements))
        .find(
          (note): note is AstryxStickyNoteReference =>
            Boolean(note) &&
            sceneX >= note.x &&
            sceneX <= note.x + note.width &&
            sceneY >= note.y &&
            sceneY <= note.y + note.height,
        );
      if (!sticky) return false;

      /* Excalidraw represents a labelled sticky as a rectangle plus a separate
       * bound text element. Its native WYSIWYG layer uses another baseline
       * when it opens, so always use the positioned Vitrines composer instead. */
      deactivateStickyTool();
      setStickyDraft({
        x: sticky.x + sticky.width / 2,
        y: sticky.y + sticky.height / 2,
        width: sticky.width,
        height: sticky.height,
        editingElementId: sticky.elementId,
        editingTextElementId: sticky.textElementId,
        color: sticky.color,
        value: sticky.text,
        format: sticky.format,
      });
      editor.setActiveTool({ type: "selection" });
      return true;
    },
    [canvasReadOnly, deactivateStickyTool],
  );

  const handleCanvasStickyNoteDoubleClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".excalidraw__canvas")) return;
      if (!beginStickyNoteEditAt(event.clientX, event.clientY)) return;
      // Stop Excalidraw's own double-click handler from replacing this composer
      // with its native textarea after React has opened the in-place editor.
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
    },
    [beginStickyNoteEditAt],
  );

  const handleCanvasToolPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const nativeTool = target
        .closest("label")
        ?.querySelector('input[data-testid^="toolbar-"]');
      const canvasPointer = target.closest(".excalidraw__canvas");
      if (canvasPointer && selectedCanvasTable && canvasRootRef.current) {
        const bounds = canvasRootRef.current.getBoundingClientRect();
        const sceneX =
          (event.clientX - bounds.left) / canvasViewport.zoom -
          canvasViewport.scrollX;
        const sceneY =
          (event.clientY - bounds.top) / canvasViewport.zoom -
          canvasViewport.scrollY;
        const pointedCell = canvasTableCellAtScenePoint(
          selectedCanvasTable,
          sceneX,
          sceneY,
        );
        if (pointedCell) {
          if (event.detail <= 1) {
            event.preventDefault();
            event.stopPropagation();
          }
          const nextTable = canvasTableWithSelectedCells(selectedCanvasTable, [
            pointedCell.elementId,
          ]);
          canvasTableCellSelectionRef.current = {
            tableId: selectedCanvasTable.tableId,
            cellIds: nextTable.selectedCellIds,
          };
          setSelectedCanvasTable(nextTable);
        } else {
          canvasTableCellSelectionRef.current = undefined;
        }
      } else if (canvasPointer || nativeTool) {
        canvasTableCellSelectionRef.current = undefined;
      }
      if (canvasPointer && shapePlacement) {
        shapePlacementPointerRef.current = undefined;
      }
      if (nativeTool) {
        deactivateStickyTool();
        setStickyDraft(undefined);
        deactivateTableTool();
        deactivateStampTool();
        setShapePickerOpen(false);
        setShapeLibraryOpen(false);
        setShapeColorPickerOpen(false);
        setShapePlacement(undefined);
        setMarkerDrawing(false);
        setResearchFrameDrawing(false);
        documentPlacementRef.current = false;
        setDocumentPlacement(false);
        setCommentPlacement(false);
        setResearchFramesOpen(false);
        setScreensOpen(false);
        setTemplatesOpen(false);
        setReferencesOpen(false);
        setToolsCatalogOpen(false);
        setWidgetsLauncherOpen(false);
      }
    },
    [
      canvasViewport,
      deactivateStickyTool,
      deactivateTableTool,
      deactivateStampTool,
      selectedCanvasTable,
      shapePlacement,
    ],
  );

  const handleCanvasChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const stickyToolIsActive =
        appState.activeTool.type === "custom" &&
        appState.activeTool.customType === "astryx-sticky-note";
      const nextSelectedCanvasElementIds = elements
        .filter(
          (element) =>
            !element.isDeleted && appState.selectedElementIds[element.id],
        )
        .map((element) => element.id);
      setSelectedCanvasElementIds((current) =>
        current.length === nextSelectedCanvasElementIds.length &&
        current.every((id, index) => id === nextSelectedCanvasElementIds[index])
          ? current
          : nextSelectedCanvasElementIds,
      );
      /* Excalidraw normalizes an external custom tool back to Selection. The
         placement ref is the durable source of truth until the person places
         the note or deliberately switches tools. */
      if (!stickyToolIsActive && !stickyPlacementRef.current) {
        deactivateStickyTool();
      }
      const nextCanvasTextEditing = Boolean(appState.editingTextElement);
      const nextSelectedCanvasFocusBounds = nextCanvasTextEditing
        ? undefined
        : canvasObjectFocusBounds(elements, nextSelectedCanvasElementIds, {
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom.value,
          });
      setSelectedCanvasFocusBounds((current) =>
        current?.left === nextSelectedCanvasFocusBounds?.left &&
        current?.top === nextSelectedCanvasFocusBounds?.top &&
        current?.width === nextSelectedCanvasFocusBounds?.width &&
        current?.height === nextSelectedCanvasFocusBounds?.height
          ? current
          : nextSelectedCanvasFocusBounds,
      );
      canvasTextEditingRef.current = nextCanvasTextEditing;
      setCanvasTextEditing((current) =>
        current === nextCanvasTextEditing ? current : nextCanvasTextEditing,
      );
      const selectedTextElement = elements.find(
        (element) =>
          !element.isDeleted &&
          element.type === "text" &&
          (appState.selectedElementIds[element.id] ||
            appState.editingTextElement?.id === element.id),
      );
      const detectedCanvasTable = canvasTableReferenceForSelection(
        elements,
        appState,
      );
      const savedCellSelection = canvasTableCellSelectionRef.current;
      const nextSelectedCanvasTable = savedCellSelection
        ? canvasTableReferenceForTableId(
            elements,
            savedCellSelection.tableId,
            savedCellSelection.cellIds,
          )
        : detectedCanvasTable;
      if (savedCellSelection && !nextSelectedCanvasTable) {
        canvasTableCellSelectionRef.current = undefined;
      }
      if (
        savedCellSelection &&
        nextSelectedCanvasTable &&
        Object.keys(appState.selectedElementIds).length > 0
      ) {
        window.requestAnimationFrame(() => {
          editorRef.current?.updateScene({
            appState: {
              selectedElementIds: {},
              selectedGroupIds: {},
              editingGroupId: null,
            },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        });
      }
      setSelectedCanvasTable((current) =>
        canvasTableReferencesEqual(current, nextSelectedCanvasTable)
          ? current
          : nextSelectedCanvasTable,
      );
      /* Text bound to a sticky note belongs to its note's object toolbar. Plain
       text owns the same compact shell, but not the note collaboration UI. */
      const selectedTextContainerId = selectedTextElement
        ? (selectedTextElement as { containerId?: string | null }).containerId
        : undefined;
      const nextSelectedCanvasText =
        nextSelectedCanvasTable || selectedTextContainerId
          ? undefined
          : selectedTextElement
            ? canvasTextReferenceForElement(selectedTextElement)
            : undefined;
      setSelectedCanvasText((current) =>
        canvasTextReferencesEqual(current, nextSelectedCanvasText)
          ? current
          : nextSelectedCanvasText,
      );
      /* Plain text owns the same FigJam typography capabilities as Sticky
       * Notes. Keep a scene-level reference list so rich treatments stay
       * visible after the object is deselected, not only while its toolbar is
       * open. Bound labels belong to their parent object and are excluded. */
      const nextCanvasTexts = elements.flatMap((element) => {
        const reference = canvasTextReferenceForElement(element);
        if (!reference) return [];
        return (element as { containerId?: string | null }).containerId
          ? []
          : [reference];
      });
      setCanvasTexts((current) =>
        canvasTextReferenceListsEqual(current, nextCanvasTexts)
          ? current
          : nextCanvasTexts,
      );
      // Excalidraw changes back to Select when the inline editor opens. Keep the
      // FigJam Text affordance active until that editing interaction is finished.
      const nextTextToolActive =
        nextCanvasTextEditing || appState.activeTool.type === "text";
      setTextToolActive((current) =>
        current === nextTextToolActive ? current : nextTextToolActive,
      );
      setTextSelectionActive((current) =>
        current === (nextCanvasTextEditing || Boolean(selectedTextElement))
          ? current
          : nextCanvasTextEditing || Boolean(selectedTextElement),
      );
      const frames = elements
        .filter((element) => !element.isDeleted)
        .map((element) => researchFrameReferenceForElement(element, elements))
        .filter((reference): reference is AstryxResearchFrameReference =>
          Boolean(reference),
        );
      setResearchFrames((current) =>
        researchFrameReferencesEqual(current, frames) ? current : frames,
      );
      const liveFrameIds = new Set(frames.map((frame) => frame.elementId));
      const hasOrphanSectionBackdrop = elements.some((element) => {
        const reference = sectionBackdropReference(element);
        return (
          !element.isDeleted &&
          reference?.parentFrameId &&
          !liveFrameIds.has(reference.parentFrameId)
        );
      });
      if (
        hasOrphanSectionBackdrop &&
        !orphanSectionCleanupScheduledRef.current
      ) {
        orphanSectionCleanupScheduledRef.current = true;
        window.requestAnimationFrame(() => {
          orphanSectionCleanupScheduledRef.current = false;
          const editor = editorRef.current;
          if (!editor) return;
          const currentElements = editor.getSceneElements();
          const currentFrameIds = new Set(
            currentElements
              .filter(
                (element) => !element.isDeleted && element.type === "frame",
              )
              .map((element) => element.id),
          );
          const nextElements = currentElements.map((element) => {
            const reference = sectionBackdropReference(element);
            return !element.isDeleted &&
              reference?.parentFrameId &&
              !currentFrameIds.has(reference.parentFrameId)
              ? withCanvasElementUpdate(element, { isDeleted: true })
              : element;
          });
          editor.updateScene({ elements: nextElements });
        });
      }
      const selectedFrames = frames.filter(
        (frame) => appState.selectedElementIds[frame.elementId],
      );
      const selectedFrame =
        selectedFrames.length === 1 ? selectedFrames[0] : undefined;
      setSelectedResearchFrame((current) => {
        if (!current && !selectedFrame) return current;
        if (
          current &&
          selectedFrame &&
          researchFrameReferencesEqual([current], [selectedFrame])
        )
          return current;
        return selectedFrame;
      });
      setResearchFrameDrawing(appState.activeTool.type === "frame");
      const nextMarkerDrawing =
        appState.activeTool.type === "freedraw" ||
        appState.activeTool.type === "eraser";
      setMarkerDrawing((current) =>
        current === nextMarkerDrawing ? current : nextMarkerDrawing,
      );
      if (appState.activeTool.type === "eraser") setMarkerMode("eraser");
      if (appState.activeTool.type === "freedraw") {
        const setActiveColor =
          markerMode === "highlighter" ? setHighlighterColor : setMarkerColor;
        setActiveColor((current) =>
          current === appState.currentItemStrokeColor
            ? current
            : appState.currentItemStrokeColor,
        );
      }
      const documents = elements
        .filter((element) => !element.isDeleted)
        .map(documentReferenceForElement)
        .filter((reference): reference is AstryxCanvasDocumentReference =>
          Boolean(reference),
        );
      setCanvasDocuments((current) =>
        canvasDocumentReferencesEqual(current, documents) ? current : documents,
      );
      const selectedScreens = elements
        .filter((element) => appState.selectedElementIds[element.id])
        .map(screenReferenceForElement)
        .filter((reference): reference is AstryxScreenReference =>
          Boolean(reference),
        );
      const selectedScreen =
        selectedScreens.length === 1 ? selectedScreens[0] : undefined;
      setSelectedScreenReference((current) =>
        current?.elementId === selectedScreen?.elementId
          ? current
          : selectedScreen,
      );
      const selectedDataReferences = elements
        .filter((element) => appState.selectedElementIds[element.id])
        .map(canvasDataReferenceForElement)
        .filter((reference): reference is AstryxCanvasDataReference =>
          Boolean(reference),
        );
      const selectedDataReference =
        selectedDataReferences.length === 1
          ? selectedDataReferences[0]
          : undefined;
      setSelectedDataReference((current) =>
        current?.elementId === selectedDataReference?.elementId
          ? current
          : selectedDataReference,
      );
      const selectedDocuments = elements
        .filter((element) => appState.selectedElementIds[element.id])
        .map(documentReferenceForElement)
        .filter((reference): reference is AstryxCanvasDocumentReference =>
          Boolean(reference),
        );
      const selectedDocument =
        selectedDocuments.length === 1 ? selectedDocuments[0] : undefined;
      setSelectedCanvasDocument((current) => {
        if (!current && !selectedDocument) return current;
        if (
          current?.elementId === selectedDocument?.elementId &&
          current.title === selectedDocument.title &&
          current.body === selectedDocument.body &&
          current.templateId === selectedDocument.templateId &&
          current.expanded === selectedDocument.expanded &&
          current.x === selectedDocument.x &&
          current.y === selectedDocument.y &&
          current.width === selectedDocument.width &&
          current.height === selectedDocument.height
        )
          return current;
        return selectedDocument;
      });
      /*
       * Resolve a selection to its sticky container. Clicking into a note's text
       * selects the bound text element, which is not a rectangle and carries no
       * astryxReference — so matching only containers dropped the note and let
       * Excalidraw's generic shape panel take over mid-edit.
       */
      const selectedStickyNotes = elements
        .filter((element) => appState.selectedElementIds[element.id])
        .map((element) => {
          const direct = stickyNoteReferenceForElement(element, elements);
          if (direct) return direct;
          const contained = stickyNoteReferenceForTextElement(element, elements);
          if (contained) return contained;
          const containerId = (element as { containerId?: string | null })
            .containerId;
          if (!containerId) return undefined;
          const container = elements.find(
            (candidate) => candidate.id === containerId,
          );
          return container
            ? stickyNoteReferenceForElement(container, elements)
            : undefined;
        })
        .filter((reference): reference is AstryxStickyNoteReference =>
          Boolean(reference),
        );
      /* One note may resolve twice when both its container and its text are in the
       selection; that is still a single note. */
      const uniqueSelectedStickyNotes = selectedStickyNotes.filter(
        (reference, index) =>
          selectedStickyNotes.findIndex(
            (candidate) => candidate.elementId === reference.elementId,
          ) === index,
      );
      const selectedSticky =
        uniqueSelectedStickyNotes.length === 1
          ? uniqueSelectedStickyNotes[0]
          : undefined;
      selectedStickyNoteRef.current = selectedSticky;
      setSelectedStickyNote((current) =>
        stickyNoteReferencesEqual(current, selectedSticky)
          ? current
          : selectedSticky,
      );
      const selectedShapes = elements
        .filter(
          (element) =>
            !element.isDeleted && appState.selectedElementIds[element.id],
        )
        .map(canvasShapeReferenceForElement)
        .filter((shape): shape is CanvasShapeReference => Boolean(shape));
      const selectedShape =
        selectedShapes.length === 1 && !selectedSticky
          ? selectedShapes[0]
          : undefined;
      setSelectedCanvasShape((current) =>
        canvasShapeReferencesEqual(current, selectedShape)
          ? current
          : selectedShape,
      );
      const selectedFreeLines = elements
        .filter(
          (element) =>
            !element.isDeleted && appState.selectedElementIds[element.id],
        )
        .map(canvasFreeLineReferenceForElement)
        .filter((freeLine): freeLine is CanvasFreeLineReference =>
          Boolean(freeLine),
        );
      const selectedFreeLine =
        selectedFreeLines.length === 1 ? selectedFreeLines[0] : undefined;
      // Keep the toolbar handlers in sync during the same pointer interaction
      // that revealed the selection. Waiting for React's effect here made the
      // first color/weight click easy to drop.
      selectedCanvasFreeLineRef.current = selectedFreeLine;
      setSelectedCanvasFreeLine((current) =>
        canvasFreeLineReferencesEqual(current, selectedFreeLine)
          ? current
          : selectedFreeLine,
      );
      const nextStickyNotes = elements
        .map((element) => stickyNoteReferenceForElement(element, elements))
        .filter((reference): reference is AstryxStickyNoteReference =>
          Boolean(reference),
        );
      setStickyNotes((current) =>
        stickyNoteReferenceListsEqual(current, nextStickyNotes)
          ? current
          : nextStickyNotes,
      );
      /* FigJam keeps a bulleted sticky note as a list after the editor closes:
       * every non-empty line gets the list marker, including lines typed after
       * the list was enabled. Excalidraw only exposes plain text, so normalize
       * the committed text here (not while its inline editor owns the value).
       * That avoids resetting the caret while still persisting a real list. */
      const normalizedStickyListElements = appState.editingTextElement
        ? elements
        : elements.map((element) => {
            if (element.isDeleted || element.type !== "text") return element;
            const containerId = (element as { containerId?: string | null })
              .containerId;
            const container = containerId
              ? elements.find((candidate) => candidate.id === containerId)
              : undefined;
            const sticky = container
              ? stickyNoteReferenceForElement(container, elements)
              : undefined;
            if (!sticky?.format.bulletedList) return element;
            const textElement = element as ExcalidrawElement & {
              text: string;
              originalText?: string;
            };
            const text = canvasTextWithBulletedList(textElement.text, true);
            return text === textElement.text
              ? element
              : withCanvasElementUpdate(element, {
                  text,
                  originalText: text,
                } as Partial<ExcalidrawElement>);
          });
      const richStickyTextElements = normalizedStickyListElements.map((element) => {
        if (element.type !== "text") return element;
        const containerId = (element as { containerId?: string | null })
          .containerId;
        const container = containerId
          ? elements.find((candidate) => candidate.id === containerId)
          : undefined;
        const sticky = container
          ? stickyNoteReferenceForElement(container, elements)
          : undefined;
        const plainText = containerId
          ? undefined
          : canvasTextReferenceForElement(element);
        const richTextFormat = sticky?.format ?? plainText?.format;
        if (!richTextFormat || !stickyNoteUsesRichTextOverlay(richTextFormat)) {
          return element;
        }
        const nextOpacity =
          appState.editingTextElement?.id === element.id ? 100 : 0;
        return element.opacity === nextOpacity
          ? element
          : withCanvasElementUpdate(element, { opacity: nextOpacity });
      });
      /* Keep imported and already-created Sticky Notes on the same FigJam
       * baseline as new notes. This runs only outside inline editing so a
       * position correction never moves the user's live caret. */
      const positionedStickyTextElements = appState.editingTextElement
        ? richStickyTextElements
        : richStickyTextElements.map((element) => {
            if (element.isDeleted || element.type !== "text") return element;
            const containerId = (element as { containerId?: string | null })
              .containerId;
            const container = containerId
              ? richStickyTextElements.find(
                  (candidate) => candidate.id === containerId,
                )
              : undefined;
            const sticky = container
              ? stickyNoteReferenceForElement(
                  container,
                  richStickyTextElements,
                )
              : undefined;
            if (!sticky || !container) return element;
            const position = stickyNoteBoundTextPosition(container, {
              ...element,
              textAlign: "left",
            });
            return element.x === position.x && element.y === position.y
              ? element
              : withCanvasElementUpdate(element, position);
          });
      if (
        positionedStickyTextElements.some(
          (element, index) => element !== elements[index],
        )
      ) {
        window.requestAnimationFrame(() => {
          editorRef.current?.updateScene({
            elements: positionedStickyTextElements,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        });
      }
      const nextViewport = {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom.value,
      };
      setCanvasViewport((current) =>
        current.scrollX === nextViewport.scrollX &&
        current.scrollY === nextViewport.scrollY &&
        current.zoom === nextViewport.zoom
          ? current
          : nextViewport,
      );
      if (!loadedRef.current) return;
      const snapshot = serializeCanvas(
        elements,
        appState,
        files,
        canvasCommentsRef.current,
      );
      queueSnapshot(snapshot);
      const elementsVersion = hashElementsVersion(elements);
      const isRemoteApplication =
        remoteElementsVersionRef.current === elementsVersion &&
        Date.now() <= remoteBroadcastSuppressedUntilRef.current;
      if (isRemoteApplication) {
        remoteElementsVersionRef.current = undefined;
      } else {
        collaborationRef.current?.publishScene(snapshot);
      }
      persistEmbeddedFiles(files);
    },
    [deactivateStickyTool, markerMode, persistEmbeddedFiles, queueSnapshot],
  );

  useEffect(() => {
    const collaboration = openDesignerCanvasCollaboration({
      projectId,
      canvasId,
      onStatus: setCollaborationStatus,
      onPresence(collaborators) {
        remoteCollaboratorsRef.current = new Map(
          collaborators.map((collaborator) => [
            collaborator.clientId,
            collaborator,
          ]),
        );
        for (const clientId of remoteCursorsRef.current.keys()) {
          if (!remoteCollaboratorsRef.current.has(clientId)) {
            remoteCursorsRef.current.delete(clientId);
          }
        }
        setRemoteCollaborators(collaborators);
        syncCanvasCollaborators();
      },
      onCursor(cursor) {
        remoteCursorsRef.current.set(cursor.clientId, cursor);
        syncCanvasCollaborators();
      },
      onScene(value) {
        if (!isExcalidrawSnapshot(value)) return;
        const editor = editorRef.current;
        if (!editor) return;
        remoteElementsVersionRef.current = hashElementsVersion(value.elements);
        remoteBroadcastSuppressedUntilRef.current = Date.now() + 500;
        const files = { ...editor.getFiles(), ...value.files };
        const comments = normalizeDesignerCanvasComments(value.comments);
        canvasCommentsRef.current = comments;
        setCanvasComments(comments);
        const selectedElementIds = editor.getAppState().selectedElementIds;
        editor.addFiles(Object.values(value.files));
        editor.updateScene({
          elements: value.elements,
          appState: { selectedElementIds },
        });
        queueSnapshot(
          serializeCanvas(
            value.elements,
            editor.getAppState(),
            files,
            comments,
          ),
        );
      },
    });
    collaborationRef.current = collaboration;
    return () => {
      collaboration.close();
      if (collaborationRef.current === collaboration)
        collaborationRef.current = null;
    };
  }, [canvasId, projectId, queueSnapshot, syncCanvasCollaborators]);

  const canvasImagePlacement = useCallback((width: number, height: number) => {
    const editor = editorRef.current;
    if (!editor) return { x: 0, y: 0, width, height, frameId: undefined };
    const appState = editor.getAppState();
    const zoom = appState.zoom.value;
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / width);
    const placedWidth = Math.max(80, Math.round(width * scale));
    const placedHeight = Math.max(80, Math.round(height * scale));
    return {
      x: -appState.scrollX + appState.width / (2 * zoom) - placedWidth / 2,
      y: -appState.scrollY + appState.height / (2 * zoom) - placedHeight / 2,
      width: placedWidth,
      height: placedHeight,
      frameId: undefined,
    };
  }, []);

  const insertReference = useCallback(
    async (item: ResearchProjectItem) => {
      const editor = editorRef.current;
      if (!editor || !item.mediaUrl || item.restricted) return;
      setInsertingReferenceId(item.id);
      setReferenceMessage("");
      try {
        const response = await apiFetch(item.mediaUrl, {
          credentials: "same-origin",
        });
        if (!response.ok)
          throw new Error(`Reference image returned ${response.status}`);
        const blob = await response.blob();
        if (!canvasMediaMimeTypeSet.has(blob.type)) {
          throw new Error(
            "This reference is not a supported PNG, JPEG, or WebP image.",
          );
        }
        const fileId = crypto.randomUUID() as FileId;
        const dataURL = await blobDataUrl(blob);
        const assetUrl = await uploadProjectCanvasAsset(
          projectId,
          `asset:${fileId}`,
          blob,
        );
        const dimensions = await imageDimensions(blob);
        const placement = canvasImagePlacement(
          dimensions.width,
          dimensions.height,
        );
        const file: BinaryFileData = {
          id: fileId,
          mimeType: blob.type as BinaryFileData["mimeType"],
          dataURL,
          created: Date.now(),
        };
        const [image] = convertToExcalidrawElements([
          {
            type: "image",
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            fileId,
            status: "saved",
          },
        ]);
        const referenceImage = {
          ...image,
          frameId: placement.frameId ?? null,
          customData: {
            ...image.customData,
            astryxReference: {
              kind: "research-reference",
              itemId: item.id,
              appId: item.appId ?? null,
              title: item.snapshot.title,
            },
          },
        } as ExcalidrawElement;
        editor.addFiles([file]);
        persistedFileIdsRef.current.add(file.id);
        canvasAssetUrlsRef.current.set(file.id, assetUrl);
        editor.updateScene({
          elements: [...editor.getSceneElements(), referenceImage],
        });
        editor.scrollToContent(referenceImage, {
          animate: true,
          fitToViewport: false,
        });
        setReferenceMessage(
          `Added ${item.stepLabel || item.snapshot.title} to the canvas.`,
        );
      } catch (error) {
        setReferenceMessage((error as Error).message);
      } finally {
        setInsertingReferenceId(undefined);
      }
    },
    [canvasImagePlacement, projectId],
  );

  const insertCatalogScreen = useCallback(
    async (
      result: AppsDiscoveryScreenResult,
      dropPoint?: { x: number; y: number },
    ) => {
      const editor = editorRef.current;
      if (!editor) return;
      const { app, screen } = result;
      setInsertingScreenKey(projectScreenKey(result));
      setScreenMessage("");
      try {
        /* Same loader the App and Flow cards use: it fetches through the media
         proxy, stores the asset in the project, and keeps the bytes inline when
         that upload fails — so the card never points an <img> at a URL the page
         cannot load. */
        /* Catalog tiles may use a resized preview, but the canvas is evidence:
         only the original screen capture belongs on the board. */
        const loaded = await loadCatalogCardImage(screen.url, projectId);
        const image = loaded?.image;
        if (!image || !loaded) {
          setScreenMessage(
            "This screen image could not be loaded. Try another reference.",
          );
          return;
        }
        /* A drop names its own spot; repeated clicks cascade images to the right
         instead of stacking every newly chosen screen in the same place. */
        const auto = canvasImagePlacement(image.width, image.height);
        const lastScreenImage = dropPoint
          ? undefined
          : [...editor.getSceneElements()]
              .reverse()
              .find((element) => screenReferenceForElement(element));
        const placement = dropPoint
          ? {
              ...auto,
              x: dropPoint.x - auto.width / 2,
              y: dropPoint.y - auto.height / 2,
            }
          : lastScreenImage
            ? {
                ...auto,
                x: lastScreenImage.x + lastScreenImage.width + 40,
                y: lastScreenImage.y,
              }
            : auto;
        const [imageElement] = convertToExcalidrawElements([
          {
            type: "image",
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            fileId: image.fileId,
            status: "saved",
          },
        ]);
        const canvasImage = {
          ...imageElement,
          frameId: placement.frameId ?? null,
          customData: {
            ...imageElement.customData,
            astryxReference: {
              kind: "screen",
              appId: app.id,
              appName: app.app,
              screenId: screen.id,
              screenType: screen.type,
              platform: screen.platform,
              mediaUrl: screen.url,
              sourceUrl: screen.sourceUrl ?? null,
            },
          },
        } as ExcalidrawElement;
        editor.addFiles([loaded.file]);
        if (loaded.stored) {
          persistedFileIdsRef.current.add(loaded.file.id);
          canvasAssetUrlsRef.current.set(loaded.file.id, loaded.assetUrl!);
        }
        editor.updateScene({
          elements: [...editor.getSceneElements(), canvasImage],
          appState: { selectedElementIds: { [canvasImage.id]: true } },
        });
        editor.scrollToContent(canvasImage, {
          animate: true,
          fitToViewport: false,
        });
        showToast(
          loaded.stored
            ? `Added ${app.app} to the canvas.`
            : `Added ${app.app} to the canvas locally. Sign in to sync it.`,
        );
      } catch (error) {
        setScreenMessage((error as Error).message);
      } finally {
        setInsertingScreenKey(undefined);
      }
    },
    [canvasImagePlacement, projectId, showToast],
  );

  const insertCanvasDataReference = useCallback(
    async (
      reference: AstryxCanvasDataPayload,
      message: string,
      /* Where the reader dropped it. Without one the card cascades from the last
       one placed, which is right for a click and wrong for a drag. */
      placement?: { x: number; y: number },
      /* Thumbnail for the card's media band. */
      imageUrl?: string,
    ) => {
      const editor = editorRef.current;
      if (!editor) return;
      const appState = editor.getAppState();
      const zoom = appState.zoom.value;
      const sceneElements = editor.getSceneElements();
      const lastDataCard = [...sceneElements]
        .reverse()
        .find((element) => canvasDataReferenceForElement(element));
      const cardWidth = catalogCardLayout.width;
      const cardHeight = 340;
      const centerX =
        placement?.x ??
        (lastDataCard
          ? lastDataCard.x + lastDataCard.width + 40 + cardWidth / 2
          : -appState.scrollX + appState.width / (2 * zoom));
      const centerY =
        placement?.y ??
        (lastDataCard
          ? lastDataCard.y + cardHeight / 2
          : -appState.scrollY + appState.height / (2 * zoom));

      const isApp = reference.kind === "app";
      const loaded = await loadCatalogCardImage(imageUrl, projectId);
      const created = createCatalogCardElements({
        x: centerX,
        y: centerY,
        eyebrow: isApp ? "App" : "Flow",
        title: isApp ? reference.appName : reference.flowTitle,
        meta: isApp
          ? `${reference.category || reference.platform} · ${reference.totalScreens} screens`
          : `${reference.appName} · ${reference.stepCount} ${reference.stepCount === 1 ? "step" : "steps"}`,
        accent: isApp
          ? { stroke: "#9cb6df", fill: "#eef4ff" }
          : { stroke: "#9d94d8", fill: "#f2efff" },
        image: loaded?.image,
        reference: reference as unknown as Record<string, unknown>,
      });
      const container = created.find((element) => element.type === "rectangle");
      if (loaded) {
        editor.addFiles([loaded.file]);
        if (loaded.stored) {
          persistedFileIdsRef.current.add(loaded.file.id);
          canvasAssetUrlsRef.current.set(loaded.file.id, loaded.assetUrl!);
        }
      }
      editor.updateScene({
        elements: [...editor.getSceneElements(), ...created],
        appState: {
          selectedElementIds: container ? { [container.id]: true } : {},
        },
      });
      editor.scrollToContent(created, { animate: true, fitToViewport: false });
      if (container)
        setSelectedDataReference(canvasDataReferenceForElement(container));
      showToast(message);
    },
    [showToast],
  );

  const insertCatalogFlow = useCallback(
    async (
      item: FlowCatalogItem,
      platform: Platform,
      placement?: { x: number; y: number },
    ) => {
      const editor = editorRef.current;
      if (!editor) return;
      const stepEvidence = item.preview.flow.steps.flatMap(
        (step, stepIndex) => {
          const evidence = step.evidence[0];
          return evidence
            ? [{ evidence, stepIndex, stepLabel: step.label }]
            : [];
        },
      );
      /* Use the source captures. The thumbnail is for browsing; a placed Flow
         should remain sharp when a designer zooms into an individual step. */
      const loadedSteps = (
        await Promise.all(
          stepEvidence.map(async ({ evidence, stepIndex, stepLabel }) => {
            const loaded = await loadCatalogCardImage(
              evidence.imageUrl,
              projectId,
            );
            return loaded
              ? { ...loaded, evidence, stepIndex, stepLabel }
              : undefined;
          }),
        )
      ).filter((step): step is NonNullable<typeof step> => Boolean(step));
      if (loadedSteps.length === 0) {
        setScreenMessage(
          "This flow's screen images could not be loaded. Try another reference.",
        );
        return;
      }

      const { columns, cellWidth, cellHeight, gap, padding } =
        flowStoryboardLayout;
      const rows = Math.ceil(loadedSteps.length / columns);
      const storyboardWidth = columns * cellWidth + (columns - 1) * gap;
      const storyboardHeight = rows * cellHeight + (rows - 1) * gap;
      const appState = editor.getAppState();
      const zoom = appState.zoom.value;
      const centerX =
        placement?.x ?? -appState.scrollX + appState.width / (2 * zoom);
      const centerY =
        placement?.y ?? -appState.scrollY + appState.height / (2 * zoom);
      const left = centerX - storyboardWidth / 2;
      const top = centerY - storyboardHeight / 2;
      const elements = loadedSteps.map((step, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const scale = Math.min(
          (cellWidth - padding * 2) / step.image.width,
          (cellHeight - padding * 2) / step.image.height,
        );
        const width = Math.max(1, Math.round(step.image.width * scale));
        const height = Math.max(1, Math.round(step.image.height * scale));
        const x = left + column * (cellWidth + gap) + (cellWidth - width) / 2;
        const y = top + row * (cellHeight + gap) + (cellHeight - height) / 2;
        const [image] = convertToExcalidrawElements([
          {
            type: "image",
            x,
            y,
            width,
            height,
            fileId: step.image.fileId,
            status: "saved",
          },
        ]);
        return {
          ...image,
          customData: {
            ...image.customData,
            astryxReference: {
              kind: "flow",
              appId: item.preview.appId,
              appName: item.preview.appName,
              flowId: item.preview.sourceFlowId,
              flowTitle: item.title,
              category: item.category,
              description: item.preview.flow.description,
              platform,
              version: item.preview.version,
              stepCount: item.preview.screenCount,
              stepIndex: step.stepIndex,
              stepLabel: step.stepLabel,
              mediaUrl: step.evidence.imageUrl,
            },
          },
        } as ExcalidrawElement;
      });
      editor.addFiles(loadedSteps.map(({ file }) => file));
      loadedSteps.forEach(({ file, stored, assetUrl }) => {
        if (stored) {
          persistedFileIdsRef.current.add(file.id);
          if (assetUrl) canvasAssetUrlsRef.current.set(file.id, assetUrl);
        }
      });
      editor.updateScene({
        elements: [...editor.getSceneElements(), ...elements],
        appState: { selectedElementIds: { [elements[0].id]: true } },
      });
      editor.scrollToContent(elements, { animate: true, fitToViewport: false });
      setSelectedDataReference(canvasDataReferenceForElement(elements[0]));
      showToast(
        `Added ${loadedSteps.length} screens from ${item.title} to the canvas.`,
      );
    },
    [projectId, showToast],
  );

  const insertTemplate = useCallback((template: ProjectCanvasTemplate) => {
    const editor = editorRef.current;
    if (!editor) return;
    const appState = editor.getAppState();
    const zoom = appState.zoom.value;
    const minX = Math.min(...template.elements.map((element) => element.x));
    const minY = Math.min(...template.elements.map((element) => element.y));
    const maxX = Math.max(
      ...template.elements.map((element) => element.x + (element.width ?? 0)),
    );
    const maxY = Math.max(
      ...template.elements.map((element) => element.y + (element.height ?? 0)),
    );
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const centerX = -appState.scrollX + appState.width / (2 * zoom);
    const centerY = -appState.scrollY + appState.height / (2 * zoom);
    const offsetX = centerX - width / 2 - minX;
    const offsetY = centerY - height / 2 - minY;
    type ElementSkeleton = NonNullable<
      Parameters<typeof convertToExcalidrawElements>[0]
    >[number];
    const elements = convertToExcalidrawElements(
      template.elements.map((element) => ({
        ...element,
        x: element.x + offsetX,
        y: element.y + offsetY,
      })) as unknown as ElementSkeleton[],
    );
    editor.updateScene({
      elements: [...editor.getSceneElements(), ...elements],
    });
    editor.scrollToContent(elements, { animate: true, fitToViewport: false });
    setTemplatesOpen(false);
    setReferenceMessage(`Added ${template.title} to the canvas.`);
  }, []);

  const focusResearchFrame = useCallback((elementId: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const frame = editor
      .getSceneElements()
      .find(
        (element) =>
          !element.isDeleted &&
          element.type === "frame" &&
          element.id === elementId,
      );
    if (!frame) return;
    editor.setActiveTool({ type: "selection" });
    const backdrop = editor
      .getSceneElements()
      .find(
        (element) =>
          sectionBackdropReference(element)?.parentFrameId === frame.id,
      );
    editor.updateScene({
      appState: {
        selectedElementIds: {
          ...(backdrop ? { [backdrop.id]: true } : {}),
          [frame.id]: true,
        },
      },
    });
    editor.scrollToContent(frame, { animate: true, fitToViewport: true });
    setSelectedResearchFrame(
      researchFrameReferenceForElement(frame, editor.getSceneElements()),
    );
  }, []);

  const insertResearchFrame = useCallback(
    (preset: ProjectResearchFramePreset) => {
      const editor = editorRef.current;
      if (!editor) return;
      const appState = editor.getAppState();
      const zoom = appState.zoom.value;
      const sceneElements = editor.getSceneElements();
      const lastFrame = [...sceneElements]
        .reverse()
        .find((element) => !element.isDeleted && element.type === "frame");
      const x = lastFrame
        ? lastFrame.x + lastFrame.width + 96
        : -appState.scrollX +
          appState.width / (2 * zoom) -
          researchFrameWidth / 2;
      const y = lastFrame
        ? lastFrame.y
        : -appState.scrollY +
          appState.height / (2 * zoom) -
          researchFrameHeight / 2;
      const [frame] = convertToExcalidrawElements([
        {
          type: "frame",
          children: [],
          x,
          y,
          width: researchFrameWidth,
          height: researchFrameHeight,
          name: preset.title,
          groupIds: [],
          customData: {
            astryxReference: {
              kind: "research-frame",
              frameType: preset.id,
              fillColor: defaultSectionFill,
              strokeColor: defaultSectionStroke,
              strokeStyle: "solid",
              hidden: false,
              createdAt: new Date().toISOString(),
            },
          },
        } as ElementSkeleton,
      ]);
      const backdrop = createSectionBackdrop(frame);
      const groupedFrame = withCanvasElementUpdate(frame, {
        groupIds: [frame.id],
      } as Partial<ExcalidrawElement>);
      editor.setActiveTool({ type: "selection" });
      editor.updateScene({
        elements: [backdrop, ...sceneElements, groupedFrame],
        appState: {
          selectedElementIds: {
            [backdrop.id]: true,
            [groupedFrame.id]: true,
          },
        },
      });
      editor.scrollToContent(groupedFrame, {
        animate: true,
        fitToViewport: true,
      });
      setResearchFramesOpen(false);
    },
    [],
  );

  const drawResearchFrame = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    researchFrameStartIdsRef.current = new Set(
      editor
        .getSceneElements()
        .filter((element) => !element.isDeleted && element.type === "frame")
        .map((element) => element.id),
    );
    setResearchFramesOpen(false);
    setResearchFrameDrawing(true);
    deactivateStickyTool();
    setStickyDraft(undefined);
    deactivateTableTool();
    deactivateStampTool();
    setWidgetsLauncherOpen(false);
    setShapePlacement(undefined);
    setDocumentPlacement(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setReferencesOpen(false);
    editor.setActiveTool({ type: "frame" });
    editor.setCursor("crosshair");
  }, [deactivateStampTool, deactivateStickyTool, deactivateTableTool]);

  const finalizeResearchFrame = useCallback(
    (origin: { x: number; y: number }) => {
      window.requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const sceneElements = editor.getSceneElements();
        let frame = [...sceneElements]
          .reverse()
          .find(
            (element) =>
              !element.isDeleted &&
              element.type === "frame" &&
              !researchFrameStartIdsRef.current.has(element.id),
          );
        let nextElements = [...sceneElements];

        /* FigJam treats a click as a useful Section, while Excalidraw discards
           the zero-size frame. Create the same practical 420px default around
           the click, but preserve a deliberate drag's measured dimensions. */
        if (!frame || frame.width < 24 || frame.height < 24) {
          if (frame) {
            nextElements = nextElements.filter(
              (element) => element.id !== frame?.id,
            );
          }
          [frame] = convertToExcalidrawElements([
            {
              type: "frame",
              children: [],
              x: origin.x - defaultSectionSize / 2,
              y: origin.y - defaultSectionSize / 2,
              width: defaultSectionSize,
              height: defaultSectionSize,
            } as ElementSkeleton,
          ]);
        }

        const sectionNumber =
          nextElements.filter(
            (element) => !element.isDeleted && element.type === "frame",
          ).length +
          (nextElements.some((element) => element.id === frame?.id) ? 0 : 1);
        const title = `Section ${sectionNumber}`;
        const customData = frame.customData as
          | Record<string, unknown>
          | undefined;
        const normalizedFrame = withCanvasElementUpdate(frame, {
          name: title,
          groupIds: [frame.id],
          strokeColor: defaultSectionStroke,
          strokeStyle: "solid",
          roughness: 0,
          customData: {
            ...customData,
            astryxReference: {
              kind: "research-frame",
              frameType: "custom",
              fillColor: defaultSectionFill,
              strokeColor: defaultSectionStroke,
              strokeStyle: "solid",
              hidden: false,
              createdAt: new Date().toISOString(),
            },
          },
        } as Partial<ExcalidrawElement>);
        const backdrop = createSectionBackdrop(normalizedFrame);
        nextElements = nextElements.filter(
          (element) =>
            element.id !== frame?.id &&
            sectionBackdropReference(element)?.parentFrameId !== frame?.id,
        );
        editor.setActiveTool({ type: "selection" });
        editor.resetCursor();
        editor.updateScene({
          elements: [backdrop, ...nextElements, normalizedFrame],
          appState: {
            selectedElementIds: {
              [backdrop.id]: true,
              [normalizedFrame.id]: true,
            },
          },
        });
        setResearchFrameDrawing(false);
        setSelectedResearchFrame(
          researchFrameReferenceForElement(normalizedFrame, [
            backdrop,
            ...nextElements,
            normalizedFrame,
          ]),
        );
      });
    },
    [],
  );

  const updateSelectedResearchFrame = useCallback(
    (patch: {
      title?: string;
      fillColor?: string;
      strokeColor?: string;
      strokeStyle?: CanvasSectionLineStyle;
      hidden?: boolean;
      locked?: boolean;
    }) => {
      const editor = editorRef.current;
      const selected = selectedResearchFrame;
      if (!editor || !selected) return;
      const sceneElements = editor.getSceneElements();
      const frame = sceneElements.find(
        (element) => element.id === selected.elementId,
      );
      if (!frame) return;

      const fillColor = patch.fillColor ?? selected.fillColor;
      const strokeColor = patch.strokeColor ?? selected.strokeColor;
      const strokeStyle = patch.strokeStyle ?? selected.strokeStyle;
      const hidden = patch.hidden ?? selected.hidden;
      const locked = patch.locked ?? selected.locked;
      let foundBackdrop = false;
      const elements = sceneElements.map((element) => {
        if (element.id === frame.id) {
          const customData = element.customData as
            | Record<string, unknown>
            | undefined;
          const reference = customData?.astryxReference as
            | Record<string, unknown>
            | undefined;
          return withCanvasElementUpdate(element, {
            ...(patch.title !== undefined ? { name: patch.title } : {}),
            strokeColor: strokeStyle === "none" ? "transparent" : strokeColor,
            strokeStyle: strokeStyle === "none" ? "solid" : strokeStyle,
            locked,
            customData: {
              ...customData,
              astryxReference: {
                ...reference,
                kind: "research-frame",
                frameType: reference?.frameType ?? "custom",
                fillColor,
                strokeColor,
                strokeStyle,
                hidden,
              },
            },
          } as Partial<ExcalidrawElement>);
        }
        if (sectionBackdropReference(element)?.parentFrameId === frame.id) {
          foundBackdrop = true;
          return withCanvasElementUpdate(element, {
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
            strokeColor: hidden ? "#b3b3b3" : "transparent",
            backgroundColor: hidden ? "#757575" : fillColor,
            fillStyle: hidden ? "hachure" : "solid",
            opacity: hidden ? 32 : 100,
            locked: true,
          } as Partial<ExcalidrawElement>);
        }
        if (element.frameId === frame.id) {
          const customData = element.customData as
            | Record<string, unknown>
            | undefined;
          const storedOpacity = customData?.astryxSectionVisibleOpacity;
          if (hidden) {
            return withCanvasElementUpdate(element, {
              opacity: 0,
              customData: {
                ...customData,
                astryxSectionVisibleOpacity: element.opacity,
              },
            } as Partial<ExcalidrawElement>);
          }
          if (typeof storedOpacity === "number") {
            return withCanvasElementUpdate(element, {
              opacity: storedOpacity,
              customData: {
                ...customData,
                astryxSectionVisibleOpacity: undefined,
              },
            } as Partial<ExcalidrawElement>);
          }
        }
        return element;
      });
      const nextElements = foundBackdrop
        ? elements
        : [createSectionBackdrop(frame, { fillColor, hidden }), ...elements];
      editor.updateScene({
        elements: nextElements,
        appState: {
          selectedElementIds: locked
            ? {}
            : {
                ...(selected.backdropElementId
                  ? { [selected.backdropElementId]: true }
                  : {}),
                [frame.id]: true,
              },
        },
      });
      if (locked) setSelectedResearchFrame(undefined);
    },
    [selectedResearchFrame],
  );

  /* A Section is one object even though its persistent fill is a locked canvas
     child. Delete both parts atomically so Excalidraw never exposes the hidden
     backdrop as a standalone rectangle after the frame is removed. */
  useEffect(() => {
    const selected = selectedResearchFrame;
    if (!selected) return;
    const deleteSelectedSection = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        (event.key !== "Delete" && event.key !== "Backspace") ||
        target?.closest("input, textarea, [contenteditable='true']")
      )
        return;
      const editor = editorRef.current;
      if (!editor) return;
      event.preventDefault();
      event.stopPropagation();
      const elements = editor
        .getSceneElements()
        .map((element) =>
          element.id === selected.elementId ||
          sectionBackdropReference(element)?.parentFrameId ===
            selected.elementId
            ? withCanvasElementUpdate(element, { isDeleted: true })
            : element,
        );
      editor.updateScene({
        elements,
        appState: { selectedElementIds: {} },
      });
      setSelectedResearchFrame(undefined);
    };
    window.addEventListener("keydown", deleteSelectedSection, true);
    return () =>
      window.removeEventListener("keydown", deleteSelectedSection, true);
  }, [selectedResearchFrame]);

  const stopStickyPlacement = useCallback(() => {
    deactivateStickyTool();
    const editor = editorRef.current;
    editor?.resetCursor();
    editor?.setActiveTool({ type: "selection" });
  }, [deactivateStickyTool]);

  const stopTablePlacement = useCallback(() => {
    deactivateTableTool();
    const editor = editorRef.current;
    editor?.resetCursor();
    editor?.setActiveTool({ type: "selection" });
  }, [deactivateTableTool]);

  const stopDocumentPlacement = useCallback(() => {
    documentPlacementRef.current = false;
    setDocumentPlacement(false);
    const editor = editorRef.current;
    editor?.resetCursor();
    editor?.setActiveTool({ type: "selection" });
  }, []);

  const stopCommentPlacement = useCallback(() => {
    setCommentPlacement(false);
    const editor = editorRef.current;
    editor?.resetCursor();
    editor?.setActiveTool({ type: "selection" });
  }, []);

  const closeCommentsPanel = useCallback(() => {
    stopCommentPlacement();
    setCommentDraftAnchor(undefined);
    setCommentDraft("");
    setSelectedCommentId(undefined);
    setCommentsPanelOpen(false);
  }, [stopCommentPlacement]);

  const toggleCommentTool = useCallback(() => {
    if (commentsPanelOpen) {
      closeCommentsPanel();
      return;
    }
    stopStickyPlacement();
    stopDocumentPlacement();
    setCommentDraftAnchor(undefined);
    setCommentDraft("");
    setSelectedCommentId(undefined);
    setShapePlacement(undefined);
    deactivateTableTool();
    deactivateStampTool();
    setWidgetsLauncherOpen(false);
    setResearchFramesOpen(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setReferencesOpen(false);
    setToolsCatalogOpen(false);
    setCommentsPanelOpen(true);
    setCommentPlacement(true);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-comment" });
    editor?.setCursor(commentPlacementCursor);
  }, [
    closeCommentsPanel,
    commentsPanelOpen,
    deactivateStampTool,
    deactivateTableTool,
    stopDocumentPlacement,
    stopStickyPlacement,
  ]);

  const armDocumentPlacement = useCallback(() => {
    stopCommentPlacement();
    documentPlacementRef.current = true;
    setDocumentPlacement(true);
    setResearchFramesOpen(false);
    setStickyPickerOpen(false);
    setStickyDraft(undefined);
    setShapePlacement(undefined);
    deactivateTableTool();
    deactivateStampTool();
    setWidgetsLauncherOpen(false);
    stopStickyPlacement();
    setScreensOpen(false);
    setTemplatesOpen(false);
    setReferencesOpen(false);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-document" });
    editor?.setCursor("crosshair");
  }, [
    deactivateStampTool,
    deactivateTableTool,
    stopCommentPlacement,
    stopStickyPlacement,
  ]);

  const insertCanvasDocumentAt = useCallback((x: number, y: number) => {
    const editor = editorRef.current;
    const root = canvasRootRef.current;
    if (!editor || !root) return;
    const document: ProjectCanvasDocumentData = {
      documentId: crypto.randomUUID(),
      title: "Untitled doc",
      body: "",
      expanded: false,
    };
    const appState = editor.getAppState();
    const zoom = appState.zoom.value;
    // Excalidraw's scroll coordinates include its internal viewport offset.
    // Convert that screen-space offset back into scene units before clamping.
    const viewportTop = -appState.scrollY + appState.offsetTop / zoom;
    const minimumCenterY =
      viewportTop +
      canvasDocumentViewportTopSafeArea / zoom +
      canvasDocumentHeight / 2;
    const viewportLeft = -appState.scrollX + appState.offsetLeft / zoom;
    const viewportWidth = root.getBoundingClientRect().width / zoom;
    const minimumCenterX =
      viewportLeft +
      canvasDocumentViewportSideSafeArea / zoom +
      canvasDocumentWidth / 2;
    const maximumCenterX =
      viewportLeft +
      viewportWidth -
      canvasDocumentViewportSideSafeArea / zoom -
      canvasDocumentWidth / 2;
    const documentCenterX =
      maximumCenterX >= minimumCenterX
        ? Math.min(Math.max(x, minimumCenterX), maximumCenterX)
        : viewportLeft + viewportWidth / 2;
    const created = createCanvasDocumentElements({
      x: documentCenterX,
      y: Math.max(y, minimumCenterY),
      document,
    });
    const container = created.find((element) => element.type === "rectangle");
    editor.updateScene({
      elements: [...editor.getSceneElements(), ...created],
      appState: {
        selectedElementIds: container ? { [container.id]: true } : {},
        // Selecting a newly inserted 1080px document can make Excalidraw pan
        // the viewport to reveal its bounds. Preserve the user's camera so the
        // document remains below the floating project header.
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      },
    });
    if (container)
      setSelectedCanvasDocument(documentReferenceForElement(container));
  }, []);

  const insertCanvasCustomShapeAt = useCallback(
    (
      x: number,
      y: number,
      shape: CanvasShapeOption,
      size?: { width: number; height: number },
    ) => {
      const editor = editorRef.current;
      if (!editor || !shape.customShape) return;
      const created = createCanvasCustomShapeElements({
        shape,
        x,
        y,
        color: shapeColor,
        ...size,
      });
      if (created.length === 0) return;
      editor.updateScene({
        elements: [...editor.getSceneElements(), ...created],
        appState: {
          selectedElementIds: Object.fromEntries(
            created.map((element) => [element.id, true]),
          ),
        },
      });
    },
    [shapeColor],
  );

  const insertCanvasTableAt = useCallback((x: number, y: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const created = createCanvasTableElements({ x, y });
    editor.updateScene({
      elements: [...editor.getSceneElements(), ...created],
      appState: {
        selectedElementIds: Object.fromEntries(
          created.map((element) => [element.id, true]),
        ),
      },
    });
  }, []);

  const insertCanvasStampAt = useCallback(
    async (
      x: number,
      y: number,
      stamp: CanvasStampOption,
      selectedElementIds: AppState["selectedElementIds"],
    ) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (stamp.id === "profile") {
        const created = createCanvasProfileStampElements({ x, y, userName });
        editor.updateScene({
          elements: [...editor.getSceneElements(), ...created],
          appState: { selectedElementIds },
        });
        return;
      }
      try {
        const asset = await cachedCanvasStampAsset(stamp.asset);
        const fileId = crypto.randomUUID() as FileId;
        const file: BinaryFileData = {
          id: fileId,
          ...asset,
          created: Date.now(),
        };
        const image = createCanvasStampElement({ x, y, fileId, stamp });
        editor.addFiles([file]);
        editor.updateScene({
          elements: [...editor.getSceneElements(), image],
          appState: { selectedElementIds },
        });
      } catch (error) {
        showToast(`Could not add ${stamp.label.toLowerCase()} stamp.`);
        console.error(error);
      }
    },
    [showToast, userName],
  );

  const handleCanvasPlacementPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const stamp = stampPlacementRef.current;
      const document = documentPlacementRef.current;
      const target = event.target as HTMLElement;
      if (event.button !== 0 || !target.closest(".excalidraw__canvas")) return;
      if (!tablePlacementRef.current && !stamp && !document) {
        if (canvasTableCellSelectionRef.current) {
          if (event.detail <= 1) {
            event.preventDefault();
            event.stopPropagation();
          }
          editorRef.current?.updateScene({
            appState: {
              selectedElementIds: {},
              selectedGroupIds: {},
              editingGroupId: null,
            },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
        return;
      }

      const editor = editorRef.current;
      const root = canvasRootRef.current;
      if (!editor || !root) return;
      const appState = editor.getAppState();
      const zoom = appState.zoom.value;
      const rect = root.getBoundingClientRect();
      const placement = {
        x: (event.clientX - rect.left) / zoom - appState.scrollX,
        y: (event.clientY - rect.top) / zoom - appState.scrollY,
      };

      // Excalidraw finalizes its own click selection after the DOM pointer-up.
      // Add custom objects on the next frame so reconciliation cannot restore
      // the pre-click scene over the newly created elements.
      window.requestAnimationFrame(() => {
        if (documentPlacementRef.current) {
          insertCanvasDocumentAt(placement.x, placement.y);
          stopDocumentPlacement();
          return;
        }
        if (tablePlacementRef.current) {
          insertCanvasTableAt(placement.x, placement.y);
          stopTablePlacement();
          return;
        }
        const currentStamp = stampPlacementRef.current;
        if (currentStamp)
          void insertCanvasStampAt(
            placement.x,
            placement.y,
            currentStamp,
            appState.selectedElementIds,
          );
      });
    },
    [
      insertCanvasDocumentAt,
      insertCanvasStampAt,
      insertCanvasTableAt,
      stopDocumentPlacement,
      stopTablePlacement,
    ],
  );

  const selectCanvasStamp = useCallback((stamp: CanvasStampOption) => {
    setActiveStampId(stamp.id);
    stampPlacementRef.current = stamp;
    setStampPlacement(stamp);
    setStampPickerOpen(false);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-stamp" });
    editor?.setCursor("crosshair");
  }, []);

  const toggleStampTool = useCallback(() => {
    if (stampPlacementRef.current) {
      setStampPickerOpen((open) => !open);
      return;
    }
    stopStickyPlacement();
    stopCommentPlacement();
    setDocumentPlacement(false);
    setShapePickerOpen(false);
    setShapeLibraryOpen(false);
    setShapePlacement(undefined);
    setMarkerDrawing(false);
    setResearchFrameDrawing(false);
    deactivateTableTool();
    setScreensOpen(false);
    setTemplatesOpen(false);
    setReferencesOpen(false);
    setToolsCatalogOpen(false);
    setWidgetsLauncherOpen(false);
    const stamp =
      canvasStampOptions.find((option) => option.id === activeStampId) ??
      defaultCanvasStamp;
    stampPlacementRef.current = stamp;
    setStampPlacement(stamp);
    setStampPickerOpen(true);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-stamp" });
    editor?.setCursor("crosshair");
  }, [
    activeStampId,
    deactivateTableTool,
    stopCommentPlacement,
    stopStickyPlacement,
  ]);

  const toggleTableTool = useCallback(() => {
    if (tablePlacement) {
      stopTablePlacement();
      return;
    }
    stopStickyPlacement();
    stopCommentPlacement();
    setDocumentPlacement(false);
    setShapePickerOpen(false);
    setShapeLibraryOpen(false);
    setShapePlacement(undefined);
    setMarkerDrawing(false);
    setResearchFrameDrawing(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setReferencesOpen(false);
    setToolsCatalogOpen(false);
    setWidgetsLauncherOpen(false);
    deactivateStampTool();
    tablePlacementRef.current = true;
    setTablePlacement(true);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-table" });
    editor?.setCursor("crosshair");
  }, [
    stopCommentPlacement,
    stopStickyPlacement,
    stopTablePlacement,
    deactivateStampTool,
    tablePlacement,
  ]);

  const armStickyPlacement = useCallback(
    (
      color: ProjectStickyNoteColor,
      mode: StickyPlacementMode,
      keepPickerOpen = false,
    ) => {
      closeCommentsPanel();
      // Sticky Notes is a complete canvas mode. It can be entered through the
      // toolbar or the N shortcut, so it must clear every competing family here
      // instead of relying on whichever caller happened to open it.
      setShapePickerOpen(false);
      setShapeLibraryOpen(false);
      setShapeLibraryQuery("");
      setMarkerDrawing(false);
      setResearchFrameDrawing(false);
      deactivateTableTool();
      deactivateStampTool();
      setWidgetsLauncherOpen(false);
      setShapePlacement(undefined);
      setDocumentPlacement(false);
      setStickyPickerOpen(keepPickerOpen);
      setResearchFramesOpen(false);
      setStickyDraft(undefined);
      setStickyToolColor(color);
      stickyPlacementRef.current = { color, mode };
      setStickyPlacement({ color, mode });
      setScreensOpen(false);
      setTemplatesOpen(false);
      setReferencesOpen(false);
      const editor = editorRef.current;
      editor?.setActiveTool({
        type: "custom",
        customType: "astryx-sticky-note",
      });
      editor?.setCursor(stickyNotePlacementCursor(color, mode));
    },
    [closeCommentsPanel, deactivateStampTool, deactivateTableTool],
  );

  const toggleStickyNoteTool = useCallback(() => {
    if (stickyPickerOpen || stickyPlacement) {
      stopStickyPlacement();
      return;
    }
    stopDocumentPlacement();
    editorRef.current?.updateScene({
      appState: {
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
      },
    });
    selectedStickyNoteRef.current = undefined;
    setSelectedStickyNote(undefined);
    setSelectedCanvasTable(undefined);
    setSelectedCanvasText(undefined);
    setSelectedCanvasShape(undefined);
    setSelectedResearchFrame(undefined);
    armStickyPlacement(stickyToolColor, "single", true);
  }, [
    armStickyPlacement,
    stickyToolColor,
    stickyPickerOpen,
    stickyPlacement,
    stopDocumentPlacement,
    stopStickyPlacement,
  ]);

  const toggleShapePicker = useCallback(() => {
    setShapePickerOpen((open) => !open);
    setShapeLibraryOpen(false);
    setShapeLibraryQuery("");
    setShapePlacement(undefined);
    editorRef.current?.resetCursor();
    deactivateStickyTool();
    setStickyDraft(undefined);
    deactivateStampTool();
    setWidgetsLauncherOpen(false);
    setDocumentPlacement(false);
    setCommentPlacement(false);
    deactivateTableTool();
  }, [deactivateStickyTool, deactivateTableTool, deactivateStampTool]);

  const selectCanvasShape = useCallback(
    (shape: CanvasShapeOption) => {
      setActiveShapeOptionId(shape.id);
      const editor = editorRef.current;
      const isFilledShape =
        shape.tool === "rectangle" ||
        shape.tool === "ellipse" ||
        shape.tool === "diamond";
      editor?.updateScene({
        appState: {
          currentItemStrokeColor: isFilledShape ? "#757575" : shapeColor,
          currentItemBackgroundColor: isFilledShape
            ? shapeColor
            : "transparent",
          currentItemFillStyle: "solid",
          currentItemStrokeWidth: 2,
          currentItemRoughness: 0,
          currentItemRoundness: shape.roundness ?? "sharp",
          currentItemArrowType: shape.arrowType ?? "sharp",
        },
      });
      if (shape.customShape) {
        shapePlacementPointerRef.current = undefined;
        setShapePlacement(shape);
        editor?.setActiveTool({
          type: "custom",
          customType: `astryx-shape:${shape.id}`,
        });
        editor?.setCursor("crosshair");
      } else if (shape.tool) {
        shapePlacementPointerRef.current = undefined;
        setShapePlacement(undefined);
        editor?.resetCursor();
        editor?.setActiveTool({ type: shape.tool });
      }
      setShapePickerOpen(true);
      setShapeLibraryOpen(false);
      setShapeLibraryQuery("");
      setShapeColorPickerOpen(false);
      deactivateStickyTool();
      setStickyDraft(undefined);
      setDocumentPlacement(false);
      setCommentPlacement(false);
      deactivateTableTool();
    },
    [deactivateStickyTool, deactivateTableTool, shapeColor],
  );

  const selectCanvasShapeColor = useCallback(
    (color: string) => {
      setShapeColor(color);
      setShapeColorPickerOpen(false);
      const activeShape = canvasShapeOptions.find(
        (shape) => shape.id === activeShapeOptionId,
      );
      const isFilledShape =
        activeShape?.tool === "rectangle" ||
        activeShape?.tool === "ellipse" ||
        activeShape?.tool === "diamond";
      editorRef.current?.updateScene({
        appState: {
          currentItemStrokeColor: isFilledShape ? "#757575" : color,
          currentItemBackgroundColor: isFilledShape ? color : "transparent",
          currentItemFillStyle: "solid",
          currentItemStrokeWidth: 2,
          currentItemRoughness: 0,
        },
      });
    },
    [activeShapeOptionId],
  );

  const selectMarkerMode = useCallback(
    (mode: CanvasMarkerMode) => {
      const editor = editorRef.current;
      setMarkerMode(mode);
      setMarkerDrawing(true);
      setShapePlacement(undefined);
      deactivateStickyTool();
      setStickyDraft(undefined);
      deactivateTableTool();
      deactivateStampTool();
      setWidgetsLauncherOpen(false);
      if (!editor) return;
      if (mode === "eraser") {
        editor.setActiveTool({ type: "eraser" });
        return;
      }
      const color = mode === "highlighter" ? highlighterColor : markerColor;
      editor.updateScene({
        appState: {
          currentItemStrokeColor: color,
          currentItemStrokeWidth: canvasMarkerStrokeWidth(
            mode,
            markerStrokeWeight,
          ),
          currentItemOpacity: canvasMarkerOpacity(mode),
          currentItemRoughness: 0,
        },
      });
      editor.setActiveTool({ type: "freedraw" });
    },
    [
      deactivateStickyTool,
      deactivateStampTool,
      deactivateTableTool,
      highlighterColor,
      markerColor,
      markerStrokeWeight,
    ],
  );

  const selectMarkerStrokeWeight = useCallback(
    (weight: CanvasMarkerStrokeWeight) => {
      setMarkerStrokeWeight(weight);
      setShapePlacement(undefined);
      if (markerMode === "eraser") return;
      const editor = editorRef.current;
      if (!editor) return;
      editor.updateScene({
        appState: {
          currentItemStrokeWidth: canvasMarkerStrokeWidth(markerMode, weight),
          currentItemOpacity: canvasMarkerOpacity(markerMode),
          currentItemRoughness: 0,
        },
      });
      editor.setActiveTool({ type: "freedraw" });
    },
    [markerMode],
  );

  const selectMarkerColor = useCallback(
    (color: string) => {
      if (markerMode === "eraser") return;
      if (markerMode === "highlighter") setHighlighterColor(color);
      else setMarkerColor(color);
      setMarkerColorTransition((transition) => !transition);
      setShapePlacement(undefined);
      const editor = editorRef.current;
      if (!editor) return;
      editor.updateScene({
        appState: {
          currentItemStrokeColor: color,
          currentItemStrokeWidth: canvasMarkerStrokeWidth(
            markerMode,
            markerStrokeWeight,
          ),
          currentItemOpacity: canvasMarkerOpacity(markerMode),
          currentItemRoughness: 0,
        },
      });
      editor.setActiveTool({ type: "freedraw" });
    },
    [markerMode, markerStrokeWeight],
  );

  const toggleWidgetsLauncher = useCallback(() => {
    const nextOpen = !widgetsLauncherOpen;
    stopStickyPlacement();
    stopDocumentPlacement();
    stopCommentPlacement();
    deactivateTableTool();
    deactivateStampTool();
    setShapePickerOpen(false);
    setShapeLibraryOpen(false);
    setShapePlacement(undefined);
    setMarkerDrawing(false);
    setResearchFrameDrawing(false);
    setResearchFramesOpen(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setReferencesOpen(false);
    setToolsCatalogOpen(false);
    setWidgetsLauncherQuery("");
    setWidgetsLauncherTab("all");
    setWidgetsLauncherOpen(nextOpen);
    editorRef.current?.setActiveTool({ type: "selection" });
    editorRef.current?.resetCursor();
  }, [
    deactivateStampTool,
    deactivateTableTool,
    stopCommentPlacement,
    stopDocumentPlacement,
    stopStickyPlacement,
    widgetsLauncherOpen,
  ]);

  const activateCanvasTool = useCallback(
    (tool: ProjectCanvasTool) => {
      setToolsCatalogQuery("");
      setShapePickerOpen(false);
      setShapePlacement(undefined);

      if (tool === "more") {
        const nextOpen = !toolsCatalogOpen;
        stopStickyPlacement();
        stopDocumentPlacement();
        stopCommentPlacement();
        deactivateTableTool();
        deactivateStampTool();
        setResearchFramesOpen(false);
        setScreensOpen(false);
        setTemplatesOpen(false);
        setReferencesOpen(false);
        setWidgetsLauncherOpen(false);
        setToolsCatalogOpen(nextOpen);
        return;
      }

      setToolsCatalogOpen(false);
      setWidgetsLauncherOpen(false);
      deactivateStampTool();
      if (tool === "sticky") {
        toggleStickyNoteTool();
        return;
      }
      if (tool === "comments") {
        toggleCommentTool();
        return;
      }
      if (tool === "document") {
        if (documentPlacement) stopDocumentPlacement();
        else armDocumentPlacement();
        return;
      }

      stopStickyPlacement();
      stopDocumentPlacement();
      stopCommentPlacement();
      setResearchFramesOpen(false);
      setScreensOpen(false);
      setTemplatesOpen(false);
      setReferencesOpen(false);

      if (tool === "screens") {
        setScreensOpen(!screensOpen);
      } else if (tool === "research-frames") {
        editorRef.current?.setActiveTool({ type: "selection" });
        editorRef.current?.resetCursor();
        setResearchFrameDrawing(false);
        setResearchFramesOpen(!researchFramesOpen);
      } else if (tool === "templates") {
        setTemplatesOpen(!templatesOpen);
      }
    },
    [
      armDocumentPlacement,
      deactivateStampTool,
      deactivateTableTool,
      documentPlacement,
      researchFramesOpen,
      screensOpen,
      stopDocumentPlacement,
      stopStickyPlacement,
      stopCommentPlacement,
      templatesOpen,
      toggleStickyNoteTool,
      toggleCommentTool,
      toolsCatalogOpen,
    ],
  );

  const openWidgetsTool = useCallback(
    (tool: ProjectCanvasTool | "stamp") => {
      setWidgetsLauncherOpen(false);
      if (tool === "stamp") {
        toggleStampTool();
        return;
      }
      activateCanvasTool(tool);
    },
    [activateCanvasTool, toggleStampTool],
  );

  const insertStickyNotesAt = useCallback(
    (
      x: number,
      y: number,
      color: ProjectStickyNoteColor,
      labels: readonly string[],
      format = defaultProjectStickyNoteFormat,
    ) => {
      const editor = editorRef.current;
      if (!editor) return;
      const created = labels.flatMap((text, index) =>
        createStickyNoteElements({
          x: x + index * 18,
          y: y + index * 18,
          color,
          text,
          format,
        }),
      );
      const lastContainer = [...created]
        .reverse()
        .find((element) => element.type === "rectangle");
      editor.updateScene({
        elements: [...editor.getSceneElements(), ...created],
        appState: {
          selectedElementIds: lastContainer ? { [lastContainer.id]: true } : {},
        },
      });
      return lastContainer?.id;
    },
    [],
  );

  const commitStickyDraft = useCallback(
    (
      value = stickyDraft?.value ?? "",
      /*
       * Whether to pull focus back to the board and select the new note. True for
       * a deliberate finish (⌘↵), false when the draft ended because the reader
       * clicked somewhere else: they have already said where they want to be, and
       * running focus() plus a re-select 80ms later dragged them back to the note
       * they had just left — and re-selected it after their click had deselected.
       */
      { selectNote = true }: { selectNote?: boolean } = {},
    ) => {
      if (!stickyDraft) return;
      const editingElementId = stickyDraft.editingElementId;
      const editingTextElementId = stickyDraft.editingTextElementId;
      setStickyDraft(undefined);
      if (editingElementId && editingTextElementId) {
        const editor = editorRef.current;
        const elements = editor?.getSceneElements();
        const container = elements?.find(
          (element) => element.id === editingElementId,
        );
        const textElement = elements?.find(
          (element) => element.id === editingTextElementId,
        );
        if (editor && container && textElement?.type === "text") {
          const text = stickyDraft.format.bulletedList
            ? canvasTextWithBulletedList(value, true)
            : value;
          const updatedText = withCanvasElementUpdate(textElement, {
            text,
            originalText: text,
            textAlign: "left",
          } as Partial<ExcalidrawElement>);
          // Updating only `text` leaves the previous glyph measurements on
          // the element. Recalculate against its bound sticker before putting
          // it back into the scene so edited text cannot be clipped.
          const dimensions = stickyNoteTextDimensionsForContainer(
            container,
            updatedText,
            text,
          );
          const nextContainer = stickyNoteContainerForBoundText(
            container,
            dimensions.height,
          );
          const position = stickyNoteBoundTextPosition(nextContainer, {
            ...updatedText,
            ...dimensions,
            textAlign: "left",
          });
          editor.updateScene({
            elements: elements.map((element) => {
              if (element.id === editingElementId) return nextContainer;
              return element.id === editingTextElementId
                ? withCanvasElementUpdate(updatedText, {
                    ...dimensions,
                    ...position,
                  })
                : element;
            }),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
        }
        return;
      }
      const text = value.trim();
      const selectedElementId = insertStickyNotesAt(
        stickyDraft.x,
        stickyDraft.y,
        stickyDraft.color,
        [text],
        stickyDraft.format,
      );

      if (selectedElementId && selectNote) {
        window.setTimeout(() => {
          const editor = editorRef.current;
          canvasRootRef.current
            ?.querySelector<HTMLElement>(".excalidraw__canvas")
            ?.focus({ preventScroll: true });
          editor?.setActiveTool({ type: "selection" });
          editor?.updateScene({
            appState: {
              selectedElementIds: { [selectedElementId]: true },
            },
          });
          editor?.refresh();
        }, 80);
      }
    },
    [insertStickyNotesAt, stickyDraft],
  );

  const cancelStickyDraft = useCallback(() => {
    setStickyDraft(undefined);
    window.requestAnimationFrame(() => {
      canvasRootRef.current
        ?.querySelector<HTMLElement>(".excalidraw__canvas")
        ?.focus({ preventScroll: true });
    });
  }, []);

  /*
   * The dragged catalog record, held in a ref rather than dataTransfer: these
   * are whole records, and a ref avoids serialising and reparsing them. The
   * dataTransfer still carries a label so the drag is valid to the OS.
   */
  const catalogDragRef = useRef<CatalogDragPayload | undefined>(undefined);
  /* Whether a catalog drag is currently over the board. Drives the drop
     affordance — a target that accepts a drop should say so. */
  const [catalogDropActive, setCatalogDropActive] = useState(false);

  /*
   * Native listeners on document, in the capture phase. React attaches its
   * synthetic handlers at the app root, and Excalidraw runs its own drag/drop on
   * the canvas — capturing at document means we see the event before either, and
   * stopping it there keeps both out of a catalog drag.
   */
  useEffect(() => {
    const readPayload = (
      transfer: DataTransfer | null,
    ): CatalogDragPayload | undefined => {
      if (!transfer) return catalogDragRef.current;
      try {
        const raw = transfer.getData(catalogDragMimeType);
        if (raw) return JSON.parse(raw) as CatalogDragPayload;
      } catch {
        /* getData is unreadable during dragover in some browsers; fall through. */
      }
      return catalogDragRef.current;
    };

    const isOverBoard = (event: DragEvent) => {
      const root = canvasRootRef.current;
      const target = event.target as Node | null;
      return Boolean(root && target && root.contains(target));
    };

    /* Array.from first: `types` is a DOMStringList in some engines, where
       `.includes` is not a method and throws — taking the whole listener with
       it, so nothing claims the drag and the drop silently never happens. */
    const carriesCatalog = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes(
        catalogDragMimeType,
      ) || Boolean(catalogDragRef.current);

    const onDragOver = (event: DragEvent) => {
      if (!isOverBoard(event) || !carriesCatalog(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setCatalogDropActive(true);
    };

    const onDragLeave = (event: DragEvent) => {
      if (!isOverBoard(event)) setCatalogDropActive(false);
    };

    const onDrop = (event: DragEvent) => {
      if (!isOverBoard(event) || !carriesCatalog(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setCatalogDropActive(false);

      const payload = readPayload(event.dataTransfer);
      const editor = editorRef.current;
      const root = canvasRootRef.current;
      catalogDragRef.current = undefined;
      if (!payload || !editor || !root) return;

      /* Screen point to scene point: the inverse of how every overlay is
         placed, screen = (scene + scroll) * zoom. */
      const appState = editor.getAppState();
      const zoom = appState.zoom.value;
      const rect = root.getBoundingClientRect();
      const placement = {
        x: (event.clientX - rect.left) / zoom - appState.scrollX,
        y: (event.clientY - rect.top) / zoom - appState.scrollY,
      };

      if (payload.kind === "flow") {
        insertCatalogFlow(
          payload.item,
          payload.platform as Platform,
          placement,
        );
      } else {
        void insertCatalogScreen(payload.result, placement);
      }
    };

    const onDragEnd = () => {
      catalogDragRef.current = undefined;
      setCatalogDropActive(false);
    };

    document.addEventListener("dragenter", onDragOver, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("dragleave", onDragLeave, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("dragend", onDragEnd, true);
    return () => {
      document.removeEventListener("dragenter", onDragOver, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("dragend", onDragEnd, true);
    };
  }, [insertCatalogFlow, insertCatalogScreen]);

  const handleCanvasPointerUp = useCallback(
    (
      _activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
    ) => {
      setToolsCatalogOpen(false);
      // Insert Astryx elements after Excalidraw finishes its own pointer-up
      // reconciliation. Updating the scene from onPointerDown lets Excalidraw's
      // selection handler restore the pre-click scene and discard the new item.
      // The visible placement state remains the source of truth because custom
      // tools may be normalized back to selection before this callback runs.
      if (_activeTool.type === "frame" || researchFrameDrawing) {
        finalizeResearchFrame(pointerDownState.origin);
        return;
      }
      if (shapePlacement) {
        const origin = pointerDownState.origin;
        const endpoint = shapePlacementPointerRef.current;
        const deltaX = endpoint ? endpoint.x - origin.x : 0;
        const deltaY = endpoint ? endpoint.y - origin.y : 0;
        const hasDragBounds = Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8;
        const x = hasDragBounds ? origin.x + deltaX / 2 : origin.x;
        const y = hasDragBounds ? origin.y + deltaY / 2 : origin.y;
        insertCanvasCustomShapeAt(
          x,
          y,
          shapePlacement,
          hasDragBounds
            ? { width: Math.abs(deltaX), height: Math.abs(deltaY) }
            : undefined,
        );
        shapePlacementPointerRef.current = undefined;
        setShapePlacement(undefined);
        editorRef.current?.resetCursor();
        return;
      }
      if (commentPlacement) {
        const { x, y } = pointerDownState.origin;
        setCommentDraftAnchor({ x, y });
        setCommentDraft("");
        setSelectedCommentId(undefined);
        stopCommentPlacement();
        return;
      }
      if (!stickyPlacement) return;
      const { x, y } = pointerDownState.origin;
      if (stickyPlacement.mode === "stack") {
        insertStickyNotesAt(x, y, stickyPlacement.color, [
          "New idea",
          "New idea",
          "New idea",
        ]);
        stopStickyPlacement();
        return;
      }
      const draft = {
        x,
        y,
        color: stickyPlacement.color,
        value: "",
        format: defaultProjectStickyNoteFormat,
      };
      /* stopStickyPlacement clears the previous draft as part of switching the
         editor back to Select. Run it first so the new composer survives the
         same React batch instead of being cleared immediately. */
      stopStickyPlacement();
      setStickyDraft(draft);
    },
    [
      commentPlacement,
      finalizeResearchFrame,
      insertCanvasCustomShapeAt,
      insertStickyNotesAt,
      shapePlacement,
      stickyPlacement,
      researchFrameDrawing,
      stopCommentPlacement,
      stopStickyPlacement,
    ],
  );

  useEffect(() => {
    const handleStickyShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        canvasTextEditingRef.current ||
        target?.closest("input, textarea, [contenteditable='true']")
      )
        return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        toggleStickyNoteTool();
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        toggleStampTool();
      } else if (event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        drawResearchFrame();
      } else if (
        (stickyPlacementRef.current ||
          tablePlacementRef.current ||
          stampPlacementRef.current) &&
        ["v", "1", "h", "p", "7", "t", "8", "9"].includes(
          event.key.toLowerCase(),
        )
      ) {
        // Let Excalidraw handle the native shortcut after clearing Vitrines'
        // persistent placement mode.
        deactivateStickyTool();
        setStickyDraft(undefined);
        deactivateTableTool();
        deactivateStampTool();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setToolsCatalogOpen(false);
        setShapePickerOpen(false);
        setResearchFramesOpen(false);
        setScreensOpen(false);
        setTemplatesOpen(false);
        stopDocumentPlacement();
        stopCommentPlacement();
        setCommentDraftAnchor(undefined);
        setSelectedCommentId(undefined);
        setStickyPickerOpen(false);
        deactivateTableTool();
        deactivateStampTool();
        setWidgetsLauncherOpen(false);
        cancelStickyDraft();
        stopStickyPlacement();
      }
    };
    window.addEventListener("keydown", handleStickyShortcut, true);
    return () =>
      window.removeEventListener("keydown", handleStickyShortcut, true);
  }, [
    cancelStickyDraft,
    deactivateStickyTool,
    deactivateStampTool,
    deactivateTableTool,
    drawResearchFrame,
    stopCommentPlacement,
    stopDocumentPlacement,
    stopStickyPlacement,
    toggleStampTool,
    toggleStickyNoteTool,
  ]);

  /*
   * Positioned from the reactive viewport, like every other canvas overlay —
   * not from a one-off editorRef.getAppState() read. Two bugs came out of that:
   * a null ref (a remount, or a first render before the editor reports in) made
   * this return undefined, and the composer renders only when it is defined, so
   * the draft existed with nothing on screen to type into — and `stickyDraft`
   * also turns off handleKeyboardGlobally, so the board went unresponsive with
   * no way back. It also never recomputed on pan or zoom, because refs do not
   * re-render and the deps only moved when the draft itself changed.
   */
  const stickyComposerStyle = useMemo(() => {
    if (!stickyDraft) return undefined;
    const root = canvasRootRef.current;
    const { scrollX, scrollY, zoom } = canvasViewport;
    /*
     * The composer is a screen-space stand-in for a canvas element, so it has to
     * scale with the board. Its position already did; its size did not, so at
     * 50% zoom it covered twice the note it was standing in for, and at 200%
     * half of it. Text and padding scale with the box for the same reason.
     */
    const noteWidth = stickyDraft.width ?? stickyNoteSize;
    const noteHeight = stickyDraft.height ?? stickyNoteSize;
    const width = noteWidth * zoom;
    const height = noteHeight * zoom;
    const noteLeft = (stickyDraft.x - noteWidth / 2 + scrollX) * zoom;
    const noteTop = (stickyDraft.y - noteHeight / 2 + scrollY) * zoom;
    /* Clamp inside the canvas when it has been measured; before that, place it
       where asked rather than withholding the composer entirely. */
    const maxLeft = root
      ? Math.max(76, root.clientWidth - width - 16)
      : noteLeft;
    const maxTop = root
      ? Math.max(96, root.clientHeight - height - 16)
      : noteTop;
    return {
      left: `${Math.min(Math.max(76, noteLeft), Math.max(76, maxLeft))}px`,
      top: `${Math.min(Math.max(96, noteTop), Math.max(96, maxTop))}px`,
      /* min() keeps the narrow-screen guard the stylesheet used to provide. */
      width: `min(${width}px, calc(100vw - 24px))`,
      height: `min(${height}px, calc(100vw - 24px))`,
      "--sticky-fill": stickyDraft.color.fill,
      "--sticky-stroke": stickyDraft.color.stroke,
      "--sticky-text": stickyDraft.color.text,
      "--sticky-font-family":
        stickyDraft.format.font === "cute"
          ? '"Virgil", "Comic Sans MS", cursive'
          : stickyDraft.format.font === "technical"
            ? '"Cascadia Code", ui-monospace, SFMono-Regular, Menlo, monospace'
            : stickyDraft.format.font === "bookish"
              ? '"Lilita One", "Arial Rounded MT Bold", cursive'
              : 'var(--reference-font-family, "Figtree", system-ui, sans-serif)',
      "--sticky-font-size": `${stickyDraft.format.fontSize * zoom}px`,
      "--sticky-padding-horizontal": `${stickyNoteTextHorizontalInset * zoom}px`,
      "--sticky-padding-top": `${stickyNoteTextVerticalInset * zoom}px`,
      // The board is intentionally light regardless of the surrounding app
      // theme, so applying a dark-theme filter here made the draft differ from
      // the exact palette color rendered by Excalidraw after insertion.
      "--sticky-theme-filter": "none",
    } as CSSProperties;
  }, [canvasViewport, stickyDraft]);

  /*
   * Colour, type and collaboration for an existing note. Two elements carry it:
   * the container holds the fill, stroke, link and the customData mirror, while
   * the bound text holds font, size, alignment and ink — so a colour change has
   * to touch both or the label keeps the old contrast.
   */
  const updateSelectedStickyNote = useCallback(
    (patch: {
      color?: ProjectStickyNoteColor;
      format?: ProjectStickyNoteFormat;
      collaboration?: ProjectStickyNoteCollaboration;
    }) => {
      const editor = editorRef.current;
      const note = selectedStickyNoteRef.current ?? selectedStickyNote;
      if (!editor || !note) return;
      const color = patch.color ?? note.color;
      const format = {
        ...normalizeProjectStickyNoteFormat(patch.format ?? note.format),
        textAlign: "left" as const,
      };
      const collaboration = patch.collaboration ?? note.collaboration;
      const bulletedListChanged =
        format.bulletedList !== note.format.bulletedList;

      let elements = editor.getSceneElements().map((element) => {
        if (element.id === note.elementId) {
          const customData = element.customData as
            | Record<string, unknown>
            | undefined;
          const reference = customData?.astryxReference as
            | Record<string, unknown>
            | undefined;
          return withCanvasElementUpdate(element, {
            strokeColor: color.stroke,
            backgroundColor: color.fill,
            link: format.link || null,
            locked: format.locked,
            customData: {
              ...customData,
              astryxReference: {
                ...reference,
                color: color.id,
                format,
                collaboration,
              },
            },
          } as Partial<ExcalidrawElement>);
        }
        if (note.textElementId && element.id === note.textElementId) {
          const textElement = element as ExcalidrawElement & {
            text: string;
            originalText?: string;
          };
          const nextText = bulletedListChanged
            ? canvasTextWithBulletedList(textElement.text, format.bulletedList)
            : textElement.text;
          return withCanvasElementUpdate(element, {
            fontSize: format.fontSize,
            fontFamily: projectStickyNoteFontFamilies[format.font],
            textAlign: format.textAlign,
            strokeColor: color.text,
            // Rich text is rendered by the positioned Vitrines overlay below.
            // Keeping this native text invisible avoids the doubled label while
            // preserving it for Excalidraw selection, editing and persistence.
            opacity: stickyNoteUsesRichTextOverlay(format) ? 0 : 100,
            ...(bulletedListChanged
              ? { text: nextText, originalText: nextText }
              : {}),
          } as Partial<ExcalidrawElement>);
        }
        return element;
      });
      /*
       * A bound Excalidraw label stores its alignment separately from its
       * position. Updating only `textAlign` makes the menu state persist but
       * leaves the label at the old left-aligned coordinates. Recalculate the
       * bound position from the updated scene so Left, Center and Right move
       * the note's visible text as well as its saved format.
       */
      if (note.textElementId) {
        const container = elements.find((element) => element.id === note.elementId);
        const textElement = elements.find(
          (element) => element.id === note.textElementId,
        );
        if (container && textElement?.type === "text") {
          const position = stickyNoteBoundTextPosition(container, textElement);
          elements = elements.map((element) =>
            element.id === note.textElementId
              ? withCanvasElementUpdate(element, position)
              : element,
          );
        }
      }
      const nextNote: AstryxStickyNoteReference = {
        ...note,
        color,
        format,
        collaboration,
      };
      selectedStickyNoteRef.current = nextNote;
      setSelectedStickyNote((current) =>
        current?.elementId === note.elementId ? nextNote : current,
      );
      editor.updateScene({
        elements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [selectedStickyNote],
  );

  /* Every contextual toolbar shares the focus container's anchor and 8px gap.
     Only horizontal clamping varies by the toolbar's actual width. */
  const canvasObjectToolbarStyle = useMemo(() => {
    if (!selectedCanvasFocusBounds) return undefined;
    return {
      "--project-object-toolbar-anchor-x": `${selectedCanvasFocusBounds.left + selectedCanvasFocusBounds.width / 2}px`,
      "--project-object-toolbar-top": `${Math.max(8, selectedCanvasFocusBounds.top - 48)}px`,
    } as CSSProperties;
  }, [selectedCanvasFocusBounds]);

  const stickyToolbarStyle = canvasObjectToolbarStyle;
  const canvasTextToolbarStyle = canvasObjectToolbarStyle;

  const selectedCanvasTableCells = useMemo(() => {
    if (!selectedCanvasTable) return [];
    const selectedIds = new Set(selectedCanvasTable.selectedCellIds);
    return selectedCanvasTable.cells.filter((cell) =>
      selectedIds.has(cell.elementId),
    );
  }, [selectedCanvasTable]);

  const selectedCanvasTableHasCellSelection = Boolean(
    selectedCanvasTable &&
    selectedCanvasTable.selectedCellIds.length > 0 &&
    selectedCanvasTable.selectedCellIds.length <
      selectedCanvasTable.cells.length,
  );

  const selectedCanvasTableMergeAction = useMemo<
    "merge" | "unmerge" | undefined
  >(() => {
    if (!selectedCanvasTable) return undefined;
    if (
      selectedCanvasTableCells.length === 1 &&
      (selectedCanvasTableCells[0].rowSpan > 1 ||
        selectedCanvasTableCells[0].columnSpan > 1)
    )
      return "unmerge";
    if (
      selectedCanvasTableCells.length < 2 ||
      selectedCanvasTableCells.length === selectedCanvasTable.cells.length ||
      selectedCanvasTableCells.some(
        (cell) => cell.rowSpan !== 1 || cell.columnSpan !== 1,
      )
    )
      return undefined;
    const rows = selectedCanvasTableCells.map((cell) => cell.row);
    const columns = selectedCanvasTableCells.map((cell) => cell.column);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minColumn = Math.min(...columns);
    const maxColumn = Math.max(...columns);
    const expectedCellCount =
      (maxRow - minRow + 1) * (maxColumn - minColumn + 1);
    return selectedCanvasTableCells.length === expectedCellCount
      ? "merge"
      : undefined;
  }, [selectedCanvasTable, selectedCanvasTableCells]);

  const canvasTableToolbarStyle = useMemo(() => {
    if (!canvasObjectToolbarStyle) return undefined;
    return {
      ...canvasObjectToolbarStyle,
      "--project-object-toolbar-half-width": "241px",
    } as CSSProperties;
  }, [canvasObjectToolbarStyle]);

  const canvasTableControlsStyle = useMemo(() => {
    if (!selectedCanvasTable) return undefined;
    const { scrollX, scrollY, zoom } = canvasViewport;
    return {
      left: `${(selectedCanvasTable.x + scrollX) * zoom}px`,
      top: `${(selectedCanvasTable.y + scrollY) * zoom}px`,
      width: `${selectedCanvasTable.width * zoom}px`,
      height: `${selectedCanvasTable.height * zoom}px`,
      "--canvas-table-column-width": `${(selectedCanvasTable.width / selectedCanvasTable.columns) * zoom}px`,
      "--canvas-table-row-height": `${(selectedCanvasTable.height / selectedCanvasTable.rows) * zoom}px`,
      "--canvas-table-column-count": selectedCanvasTable.columns,
      "--canvas-table-row-count": selectedCanvasTable.rows,
    } as CSSProperties;
  }, [canvasViewport, selectedCanvasTable]);

  const canvasShapeToolbarStyle = useMemo(() => {
    if (!canvasObjectToolbarStyle) return undefined;
    return {
      ...canvasObjectToolbarStyle,
      "--project-object-toolbar-half-width": "92px",
    } as CSSProperties;
  }, [canvasObjectToolbarStyle]);

  const canvasFreeLineToolbarStyle = useMemo(() => {
    if (!selectedCanvasFreeLine || !selectedCanvasFocusBounds) return undefined;
    return {
      // Use the same rendered bounds as the focus container, so the toolbar
      // sits immediately above the selected line rather than following an
      // independent viewport calculation.
      "--project-free-line-toolbar-left": `${selectedCanvasFocusBounds.left}px`,
      "--project-object-toolbar-top": `${Math.max(16, selectedCanvasFocusBounds.top - 48)}px`,
    } as CSSProperties;
  }, [selectedCanvasFocusBounds, selectedCanvasFreeLine]);

  // Washi is no longer offered as a free-line editing mode. Existing Washi
  // strokes remain intact, but present as Marker until the reader changes a
  // property, preventing an unselected tool state in the shared toolbar.
  const selectedFreeLineToolbarMode =
    selectedCanvasFreeLine?.mode === "highlighter" ? "highlighter" : "marker";

  const sectionToolbarStyle = useMemo(() => {
    if (!canvasObjectToolbarStyle) return undefined;
    return {
      ...canvasObjectToolbarStyle,
      "--project-object-toolbar-half-width": "156px",
    } as CSSProperties;
  }, [canvasObjectToolbarStyle]);

  useEffect(() => {
    setSelectedShapePanel(undefined);
  }, [selectedCanvasShape?.elementId]);

  useEffect(() => {
    setSelectedFreeLineColorOpen(false);
  }, [selectedCanvasFreeLine?.elementId]);

  useEffect(() => {
    selectedCanvasFreeLineRef.current = selectedCanvasFreeLine;
  }, [selectedCanvasFreeLine]);

  useEffect(() => {
    setSelectedFramePanel(undefined);
    setSelectedFrameNameDraft(selectedResearchFrame?.title ?? "");
  }, [selectedResearchFrame?.elementId, selectedResearchFrame?.title]);

  const updateSelectedCanvasShape = useCallback(
    (patch: {
      type?: CanvasSelectableShapeType;
      fillColor?: string;
      strokeColor?: string;
      strokeStyle?: CanvasShapeLineStyle;
      opacity?: number;
    }) => {
      const editor = editorRef.current;
      const shape = selectedCanvasShape;
      if (!editor || !shape) return;
      const elements = editor.getSceneElements().map((element) =>
        element.id === shape.elementId
          ? withCanvasElementUpdate(element, {
              ...(patch.type ? { type: patch.type } : {}),
              ...(patch.fillColor !== undefined
                ? { backgroundColor: patch.fillColor, fillStyle: "solid" }
                : {}),
              ...(patch.strokeColor !== undefined
                ? { strokeColor: patch.strokeColor }
                : {}),
              ...(patch.strokeStyle !== undefined
                ? { strokeStyle: patch.strokeStyle }
                : {}),
              ...(patch.opacity !== undefined
                ? { opacity: patch.opacity }
                : {}),
              roughness: 0,
            } as Partial<ExcalidrawElement>)
          : element,
      );
      editor.updateScene({
        elements,
        appState: {
          ...(patch.fillColor !== undefined
            ? { currentItemBackgroundColor: patch.fillColor }
            : {}),
          ...(patch.strokeColor !== undefined
            ? { currentItemStrokeColor: patch.strokeColor }
            : {}),
          ...(patch.strokeStyle !== undefined
            ? { currentItemStrokeStyle: patch.strokeStyle }
            : {}),
          ...(patch.opacity !== undefined
            ? { currentItemOpacity: patch.opacity }
            : {}),
        },
      });
    },
    [selectedCanvasShape],
  );

  const updateSelectedCanvasFreeLine = useCallback(
    (patch: {
      color?: string;
      mode?: Exclude<CanvasMarkerMode, "eraser">;
      weight?: CanvasMarkerStrokeWeight;
    }) => {
      const editor = editorRef.current;
      const freeLine = selectedCanvasFreeLineRef.current;
      if (!editor || !freeLine) return;
      const mode = patch.mode ?? freeLine.mode;
      const weight = patch.weight ?? freeLine.weight;
      const color = patch.color ?? freeLine.color;
      const elements = editor.getSceneElements().map((element) =>
        element.id === freeLine.elementId
          ? withCanvasElementUpdate(element, {
              strokeColor: color,
              strokeWidth: canvasMarkerStrokeWidth(mode, weight),
              opacity: canvasMarkerOpacity(mode),
              roughness: 0,
            } as Partial<ExcalidrawElement>)
          : element,
      );
      const patchedFreeLine = elements
        .map(canvasFreeLineReferenceForElement)
        .find(
          (reference): reference is CanvasFreeLineReference =>
            reference?.elementId === freeLine.elementId,
        );
      editor.updateScene({
        elements,
        appState: {
          currentItemStrokeColor: color,
          currentItemStrokeWidth: canvasMarkerStrokeWidth(mode, weight),
          currentItemOpacity: canvasMarkerOpacity(mode),
          currentItemRoughness: 0,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      // Excalidraw synchronously emits its selection change while replacing
      // the scene. Read the committed element afterwards so that event cannot
      // restore the pre-click thin/color state in our custom toolbar.
      const nextFreeLine =
        editor
          .getSceneElements()
          .map(canvasFreeLineReferenceForElement)
          .find(
            (reference): reference is CanvasFreeLineReference =>
              reference?.elementId === freeLine.elementId,
          ) ?? patchedFreeLine;
      if (nextFreeLine) {
        selectedCanvasFreeLineRef.current = nextFreeLine;
        setSelectedCanvasFreeLine(nextFreeLine);
      }
    },
    [],
  );

  const updateSelectedCanvasText = useCallback(
    (patch: {
      color?: ProjectStickyNoteColor;
      format?: ProjectStickyNoteFormat;
    }) => {
      const editor = editorRef.current;
      const text = selectedCanvasText;
      if (!editor || !text) return;
      const color = patch.color ?? text.color;
      const format = patch.format ?? text.format;
      const bulletedListChanged =
        format.bulletedList !== text.format.bulletedList;
      const elements = editor.getSceneElements().map((element) => {
        if (element.id !== text.elementId) return element;
        const textElement = element as ExcalidrawElement & {
          text: string;
          originalText?: string;
        };
        const nextText = bulletedListChanged
          ? canvasTextWithBulletedList(textElement.text, format.bulletedList)
          : textElement.text;
        return withCanvasElementUpdate(element, {
          fontSize: format.fontSize,
          fontFamily: projectStickyNoteFontFamilies[format.font],
          textAlign: format.textAlign,
          strokeColor: color.text,
          // Excalidraw has no rich-text model. Use its text element for
          // editing and persistence, then render bold/strikethrough through
          // the positioned Vitrines layer when the editor is closed.
          opacity: stickyNoteUsesRichTextOverlay(format) ? 0 : 100,
          link: format.link || null,
          locked: format.locked,
          customData: {
            ...element.customData,
            astryxTextFormat: format,
          },
          ...(bulletedListChanged
            ? { text: nextText, originalText: nextText }
            : {}),
        } as Partial<ExcalidrawElement>);
      });
      editor.updateScene({
        elements,
        appState: {
          currentItemFontSize: format.fontSize,
          currentItemFontFamily: projectStickyNoteFontFamilies[format.font],
          currentItemTextAlign: format.textAlign,
          currentItemStrokeColor: color.text,
        },
      });
    },
    [selectedCanvasText],
  );

  const updateSelectedCanvasTable = useCallback(
    (patch: {
      color?: ProjectStickyNoteColor;
      format?: ProjectStickyNoteFormat;
    }) => {
      const editor = editorRef.current;
      const table = selectedCanvasTable;
      if (!editor || !table) return;
      const color = patch.color ?? table.color;
      const format = patch.format ?? table.format;
      const selectedCellIds = new Set(
        table.selectedCellIds.length > 0
          ? table.selectedCellIds
          : table.cells.map((cell) => cell.elementId),
      );
      const selectedTextIds = new Set(
        table.cells
          .filter((cell) => selectedCellIds.has(cell.elementId))
          .flatMap((cell) => (cell.textElementId ? [cell.textElementId] : [])),
      );
      const elements = editor.getSceneElements().map((element) => {
        if (selectedCellIds.has(element.id)) {
          const customData = element.customData as
            | Record<string, unknown>
            | undefined;
          const reference = customData?.astryxReference as
            | Record<string, unknown>
            | undefined;
          return withCanvasElementUpdate(element, {
            backgroundColor: color.fill,
            strokeColor: color.stroke,
            customData: {
              ...customData,
              astryxReference: {
                ...reference,
                color: color.id,
                format,
              },
            },
          } as Partial<ExcalidrawElement>);
        }
        if (!selectedTextIds.has(element.id)) return element;
        const textElement = element as ExcalidrawElement & {
          text: string;
          originalText?: string;
        };
        const nextText =
          format.bulletedList !== table.format.bulletedList
            ? canvasTextWithBulletedList(textElement.text, format.bulletedList)
            : textElement.text;
        return withCanvasElementUpdate(element, {
          fontSize: format.fontSize,
          fontFamily: projectStickyNoteFontFamilies[format.font],
          textAlign: format.textAlign,
          strokeColor: color.text,
          link: format.link || null,
          customData: { ...element.customData, astryxTextFormat: format },
          ...(nextText !== textElement.text
            ? { text: nextText, originalText: nextText }
            : {}),
        } as Partial<ExcalidrawElement>);
      });
      editor.updateScene({
        elements,
        appState: {
          currentItemBackgroundColor: color.fill,
          currentItemStrokeColor: color.text,
          currentItemFontSize: format.fontSize,
          currentItemFontFamily: projectStickyNoteFontFamilies[format.font],
          currentItemTextAlign: format.textAlign,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [selectedCanvasTable],
  );

  const selectCanvasTableCells = useCallback(
    (cellIds: readonly string[]) => {
      if (!selectedCanvasTable) return;
      const nextTable = canvasTableWithSelectedCells(
        selectedCanvasTable,
        cellIds,
      );
      canvasTableCellSelectionRef.current = {
        tableId: selectedCanvasTable.tableId,
        cellIds: nextTable.selectedCellIds,
      };
      setSelectedCanvasTable(nextTable);
      editorRef.current?.updateScene({
        appState: {
          selectedElementIds: {},
          selectedGroupIds: {},
          editingGroupId: null,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [selectedCanvasTable],
  );

  const preserveCanvasTableCellSelection = useCallback(
    (tableId: string, cellIds: readonly string[]) => {
      canvasTableCellSelectionRef.current = { tableId, cellIds };
      setSelectedCanvasTable((current) => {
        if (!current || current.tableId !== tableId) return current;
        return canvasTableWithSelectedCells(current, cellIds);
      });
    },
    [],
  );

  const addCanvasTableAxis = useCallback(
    (axis: "row" | "column") => {
      const editor = editorRef.current;
      const table = selectedCanvasTable;
      if (!editor || !table) return;
      const created =
        axis === "row"
          ? createCanvasTableCells({
              left: table.x,
              top: table.y + table.height,
              rows: 1,
              columns: table.columns,
              startRow: table.rows,
              tableId: table.tableId,
              groupId: table.groupId,
              color: table.color,
              format: table.format,
            })
          : createCanvasTableCells({
              left: table.x + table.width,
              top: table.y,
              rows: table.rows,
              columns: 1,
              startColumn: table.columns,
              tableId: table.tableId,
              groupId: table.groupId,
              color: table.color,
              format: table.format,
            });
      preserveCanvasTableCellSelection(
        table.tableId,
        created.map((element) => element.id),
      );
      editor.updateScene({
        elements: [...editor.getSceneElements(), ...created],
        appState: {
          editingGroupId: null,
          selectedGroupIds: {},
          selectedElementIds: {},
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [preserveCanvasTableCellSelection, selectedCanvasTable],
  );

  const toggleSelectedCanvasTableMerge = useCallback(() => {
    const editor = editorRef.current;
    const table = selectedCanvasTable;
    const action = selectedCanvasTableMergeAction;
    if (!editor || !table || !action) return;

    const withTableCellMetadata = (
      element: ExcalidrawElement,
      patch: Record<string, unknown>,
    ) => {
      const customData = element.customData as
        | Record<string, unknown>
        | undefined;
      const reference = customData?.astryxReference as
        | Record<string, unknown>
        | undefined;
      return {
        ...customData,
        astryxReference: { ...reference, ...patch },
      };
    };

    if (action === "merge") {
      const rows = selectedCanvasTableCells.map((cell) => cell.row);
      const columns = selectedCanvasTableCells.map((cell) => cell.column);
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      const minColumn = Math.min(...columns);
      const maxColumn = Math.max(...columns);
      const anchor =
        selectedCanvasTableCells.find(
          (cell) => cell.row === minRow && cell.column === minColumn,
        ) ?? selectedCanvasTableCells[0];
      const left = Math.min(...selectedCanvasTableCells.map((cell) => cell.x));
      const top = Math.min(...selectedCanvasTableCells.map((cell) => cell.y));
      const right = Math.max(
        ...selectedCanvasTableCells.map((cell) => cell.x + cell.width),
      );
      const bottom = Math.max(
        ...selectedCanvasTableCells.map((cell) => cell.y + cell.height),
      );
      const removedCellIds = new Set(
        selectedCanvasTableCells
          .filter((cell) => cell.elementId !== anchor.elementId)
          .map((cell) => cell.elementId),
      );
      const removedTextIds = new Set(
        selectedCanvasTableCells.flatMap((cell) =>
          cell.elementId !== anchor.elementId && cell.textElementId
            ? [cell.textElementId]
            : [],
        ),
      );
      const elements = editor.getSceneElements().map((element) => {
        if (element.id === anchor.elementId) {
          return withCanvasElementUpdate(element, {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
            customData: withTableCellMetadata(element, {
              row: minRow,
              column: minColumn,
              rowSpan: maxRow - minRow + 1,
              columnSpan: maxColumn - minColumn + 1,
            }),
          } as Partial<ExcalidrawElement>);
        }
        if (removedCellIds.has(element.id) || removedTextIds.has(element.id)) {
          return withCanvasElementUpdate(element, {
            isDeleted: true,
          } as Partial<ExcalidrawElement>);
        }
        return element;
      });
      preserveCanvasTableCellSelection(table.tableId, [anchor.elementId]);
      editor.updateScene({
        elements,
        appState: {
          editingGroupId: null,
          selectedGroupIds: {},
          selectedElementIds: {},
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      return;
    }

    const mergedCell = selectedCanvasTableCells[0];
    const cellWidth = mergedCell.width / mergedCell.columnSpan;
    const cellHeight = mergedCell.height / mergedCell.rowSpan;
    const replacements = createCanvasTableCells({
      left: mergedCell.x,
      top: mergedCell.y,
      rows: mergedCell.rowSpan,
      columns: mergedCell.columnSpan,
      startRow: mergedCell.row,
      startColumn: mergedCell.column,
      cellWidth,
      cellHeight,
      tableId: table.tableId,
      groupId: table.groupId,
      color: table.color,
      format: table.format,
    }).slice(1);
    const elements = editor.getSceneElements().map((element) =>
      element.id === mergedCell.elementId
        ? withCanvasElementUpdate(element, {
            width: cellWidth,
            height: cellHeight,
            customData: withTableCellMetadata(element, {
              rowSpan: 1,
              columnSpan: 1,
            }),
          } as Partial<ExcalidrawElement>)
        : element,
    );
    const replacementCellIds = [
      mergedCell.elementId,
      ...replacements.map((element) => element.id),
    ];
    preserveCanvasTableCellSelection(table.tableId, replacementCellIds);
    editor.updateScene({
      elements: [...elements, ...replacements],
      appState: {
        editingGroupId: null,
        selectedGroupIds: {},
        selectedElementIds: {},
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [
    selectedCanvasTable,
    selectedCanvasTableCells,
    selectedCanvasTableMergeAction,
    preserveCanvasTableCellSelection,
  ]);

  const stickyNoteMetadataStyle = useCallback(
    (note: AstryxStickyNoteReference) =>
      ({
        // FigJam keeps the author inside the note, aligned with its text
        // inset rather than presenting it as an external collaboration pill.
        left: `${(note.x + stickyNoteTextHorizontalInset + canvasViewport.scrollX) * canvasViewport.zoom}px`,
        top: `${(note.y + note.height - 30 + canvasViewport.scrollY) * canvasViewport.zoom}px`,
        maxWidth: `${stickyNoteTextContentWidth(note.width) * canvasViewport.zoom}px`,
        opacity: canvasViewport.zoom < 0.35 ? 0 : 1,
      }) as CSSProperties,
    [canvasViewport],
  );

  const stickyNotePlaceholderStyle = useCallback(
    (note: AstryxStickyNoteReference) =>
      ({
        left: `${(note.x + stickyNoteTextHorizontalInset + canvasViewport.scrollX) * canvasViewport.zoom}px`,
        top: `${(note.y + stickyNoteTextVerticalInset + canvasViewport.scrollY) * canvasViewport.zoom}px`,
        width: `${stickyNoteTextContentWidth(note.width) * canvasViewport.zoom}px`,
        fontSize: `${note.format.fontSize * canvasViewport.zoom}px`,
        opacity: canvasViewport.zoom < 0.35 ? 0 : 1,
      }) as CSSProperties,
    [canvasViewport],
  );

  const stickyNoteRichTextStyle = useCallback(
    (note: AstryxStickyNoteReference) =>
      ({
        left: `${(note.x + stickyNoteTextHorizontalInset + canvasViewport.scrollX) * canvasViewport.zoom}px`,
        top: `${(note.y + stickyNoteTextVerticalInset + canvasViewport.scrollY) * canvasViewport.zoom}px`,
        width: `${stickyNoteTextContentWidth(note.width) * canvasViewport.zoom}px`,
        color: note.color.text,
        fontSize: `${note.format.fontSize * canvasViewport.zoom}px`,
        fontWeight: note.format.bold ? 700 : 400,
        textDecoration: note.format.strikethrough ? "line-through" : "none",
        "--sticky-rich-font-family":
          note.format.font === "cute"
            ? '"Virgil", "Comic Sans MS", cursive'
            : note.format.font === "technical"
              ? '"Cascadia Code", ui-monospace, SFMono-Regular, Menlo, monospace'
              : note.format.font === "bookish"
                ? '"Lilita One", "Arial Rounded MT Bold", cursive'
                : 'var(--reference-font-family, "Figtree", system-ui, sans-serif)',
        opacity: canvasViewport.zoom < 0.35 ? 0 : 1,
      }) as CSSProperties,
    [canvasViewport],
  );

  const canvasTextRichTextStyle = useCallback(
    (text: CanvasTextReference) =>
      ({
        left: `${(text.x + canvasViewport.scrollX) * canvasViewport.zoom}px`,
        top: `${(text.y + canvasViewport.scrollY) * canvasViewport.zoom}px`,
        minWidth: `${Math.max(0, text.width * canvasViewport.zoom)}px`,
        color: text.color.text,
        fontSize: `${text.format.fontSize * canvasViewport.zoom}px`,
        fontWeight: text.format.bold ? 700 : 400,
        textDecoration: text.format.strikethrough ? "line-through" : "none",
        textAlign: text.format.textAlign,
        "--sticky-rich-font-family":
          text.format.font === "cute"
            ? '"Virgil", "Comic Sans MS", cursive'
            : text.format.font === "technical"
              ? '"Cascadia Code", ui-monospace, SFMono-Regular, Menlo, monospace'
              : text.format.font === "bookish"
                ? '"Lilita One", "Arial Rounded MT Bold", cursive'
                : 'var(--reference-font-family, "Figtree", system-ui, sans-serif)',
        opacity: canvasViewport.zoom < 0.35 ? 0 : 1,
      }) as CSSProperties,
    [canvasViewport],
  );

  const canvasDocumentStyle = useCallback(
    (document: AstryxCanvasDocumentReference) => {
      return {
        left: `${(document.x + canvasViewport.scrollX) * canvasViewport.zoom}px`,
        top: `${(document.y + canvasViewport.scrollY) * canvasViewport.zoom}px`,
        transform: `scale(${canvasViewport.zoom})`,
        transformOrigin: "top left",
        "--canvas-document-inverse-zoom": 1 / canvasViewport.zoom,
      } as CSSProperties;
    },
    [canvasViewport],
  );

  const replaceCanvasDocument = useCallback(
    (document: ProjectCanvasDocumentData) => {
      const editor = editorRef.current;
      const selected = selectedCanvasDocument;
      if (!editor || !selected) return;
      const sceneElements = editor.getSceneElements();
      const replacedIds = new Set([
        selected.elementId,
        ...sceneElements
          .filter(
            (element) =>
              (element as ExcalidrawElement & { containerId?: string | null })
                .containerId === selected.elementId,
          )
          .map((element) => element.id),
      ]);
      const created = createCanvasDocumentElements({
        x: selected.x + selected.width / 2,
        y: selected.y + selected.height / 2,
        document,
      });
      const container = created.find((element) => element.type === "rectangle");
      editor.updateScene({
        elements: [
          ...sceneElements.filter((element) => !replacedIds.has(element.id)),
          ...created,
        ],
        appState: {
          selectedElementIds: container ? { [container.id]: true } : {},
        },
      });
      if (container)
        setSelectedCanvasDocument(documentReferenceForElement(container));
    },
    [selectedCanvasDocument],
  );

  const dismissCanvasDocument = useCallback(() => {
    editorRef.current?.updateScene({ appState: { selectedElementIds: {} } });
    setSelectedCanvasDocument(undefined);
  }, []);

  const retryCanvas = useCallback(() => {
    if (pendingSnapshotRef.current) {
      setSaveState("saving");
      void flushCanvas();
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    setSaveState("loading");
    void (
      canvasId
        ? getDesignerCanvasFile(projectId, canvasId)
        : getDesignerCanvas(projectId)
    )
      .then(async (canvas) => {
        if (isExcalidrawSnapshot(canvas.snapshot)) {
          const comments = normalizeDesignerCanvasComments(
            canvas.snapshot.comments,
          );
          canvasCommentsRef.current = comments;
          setCanvasComments(comments);
          lastQueuedSnapshotKeyRef.current = canvasSaveKey(canvas.snapshot);
          editor.addFiles(Object.values(canvas.snapshot.files));
          editor.updateScene({
            elements: canvas.snapshot.elements,
            appState: canvas.snapshot.appState as AppState,
          });
        } else {
          const snapshot = serializeCanvas(
            editor.getSceneElementsIncludingDeleted(),
            editor.getAppState(),
            editor.getFiles(),
            canvasCommentsRef.current,
          );
          if (canvasId)
            await saveDesignerCanvasFile(projectId, canvasId, snapshot);
          else await saveDesignerCanvas(projectId, snapshot);
        }
        if (activeRef.current) setSaveState("saved");
      })
      .catch((error) => {
        if (!activeRef.current) return;
        setSaveState(
          error instanceof DesignerCanvasApiError && error.status === 404
            ? "unavailable"
            : "offline",
        );
      });
  }, [canvasId, flushCanvas, projectId]);

  const selectedComment = canvasComments.find(
    (thread) => thread.id === selectedCommentId,
  );
  const submitCanvasComment = useCallback(
    (body: string) => {
      const now = new Date().toISOString();
      const message = {
        id: crypto.randomUUID(),
        authorId: String(userId),
        authorName: userName,
        body,
        createdAt: now,
      };
      if (commentDraftAnchor) {
        const thread: DesignerCanvasCommentThread = {
          id: crypto.randomUUID(),
          x: commentDraftAnchor.x,
          y: commentDraftAnchor.y,
          resolved: false,
          createdAt: now,
          messages: [message],
        };
        commitCanvasComments([...canvasCommentsRef.current, thread]);
        setCommentDraftAnchor(undefined);
        setCommentDraft("");
        setSelectedCommentId(thread.id);
        return;
      }
      if (!selectedCommentId) return;
      commitCanvasComments(
        canvasCommentsRef.current.map((thread) =>
          thread.id === selectedCommentId
            ? { ...thread, messages: [...thread.messages, message] }
            : thread,
        ),
      );
      setCommentDraft("");
    },
    [
      commentDraftAnchor,
      commitCanvasComments,
      selectedCommentId,
      userId,
      userName,
    ],
  );

  const toggleSelectedCommentResolved = useCallback(() => {
    if (!selectedCommentId) return;
    commitCanvasComments(
      canvasCommentsRef.current.map((thread) =>
        thread.id === selectedCommentId
          ? { ...thread, resolved: !thread.resolved }
          : thread,
      ),
    );
  }, [commitCanvasComments, selectedCommentId]);

  const deleteSelectedComment = useCallback(() => {
    if (!selectedCommentId) return;
    commitCanvasComments(
      canvasCommentsRef.current.filter(
        (thread) => thread.id !== selectedCommentId,
      ),
    );
    setCommentDraftAnchor(undefined);
    setCommentDraft("");
    setSelectedCommentId(undefined);
  }, [commitCanvasComments, selectedCommentId]);

  const selectAllCanvasElements = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selectedElementIds = Object.fromEntries(
      editor
        .getSceneElements()
        .filter((element) => !element.isDeleted && !element.locked)
        .map((element) => [element.id, true]),
    );
    editor.updateScene({
      appState: { selectedElementIds },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setToolsCatalogOpen(false);
  }, []);

  const undoCanvasAction = useCallback(() => {
    canvasRootRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')
      ?.click();
    setToolsCatalogOpen(false);
  }, []);

  const openCanvasKeyboardShortcuts = useCallback(() => {
    canvasRootRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-label="Help"]')
      ?.click();
    setToolsCatalogOpen(false);
  }, []);

  const openCanvasFind = useCallback(() => {
    setToolsCatalogOpen(false);
    setCanvasFindMatchIndex(0);
    setCanvasFindOpen(true);
  }, []);

  const focusCanvasFindMatch = useCallback(
    (offset: number) => {
      const editor = editorRef.current;
      const query = canvasFindQuery.trim().toLowerCase();
      if (!editor || !query) return;
      const matches = editor
        .getSceneElements()
        .filter(
          (element) =>
            !element.isDeleted &&
            element.type === "text" &&
            (element as ExcalidrawElement & { text: string }).text
              .toLowerCase()
              .includes(query),
        );
      if (matches.length === 0) return;
      const nextIndex =
        (canvasFindMatchIndex + offset + matches.length) % matches.length;
      const match = matches[nextIndex];
      setCanvasFindMatchIndex(nextIndex);
      editor.updateScene({
        appState: { selectedElementIds: { [match.id]: true } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      editor.scrollToContent(match, { fitToContent: true, maxZoom: 1 });
    },
    [canvasFindMatchIndex, canvasFindQuery],
  );

  const replaceAllCanvasTextMatches = useCallback(() => {
    const editor = editorRef.current;
    const query = canvasFindQuery.trim();
    if (!editor || !query) return;
    const pattern = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi",
    );
    const elements = editor.getSceneElements().map((element) => {
      if (element.isDeleted || element.type !== "text") return element;
      const textElement = element as ExcalidrawElement & {
        text: string;
        originalText?: string;
      };
      if (!pattern.test(textElement.text)) return element;
      pattern.lastIndex = 0;
      const text = textElement.text.replace(pattern, canvasReplaceQuery);
      pattern.lastIndex = 0;
      return withCanvasElementUpdate(element, {
        text,
        originalText: text,
      } as Partial<ExcalidrawElement>);
    });
    editor.updateScene({
      elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setCanvasFindMatchIndex(0);
  }, [canvasFindQuery, canvasReplaceQuery]);

  const commentPinStyle = useCallback(
    (thread: DesignerCanvasCommentThread) =>
      ({
        left: `${(thread.x + canvasViewport.scrollX) * canvasViewport.zoom}px`,
        top: `${(thread.y + canvasViewport.scrollY) * canvasViewport.zoom}px`,
        opacity: canvasViewport.zoom < 0.2 ? 0 : 1,
      }) as CSSProperties,
    [canvasViewport],
  );

  const commentComposerStyle = useMemo(() => {
    if (!commentDraftAnchor) return undefined;
    const anchorX =
      (commentDraftAnchor.x + canvasViewport.scrollX) * canvasViewport.zoom;
    const anchorY =
      (commentDraftAnchor.y + canvasViewport.scrollY) * canvasViewport.zoom;
    const canvasWidth = canvasRootRef.current?.clientWidth ?? 1280;
    const canvasHeight = canvasRootRef.current?.clientHeight ?? 720;
    const left = Math.min(Math.max(60, anchorX + 48), canvasWidth - 312);
    const top = Math.min(Math.max(68, anchorY - 37), canvasHeight - 58);
    return {
      "--project-comment-composer-left": `${left}px`,
      "--project-comment-composer-top": `${top}px`,
      "--project-comment-composer-pin-left": `${anchorX - left}px`,
      "--project-comment-composer-pin-top": `${anchorY - top - 32}px`,
    } as CSSProperties;
  }, [canvasViewport, commentDraftAnchor]);

  const saveStatusLabel =
    saveErrorMessage && (saveState === "offline" || saveState === "unavailable")
      ? `${saveLabels[saveState]}: ${saveErrorMessage}`
      : saveLabels[saveState];
  const normalizedToolsCatalogQuery = toolsCatalogQuery.trim().toLowerCase();
  const canvasActionSections = [
    {
      title: "Suggestions",
      items: [
        {
          id: "find-replace",
          title: "Find and replace…",
          shortcut: "",
          disabled: false,
          checked: undefined,
          icon: <SearchIcon />,
          onClick: openCanvasFind,
        },
        {
          id: "select-all",
          title: "Select all",
          shortcut: "⌘A",
          disabled: false,
          checked: undefined,
          icon: <DragIcon />,
          onClick: selectAllCanvasElements,
        },
        {
          id: "undo",
          title: "Undo",
          shortcut: "⌘Z",
          disabled: false,
          checked: undefined,
          icon: <UndoIcon />,
          onClick: undoCanvasAction,
        },
      ],
    },
    {
      title: "Common settings",
      items: [
        {
          id: "minimize-ui",
          title: "Minimize UI",
          shortcut: "⇧⌘\\",
          disabled: false,
          checked: canvasUiMinimized,
          icon: <CommandIcon />,
          onClick: () => {
            setCanvasUiMinimized((minimized) => !minimized);
            setToolsCatalogOpen(false);
          },
        },
        {
          id: "show-hide-ui",
          title: "Show/Hide UI",
          shortcut: "⌘\\",
          disabled: false,
          checked: canvasChromeVisible,
          icon: canvasChromeVisible ? <EyeIcon /> : <EyeCloseIcon />,
          onClick: () => {
            setCanvasChromeVisible((visible) => !visible);
            setToolsCatalogOpen(false);
          },
        },
        {
          id: "multiplayer-cursors",
          title: "Multiplayer cursors",
          shortcut: "⌥⌘\\",
          disabled: false,
          checked: canvasRemoteCursorsVisible,
          icon: <PointerDefaultIcon />,
          onClick: () => {
            setCanvasRemoteCursorsVisible((visible) => !visible);
            setToolsCatalogOpen(false);
          },
        },
        {
          id: "keyboard-shortcuts",
          title: "Keyboard shortcuts",
          shortcut: "⌃⇧?",
          disabled: false,
          checked: undefined,
          icon: <CommandIcon />,
          onClick: openCanvasKeyboardShortcuts,
        },
        {
          id: "account-settings",
          title: "Account settings",
          shortcut: "",
          disabled: false,
          checked: undefined,
          icon: <CogIcon />,
          onClick: () => navigate({ name: "settings-billing" }),
        },
      ],
    },
  ].map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        !normalizedToolsCatalogQuery ||
        item.title.toLowerCase().includes(normalizedToolsCatalogQuery),
    ),
  }));
  const filteredCanvasActionCount = canvasActionSections.reduce(
    (count, section) => count + section.items.length,
    0,
  );
  const canvasFindMatchCount =
    editorRef.current
      ?.getSceneElements()
      .filter(
        (element) =>
          !element.isDeleted &&
          element.type === "text" &&
          Boolean(canvasFindQuery.trim()) &&
          (element as ExcalidrawElement & { text: string }).text
            .toLowerCase()
            .includes(canvasFindQuery.trim().toLowerCase()),
      ).length ?? 0;
  const normalizedWidgetsLauncherQuery = widgetsLauncherQuery
    .trim()
    .toLowerCase();
  const filteredWidgetsLauncherItems = canvasWidgetsLauncherItems.filter(
    (item) =>
      (widgetsLauncherTab === "all" || item.category === widgetsLauncherTab) &&
      (!normalizedWidgetsLauncherQuery ||
        `${item.title} ${item.description}`
          .toLowerCase()
          .includes(normalizedWidgetsLauncherQuery)),
  );
  const filteredWidgetsLauncherGroups = canvasWidgetsLauncherGroups
    .map((group) => ({
      ...group,
      items: group.itemIds
        .map((itemId) =>
          filteredWidgetsLauncherItems.find((item) => item.id === itemId),
        )
        .filter((item): item is CanvasWidgetsLauncherItem => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0);
  const canvasToolPanelOpen =
    toolsCatalogOpen ||
    canvasFindOpen ||
    widgetsLauncherOpen ||
    stampPickerOpen ||
    shapePickerOpen ||
    researchFramesOpen ||
    screensOpen ||
    templatesOpen ||
    stickyPickerOpen ||
    commentsPanelOpen ||
    commentPlacement ||
    Boolean(commentDraftAnchor) ||
    Boolean(selectedComment);
  const selectedShapeOption = selectedCanvasShape
    ? canvasShapeOptions.find(
        (shape) =>
          shape.id === selectedCanvasShape.type &&
          shape.tool === selectedCanvasShape.type,
      )
    : undefined;
  const selectedShapeDisplayColor = selectedCanvasShape
    ? selectedCanvasShape.fillColor === "transparent"
      ? selectedCanvasShape.strokeColor === "transparent"
        ? "#1e1e1e"
        : selectedCanvasShape.strokeColor
      : selectedCanvasShape.fillColor
    : "#1e1e1e";

  return (
    <main
      className={`vitrine-page research-project-page research-project-page--playground${
        canvasUiMinimized ? "" : " research-project-page--canvas-ui-expanded"
      }${
        canvasChromeVisible ? "" : " research-project-page--canvas-ui-hidden"
      }`}
    >
      <header
        className="project-canvas-header"
        aria-label="Project canvas controls"
      >
        <div
          className="project-canvas-header__group project-canvas-header__group--left"
          data-canvas-toolbar-region="top-left"
        >
          <button
            type="button"
            className="project-canvas-header__workspace-button"
            aria-label="Projects home"
            onClick={() => navigate({ name: "projects" })}
          >
            <img
              className="project-canvas-header__brand-mark"
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
            />
          </button>
          <span className="project-canvas-header__divider" aria-hidden="true" />
          <button
            type="button"
            className="project-canvas-header__identity"
            aria-label="Open canvas pages"
            aria-expanded={canvasPagesOpen}
            onClick={() => setCanvasPagesOpen((open) => !open)}
          >
            <span>Designer canvas</span>
            <span className="project-canvas-header__identity-title">
              <h1>{references?.title ?? "Designer project"}</h1>
              <span
                className="project-canvas-header__file-kind"
                aria-hidden="true"
              >
                Canvas
              </span>
              {saveState === "offline" || saveState === "unavailable" ? (
                <IconButton
                  label={saveStatusLabel}
                  icon={<Icon icon={saveStateIcons[saveState]} size="sm" />}
                  variant="ghost"
                  size="sm"
                  clickAction={retryCanvas}
                />
              ) : (
                <span
                  className="project-playground__identity-status"
                  role="status"
                  aria-live="polite"
                  aria-label={saveStatusLabel}
                  title={saveStatusLabel}
                  data-state={saveState}
                >
                  <Icon icon={saveStateIcons[saveState]} size="sm" />
                </span>
              )}
            </span>
          </button>
        </div>
        {canvasPagesOpen && (
          <div
            className="project-canvas-header__page-menu"
            role="menu"
            aria-label="Canvas pages"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => navigate({ name: "project", projectId })}
            >
              Project home
            </button>
            <button
              type="button"
              role="menuitem"
              aria-current="page"
              onClick={() => setCanvasPagesOpen(false)}
            >
              Designer canvas
            </button>
          </div>
        )}
        <div
          className="project-canvas-header__group project-canvas-header__actions"
          data-canvas-toolbar-region="top-right"
        >
          <button
            type="button"
            className="project-canvas-collaborators"
            data-state={collaborationStatus}
            aria-label={collaborationStatusLabel}
            title={collaborationStatusLabel}
            onClick={syncCanvasCollaborators}
          >
            <span
              className="project-canvas-collaborators__avatars"
              aria-hidden="true"
            >
              {onlineCollaborators.slice(0, 1).map((collaborator) => (
                <span
                  key={collaborator.id}
                  style={{
                    backgroundColor: canvasCollaboratorColor(collaborator.name)
                      .background,
                  }}
                >
                  {canvasCollaboratorInitials(collaborator.name)}
                </span>
              ))}
            </span>
            <Icon icon="chevronDown" size="sm" aria-hidden="true" />
          </button>
          <ProjectAccessButton
            project={{
              id: projectId,
              title: references?.title ?? "Designer project",
            }}
            emphasized
          />
        </div>
      </header>
      <section
        className="project-playground project-playground--canvas-first"
        aria-label="Designer canvas"
      >
        <div
          ref={setCanvasRoot}
          onPointerDownCapture={handleCanvasToolPointerDownCapture}
          onDoubleClickCapture={handleCanvasStickyNoteDoubleClickCapture}
          onPointerUpCapture={handleCanvasPlacementPointerUp}
          data-marker-mode={markerDrawing ? markerMode : undefined}
          data-marker-color-transition={markerColorTransition ? "b" : "a"}
          className={`project-playground__canvas${
            selectedScreenReference
              ? " project-playground__canvas--screen-selected"
              : ""
          }${
            selectedCanvasDocument
              ? " project-playground__canvas--document-selected"
              : ""
          }${
            selectedDataReference
              ? " project-playground__canvas--data-selected"
              : ""
          }${
            catalogDropActive ? " project-playground__canvas--catalog-drop" : ""
          }${
            selectedStickyNote
              ? " project-playground__canvas--sticky-selected"
              : ""
          }${
            selectedCanvasTable
              ? " project-playground__canvas--table-selected"
              : ""
          }${
          selectedCanvasShape
              ? " project-playground__canvas--shape-selected"
              : ""
          }${
            selectedCanvasFreeLine
              ? " project-playground__canvas--free-line-selected"
              : ""
          }${
            selectedResearchFrame
              ? " project-playground__canvas--frame-selected"
              : ""
          }${
            researchFrameDrawing
              ? " project-playground__canvas--frame-drawing"
              : ""
          }${
            markerDrawing ? " project-playground__canvas--marker-drawing" : ""
          }${
            markerDrawing && markerMode === "highlighter"
              ? " project-playground__canvas--highlighter-drawing"
              : ""
          }${
            markerDrawing && markerMode === "eraser"
              ? " project-playground__canvas--eraser-drawing"
              : ""
          }${textToolActive ? " project-playground__canvas--text-tool" : ""}${
            textSelectionActive
              ? " project-playground__canvas--text-selection"
              : ""
          }${
            canvasToolPanelOpen
              ? " project-playground__canvas--tool-panel-open"
              : ""
          }${
            stickyPlacement
              ? " project-playground__canvas--sticky-placement"
              : ""
          }${
            commentPlacement
              ? " project-playground__canvas--comment-placement"
              : ""
          }${tablePlacement ? " project-playground__canvas--table-placement" : ""}${
            stampPlacement ? " project-playground__canvas--stamp-placement" : ""
          }`}
          style={
            {
              "--canvas-marker-tool-icon": `url("${coloredFigJamFreehandToolIcon("marker", markerColor)}")`,
              "--canvas-highlighter-tool-icon": `url("${coloredFigJamFreehandToolIcon("highlighter", highlighterColor)}")`,
              ...(stickyPlacement
                ? {
                    "--project-sticky-note-cursor": stickyNotePlacementCursor(
                      stickyPlacement.color,
                      stickyPlacement.mode,
                    ),
                  }
                : {}),
              ...(commentPlacement
                ? {
                    "--project-comment-cursor": commentPlacementCursor,
                  }
                : {}),
            } as CSSProperties
          }
        >
          <Excalidraw
            key={projectId}
            name={references?.title ?? "Astryx designer canvas"}
            theme={canvasTheme}
            gridModeEnabled
            viewModeEnabled={canvasReadOnly}
            initialData={initialData}
            excalidrawAPI={(api) => {
              editorRef.current = api;
              api.updateScene({
                appState: {
                  theme: canvasTheme,
                  viewBackgroundColor: canvasSceneBackground,
                  gridModeEnabled: true,
                },
              });
              syncCanvasCollaborators();
            }}
            isCollaborating={collaborationStatus === "live"}
            onChange={handleCanvasChange}
            onPointerUpdate={handleCanvasPointerUpdate}
            onPointerUp={handleCanvasPointerUp}
            autoFocus
            handleKeyboardGlobally={
              !stickyDraft &&
              !canvasTextEditing &&
              !commentDraftAnchor &&
              !selectedComment
            }
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                toggleTheme: false,
              },
              tools: { image: true },
            }}
          />
          {selectedCanvasFocusBounds ? (
            <div
              aria-hidden="true"
              className="project-canvas-focus-container"
              style={selectedCanvasFocusBounds}
            >
              <span className="project-canvas-focus-container__corner project-canvas-focus-container__corner--top-left" />
              <span className="project-canvas-focus-container__corner project-canvas-focus-container__corner--top-right" />
              <span className="project-canvas-focus-container__corner project-canvas-focus-container__corner--bottom-right" />
              <span className="project-canvas-focus-container__corner project-canvas-focus-container__corner--bottom-left" />
              <span className="project-canvas-focus-container__edge project-canvas-focus-container__edge--top" />
              <span className="project-canvas-focus-container__edge project-canvas-focus-container__edge--right" />
              <span className="project-canvas-focus-container__edge project-canvas-focus-container__edge--bottom" />
              <span className="project-canvas-focus-container__edge project-canvas-focus-container__edge--left" />
            </div>
          ) : null}
          {stampPlacement && stampPreviewPoint ? (
            stampPlacement.id === "profile" ? (
              <span
                className="project-canvas-stamp-preview project-canvas-stamp-preview--profile"
                aria-hidden="true"
                style={{
                  left: stampPreviewPoint.x,
                  top: stampPreviewPoint.y,
                  backgroundColor: canvasCollaboratorColor(userName).background,
                }}
              >
                {canvasCollaboratorInitials(userName).slice(0, 1)}
              </span>
            ) : (
              <img
                className="project-canvas-stamp-preview"
                src={stampPlacement.asset}
                alt=""
                aria-hidden="true"
                style={{
                  left: stampPreviewPoint.x,
                  top: stampPreviewPoint.y,
                }}
              />
            )
          ) : null}
        </div>
        {canvasToolbarHost &&
          createPortal(
            <>
              <div
                className="project-playground__sticky-tools"
                onPointerDown={(event) => event.stopPropagation()}
              >
                {/* Catalog comes first: it is the visual-reference entry point,
                   followed by the creation tools it can inspire. */}
                <button
                  type="button"
                  className="project-playground__screens-trigger project-playground__screens-trigger--apps"
                  aria-label={screensOpen ? "Close catalog" : "Catalog"}
                  aria-pressed={screensOpen}
                  title="Catalog"
                  onClick={() => activateCanvasTool("screens")}
                >
                  <CanvasCatalogAppsCollageGlyph />
                </button>
                <button
                  type="button"
                  className="project-playground__sticky-trigger"
                  aria-label={
                    stickyPickerOpen ? "Close sticky notes" : "Sticky notes"
                  }
                  aria-pressed={stickyPickerOpen || Boolean(stickyPlacement)}
                  title="Sticky notes (N)"
                  onClick={() => activateCanvasTool("sticky")}
                >
                  <ProjectCanvasToolGlyph
                    tool="sticky"
                    stickyColor={stickyToolColor}
                  />
                </button>
                <button
                  type="button"
                  className="project-playground__shapes-trigger"
                  aria-label={
                    shapePickerOpen
                      ? "Close shapes and connectors"
                      : "Shapes and connectors"
                  }
                  aria-expanded={shapePickerOpen}
                  aria-pressed={shapePickerOpen}
                  title="Shapes and connectors"
                  onClick={toggleShapePicker}
                >
                  <CanvasShapesCollageGlyph color={shapeColor} />
                </button>
                <span
                  className="project-playground__sticky-tools-divider"
                  aria-hidden="true"
                />
              </div>
              <div
                className="project-playground__section-tool"
                role="group"
                aria-label="Section tool"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="project-playground__section-trigger"
                  aria-label="Section"
                  aria-pressed={researchFrameDrawing}
                  title="Section (Shift+S)"
                  onClick={drawResearchFrame}
                >
                  <img src={figjamSectionToolIcon} alt="" aria-hidden="true" />
                </button>
              </div>
              <div
                className="project-playground__creation-tools"
                role="group"
                aria-label="Creation tools"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="project-playground__table-trigger"
                  aria-label="Table"
                  aria-pressed={tablePlacement}
                  title="Table"
                  onClick={toggleTableTool}
                >
                  <img src={figjamTableToolIcon} alt="" aria-hidden="true" />
                </button>
                <span className="project-playground__stamp-tool">
                  <button
                    type="button"
                    className="project-playground__stamp-trigger"
                    aria-label="Stamp"
                    aria-expanded={stampPickerOpen}
                    aria-pressed={Boolean(stampPlacement)}
                    title="Stamp (E)"
                    onClick={toggleStampTool}
                  >
                    <img src={figjamStampToolIcon} alt="" aria-hidden="true" />
                  </button>
                  {stampPickerOpen ? (
                    <div
                      className="project-canvas-stamp-menu"
                      role="toolbar"
                      aria-label="Stamp options"
                    >
                      <img
                        className="project-canvas-stamp-menu__surface"
                        src={figjamStampWheel}
                        alt=""
                        aria-hidden="true"
                      />
                      {canvasStampOptions.map((stamp, index) => (
                        <button
                          key={stamp.id}
                          type="button"
                          className="project-canvas-stamp-menu__option"
                          aria-label={`${stamp.label} stamp`}
                          aria-pressed={activeStampId === stamp.id}
                          style={
                            {
                              "--stamp-angle": `${index * 45}deg`,
                            } as CSSProperties
                          }
                          onClick={() => selectCanvasStamp(stamp)}
                        >
                          {stamp.id === "profile" ? (
                            <span
                              className="project-canvas-stamp-menu__profile"
                              aria-hidden="true"
                              style={{
                                backgroundColor:
                                  canvasCollaboratorColor(userName).background,
                              }}
                            >
                              {canvasCollaboratorInitials(userName).slice(0, 1)}
                            </span>
                          ) : (
                            <img src={stamp.asset} alt="" aria-hidden="true" />
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="project-canvas-stamp-menu__emoji"
                        aria-label="Emoji stamps"
                        onClick={() =>
                          selectCanvasStamp(
                            canvasStampOptions.find(
                              (stamp) => stamp.id === activeStampId,
                            ) ?? defaultCanvasStamp,
                          )
                        }
                      >
                        <span aria-hidden="true">
                          <img src={figjamStampThumbsUp} alt="" />
                          <img src={figjamStampStar} alt="" />
                          <img src={figjamStampHeart} alt="" />
                        </span>
                      </button>
                    </div>
                  ) : null}
                </span>
              </div>
              <div
                className="project-playground__astryx-tools"
                role="group"
                aria-label="Vitrines canvas tools"
                data-canvas-toolbar-region="bottom"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="project-playground__comments-trigger"
                  aria-label={commentsPanelOpen ? "Close comments" : "Comments"}
                  aria-expanded={commentsPanelOpen}
                  aria-pressed={commentsPanelOpen}
                  title="Comments"
                  onClick={() => activateCanvasTool("comments")}
                >
                  <ProjectCanvasToolGlyph tool="comments" />
                  {canvasComments.some((thread) => !thread.resolved) ? (
                    <span className="project-playground__comments-count">
                      {
                        canvasComments.filter((thread) => !thread.resolved)
                          .length
                      }
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="project-playground__actions-trigger"
                  aria-label={toolsCatalogOpen ? "Close actions" : "Actions"}
                  aria-expanded={toolsCatalogOpen}
                  aria-pressed={toolsCatalogOpen}
                  title="Actions (⌘K)"
                  onClick={() => activateCanvasTool("more")}
                >
                  <img src={figjamActionsToolIcon} alt="" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="project-playground__widgets-trigger"
                  aria-label="Widgets, stickers, templates and more"
                  aria-expanded={widgetsLauncherOpen}
                  aria-pressed={widgetsLauncherOpen}
                  title="Widgets, stickers, templates and more"
                  onClick={toggleWidgetsLauncher}
                >
                  <img src={figjamWidgetsToolIcon} alt="" aria-hidden="true" />
                </button>
                <span
                  className="project-playground__astryx-tools-divider"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="project-playground__document-trigger"
                  aria-label={
                    documentPlacement ? "Cancel document placement" : "Document"
                  }
                  aria-pressed={documentPlacement}
                  title="Document"
                  onClick={() => activateCanvasTool("document")}
                >
                  <ProjectCanvasToolGlyph tool="document" />
                </button>
              </div>
            </>,
            canvasToolbarHost,
          )}
        {canvasComments.map((thread, index) => (
          <ProjectCanvasCommentPin
            key={thread.id}
            index={index + 1}
            thread={thread}
            active={thread.id === selectedCommentId}
            style={commentPinStyle(thread)}
            onSelect={() => {
              stopCommentPlacement();
              setCommentDraftAnchor(undefined);
              setCommentDraft("");
              setSelectedCommentId(thread.id);
              setCommentsPanelOpen(true);
            }}
          />
        ))}
        {commentsPanelOpen && !selectedComment ? (
          <ProjectCanvasCommentInbox
            threads={canvasComments}
            onSelectThread={(threadId) => {
              stopCommentPlacement();
              setCommentDraftAnchor(undefined);
              setCommentDraft("");
              setSelectedCommentId(threadId);
            }}
            onClose={closeCommentsPanel}
          />
        ) : null}
        {commentDraftAnchor || (commentsPanelOpen && selectedComment) ? (
          <ProjectCanvasCommentPanel
            thread={selectedComment}
            draft={commentDraft}
            style={commentDraftAnchor ? commentComposerStyle : undefined}
            onDraftChange={setCommentDraft}
            onSubmit={submitCanvasComment}
            onResolve={toggleSelectedCommentResolved}
            onDelete={deleteSelectedComment}
            onBack={
              selectedComment
                ? () => {
                    setCommentDraft("");
                    setSelectedCommentId(undefined);
                  }
                : undefined
            }
            onClose={closeCommentsPanel}
          />
        ) : null}
        {canvasFindOpen ? (
          <aside
            className="project-canvas-find"
            role="dialog"
            aria-label="Find and replace"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="project-canvas-find__header">
              <strong>Find and replace</strong>
              <IconButton
                label="Close find and replace"
                icon={<Icon icon="close" size="sm" />}
                variant="ghost"
                size="sm"
                clickAction={() => setCanvasFindOpen(false)}
              />
            </header>
            <TextInput
              label="Find"
              value={canvasFindQuery}
              onChange={(value) => {
                setCanvasFindQuery(value);
                setCanvasFindMatchIndex(0);
              }}
              placeholder="Find text on canvas"
              width="100%"
              autoFocus
            />
            <TextInput
              label="Replace with"
              value={canvasReplaceQuery}
              onChange={setCanvasReplaceQuery}
              placeholder="Replacement text"
              width="100%"
            />
            <footer className="project-canvas-find__footer">
              <span role="status">
                {canvasFindMatchCount > 0
                  ? `${Math.min(canvasFindMatchIndex + 1, canvasFindMatchCount)} of ${canvasFindMatchCount}`
                  : canvasFindQuery.trim()
                    ? "No matches"
                    : "Enter text to search"}
              </span>
              <button
                type="button"
                onClick={() => focusCanvasFindMatch(-1)}
                disabled={canvasFindMatchCount === 0}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => focusCanvasFindMatch(1)}
                disabled={canvasFindMatchCount === 0}
              >
                Next
              </button>
              <button
                type="button"
                onClick={replaceAllCanvasTextMatches}
                disabled={canvasFindMatchCount === 0}
              >
                Replace all
              </button>
            </footer>
          </aside>
        ) : null}
        {toolsCatalogOpen && (
          <aside
            className="project-canvas-tools-catalog"
            role="dialog"
            aria-label="Canvas actions"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <TextInput
              label="Search actions"
              isLabelHidden
              value={toolsCatalogQuery}
              onChange={setToolsCatalogQuery}
              placeholder="Search"
              width="100%"
              autoFocus
            />
            {canvasActionSections.map((section) => {
              if (section.items.length === 0) return null;
              return (
                <section
                  key={section.title}
                  className="project-canvas-tools-catalog__section"
                >
                  {section.title ? <h3>{section.title}</h3> : null}
                  <div className="project-canvas-tools-catalog__list">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="project-canvas-tools-catalog__item"
                        onClick={item.onClick}
                        disabled={item.disabled}
                        role={item.checked === undefined ? undefined : "switch"}
                        aria-checked={item.checked}
                      >
                        <span
                          className="project-canvas-tools-catalog__state"
                          aria-hidden="true"
                        >
                          {item.checked ? (
                            <Icon icon="check" size="sm" />
                          ) : (
                            item.icon
                          )}
                        </span>
                        <span className="project-canvas-tools-catalog__copy">
                          <strong>{item.title}</strong>
                        </span>
                        <kbd className="project-canvas-tools-catalog__shortcut">
                          {item.shortcut}
                        </kbd>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {filteredCanvasActionCount === 0 ? (
              <p className="project-canvas-tools-catalog__empty">
                No actions match “{toolsCatalogQuery}”.
              </p>
            ) : null}
          </aside>
        )}
        {widgetsLauncherOpen ? (
          <aside
            className="project-canvas-widgets-launcher"
            role="dialog"
            aria-label="Widgets, stickers, templates and more"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="project-canvas-widgets-launcher__header">
              <TextInput
                label="Search widgets, stickers, and templates"
                isLabelHidden
                value={widgetsLauncherQuery}
                onChange={setWidgetsLauncherQuery}
                placeholder="Search for the missing piece"
                width="100%"
                autoFocus
              />
              <IconButton
                label="Close widgets launcher"
                icon={<Icon icon="close" size="sm" />}
                variant="ghost"
                size="sm"
                clickAction={() => setWidgetsLauncherOpen(false)}
              />
            </header>
            <div
              className="project-canvas-widgets-launcher__tabs"
              role="tablist"
              aria-label="Launcher categories"
            >
              {canvasWidgetsTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={widgetsLauncherTab === tab.id}
                  onClick={() => setWidgetsLauncherTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div
              className="project-canvas-widgets-launcher__content"
              role="tabpanel"
              aria-label={
                canvasWidgetsTabs.find((tab) => tab.id === widgetsLauncherTab)
                  ?.label ?? "All"
              }
            >
              {filteredWidgetsLauncherGroups.length ? (
                <div className="project-canvas-widgets-launcher__sections">
                  {filteredWidgetsLauncherGroups.map((group) => (
                    <section
                      key={group.id}
                      className="project-canvas-widgets-launcher__section"
                    >
                      <header>
                        <h2>{group.title}</h2>
                        <p>{group.description}</p>
                      </header>
                      <div className="project-canvas-widgets-launcher__grid">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="project-canvas-widgets-launcher__card"
                            onClick={() => openWidgetsTool(item.tool)}
                          >
                            <span
                              className="project-canvas-widgets-launcher__preview"
                              aria-hidden="true"
                            >
                              {item.tool === "stamp" ? (
                                <img src={figjamStampStar} alt="" />
                              ) : (
                                <ProjectCanvasToolGlyph tool={item.tool} />
                              )}
                            </span>
                            <strong>{item.title}</strong>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="project-canvas-widgets-launcher__empty">
                  <strong>
                    {widgetsLauncherTab === "plugins"
                      ? "No workspace plugins yet"
                      : "Nothing found"}
                  </strong>
                  <span>
                    {widgetsLauncherTab === "plugins"
                      ? "Approved integrations will appear here."
                      : "Try a different search or category."}
                  </span>
                </div>
              )}
            </div>
          </aside>
        ) : null}
        {shapePickerOpen && (
          <aside
            className="project-canvas-shape-library"
            role="toolbar"
            aria-label="Shapes and connectors"
            aria-orientation="horizontal"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="project-canvas-shape-library__color-control">
              <button
                type="button"
                className="project-canvas-shape-library__color-trigger"
                role="combobox"
                aria-label={`Shape color, ${canvasShapeColors.find((color) => color.value === shapeColor)?.label ?? "custom"}`}
                aria-expanded={shapeColorPickerOpen}
                title="Shape color"
                onClick={() => setShapeColorPickerOpen((open) => !open)}
              >
                <span
                  style={{ "--shape-color": shapeColor } as CSSProperties}
                />
                <ChevronSmallDownIcon aria-hidden="true" />
              </button>
              {shapeColorPickerOpen ? (
                <div
                  className="project-canvas-shape-library__color-menu"
                  role="dialog"
                  aria-label="Shape colors"
                >
                  {canvasShapeColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className="project-canvas-shape-library__color-swatch"
                      aria-label={`Use ${color.label}`}
                      aria-pressed={shapeColor === color.value}
                      style={{ "--shape-color": color.value } as CSSProperties}
                      onClick={() => selectCanvasShapeColor(color.value)}
                    />
                  ))}
                  <label
                    className="project-canvas-shape-library__custom-color"
                    aria-label="Custom shape color"
                    title="Custom"
                  >
                    <input
                      type="color"
                      value={shapeColor}
                      aria-label="Custom shape color"
                      onChange={(event) =>
                        selectCanvasShapeColor(event.currentTarget.value)
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>
            <span
              className="project-canvas-shape-library__divider"
              aria-hidden="true"
            />
            <section
              className="project-canvas-shape-library__section"
              aria-label="Shapes and connectors"
            >
              <div className="project-canvas-shape-library__grid">
                {canvasShapeOptions.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    className="project-canvas-shape-library__tile"
                    aria-current={activeShapeOptionId === shape.id}
                    aria-label={shape.label}
                    title={shape.label}
                    onClick={() => selectCanvasShape(shape)}
                  >
                    <ShapeLibraryGlyph shape={shape} color={shapeColor} />
                  </button>
                ))}
              </div>
            </section>
            <button
              type="button"
              className="project-canvas-shape-library__more"
              aria-expanded={shapeLibraryOpen}
              title="More shapes"
              onClick={() => {
                setShapeLibraryOpen((open) => !open);
                setShapeLibraryQuery("");
              }}
            >
              More shapes
            </button>
          </aside>
        )}
        {shapeLibraryOpen ? (
          <aside
            className="project-canvas-more-shapes"
            role="dialog"
            aria-modal="true"
            aria-label="More shapes"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="project-canvas-more-shapes__header">
              <strong>More shapes</strong>
              <button
                type="button"
                aria-label="Close more shapes"
                title="Close more shapes"
                onClick={() => setShapeLibraryOpen(false)}
              >
                <Icon icon="close" size="sm" />
              </button>
            </header>
            <input
              type="search"
              className="project-canvas-more-shapes__search"
              aria-label="Search shapes"
              placeholder="Search shapes"
              value={shapeLibraryQuery}
              onChange={(event) => setShapeLibraryQuery(event.target.value)}
            />
            {(["Connectors", "Basic"] as const).map((group) => {
              const shapes = canvasShapeOptions.filter(
                (shape) =>
                  shape.group === group &&
                  shape.label
                    .toLocaleLowerCase()
                    .includes(shapeLibraryQuery.trim().toLocaleLowerCase()),
              );
              if (shapes.length === 0) return null;
              return (
                <section
                  className="project-canvas-more-shapes__section"
                  key={group}
                  aria-label={group}
                >
                  <h3>{group}</h3>
                  <div className="project-canvas-more-shapes__grid">
                    {shapes.map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        aria-current={activeShapeOptionId === shape.id}
                        aria-label={shape.label}
                        title={shape.label}
                        onClick={() => selectCanvasShape(shape)}
                      >
                        <ShapeLibraryGlyph shape={shape} color={shapeColor} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {canvasShapeOptions.every(
              (shape) =>
                !shape.label
                  .toLocaleLowerCase()
                  .includes(shapeLibraryQuery.trim().toLocaleLowerCase()),
            ) ? (
              <p className="project-canvas-more-shapes__empty">
                No supported shapes found.
              </p>
            ) : null}
          </aside>
        ) : null}
        {markerDrawing && !canvasReadOnly ? (
          <div
            className="project-canvas-marker-controls"
            aria-label="Marker controls"
            data-marker-color-transition={markerColorTransition ? "b" : "a"}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {(() => {
              const markerOptionsDisabled = markerMode === "eraser";
              const markerColors =
                markerMode === "highlighter"
                  ? canvasHighlighterColors
                  : canvasMarkerColors;
              return (
                <>
                  <div
                    className="project-canvas-marker-controls__tools"
                    role="group"
                    aria-label="Freehand tools"
                  >
                    {(
                      [
                        { mode: "marker", label: "Marker" },
                        { mode: "highlighter", label: "Highlighter" },
                        { mode: "eraser", label: "Eraser" },
                      ] as const
                    ).map((tool) => (
                      <button
                        key={tool.mode}
                        type="button"
                        className="project-canvas-marker-controls__tool"
                        aria-label={tool.label}
                        aria-pressed={markerMode === tool.mode}
                        title={tool.label}
                        onClick={() => selectMarkerMode(tool.mode)}
                      >
                        <img
                          src={coloredFigJamFreehandToolIcon(
                            tool.mode,
                            tool.mode === "highlighter"
                              ? highlighterColor
                              : markerColor,
                          )}
                          alt=""
                        />
                      </button>
                    ))}
                  </div>
                  <span
                    className="project-canvas-marker-controls__divider"
                    aria-hidden="true"
                  />
                  <div
                    className="project-canvas-marker-controls__weight"
                    role="group"
                    aria-label={
                      markerOptionsDisabled
                        ? "Stroke weight unavailable for Eraser"
                        : "Stroke weight"
                    }
                  >
                    {(["thin", "thick"] as const).map((weight) => (
                      <button
                        key={weight}
                        type="button"
                        className="project-canvas-marker-controls__weight-button"
                        aria-label={weight === "thin" ? "Thin" : "Thick"}
                        aria-pressed={markerStrokeWeight === weight}
                        title={weight === "thin" ? "Thin" : "Thick"}
                        disabled={markerOptionsDisabled}
                        onClick={() => selectMarkerStrokeWeight(weight)}
                      >
                        <img
                          src={
                            weight === "thin" ? thinStrokeIcon : thickStrokeIcon
                          }
                          alt=""
                        />
                      </button>
                    ))}
                  </div>
                  <span
                    className="project-canvas-marker-controls__divider"
                    aria-hidden="true"
                  />
                  <div
                    className="project-canvas-marker-controls__swatches"
                    role="radiogroup"
                    aria-label={
                      markerOptionsDisabled
                        ? "Color unavailable for Eraser"
                        : `${markerMode === "highlighter" ? "Highlighter" : "Marker"} color`
                    }
                  >
                    {markerColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className="project-canvas-marker-controls__swatch"
                        role="radio"
                        aria-label={`${color.label} ${markerMode === "highlighter" ? "highlighter" : "marker"}`}
                        aria-checked={
                          markerStrokeColor.toLowerCase() === color.value
                        }
                        style={
                          { "--marker-color": color.value } as CSSProperties
                        }
                        disabled={markerOptionsDisabled}
                        onClick={() => selectMarkerColor(color.value)}
                      />
                    ))}
                    <label
                      className="project-canvas-marker-controls__custom-color"
                      aria-label={`Custom ${markerMode === "highlighter" ? "highlighter" : "marker"} color`}
                      title="Custom"
                      data-disabled={markerOptionsDisabled || undefined}
                    >
                      <input
                        type="color"
                        value={markerStrokeColor}
                        aria-label={`Custom ${markerMode === "highlighter" ? "highlighter" : "marker"} color`}
                        disabled={markerOptionsDisabled}
                        onChange={(event) =>
                          selectMarkerColor(event.currentTarget.value)
                        }
                      />
                    </label>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
        {researchFramesOpen && (
          <ProjectResearchFramePicker
            frames={researchFrames}
            selectedFrameId={selectedResearchFrame?.elementId}
            onCreate={insertResearchFrame}
            onDraw={drawResearchFrame}
            onFocus={focusResearchFrame}
            onClose={() => setResearchFramesOpen(false)}
          />
        )}
        {stickyPickerOpen && (
          <ProjectStickyNotePicker
            selectedColor={stickyToolColor}
            onSelectColor={(color) => armStickyPlacement(color, "single", true)}
          />
        )}
        {stickyPlacement ? (
          <span
            className="project-sticky-note-placement-status"
            role="status"
            aria-live="polite"
          >
            Sticky note tool active. Click anywhere to place{" "}
            {stickyPlacement.mode === "stack"
              ? "a stack of notes"
              : `a ${stickyPlacement.color.name} note`}
            . Press Escape to cancel.
          </span>
        ) : null}
        {stickyDraft && stickyComposerStyle && (
          <div
            ref={stickyComposerRef}
            className="project-sticky-note-composer"
            style={stickyComposerStyle}
            aria-label={
              stickyDraft.editingElementId ? "Edit sticky note" : "New sticky note"
            }
          >
            <div className="project-sticky-note-composer__surface">
              <div
                ref={stickyInputRef}
                autoFocus
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Sticky note text"
                aria-placeholder="Type anything, @mention anyone"
                data-placeholder="Type anything, @mention anyone"
                spellCheck
                onInput={(event) =>
                  setStickyDraft((current) =>
                    current
                      ? {
                          ...current,
                          value: event.currentTarget.textContent ?? "",
                        }
                      : current,
                  )
                }
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;
                  if (
                    nextTarget &&
                    stickyComposerRef.current?.contains(nextTarget)
                  )
                    return;
                  /* Save the note, but leave focus where the reader put it. */
                  commitStickyDraft(event.currentTarget.textContent ?? "", {
                    selectNote: false,
                  });
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelStickyDraft();
                  } else if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    commitStickyDraft(event.currentTarget.textContent ?? "");
                  }
                }}
              />
            </div>
          </div>
        )}
        {selectedCanvasTable && !canvasReadOnly ? (
          <>
            <ProjectObjectToolbar
              color={selectedCanvasTable.color}
              colorOptions={canvasTableColors}
              colorAriaLabel="Change color"
              format={selectedCanvasTable.format}
              style={canvasTableToolbarStyle}
              objectLabel="Table"
              showLink={canvasTextEditing}
              onColorChange={(color) => updateSelectedCanvasTable({ color })}
              onFormatChange={(format) => updateSelectedCanvasTable({ format })}
            >
              {selectedCanvasTableMergeAction ? (
                <>
                  <CanvasObjectToolbarDivider />
                  <button
                    type="button"
                    className="project-object-toolbar__action"
                    aria-label={
                      selectedCanvasTableMergeAction === "merge"
                        ? "Merge cells"
                        : "Unmerge cells"
                    }
                    onClick={toggleSelectedCanvasTableMerge}
                  >
                    <MergeIcon />
                  </button>
                </>
              ) : null}
            </ProjectObjectToolbar>
            <div
              className="project-canvas-table-controls"
              style={canvasTableControlsStyle}
              aria-label="Table row and column controls"
            >
              {selectedCanvasTableHasCellSelection ? (
                <div
                  className="project-canvas-table-controls__cell-selections"
                  aria-hidden="true"
                >
                  {selectedCanvasTable.cells
                    .filter((cell) =>
                      selectedCanvasTable.selectedCellIds.includes(
                        cell.elementId,
                      ),
                    )
                    .map((cell) => (
                      <span
                        key={cell.elementId}
                        style={{
                          gridColumn: `${cell.column + 1} / span ${cell.columnSpan}`,
                          gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                        }}
                      />
                    ))}
                </div>
              ) : null}
              <div className="project-canvas-table-controls__columns">
                {Array.from(
                  { length: selectedCanvasTable.columns },
                  (_, column) => {
                    const cellIds = selectedCanvasTable.cells
                      .filter(
                        (cell) =>
                          column >= cell.column &&
                          column < cell.column + cell.columnSpan,
                      )
                      .map((cell) => cell.elementId);
                    const selected =
                      selectedCanvasTableHasCellSelection &&
                      cellIds.length ===
                        selectedCanvasTable.selectedCellIds.length &&
                      cellIds.every((id) =>
                        selectedCanvasTable.selectedCellIds.includes(id),
                      );
                    return (
                      <button
                        key={column}
                        type="button"
                        aria-label={`Select column ${column + 1}`}
                        aria-pressed={selected}
                        onClick={() => selectCanvasTableCells(cellIds)}
                      >
                        <DragIcon aria-hidden="true" />
                      </button>
                    );
                  },
                )}
              </div>
              <div className="project-canvas-table-controls__rows">
                {Array.from({ length: selectedCanvasTable.rows }, (_, row) => {
                  const cellIds = selectedCanvasTable.cells
                    .filter(
                      (cell) =>
                        row >= cell.row && row < cell.row + cell.rowSpan,
                    )
                    .map((cell) => cell.elementId);
                  const selected =
                    selectedCanvasTableHasCellSelection &&
                    cellIds.length ===
                      selectedCanvasTable.selectedCellIds.length &&
                    cellIds.every((id) =>
                      selectedCanvasTable.selectedCellIds.includes(id),
                    );
                  return (
                    <button
                      key={row}
                      type="button"
                      aria-label={`Select row ${row + 1}`}
                      aria-pressed={selected}
                      onClick={() => selectCanvasTableCells(cellIds)}
                    >
                      <DragIcon aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              {selectedCanvasTableHasCellSelection ? (
                <>
                  <button
                    type="button"
                    className="project-canvas-table-controls__add-column"
                    aria-label="Add column"
                    onClick={() => addCanvasTableAxis("column")}
                  >
                    <PlusIcon />
                  </button>
                  <button
                    type="button"
                    className="project-canvas-table-controls__add-row"
                    aria-label="Add row"
                    onClick={() => addCanvasTableAxis("row")}
                  >
                    <PlusIcon />
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}
        {canvasOverlayHost &&
          createPortal(
            <>
        {selectedStickyNote && !selectedCanvasTable && !canvasReadOnly && (
          <ProjectObjectToolbar
            color={selectedStickyNote.color}
            format={selectedStickyNote.format}
            collaboration={selectedStickyNote.collaboration}
            style={stickyToolbarStyle}
            objectLabel="Sticky note"
            colorAriaLabel="Change color"
            showTextAlignment={false}
            showTextStyling
            onColorChange={(color) => updateSelectedStickyNote({ color })}
            onFormatChange={(format) => updateSelectedStickyNote({ format })}
            onCollaborationChange={(collaboration) =>
              updateSelectedStickyNote({ collaboration })
            }
          />
        )}
        {selectedCanvasText &&
          !selectedCanvasTable &&
          !selectedStickyNote &&
          !canvasReadOnly && (
            <ProjectObjectToolbar
              color={selectedCanvasText.color}
              colorOptions={canvasTextColors}
              format={selectedCanvasText.format}
              style={canvasTextToolbarStyle}
              objectLabel="Text"
              showTextStyling
              onColorChange={(color) => updateSelectedCanvasText({ color })}
              onFormatChange={(format) => updateSelectedCanvasText({ format })}
            />
          )}
        {selectedCanvasFreeLine &&
        !markerDrawing &&
        !selectedCanvasTable &&
        !selectedStickyNote &&
        !selectedCanvasText &&
        !selectedCanvasShape &&
        !selectedResearchFrame &&
        !canvasReadOnly ? (
          <ProjectSelectionToolbar
            style={canvasFreeLineToolbarStyle}
            className="project-free-line-object-toolbar"
            ariaLabel="Free line properties"
          >
            {(
              [
                { mode: "marker", label: "Marker" },
                { mode: "highlighter", label: "Highlighter" },
              ] as const
            ).map((tool) => (
              <button
                key={tool.mode}
                type="button"
                className="project-object-toolbar__action project-free-line-object-toolbar__tool"
                aria-label={tool.label}
                aria-pressed={selectedFreeLineToolbarMode === tool.mode}
                onClick={() =>
                  updateSelectedCanvasFreeLine({ mode: tool.mode })
                }
              >
                <img
                  src={coloredFigJamFreehandToolIcon(
                    tool.mode,
                    selectedCanvasFreeLine.color,
                  )}
                  alt=""
                />
              </button>
            ))}
            <CanvasObjectToolbarDivider />
            {(["thin", "thick"] as const).map((weight) => (
              <button
                key={weight}
                type="button"
                className="project-object-toolbar__action project-free-line-object-toolbar__weight"
                aria-label={weight === "thin" ? "Thin" : "Thick"}
                aria-pressed={selectedCanvasFreeLine.weight === weight}
                onClick={() => updateSelectedCanvasFreeLine({ weight })}
              >
                <img
                  src={weight === "thin" ? thinStrokeIcon : thickStrokeIcon}
                  alt=""
                />
              </button>
            ))}
            <CanvasObjectToolbarDivider />
            <ProjectObjectToolbarColorPicker
              color={selectedCanvasFreeLine.color}
              className="project-free-line-object-toolbar__color-control"
              panelClassName="project-free-line-object-toolbar__color-panel"
              colorOptions={
                selectedFreeLineToolbarMode === "highlighter"
                  ? canvasHighlighterToolbarColors
                  : canvasTextColors
              }
              ariaLabel="Change free line color"
              panelLabel="Free line colors"
              open={selectedFreeLineColorOpen}
              onOpenChange={setSelectedFreeLineColorOpen}
              onColorChange={(color) =>
                updateSelectedCanvasFreeLine({ color: color.fill })
              }
            />
          </ProjectSelectionToolbar>
        ) : null}
        {selectedCanvasShape &&
        selectedShapeOption &&
        !selectedCanvasTable &&
        !selectedStickyNote &&
        !selectedCanvasText &&
        !canvasReadOnly ? (
          <ProjectSelectionToolbar
            style={canvasShapeToolbarStyle}
            className="project-shape-object-toolbar"
          >
            <div className="project-object-toolbar__control project-shape-object-toolbar__shape-control">
              <button
                type="button"
                className="project-shape-object-toolbar__shape-trigger"
                aria-label={`Shape, ${selectedShapeOption.label.toLowerCase()}`}
                aria-expanded={selectedShapePanel === "shape"}
                onClick={() =>
                  setSelectedShapePanel((panel) =>
                    panel === "shape" ? undefined : "shape",
                  )
                }
              >
                <ShapeLibraryGlyph
                  shape={selectedShapeOption}
                  color={selectedShapeDisplayColor}
                />
                <ChevronSmallDownIcon aria-hidden="true" />
              </button>
              {selectedShapePanel === "shape" ? (
                <div
                  className="project-shape-object-toolbar__panel project-shape-object-toolbar__shape-panel"
                  role="dialog"
                  aria-label="Change shape"
                >
                  {canvasShapeOptions
                    .filter(
                      (shape) =>
                        shape.id === "rectangle" ||
                        shape.id === "ellipse" ||
                        shape.id === "diamond",
                    )
                    .map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        aria-label={shape.label}
                        aria-pressed={selectedCanvasShape.type === shape.id}
                        onClick={() => {
                          updateSelectedCanvasShape({
                            type: shape.id as CanvasSelectableShapeType,
                          });
                          setActiveShapeOptionId(shape.id);
                          setSelectedShapePanel(undefined);
                        }}
                      >
                        <ShapeLibraryGlyph
                          shape={shape}
                          color={selectedShapeDisplayColor}
                        />
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
            <CanvasObjectToolbarDivider />
            <div className="project-object-toolbar__control project-shape-object-toolbar__fill-control">
              <button
                type="button"
                className="project-object-toolbar__color-trigger"
                aria-label="Change color"
                aria-expanded={selectedShapePanel === "fill"}
                onClick={() =>
                  setSelectedShapePanel((panel) =>
                    panel === "fill" ? undefined : "fill",
                  )
                }
              >
                <span
                  className="project-object-toolbar__color-dot"
                  style={
                    {
                      "--object-color": selectedShapeDisplayColor,
                    } as CSSProperties
                  }
                />
                <ChevronSmallDownIcon aria-hidden="true" />
              </button>
              {selectedShapePanel === "fill" ? (
                <div
                  className="project-shape-object-toolbar__panel project-shape-object-toolbar__color-panel"
                  role="dialog"
                  aria-label="Shape fill"
                >
                  <div
                    className="project-shape-object-toolbar__modes"
                    role="radiogroup"
                    aria-label="Fill style"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={
                        selectedCanvasShape.fillColor !== "transparent" &&
                        selectedCanvasShape.opacity === 100
                      }
                      onClick={() =>
                        updateSelectedCanvasShape({
                          fillColor: selectedShapeDisplayColor,
                          opacity: 100,
                        })
                      }
                    >
                      Fill
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={
                        selectedCanvasShape.fillColor !== "transparent" &&
                        selectedCanvasShape.opacity < 100
                      }
                      onClick={() =>
                        updateSelectedCanvasShape({
                          fillColor: selectedShapeDisplayColor,
                          opacity: 50,
                        })
                      }
                    >
                      Transparent
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={
                        selectedCanvasShape.fillColor === "transparent"
                      }
                      onClick={() =>
                        updateSelectedCanvasShape({
                          fillColor: "transparent",
                          opacity: 100,
                        })
                      }
                    >
                      No fill
                    </button>
                  </div>
                  <div className="project-shape-object-toolbar__swatches">
                    {canvasShapeColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        aria-label={`Use ${color.label} fill`}
                        aria-pressed={
                          selectedCanvasShape.fillColor === color.value
                        }
                        style={
                          { "--shape-color": color.value } as CSSProperties
                        }
                        onClick={() => {
                          updateSelectedCanvasShape({
                            fillColor: color.value,
                            opacity: 100,
                          });
                          setSelectedShapePanel(undefined);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="project-object-toolbar__control project-shape-object-toolbar__line-control">
              <button
                type="button"
                className="project-shape-object-toolbar__line-trigger"
                aria-label="Line style"
                aria-expanded={selectedShapePanel === "line"}
                onClick={() =>
                  setSelectedShapePanel((panel) =>
                    panel === "line" ? undefined : "line",
                  )
                }
              >
                <img
                  src={figjamConnectorNoEndpointsIcon}
                  alt=""
                  aria-hidden="true"
                />
                <ChevronSmallDownIcon aria-hidden="true" />
              </button>
              {selectedShapePanel === "line" ? (
                <div
                  className="project-shape-object-toolbar__panel project-shape-object-toolbar__line-panel"
                  role="dialog"
                  aria-label="Line style"
                >
                  <div
                    className="project-shape-object-toolbar__modes"
                    role="radiogroup"
                    aria-label="Stroke style"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={
                        selectedCanvasShape.strokeColor !== "transparent" &&
                        selectedCanvasShape.strokeStyle === "solid"
                      }
                      onClick={() =>
                        updateSelectedCanvasShape({
                          strokeColor:
                            selectedCanvasShape.strokeColor === "transparent"
                              ? selectedShapeDisplayColor
                              : selectedCanvasShape.strokeColor,
                          strokeStyle: "solid",
                        })
                      }
                    >
                      Solid
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={
                        selectedCanvasShape.strokeColor !== "transparent" &&
                        selectedCanvasShape.strokeStyle === "dashed"
                      }
                      onClick={() =>
                        updateSelectedCanvasShape({
                          strokeColor:
                            selectedCanvasShape.strokeColor === "transparent"
                              ? selectedShapeDisplayColor
                              : selectedCanvasShape.strokeColor,
                          strokeStyle: "dashed",
                        })
                      }
                    >
                      Dashed
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={
                        selectedCanvasShape.strokeColor === "transparent"
                      }
                      onClick={() =>
                        updateSelectedCanvasShape({
                          strokeColor: "transparent",
                        })
                      }
                    >
                      None
                    </button>
                  </div>
                  <div className="project-shape-object-toolbar__swatches">
                    {canvasShapeColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        aria-label={`Use ${color.label} stroke`}
                        aria-pressed={
                          selectedCanvasShape.strokeColor === color.value
                        }
                        style={
                          { "--shape-color": color.value } as CSSProperties
                        }
                        onClick={() => {
                          updateSelectedCanvasShape({
                            strokeColor: color.value,
                            strokeStyle: "solid",
                          });
                          setSelectedShapePanel(undefined);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </ProjectSelectionToolbar>
        ) : null}
        {selectedResearchFrame &&
        !selectedStickyNote &&
        !selectedCanvasText &&
        !selectedCanvasShape &&
        !canvasReadOnly ? (
          <ProjectSelectionToolbar
            style={sectionToolbarStyle}
            className="project-section-object-toolbar"
          >
            <div className="project-object-toolbar__control project-section-object-toolbar__color-control">
              <button
                type="button"
                className="project-object-toolbar__action project-section-object-toolbar__color-trigger"
                aria-label={
                  selectedResearchFrame.hidden
                    ? "Can't edit while hidden"
                    : "Change color"
                }
                aria-expanded={selectedFramePanel === "color"}
                disabled={selectedResearchFrame.hidden}
                onClick={() =>
                  setSelectedFramePanel((panel) =>
                    panel === "color" ? undefined : "color",
                  )
                }
              >
                <span
                  className="project-section-object-toolbar__color-swatch"
                  style={
                    {
                      "--section-color": selectedResearchFrame.fillColor,
                    } as CSSProperties
                  }
                />
                <ChevronSmallDownIcon aria-hidden="true" />
              </button>
              {selectedFramePanel === "color" ? (
                <div
                  className="project-section-object-toolbar__panel project-section-object-toolbar__palette"
                  role="dialog"
                  aria-label="Section color"
                >
                  {canvasSectionColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      aria-label={color.label}
                      aria-pressed={
                        selectedResearchFrame.fillColor === color.value
                      }
                      style={
                        { "--section-color": color.value } as CSSProperties
                      }
                      onClick={() => {
                        updateSelectedResearchFrame({
                          fillColor: color.value,
                        });
                        setSelectedFramePanel(undefined);
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="project-object-toolbar__control project-section-object-toolbar__line-control">
              <button
                type="button"
                className="project-object-toolbar__action project-section-object-toolbar__line-trigger"
                aria-label="Line style"
                aria-expanded={selectedFramePanel === "line"}
                onClick={() =>
                  setSelectedFramePanel((panel) =>
                    panel === "line" ? undefined : "line",
                  )
                }
              >
                <span
                  className="project-section-object-toolbar__line-sample"
                  data-style={selectedResearchFrame.strokeStyle}
                  style={
                    {
                      "--section-stroke": selectedResearchFrame.strokeColor,
                    } as CSSProperties
                  }
                />
                <ChevronSmallDownIcon aria-hidden="true" />
              </button>
              {selectedFramePanel === "line" ? (
                <div
                  className="project-section-object-toolbar__panel project-section-object-toolbar__line-panel"
                  role="dialog"
                  aria-label="Section line style"
                >
                  <div
                    className="project-section-object-toolbar__line-modes"
                    role="radiogroup"
                    aria-label="Stroke style"
                  >
                    {(["solid", "dashed", "none"] as const).map((style) => (
                      <button
                        key={style}
                        type="button"
                        role="radio"
                        aria-checked={
                          selectedResearchFrame.strokeStyle === style
                        }
                        onClick={() =>
                          updateSelectedResearchFrame({ strokeStyle: style })
                        }
                      >
                        {style[0].toUpperCase() + style.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="project-section-object-toolbar__palette">
                    {canvasSectionColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        aria-label={`${color.label} line`}
                        aria-pressed={
                          selectedResearchFrame.strokeColor === color.value
                        }
                        style={
                          { "--section-color": color.value } as CSSProperties
                        }
                        onClick={() =>
                          updateSelectedResearchFrame({
                            strokeColor: color.value,
                            strokeStyle:
                              selectedResearchFrame.strokeStyle === "none"
                                ? "solid"
                                : selectedResearchFrame.strokeStyle,
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <CanvasObjectToolbarDivider />
            <div className="project-object-toolbar__control project-section-object-toolbar__rename-control">
              <button
                type="button"
                className="project-object-toolbar__action"
                aria-label="Rename section"
                aria-expanded={selectedFramePanel === "rename"}
                onClick={() =>
                  setSelectedFramePanel((panel) =>
                    panel === "rename" ? undefined : "rename",
                  )
                }
              >
                <EditIcon aria-hidden="true" />
              </button>
              {selectedFramePanel === "rename" ? (
                <form
                  className="project-section-object-toolbar__panel project-section-object-toolbar__rename-panel"
                  aria-label="Rename section"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const title = selectedFrameNameDraft.trim();
                    if (title) updateSelectedResearchFrame({ title });
                    setSelectedFramePanel(undefined);
                  }}
                >
                  <TextInput
                    label="Section name"
                    value={selectedFrameNameDraft}
                    onChange={setSelectedFrameNameDraft}
                    autoFocus
                  />
                  <button type="submit">Apply</button>
                </form>
              ) : null}
            </div>
            <button
              type="button"
              className="project-object-toolbar__action"
              aria-label={
                selectedResearchFrame.hidden ? "Show section" : "Hide section"
              }
              aria-pressed={selectedResearchFrame.hidden}
              onClick={() =>
                updateSelectedResearchFrame({
                  hidden: !selectedResearchFrame.hidden,
                })
              }
            >
              {selectedResearchFrame.hidden ? (
                <EyeIcon aria-hidden="true" />
              ) : (
                <EyeCloseIcon aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="project-object-toolbar__action"
              aria-label={
                selectedResearchFrame.locked ? "Unlock section" : "Lock section"
              }
              aria-pressed={selectedResearchFrame.locked}
              onClick={() =>
                updateSelectedResearchFrame({
                  locked: !selectedResearchFrame.locked,
                })
              }
            >
              {selectedResearchFrame.locked ? (
                <UnlockIcon aria-hidden="true" />
              ) : (
                <LockIcon aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="project-object-toolbar__action"
              aria-label="Section templates"
              aria-expanded={researchFramesOpen}
              onClick={() => setResearchFramesOpen((open) => !open)}
            >
              <GridIcon aria-hidden="true" />
            </button>
          </ProjectSelectionToolbar>
        ) : null}
            </>,
            canvasOverlayHost,
          )}
        {stickyNotes.map((note) => (
          <ProjectStickyNoteMetadata
            key={note.noteId}
            collaboration={note.collaboration}
            style={stickyNoteMetadataStyle(note)}
          />
        ))}
        {stickyNotes
          // Legacy imported notes can lack a reliable bound-text relationship.
          // Do not put an empty-state prompt over those notes because an
          // independent label may already be visible on the canvas.
          .filter((note) => note.textElementId && !note.text.trim())
          .map((note) => (
            <div
              key={`${note.noteId}-placeholder`}
              className="project-sticky-note-placeholder"
              style={stickyNotePlaceholderStyle(note)}
              aria-hidden="true"
            >
              Type anything, @mention anyone
            </div>
          ))}
        {stickyNotes
          .filter(
            (note) =>
              !canvasTextEditing &&
              note.text.trim() &&
              stickyNoteUsesRichTextOverlay(note.format),
          )
          .map((note) => (
            <div
              key={`${note.noteId}-rich-text`}
              className="project-sticky-note-rich-text"
              style={stickyNoteRichTextStyle(note)}
              aria-hidden="true"
            >
              {note.text}
            </div>
          ))}
        {canvasTexts
          .filter(
            (text) =>
              !canvasTextEditing &&
              text.text.trim() &&
              stickyNoteUsesRichTextOverlay(text.format),
          )
          .map((text) => (
            <div
              key={`${text.elementId}-rich-text`}
              className="project-canvas-text-rich-text"
              style={canvasTextRichTextStyle(text)}
              aria-hidden="true"
            >
              {text.text}
            </div>
          ))}
        {canvasDocuments.map((document) => (
          <ProjectCanvasDocumentEditor
            key={document.elementId}
            document={{
              documentId: document.documentId,
              title: document.title,
              body: document.body,
              templateId: document.templateId,
              expanded: document.expanded,
            }}
            style={canvasDocumentStyle(document)}
            isSelected={
              selectedCanvasDocument?.elementId === document.elementId
            }
            onCommit={replaceCanvasDocument}
            onDismiss={dismissCanvasDocument}
          />
        ))}
        {selectedScreenReference && !screensOpen && (
          <aside
            className="project-screen-inspector"
            aria-label="Selected catalog screen"
          >
            <header className="project-screen-inspector__header">
              <span
                className="project-screen-inspector__icon"
                aria-hidden="true"
              >
                <Icon icon="viewColumns" size="sm" />
              </span>
              <div>
                <span>Catalog screen</span>
                <strong>{selectedScreenReference.appName}</strong>
              </div>
              <IconButton
                label="Close screen inspector"
                icon={<Icon icon="close" size="sm" />}
                variant="ghost"
                size="sm"
                clickAction={() => {
                  editorRef.current?.updateScene({
                    appState: { selectedElementIds: {} },
                  });
                  setSelectedScreenReference(undefined);
                }}
              />
            </header>
            <dl className="project-screen-inspector__metadata">
              <div>
                <dt>Type</dt>
                <dd>{selectedScreenReference.screenType || "Screen"}</dd>
              </div>
              <div>
                <dt>Platform</dt>
                <dd>{selectedScreenReference.platform}</dd>
              </div>
            </dl>
            <Button
              label="Open screen details"
              variant="primary"
              size="sm"
              clickAction={() =>
                navigate({
                  name: "app",
                  appId: selectedScreenReference.appId,
                  section: "screens",
                  evidence: `SCREEN-${selectedScreenReference.screenId}`,
                })
              }
            />
          </aside>
        )}
        {selectedDataReference && (
          <aside
            className="project-canvas-data-inspector"
            aria-label="Selected catalog card"
          >
            <header className="project-screen-inspector__header">
              <span
                className="project-screen-inspector__icon"
                aria-hidden="true"
              >
                <Icon
                  icon={
                    selectedDataReference.kind === "app"
                      ? "viewColumns"
                      : "arrowsUpDown"
                  }
                  size="sm"
                />
              </span>
              <div>
                <span>
                  {selectedDataReference.kind === "app"
                    ? "Catalog app"
                    : "Catalog flow"}
                </span>
                <strong>
                  {selectedDataReference.kind === "app"
                    ? selectedDataReference.appName
                    : selectedDataReference.flowTitle}
                </strong>
              </div>
              <IconButton
                label="Close catalog inspector"
                icon={<Icon icon="close" size="sm" />}
                variant="ghost"
                size="sm"
                clickAction={() => {
                  editorRef.current?.updateScene({
                    appState: { selectedElementIds: {} },
                  });
                  setSelectedDataReference(undefined);
                }}
              />
            </header>
            <dl className="project-screen-inspector__metadata">
              <div>
                <dt>Source</dt>
                <dd>{selectedDataReference.appName}</dd>
              </div>
              <div>
                <dt>
                  {selectedDataReference.kind === "app" ? "Screens" : "Steps"}
                </dt>
                <dd>
                  {selectedDataReference.kind === "app"
                    ? selectedDataReference.totalScreens
                    : selectedDataReference.stepCount}
                </dd>
              </div>
              <div>
                <dt>Platform</dt>
                <dd>{selectedDataReference.platform}</dd>
              </div>
            </dl>
            <Button
              label={
                selectedDataReference.kind === "app"
                  ? "Open app details"
                  : "Open flow details"
              }
              variant="primary"
              size="sm"
              clickAction={() => {
                if (selectedDataReference.kind === "app") {
                  navigate({ name: "app", appId: selectedDataReference.appId });
                  return;
                }
                navigate({
                  name: "app",
                  appId: selectedDataReference.appId,
                  section: "flows",
                  platform: selectedDataReference.platform,
                  version: selectedDataReference.version,
                  flow: selectedDataReference.flowId,
                  step: 0,
                  flowView: "visual",
                });
              }}
            />
          </aside>
        )}
        {screensOpen && (
          <ProjectScreenLibrary
            message={screenMessage}
            onDragItem={(payload) => {
              catalogDragRef.current = payload;
            }}
            onAddItem={(payload) => {
              if (payload.kind === "flow") {
                return insertCatalogFlow(
                  payload.item,
                  payload.platform as Platform,
                );
              }
              return insertCatalogScreen(payload.result);
            }}
            onClose={() => setScreensOpen(false)}
          />
        )}
        {referencesOpen && (
          <ProjectReferencePanel
            workspace={references}
            state={referencesState}
            query={referenceQuery}
            message={referenceMessage}
            insertingId={insertingReferenceId}
            onQueryChange={setReferenceQuery}
            onInsert={(item) => {
              void insertReference(item);
            }}
            onRetry={() => {
              void loadReferences();
            }}
            onClose={() => setReferencesOpen(false)}
          />
        )}
        {templatesOpen && (
          <ProjectTemplateLibrary
            onClose={() => setTemplatesOpen(false)}
            onInsert={insertTemplate}
          />
        )}
        {saveState === "unavailable" && (
          <div className="project-playground__unavailable" role="alert">
            <div>
              <h2>Project canvas unavailable</h2>
              <p>
                The project may have been removed or you may no longer have
                access.
              </p>
            </div>
            <div className="project-playground__unavailable-actions">
              <Button
                label="Retry"
                variant="primary"
                clickAction={retryCanvas}
              />
              <Button
                label="Back to projects"
                variant="secondary"
                clickAction={() => navigate({ name: "projects" })}
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
