export function adminSeedFromEnv(env: Record<string, string | undefined>) {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (!password) throw new Error("ADMIN_PASSWORD is required");
  if (password.length < 16) {
    throw new Error("ADMIN_PASSWORD must contain at least 16 characters");
  }
  return { email, password };
}

export interface ApiRuntimeConfig {
  appUrl: string;
  mediaSigningSecret: string;
  crawlSessionEncryptionKey: string;
  generalRateLimit: number;
  mediaRateLimit: number;
  appTraversalLimit: number;
}

export interface BillingConfig extends ApiRuntimeConfig {
  paddleApiKey: string;
  paddleWebhookSecret: string;
  paddleEnvironment: "sandbox" | "production";
  monthlyPriceId: string;
  yearlyPriceId: string;
  teamYearlyPriceId: string | undefined;
}

export interface ReferralCampaignConfig {
  id: string;
  startsAt: Date;
  endsAt: Date;
  rewardCap: 3;
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInt(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function apiRuntimeConfigFromEnv(env: Record<string, string | undefined>): ApiRuntimeConfig {
  const appUrl = required(env, "APP_URL");
  const mediaSigningSecret = required(env, "MEDIA_SIGNING_SECRET");
  const crawlSessionEncryptionKey = required(env, "CRAWL_SESSION_ENCRYPTION_KEY");
  if (!/^https?:\/\//.test(appUrl)) throw new Error("APP_URL must be an absolute HTTP URL");
  if (mediaSigningSecret.length < 32) {
    throw new Error("MEDIA_SIGNING_SECRET must contain at least 32 characters");
  }
  decodeSessionKey(crawlSessionEncryptionKey);
  return {
    appUrl: appUrl.replace(/\/$/, ""),
    mediaSigningSecret,
    crawlSessionEncryptionKey,
    generalRateLimit: positiveInt(env.GENERAL_RATE_LIMIT, 300, "GENERAL_RATE_LIMIT"),
    mediaRateLimit: positiveInt(env.MEDIA_RATE_LIMIT, 500, "MEDIA_RATE_LIMIT"),
    appTraversalLimit: positiveInt(env.APP_TRAVERSAL_LIMIT, 20, "APP_TRAVERSAL_LIMIT"),
  };
}

const paddleConfigurationVariables = [
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "PADDLE_ENVIRONMENT",
  "PADDLE_PRO_MONTHLY_PRICE_ID",
  "PADDLE_PRO_YEARLY_PRICE_ID",
  "PADDLE_TEAM_YEARLY_PRICE_ID",
] as const;

export function billingConfigFromEnv(env: Record<string, string | undefined>): BillingConfig {
  const paddleApiKey = required(env, "PADDLE_API_KEY");
  const paddleWebhookSecret = required(env, "PADDLE_WEBHOOK_SECRET");
  const paddleEnvironment = env.PADDLE_ENVIRONMENT?.trim() || "sandbox";
  if (paddleEnvironment !== "sandbox" && paddleEnvironment !== "production") {
    throw new Error("PADDLE_ENVIRONMENT must be sandbox or production");
  }
  const monthlyPriceId = required(env, "PADDLE_PRO_MONTHLY_PRICE_ID");
  const yearlyPriceId = required(env, "PADDLE_PRO_YEARLY_PRICE_ID");
  const teamYearlyPriceId = env.PADDLE_TEAM_YEARLY_PRICE_ID?.trim() || undefined;
  return {
    ...apiRuntimeConfigFromEnv(env),
    paddleApiKey,
    paddleWebhookSecret,
    paddleEnvironment,
    monthlyPriceId,
    yearlyPriceId,
    teamYearlyPriceId,
  };
}

export function optionalBillingConfigFromEnv(env: Record<string, string | undefined>): BillingConfig | undefined {
  const hasPaddleConfiguration = paddleConfigurationVariables.some((name) => Boolean(env[name]?.trim()));
  return hasPaddleConfiguration ? billingConfigFromEnv(env) : undefined;
}

export function referralCampaignFromEnv(
  env: Record<string, string | undefined>,
): ReferralCampaignConfig {
  const id = required(env, "REFERRAL_CAMPAIGN_ID");
  const startsAt = new Date(required(env, "REFERRAL_CAMPAIGN_START"));
  const endsAt = new Date(required(env, "REFERRAL_CAMPAIGN_END"));
  if (Number.isNaN(startsAt.valueOf())) {
    throw new Error("REFERRAL_CAMPAIGN_START must be ISO-8601");
  }
  if (Number.isNaN(endsAt.valueOf())) {
    throw new Error("REFERRAL_CAMPAIGN_END must be ISO-8601");
  }
  if (endsAt <= startsAt) throw new Error("REFERRAL_CAMPAIGN_END must be after start");
  return { id, startsAt, endsAt, rewardCap: 3 };
}
import { decodeSessionKey } from "../../../src/crawlSession.ts";
