import { test } from "node:test";
import assert from "node:assert/strict";
import { adminSeedFromEnv, billingConfigFromEnv } from "./config.ts";

test("requires valid admin seed variables", () => {
  assert.throws(() => adminSeedFromEnv({}), /ADMIN_EMAIL/);
  assert.throws(() => adminSeedFromEnv({ ADMIN_EMAIL: "admin@example.com" }), /ADMIN_PASSWORD/);
  assert.throws(
    () =>
      adminSeedFromEnv({
        ADMIN_EMAIL: "invalid",
        ADMIN_PASSWORD: "1234567890123456",
      }),
    /ADMIN_EMAIL/
  );
  assert.throws(
    () =>
      adminSeedFromEnv({
        ADMIN_EMAIL: "admin@example.com",
        ADMIN_PASSWORD: "too-short",
      }),
    /16 characters/
  );
});

test("normalizes a valid admin seed", () => {
  assert.deepEqual(
    adminSeedFromEnv({
      ADMIN_EMAIL: " Admin@Example.com ",
      ADMIN_PASSWORD: "1234567890123456",
    }),
    { email: "admin@example.com", password: "1234567890123456" }
  );
});

test("requires all billing and media-security variables", () => {
  assert.throws(() => billingConfigFromEnv({}), /STRIPE_SECRET_KEY/);
  assert.throws(
    () => billingConfigFromEnv({ STRIPE_SECRET_KEY: "sk_test_x" }),
    /STRIPE_WEBHOOK_SECRET/,
  );
});

test("parses billing and limiter configuration", () => {
  assert.deepEqual(
    billingConfigFromEnv({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_month",
      STRIPE_PRO_YEARLY_PRICE_ID: "price_year",
      APP_URL: "https://astryx.example/",
      MEDIA_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
      GENERAL_RATE_LIMIT: "300",
      MEDIA_RATE_LIMIT: "500",
      APP_TRAVERSAL_LIMIT: "20",
    }),
    {
      stripeSecretKey: "sk_test_x",
      stripeWebhookSecret: "whsec_x",
      monthlyPriceId: "price_month",
      yearlyPriceId: "price_year",
      appUrl: "https://astryx.example",
      mediaSigningSecret: "0123456789abcdef0123456789abcdef",
      generalRateLimit: 300,
      mediaRateLimit: 500,
      appTraversalLimit: 20,
    },
  );
});
