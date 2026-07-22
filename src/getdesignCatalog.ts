export interface GetDesignAppMapping {
  sourceSlug: string;
  app: string;
  platform: "web";
  createWebPlatform?: true;
}

const direct = [
  "airbnb", "airtable", "apple", "binance", "claude", "clay", "cohere", "coinbase",
  "cursor", "discord", "elevenlabs", "figma", "framer", "intercom", "kraken", "lovable",
  "mintlify", "miro", "nike", "notion", "pinterest", "resend", "revolut", "sentry",
  "shopify", "slack", "spotify", "stripe", "supabase", "uber", "vercel", "webflow",
  "wise", "zapier",
] as const;

export const GETDESIGN_APP_MAPPINGS: readonly GetDesignAppMapping[] = [
  ...direct.map((app) => ({ sourceSlug: app, app, platform: "web" as const })),
  { sourceSlug: "bmw", app: "my-bmw", platform: "web", createWebPlatform: true },
  { sourceSlug: "cal", app: "cal-com", platform: "web" },
  { sourceSlug: "linear.app", app: "linear", platform: "web" },
  { sourceSlug: "mistral.ai", app: "mistral-ai", platform: "web" },
  { sourceSlug: "playstation", app: "playstation-app", platform: "web", createWebPlatform: true },
  { sourceSlug: "raycast", app: "raycast", platform: "web", createWebPlatform: true },
  { sourceSlug: "runwayml", app: "runway", platform: "web" },
  { sourceSlug: "starbucks", app: "starbucks", platform: "web", createWebPlatform: true },
  { sourceSlug: "superhuman", app: "superhuman-mail", platform: "web" },
  { sourceSlug: "tesla", app: "tesla", platform: "web", createWebPlatform: true },
].sort((left, right) => left.sourceSlug.localeCompare(right.sourceSlug));
