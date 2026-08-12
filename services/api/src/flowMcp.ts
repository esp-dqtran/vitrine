import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { AuthUser } from "../../../src/authStore.ts";
import type { CrawledImage } from "../../../src/db.ts";
import type { DesignFlow } from "../../../src/designSystem.ts";
import type { FlowCatalogPage } from "../../../src/flowCatalogStore.ts";
import { publicImageUrl } from "../../../src/imageSource.ts";
import type { Platform } from "../../../src/platformFromUrl.ts";

const PLATFORMS = ["web", "ios", "android"] as const;

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
  getVersionFlows(app: string, platform: string, versionNumber?: number | null, publishedOnly?: boolean): Promise<DesignFlow[]>;
  flowEvidenceImages(input: {
    app: string;
    platform: string;
    versionNumber?: number | null;
    imageIds: number[];
    publishedOnly?: boolean;
  }): Promise<CrawledImage[]>;
  readInlineImage(image: CrawledImage): Promise<FlowMcpInlineImage | undefined>;
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

async function resultWithInlineScreenshots(
  value: unknown,
  screenshots: Array<{ label: string; image: CrawledImage }>,
  deps: Pick<FlowMcpDependencies, "readInlineImage">,
) {
  const inline = await Promise.all(screenshots.map(async ({ label, image }) => ({
    label,
    image: await deps.readInlineImage(image),
  })));
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(value, null, 2) },
      ...inline.flatMap(({ label, image }) => image ? [
        { type: "text" as const, text: `Screen capture: ${label}` },
        { type: "image" as const, data: image.data, mimeType: image.mimeType },
      ] : []),
    ],
  };
}

async function searchScreenshots(
  flows: FlowMcpSearchResult[],
  deps: Pick<FlowMcpDependencies, "flowEvidenceImages">,
): Promise<Array<{ label: string; image: CrawledImage }>> {
  const captures = await Promise.all(flows.map(async (flow) => {
    if (!flow.previewScreenshotId) return undefined;
    const [image] = await deps.flowEvidenceImages({
      app: flow.app,
      platform: flow.platform,
      imageIds: [flow.previewScreenshotId],
      publishedOnly: true,
    });
    return image ? { label: `${flow.app} — ${flow.title}`, image } : undefined;
  }));
  return captures.filter((capture): capture is { label: string; image: CrawledImage } => Boolean(capture));
}

export function createFlowMcpServer(user: AuthUser, deps: FlowMcpDependencies): McpServer {
  const server = new McpServer({ name: "vitrines-flow-mcp", version: "0.1.0" });
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
    return resultWithInlineScreenshots({ flows }, await searchScreenshots(flows, deps), deps);
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
    return flow ? resultWithInlineScreenshots(
      flow.value,
      flow.screenshots.map((image) => ({ label: `${input.app} — ${image.description ?? "flow screen"}`, image })),
      deps,
    ) : {
      content: [{ type: "text" as const, text: "This published flow is not available to the current Vitrines account." }],
      isError: true,
    };
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
