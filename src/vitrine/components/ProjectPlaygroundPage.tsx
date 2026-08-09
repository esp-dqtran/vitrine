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
import { ChevronSmallDownIcon, FaceHappyIcon } from "@storybook/icons";
import {
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
import { uploadProjectCanvasAsset } from "../projectCanvasAssets.ts";
import { navigate } from "../router.ts";
import { ProjectAccessButton } from "./ProjectAccessDialog.tsx";
import { useApplicationToast } from "./ApplicationToast.tsx";
import {
  ProjectCanvasCommentGlyph,
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
  type ProjectStickyNoteColor,
} from "./ProjectStickyNotePicker.tsx";
import {
  defaultProjectStickyNoteCollaboration,
  defaultProjectStickyNoteFormat,
  normalizeProjectStickyNoteCollaboration,
  projectStickyNoteFontFamilies,
  ProjectStickyNoteMetadata,
  ProjectObjectToolbar,
  ProjectSelectionToolbar,
  type ProjectStickyNoteCollaboration,
  type ProjectStickyNoteFormat,
} from "./ProjectStickyNoteToolbar.tsx";
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
const canvasDocumentViewportTopSafeArea = 72;
const researchFrameWidth = 960;
const researchFrameHeight = 640;
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${stack}<path d="M5 8h19v13l-6 6H5z" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1.5" stroke-linejoin="round"/><path d="M18 27v-6h6" fill="none" stroke="${color.stroke}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="5" cy="8" r="2.5" fill="#2563eb" stroke="#fff" stroke-width="1.5"/></svg>`;
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
    id: "rounded-rectangle",
    tool: "rectangle",
    label: "Rounded rectangle",
    group: "Basic",
    icon: figjamRoundedRectangleIcon,
    glyphFill: "rounded-rectangle",
    roundness: "round",
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

const canvasShapeColors = canvasMarkerColors;

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

interface ProjectCanvasToolCatalogItem {
  tool: Exclude<ProjectCanvasTool, "more">;
  title: string;
  description: string;
  pinned: boolean;
}

const projectCanvasToolCatalogItems: readonly ProjectCanvasToolCatalogItem[] = [
  {
    tool: "screens",
    title: "Catalog",
    description: "Search screens and flows, then add them to the canvas.",
    /* Pinned to the rail now, so the catalog lists it as one. */
    pinned: true,
  },
  {
    tool: "sticky",
    title: "Sticky notes",
    description: "Capture observations and ideas without leaving the canvas.",
    pinned: true,
  },
  {
    tool: "comments",
    title: "Comments",
    description: "Place a discussion on the canvas for feedback and review.",
    pinned: true,
  },
  {
    tool: "document",
    title: "Document",
    description: "Place a structured Markdown document on the canvas.",
    pinned: true,
  },
  {
    tool: "research-frames",
    title: "Research frames",
    description: "Organize evidence, insights, concepts, and decisions.",
    pinned: false,
  },
  {
    tool: "templates",
    title: "Templates",
    description: "Start common designer workflows from a reusable layout.",
    pinned: false,
  },
];

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
  if (tool === "sticky") return <StickyNoteGlyph color={stickyColor} />;
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
      <img
        src={canvasShapePreviewOptions.rectangle.icon}
        alt=""
        className="project-canvas-shapes-collage__rectangle"
      />
      <CanvasShapeGlyph
        icon={canvasShapePreviewOptions.connector.icon}
        color={color}
        className="project-canvas-shapes-collage__connector"
      />
      <img
        src={canvasShapePreviewOptions.ellipse.icon}
        alt=""
        className="project-canvas-shapes-collage__ellipse"
      />
    </span>
  );
}

function ShapeLibraryGlyph({ shape }: { shape: CanvasShapeOption }) {
  return (
    <img
      src={shape.icon}
      alt=""
      className="project-canvas-shape-source-icon"
      aria-hidden="true"
    />
  );
}

function createCanvasCustomShapeElements({
  shape,
  x,
  y,
  color,
}: {
  shape: CanvasShapeOption;
  x: number;
  y: number;
  color: string;
}): ExcalidrawElement[] {
  const common = {
    strokeColor: color,
    strokeWidth: 2,
    roughness: 0,
  } as const;

  switch (shape.customShape) {
    case "triangle":
      return convertToExcalidrawElements([
        {
          type: "line",
          x: x - 80,
          y: y - 60,
          points: [
            [0, 120],
            [80, 0],
            [160, 120],
            [0, 120],
          ],
          ...common,
        } as ElementSkeleton,
      ]) as ExcalidrawElement[];
    case "down-triangle":
      return convertToExcalidrawElements([
        {
          type: "line",
          x: x - 80,
          y: y - 60,
          points: [
            [0, 0],
            [160, 0],
            [80, 120],
            [0, 0],
          ],
          ...common,
        } as ElementSkeleton,
      ]) as ExcalidrawElement[];
    case "cylinder":
      return convertToExcalidrawElements([
        {
          type: "rectangle",
          x: x - 72,
          y: y - 44,
          width: 144,
          height: 88,
          backgroundColor: "transparent",
          fillStyle: "solid",
          ...common,
        } as ElementSkeleton,
        {
          type: "ellipse",
          x: x - 72,
          y: y - 60,
          width: 144,
          height: 32,
          backgroundColor: "#ffffff",
          fillStyle: "solid",
          ...common,
        } as ElementSkeleton,
        {
          type: "ellipse",
          x: x - 72,
          y: y + 28,
          width: 144,
          height: 32,
          backgroundColor: "transparent",
          fillStyle: "solid",
          ...common,
        } as ElementSkeleton,
      ]) as ExcalidrawElement[];
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

function createCanvasTableElements({
  x,
  y,
  rows = 3,
  columns = 3,
}: {
  x: number;
  y: number;
  rows?: number;
  columns?: number;
}): ExcalidrawElement[] {
  const cellWidth = 160;
  const cellHeight = 64;
  const tableId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const left = x - (columns * cellWidth) / 2;
  const top = y - (rows * cellHeight) / 2;

  return convertToExcalidrawElements(
    Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      return {
        type: "rectangle",
        x: left + column * cellWidth,
        y: top + row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        strokeColor: "#757575",
        backgroundColor: row === 0 ? "#f3f4f6" : "#ffffff",
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        roundness: null,
        groupIds: [groupId],
        customData: {
          astryxReference: {
            kind: "table-cell",
            tableId,
            row,
            column,
          },
        },
      } as ElementSkeleton;
    }),
  ) as ExcalidrawElement[];
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
  const size = 88;
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
  return convertToExcalidrawElements([
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
      link: format.link || null,
      locked: format.locked,
      label: {
        text,
        fontSize: format.fontSize,
        fontFamily: projectStickyNoteFontFamilies[format.font],
        textAlign: format.textAlign,
        verticalAlign: "middle",
        strokeColor: color.text,
      },
      customData: {
        astryxReference: {
          kind: "sticky-note",
          noteId,
          color: color.id,
          format,
          collaboration,
          createdAt: new Date().toISOString(),
        },
      },
    } as ElementSkeleton,
  ]) as ExcalidrawElement[];
}

interface AstryxStickyNoteReference {
  elementId: string;
  textElementId?: string;
  noteId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  color: ProjectStickyNoteColor;
  format: ProjectStickyNoteFormat;
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
  const fontSize = ([16, 20, 28] as const).reduce((closest, candidate) =>
    Math.abs(candidate - element.fontSize) <
    Math.abs(closest - element.fontSize)
      ? candidate
      : closest,
  );
  const savedFormat = element.customData?.astryxTextFormat as
    | Partial<ProjectStickyNoteFormat>
    | undefined;
  return {
    elementId: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    color,
    format: {
      font:
        element.fontFamily === projectStickyNoteFontFamilies.sketch
          ? "sketch"
          : "sans",
      fontSize,
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

function stickyNoteReferenceForElement(
  element: ExcalidrawElement,
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
  return {
    elementId: element.id,
    textElementId: element.boundElements?.find((bound) => bound.type === "text")
      ?.id,
    noteId: reference.noteId,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    color,
    format: { ...defaultProjectStickyNoteFormat, ...reference.format },
    collaboration: normalizeProjectStickyNoteCollaboration(
      reference.collaboration,
    ),
  };
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
    left?.color.id === right?.color.id &&
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
      }
    | undefined;
  const type =
    reference?.kind === "research-frame" && reference.frameType
      ? reference.frameType
      : "custom";
  return {
    elementId: element.id,
    type,
    title: element.name?.trim() || "Untitled frame",
    itemCount: allElements.filter(
      (candidate) =>
        !candidate.isDeleted &&
        candidate.frameId === element.id &&
        candidate.type !== "text",
    ).length,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
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
        frame.height === other.height
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
  { file: BinaryFileData; image: CatalogCardImage; stored: boolean } | undefined
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
    let stored = true;
    try {
      await uploadProjectCanvasAsset(projectId, fileId, blob);
    } catch {
      stored = false;
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
      stored,
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
    url.pathname.startsWith("/api/preview-media/")
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
  const [toolsCatalogOpen, setToolsCatalogOpen] = useState(false);
  const [toolsCatalogQuery, setToolsCatalogQuery] = useState("");
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [shapeLibraryOpen, setShapeLibraryOpen] = useState(false);
  const [shapeLibraryQuery, setShapeLibraryQuery] = useState("");
  const [canvasPagesOpen, setCanvasPagesOpen] = useState(false);
  // FigJam opens the family with Rectangle as its current tool; no element is
  // inserted until the user clicks or drags on the canvas.
  const [activeShapeOptionId, setActiveShapeOptionId] =
    useState<CanvasShapeOptionId>("rectangle");
  const [shapePlacement, setShapePlacement] = useState<CanvasShapeOption>();
  const [shapeColor, setShapeColor] = useState(canvasShapeColors[0].value);
  const [shapeColorPickerOpen, setShapeColorPickerOpen] = useState(false);
  const [stickyPickerOpen, setStickyPickerOpen] = useState(false);
  const [stickyToolColor, setStickyToolColor] = useState(
    defaultProjectStickyNoteColor,
  );
  const [stickyPlacement, setStickyPlacement] = useState<StickyPlacement>();
  const [commentPlacement, setCommentPlacement] = useState(false);
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
  const [selectedStickyNote, setSelectedStickyNote] =
    useState<AstryxStickyNoteReference>();
  const [selectedCanvasShape, setSelectedCanvasShape] =
    useState<CanvasShapeReference>();
  const [selectedShapePanel, setSelectedShapePanel] = useState<
    "shape" | "fill" | "line"
  >();
  const [stickyNotes, setStickyNotes] = useState<
    readonly AstryxStickyNoteReference[]
  >([]);
  const [documentPlacement, setDocumentPlacement] = useState(false);
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
  const editorRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const stickyComposerRef = useRef<HTMLDivElement | null>(null);
  const stickyInputRef = useRef<HTMLDivElement | null>(null);
  const canvasTextEditingRef = useRef(false);
  const stickyPlacementRef = useRef<StickyPlacement>();
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
        pointer: cursor?.pointer
          ? { ...cursor.pointer, tool: "pointer", renderCursor: true }
          : undefined,
        button: cursor?.button,
        selectedElementIds: Object.fromEntries(
          (cursor?.selectedElementIds ?? []).map((id) => [id, true]),
        ),
      });
    }
    editorRef.current?.updateScene({ collaborators });
  }, []);

  const handleCanvasPointerUpdate = useCallback(
    ({ pointer, button }: CanvasPointerUpdate) => {
      const selectedElementIds = Object.keys(
        editorRef.current?.getAppState().selectedElementIds ?? {},
      );
      collaborationRef.current?.publishCursor({
        pointer: { x: pointer.x, y: pointer.y },
        button,
        selectedElementIds,
      });
    },
    [],
  );

  useEffect(() => {
    if (!stickyDraftFocusKey) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const input = stickyInputRef.current;
      if (!input) return;
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
      const snapshotKey = canvasSaveKey(snapshot);
      if (snapshotKey === lastQueuedSnapshotKeyRef.current) return;
      lastQueuedSnapshotKeyRef.current = snapshotKey;
      writeLocalCanvas(snapshot);
      pendingSnapshotRef.current = snapshot;
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
      editorRef.current = null;
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
            await uploadProjectCanvasAsset(projectId, `asset:${file.id}`, blob);
            persistedFileIdsRef.current.add(file.id);
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
    setStampPickerOpen(false);
  }, []);

  const handleCanvasToolPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const nativeTool = target
        .closest("label")
        ?.querySelector('input[data-testid^="toolbar-"]');
      if (nativeTool) {
        deactivateStickyTool();
        setStickyDraft(undefined);
        deactivateTableTool();
        deactivateStampTool();
        setWidgetsLauncherOpen(false);
      }
    },
    [deactivateStickyTool, deactivateTableTool, deactivateStampTool],
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
      /* Excalidraw normalizes an external custom tool back to Selection. The
         placement ref is the durable source of truth until the person places
         the note or deliberately switches tools. */
      if (!stickyToolIsActive && !stickyPlacementRef.current) {
        deactivateStickyTool();
      }
      const nextCanvasTextEditing = Boolean(appState.editingTextElement);
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
      /* Text bound to a sticky note belongs to its note's object toolbar. Plain
       text owns the same compact shell, but not the note collaboration UI. */
      const selectedTextContainerId = selectedTextElement
        ? (selectedTextElement as { containerId?: string | null }).containerId
        : undefined;
      const nextSelectedCanvasText = selectedTextContainerId
        ? undefined
        : selectedTextElement
          ? canvasTextReferenceForElement(selectedTextElement)
          : undefined;
      setSelectedCanvasText((current) =>
        canvasTextReferencesEqual(current, nextSelectedCanvasText)
          ? current
          : nextSelectedCanvasText,
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
      const selectedFrames = frames.filter(
        (frame) => appState.selectedElementIds[frame.elementId],
      );
      const selectedFrame =
        selectedFrames.length === 1 ? selectedFrames[0] : undefined;
      setSelectedResearchFrame((current) => {
        if (!current && !selectedFrame) return current;
        if (
          current?.elementId === selectedFrame?.elementId &&
          current?.title === selectedFrame?.title &&
          current?.itemCount === selectedFrame?.itemCount
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
          const direct = stickyNoteReferenceForElement(element);
          if (direct) return direct;
          const containerId = (element as { containerId?: string | null })
            .containerId;
          if (!containerId) return undefined;
          const container = elements.find(
            (candidate) => candidate.id === containerId,
          );
          return container
            ? stickyNoteReferenceForElement(container)
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
      const nextStickyNotes = elements
        .map(stickyNoteReferenceForElement)
        .filter((reference): reference is AstryxStickyNoteReference =>
          Boolean(reference),
        );
      setStickyNotes((current) =>
        stickyNoteReferenceListsEqual(current, nextStickyNotes)
          ? current
          : nextStickyNotes,
      );
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
        await uploadProjectCanvasAsset(projectId, `asset:${fileId}`, blob);
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
        if (loaded.stored) persistedFileIdsRef.current.add(loaded.file.id);
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
        if (loaded.stored) persistedFileIdsRef.current.add(loaded.file.id);
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
    (
      item: FlowCatalogItem,
      platform: Platform,
      placement?: { x: number; y: number },
    ) => {
      return insertCanvasDataReference(
        {
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
        },
        `Added ${item.title} to the canvas.`,
        placement,
        item.preview.flow.steps.flatMap((step) => step.evidence)[0]
          ?.thumbnailUrl,
      );
    },
    [insertCanvasDataReference],
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
    editor.updateScene({
      appState: { selectedElementIds: { [frame.id]: true } },
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
          customData: {
            astryxReference: {
              kind: "research-frame",
              frameType: preset.id,
              createdAt: new Date().toISOString(),
            },
          },
        } as ElementSkeleton,
      ]);
      editor.setActiveTool({ type: "selection" });
      editor.updateScene({
        elements: [...sceneElements, frame],
        appState: { selectedElementIds: { [frame.id]: true } },
      });
      editor.scrollToContent(frame, { animate: true, fitToViewport: true });
      setResearchFramesOpen(false);
    },
    [],
  );

  const drawResearchFrame = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setResearchFramesOpen(false);
    setResearchFrameDrawing(true);
    setStickyPickerOpen(false);
    setStickyDraft(undefined);
    setStickyPlacement(undefined);
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
  }, [deactivateStampTool, deactivateTableTool]);

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

  const toggleCommentTool = useCallback(() => {
    if (commentPlacement) {
      stopCommentPlacement();
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
    setCommentPlacement(true);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-comment" });
    editor?.setCursor(commentPlacementCursor);
  }, [
    commentPlacement,
    stopCommentPlacement,
    deactivateStampTool,
    deactivateTableTool,
    stopDocumentPlacement,
    stopStickyPlacement,
  ]);

  const armDocumentPlacement = useCallback(() => {
    stopCommentPlacement();
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
    if (!editor) return;
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
    const created = createCanvasDocumentElements({
      x,
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
    (x: number, y: number, shape: CanvasShapeOption) => {
      const editor = editorRef.current;
      if (!editor || !shape.customShape) return;
      const created = createCanvasCustomShapeElements({
        shape,
        x,
        y,
        color: shapeColor,
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
    async (x: number, y: number, stamp: CanvasStampOption) => {
      const editor = editorRef.current;
      if (!editor) return;
      try {
        const response = await fetch(stamp.asset);
        if (!response.ok)
          throw new Error(`Stamp asset returned ${response.status}`);
        const blob = await response.blob();
        const fileId = crypto.randomUUID() as FileId;
        const file: BinaryFileData = {
          id: fileId,
          mimeType: (blob.type || "image/png") as BinaryFileData["mimeType"],
          dataURL: await blobDataUrl(blob),
          created: Date.now(),
        };
        const image = createCanvasStampElement({ x, y, fileId, stamp });
        editor.addFiles([file]);
        editor.updateScene({
          elements: [...editor.getSceneElements(), image],
          appState: { selectedElementIds: { [image.id]: true } },
        });
      } catch (error) {
        showToast(`Could not add ${stamp.label.toLowerCase()} stamp.`);
        console.error(error);
      }
    },
    [showToast],
  );

  const handleCanvasPlacementPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const stamp = stampPlacementRef.current;
      if ((!tablePlacementRef.current && !stamp) || event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (!target.closest(".excalidraw__canvas")) return;

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
      // Add the table on the next frame so that reconciliation cannot restore
      // the pre-click scene over the newly created cells.
      window.requestAnimationFrame(() => {
        if (tablePlacementRef.current) {
          insertCanvasTableAt(placement.x, placement.y);
          stopTablePlacement();
          return;
        }
        const currentStamp = stampPlacementRef.current;
        if (currentStamp)
          void insertCanvasStampAt(placement.x, placement.y, currentStamp);
      });
    },
    [insertCanvasStampAt, insertCanvasTableAt, stopTablePlacement],
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
      stopCommentPlacement();
      // Sticky Notes is a complete canvas mode. It can be entered through the
      // toolbar or the N shortcut, so it must clear every competing family here
      // instead of relying on whichever caller happened to open it.
      setShapePickerOpen(false);
      setShapeLibraryOpen(false);
      setShapeLibraryQuery("");
      setShapeColorPickerOpen(false);
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
    [deactivateStampTool, deactivateTableTool, stopCommentPlacement],
  );

  const toggleStickyNoteTool = useCallback(() => {
    if (stickyPickerOpen || stickyPlacement) {
      stopStickyPlacement();
      return;
    }
    stopDocumentPlacement();
    editorRef.current?.updateScene({ appState: { selectedElementIds: {} } });
    setSelectedStickyNote(undefined);
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
    setShapeColorPickerOpen(false);
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
      editor?.updateScene({
        appState: {
          currentItemStrokeColor: shapeColor,
          currentItemStrokeWidth: 2,
          currentItemRoughness: 0,
          currentItemRoundness: shape.roundness ?? "sharp",
          currentItemArrowType: shape.arrowType ?? "sharp",
        },
      });
      if (shape.customShape) {
        setShapePlacement(shape);
        editor?.setActiveTool({
          type: "custom",
          customType: `astryx-shape:${shape.id}`,
        });
        editor?.setCursor("crosshair");
      } else if (shape.tool) {
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

  const selectCanvasShapeColor = useCallback((color: string) => {
    setShapeColor(color);
    setShapeColorPickerOpen(false);
    editorRef.current?.updateScene({
      appState: {
        currentItemStrokeColor: color,
        currentItemStrokeWidth: 2,
        currentItemRoughness: 0,
      },
    });
  }, []);

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
      const text = value.trim();
      setStickyDraft(undefined);
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
      if (shapePlacement) {
        const { x, y } = pointerDownState.origin;
        insertCanvasCustomShapeAt(x, y, shapePlacement);
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
      if (documentPlacement) {
        const { x, y } = pointerDownState.origin;
        insertCanvasDocumentAt(x, y);
        stopDocumentPlacement();
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
      documentPlacement,
      commentPlacement,
      insertCanvasCustomShapeAt,
      insertCanvasDocumentAt,
      insertStickyNotesAt,
      shapePlacement,
      stickyPlacement,
      stopDocumentPlacement,
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
    const width = stickyNoteSize * zoom;
    const height = stickyNoteSize * zoom;
    const noteLeft = (stickyDraft.x - stickyNoteSize / 2 + scrollX) * zoom;
    const noteTop = (stickyDraft.y - stickyNoteSize / 2 + scrollY) * zoom;
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
        stickyDraft.format.font === "sketch"
          ? '"Virgil", "Comic Sans MS", cursive'
          : 'var(--reference-font-family, "Figtree", system-ui, sans-serif)',
      "--sticky-font-size": `${stickyDraft.format.fontSize * zoom}px`,
      "--sticky-padding": `${24 * zoom}px`,
      "--sticky-text-align": stickyDraft.format.textAlign,
      "--sticky-justify-content":
        stickyDraft.format.textAlign === "left"
          ? "flex-start"
          : stickyDraft.format.textAlign === "right"
            ? "flex-end"
            : "center",
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
      const note = selectedStickyNote;
      if (!editor || !note) return;
      const color = patch.color ?? note.color;
      const format = patch.format ?? note.format;
      const collaboration = patch.collaboration ?? note.collaboration;
      const bulletedListChanged =
        format.bulletedList !== note.format.bulletedList;

      const elements = editor.getSceneElements().map((element) => {
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
            ...(bulletedListChanged
              ? { text: nextText, originalText: nextText }
              : {}),
          } as Partial<ExcalidrawElement>);
        }
        return element;
      });
      editor.updateScene({ elements });
    },
    [selectedStickyNote],
  );

  /* Above the note, in the same screen space as every other canvas overlay. */
  const stickyToolbarStyle = useMemo(() => {
    if (!selectedStickyNote) return undefined;
    const { scrollX, scrollY, zoom } = canvasViewport;
    const centreX =
      (selectedStickyNote.x + selectedStickyNote.width / 2 + scrollX) * zoom;
    const noteTop = (selectedStickyNote.y + scrollY) * zoom;
    return {
      "--project-object-toolbar-anchor-x": `${centreX}px`,
      "--project-object-toolbar-top": `${Math.max(76, noteTop - 80)}px`,
    } as CSSProperties;
  }, [canvasViewport, selectedStickyNote]);

  const canvasTextToolbarStyle = useMemo(() => {
    if (!selectedCanvasText) return undefined;
    const { scrollX, scrollY, zoom } = canvasViewport;
    const centreX =
      (selectedCanvasText.x + selectedCanvasText.width / 2 + scrollX) * zoom;
    const textTop = (selectedCanvasText.y + scrollY) * zoom;
    return {
      "--project-object-toolbar-anchor-x": `${centreX}px`,
      "--project-object-toolbar-top": `${Math.max(76, textTop - 80)}px`,
    } as CSSProperties;
  }, [canvasViewport, selectedCanvasText]);

  const canvasShapeToolbarStyle = useMemo(() => {
    if (!selectedCanvasShape) return undefined;
    const { scrollX, scrollY, zoom } = canvasViewport;
    const centreX =
      (selectedCanvasShape.x + selectedCanvasShape.width / 2 + scrollX) * zoom;
    const shapeTop = (selectedCanvasShape.y + scrollY) * zoom;
    return {
      "--project-object-toolbar-anchor-x": `${centreX}px`,
      "--project-object-toolbar-top": `${Math.max(76, shapeTop - 64)}px`,
      "--project-object-toolbar-half-width": "92px",
    } as CSSProperties;
  }, [canvasViewport, selectedCanvasShape]);

  useEffect(() => {
    setSelectedShapePanel(undefined);
  }, [selectedCanvasShape?.elementId]);

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

  const stickyNoteMetadataStyle = useCallback(
    (note: AstryxStickyNoteReference) =>
      ({
        left: `${(note.x + canvasViewport.scrollX) * canvasViewport.zoom}px`,
        top: `${(note.y + note.height + canvasViewport.scrollY) * canvasViewport.zoom + 8}px`,
        maxWidth: `${Math.max(160, note.width * canvasViewport.zoom)}px`,
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

  const commentPinStyle = useCallback(
    (thread: DesignerCanvasCommentThread) =>
      ({
        left: `${(thread.x + canvasViewport.scrollX) * canvasViewport.zoom}px`,
        top: `${(thread.y + canvasViewport.scrollY) * canvasViewport.zoom}px`,
        opacity: canvasViewport.zoom < 0.2 ? 0 : 1,
      }) as CSSProperties,
    [canvasViewport],
  );

  const saveStatusLabel =
    saveErrorMessage && (saveState === "offline" || saveState === "unavailable")
      ? `${saveLabels[saveState]}: ${saveErrorMessage}`
      : saveLabels[saveState];
  const normalizedToolsCatalogQuery = toolsCatalogQuery.trim().toLowerCase();
  const filteredCanvasToolCatalogItems = projectCanvasToolCatalogItems.filter(
    (item) =>
      !normalizedToolsCatalogQuery ||
      `${item.title} ${item.description}`
        .toLowerCase()
        .includes(normalizedToolsCatalogQuery),
  );
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
  const canvasToolPanelOpen =
    toolsCatalogOpen ||
    widgetsLauncherOpen ||
    stampPickerOpen ||
    shapePickerOpen ||
    researchFramesOpen ||
    screensOpen ||
    templatesOpen ||
    stickyPickerOpen ||
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
    <main className="vitrine-page research-project-page research-project-page--playground">
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
          <span className="project-canvas-header__divider" aria-hidden="true" />
          <span className="project-canvas-header__menu">
            <IconButton
              label="Canvas pages and menu"
              icon={<Icon icon="viewColumns" size="sm" />}
              variant="ghost"
              size="sm"
              clickAction={() => setCanvasPagesOpen((open) => !open)}
            />
          </span>
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
          ref={canvasRootRef}
          onPointerDownCapture={handleCanvasToolPointerDownCapture}
          onPointerUp={handleCanvasPlacementPointerUp}
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
            selectedCanvasShape
              ? " project-playground__canvas--shape-selected"
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
        </div>
        {canvasToolbarHost &&
          createPortal(
            <>
              <div
                className="project-playground__sticky-tools"
                onPointerDown={(event) => event.stopPropagation()}
              >
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
              </div>
              <div
                className="project-playground__section-tool"
                role="group"
                aria-label="Section tool"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <span
                  className="project-playground__section-tool-divider"
                  aria-hidden="true"
                />
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
                      <span
                        className="project-canvas-stamp-menu__surface"
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
                          <img src={stamp.asset} alt="" aria-hidden="true" />
                        </button>
                      ))}
                      <button
                        type="button"
                        className="project-canvas-stamp-menu__emoji"
                        aria-label="Emoji stamps"
                        onClick={() => {
                          toggleWidgetsLauncher();
                          setWidgetsLauncherTab("stickers");
                        }}
                      >
                        <FaceHappyIcon size={34} />
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
                  aria-label={
                    commentPlacement ? "Cancel comment placement" : "Comments"
                  }
                  aria-pressed={
                    commentPlacement ||
                    Boolean(commentDraftAnchor) ||
                    Boolean(selectedComment)
                  }
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
                {/* Promoted out of the "more tools" catalog: it is the way onto the
                canvas for apps, screens and flows, not an occasional extra. */}
                <button
                  type="button"
                  className="project-playground__screens-trigger"
                  aria-label={screensOpen ? "Close catalog" : "Catalog"}
                  aria-pressed={screensOpen}
                  title="Catalog"
                  onClick={() => activateCanvasTool("screens")}
                >
                  <ProjectCanvasToolGlyph tool="screens" />
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
            }}
          />
        ))}
        {commentPlacement ? (
          <div
            className="project-canvas-comment-placement-hint"
            role="status"
            aria-live="polite"
          >
            <ProjectCanvasCommentGlyph />
            <span>Click anywhere to place a comment.</span>
            <kbd>Esc</kbd>
          </div>
        ) : null}
        {commentDraftAnchor || selectedComment ? (
          <ProjectCanvasCommentPanel
            thread={selectedComment}
            draft={commentDraft}
            onDraftChange={setCommentDraft}
            onSubmit={submitCanvasComment}
            onResolve={toggleSelectedCommentResolved}
            onDelete={deleteSelectedComment}
            onClose={() => {
              setCommentDraftAnchor(undefined);
              setCommentDraft("");
              setSelectedCommentId(undefined);
            }}
          />
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
            {[true, false].map((pinned) => {
              const items = filteredCanvasToolCatalogItems.filter(
                (item) => item.pinned === pinned,
              );
              if (items.length === 0) return null;
              return (
                <section
                  key={pinned ? "pinned" : "more"}
                  className="project-canvas-tools-catalog__section"
                >
                  <h3>{pinned ? "Suggestions" : "Canvas tools"}</h3>
                  <div className="project-canvas-tools-catalog__list">
                    {items.map((item) => (
                      <button
                        key={item.tool}
                        type="button"
                        className="project-canvas-tools-catalog__item"
                        onClick={() => activateCanvasTool(item.tool)}
                      >
                        <span
                          className="project-canvas-tools-catalog__icon"
                          aria-hidden="true"
                        >
                          <ProjectCanvasToolGlyph tool={item.tool} />
                        </span>
                        <span className="project-canvas-tools-catalog__copy">
                          <strong>{item.title}</strong>
                          <small>{item.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {filteredCanvasToolCatalogItems.length === 0 ? (
              <p className="project-canvas-tools-catalog__empty">
                No tools match “{toolsCatalogQuery}”.
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
                placeholder="Let’s find the perfect thing"
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
              {filteredWidgetsLauncherItems.length ? (
                <div className="project-canvas-widgets-launcher__grid">
                  {filteredWidgetsLauncherItems.map((item) => (
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
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
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
                    <ShapeLibraryGlyph shape={shape} />
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
            aria-label="More shapes"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="project-canvas-more-shapes__header">
              <strong>Shapes</strong>
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
                        <ShapeLibraryGlyph shape={shape} />
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
                    role="group"
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
                        aria-label={`${color.label} ${markerMode === "highlighter" ? "highlighter" : "marker"}`}
                        aria-pressed={
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
          <div
            className="project-sticky-note-placement-hint"
            role="status"
            aria-live="polite"
          >
            <StickyNoteGlyph color={stickyPlacement.color} />
            <span>
              Click anywhere to place{" "}
              {stickyPlacement.mode === "stack"
                ? "a stack of notes"
                : `a ${stickyPlacement.color.name} note`}
              .
            </span>
            <kbd>Esc</kbd>
          </div>
        ) : null}
        {stickyDraft && stickyComposerStyle && (
          <div
            ref={stickyComposerRef}
            className="project-sticky-note-composer"
            style={stickyComposerStyle}
            aria-label="New sticky note"
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
                aria-placeholder="Type your note"
                data-placeholder="Type your note"
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
        {selectedStickyNote && !canvasReadOnly && (
          <ProjectObjectToolbar
            color={selectedStickyNote.color}
            format={selectedStickyNote.format}
            collaboration={selectedStickyNote.collaboration}
            style={stickyToolbarStyle}
            objectLabel="Sticky note"
            onColorChange={(color) => updateSelectedStickyNote({ color })}
            onFormatChange={(format) => updateSelectedStickyNote({ format })}
            onCollaborationChange={(collaboration) =>
              updateSelectedStickyNote({ collaboration })
            }
          />
        )}
        {selectedCanvasText && !selectedStickyNote && !canvasReadOnly && (
          <ProjectObjectToolbar
            color={selectedCanvasText.color}
            colorOptions={canvasTextColors}
            format={selectedCanvasText.format}
            style={canvasTextToolbarStyle}
            objectLabel="Text"
            onColorChange={(color) => updateSelectedCanvasText({ color })}
            onFormatChange={(format) => updateSelectedCanvasText({ format })}
          />
        )}
        {selectedCanvasShape &&
        selectedShapeOption &&
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
                <ShapeLibraryGlyph shape={selectedShapeOption} />
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
                        <ShapeLibraryGlyph shape={shape} />
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
            <span
              className="project-object-toolbar__divider"
              aria-hidden="true"
            />
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
        {stickyNotes.map((note) => (
          <ProjectStickyNoteMetadata
            key={note.noteId}
            collaboration={note.collaboration}
            style={stickyNoteMetadataStyle(note)}
          />
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
