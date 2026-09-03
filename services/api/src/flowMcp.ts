import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { AuthUser } from "../../../src/authStore.ts";
import type { CrawledImage } from "../../../src/db.ts";
import type { DesignFlow } from "../../../src/designSystem.ts";
import {
  flowCatalogSearchTerms,
  normalizeFlowCatalogText,
  type FlowCatalogPage,
} from "../../../src/flowCatalogStore.ts";
import {
  screenSearchTermGroups,
  type PublishedScreenSearchResult,
} from "../../../src/flowScreenSearchStore.ts";
import { buildAppMetadata, buildPublishedCatalogPage, type AppMetadataRecord } from "../../../src/gallery.ts";
import { publicImageUrl } from "../../../src/imageSource.ts";
import { isPlatform, type Platform } from "../../../src/platformFromUrl.ts";
import { flowIdsMatch, publicFlowId } from "../../../src/publicFlowId.ts";
import type { PublishedCatalogPageRecord } from "../../../src/publicCatalogStore.ts";

const PLATFORMS = ["web", "ios", "android"] as const;
const MAX_INLINE_SCREENSHOT_BYTES = 1_000_000;
const MAX_INLINE_FLOW_SEARCH_PREVIEWS = 3;
const MAX_INLINE_FLOW_SEARCH_RESULTS = 4;
const MAX_INLINE_FLOW_PREVIEW_SCREENSHOTS = 3;
const MAX_AUTHORIZATION_PAGES = 10;

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
  publishedFlowInstanceSearch?(input: {
    platform: Platform;
    query: string;
    limit: number;
  }): Promise<FlowCatalogPage["items"]>;
  publishedCatalogPage(input: {
    platform?: Platform;
    cursor?: string;
    limit: number;
    query: string;
    sort: "latest";
    includeFacets: false;
  }): Promise<PublishedCatalogPageRecord>;
  publishedScreenSearch(input: {
    query: string;
    platform?: Platform;
    limit: number;
    mode?: "standard" | "deep";
  }): Promise<PublishedScreenSearchResult[]>;
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
    tool: "search_apps" | "search_flows" | "search_screens" | "get_app" | "get_flow" | "get_screenshot";
    app?: string;
    outcome: "success" | "unavailable";
    resultCount?: number;
  }): Promise<void> | void;
}

export interface FlowMcpSearchResult {
  app: string;
  appName: string;
  platform: Platform;
  flowId: string;
  title: string;
  category?: string;
  type?: string;
  description: string;
  tags: string[];
  stepCount: number;
  previewSteps: string[];
  previewScreenshots: Array<{
    screenshotId: number;
    label: string;
    url: string;
  }>;
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

export interface FlowMcpScreenSearchResult {
  app: string;
  appName: string;
  platform: Platform;
  screenshotId: number;
  title: string;
  description?: string;
  purpose?: string;
  pageType?: string;
  productArea?: string;
  matchedOn: string[];
  url: string;
  thumbnailUrl: string;
  flow?: {
    flowId: string;
    title: string;
    stepNumber?: number;
    stepLabel?: string;
    url: string;
  };
}

export function normalizeFlowSearchQuery(query: string): string {
  const original = query.trim().replace(/\s+/g, " ");
  const intent = original
    .replace(/\b(?:user\s+)?flows?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || original;
  if (/\b(?:forgot(?: my)? password|password recovery|recover(?:ing)?(?: my)? password|reset(?:ting)?(?: my)? password)\b/i.test(intent)) {
    return "resetting password";
  }
  if (/\b(?:log[\s-]?out|sign[\s-]?out)\b/i.test(intent)) return "logging out";
  if (/^(?:sign[\s-]?up|signup|creat(?:e|ing)(?: an?)? account|register(?:ing)?(?: an?)? account)$/i.test(intent)) {
    return "creating an account";
  }
  if (/\b(?:log[\s-]?in|sign[\s-]?in)\b/i.test(intent)) return "logging in";
  if (/^(?:(?:change|changing|update|updating|edit|editing)(?: my)? )?notifications?(?: preferences| settings)?$/i.test(intent)) {
    return "updating notification settings";
  }
  if (/^(?:(?:add|adding)(?: a| my)? )?payment method(?: during checkout)?$/i.test(intent)) {
    return "adding a payment method";
  }
  if (/\binvit(?:e|es|ed|ing)\b.*\b(?:team(?:mate|mates)?|members?|friends?|people)\b/i.test(intent)) {
    return "invite team members";
  }
  if (/\bpersonali[sz](?:e|ed|ing|ation)\b/i.test(intent)) {
    return /\bonboard(?:ing)?\b/i.test(intent) ? "personalizing onboarding" : "personalizing";
  }
  if (/\blanguage\b/i.test(intent) && /\b(?:change|changing|select|selecting|switch|switching|setting|settings)\b/i.test(intent)) {
    return "changing language";
  }
  if (/\b(?:upload|uploading|add|adding|change|changing)\b/i.test(intent)
    && /\bprofile\b/i.test(intent)
    && /\b(?:photo|picture|image)\b/i.test(intent)) {
    return "uploading a profile photo";
  }
  return intent;
}

function flowSearchQueries(query: string): string[] {
  const primary = normalizeFlowSearchQuery(query);
  return primary === "personalizing onboarding"
    ? [primary, "personalizing"]
    : [primary];
}

interface FlowEntry<T = number> {
  app: string;
  appName?: string;
  flowType?: string;
  platform: Platform;
  flow: DesignFlow<T>;
}

function absoluteUrl(appUrl: string, path: string): string {
  return new URL(path, `${appUrl.replace(/\/$/, "")}/`).toString();
}

function flowUrl(appUrl: string, entry: { app: string; platform: Platform; flow: { id: string } }): string {
  const params = new URLSearchParams({ platform: entry.platform, flow: publicFlowId(entry.flow.id) });
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
  const results: FlowMcpAppSearchResult[] = [];
  const seenApps = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < MAX_AUTHORIZATION_PAGES; pageNumber++) {
    const page = await deps.publishedCatalogPage({
      query: input.query,
      limit: 24,
      sort: "latest",
      includeFacets: false,
      ...(input.platform ? { platform: input.platform } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const apps = buildPublishedCatalogPage(page).apps.filter(({ id }) => !seenApps.has(id));
    apps.forEach(({ id }) => seenApps.add(id));
    const allowedApps = await accessibleAppSlugs(user, apps.map(({ id }) => id), deps.canAccessApp);
    for (const app of apps) {
      if (!allowedApps.has(app.id)) continue;
      results.push({
        app: app.id,
        title: app.app,
        description: app.description,
        categories: app.categories.map(({ name }) => name),
        platforms: app.platforms,
        totalScreens: app.totalScreens,
        url: absoluteUrl(deps.appUrl, `/apps/${encodeURIComponent(app.id)}`),
      });
      if (results.length >= input.limit) return results;
    }
    if (!page.nextCursor || seenCursors.has(page.nextCursor)) break;
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  return results;
}

function screenMatchedFields(image: PublishedScreenSearchResult, query: string): string[] {
  const groups = screenSearchTermGroups(query);
  const fields: Array<[string, unknown]> = [
    ["description", [image.description, image.analysis?.description]],
    ["purpose", image.analysis?.purpose],
    ["page type", image.analysis?.pageType],
    ["product area", image.analysis?.productArea],
    ["components", image.analysis?.componentNames],
    ["visible UI text", image.analysis?.visibleText],
    ["states", image.analysis?.visibleStates],
    ["layout", image.analysis?.layoutPatterns],
    ["interaction", image.analysis?.interactionPatterns],
  ];
  return fields.flatMap(([label, value]) => {
    const text = JSON.stringify(value ?? "").toLowerCase();
    return groups.some((variants) => variants.some((variant) => text.includes(variant))) ? [label] : [];
  });
}

export async function searchAccessibleScreens(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "canAccessApp" | "publishedScreenSearch">,
  input: { query: string; platform?: Platform; limit: number; mode?: "standard" | "deep" },
): Promise<FlowMcpScreenSearchResult[]> {
  const candidateLimit = Math.min(100, Math.max(24, input.limit * 12));
  const platforms = input.platform ? [input.platform] : [...PLATFORMS];
  const byPlatform = await Promise.all(platforms.map((platform) => deps.publishedScreenSearch({
    query: input.query,
    platform,
    limit: candidateLimit,
    mode: input.mode ?? "standard",
  })));
  const candidates: PublishedScreenSearchResult[] = [];
  for (let rank = 0; candidates.length < candidateLimit * platforms.length; rank++) {
    let added = false;
    for (const platformResults of byPlatform) {
      const candidate = platformResults[rank];
      if (!candidate || !isPlatform(candidate.platform)) continue;
      candidates.push(candidate);
      added = true;
    }
    if (!added) break;
  }
  const allowedApps = await accessibleAppSlugs(user, candidates.map(({ app }) => app), deps.canAccessApp);
  const results: FlowMcpScreenSearchResult[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!allowedApps.has(candidate.app)) continue;
    const key = `${candidate.app}\0${candidate.platform}\0${candidate.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mediaPath = publicImageUrl(candidate.app, candidate.image_url);
    if (!mediaPath) continue;
    const platform = candidate.platform as Platform;
    const pageType = candidate.analysis?.pageType?.trim();
    const purpose = candidate.analysis?.purpose?.trim();
    const description = candidate.description?.trim() || candidate.analysis?.description?.trim();
    const productArea = candidate.analysis?.productArea?.trim();
    const flowId = candidate.flow_id ? publicFlowId(candidate.flow_id) : undefined;
    results.push({
      app: candidate.app,
      appName: candidate.app_name,
      platform,
      screenshotId: candidate.id,
      title: purpose || description || pageType || "Product screen",
      ...(description ? { description } : {}),
      ...(purpose ? { purpose } : {}),
      ...(pageType ? { pageType } : {}),
      ...(productArea ? { productArea } : {}),
      matchedOn: screenMatchedFields(candidate, input.query),
      url: absoluteUrl(deps.appUrl, mediaPath),
      thumbnailUrl: absoluteUrl(deps.appUrl, publicImageUrl(candidate.app, candidate.image_url, "thumb") || mediaPath),
      ...(flowId && candidate.flow_title ? {
        flow: {
          flowId,
          title: candidate.flow_title,
          ...(candidate.flow_step_index ? { stepNumber: candidate.flow_step_index } : {}),
          ...(candidate.flow_step_label ? { stepLabel: candidate.flow_step_label } : {}),
          url: flowUrl(deps.appUrl, {
            app: candidate.app,
            platform,
            flow: { id: flowId },
          }),
        },
      } : {}),
    });
    if (results.length >= input.limit) break;
  }
  return results;
}

export async function searchAccessibleFlows(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "flowCatalogSecret" | "canAccessApp" | "publishedFlowCatalogPage" | "publishedFlowInstanceSearch">,
  input: { query: string; platform?: Platform; limit: number },
): Promise<FlowMcpSearchResult[]> {
  const queries = flowSearchQueries(input.query);
  if (input.platform) {
    return searchAccessibleFlowsForQueriesForPlatform(user, deps, {
      queries,
      platform: input.platform,
      limit: input.limit,
    });
  }
  const perPlatformLimit = Math.max(1, Math.ceil(input.limit / 2));
  let byPlatform = await Promise.all(PLATFORMS.map((platform) => searchAccessibleFlowsForQueriesForPlatform(user, deps, {
    queries,
    platform,
    limit: perPlatformLimit,
  })));
  let results = mergePlatformResultsByRelevance(byPlatform, queries[0]!, input.limit);
  if (results.length < input.limit && perPlatformLimit < input.limit) {
    byPlatform = await Promise.all(byPlatform.map((platformResults, index) => (
      platformResults.length < perPlatformLimit
        ? platformResults
        : searchAccessibleFlowsForQueriesForPlatform(user, deps, {
          queries,
          platform: PLATFORMS[index]!,
          limit: input.limit,
        })
    )));
    results = mergePlatformResultsByRelevance(byPlatform, queries[0]!, input.limit);
  }
  return results;
}

async function searchAccessibleFlowsForQueriesForPlatform(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "flowCatalogSecret" | "canAccessApp" | "publishedFlowCatalogPage" | "publishedFlowInstanceSearch">,
  input: { queries: readonly string[]; platform: Platform; limit: number },
): Promise<FlowMcpSearchResult[]> {
  const results: FlowMcpSearchResult[] = [];
  const seen = new Set<string>();
  for (const query of input.queries) {
    const matches = await searchAccessibleFlowsForPlatform(user, deps, {
      query,
      platform: input.platform,
      limit: input.limit,
    });
    for (const match of matches) {
      const key = `${match.app}\0${match.flowId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(match);
      if (results.length >= input.limit) return results;
    }
  }
  return results;
}

export function mergePlatformResultsByRelevance(
  byPlatform: readonly (readonly FlowMcpSearchResult[])[],
  query: string,
  limit: number,
): FlowMcpSearchResult[] {
  const normalizedQuery = normalizeFlowCatalogText(query);
  const queryTerms = flowCatalogSearchTerms(query).map((term) => term.trim());
  return byPlatform.flatMap((platformResults, platformIndex) =>
    platformResults.map((result, rank) => {
      const normalizedTitle = normalizeFlowCatalogText(result.title);
      return {
        result,
        platformIndex,
        rank,
        exactMatch: normalizedQuery.length > 0 && normalizedTitle.includes(normalizedQuery) ? 1 : 0,
        termMatches: queryTerms.filter((term) => normalizedTitle.includes(term)).length,
      };
    })
  ).sort((left, right) =>
    right.exactMatch - left.exactMatch
      || right.termMatches - left.termMatches
      || left.rank - right.rank
      || left.platformIndex - right.platformIndex
  ).slice(0, limit).map(({ result }) => result);
}

async function searchAccessibleFlowsForPlatform(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "flowCatalogSecret" | "canAccessApp" | "publishedFlowCatalogPage" | "publishedFlowInstanceSearch">,
  input: { query: string; platform: Platform; limit: number },
): Promise<FlowMcpSearchResult[]> {
  const results: FlowMcpSearchResult[] = [];
  const seenFlows = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < MAX_AUTHORIZATION_PAGES; pageNumber++) {
    const page = deps.publishedFlowInstanceSearch
      ? {
        items: pageNumber === 0
          ? await deps.publishedFlowInstanceSearch({
            platform: input.platform,
            query: input.query,
            limit: Math.min(100, input.limit * MAX_AUTHORIZATION_PAGES),
          })
          : [],
        nextCursor: null,
      }
      : await deps.publishedFlowCatalogPage({
        platform: input.platform,
        query: input.query,
        limit: input.limit,
        sort: "grouped",
        flowGroups: [],
        cursorSecret: deps.flowCatalogSecret,
        includeFacets: false,
        ...(cursor ? { cursor } : {}),
      });
    const matched = page.items.map((item) => ({
      app: item.preview.appId,
      appName: item.preview.appName,
      ...(item.type ? { flowType: item.type } : {}),
      platform: input.platform,
      flow: {
        ...item.preview.flow,
        id: publicFlowId(item.preview.sourceFlowId),
      },
    })).filter((entry) => {
      const key = `${entry.app}\0${entry.flow.id}`;
      if (seenFlows.has(key)) return false;
      seenFlows.add(key);
      return true;
    });
    const allowedApps = await accessibleApps(user, matched, deps.canAccessApp);
    for (const entry of matched) {
      if (!allowedApps.has(entry.app)) continue;
      const orderedScreenshots = entry.flow.steps.flatMap((step) => step.evidence.map((evidence) => ({
        screenshotId: evidence.imageId,
        label: step.label,
        url: absoluteUrl(deps.appUrl, evidence.imageUrl),
      }))).filter(({ screenshotId, url }) => Number.isSafeInteger(screenshotId) && screenshotId > 0 && Boolean(url));
      const previewScreenshots = representativeItems(orderedScreenshots, MAX_INLINE_FLOW_PREVIEW_SCREENSHOTS);
      const preview = previewScreenshots[0];
      const previewUrl = preview?.url ?? "";
      results.push({
        app: entry.app,
        appName: entry.appName ?? entry.app,
        platform: entry.platform,
        flowId: entry.flow.id,
        title: entry.flow.title,
        ...(entry.flow.category ? { category: entry.flow.category } : {}),
        ...(entry.flowType ? { type: entry.flowType } : {}),
        description: entry.flow.description,
        tags: entry.flow.tags,
        stepCount: entry.flow.steps.length,
        previewSteps: entry.flow.steps.slice(0, 3).map(({ label }) => label),
        previewScreenshots,
        url: flowUrl(deps.appUrl, entry),
        ...(preview?.screenshotId ? { previewScreenshotId: preview.screenshotId } : {}),
        ...(previewUrl ? { previewScreenshotUrl: previewUrl } : {}),
      });
      if (results.length >= input.limit) return results;
    }
    if (!page.nextCursor || seenCursors.has(page.nextCursor)) break;
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  return results;
}

function representativeItems<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  if (limit <= 1) return items.length > 0 ? [items[0]!] : [];
  return Array.from({ length: limit }, (_, index) =>
    items[Math.round(index * (items.length - 1) / (limit - 1))]!
  );
}

interface AccessibleFlow {
  value: Record<string, unknown>;
  screenshots: Array<{ label: string; image: CrawledImage }>;
}

async function accessibleFlow(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "appUrl" | "canAccessApp" | "getVersionFlows" | "flowEvidenceImages">,
  input: { app: string; platform: Platform; flowId: string },
): Promise<AccessibleFlow | undefined> {
  if (!await deps.canAccessApp(user, input.app)) return undefined;
  const flows = await deps.getVersionFlows(input.app, input.platform, undefined, true);
  const flow = flows.find((candidate) => flowIdsMatch(candidate.id, input.flowId));
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
  const labelsByImageId = new Map<number, string>();
  for (const step of flow.steps) {
    for (const imageId of step.evidence) {
      if (Number.isSafeInteger(imageId) && imageId > 0 && !labelsByImageId.has(imageId)) {
        labelsByImageId.set(imageId, step.label);
      }
    }
  }
  return {
    screenshots: imageIds.flatMap((imageId) => {
      const image = imagesById.get(imageId);
      return image ? [{ label: labelsByImageId.get(imageId) ?? flow.title, image }] : [];
    }),
    value: {
      app: input.app,
      platform: input.platform,
      flowId: publicFlowId(flow.id),
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
  options: { unavailableIsError?: boolean } = { unavailableIsError: true },
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
    ...(unavailable && options.unavailableIsError ? { isError: true } : {}),
  };
}

async function inlineFlowSearchPreviews(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "canAccessApp" | "flowEvidenceImages" | "readInlineImage">,
  flows: readonly FlowMcpSearchResult[],
) {
  const candidates = flows.slice(0, MAX_INLINE_FLOW_SEARCH_RESULTS).flatMap((flow, flowIndex) =>
    flow.previewScreenshots.slice(0, MAX_INLINE_FLOW_SEARCH_PREVIEWS).map((preview, previewIndex) => ({
      flow,
      flowIndex,
      preview,
      previewIndex,
    }))
  );
  const previews = await Promise.all(candidates.map(async ({ flow, flowIndex, preview, previewIndex }) => {
    const screenshot = await getAccessibleScreenshot(user, deps, {
      app: flow.app,
      platform: flow.platform,
      screenshotId: preview.screenshotId,
    });
    if (!screenshot) return undefined;
    const image = await deps.readInlineImage(screenshot, MAX_INLINE_SCREENSHOT_BYTES);
    return image ? { flow, flowIndex, image, previewIndex, label: preview.label } : undefined;
  }));
  return previews.flatMap((preview) => preview ? [
    { type: "text" as const, text: `Flow result ${preview.flowIndex + 1}, preview ${preview.previewIndex + 1}: ${preview.flow.title} — ${preview.flow.app} (${preview.flow.platform}) — ${preview.label}` },
    { type: "image" as const, data: preview.image.data, mimeType: preview.image.mimeType },
  ] : []);
}

async function inlineScreenSearchPreviews(
  user: AuthUser,
  deps: Pick<FlowMcpDependencies, "canAccessApp" | "flowEvidenceImages" | "readInlineImage">,
  screens: readonly FlowMcpScreenSearchResult[],
) {
  const previews = await Promise.all(screens.slice(0, MAX_INLINE_FLOW_SEARCH_PREVIEWS).map(async (screen, index) => {
    const screenshot = await getAccessibleScreenshot(user, deps, {
      app: screen.app,
      platform: screen.platform,
      screenshotId: screen.screenshotId,
    });
    if (!screenshot) return undefined;
    const image = await deps.readInlineImage(screenshot, MAX_INLINE_SCREENSHOT_BYTES);
    return image ? { screen, image, index } : undefined;
  }));
  return previews.flatMap((preview) => preview ? [
    { type: "text" as const, text: `Screen result ${preview.index + 1}: ${preview.screen.title} — ${preview.screen.appName} (${preview.screen.platform})` },
    { type: "image" as const, data: preview.image.data, mimeType: preview.image.mimeType },
  ] : []);
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
    description: "Search accessible published product flows by intent, behavior taxonomy, and available step labels. Generic words such as 'flow' are ignored, and common behavior wording maps to the catalog's taxonomy. Results include a three-screen ordered preview for each flow and embed up to three verified screens from the top result. Omit platform for balanced Web, iOS, and Android results, then use get_flow for the complete ordered visual evidence.",
    inputSchema: {
      query: z.string().trim().min(1).max(240),
      platform: z.enum(PLATFORMS).optional().describe("Limit results to one platform. Omit to search all three platforms evenly."),
      limit: z.number().int().min(1).max(10).default(6),
    },
    annotations: { readOnlyHint: true },
  }, async ({ query, platform, limit }) => {
    const effectiveQuery = normalizeFlowSearchQuery(query);
    const flows = await searchAccessibleFlows(user, deps, { query, platform, limit });
    const previews = await inlineFlowSearchPreviews(user, deps, flows);
    recordToolCall(deps, { userId: user.id, tool: "search_flows", outcome: "success", resultCount: flows.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          query,
          ...(effectiveQuery !== query ? { effectiveQuery } : {}),
          searchedPlatforms: platform ? [platform] : [...PLATFORMS],
          resultCount: flows.length,
          flows,
          next: flows.length
            ? "Call get_flow with app, platform, and flowId for ordered steps and representative screenshots."
            : "Try a shorter intent phrase or choose a different platform.",
        }, null, 2),
      }, ...previews],
    };
  });
  server.registerTool("search_screens", {
    title: "Search product screens",
    description: "Search accessible screenshots from the latest published app versions by visible UI wording and analyzed screen context, including purpose, page type, product area, components, states, layout, and interaction. Results include related flow membership when available and intentionally summarize why each screen matched without returning the underlying OCR corpus. Up to three verified screenshots are embedded. Use get_screenshot for one full result or get_flow when a related flow is present.",
    inputSchema: {
      query: z.string().trim().min(1).max(240),
      platform: z.enum(PLATFORMS).optional().describe("Limit results to one platform. Omit to search Web, iOS, and Android."),
      mode: z.enum(["standard", "deep"]).default("standard").describe("Use deep to require every meaningful query concept; standard allows useful partial matches."),
      limit: z.number().int().min(1).max(10).default(6),
    },
    annotations: { readOnlyHint: true },
  }, async ({ query, platform, mode, limit }) => {
    const screens = await searchAccessibleScreens(user, deps, { query, platform, mode, limit });
    const previews = await inlineScreenSearchPreviews(user, deps, screens);
    recordToolCall(deps, { userId: user.id, tool: "search_screens", outcome: "success", resultCount: screens.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          query,
          mode,
          searchedPlatforms: platform ? [platform] : [...PLATFORMS],
          resultCount: screens.length,
          screens,
          next: screens.length
            ? "Call get_screenshot with app, platform, and screenshotId for one verified image, or get_flow when a related flow is included."
            : "Try visible labels or a shorter description of the screen's purpose.",
        }, null, 2),
      }, ...previews],
    };
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
    return flow ? resultWithInlineScreenshots(
      flow.value,
      flow.screenshots,
      { readInlineImage: (image) => deps.readInlineImage(image, MAX_INLINE_SCREENSHOT_BYTES) },
      { unavailableIsError: false },
    ) : {
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
    const origin = req.header("origin");
    if (origin) {
      let trusted = false;
      try {
        trusted = new URL(origin).origin === new URL(deps.appUrl).origin;
      } catch {
        trusted = false;
      }
      if (!trusted) {
        res.status(403).json({ error: "Untrusted MCP origin" });
        return;
      }
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createFlowMcpServer(res.locals.user as AuthUser, deps);
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await server.close();
    };
    res.once("close", () => { void close().catch(() => undefined); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      await close().catch(() => undefined);
      next(error);
    }
  });
}
