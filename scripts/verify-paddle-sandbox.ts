type BillingCycle = { interval?: string; frequency?: number } | null;

type PaddlePrice = {
  id: string;
  status: string;
  billing_cycle: BillingCycle;
  unit_price: { amount?: string; currency_code?: string } | null;
};

type PaddleResponse<T> = { data?: T; error?: { detail?: string } };

const apiBaseUrl = "https://sandbox-api.paddle.com";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function paddle<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...init.headers },
  });
  const payload = await response.json().catch(() => ({})) as PaddleResponse<T>;
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.detail || `Paddle sandbox returned ${response.status}`);
  }
  return payload.data;
}

function assertPrice(price: PaddlePrice, expected: { label: string; interval: "month" | "year"; amount: string }) {
  if (price.status !== "active") throw new Error(`${expected.label} price ${price.id} is not active`);
  if (price.billing_cycle?.interval !== expected.interval || price.billing_cycle.frequency !== 1) {
    throw new Error(`${expected.label} price ${price.id} must recur every ${expected.interval}`);
  }
  if (price.unit_price?.currency_code !== "USD" || price.unit_price.amount !== expected.amount) {
    throw new Error(`${expected.label} price ${price.id} must be USD ${expected.amount} cents`);
  }
}

async function main() {
  if ((process.env.PADDLE_ENVIRONMENT?.trim() || "sandbox") !== "sandbox") {
    throw new Error("This verifier is sandbox-only; set PADDLE_ENVIRONMENT=sandbox");
  }
  const apiKey = required("PADDLE_API_KEY");
  const monthlyPriceId = required("PADDLE_PRO_MONTHLY_PRICE_ID");
  const yearlyPriceId = required("PADDLE_PRO_YEARLY_PRICE_ID");
  const teamYearlyPriceId = required("PADDLE_TEAM_YEARLY_PRICE_ID");

  const prices = await Promise.all([
    paddle<PaddlePrice>(apiKey, `/prices/${encodeURIComponent(monthlyPriceId)}`),
    paddle<PaddlePrice>(apiKey, `/prices/${encodeURIComponent(yearlyPriceId)}`),
    paddle<PaddlePrice>(apiKey, `/prices/${encodeURIComponent(teamYearlyPriceId)}`),
  ]);
  assertPrice(prices[0], { label: "Pro monthly", interval: "month", amount: "899" });
  assertPrice(prices[1], { label: "Pro yearly", interval: "year", amount: "7999" });
  assertPrice(prices[2], { label: "Team yearly per-editor", interval: "year", amount: "34800" });
  console.log("Paddle sandbox catalog verified: Pro $8.99/month, $79.99/year; Team $29/editor/month billed annually.");

  if (!process.argv.includes("--checkout")) return;
  const appUrl = required("APP_URL").replace(/\/$/, "");
  const transaction = await paddle<{ checkout?: { url?: string | null } | null }>(apiKey, "/transactions", {
    method: "POST",
    body: JSON.stringify({
      collection_mode: "automatic",
      items: [{ price_id: monthlyPriceId, quantity: 1 }],
      custom_data: { vitrinesSandboxVerification: new Date().toISOString() },
      checkout: { url: `${appUrl}/billing/success` },
    }),
  });
  if (!transaction.checkout?.url) throw new Error("Paddle sandbox did not return a checkout URL");
  console.log(`Sandbox checkout created: ${transaction.checkout.url}`);
  console.log("Complete it with Paddle's sandbox card, then run the authenticated application lifecycle to verify the signed webhook entitlement.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Paddle sandbox verification failed");
  process.exitCode = 1;
});
