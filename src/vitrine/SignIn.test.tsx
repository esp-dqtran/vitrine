import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppPill,
  ReferralInviteNotice,
  SignIn,
  SlidePlaceholder,
  resolveReferralInvite,
  showcaseTypeLabel,
  toShowcaseSlide,
} from "./SignIn.tsx";

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
  assert.match(html, /data-sign-in-layout="page"/);
  assert.match(html, /width:26px;height:26px;border-radius:8px/);
  assert.match(html, /Welcome back/);
  assert.match(html, /data-sign-in-showcase="true"/);
  assert.doesNotMatch(html, /Continue with Google/);
});

test("maps real catalog identity into a showcase slide", () => {
  const slide = toShowcaseSlide({
    id: "linear",
    name: "Linear",
    accent: "#5e6ad2",
    categories: [{ id: 1, name: "Productivity", slug: "productivity" }],
    iconUrl: "/icons/linear.svg",
    platforms: ["web"],
    totalScreens: 1,
    screens: [{
      url: "/api/preview-media/linear/1",
      type: "Dashboard",
      platform: "web",
      thumbnailUrl: "/api/preview-media/linear/1",
    }],
  });

  assert.deepEqual(slide, {
    id: "linear",
    app: "Linear",
    accent: "#5e6ad2",
    type: "Dashboard",
    image: "/api/preview-media/linear/1",
    iconUrl: "/icons/linear.svg",
  });
});

test("renders the full showcase image and the real app icon", () => {
  const slide = {
    id: "linear",
    app: "Linear",
    accent: "#5e6ad2",
    type: "Dashboard",
    image: "/api/preview-media/linear/1",
    iconUrl: "/icons/linear.svg",
  };

  const preview = renderToStaticMarkup(<SlidePlaceholder {...slide} />);
  const pill = renderToStaticMarkup(<AppPill slide={slide} />);

  assert.match(preview, /object-fit:contain/);
  assert.match(pill, /src="\/icons\/linear\.svg"/);
  assert.match(pill, /alt=""/);
});

test("suppresses only unclassified showcase type labels", () => {
  assert.equal(showcaseTypeLabel("Unclassified"), null);
  assert.equal(showcaseTypeLabel(" unclassified "), null);
  assert.equal(showcaseTypeLabel("Dashboard"), "Dashboard");
  assert.equal(showcaseTypeLabel(" Sign in "), "Sign in");
});

test("renders the shared authentication form in an embedded layout", () => {
  const html = renderToStaticMarkup(
    <SignIn
      embedded
      authenticate={async () => ({ id: 1, email: "admin@example.com", role: "admin" })}
      register={async () => ({ id: 1, email: "admin@example.com", role: "admin" })}
      onSignedIn={() => {}}
    />,
  );

  assert.match(html, /data-sign-in-layout="embedded"/);
  assert.match(html, /display:flex;align-items:center;gap:6px/);
  assert.match(html, /width:48px;height:48px;border-radius:12px/);
  assert.match(html, /font-size:24px;font-weight:700/);
  assert.match(html, /margin-bottom:30px;text-align:left/);
  assert.match(html, /Sign in to Vitrine/);
  assert.match(html, /Access your saved apps, sites, screens, and collections\./);
  assert.match(html, /background:transparent/);
  assert.doesNotMatch(html, /background:var\(--color-background-body\)/);
  assert.doesNotMatch(html, /Welcome back/);
  assert.doesNotMatch(html, /Sign in to pick up your saved screens and boards\./);
  assert.match(html, /Email/);
  assert.match(html, /Password/);
  assert.doesNotMatch(html, /min-height:100vh/);
  assert.doesNotMatch(html, /data-sign-in-showcase="true"/);
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
