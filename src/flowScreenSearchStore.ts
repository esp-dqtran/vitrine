import { query, type CrawledImage } from "./db.ts";
import type { Platform } from "./platformFromUrl.ts";

const SCREEN_SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "app", "by", "during", "for", "from", "in", "into", "my", "of", "on", "page", "screen", "show", "showing", "the", "this", "to", "user", "with",
]);

const SCREEN_SEARCH_ALIASES: Record<string, string[]> = {
  checkout: ["checkout", "check out", "payment", "place order"],
  login: ["login", "log in", "signin", "sign in"],
  logout: ["logout", "log out", "signout", "sign out"],
  personalization: ["personalization", "personalisation", "personalize", "personalise", "preferences"],
  signup: ["signup", "sign up", "register", "create account"],
};

export interface PublishedScreenSearchResult extends CrawledImage {
  app_name: string;
  flow_id: string | null;
  flow_title: string | null;
  flow_step_index: number | null;
  flow_step_label: string | null;
  matched_term_count: number;
}

export interface PublishedScreenSearchInput {
  query: string;
  platform?: Platform;
  limit: number;
  mode?: "standard" | "deep";
}

type QueryExecutor = <R = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<{ rows: R[] }>;

const executeQuery: QueryExecutor = async <R>(text: string, params?: unknown[]) => {
  const result = await query(text, params);
  return { rows: result.rows as R[] };
};

export function screenSearchTermGroups(searchQuery: string): string[][] {
  const tokens = searchQuery.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const unique = [...new Set(tokens.filter((token) => token.length > 1 && !SCREEN_SEARCH_STOP_WORDS.has(token)))];
  return unique.slice(0, 12).map((token) => SCREEN_SEARCH_ALIASES[token] ?? [token]);
}

export function screenSearchTsQueries(searchQuery: string): {
  strict: string;
  broad: string;
  groups: string[];
} | undefined {
  const groups = screenSearchTermGroups(searchQuery).map((variants) => (
    `(${variants.map((variant) => {
      const terms = (variant.match(/[a-z0-9]+/g) ?? [])
        .filter((term) => !SCREEN_SEARCH_STOP_WORDS.has(term));
      return terms.map((term) => `${term}:*`).join(" & ");
    }).filter(Boolean).join(" | ")})`
  ));
  return groups.length ? {
    strict: groups.join(" & "),
    broad: groups.join(" | "),
    groups,
  } : undefined;
}

export function createPublishedScreenSearch(execute: QueryExecutor = executeQuery) {
  return async function publishedScreenSearch(input: PublishedScreenSearchInput): Promise<PublishedScreenSearchResult[]> {
    const searchQueries = screenSearchTsQueries(input.query);
    if (!searchQueries) return [];
    const limit = Math.max(1, Math.min(100, Math.trunc(input.limit)));
    const minimumMatches = input.mode === "deep"
      ? searchQueries.groups.length
      : Math.max(1, Math.ceil(searchQueries.groups.length / 2));
    const result = await execute<PublishedScreenSearchResult>(
      `WITH search_query AS (
         SELECT
           to_tsquery('english', $1) AS strict_query,
           to_tsquery('english', $2) AS broad_query
       ), latest_versions AS MATERIALIZED (
         SELECT DISTINCT ON (av.app_id, av.platform)
           av.id AS version_id, av.app_id, av.platform, av.version_number
         FROM app_versions av
         WHERE av.status = 'published'
         ORDER BY av.app_id, av.platform, av.version_number DESC
       ), scored AS MATERIALIZED (
         SELECT
           image.id,
           app.name AS app,
           COALESCE(app.display_name, app.name) AS app_name,
           latest.platform,
           image.image_url,
           image.kind,
           image.description,
           image.analysis,
           app.icon_url,
           COALESCE(version_image.source_url, image.image_url) AS capture_url,
           COALESCE(version_image.captured_at, image.created_at) AS captured_at,
           version_image.viewport_width,
           version_image.viewport_height,
           version_image.state_context,
           latest.version_id,
           search_document.search_vector @@ search_query.strict_query AS full_match,
           ts_rank_cd(search_document.search_vector, search_query.broad_query) AS search_rank,
           (
             SELECT count(*)::integer
             FROM unnest($3::text[]) AS term_group(query)
             WHERE search_document.search_vector @@ to_tsquery('english', term_group.query)
           ) AS matched_term_count
         FROM search_query
         CROSS JOIN latest_versions latest
         JOIN apps app ON app.id = latest.app_id
         JOIN version_images version_image ON version_image.version_id = latest.version_id
         JOIN images image ON image.id = version_image.image_id
         JOIN published_screen_search_documents search_document
           ON search_document.version_id = latest.version_id
          AND search_document.image_id = image.id
         WHERE image.kind = 'screen'
           AND ($4::text IS NULL OR latest.platform = $4)
           AND search_document.search_vector @@ search_query.broad_query
       )
       SELECT
         scored.id, scored.app, scored.app_name, scored.platform,
         scored.image_url, scored.kind, scored.description, scored.analysis,
         scored.icon_url, scored.capture_url, scored.captured_at,
         scored.viewport_width, scored.viewport_height, scored.state_context,
         membership.source_flow_id AS flow_id,
         membership.title AS flow_title,
         membership.step_index::integer AS flow_step_index,
         membership.step_label AS flow_step_label,
         scored.matched_term_count
       FROM scored
       LEFT JOIN LATERAL (
         SELECT
           flow.source_flow_id,
           flow.title,
           step.position AS step_index,
           NULLIF(step.value->>'label', '') AS step_label
         FROM app_flow_versions flow
         CROSS JOIN LATERAL jsonb_array_elements(flow.steps)
           WITH ORDINALITY AS step(value, position)
         CROSS JOIN LATERAL jsonb_array_elements_text(
           COALESCE(step.value->'evidence', '[]'::jsonb)
         ) AS evidence(value)
         WHERE flow.version_id = scored.version_id
           AND evidence.value ~ '^[1-9][0-9]*$'
           AND evidence.value::integer = scored.id
         ORDER BY flow.position, step.position
         LIMIT 1
       ) membership ON true
       WHERE scored.matched_term_count >= $5
       ORDER BY
         scored.full_match DESC,
         scored.matched_term_count DESC,
         scored.search_rank DESC,
         (membership.source_flow_id IS NOT NULL) DESC,
         scored.captured_at DESC NULLS LAST,
         scored.id DESC
       LIMIT $6`,
      [
        searchQueries.strict,
        searchQueries.broad,
        searchQueries.groups,
        input.platform ?? null,
        minimumMatches,
        limit,
      ],
    );
    return result.rows;
  };
}

export const publishedScreenSearch = createPublishedScreenSearch();
