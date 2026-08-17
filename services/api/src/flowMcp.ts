import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { AuthUser } from "../../../src/authStore.ts";
import type { CrawledImage } from "../../../src/db.ts";
import type { DesignFlow } from "../../../src/designSystem.ts";
import type { FlowCatalogPage } from "../../../src/flowCatalogStore.ts";
import { buildAppMetadata, buildPublishedCatalogPage, type AppMetadataRecord } from "../../../src/gallery.ts";
import { publicImageUrl } from "../../../src/imageSource.ts";
import type { Platform } from "../../../src/platformFromUrl.ts";
import type { PublishedCatalogPageRecord } from "../../../src/publicCatalogStore.ts";

const PLATFORMS = ["web", "ios", "android"] as const;
const MAX_INLINE_SCREENSHOT_BYTES = 1_000_000;

export interface FlowMcpInlineImage {
  data: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}

export interface FlowMcpDependencies {
  appUrl: string;
  flowCatalogSecret: string;
  canAccessApp(user: Pick<AuthUser, "id" | "role">, app: string): Promise<boolean>;
  publishedFlowCatalogPage(input: {
    platform: Platform;
    cursor?: string;
    limit: number;
    query?: string;
    sort: "grouped";
    flowGroups: string[];
    cursorSecret: string;
    includeFacets: false;
  }): Promise<FlowCatalogPage>;
  publishedCatalogPage(input: {
    platform?: Platform;
    limit: number;
    query: string;
    sort: "latest";
    includeFacets: false;
  }): Promise<PublishedCatalogPageRecord>;
  getVersionFlows(app: string, platform: string, versionNumber?: number | null, publishedOnly?: boolean): Promise<DesignFlow[]>;
  flowEvidenceImages(input: {
    app: string;
    platform: string;
    versionNumber?: number | null;
    imageIds: number[];
    publishedOnly?: boolean;
  }): Promise<CrawledImage[]>;
  appMetadata(app: string, publishedOnly?: boolean): Promise<AppMetadataRecord | null>;
  readInlineImage(image: CrawledImage, maxBytes: number): Promise<FlowMcpInlineImage | undefined>;
  recordToolCall?(input: {
    userId: number;
    tool: "search_apps" | "search_flows" | "get_app" | "get_flow" | "get_screenshot";
    app?: string;
    outcome: "success" | "unavailable";
    resultCount?: number;
  }): Promise<void> | void;
}

export interface FlowMcpSearchResult {
  app: string;
  platform: Platform;
  flowId: string;
  title: string;
  category?: string;
  description: string;
  tags: string[];
  stepCount: number;
  url: string;
  previewScreenshotId?: number;
  previewScreenshotUrl?: string;
}

export interface FlowMcpAppSearchResult {
  app: string;
  title: string;
  description: string | null;
  categories: string[];
  platforms: string[];
  totalScreens: number;
  url: string;
}

interface FlowEntry<T = number> {
  app: string;
  platform: Platform;
  flow: DesignFlow<T>;
}

function absoluteUrl(appUrl: string, path: string): string {
  return new URL(path, `${appUrl.replace(/\/$/, "")}/`).toString();
}

function flowUrl<T>(appUrl: string, entry: FlowEntry<T>): string {
  const params = new URLSearchParams({ platform: entry.platform, flow: entry.flow.id });
  return absoluteUrl(appUrl, `/apps/${encodeURIComponent(entry.app)}/flows?${params.toString()}`);
}

function imageUrls(appUrl: string, image: CrawledImage) {
  const source = image.image_url;
  const imageUrl = publicImageUrl(image.app, source);
  const thumbnailUrl = publicImageUrl(image.app, source, "thumb");
  return {
    id: image.id,
    ...(imageUrl ? { url: absoluteUrl(appUrl, imageUrl) } : {}),
    ...(thumbnailUrl ? { thumbnailUrl: absoluteUrl(appUrl, thumbnailUrl) } : {}),
    ...(image.description ? { description: image.description } : {}),
    ...(image.analysis?.purpose ? { purpose: image.analysis.purpose } : {}),
    ...(image.analysis?.productArea ? { productArea: image.analysis.productArea } : {}),
    ...(image.analysis?.visibleText?.length ? { visibleText: image.analysis.visibleText } : {}),
    ...(image.captured_at ? { capturedAt: new Date(image.captured_at).toISOString() } : {}),
  };
}

async function accessibleApps(
  user: AuthUser,
  entries: readonly FlowEntry<unknown>[],
  canAccessApp: FlowMcpDependencies["canAccessApp"],
): Promise<Set<string>> {
  if (user.role === "admin") return new Set(entries.map(({ app }) => app));
  const apps = [...new Set(entries.map(({ app }) => app))];
  const checks = await Promise.all(apps.map(async (app) => [app, await canAccessApp(user, app)] as const));
  return new Set(checks.filter(([, allowed]) => allowed).map(([app]) => app));
}

async function accessibleAppSlugs(
  user: AuthUser,
  apps: readonly string[],
  canAccessApp: FlowMcpDependencies["canAccessApp"],
): Promise<Set<string>> {
  if (user.role === "admin") return new Set(apps);
  const uniqueApps = [...new Set(apps)];
  const checks = await Promise.all(uniqueApps.map(async (app) => [app, await canAccessApp(user, app)] as const));
  return new Set(checks.filter(([, allowed]) => allowed).map(([app]) => app));
}

export async function searchAccessibleApps(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "canAccessApp" | "publishedCatalogPage">,
  input: { query: string; platform?: Platform; limit: number },
): Promise<FlowMcpAppSearchResult[]> {
  const page = await deps.publishedCatalogPage({
    query: input.query,
    limit: 24,
    sort: "latest",
    includeFacets: false,
    ...(input.platform ? { platform: input.platform } : {}),
  });
  const apps = buildPublishedCatalogPage(page).apps;
  const allowedApps = await accessibleAppSlugs(user, apps.map(({ id }) => id), deps.canAccessApp);
  return apps
    .filter(({ id }) => allowedApps.has(id))
    .slice(0, input.limit)
    .map((app) => ({
      app: app.id,
      title: app.app,
      description: app.description,
      categories: app.categories.map(({ name }) => name),
      platforms: app.platforms,
      totalScreens: app.totalScreens,
      url: absoluteUrl(deps.appUrl, `/apps/${encodeURIComponent(app.id)}`),
    }));
}

export async function searchAccessibleFlows(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "flowCatalogSecret" | "canAccessApp" | "publishedFlowCatalogPage">,
  input: { query: string; platform?: Platform; limit: number },
): Promise<FlowMcpSearchResult[]> {
  const platforms = input.platform ? [input.platform] : PLATFORMS;
  const pages = await Promise.all(platforms.map((platform) => deps.publishedFlowCatalogPage({
    platform,
    query: input.query,
    limit: input.limit,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  })));
  const matched = pages.flatMap((page, index) => page.items.map((item) => ({
    app: item.preview.appId,
    platform: platforms[index]!,
    flow: item.preview.flow,
  })));
  const allowedApps = await accessibleApps(user, matched, deps.canAccessApp);
  return matched
    .filter(({ app }) => allowedApps.has(app))
    .slice(0, input.limit)
    .map((entry) => {
      const preview = entry.flow.steps.flatMap((step) => step.evidence)[0];
      const previewUrl = preview?.imageUrl ?? "";
      return {
        app: entry.app,
        platform: entry.platform,
        flowId: entry.flow.id,
        title: entry.flow.title,
        ...(entry.flow.category ? { category: entry.flow.category } : {}),
        description: entry.flow.description,
        tags: entry.flow.tags,
        stepCount: entry.flow.steps.length,
        url: flowUrl(deps.appUrl, entry),
        ...(preview?.imageId ? { previewScreenshotId: preview.imageId } : {}),
        ...(previewUrl ? { previewScreenshotUrl: absoluteUrl(deps.appUrl, previewUrl) } : {}),
      };
    });
}

interface AccessibleFlow {
  value: Record<string, unknown>;
  screenshots: CrawledImage[];
}

async function accessibleFlow(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "canAccessApp" | "getVersionFlows" | "flowEvidenceImages">,
  input: { app: string; platform: Platform; flowId: string },
): Promise<AccessibleFlow | undefined> {
  if (!await deps.canAccessApp(user, input.app)) return undefined;
  const flows = await deps.getVersionFlows(input.app, input.platform, undefined, true);
  const flow = flows.find((candidate) => candidate.id === input.flowId);
  if (!flow) return undefined;
  const imageIds = [...new Set(flow.steps.flatMap((step) => step.evidence)
    .filter((imageId): imageId is number => Number.isSafeInteger(imageId) && imageId > 0))];
  const images = await deps.flowEvidenceImages({
    app: input.app,
    platform: input.platform,
    imageIds,
    publishedOnly: true,
  });
  const imagesById = new Map(images.map((image) => [image.id, image]));
  return {
    screenshots: images,
    value: {
      app: input.app,
      platform: input.platform,
      flowId: flow.id,
      title: flow.title,
      ...(flow.category ? { category: flow.category } : {}),
      description: flow.description,
      tags: flow.tags,
      url: flowUrl(deps.appUrl, { app: input.app, platform: input.platform, flow }),
      steps: flow.steps.map((step, index) => ({
        number: index + 1,
        label: step.label,
        ...(step.interaction ? { interaction: step.interaction } : {}),
        ...(step.observation ? {
          observed: {
            likelyIntent: step.observation.likelyIntent,
            visibleUi: step.observation.visibleUi,
            visibleText: step.observation.visibleText,
            availableActions: step.observation.availableActions,
            systemFeedback: step.observation.systemFeedback,
            friction: step.observation.friction,
          },
        } : {}),
        screenshots: step.evidence
          .flatMap((imageId) => {
            const image = imagesById.get(imageId);
            return image ? [imageUrls(deps.appUrl, image)] : [];
          }),
      })),
    },
  };
}

export async function getAccessibleFlow(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "canAccessApp" | "getVersionFlows" | "flowEvidenceImages">,
  input: { app: string; platform: Platform; flowId: string },
): Promise<Record<string, unknown> | undefined> {
  return (await accessibleFlow(user, deps, input))?.value;
}

export async function getAccessibleApp(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "canAccessApp" | "appMetadata">,
  app: string,
): Promise<Record<string, unknown> | undefined> {
  if (!await deps.canAccessApp(user, app)) return undefined;
  const metadata = await deps.appMetadata(app, true);
  if (!metadata) return undefined;
  const value = buildAppMetadata(metadata);
  return {
    ...value,
    url: absoluteUrl(deps.appUrl, `/apps/${encodeURIComponent(app)}`),
    flowsUrl: absoluteUrl(deps.appUrl, `/apps/${encodeURIComponent(app)}/flows`),
    ...(value.previewVideoUrl ? { previewVideoUrl: absoluteUrl(deps.appUrl, value.previewVideoUrl) } : {}),
  };
}

export async function getAccessibleScreenshot(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "canAccessApp" | "flowEvidenceImages">,
  input: { app: string; platform: Platform; screenshotId: number },
): Promise<CrawledImage | undefined> {
  if (!await deps.canAccessApp(user, input.app)) return undefined;
  const images = await deps.flowEvidenceImages({
    app: input.app,
    platform: input.platform,
    imageIds: [input.screenshotId],
    publishedOnly: true,
  });
  return images.find((image) => (
    image.id === input.screenshotId && image.app === input.app && image.platform === input.platform
  ));
}

async function resultWithInlineScreenshots(
  value: unknown,
  screenshots: Array<{ label: string; image: CrawledImage }>,
  deps: { readInlineImage(image: CrawledImage): Promise<FlowMcpInlineImage | undefined> },
) {
  const inline = await Promise.all(screenshots.map(async ({ label, image }) => ({
    label,
    image: await deps.readInlineImage(image),
  })));
  const unavailable = inline.some(({ image }) => !image);
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(value, null, 2) },
      ...inline.flatMap(({ label, image }) => image ? [
        { type: "text" as const, text: `Screen capture: ${label}` },
        { type: "image" as const, data: image.data, mimeType: image.mimeType },
      ] : [
        { type: "text" as const, text: "The screenshot could not be embedded because its verified thumbnail is unavailable or exceeds the size limit. Use the screenshot URL instead." },
      ]),
    ],
    ...(unavailable ? { isError: true } : {}),
  };
}

function recordToolCall(
  deps: FlowMcpDependencies,
  input: Parameters<NonNullable<FlowMcpDependencies["recordToolCall"]>>[0],
): void {
  void Promise.resolve(deps.recordToolCall?.(input)).catch(() => undefined);
}

export function createFlowMcpServer(user: AuthUser, deps: FlowMcpDependencies): McpServer {
  const server = new McpServer({ name: "vitrines-flow-mcp", version: "0.1.0" });
  server.registerTool("search_apps", {
    title: "Search product apps",
    description: "Search accessible published apps by name, description, or category. Use before get_app.",
    inputSchema: {
      query: z.string().trim().min(1).max(240),
      platform: z.enum(PLATFORMS).optional(),
      limit: z.number().int().min(1).max(10).default(6),
    },
    annotations: { readOnlyHint: true },
  }, async ({ query, platform, limit }) => {
    const apps = await searchAccessibleApps(user, deps, { query, platform, limit });
    recordToolCall(deps, { userId: user.id, tool: "search_apps", outcome: "success", resultCount: apps.length });
    return { content: [{ type: "text" as const, text: JSON.stringify({ apps }, null, 2) }] };
  });
  server.registerTool("search_flows", {
    title: "Search product flows",
    description: "Search accessible published product flows by intent, step labels, and text captured in screenshots. Use before get_flow.",
    inputSchema: {
      query: z.string().trim().min(1).max(240),
      platform: z.enum(PLATFORMS).optional(),
      limit: z.number().int().min(1).max(10).default(6),
    },
    annotations: { readOnlyHint: true },
  }, async ({ query, platform, limit }) => {
    const flows = await searchAccessibleFlows(user, deps, { query, platform, limit });
    recordToolCall(deps, { userId: user.id, tool: "search_flows", outcome: "success", resultCount: flows.length });
    return { content: [{ type: "text" as const, text: JSON.stringify({ flows }, null, 2) }] };
  });
  server.registerTool("get_flow", {
    title: "Get product flow",
    description: "Get an accessible published flow in order, including the available screenshots and captured UI text. Use the screenshots and capture details when comparing patterns.",
    inputSchema: {
      app: z.string().trim().min(1).max(160),
      platform: z.enum(PLATFORMS),
      flowId: z.string().trim().min(1).max(240),
    },
    annotations: { readOnlyHint: true },
  }, async (input) => {
    const flow = await accessibleFlow(user, deps, input);
    recordToolCall(deps, {
      userId: user.id,
      tool: "get_flow",
      app: input.app,
      outcome: flow ? "success" : "unavailable",
      ...(flow ? { resultCount: 1 } : {}),
    });
    return flow ? {
      content: [{ type: "text" as const, text: JSON.stringify(flow.value, null, 2) }],
    } : {
      content: [{ type: "text" as const, text: "This published flow is not available to the current Vitrines account." }],
      isError: true,
    };
  });
  server.registerTool("get_app", {
    title: "Get product app",
    description: "Get metadata for one accessible published app, including its catalog and flows links.",
    inputSchema: {
      app: z.string().trim().min(1).max(160),
    },
    annotations: { readOnlyHint: true },
  }, async ({ app }) => {
    const result = await getAccessibleApp(user, deps, app);
    recordToolCall(deps, {
      userId: user.id,
      tool: "get_app",
      app,
      outcome: result ? "success" : "unavailable",
      ...(result ? { resultCount: 1 } : {}),
    });
    return result ? {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    } : {
      content: [{ type: "text" as const, text: "This published app is not available to the current Vitrines account." }],
      isError: true,
    };
  });
  server.registerTool("get_screenshot", {
    title: "Get product screenshot",
    description: "Get one accessible published flow screenshot. Use the screenshot ID returned by search_flows or get_flow.",
    inputSchema: {
      app: z.string().trim().min(1).max(160),
      platform: z.enum(PLATFORMS),
      screenshotId: z.number().int().positive(),
    },
    annotations: { readOnlyHint: true },
  }, async (input) => {
    const screenshot = await getAccessibleScreenshot(user, deps, input);
    recordToolCall(deps, {
      userId: user.id,
      tool: "get_screenshot",
      app: input.app,
      outcome: screenshot ? "success" : "unavailable",
      ...(screenshot ? { resultCount: 1 } : {}),
    });
    if (!screenshot) {
      return {
        content: [{ type: "text" as const, text: "This published screenshot is not available to the current Vitrines account." }],
        isError: true,
      };
    }
    const value = {
      app: input.app,
      platform: input.platform,
      screenshot: imageUrls(deps.appUrl, screenshot),
    };
    return resultWithInlineScreenshots(
      value,
      [{ label: `${input.app} — ${screenshot.description ?? "flow screen"}`, image: screenshot }],
      {
        readInlineImage: (image) => deps.readInlineImage(image, MAX_INLINE_SCREENSHOT_BYTES),
      },
    );
  });
  return server;
}

export function mountFlowMcpRoute(app: express.Express, deps: FlowMcpDependencies): void {
  app.all("/mcp", async (req, res, next) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "MCP accepts POST requests" });
      return;
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createFlowMcpServer(res.locals.user as AuthUser, deps);
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      next(error);
    }
  });
}
