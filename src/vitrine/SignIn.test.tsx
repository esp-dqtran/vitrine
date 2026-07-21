import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ReferralInviteNotice, SignIn, resolveReferralInvite } from "./SignIn.tsx";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("renders only the real email/password authentication controls", () => {
  const html = renderToStaticMarkup(
    <SignIn
      authenticate={async () => ({ id: 1, email: "admin@example.com", role: "admin" })}
      register={async () => ({ id: 1, email: "admin@example.com", role: "admin" })}
      onSignedIn={() => {}}
    />
  );

  assert.match(html, /Email/);
  assert.match(html, /Password/);
  assert.match(html, /Sign in/);
  assert.doesNotMatch(html, /Continue with Google/);
});

test("retains only a validated referral and a stable anonymous visitor", async () => {
  const tokens = memoryStorage();
  const visitors = memoryStorage();
  const received: Array<{ token: string; visitor: string }> = [];
  const token = await resolveReferralInvite({
    search: `?ref=${"r".repeat(48)}`,
    tokenStorage: tokens,
    visitorStorage: visitors,
    visitorFactory: () => "visitor-1",
    validate: async (candidate, visitor) => {
      received.push({ token: candidate, visitor });
      return true;
    },
  });
  assert.equal(token, "r".repeat(48));
  assert.equal(tokens.getItem("astryx:referral-token"), "r".repeat(48));
  assert.equal(visitors.getItem("astryx:referral-visitor"), "visitor-1");
  assert.deepEqual(received, [{ token: "r".repeat(48), visitor: "visitor-1" }]);

  await resolveReferralInvite({
    search: `?ref=${"x".repeat(48)}`,
    tokenStorage: tokens,
    visitorStorage: visitors,
    validate: async () => false,
  });
  assert.equal(tokens.getItem("astryx:referral-token"), null);
});

test("shows the no-card referral promise", () => {
  const html = renderToStaticMarkup(<ReferralInviteNotice />);
  assert.match(html, /Your friend gave you 30 days of Astryx Pro/);
  assert.match(html, /No card required/);
});
