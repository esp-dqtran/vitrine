import type { APIRequestContext } from "playwright";
import {
  appWebsiteDestinationKind,
  extractMobbinAppWebsiteMetadata,
  mobbinRscUrl,
  verifiedAppleDestination,
  verifiedAppWebsiteUrl,
  type AppleSoftwareResult,
} from "../src/appWebsiteBackfill.ts";
import { closePool, query } from "../src/db.ts";
import { launchMobbinContext } from "../src/crawler.ts";
import { runPool } from "../src/pool.ts";

interface AppWebsiteRow {
  id: number;
  name: string;
  display_name: string | null;
  mobbin_url: string;
}

type BackfillResult =
  | {
      appId: number;
      app: string;
      status: "resolved";
      url: string;
      kind: ReturnType<typeof appWebsiteDestinationKind>;
      source: "mobbin" | "apple-search" | "verified-override";
    }
  | {
      appId: number;
      app: string;
      status: "missing" | "invalid" | "fetch-failed";
      reason: string;
    };

const VERIFIED_WEBSITE_OVERRIDES = new Map<string, {
  appName: string;
  url: string;
}>([
  [
    "https://mobbin.com/apps/mobbin-web-ba4b1ce7-a68f-471a-9e6d-380254e42bf3/latest/screens",
    { appName: "mobbin", url: "https://mobbin.com/" },
  ],
  [
    "https://mobbin.com/apps/anything-ios-a7af1e67-5a93-4a2a-8809-db44dad4d28c/latest/screens",
    { appName: "anything", url: "https://www.anything.com/" },
  ],
  [
    "https://mobbin.com/apps/frame-web-30edba97-ec36-4235-b617-8f503b264450/latest/screens",
    { appName: "frame", url: "https://www.frame.so/" },
  ],
]);

const hasFlag = (flag: string) => process.argv.includes(flag);

function positiveArgument(flag: string, fallback: number): number {
  const index = process.argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

async function sourceRows(limit: number | null, sample: boolean): Promise<AppWebsiteRow[]> {
  const result = await query<AppWebsiteRow>(
    `SELECT app.id, app.name, app.display_name, source.mobbin_url
     FROM apps app
     JOIN LATERAL (
       SELECT image.source_url AS mobbin_url
       FROM app_versions version
       JOIN version_images image ON image.version_id = version.id
       WHERE version.app_id = app.id
         AND image.source_url LIKE 'https://mobbin.com/apps/%'
       ORDER BY version.version_number DESC, image.image_id
       LIMIT 1
     ) source ON TRUE
     WHERE app.website_url IS NULL
     ORDER BY ${sample ? "md5(app.id::text)" : "app.id"}
     ${limit === null ? "" : "LIMIT $1"}`,
    limit === null ? undefined : [limit],
  );
  return result.rows;
}

async function fetchPayload(
  request: APIRequestContext,
  url: string,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await request.get(mobbinRscUrl(url), {
        failOnStatusCode: false,
        headers: { RSC: "1" },
        timeout: 30_000,
      });
      if (response.status() !== 200) {
        throw new Error(`Mobbin returned ${response.status()}`);
      }
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > 16 * 1024 * 1024) {
        throw new Error("Mobbin App payload exceeded 16 MiB");
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
  }
  throw lastError;
}

async function fetchAppleDestination(appName: string): Promise<string | null> {
  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams({
    term: appName,
    entity: "software",
    country: "us",
    limit: "10",
  }).toString();
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Astryx website metadata backfill/1.0" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Apple Search returned ${response.status}`);
      const body = await response.json() as {
        results?: AppleSoftwareResult[];
      };
      if (!Array.isArray(body.results)) throw new Error("Apple Search response was invalid");
      return verifiedAppleDestination(appName, body.results)?.url ?? null;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
  throw lastError;
}

async function resolveWebsite(
  request: APIRequestContext,
  row: AppWebsiteRow,
): Promise<BackfillResult> {
  const app = row.display_name ?? row.name;
  const verifiedOverride = VERIFIED_WEBSITE_OVERRIDES.get(row.mobbin_url);
  if (verifiedOverride?.appName === row.name) {
    return {
      appId: row.id,
      app,
      status: "resolved",
      url: verifiedOverride.url,
      kind: appWebsiteDestinationKind(verifiedOverride.url),
      source: "verified-override",
    };
  }
  let payload: string;
  try {
    payload = await fetchPayload(request, row.mobbin_url);
  } catch (error) {
    const appleUrl = await fetchAppleDestination(app).catch(() => null);
    return appleUrl
      ? {
          appId: row.id,
          app,
          status: "resolved",
          url: appleUrl,
          kind: appWebsiteDestinationKind(appleUrl),
          source: "apple-search",
        }
      : {
          appId: row.id,
          app,
          status: "fetch-failed",
          reason: error instanceof Error ? error.message : "Mobbin request failed",
        };
  }
  const metadata = extractMobbinAppWebsiteMetadata(payload);
  if (!metadata.appName) {
    const appleUrl = await fetchAppleDestination(app).catch(() => null);
    return appleUrl
      ? {
          appId: row.id,
          app,
          status: "resolved",
          url: appleUrl,
          kind: appWebsiteDestinationKind(appleUrl),
          source: "apple-search",
        }
      : {
          appId: row.id,
          app,
          status: "invalid",
          reason: "Mobbin payload was not recognized and Apple had no unique match",
        };
  }
  if (!metadata.hasAppStoreUrlField || !metadata.appStoreUrl) {
    const appleUrl = await fetchAppleDestination(app).catch(() => null);
    return appleUrl
      ? {
          appId: row.id,
          app,
          status: "resolved",
          url: appleUrl,
          kind: appWebsiteDestinationKind(appleUrl),
          source: "apple-search",
        }
      : {
          appId: row.id,
          app,
          status: "missing",
          reason: "Mobbin has no destination and Apple had no unique match",
        };
  }
  const url = verifiedAppWebsiteUrl(metadata.appStoreUrl);
  if (!url) {
    return {
      appId: row.id,
      app,
      status: "invalid",
      reason: "Mobbin destination failed public URL validation",
    };
  }
  return {
    appId: row.id,
    app,
    status: "resolved",
    url,
    kind: appWebsiteDestinationKind(url),
    source: "mobbin",
  };
}

const apply = hasFlag("--apply");
const concurrency = positiveArgument("--concurrency", 4);
const limit = hasFlag("--limit") ? positiveArgument("--limit", 1) : null;
const rows = await sourceRows(limit, hasFlag("--sample"));
const context = await launchMobbinContext({ headless: true });
const results: BackfillResult[] = [];
let completed = 0;

try {
  const lanes = Array.from({ length: Math.min(concurrency, Math.max(rows.length, 1)) }, () => context.request);
  await runPool(rows, lanes, async (request, row) => {
    const result = await resolveWebsite(request, row);
    results.push(result);
    if (apply && result.status === "resolved") {
      await query(
        `UPDATE apps
         SET website_url = $1
         WHERE id = $2
           AND website_url IS NULL`,
        [result.url, result.appId],
      );
    }
    completed += 1;
    if (completed % 25 === 0 || completed === rows.length) {
      console.error(`Website backfill ${completed}/${rows.length}`);
    }
  });
} finally {
  await context.close();
  await closePool();
}

const resolved = results.filter(
  (result): result is Extract<BackfillResult, { status: "resolved" }> =>
    result.status === "resolved",
);
const unresolved = results.filter(
  (result): result is Exclude<BackfillResult, { status: "resolved" }> =>
    result.status !== "resolved",
);
const summary = {
  mode: apply ? "apply" : "dry-run",
  examined: rows.length,
  resolved: resolved.length,
  applied: apply ? resolved.length : 0,
  destinations: {
    websites: resolved.filter(({ kind }) => kind === "website").length,
    appleAppStore: resolved.filter(({ kind }) => kind === "apple-app-store").length,
    googlePlay: resolved.filter(({ kind }) => kind === "google-play").length,
  },
  sources: {
    mobbin: resolved.filter(({ source }) => source === "mobbin").length,
    appleSearch: resolved.filter(({ source }) => source === "apple-search").length,
    verifiedOverrides: resolved.filter(({ source }) => source === "verified-override").length,
  },
  resolvedExamples: resolved.slice(0, 25),
  unresolved: {
    total: unresolved.length,
    missing: unresolved.filter(({ status }) => status === "missing").length,
    invalid: unresolved.filter(({ status }) => status === "invalid").length,
    fetchFailed: unresolved.filter(({ status }) => status === "fetch-failed").length,
    examples: unresolved.slice(0, 25),
  },
};

console.log(JSON.stringify(summary, null, 2));
