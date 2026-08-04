import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button, Icon, IconButton, TextInput, type IconName } from "@astryxdesign/core";
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
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  FileId,
} from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";

import type { ResearchProjectItem, ResearchProjectWorkspace } from "../../researchProject.ts";
import {
  normalizeDesignerCanvasComments,
  type DesignerCanvasCommentThread,
} from "../../designerCanvas.ts";
import type { Platform } from "../../platformFromUrl.ts";
import type { AppsDiscoveryScreenResult } from "../appsDiscovery.ts";
import type { FlowCatalogItem } from "../flowCatalogApi.ts";
import {
  analyzeMoodboardPixels,
  buildMoodboardSmartComposeResult,
  normalizeMoodboardSmartComposeResult,
  type ProjectMoodboardImageAnalysis,
  type ProjectMoodboardSmartComposeResult,
} from "../projectMoodboardSmartCompose.ts";
import type { App } from "../types.ts";
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
import { useResolvedThemeMode } from "../theme.tsx";
import { ProjectAccessButton } from "./ProjectAccessDialog.tsx";
import {
  ProjectCanvasCommentGlyph,
  ProjectCanvasCommentPanel,
  ProjectCanvasCommentPin,
} from "./ProjectCanvasComments.tsx";
import {
  ProjectMoodboardPanel,
  ProjectMoodboardReferenceInspector,
  layoutMoodboardReferenceInSection,
  projectMoodboardSectionPresets,
  type ProjectMoodboardDecision,
  type ProjectMoodboardReference,
  type ProjectMoodboardSectionId,
  type ProjectMoodboardSectionPreset,
} from "./ProjectMoodboardPanel.tsx";
import { ProjectReferencePanel, type ProjectReferenceState } from "./ProjectReferencePanel.tsx";
import { ProjectScreenLibrary, projectScreenKey } from "./ProjectScreenLibrary.tsx";
import {
  ProjectCanvasDataLibrary,
  projectCanvasDataKey,
} from "./ProjectCanvasDataLibrary.tsx";
import {
  ProjectCanvasDocumentEditor,
  type ProjectCanvasDocumentData,
  type ProjectCanvasDocumentTemplateId,
} from "./ProjectCanvasDocumentEditor.tsx";
import {
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

const canvasMediaMimeTypeSet = new Set(["image/png", "image/jpeg", "image/webp"]);
const canvasSource = "https://astryx.design";
// Excalidraw applies its own dark-mode filter to the drawing layers. Keeping the
// stored scene neutral lets that filter render the correct dark canvas without
// changing a shared document when one collaborator changes their UI theme.
const canvasSceneBackground = "#f7f8fa";
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

type ElementSkeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>[number];
type StickyPlacementMode = "single" | "stack";
type CanvasPointerUpdate = Parameters<NonNullable<ExcalidrawProps["onPointerUpdate"]>>[0];

function canvasCollaboratorColor(identity: string) {
  let hash = 0;
  for (const character of identity) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return canvasCollaborationColors[Math.abs(hash) % canvasCollaborationColors.length];
}

function canvasCollaboratorInitials(name: string): string {
  return name
    .split(/[@\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
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
  const stack = mode === "stack"
    ? `<path d="M8 5h17v17H8z" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1.5" opacity=".55"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${stack}<path d="M5 8h19v13l-6 6H5z" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1.5" stroke-linejoin="round"/><path d="M18 27v-6h6" fill="none" stroke="${color.stroke}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="5" cy="8" r="2.5" fill="#2563eb" stroke="#fff" stroke-width="1.5"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 5 8, crosshair`;
}

const commentPlacementCursor = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 5h20v15H13l-7 6V5Z" fill="white" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/><path d="M11 10h10M11 14h7" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="5" r="3" fill="#2563eb" stroke="white" stroke-width="1.5"/></svg>',
)}") 6 5, crosshair`;

type ProjectCanvasTool =
  | "moodboard"
  | "research-frames"
  | "screens"
  | "sticky"
  | "comments"
  | "document"
  | "data"
  | "templates"
  | "more";

interface ProjectCanvasToolCatalogItem {
  tool: Exclude<ProjectCanvasTool, "more">;
  title: string;
  description: string;
  pinned: boolean;
}

const projectCanvasToolCatalogItems: readonly ProjectCanvasToolCatalogItem[] = [
  {
    tool: "moodboard",
    title: "Moodboard",
    description: "Collect references, shape directions, and record visual decisions.",
    pinned: true,
  },
  {
    tool: "screens",
    title: "Screens",
    description: "Search captured product screens and add them to the canvas.",
    pinned: false,
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
    tool: "data",
    title: "Astryx data",
    description: "Add apps and flows from the Astryx catalog.",
    pinned: false,
  },
  {
    tool: "templates",
    title: "Templates",
    description: "Start common designer workflows from a reusable layout.",
    pinned: false,
  },
];

const projectCanvasToolIcons: Record<Exclude<ProjectCanvasTool, "sticky" | "comments">, IconName> = {
  moodboard: "viewColumns",
  "research-frames": "viewColumns",
  screens: "viewColumns",
  document: "copy",
  data: "wrench",
  templates: "checkDouble",
  more: "moreHorizontal",
};

function ProjectCanvasToolGlyph({ tool }: { tool: ProjectCanvasTool }) {
  if (tool === "sticky") return <StickyNoteGlyph />;
  if (tool === "comments") return <ProjectCanvasCommentGlyph />;
  return <Icon icon={projectCanvasToolIcons[tool]} size="sm" />;
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
  return convertToExcalidrawElements([{
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
  } as ElementSkeleton]) as ExcalidrawElement[];
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

function stickyNoteReferenceForElement(
  element: ExcalidrawElement,
): AstryxStickyNoteReference | undefined {
  if (element.isDeleted || element.type !== "rectangle") return undefined;
  const reference = element.customData?.astryxReference as {
    kind?: string;
    noteId?: string;
    color?: string;
    format?: Partial<ProjectStickyNoteFormat>;
    collaboration?: Partial<ProjectStickyNoteCollaboration>;
  } | undefined;
  if (reference?.kind !== "sticky-note" || !reference.noteId) return undefined;
  const color = projectStickyNoteColors.find((option) => option.id === reference.color)
    ?? projectStickyNoteColors[0];
  return {
    elementId: element.id,
    textElementId: element.boundElements?.find((bound) => bound.type === "text")?.id,
    noteId: reference.noteId,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    color,
    format: { ...defaultProjectStickyNoteFormat, ...reference.format },
    collaboration: normalizeProjectStickyNoteCollaboration(reference.collaboration),
  };
}

function stickyNoteReferencesEqual(
  left?: AstryxStickyNoteReference,
  right?: AstryxStickyNoteReference,
): boolean {
  return left?.elementId === right?.elementId
    && left?.textElementId === right?.textElementId
    && left?.x === right?.x
    && left?.y === right?.y
    && left?.width === right?.width
    && left?.height === right?.height
    && left?.color.id === right?.color.id
    && left?.format.font === right?.format.font
    && left?.format.fontSize === right?.format.fontSize
    && left?.format.textAlign === right?.format.textAlign
    && left?.format.link === right?.format.link
    && left?.format.locked === right?.format.locked
    && JSON.stringify(left?.collaboration) === JSON.stringify(right?.collaboration);
}

function stickyNoteReferenceListsEqual(
  left: readonly AstryxStickyNoteReference[],
  right: readonly AstryxStickyNoteReference[],
): boolean {
  return left.length === right.length
    && left.every((reference, index) => stickyNoteReferencesEqual(reference, right[index]));
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
  const reference = element.customData?.astryxReference as {
    kind?: string;
    frameType?: ProjectResearchFrameType;
  } | undefined;
  const type = reference?.kind === "research-frame" && reference.frameType
    ? reference.frameType
    : "custom";
  return {
    elementId: element.id,
    type,
    title: element.name?.trim() || "Untitled frame",
    itemCount: allElements.filter((candidate) => (
      !candidate.isDeleted
      && candidate.frameId === element.id
      && candidate.type !== "text"
    )).length,
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
  return left.length === right.length && left.every((frame, index) => {
    const other = right[index];
    return frame.elementId === other?.elementId
      && frame.type === other.type
      && frame.title === other.title
      && frame.itemCount === other.itemCount
      && frame.x === other.x
      && frame.y === other.y
      && frame.width === other.width
      && frame.height === other.height;
  });
}

function canvasDocumentReferencesEqual(
  left: readonly AstryxCanvasDocumentReference[],
  right: readonly AstryxCanvasDocumentReference[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((document, index) => {
    const other = right[index];
    return document.elementId === other?.elementId
      && document.documentId === other.documentId
      && document.title === other.title
      && document.body === other.body
      && document.templateId === other.templateId
      && document.expanded === other.expanded
      && document.x === other.x
      && document.y === other.y
      && document.width === other.width
      && document.height === other.height;
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
  const width = document.expanded ? expandedCanvasDocumentWidth : canvasDocumentWidth;
  const height = document.expanded ? expandedCanvasDocumentHeight : canvasDocumentHeight;
  return convertToExcalidrawElements([{
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
  } as ElementSkeleton]) as ExcalidrawElement[];
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

type CanvasSaveState = "loading" | "saving" | "saved" | "offline" | "unavailable";

interface StoredMoodboardReference {
  sourceKind: ProjectMoodboardReference["sourceKind"];
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  caption: string;
  decision: ProjectMoodboardDecision;
  addedAt: string;
}

interface AstryxMoodboardSectionReference {
  elementId: string;
  id: ProjectMoodboardSectionId;
  title: string;
}

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

type AstryxCanvasDataReference = AstryxCanvasDataPayload & { elementId: string };

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
      reference.description || "Open the source flow to inspect the full journey.",
    ].join("\n");
  return convertToExcalidrawElements([{
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
  } as ElementSkeleton]) as ExcalidrawElement[];
}

function canvasDataReferenceForElement(
  element: ExcalidrawElement,
): AstryxCanvasDataReference | undefined {
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as Record<string, unknown> | undefined;
  if (
    reference?.kind === "app"
    && typeof reference.appId === "string"
    && typeof reference.appName === "string"
    && typeof reference.description === "string"
    && typeof reference.category === "string"
    && typeof reference.platform === "string"
    && Number.isSafeInteger(reference.totalScreens)
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
    reference?.kind === "flow"
    && typeof reference.appId === "string"
    && typeof reference.appName === "string"
    && typeof reference.flowId === "string"
    && typeof reference.flowTitle === "string"
    && typeof reference.category === "string"
    && typeof reference.description === "string"
    && typeof reference.platform === "string"
    && Number.isSafeInteger(reference.version)
    && Number.isSafeInteger(reference.stepCount)
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

function screenReferenceForElement(element: ExcalidrawElement): AstryxScreenReference | undefined {
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as Record<string, unknown> | undefined;
  if (
    reference?.kind !== "screen"
    || typeof reference.appId !== "string"
    || typeof reference.appName !== "string"
    || !Number.isSafeInteger(reference.screenId)
    || typeof reference.screenType !== "string"
    || typeof reference.platform !== "string"
  ) return undefined;
  return {
    elementId: element.id,
    appId: reference.appId,
    appName: reference.appName,
    screenId: reference.screenId as number,
    screenType: reference.screenType,
    platform: reference.platform,
  };
}

function moodboardReferenceForElement(
  element: ExcalidrawElement,
  elements: readonly ExcalidrawElement[] = [],
): ProjectMoodboardReference | undefined {
  if (element.isDeleted || element.type !== "image") return undefined;
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as Record<string, unknown> | undefined;
  const moodboard = reference?.moodboard as Record<string, unknown> | undefined;
  if (
    !moodboard
    || !["project-reference", "screen", "upload"].includes(String(moodboard.sourceKind))
    || typeof moodboard.sourceId !== "string"
    || typeof moodboard.sourceLabel !== "string"
  ) return undefined;
  const decision = ["keep", "maybe", "reject"].includes(String(moodboard.decision))
    ? moodboard.decision as ProjectMoodboardDecision
    : "maybe";
  const section = element.frameId
    ? elements
      .map(moodboardSectionForElement)
      .find((candidate) => candidate?.elementId === element.frameId)
    : undefined;
  return {
    elementId: element.id,
    sourceKind: moodboard.sourceKind as ProjectMoodboardReference["sourceKind"],
    sourceId: moodboard.sourceId,
    sourceLabel: moodboard.sourceLabel,
    sourceUrl: typeof moodboard.sourceUrl === "string" ? moodboard.sourceUrl : undefined,
    caption: typeof moodboard.caption === "string" ? moodboard.caption : "",
    decision,
    sectionId: section?.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

function moodboardReferencesEqual(
  left: readonly ProjectMoodboardReference[],
  right: readonly ProjectMoodboardReference[],
): boolean {
  return left.length === right.length && left.every((reference, index) => {
    const other = right[index];
    return reference.elementId === other?.elementId
      && reference.sourceKind === other.sourceKind
      && reference.sourceId === other.sourceId
      && reference.sourceLabel === other.sourceLabel
      && reference.sourceUrl === other.sourceUrl
      && reference.caption === other.caption
      && reference.decision === other.decision
      && reference.sectionId === other.sectionId
      && reference.x === other.x
      && reference.y === other.y
      && reference.width === other.width
      && reference.height === other.height;
  });
}

function moodboardSectionForElement(
  element: ExcalidrawElement,
): AstryxMoodboardSectionReference | undefined {
  if (element.isDeleted || element.type !== "frame") return undefined;
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as Record<string, unknown> | undefined;
  if (
    reference?.kind !== "moodboard-section"
    || !projectMoodboardSectionPresets.some((section) => section.id === reference.sectionId)
  ) return undefined;
  return {
    elementId: element.id,
    id: reference.sectionId as ProjectMoodboardSectionId,
    title: element.name?.trim() || "Moodboard section",
  };
}

function moodboardSectionsEqual(
  left: readonly AstryxMoodboardSectionReference[],
  right: readonly AstryxMoodboardSectionReference[],
): boolean {
  return left.length === right.length && left.every((section, index) => (
    section.elementId === right[index]?.elementId
    && section.id === right[index]?.id
    && section.title === right[index]?.title
  ));
}

function moodboardSmartComposeForElement(
  element: ExcalidrawElement,
): ProjectMoodboardSmartComposeResult | undefined {
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as Record<string, unknown> | undefined;
  if (reference?.kind !== "moodboard-section") return undefined;
  return normalizeMoodboardSmartComposeResult(reference.smartCompose);
}

function moodboardSmartComposeResultsEqual(
  left: ProjectMoodboardSmartComposeResult | undefined,
  right: ProjectMoodboardSmartComposeResult | undefined,
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function moodboardDecisionOpacity(decision: ProjectMoodboardDecision): number {
  if (decision === "keep") return 100;
  if (decision === "reject") return 38;
  return 82;
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

function documentReferenceForElement(
  element: ExcalidrawElement,
): AstryxCanvasDocumentReference | undefined {
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as Record<string, unknown> | undefined;
  if (
    reference?.kind !== "document"
    || typeof reference.documentId !== "string"
    || typeof reference.title !== "string"
    || typeof reference.body !== "string"
    || typeof reference.expanded !== "boolean"
  ) return undefined;
  return {
    elementId: element.id,
    documentId: reference.documentId,
    title: reference.title,
    body: reference.body,
    templateId: typeof reference.templateId === "string"
      ? reference.templateId as ProjectCanvasDocumentTemplateId
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
  return snapshot.appState.theme === theme
    && snapshot.appState.viewBackgroundColor === canvasSceneBackground
    && snapshot.appState.gridModeEnabled === true
    && snapshot.appState.gridSize === 20
    && snapshot.appState.gridStep === 5;
}

function isExcalidrawSnapshot(value: unknown): value is ExcalidrawProjectSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return snapshot.type === "excalidraw"
    && typeof snapshot.version === "number"
    && Array.isArray(snapshot.elements)
    && Boolean(snapshot.appState && typeof snapshot.appState === "object" && !Array.isArray(snapshot.appState))
    && Boolean(snapshot.files && typeof snapshot.files === "object" && !Array.isArray(snapshot.files));
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
  const { gridModeEnabled, gridSize, gridStep, theme, viewBackgroundColor } = snapshot.appState;
  return [
    hashElementsVersion(snapshot.elements),
    hashString(fileVersions),
    hashString(JSON.stringify(normalizeDesignerCanvasComments(snapshot.comments))),
    gridModeEnabled,
    gridSize,
    gridStep,
    theme,
    viewBackgroundColor,
  ].join(":");
};

function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return createImageBitmap(blob)
    .then((image) => {
      const dimensions = { width: image.width, height: image.height };
      image.close();
      return dimensions;
    })
    .catch(() => ({ width: 640, height: 400 }));
}

async function analyzeMoodboardImageFile(
  referenceId: string,
  element: ExcalidrawElement,
  files: BinaryFiles,
): Promise<ProjectMoodboardImageAnalysis | undefined> {
  if (element.type !== "image" || !element.fileId) return undefined;
  const file = files[element.fileId];
  const customData = element.customData as Record<string, unknown> | undefined;
  const reference = customData?.astryxReference as Record<string, unknown> | undefined;
  const sources = [
    file?.dataURL,
    typeof reference?.mediaUrl === "string" ? reference.mediaUrl : undefined,
  ].filter((source, index, all): source is string => (
    Boolean(source) && all.indexOf(source) === index
  ));
  for (const source of sources) {
    try {
      const response = await fetch(canvasMediaFetchUrl(source), { credentials: "same-origin" });
      if (!response.ok) continue;
      const bitmap = await createImageBitmap(await response.blob());
      try {
        const scale = Math.min(1, 48 / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) continue;
        context.drawImage(bitmap, 0, 0, width, height);
        return analyzeMoodboardPixels(
          referenceId,
          context.getImageData(0, 0, width, height).data,
          width,
          height,
        );
      } finally {
        bitmap.close();
      }
    } catch {
      // Some historical canvas files point at retired media URLs. Smart Compose
      // still returns the deterministic layout and source-linked summaries.
    }
  }
  return undefined;
}

function canvasMediaFetchUrl(source: string): string {
  const url = new URL(source, window.location.origin);
  if (url.origin === window.location.origin && url.pathname.startsWith("/api/preview-media/")) {
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
  const resolvedTheme = useResolvedThemeMode();
  const [saveState, setSaveState] = useState<CanvasSaveState>("loading");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [collaborationStatus, setCollaborationStatus] =
    useState<DesignerCanvasCollaborationStatus>("connecting");
  const [remoteCollaborators, setRemoteCollaborators] =
    useState<readonly DesignerCanvasCollaborator[]>([]);
  const [moodboardOpen, setMoodboardOpen] = useState(false);
  const [moodboardMessage, setMoodboardMessage] = useState("");
  const [moodboardReferences, setMoodboardReferences] =
    useState<readonly ProjectMoodboardReference[]>([]);
  const [moodboardSections, setMoodboardSections] =
    useState<readonly AstryxMoodboardSectionReference[]>([]);
  const [moodboardSmartCompose, setMoodboardSmartCompose] =
    useState<ProjectMoodboardSmartComposeResult>();
  const [moodboardSmartComposeBusy, setMoodboardSmartComposeBusy] = useState(false);
  const [selectedMoodboardReference, setSelectedMoodboardReference] =
    useState<ProjectMoodboardReference>();
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [screensOpen, setScreensOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [researchFramesOpen, setResearchFramesOpen] = useState(false);
  const [researchFrameDrawing, setResearchFrameDrawing] = useState(false);
  const [researchFrames, setResearchFrames] = useState<readonly AstryxResearchFrameReference[]>([]);
  const [selectedResearchFrame, setSelectedResearchFrame] = useState<AstryxResearchFrameReference>();
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const [toolsCatalogOpen, setToolsCatalogOpen] = useState(false);
  const [toolsCatalogQuery, setToolsCatalogQuery] = useState("");
  const [stickyPickerOpen, setStickyPickerOpen] = useState(false);
  const [stickyPlacement, setStickyPlacement] = useState<StickyPlacement>();
  const [commentPlacement, setCommentPlacement] = useState(false);
  const [commentDraftAnchor, setCommentDraftAnchor] = useState<{ x: number; y: number }>();
  const [commentDraft, setCommentDraft] = useState("");
  const [canvasComments, setCanvasComments] = useState<readonly DesignerCanvasCommentThread[]>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<string>();
  const [stickyDraft, setStickyDraft] = useState<StickyDraft>();
  const [canvasTextEditing, setCanvasTextEditing] = useState(false);
  const [selectedStickyNote, setSelectedStickyNote] = useState<AstryxStickyNoteReference>();
  const [stickyNotes, setStickyNotes] = useState<readonly AstryxStickyNoteReference[]>([]);
  const [documentPlacement, setDocumentPlacement] = useState(false);
  const [canvasDocuments, setCanvasDocuments] = useState<readonly AstryxCanvasDocumentReference[]>([]);
  const [selectedCanvasDocument, setSelectedCanvasDocument] = useState<AstryxCanvasDocumentReference>();
  const [canvasViewport, setCanvasViewport] = useState({ scrollX: 0, scrollY: 0, zoom: 1 });
  const [referencesState, setReferencesState] = useState<ProjectReferenceState>("idle");
  const [references, setReferences] = useState<ResearchProjectWorkspace>();
  const [referenceQuery, setReferenceQuery] = useState("");
  const [insertingReferenceId, setInsertingReferenceId] = useState<number>();
  const [referenceMessage, setReferenceMessage] = useState("");
  const [insertingScreenKey, setInsertingScreenKey] = useState<string>();
  const [screenMessage, setScreenMessage] = useState("");
  const [selectedScreenReference, setSelectedScreenReference] = useState<AstryxScreenReference>();
  const [insertingDataKey, setInsertingDataKey] = useState<string>();
  const [dataToolsMessage, setDataToolsMessage] = useState("");
  const [selectedDataReference, setSelectedDataReference] = useState<AstryxCanvasDataReference>();
  const [canvasToolbarHost, setCanvasToolbarHost] = useState<HTMLElement | null>(null);
  const editorRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const stickyComposerRef = useRef<HTMLDivElement | null>(null);
  const stickyInputRef = useRef<HTMLDivElement | null>(null);
  const canvasTextEditingRef = useRef(false);
  const canvasCommentsRef = useRef<readonly DesignerCanvasCommentThread[]>([]);
  const projectMenuRef = useRef<HTMLSpanElement | null>(null);
  const projectMenuWasOpenRef = useRef(false);
  const activeRef = useRef(true);
  const loadedRef = useRef(false);
  const savingRef = useRef(false);
  const pendingSnapshotRef = useRef<ExcalidrawProjectSnapshot | undefined>(undefined);
  const lastQueuedSnapshotKeyRef = useRef<string | undefined>(undefined);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const uploadingFileIdsRef = useRef(new Set<string>());
  const collaborationRef = useRef<DesignerCanvasCollaborationSession | null>(null);
  const remoteCollaboratorsRef = useRef(new Map<string, DesignerCanvasCollaborator>());
  const remoteCursorsRef = useRef(new Map<string, DesignerCanvasRemoteCursor>());
  const remoteElementsVersionRef = useRef<number | undefined>(undefined);
  const remoteBroadcastSuppressedUntilRef = useRef(0);
  const localStorageKey = useMemo(
    () => `astryx:project:${projectId}:canvas:${canvasId ?? "legacy"}:excalidraw:v1`,
    [canvasId, projectId],
  );
  const stickyDraftFocusKey = stickyDraft
    ? `${stickyDraft.x}:${stickyDraft.y}`
    : "";
  const onlineCollaborators = useMemo(() => {
    const collaborators = new Map<string, { id: string; name: string }>();
    collaborators.set(`user:${userId}`, { id: `user:${userId}`, name: userName });
    for (const collaborator of remoteCollaborators) {
      const id = `user:${collaborator.userId}`;
      if (!collaborators.has(id)) collaborators.set(id, { id, name: collaborator.name });
    }
    return [...collaborators.values()];
  }, [remoteCollaborators, userId, userName]);
  const collaborationStatusLabel = collaborationStatus === "live"
    ? `${onlineCollaborators.length} ${onlineCollaborators.length === 1 ? "person" : "people"} online`
    : collaborationStatus === "connecting"
      ? "Connecting"
      : "Collaboration offline";
  const moodboardDecisionCounts = useMemo(() => ({
    keep: moodboardReferences.filter((reference) => reference.decision === "keep").length,
    maybe: moodboardReferences.filter((reference) => reference.decision === "maybe").length,
    reject: moodboardReferences.filter((reference) => reference.decision === "reject").length,
  }), [moodboardReferences]);
  const canvasReadOnly = referencesState !== "ready"
    || references?.access?.role === "viewer";

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

  const handleCanvasPointerUpdate = useCallback(({ pointer, button }: CanvasPointerUpdate) => {
    const selectedElementIds = Object.keys(
      editorRef.current?.getAppState().selectedElementIds ?? {},
    );
    collaborationRef.current?.publishCursor({
      pointer: { x: pointer.x, y: pointer.y },
      button,
      selectedElementIds,
    });
  }, []);

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
      setCanvasToolbarHost((current) => current === nextHost ? current : nextHost);
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

  const writeLocalCanvas = useCallback((snapshot: ExcalidrawProjectSnapshot) => {
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify(snapshot));
    } catch {
      // Remote persistence still works when browser storage is unavailable.
    }
  }, [localStorageKey]);

  const flushCanvas = useCallback(async () => {
    if (savingRef.current || !pendingSnapshotRef.current) return;
    savingRef.current = true;
    while (pendingSnapshotRef.current) {
      const snapshot = pendingSnapshotRef.current;
      pendingSnapshotRef.current = undefined;
      try {
        if (canvasId) await saveDesignerCanvasFile(projectId, canvasId, snapshot);
        else await saveDesignerCanvas(projectId, snapshot);
        if (activeRef.current) {
          setSaveErrorMessage("");
          setSaveState("saved");
        }
      } catch (error) {
        pendingSnapshotRef.current ??= snapshot;
        if (activeRef.current) {
          setSaveErrorMessage(error instanceof Error ? error.message : "Canvas save failed");
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

  const queueSnapshot = useCallback((snapshot: ExcalidrawProjectSnapshot) => {
    const snapshotKey = canvasSaveKey(snapshot);
    if (snapshotKey === lastQueuedSnapshotKeyRef.current) return;
    lastQueuedSnapshotKeyRef.current = snapshotKey;
    writeLocalCanvas(snapshot);
    pendingSnapshotRef.current = snapshot;
    if (activeRef.current) setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { void flushCanvas(); }, 750);
  }, [flushCanvas, writeLocalCanvas]);

  const commitCanvasComments = useCallback((comments: readonly DesignerCanvasCommentThread[]) => {
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
  }, [queueSnapshot]);

  const initialData = useCallback(async () => {
    loadedRef.current = false;
    try {
      const canvas = canvasId
        ? await getDesignerCanvasFile(projectId, canvasId)
        : await getDesignerCanvas(projectId);
      const remote = isExcalidrawSnapshot(canvas.snapshot) ? canvas.snapshot : undefined;
      const sourceSnapshot = remote ?? readLocalCanvas() ?? blankCanvas(resolvedTheme);
      const snapshot = withCanvasPresentation(sourceSnapshot, resolvedTheme);
      canvasCommentsRef.current = snapshot.comments;
      if (activeRef.current) setCanvasComments(snapshot.comments);
      lastQueuedSnapshotKeyRef.current = canvasSaveKey(snapshot);
      writeLocalCanvas(snapshot);
      if (!remote || !usesCanvasPresentation(remote, resolvedTheme)) {
        if (canvasId) await saveDesignerCanvasFile(projectId, canvasId, snapshot);
        else await saveDesignerCanvas(projectId, snapshot);
      }
      if (activeRef.current) setSaveState("saved");
      if (activeRef.current) setSaveErrorMessage("");
      loadedRef.current = true;
      return { ...snapshot, scrollToContent: true };
    } catch (error) {
      const snapshot = withCanvasPresentation(
        readLocalCanvas() ?? blankCanvas(resolvedTheme),
        resolvedTheme,
      );
      lastQueuedSnapshotKeyRef.current = canvasSaveKey(snapshot);
      canvasCommentsRef.current = snapshot.comments;
      if (activeRef.current) setCanvasComments(snapshot.comments);
      loadedRef.current = true;
      if (activeRef.current) {
        setSaveErrorMessage(error instanceof Error ? error.message : "Canvas load failed");
        setSaveState(
          error instanceof DesignerCanvasApiError && error.status === 404
            ? "unavailable"
            : "offline",
        );
      }
      return { ...snapshot, scrollToContent: true };
    }
  }, [canvasId, projectId, readLocalCanvas, resolvedTheme, writeLocalCanvas]);

  useEffect(() => {
    editorRef.current?.updateScene({
      appState: {
        theme: resolvedTheme,
        viewBackgroundColor: canvasSceneBackground,
      },
    });
  }, [resolvedTheme]);

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

  useEffect(() => { void loadReferences(); }, [loadReferences]);

  const persistEmbeddedFiles = useCallback((files: BinaryFiles) => {
    const editor = editorRef.current;
    if (!editor) return;
    for (const file of Object.values(files)) {
      if (!file.dataURL.startsWith("data:") || uploadingFileIdsRef.current.has(file.id)) continue;
      uploadingFileIdsRef.current.add(file.id);
      void fetch(file.dataURL)
        .then((response) => response.blob())
        .then(async (blob) => {
          const src = await uploadProjectCanvasAsset(projectId, `asset:${file.id}`, blob);
          editor.addFiles([{ ...file, dataURL: src as DataURL }]);
          queueSnapshot(serializeCanvas(
            editor.getSceneElementsIncludingDeleted(),
            editor.getAppState(),
            editor.getFiles(),
            canvasCommentsRef.current,
          ));
        })
        .catch((error) => {
          if (activeRef.current) setReferenceMessage((error as Error).message);
        })
        .finally(() => uploadingFileIdsRef.current.delete(file.id));
    }
  }, [projectId, queueSnapshot]);

  const handleCanvasChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    const nextCanvasTextEditing = Boolean(appState.editingTextElement);
    canvasTextEditingRef.current = nextCanvasTextEditing;
    setCanvasTextEditing((current) => current === nextCanvasTextEditing ? current : nextCanvasTextEditing);
    const frames = elements
      .filter((element) => !element.isDeleted)
      .map((element) => researchFrameReferenceForElement(element, elements))
      .filter((reference): reference is AstryxResearchFrameReference => Boolean(reference));
    setResearchFrames((current) => (
      researchFrameReferencesEqual(current, frames) ? current : frames
    ));
    const selectedFrames = frames.filter((frame) => appState.selectedElementIds[frame.elementId]);
    const selectedFrame = selectedFrames.length === 1 ? selectedFrames[0] : undefined;
    setSelectedResearchFrame((current) => {
      if (!current && !selectedFrame) return current;
      if (
        current?.elementId === selectedFrame?.elementId
        && current?.title === selectedFrame?.title
        && current?.itemCount === selectedFrame?.itemCount
      ) return current;
      return selectedFrame;
    });
    setResearchFrameDrawing(appState.activeTool.type === "frame");
    const documents = elements
      .filter((element) => !element.isDeleted)
      .map(documentReferenceForElement)
      .filter((reference): reference is AstryxCanvasDocumentReference => Boolean(reference));
    setCanvasDocuments((current) => (
      canvasDocumentReferencesEqual(current, documents) ? current : documents
    ));
    const selectedScreens = elements
      .filter((element) => appState.selectedElementIds[element.id])
      .map(screenReferenceForElement)
      .filter((reference): reference is AstryxScreenReference => Boolean(reference));
    const selectedScreen = selectedScreens.length === 1 ? selectedScreens[0] : undefined;
    setSelectedScreenReference((current) =>
      current?.elementId === selectedScreen?.elementId ? current : selectedScreen);
    const nextMoodboardReferences = elements
      .map((element) => moodboardReferenceForElement(element, elements))
      .filter((reference): reference is ProjectMoodboardReference => Boolean(reference));
    setMoodboardReferences((current) => (
      moodboardReferencesEqual(current, nextMoodboardReferences)
        ? current
        : nextMoodboardReferences
    ));
    const selectedMoodboardReferences = nextMoodboardReferences.filter((reference) => (
      appState.selectedElementIds[reference.elementId]
    ));
    const selectedMoodboard = selectedMoodboardReferences.length === 1
      ? selectedMoodboardReferences[0]
      : undefined;
    setSelectedMoodboardReference((current) => {
      if (!current && !selectedMoodboard) return current;
      if (
        current?.elementId === selectedMoodboard?.elementId
        && current?.caption === selectedMoodboard?.caption
        && current?.decision === selectedMoodboard?.decision
        && current?.sectionId === selectedMoodboard?.sectionId
        && current?.x === selectedMoodboard?.x
        && current?.y === selectedMoodboard?.y
        && current?.width === selectedMoodboard?.width
        && current?.height === selectedMoodboard?.height
      ) return current;
      return selectedMoodboard;
    });
    const nextMoodboardSections = elements
      .map(moodboardSectionForElement)
      .filter((section): section is AstryxMoodboardSectionReference => Boolean(section));
    setMoodboardSections((current) => (
      moodboardSectionsEqual(current, nextMoodboardSections)
        ? current
        : nextMoodboardSections
    ));
    const nextMoodboardSmartCompose = elements
      .map(moodboardSmartComposeForElement)
      .find((result): result is ProjectMoodboardSmartComposeResult => Boolean(result));
    setMoodboardSmartCompose((current) => (
      moodboardSmartComposeResultsEqual(current, nextMoodboardSmartCompose)
        ? current
        : nextMoodboardSmartCompose
    ));
    const selectedDataReferences = elements
      .filter((element) => appState.selectedElementIds[element.id])
      .map(canvasDataReferenceForElement)
      .filter((reference): reference is AstryxCanvasDataReference => Boolean(reference));
    const selectedDataReference = selectedDataReferences.length === 1
      ? selectedDataReferences[0]
      : undefined;
    setSelectedDataReference((current) =>
      current?.elementId === selectedDataReference?.elementId ? current : selectedDataReference);
    const selectedDocuments = elements
      .filter((element) => appState.selectedElementIds[element.id])
      .map(documentReferenceForElement)
      .filter((reference): reference is AstryxCanvasDocumentReference => Boolean(reference));
    const selectedDocument = selectedDocuments.length === 1 ? selectedDocuments[0] : undefined;
    setSelectedCanvasDocument((current) => {
      if (!current && !selectedDocument) return current;
      if (
        current?.elementId === selectedDocument?.elementId
        && current.title === selectedDocument.title
        && current.body === selectedDocument.body
        && current.templateId === selectedDocument.templateId
        && current.expanded === selectedDocument.expanded
        && current.x === selectedDocument.x
        && current.y === selectedDocument.y
        && current.width === selectedDocument.width
        && current.height === selectedDocument.height
      ) return current;
      return selectedDocument;
    });
    const selectedStickyNotes = elements
      .filter((element) => appState.selectedElementIds[element.id])
      .map(stickyNoteReferenceForElement)
      .filter((reference): reference is AstryxStickyNoteReference => Boolean(reference));
    const selectedSticky = selectedStickyNotes.length === 1 ? selectedStickyNotes[0] : undefined;
    setSelectedStickyNote((current) => (
      stickyNoteReferencesEqual(current, selectedSticky) ? current : selectedSticky
    ));
    const nextStickyNotes = elements
      .map(stickyNoteReferenceForElement)
      .filter((reference): reference is AstryxStickyNoteReference => Boolean(reference));
    setStickyNotes((current) => (
      stickyNoteReferenceListsEqual(current, nextStickyNotes) ? current : nextStickyNotes
    ));
    const nextViewport = {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom.value,
    };
    setCanvasViewport((current) => (
      current.scrollX === nextViewport.scrollX
      && current.scrollY === nextViewport.scrollY
      && current.zoom === nextViewport.zoom
        ? current
        : nextViewport
    ));
    if (!loadedRef.current) return;
    const snapshot = serializeCanvas(elements, appState, files, canvasCommentsRef.current);
    queueSnapshot(snapshot);
    const elementsVersion = hashElementsVersion(elements);
    const isRemoteApplication = remoteElementsVersionRef.current === elementsVersion
      && Date.now() <= remoteBroadcastSuppressedUntilRef.current;
    if (isRemoteApplication) {
      remoteElementsVersionRef.current = undefined;
    } else {
      collaborationRef.current?.publishScene(snapshot);
    }
    persistEmbeddedFiles(files);
  }, [persistEmbeddedFiles, queueSnapshot]);

  useEffect(() => {
    const collaboration = openDesignerCanvasCollaboration({
      projectId,
      canvasId,
      onStatus: setCollaborationStatus,
      onPresence(collaborators) {
        remoteCollaboratorsRef.current = new Map(
          collaborators.map((collaborator) => [collaborator.clientId, collaborator]),
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
        queueSnapshot(serializeCanvas(value.elements, editor.getAppState(), files, comments));
      },
    });
    collaborationRef.current = collaboration;
    return () => {
      collaboration.close();
      if (collaborationRef.current === collaboration) collaborationRef.current = null;
    };
  }, [canvasId, projectId, queueSnapshot, syncCanvasCollaborators]);

  const createMoodboardSections = useCallback((
    presets: readonly ProjectMoodboardSectionPreset[],
  ) => {
    if (canvasReadOnly) return;
    const editor = editorRef.current;
    if (!editor) return;
    const sceneElements = editor.getSceneElements();
    const existingIds = new Set(sceneElements
      .map(moodboardSectionForElement)
      .filter((section): section is AstryxMoodboardSectionReference => Boolean(section))
      .map((section) => section.id));
    const missing = presets.filter((preset) => !existingIds.has(preset.id));
    if (missing.length === 0) {
      setMoodboardMessage("Those moodboard sections are already on the canvas.");
      return;
    }

    const existingFrames = sceneElements.filter((element) => moodboardSectionForElement(element));
    const appState = editor.getAppState();
    const zoom = appState.zoom.value;
    const baseX = existingFrames.length > 0
      ? Math.max(...existingFrames.map((frame) => frame.x + frame.width)) + 96
      : -appState.scrollX + appState.width / (2 * zoom) - 360;
    const baseY = existingFrames.length > 0
      ? existingFrames[0].y
      : -appState.scrollY + appState.height / (2 * zoom) - 310;
    const created = missing.map((preset, index) => {
      const [frame] = convertToExcalidrawElements([{
        type: "frame",
        children: [],
        x: baseX + index * 816,
        y: baseY,
        width: 720,
        height: 620,
        name: preset.title,
        customData: {
          astryxReference: {
            kind: "moodboard-section",
            sectionId: preset.id,
            createdAt: new Date().toISOString(),
          },
        },
      } as ElementSkeleton]);
      return frame;
    });
    editor.setActiveTool({ type: "selection" });
    editor.updateScene({ elements: [...sceneElements, ...created] });
    editor.scrollToContent(created, { animate: true, fitToViewport: true });
    setMoodboardMessage(
      missing.length === 1
        ? `Added ${missing[0].title}.`
        : "Moodboard structure is ready. New references will land in Unsorted.",
    );
  }, [canvasReadOnly]);

  const ensureMoodboardInbox = useCallback(() => {
    const unsorted = projectMoodboardSectionPresets.find((section) => section.id === "unsorted");
    if (unsorted) createMoodboardSections([unsorted]);
  }, [createMoodboardSections]);

  const composeMoodboard = useCallback(async () => {
    if (canvasReadOnly || moodboardSmartComposeBusy) return;
    const editor = editorRef.current;
    if (!editor) return;
    const sceneElements = editor.getSceneElements();
    const sectionFrames = sceneElements
      .map((element) => ({ element, section: moodboardSectionForElement(element) }))
      .filter((entry): entry is {
        element: ExcalidrawElement;
        section: AstryxMoodboardSectionReference;
      } => Boolean(entry.section));
    const references = sceneElements
      .map((element) => moodboardReferenceForElement(element, sceneElements))
      .filter((reference): reference is ProjectMoodboardReference => Boolean(reference));
    if (sectionFrames.length === 0 || references.length === 0) {
      setMoodboardMessage("Add a moodboard section and at least one reference before composing.");
      return;
    }

    setMoodboardSmartComposeBusy(true);
    setMoodboardMessage("Composing the board from your confirmed reference decisions…");
    try {
      const files = editor.getFiles();
      const analyses = (await Promise.all(references
        .filter((reference) => reference.decision === "keep")
        .map(async (reference) => {
          const element = sceneElements.find((candidate) => candidate.id === reference.elementId);
          if (!element) return undefined;
          try {
            return await analyzeMoodboardImageFile(reference.elementId, element, files);
          } catch {
            return undefined;
          }
        })))
        .filter((analysis): analysis is ProjectMoodboardImageAnalysis => Boolean(analysis));
      const result = buildMoodboardSmartComposeResult({
        references,
        sections: sectionFrames.map(({ section }) => ({ id: section.id, title: section.title })),
        analyses,
      });

      const elementPatches = new Map<string, Partial<ExcalidrawElement>>();
      const decisionOrder: Record<ProjectMoodboardDecision, number> = {
        keep: 0,
        maybe: 1,
        reject: 2,
      };
      for (const { element: sectionFrame } of sectionFrames) {
        const children = sceneElements
          .filter((element) => element.type === "image" && element.frameId === sectionFrame.id)
          .map((element) => ({
            element,
            reference: moodboardReferenceForElement(element, sceneElements),
          }))
          .filter((entry): entry is {
            element: ExcalidrawElement;
            reference: ProjectMoodboardReference;
          } => Boolean(entry.reference))
          .sort((left, right) => (
            decisionOrder[left.reference.decision] - decisionOrder[right.reference.decision]
          ));
        let requiredFrameHeight = sectionFrame.height;
        children.forEach(({ element }, index) => {
          const placement = layoutMoodboardReferenceInSection({
            image: { width: element.width, height: element.height },
            section: {
              x: sectionFrame.x,
              y: sectionFrame.y,
              width: sectionFrame.width,
              height: requiredFrameHeight,
            },
            occupiedCount: index,
          });
          requiredFrameHeight = Math.max(requiredFrameHeight, placement.requiredFrameHeight);
          elementPatches.set(element.id, {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
          });
        });
        if (requiredFrameHeight !== sectionFrame.height) {
          elementPatches.set(sectionFrame.id, { height: requiredFrameHeight });
        }
      }

      const anchor = sectionFrames.find(({ section }) => section.id === "unsorted")
        ?? sectionFrames[0];
      const anchorCustomData = anchor.element.customData as Record<string, unknown> | undefined;
      const anchorReference = anchorCustomData?.astryxReference as Record<string, unknown> | undefined;
      elementPatches.set(anchor.element.id, {
        ...elementPatches.get(anchor.element.id),
        customData: {
          ...anchorCustomData,
          astryxReference: {
            ...anchorReference,
            smartCompose: result,
          },
        },
      });

      const composedElements = sceneElements.map((element) => {
        const patch = elementPatches.get(element.id);
        return patch ? withCanvasElementUpdate(element, patch) : element;
      });
      editor.updateScene({ elements: composedElements });
      setMoodboardSmartCompose(result);
      setMoodboardMessage(
        analyses.length > 0
          ? `Board composed from ${analyses.length} Keep ${analyses.length === 1 ? "reference" : "references"}. Review the automated interpretation.`
          : references.some((reference) => reference.decision === "keep")
            ? "Board tidied. The Keep images could not be sampled, so visual signals were withheld."
            : "Board tidied. Mark at least one reference Keep to generate palette and visual signals.",
      );
    } finally {
      setMoodboardSmartComposeBusy(false);
    }
  }, [canvasReadOnly, moodboardSmartComposeBusy]);

  const moodboardImagePlacement = useCallback((width: number, height: number) => {
    const editor = editorRef.current;
    if (!editor) return { x: 0, y: 0, width, height, frameId: undefined };
    const elements = editor.getSceneElements();
    const unsorted = elements.find((element) => moodboardSectionForElement(element)?.id === "unsorted");
    if (unsorted) {
      const children = elements.filter((element) => (
        !element.isDeleted && element.type === "image" && element.frameId === unsorted.id
      ));
      const cellWidth = 304;
      const maxHeight = 230;
      const scale = Math.min(1, cellWidth / width, maxHeight / height);
      const placedWidth = Math.max(80, Math.round(width * scale));
      const placedHeight = Math.max(80, Math.round(height * scale));
      const column = children.length % 2;
      const row = Math.floor(children.length / 2);
      return {
        x: unsorted.x + 32 + column * 344,
        y: unsorted.y + 64 + row * 264,
        width: placedWidth,
        height: placedHeight,
        frameId: unsorted.id,
      };
    }
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

  const insertReference = useCallback(async (item: ResearchProjectItem) => {
    const editor = editorRef.current;
    if (!editor || !item.mediaUrl || item.restricted) return;
    setInsertingReferenceId(item.id);
    setReferenceMessage("");
    try {
      const response = await fetch(item.mediaUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Reference image returned ${response.status}`);
      const blob = await response.blob();
      if (!canvasMediaMimeTypeSet.has(blob.type)) {
        throw new Error("This reference is not a supported PNG, JPEG, or WebP image.");
      }
      const fileId = crypto.randomUUID() as FileId;
      const src = await uploadProjectCanvasAsset(projectId, `asset:${fileId}`, blob);
      const dimensions = await imageDimensions(blob);
      const placement = moodboardImagePlacement(dimensions.width, dimensions.height);
      const file: BinaryFileData = {
        id: fileId,
        mimeType: blob.type as BinaryFileData["mimeType"],
        dataURL: src as DataURL,
        created: Date.now(),
      };
      const [image] = convertToExcalidrawElements([{
        type: "image",
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        fileId,
        status: "saved",
      }]);
      const moodboard: StoredMoodboardReference = {
        sourceKind: "project-reference",
        sourceId: String(item.id),
        sourceLabel: item.stepLabel || item.snapshot.title,
        sourceUrl: item.snapshot.sourcePath || item.mediaUrl,
        caption: item.note,
        decision: "maybe",
        addedAt: new Date().toISOString(),
      };
      const referenceImage = {
        ...image,
        frameId: placement.frameId ?? null,
        opacity: moodboardDecisionOpacity(moodboard.decision),
        customData: {
          ...image.customData,
          astryxReference: {
            kind: "research-reference",
            itemId: item.id,
            appId: item.appId ?? null,
            title: item.snapshot.title,
            moodboard,
          },
        },
      } as ExcalidrawElement;
      editor.addFiles([file]);
      editor.updateScene({ elements: [...editor.getSceneElements(), referenceImage] });
      editor.scrollToContent(referenceImage, { animate: true, fitToViewport: false });
      setReferenceMessage(`Added ${item.stepLabel || item.snapshot.title} to the moodboard.`);
      setMoodboardMessage(`Added ${item.stepLabel || item.snapshot.title} to Unsorted.`);
    } catch (error) {
      setReferenceMessage((error as Error).message);
    } finally {
      setInsertingReferenceId(undefined);
    }
  }, [moodboardImagePlacement, projectId]);

  const insertCatalogScreen = useCallback(async (result: AppsDiscoveryScreenResult) => {
    const editor = editorRef.current;
    if (!editor) return;
    const { app, screen } = result;
    setInsertingScreenKey(projectScreenKey(result));
    setScreenMessage("");
    try {
      const response = await fetch(canvasMediaFetchUrl(screen.url), { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Screen image returned ${response.status}`);
      const blob = await response.blob();
      if (!canvasMediaMimeTypeSet.has(blob.type)) {
        throw new Error("This screen is not a supported PNG, JPEG, or WebP image.");
      }
      const fileId = crypto.randomUUID() as FileId;
      let src = screen.url;
      let storedInProject = true;
      try {
        src = await uploadProjectCanvasAsset(projectId, `asset:${fileId}`, blob);
      } catch {
        storedInProject = false;
      }
      const dimensions = await imageDimensions(blob);
      const placement = moodboardImagePlacement(dimensions.width, dimensions.height);
      const file: BinaryFileData = {
        id: fileId,
        mimeType: blob.type as BinaryFileData["mimeType"],
        dataURL: src as DataURL,
        created: Date.now(),
      };
      const [image] = convertToExcalidrawElements([{
        type: "image",
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        fileId,
        status: "saved",
      }]);
      const moodboard: StoredMoodboardReference = {
        sourceKind: "screen",
        sourceId: `${app.id}:${screen.id}`,
        sourceLabel: `${app.app} · ${screen.type || "Screen"}`,
        sourceUrl: screen.sourceUrl ?? screen.url,
        caption: "",
        decision: "maybe",
        addedAt: new Date().toISOString(),
      };
      const referenceImage = {
        ...image,
        frameId: placement.frameId ?? null,
        opacity: moodboardDecisionOpacity(moodboard.decision),
        customData: {
          ...image.customData,
          astryxReference: {
            kind: "screen",
            appId: app.id,
            appName: app.app,
            screenId: screen.id,
            screenType: screen.type,
            platform: screen.platform,
            mediaUrl: screen.url,
            sourceUrl: screen.sourceUrl ?? null,
            moodboard,
          },
        },
      } as ExcalidrawElement;
      editor.addFiles([file]);
      editor.updateScene({ elements: [...editor.getSceneElements(), referenceImage] });
      editor.scrollToContent(referenceImage, { animate: true, fitToViewport: false });
      setScreenMessage(
        storedInProject
          ? `Added ${app.app} · ${screen.type || "Screen"}.`
          : `Added ${app.app} · ${screen.type || "Screen"} locally. Sign in to sync it.`,
      );
      setMoodboardMessage(`Added ${app.app} · ${screen.type || "Screen"} to Unsorted.`);
    } catch (error) {
      setScreenMessage((error as Error).message);
    } finally {
      setInsertingScreenKey(undefined);
    }
  }, [moodboardImagePlacement, projectId]);

  const insertMoodboardUploads = useCallback(async (uploads: readonly File[]) => {
    if (canvasReadOnly) return;
    const editor = editorRef.current;
    if (!editor || uploads.length === 0) return;
    ensureMoodboardInbox();
    setMoodboardMessage(`Adding ${uploads.length} ${uploads.length === 1 ? "image" : "images"}…`);
    let inserted = 0;
    for (const upload of uploads) {
      if (!canvasMediaMimeTypeSet.has(upload.type)) continue;
      try {
        const fileId = crypto.randomUUID() as FileId;
        const src = await uploadProjectCanvasAsset(projectId, `asset:${fileId}`, upload);
        const dimensions = await imageDimensions(upload);
        const placement = moodboardImagePlacement(dimensions.width, dimensions.height);
        const file: BinaryFileData = {
          id: fileId,
          mimeType: upload.type as BinaryFileData["mimeType"],
          dataURL: src as DataURL,
          created: Date.now(),
        };
        const [image] = convertToExcalidrawElements([{
          type: "image",
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          fileId,
          status: "saved",
        }]);
        const moodboard: StoredMoodboardReference = {
          sourceKind: "upload",
          sourceId: fileId,
          sourceLabel: upload.name,
          caption: "",
          decision: "maybe",
          addedAt: new Date().toISOString(),
        };
        const referenceImage = {
          ...image,
          frameId: placement.frameId ?? null,
          opacity: moodboardDecisionOpacity(moodboard.decision),
          customData: {
            ...image.customData,
            astryxReference: {
              kind: "upload",
              fileName: upload.name,
              moodboard,
            },
          },
        } as ExcalidrawElement;
        editor.addFiles([file]);
        editor.updateScene({ elements: [...editor.getSceneElements(), referenceImage] });
        inserted += 1;
      } catch (error) {
        setMoodboardMessage(error instanceof Error ? error.message : "Image upload failed");
      }
    }
    if (inserted > 0) {
      setMoodboardMessage(
        `Added ${inserted} ${inserted === 1 ? "image" : "images"} to Unsorted.`,
      );
    }
  }, [canvasReadOnly, ensureMoodboardInbox, moodboardImagePlacement, projectId]);

  const insertCanvasDataReference = useCallback((
    reference: AstryxCanvasDataPayload,
    message: string,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;
    const appState = editor.getAppState();
    const zoom = appState.zoom.value;
    const sceneElements = editor.getSceneElements();
    const lastDataCard = [...sceneElements]
      .reverse()
      .find((element) => canvasDataReferenceForElement(element));
    const cardWidth = reference.kind === "app" ? 440 : 560;
    const cardHeight = reference.kind === "app" ? 250 : 320;
    const centerX = lastDataCard
      ? lastDataCard.x + lastDataCard.width + 40 + cardWidth / 2
      : -appState.scrollX + appState.width / (2 * zoom);
    const centerY = lastDataCard
      ? lastDataCard.y + cardHeight / 2
      : -appState.scrollY + appState.height / (2 * zoom);
    const created = createCanvasDataCardElements(reference, centerX, centerY);
    const container = created.find((element) => element.type === "rectangle");
    editor.updateScene({
      elements: [...sceneElements, ...created],
      appState: { selectedElementIds: container ? { [container.id]: true } : {} },
    });
    editor.scrollToContent(created, { animate: true, fitToViewport: false });
    if (container) setSelectedDataReference(canvasDataReferenceForElement(container));
    setDataToolsMessage(message);
  }, []);

  const insertCatalogApp = useCallback((app: App, platform: Platform) => {
    const key = projectCanvasDataKey(app);
    setInsertingDataKey(key);
    try {
      insertCanvasDataReference({
        kind: "app",
        appId: app.id,
        appName: app.app,
        description: app.description ?? "",
        category: app.categories[0]?.name ?? "Uncategorized",
        platform,
        totalScreens: app.totalScreens,
      }, `Added ${app.app} to the canvas.`);
    } finally {
      setInsertingDataKey(undefined);
    }
  }, [insertCanvasDataReference]);

  const insertCatalogFlow = useCallback((item: FlowCatalogItem, platform: Platform) => {
    const key = projectCanvasDataKey(item);
    setInsertingDataKey(key);
    try {
      insertCanvasDataReference({
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
      }, `Added ${item.title} to the canvas.`);
    } finally {
      setInsertingDataKey(undefined);
    }
  }, [insertCanvasDataReference]);

  const insertTemplate = useCallback((template: ProjectCanvasTemplate) => {
    const editor = editorRef.current;
    if (!editor) return;
    const appState = editor.getAppState();
    const zoom = appState.zoom.value;
    const minX = Math.min(...template.elements.map((element) => element.x));
    const minY = Math.min(...template.elements.map((element) => element.y));
    const maxX = Math.max(...template.elements.map((element) => element.x + (element.width ?? 0)));
    const maxY = Math.max(...template.elements.map((element) => element.y + (element.height ?? 0)));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const centerX = -appState.scrollX + appState.width / (2 * zoom);
    const centerY = -appState.scrollY + appState.height / (2 * zoom);
    const offsetX = centerX - width / 2 - minX;
    const offsetY = centerY - height / 2 - minY;
    type ElementSkeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>[number];
    const elements = convertToExcalidrawElements(template.elements.map((element) => ({
      ...element,
      x: element.x + offsetX,
      y: element.y + offsetY,
    })) as unknown as ElementSkeleton[]);
    editor.updateScene({ elements: [...editor.getSceneElements(), ...elements] });
    editor.scrollToContent(elements, { animate: true, fitToViewport: false });
    setTemplatesOpen(false);
    setReferenceMessage(`Added ${template.title} to the canvas.`);
  }, []);

  const focusResearchFrame = useCallback((elementId: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const frame = editor.getSceneElements().find((element) => (
      !element.isDeleted && element.type === "frame" && element.id === elementId
    ));
    if (!frame) return;
    editor.setActiveTool({ type: "selection" });
    editor.updateScene({ appState: { selectedElementIds: { [frame.id]: true } } });
    editor.scrollToContent(frame, { animate: true, fitToViewport: true });
    setSelectedResearchFrame(researchFrameReferenceForElement(frame, editor.getSceneElements()));
  }, []);

  const insertResearchFrame = useCallback((preset: ProjectResearchFramePreset) => {
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
      : -appState.scrollX + appState.width / (2 * zoom) - researchFrameWidth / 2;
    const y = lastFrame
      ? lastFrame.y
      : -appState.scrollY + appState.height / (2 * zoom) - researchFrameHeight / 2;
    const [frame] = convertToExcalidrawElements([{
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
    } as ElementSkeleton]);
    editor.setActiveTool({ type: "selection" });
    editor.updateScene({
      elements: [...sceneElements, frame],
      appState: { selectedElementIds: { [frame.id]: true } },
    });
    editor.scrollToContent(frame, { animate: true, fitToViewport: true });
    setResearchFramesOpen(false);
  }, []);

  const drawResearchFrame = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setResearchFramesOpen(false);
    setResearchFrameDrawing(true);
    setStickyPickerOpen(false);
    setStickyDraft(undefined);
    setStickyPlacement(undefined);
    setDocumentPlacement(false);
    setMoodboardOpen(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setDataToolsOpen(false);
    setReferencesOpen(false);
    editor.setActiveTool({ type: "frame" });
    editor.setCursor("crosshair");
  }, []);

  const stopStickyPlacement = useCallback(() => {
    setStickyPickerOpen(false);
    setStickyPlacement(undefined);
    const editor = editorRef.current;
    editor?.resetCursor();
    editor?.setActiveTool({ type: "selection" });
  }, []);

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
    setResearchFramesOpen(false);
    setMoodboardOpen(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setDataToolsOpen(false);
    setReferencesOpen(false);
    setToolsCatalogOpen(false);
    setCommentPlacement(true);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-comment" });
    editor?.setCursor(commentPlacementCursor);
  }, [commentPlacement, stopCommentPlacement, stopDocumentPlacement, stopStickyPlacement]);

  const armDocumentPlacement = useCallback(() => {
    stopCommentPlacement();
    setDocumentPlacement(true);
    setResearchFramesOpen(false);
    setStickyPickerOpen(false);
    setStickyDraft(undefined);
    stopStickyPlacement();
    setMoodboardOpen(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setDataToolsOpen(false);
    setReferencesOpen(false);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-document" });
    editor?.setCursor("crosshair");
  }, [stopCommentPlacement, stopStickyPlacement]);

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
    const minimumCenterY = viewportTop
      + canvasDocumentViewportTopSafeArea / zoom
      + canvasDocumentHeight / 2;
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
    if (container) setSelectedCanvasDocument(documentReferenceForElement(container));
  }, []);

  const armStickyPlacement = useCallback((
    color: ProjectStickyNoteColor,
    mode: StickyPlacementMode,
    keepPickerOpen = false,
  ) => {
    stopCommentPlacement();
    setStickyPickerOpen(keepPickerOpen);
    setResearchFramesOpen(false);
    setStickyDraft(undefined);
    setStickyPlacement({ color, mode });
    setMoodboardOpen(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setDataToolsOpen(false);
    setReferencesOpen(false);
    const editor = editorRef.current;
    editor?.setActiveTool({ type: "custom", customType: "astryx-sticky-note" });
    editor?.setCursor(stickyNotePlacementCursor(color, mode));
  }, [stopCommentPlacement]);

  const toggleStickyNoteTool = useCallback(() => {
    if (stickyPickerOpen || stickyPlacement) {
      stopStickyPlacement();
      return;
    }
    stopDocumentPlacement();
    editorRef.current?.updateScene({ appState: { selectedElementIds: {} } });
    setSelectedStickyNote(undefined);
    armStickyPlacement(projectStickyNoteColors[0], "single", true);
  }, [
    armStickyPlacement,
    stickyPickerOpen,
    stickyPlacement,
    stopDocumentPlacement,
    stopStickyPlacement,
  ]);

  const updateSelectedMoodboardReference = useCallback((patch: {
    caption?: string;
    decision?: ProjectMoodboardDecision;
  }) => {
    if (canvasReadOnly) return;
    const editor = editorRef.current;
    const selected = selectedMoodboardReference;
    if (!editor || !selected) return;
    const elements = editor.getSceneElements();
    const nextElements = elements.map((element) => {
      if (element.id !== selected.elementId) return element;
      const customData = element.customData as Record<string, unknown> | undefined;
      const reference = customData?.astryxReference as Record<string, unknown> | undefined;
      const currentMoodboard = reference?.moodboard as StoredMoodboardReference | undefined;
      if (!reference || !currentMoodboard) return element;
      const moodboard: StoredMoodboardReference = {
        ...currentMoodboard,
        ...(patch.caption !== undefined ? { caption: patch.caption } : {}),
        ...(patch.decision !== undefined ? { decision: patch.decision } : {}),
      };
      return withCanvasElementUpdate(element, {
        opacity: moodboardDecisionOpacity(moodboard.decision),
        customData: {
          ...customData,
          astryxReference: { ...reference, moodboard },
        },
      });
    });
    editor.updateScene({ elements: nextElements });
    setSelectedMoodboardReference({ ...selected, ...patch });
  }, [canvasReadOnly, selectedMoodboardReference]);

  const moveSelectedMoodboardReference = useCallback((sectionId: ProjectMoodboardSectionId) => {
    if (canvasReadOnly) return;
    const editor = editorRef.current;
    const selected = selectedMoodboardReference;
    if (!editor || !selected || selected.sectionId === sectionId) return;

    const elements = editor.getSceneElements();
    const selectedElement = elements.find((element) => (
      element.id === selected.elementId && !element.isDeleted && element.type === "image"
    ));
    const targetFrame = elements.find((element) => (
      moodboardSectionForElement(element)?.id === sectionId
    ));
    if (!selectedElement || !targetFrame) {
      setMoodboardMessage("That moodboard section is no longer available.");
      return;
    }

    const targetChildren = elements.filter((element) => (
      element.id !== selected.elementId
      && !element.isDeleted
      && element.type === "image"
      && element.frameId === targetFrame.id
      && Boolean(moodboardReferenceForElement(element))
    ));
    const { x, y, width, height, requiredFrameHeight } = layoutMoodboardReferenceInSection({
      image: selectedElement,
      section: targetFrame,
      occupiedCount: targetChildren.length,
    });
    let movedElement: ExcalidrawElement | undefined;
    const nextElements = elements.map((element) => {
      if (element.id === targetFrame.id && requiredFrameHeight > targetFrame.height) {
        return withCanvasElementUpdate(element, { height: requiredFrameHeight });
      }
      if (element.id !== selected.elementId) return element;
      movedElement = withCanvasElementUpdate(element, {
        x,
        y,
        width,
        height,
        frameId: targetFrame.id,
      });
      return movedElement;
    });
    editor.updateScene({
      elements: nextElements,
      appState: { selectedElementIds: { [selected.elementId]: true } },
    });
    if (movedElement) editor.scrollToContent(movedElement, { animate: true, fitToViewport: false });
    setSelectedMoodboardReference({ ...selected, sectionId, x, y, width, height });
    const targetTitle = moodboardSectionForElement(targetFrame)?.title ?? "the selected section";
    setMoodboardMessage(`Moved ${selected.sourceLabel} to ${targetTitle}.`);
  }, [canvasReadOnly, selectedMoodboardReference]);

  const dismissMoodboardReference = useCallback(() => {
    editorRef.current?.updateScene({ appState: { selectedElementIds: {} } });
    setSelectedMoodboardReference(undefined);
  }, []);

  const activateCanvasTool = useCallback((tool: ProjectCanvasTool) => {
    setToolsCatalogQuery("");

    if (tool === "more") {
      const nextOpen = !toolsCatalogOpen;
      stopStickyPlacement();
      stopDocumentPlacement();
      setResearchFramesOpen(false);
      setMoodboardOpen(false);
      setScreensOpen(false);
      setTemplatesOpen(false);
      setDataToolsOpen(false);
      setReferencesOpen(false);
      setToolsCatalogOpen(nextOpen);
      return;
    }

    setToolsCatalogOpen(false);
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
    setMoodboardOpen(false);
    setScreensOpen(false);
    setTemplatesOpen(false);
    setDataToolsOpen(false);
    setReferencesOpen(false);

    if (tool === "moodboard") {
      editorRef.current?.setActiveTool({ type: "selection" });
      editorRef.current?.resetCursor();
      setMoodboardOpen(!moodboardOpen);
    } else if (tool === "screens") {
      setScreensOpen(!screensOpen);
    } else if (tool === "research-frames") {
      editorRef.current?.setActiveTool({ type: "selection" });
      editorRef.current?.resetCursor();
      setResearchFrameDrawing(false);
      setResearchFramesOpen(!researchFramesOpen);
    } else if (tool === "data") {
      setDataToolsOpen(!dataToolsOpen);
    } else if (tool === "templates") {
      setTemplatesOpen(!templatesOpen);
    }
  }, [
    armDocumentPlacement,
    dataToolsOpen,
    documentPlacement,
    moodboardOpen,
    researchFramesOpen,
    screensOpen,
    stopDocumentPlacement,
    stopStickyPlacement,
    stopCommentPlacement,
    templatesOpen,
    toggleStickyNoteTool,
    toggleCommentTool,
    toolsCatalogOpen,
  ]);

  const insertStickyNotesAt = useCallback((
    x: number,
    y: number,
    color: ProjectStickyNoteColor,
    labels: readonly string[],
    format = defaultProjectStickyNoteFormat,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;
    const created = labels.flatMap((text, index) => createStickyNoteElements({
      x: x + index * 18,
      y: y + index * 18,
      color,
      text,
      format,
    }));
    const lastContainer = [...created].reverse().find((element) => element.type === "rectangle");
    editor.updateScene({
      elements: [...editor.getSceneElements(), ...created],
      appState: {
        selectedElementIds: lastContainer ? { [lastContainer.id]: true } : {},
      },
    });
    return lastContainer?.id;
  }, []);

  const commitStickyDraft = useCallback((value = stickyDraft?.value ?? "") => {
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

    if (selectedElementId) {
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
  }, [insertStickyNotesAt, stickyDraft]);

  const cancelStickyDraft = useCallback(() => {
    setStickyDraft(undefined);
    window.requestAnimationFrame(() => {
      canvasRootRef.current
        ?.querySelector<HTMLElement>(".excalidraw__canvas")
        ?.focus({ preventScroll: true });
    });
  }, []);

  const handleCanvasPointerUp = useCallback((
    _activeTool: AppState["activeTool"],
    pointerDownState: PointerDownState,
  ) => {
    setToolsCatalogOpen(false);
    // Insert Astryx elements after Excalidraw finishes its own pointer-up
    // reconciliation. Updating the scene from onPointerDown lets Excalidraw's
    // selection handler restore the pre-click scene and discard the new item.
    // The visible placement state remains the source of truth because custom
    // tools may be normalized back to selection before this callback runs.
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
      insertStickyNotesAt(x, y, stickyPlacement.color, ["New idea", "New idea", "New idea"]);
      stopStickyPlacement();
      return;
    }
    setStickyDraft({
      x,
      y,
      color: stickyPlacement.color,
      value: "",
      format: defaultProjectStickyNoteFormat,
    });
    stopStickyPlacement();
  }, [
    documentPlacement,
    commentPlacement,
    insertCanvasDocumentAt,
    insertStickyNotesAt,
    stickyPlacement,
    stopDocumentPlacement,
    stopCommentPlacement,
    stopStickyPlacement,
  ]);

  useEffect(() => {
    const handleStickyShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.defaultPrevented
        || event.metaKey
        || event.ctrlKey
        || event.altKey
        || canvasTextEditingRef.current
        || target?.closest("input, textarea, [contenteditable='true']")
      ) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        toggleStickyNoteTool();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setToolsCatalogOpen(false);
        setResearchFramesOpen(false);
        setMoodboardOpen(false);
        setScreensOpen(false);
        setTemplatesOpen(false);
        setDataToolsOpen(false);
        stopDocumentPlacement();
        stopCommentPlacement();
        setCommentDraftAnchor(undefined);
        setSelectedCommentId(undefined);
        setStickyPickerOpen(false);
        cancelStickyDraft();
        stopStickyPlacement();
      }
    };
    window.addEventListener("keydown", handleStickyShortcut, true);
    return () => window.removeEventListener("keydown", handleStickyShortcut, true);
  }, [cancelStickyDraft, stopCommentPlacement, stopDocumentPlacement, stopStickyPlacement, toggleStickyNoteTool]);

  const stickyComposerStyle = useMemo(() => {
    if (!stickyDraft) return undefined;
    const editor = editorRef.current;
    const root = canvasRootRef.current;
    if (!editor || !root) return undefined;
    const appState = editor.getAppState();
    const zoom = appState.zoom.value;
    const width = stickyNoteSize;
    const height = stickyNoteSize;
    const noteLeft = (stickyDraft.x - stickyNoteSize / 2 + appState.scrollX) * zoom;
    const noteTop = (stickyDraft.y - stickyNoteSize / 2 + appState.scrollY) * zoom;
    const clampedLeft = Math.min(
      Math.max(76, noteLeft),
      Math.max(76, root.clientWidth - width - 16),
    );
    return {
      left: `${clampedLeft}px`,
      top: `${Math.min(Math.max(96, noteTop), Math.max(96, root.clientHeight - height - 16))}px`,
      "--sticky-fill": stickyDraft.color.fill,
      "--sticky-stroke": stickyDraft.color.stroke,
      "--sticky-text": stickyDraft.color.text,
      "--sticky-font-family": stickyDraft.format.font === "sketch"
        ? '"Virgil", "Comic Sans MS", cursive'
        : 'var(--reference-font-family, "Figtree", system-ui, sans-serif)',
      "--sticky-font-size": `${stickyDraft.format.fontSize}px`,
      "--sticky-text-align": stickyDraft.format.textAlign,
      "--sticky-justify-content": stickyDraft.format.textAlign === "left"
        ? "flex-start"
        : stickyDraft.format.textAlign === "right"
          ? "flex-end"
          : "center",
      // Excalidraw applies this filter to rendered scene colors in dark mode.
      // Mirror it on the HTML composer surface so the note does not change
      // color when editing ends and Excalidraw takes over rendering.
      "--sticky-theme-filter": resolvedTheme === "dark"
        ? "invert(93%) hue-rotate(180deg)"
        : "none",
    } as CSSProperties;
  }, [resolvedTheme, stickyDraft]);

  const stickyNoteMetadataStyle = useCallback((note: AstryxStickyNoteReference) => ({
    left: `${(note.x + canvasViewport.scrollX) * canvasViewport.zoom}px`,
    top: `${(note.y + note.height + canvasViewport.scrollY) * canvasViewport.zoom + 8}px`,
    maxWidth: `${Math.max(160, note.width * canvasViewport.zoom)}px`,
    opacity: canvasViewport.zoom < 0.35 ? 0 : 1,
  } as CSSProperties), [canvasViewport]);

  const canvasDocumentStyle = useCallback((document: AstryxCanvasDocumentReference) => {
    return {
      left: `${(document.x + canvasViewport.scrollX) * canvasViewport.zoom}px`,
      top: `${(document.y + canvasViewport.scrollY) * canvasViewport.zoom}px`,
      transform: `scale(${canvasViewport.zoom})`,
      transformOrigin: "top left",
      "--canvas-document-inverse-zoom": 1 / canvasViewport.zoom,
    } as CSSProperties;
  }, [canvasViewport]);

  const replaceCanvasDocument = useCallback((document: ProjectCanvasDocumentData) => {
    const editor = editorRef.current;
    const selected = selectedCanvasDocument;
    if (!editor || !selected) return;
    const sceneElements = editor.getSceneElements();
    const replacedIds = new Set([
      selected.elementId,
      ...sceneElements
        .filter((element) => (
          (element as ExcalidrawElement & { containerId?: string | null }).containerId
          === selected.elementId
        ))
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
      appState: { selectedElementIds: container ? { [container.id]: true } : {} },
    });
    if (container) setSelectedCanvasDocument(documentReferenceForElement(container));
  }, [selectedCanvasDocument]);

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
    void (canvasId
      ? getDesignerCanvasFile(projectId, canvasId)
      : getDesignerCanvas(projectId))
      .then(async (canvas) => {
        if (isExcalidrawSnapshot(canvas.snapshot)) {
          const comments = normalizeDesignerCanvasComments(canvas.snapshot.comments);
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
          if (canvasId) await saveDesignerCanvasFile(projectId, canvasId, snapshot);
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

  const syncProjectMenuPosition = useCallback(() => {
    const root = canvasRootRef.current;
    const trigger = projectMenuRef.current;
    if (!root || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const headerBottom = trigger.closest(".project-canvas-header")
      ?.getBoundingClientRect().bottom ?? rect.bottom;
    root.style.setProperty(
      "--project-menu-top",
      `${Math.round(Math.max(rect.bottom, headerBottom) + 8)}px`,
    );
    root.style.setProperty(
      "--project-menu-right",
      `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`,
    );
  }, []);

  useEffect(() => {
    syncProjectMenuPosition();
    window.addEventListener("resize", syncProjectMenuPosition);
    return () => window.removeEventListener("resize", syncProjectMenuPosition);
  }, [syncProjectMenuPosition]);

  const toggleProjectMenu = useCallback(() => {
    if (projectMenuWasOpenRef.current) {
      projectMenuWasOpenRef.current = false;
      return;
    }
    canvasRootRef.current
      ?.querySelector<HTMLButtonElement>("button.main-menu-trigger")
      ?.click();
  }, []);

  const rememberProjectMenuState = useCallback(() => {
    syncProjectMenuPosition();
    projectMenuWasOpenRef.current = Boolean(
      canvasRootRef.current?.querySelector(".App-menu_top__left .dropdown-menu"),
    );
  }, [syncProjectMenuPosition]);

  const selectedComment = canvasComments.find((thread) => thread.id === selectedCommentId);
  const submitCanvasComment = useCallback((body: string) => {
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
    commitCanvasComments(canvasCommentsRef.current.map((thread) => (
      thread.id === selectedCommentId
        ? { ...thread, messages: [...thread.messages, message] }
        : thread
    )));
    setCommentDraft("");
  }, [commentDraftAnchor, commitCanvasComments, selectedCommentId, userId, userName]);

  const toggleSelectedCommentResolved = useCallback(() => {
    if (!selectedCommentId) return;
    commitCanvasComments(canvasCommentsRef.current.map((thread) => (
      thread.id === selectedCommentId
        ? { ...thread, resolved: !thread.resolved }
        : thread
    )));
  }, [commitCanvasComments, selectedCommentId]);

  const deleteSelectedComment = useCallback(() => {
    if (!selectedCommentId) return;
    commitCanvasComments(
      canvasCommentsRef.current.filter((thread) => thread.id !== selectedCommentId),
    );
    setCommentDraftAnchor(undefined);
    setCommentDraft("");
    setSelectedCommentId(undefined);
  }, [commitCanvasComments, selectedCommentId]);

  const commentPinStyle = useCallback((thread: DesignerCanvasCommentThread) => ({
    left: `${(thread.x + canvasViewport.scrollX) * canvasViewport.zoom}px`,
    top: `${(thread.y + canvasViewport.scrollY) * canvasViewport.zoom}px`,
    opacity: canvasViewport.zoom < 0.2 ? 0 : 1,
  } as CSSProperties), [canvasViewport]);

  const moodboardDecisionBadgeStyle = useCallback((reference: ProjectMoodboardReference) => ({
    left: `${(reference.x + canvasViewport.scrollX) * canvasViewport.zoom + 8}px`,
    top: `${(reference.y + canvasViewport.scrollY) * canvasViewport.zoom + 8}px`,
    opacity: canvasViewport.zoom < 0.22 ? 0 : 1,
  } as CSSProperties), [canvasViewport]);

  const saveStatusLabel = saveErrorMessage
    && (saveState === "offline" || saveState === "unavailable")
    ? `${saveLabels[saveState]}: ${saveErrorMessage}`
    : saveLabels[saveState];
  const normalizedToolsCatalogQuery = toolsCatalogQuery.trim().toLowerCase();
  const filteredCanvasToolCatalogItems = projectCanvasToolCatalogItems.filter((item) => (
    !normalizedToolsCatalogQuery
    || `${item.title} ${item.description}`.toLowerCase().includes(normalizedToolsCatalogQuery)
  ));
  const canvasToolPanelOpen = toolsCatalogOpen
    || moodboardOpen
    || researchFramesOpen
    || screensOpen
    || templatesOpen
    || dataToolsOpen
    || stickyPickerOpen
    || Boolean(commentDraftAnchor)
    || Boolean(selectedComment);

  return (
    <main className="vitrine-page research-project-page research-project-page--playground">
      <header className="project-canvas-header" aria-label="Project canvas controls">
        <div
          className="project-canvas-header__group project-canvas-header__group--left"
          data-canvas-toolbar-region="top-left"
        >
          <IconButton
            label="Astryx projects home"
            icon={<img className="project-canvas-header__brand-mark" src="/favicon.svg" alt="" aria-hidden="true" />}
            variant="ghost"
            size="sm"
            clickAction={() => navigate({ name: "projects" })}
          />
          <Button
            label="Projects"
            variant="ghost"
            size="sm"
            clickAction={() => navigate({ name: "projects" })}
          />
          <span className="project-canvas-header__divider" aria-hidden="true" />
          <div className="project-canvas-header__identity">
            <span>Designer canvas</span>
            <div className="project-canvas-header__identity-title">
              <h1>{references?.title ?? "Designer project"}</h1>
              {(saveState === "offline" || saveState === "unavailable") ? (
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
            </div>
          </div>
          <span className="project-canvas-header__divider" aria-hidden="true" />
          <span ref={projectMenuRef} className="project-canvas-header__menu">
            <IconButton
              label="Project menu"
              icon={<Icon icon="menu" size="sm" />}
              variant="ghost"
              size="sm"
              onPointerDown={rememberProjectMenuState}
              clickAction={toggleProjectMenu}
            />
          </span>
        </div>
        <div
          className="project-canvas-header__group project-canvas-header__actions"
          data-canvas-toolbar-region="top-right"
        >
          <div
            className="project-canvas-collaborators"
            data-state={collaborationStatus}
            role="status"
            aria-live="polite"
            aria-label={collaborationStatusLabel}
            title={collaborationStatusLabel}
          >
            <span className="project-canvas-collaborators__avatars" aria-hidden="true">
              {onlineCollaborators.slice(0, 3).map((collaborator) => (
                <span
                  key={collaborator.id}
                  style={{ backgroundColor: canvasCollaboratorColor(collaborator.name).background }}
                >
                  {canvasCollaboratorInitials(collaborator.name)}
                </span>
              ))}
            </span>
            <span className="project-canvas-collaborators__label">{collaborationStatusLabel}</span>
          </div>
          <ProjectAccessButton
            project={{ id: projectId, title: references?.title ?? "Designer project" }}
            emphasized
          />
        </div>
      </header>
      <section className="project-playground project-playground--canvas-first" aria-label="Designer canvas">
        <div
          ref={canvasRootRef}
          className={`project-playground__canvas${
            selectedScreenReference ? " project-playground__canvas--screen-selected" : ""
          }${
            selectedMoodboardReference ? " project-playground__canvas--moodboard-reference-selected" : ""
          }${
            selectedCanvasDocument ? " project-playground__canvas--document-selected" : ""
          }${
            selectedDataReference ? " project-playground__canvas--data-selected" : ""
          }${
            selectedStickyNote ? " project-playground__canvas--sticky-selected" : ""
          }${
            selectedResearchFrame ? " project-playground__canvas--frame-selected" : ""
          }${
            researchFrameDrawing ? " project-playground__canvas--frame-drawing" : ""
          }${
            canvasToolPanelOpen ? " project-playground__canvas--tool-panel-open" : ""
          }${
            stickyPlacement ? " project-playground__canvas--sticky-placement" : ""
          }${
            commentPlacement ? " project-playground__canvas--comment-placement" : ""
          }`}
          style={({
            ...(stickyPlacement ? {
              "--project-sticky-note-cursor": stickyNotePlacementCursor(
                stickyPlacement.color,
                stickyPlacement.mode,
              ),
            } : {}),
            ...(commentPlacement ? {
              "--project-comment-cursor": commentPlacementCursor,
            } : {}),
          } as CSSProperties)}
        >
          <Excalidraw
            key={projectId}
            name={references?.title ?? "Astryx designer canvas"}
            theme={resolvedTheme}
            gridModeEnabled
            viewModeEnabled={canvasReadOnly}
            initialData={initialData}
            excalidrawAPI={(api) => {
              editorRef.current = api;
              syncCanvasCollaborators();
            }}
            isCollaborating={collaborationStatus === "live"}
            onChange={handleCanvasChange}
            onPointerUpdate={handleCanvasPointerUpdate}
            onPointerUp={handleCanvasPointerUp}
            autoFocus
            handleKeyboardGlobally={!stickyDraft && !canvasTextEditing && !commentDraftAnchor && !selectedComment}
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
        {canvasToolbarHost && createPortal(
          <div
            className="project-playground__astryx-tools"
            role="group"
            aria-label="Astryx canvas tools"
            data-canvas-toolbar-region="left"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="project-playground__astryx-tools-divider" aria-hidden="true" />
            <button
              type="button"
              className="project-playground__moodboard-trigger"
              aria-label={moodboardOpen ? "Close moodboard" : "Moodboard"}
              aria-pressed={moodboardOpen}
              title="Moodboard"
              onClick={() => activateCanvasTool("moodboard")}
            >
              <ProjectCanvasToolGlyph tool="moodboard" />
            </button>
            <button
              type="button"
              className="project-playground__sticky-trigger"
              aria-label={stickyPickerOpen ? "Close sticky notes" : "Sticky notes"}
              aria-pressed={stickyPickerOpen || Boolean(stickyPlacement)}
              title="Sticky notes (N)"
              onClick={() => activateCanvasTool("sticky")}
            >
              <ProjectCanvasToolGlyph tool="sticky" />
            </button>
            <button
              type="button"
              className="project-playground__comments-trigger"
              aria-label={commentPlacement ? "Cancel comment placement" : "Comments"}
              aria-pressed={commentPlacement || Boolean(commentDraftAnchor) || Boolean(selectedComment)}
              title="Comments"
              onClick={() => activateCanvasTool("comments")}
            >
              <ProjectCanvasToolGlyph tool="comments" />
              {canvasComments.some((thread) => !thread.resolved) ? (
                <span className="project-playground__comments-count">
                  {canvasComments.filter((thread) => !thread.resolved).length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="project-playground__document-trigger"
              aria-label={documentPlacement ? "Cancel document placement" : "Document"}
              aria-pressed={documentPlacement}
              title="Document"
              onClick={() => activateCanvasTool("document")}
            >
              <ProjectCanvasToolGlyph tool="document" />
            </button>
            <button
              type="button"
              className="project-playground__more-tools-trigger"
              aria-label={toolsCatalogOpen ? "Close Astryx tools" : "Astryx tools"}
              aria-expanded={toolsCatalogOpen}
              aria-pressed={toolsCatalogOpen}
              title="Astryx tools"
              onClick={() => activateCanvasTool("more")}
            >
              <ProjectCanvasToolGlyph tool="more" />
            </button>
          </div>,
          canvasToolbarHost,
        )}
        {moodboardReferences.map((reference) => (
          <span
            key={reference.elementId}
            className="project-moodboard-decision-badge"
            data-decision={reference.decision}
            style={moodboardDecisionBadgeStyle(reference)}
            aria-label={`${reference.sourceLabel}: ${reference.decision}`}
          >
            {reference.decision}
          </span>
        ))}
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
          <div className="project-canvas-comment-placement-hint" role="status" aria-live="polite">
            <ProjectCanvasCommentGlyph />
            <span>Click anywhere to place a comment.</span>
            <kbd>Esc</kbd>
          </div>
        ) : null}
        {(commentDraftAnchor || selectedComment) ? (
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
        {moodboardOpen ? (
          <ProjectMoodboardPanel
            sectionIds={moodboardSections.map((section) => section.id)}
            referenceCount={moodboardReferences.length}
            decisionCounts={moodboardDecisionCounts}
            message={moodboardMessage}
            onOpenProjectReferences={() => {
              ensureMoodboardInbox();
              setMoodboardOpen(false);
              setReferencesOpen(true);
            }}
            onOpenScreens={() => {
              ensureMoodboardInbox();
              setMoodboardOpen(false);
              setScreensOpen(true);
            }}
            onUpload={(files) => { void insertMoodboardUploads(files); }}
            onCreateSection={(section) => createMoodboardSections([section])}
            onCreateStarter={() => createMoodboardSections(
              projectMoodboardSectionPresets.filter((section) => section.id !== "direction-c"),
            )}
            smartCompose={moodboardSmartCompose}
            smartComposeBusy={moodboardSmartComposeBusy}
            onSmartCompose={composeMoodboard}
            onClose={() => setMoodboardOpen(false)}
            readOnly={canvasReadOnly}
          />
        ) : null}
        {toolsCatalogOpen && (
          <aside
            className="project-canvas-tools-catalog"
            role="dialog"
            aria-label="Astryx canvas tools catalog"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="project-canvas-tools-catalog__header">
              <div>
                <span>Astryx canvas</span>
                <h2>Tools</h2>
              </div>
              <IconButton
                label="Close tools catalog"
                icon={<Icon icon="close" size="sm" />}
                variant="ghost"
                size="sm"
                clickAction={() => setToolsCatalogOpen(false)}
              />
            </header>
            <TextInput
              label="Search tools"
              isLabelHidden
              value={toolsCatalogQuery}
              onChange={setToolsCatalogQuery}
              placeholder="Search tools…"
              width="100%"
              autoFocus
            />
            {[true, false].map((pinned) => {
              const items = filteredCanvasToolCatalogItems.filter((item) => item.pinned === pinned);
              if (items.length === 0) return null;
              return (
                <section key={pinned ? "pinned" : "more"} className="project-canvas-tools-catalog__section">
                  <h3>{pinned ? "Pinned" : "More tools"}</h3>
                  <div className="project-canvas-tools-catalog__list">
                    {items.map((item) => (
                      <button
                        key={item.tool}
                        type="button"
                        className="project-canvas-tools-catalog__item"
                        onClick={() => activateCanvasTool(item.tool)}
                      >
                        <span className="project-canvas-tools-catalog__icon" aria-hidden="true">
                          <ProjectCanvasToolGlyph tool={item.tool} />
                        </span>
                        <span className="project-canvas-tools-catalog__copy">
                          <strong>{item.title}</strong>
                          <small>{item.description}</small>
                        </span>
                        {item.pinned ? <span className="project-canvas-tools-catalog__badge">Pinned</span> : null}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {filteredCanvasToolCatalogItems.length === 0 ? (
              <p className="project-canvas-tools-catalog__empty">No tools match “{toolsCatalogQuery}”.</p>
            ) : null}
          </aside>
        )}
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
            onSelectColor={(color) => armStickyPlacement(color, "single")}
            onCreateStack={(color) => armStickyPlacement(color, "stack")}
          />
        )}
        {stickyPlacement ? (
          <div
            className="project-sticky-note-placement-hint"
            role="status"
            aria-live="polite"
          >
            <StickyNoteGlyph />
            <span>
              Click anywhere to place {stickyPlacement.mode === "stack" ? "a stack of notes" : `a ${stickyPlacement.color.name} note`}.
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
            <div
              className="project-sticky-note-composer__surface"
            >
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
                onInput={(event) => setStickyDraft((current) => (
                  current ? { ...current, value: event.currentTarget.textContent ?? "" } : current
                ))}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;
                  if (nextTarget && stickyComposerRef.current?.contains(nextTarget)) return;
                  commitStickyDraft(event.currentTarget.textContent ?? "");
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelStickyDraft();
                  } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    commitStickyDraft(event.currentTarget.textContent ?? "");
                  }
                }}
              />
            </div>
          </div>
        )}
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
            isSelected={selectedCanvasDocument?.elementId === document.elementId}
            onCommit={replaceCanvasDocument}
            onDismiss={dismissCanvasDocument}
          />
        ))}
        {selectedMoodboardReference
          && !moodboardOpen
          && !screensOpen
          && !referencesOpen ? (
          <ProjectMoodboardReferenceInspector
            reference={selectedMoodboardReference}
            sections={moodboardSections}
            onCaptionChange={(caption) => updateSelectedMoodboardReference({ caption })}
            onDecisionChange={(decision) => {
              updateSelectedMoodboardReference({ decision });
              setMoodboardMessage(`Marked ${selectedMoodboardReference.sourceLabel} as ${decision}.`);
            }}
            onSectionChange={moveSelectedMoodboardReference}
            onOpenSource={selectedMoodboardReference.sourceUrl ? () => {
              const source = new URL(
                selectedMoodboardReference.sourceUrl!,
                window.location.origin,
              );
              window.open(source.toString(), "_blank", "noopener,noreferrer");
            } : undefined}
            onClose={dismissMoodboardReference}
            readOnly={canvasReadOnly}
          />
        ) : null}
        {selectedScreenReference && !selectedMoodboardReference && !screensOpen && (
          <aside className="project-screen-inspector" aria-label="Selected catalog screen">
            <header className="project-screen-inspector__header">
              <span className="project-screen-inspector__icon" aria-hidden="true">
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
                  editorRef.current?.updateScene({ appState: { selectedElementIds: {} } });
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
              clickAction={() => navigate({
                name: "app",
                appId: selectedScreenReference.appId,
                section: "screens",
                evidence: `SCREEN-${selectedScreenReference.screenId}`,
              })}
            />
          </aside>
        )}
        {selectedDataReference && !dataToolsOpen && (
          <aside className="project-canvas-data-inspector" aria-label="Selected Astryx data card">
            <header className="project-screen-inspector__header">
              <span className="project-screen-inspector__icon" aria-hidden="true">
                <Icon icon={selectedDataReference.kind === "app" ? "viewColumns" : "arrowsUpDown"} size="sm" />
              </span>
              <div>
                <span>{selectedDataReference.kind === "app" ? "Catalog app" : "Catalog flow"}</span>
                <strong>{selectedDataReference.kind === "app"
                  ? selectedDataReference.appName
                  : selectedDataReference.flowTitle}</strong>
              </div>
              <IconButton
                label="Close data inspector"
                icon={<Icon icon="close" size="sm" />}
                variant="ghost"
                size="sm"
                clickAction={() => {
                  editorRef.current?.updateScene({ appState: { selectedElementIds: {} } });
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
                <dt>{selectedDataReference.kind === "app" ? "Screens" : "Steps"}</dt>
                <dd>{selectedDataReference.kind === "app"
                  ? selectedDataReference.totalScreens
                  : selectedDataReference.stepCount}</dd>
              </div>
              <div>
                <dt>Platform</dt>
                <dd>{selectedDataReference.platform}</dd>
              </div>
            </dl>
            <Button
              label={selectedDataReference.kind === "app" ? "Open app details" : "Open flow details"}
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
        {dataToolsOpen && (
          <ProjectCanvasDataLibrary
            insertingKey={insertingDataKey}
            message={dataToolsMessage}
            onInsertApp={insertCatalogApp}
            onInsertFlow={insertCatalogFlow}
            onClose={() => setDataToolsOpen(false)}
          />
        )}
        {screensOpen && (
          <ProjectScreenLibrary
            insertingKey={insertingScreenKey}
            message={screenMessage}
            onInsert={(result) => { void insertCatalogScreen(result); }}
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
            onInsert={(item) => { void insertReference(item); }}
            onRetry={() => { void loadReferences(); }}
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
              <p>The project may have been removed or you may no longer have access.</p>
            </div>
            <div className="project-playground__unavailable-actions">
              <Button label="Retry" variant="primary" clickAction={retryCanvas} />
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
