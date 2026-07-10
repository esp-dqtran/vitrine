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

export interface BillingConfig {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  appUrl: string;
  mediaSigningSecret: string;
  generalRateLimit: number;
  mediaRateLimit: number;
  appTraversalLimit: number;
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

export function billingConfigFromEnv(env: Record<string, string | undefined>): BillingConfig {
  const stripeSecretKey = required(env, "STRIPE_SECRET_KEY");
  const stripeWebhookSecret = required(env, "STRIPE_WEBHOOK_SECRET");
  const monthlyPriceId = required(env, "STRIPE_PRO_MONTHLY_PRICE_ID");
  const yearlyPriceId = required(env, "STRIPE_PRO_YEARLY_PRICE_ID");
  const appUrl = required(env, "APP_URL");
  const mediaSigningSecret = required(env, "MEDIA_SIGNING_SECRET");
  if (!/^https?:\/\//.test(appUrl)) throw new Error("APP_URL must be an absolute HTTP URL");
  if (mediaSigningSecret.length < 32) {
    throw new Error("MEDIA_SIGNING_SECRET must contain at least 32 characters");
  }
  return {
    stripeSecretKey,
    stripeWebhookSecret,
    monthlyPriceId,
    yearlyPriceId,
    appUrl: appUrl.replace(/\/$/, ""),
    mediaSigningSecret,
    generalRateLimit: positiveInt(env.GENERAL_RATE_LIMIT, 300, "GENERAL_RATE_LIMIT"),
    mediaRateLimit: positiveInt(env.MEDIA_RATE_LIMIT, 500, "MEDIA_RATE_LIMIT"),
    appTraversalLimit: positiveInt(env.APP_TRAVERSAL_LIMIT, 20, "APP_TRAVERSAL_LIMIT"),
  };
}
