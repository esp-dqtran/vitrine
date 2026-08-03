import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Button,
  Divider,
  Heading,
  Icon,
  Text,
  useMediaQuery,
} from "@astryxdesign/core";
import { AstryxMenu } from "./components/AstryxDropdown";
import { Shot, type ShotSource } from "./components/Shot";
import { useRevealOnScroll } from "./useRevealOnScroll";
import {
  useCatalogPreview,
  useCatalogStats,
  type PreviewApp,
  type PreviewScreen,
} from "./useCatalogPreview";

const wrap: CSSProperties = {
  maxWidth: 1220,
  margin: "0 auto",
  paddingInline: 24,
};
const navLink: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text-primary)",
};

function Section({
  style,
  children,
}: {
  style?: CSSProperties;
  children: ReactNode;
}) {
  return <section style={{ ...wrap, ...style }}>{children}</section>;
}

const FALLBACK_STATS = [
  { n: "465", label: "apps" },
  { n: "137K+", label: "screens" },
  { n: "647", label: "UI elements" },
];

// Vitrines' own product captures. Used where the story is about the workspace
// itself rather than about a catalog reference.
const PRODUCT_SHOTS = {
  catalog: "/landing/astryx-apps-catalog.png",
  publicPreview: "/landing/astryx-public-preview-real-flows.png",
} as const;

// 421960 reads as noise in a headline; 422K reads as a number someone chose.
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString("en-US");
}

function productShot(url: string): ShotSource {
  return { url, platform: "web", appName: "Vitrines" };
}

function screensOn(app: PreviewApp, kind: "web" | "phone") {
  return app.screens.filter((s) =>
    kind === "web" ? s.platform === "web" : s.platform !== "web",
  );
}

// One catalog app → one framed shot. Returns null when the catalog has not
// loaded, so every call site can fall back to a Vitrines product capture.
// Always the full-resolution variant: the server thumbnails are 10–20x
// smaller and visibly soft at the sizes the landing renders. Every <img> is
// lazy, so the weight only loads as the visitor reaches it.
function toShot(
  app: PreviewApp | undefined,
  {
    screen = 0,
    prefer,
  }: { screen?: number; prefer?: "web" | "phone" } = {},
): ShotSource | null {
  if (!app) return null;
  // A multi-platform app (WhatsApp ships web, iOS and Android) can land in the
  // web pool and still hand back an Android capture from screens[0]. Pick from
  // the platform the slot was framed for, not from whatever came first.
  const pool = prefer ? screensOn(app, prefer) : app.screens;
  const picked = pool[screen] ?? pool[0] ?? app.screens[screen] ?? app.screens[0];
  if (!picked) return null;
  const pick = (s: PreviewScreen) => s.url;
  return {
    url: pick(picked),
    platform: picked.platform,
    appName: app.name,
    iconUrl: app.iconUrl,
    accent: app.accent,
    meta: [
      app.categories[0]?.name,
      app.totalScreens > 0 ? `${compact(app.totalScreens)} screens` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

const STORIES = [
  {
    eyebrow: "BROWSE BY PRODUCT",
    title: "Start with the product, not a blank search box.",
    copy: "Open a real app and stay inside it. Every screen keeps the product, platform, and capture date around it, so a reference never arrives stripped of the thing that made it work.",
    action: "Explore the library",
  },
  {
    eyebrow: "FOLLOW THE WHOLE JOURNEY",
    title: "See what happens before and after the perfect screen.",
    copy: "One screenshot hides the decision. Step through the captured flow — the empty state before it, the confirmation after it — and you can tell whether a pattern will survive contact with your users.",
    action: "Browse product flows",
  },
  {
    eyebrow: "KEEP THE TRAIL",
    title: "Collect the references. Keep the reasoning attached.",
    copy: "Pull screens, flow steps, notes and tokens into one project. Six weeks later, when someone asks why the flow looks like that, the answer is still attached to the evidence.",
    action: "Start a research project",
  },
];

const CAPABILITIES = [
  {
    eyebrow: "SEARCH",
    title: "Apps & sites",
    copy: "Web, iOS and Android products, captured and kept current.",
  },
  {
    eyebrow: "TRACE",
    title: "Screens & flows",
    copy: "Whole journeys — including the states nobody screenshots.",
  },
  {
    eyebrow: "INSPECT",
    title: "UI elements",
    copy: "One pattern, side by side, across the products that use it.",
  },
  {
    eyebrow: "ORGANIZE",
    title: "Research projects",
    copy: "Evidence and observations in one place, not five tabs.",
  },
  {
    eyebrow: "SYNTHESIZE",
    title: "Living canvas",
    copy: "Arrange the findings until the argument is obvious.",
  },
  {
    eyebrow: "HAND OFF",
    title: "Shareable briefs",
    copy: "Send the decision with its sources still clickable.",
  },
];

function PromptSearch({
  onBrowse,
  compact = false,
}: {
  onBrowse: () => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");

  const runSearch = () => {
    const trimmed = query.trim();
    if (trimmed) sessionStorage.setItem("astryx:q", trimmed);
    onBrowse();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    runSearch();
  };

  return (
    <form
      aria-label="Search product evidence"
      onSubmit={submit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        maxWidth: compact ? 610 : 720,
        padding: 8,
        borderRadius: 16,
        border: "1px solid var(--color-border)",
        background: "var(--color-background-surface)",
        boxShadow: "0 24px 70px rgba(0,0,0,.22)",
      }}
    >
      <Icon icon="search" size="md" />
      <input
        aria-label="What are you researching?"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          runSearch();
        }}
        placeholder="What are you researching?"
        style={{
          minWidth: 0,
          flex: 1,
          border: 0,
          outline: 0,
          padding: "10px 6px",
          background: "transparent",
          color: "var(--color-text-primary)",
          font: "inherit",
          fontSize: compact ? 15 : 17,
        }}
      />
      <Button
        type="button"
        variant="primary"
        size={compact ? "sm" : "md"}
        label={compact ? "Search" : "Search evidence"}
        clickAction={runSearch}
      />
    </form>
  );
}

// The hero is the real product, not a recording of it. Same origin, so an
// iframe of /apps just works, and "Live Vitrines catalog" is literally true —
// on-brand for a product whose pitch is real evidence. Ambient, not
// interactive: pointer events are off and a gentle scripted scroll plays
// inside; clicking anywhere goes to the real page. Mobile keeps the recorded
// video — a second React instance rendering a desktop layout is a bad trade
// on a phone.
const HERO_APP_WIDTH = 1600;
const HERO_APP_HEIGHT = 900;

function LiveHeroEmbed({ onBrowse }: { onBrowse: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(box.clientWidth / HERO_APP_WIDTH);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Ambient ping-pong scroll inside the embed, so the hero shows the catalog
  // moving without trapping the visitor's own scroll.
  useEffect(() => {
    if (!ready) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const RANGE = 1100;
    const PERIOD = 14_000;
    const step = (now: number) => {
      const phase = ((now - start) % PERIOD) / PERIOD;
      const eased = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
      try {
        frameRef.current?.contentWindow?.scrollTo(0, RANGE * eased);
      } catch {
        // Cross-origin dev proxies can deny access; the embed stays static.
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  return (
    <div
      ref={boxRef}
      role="link"
      aria-label="Open the live Vitrines catalog"
      tabIndex={0}
      onClick={onBrowse}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onBrowse();
      }}
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        borderRadius: 17,
        background: "#0f1012",
        cursor: "pointer",
      }}
    >
      {/* Poster behind the iframe kills the white flash while the app boots. */}
      <img
        src="/landing/astryx-apps-catalog.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: ready ? 0 : 1,
          transition: "opacity .4s",
        }}
      />
      <iframe
        ref={frameRef}
        src="/apps"
        title="Live Vitrines catalog"
        tabIndex={-1}
        aria-hidden="true"
        onLoad={() => setReady(true)}
        style={{
          // 24px wider than the box clips the embed's own scrollbar out of
          // view — the ambient scroll would otherwise flash it on the edge.
          width: HERO_APP_WIDTH + 24,
          height: HERO_APP_HEIGHT,
          border: 0,
          transformOrigin: "0 0",
          transform: `scale(${scale})`,
          pointerEvents: "none",
          opacity: ready ? 1 : 0,
          transition: "opacity .4s",
        }}
      />
    </div>
  );
}

export function Home({
  onBrowse,
  onPricing,
  onBuildInPublic,
  onLogin,
}: {
  onBrowse: () => void;
  onPricing: () => void;
  onBuildInPublic: () => void;
  onLogin: () => void;
}) {
  const isCompactNav = useMediaQuery("(max-width: 700px)", false);
  const isMobile = useMediaQuery("(max-width: 760px)", false);
  const catalog = useCatalogPreview(24);
  const statCounts = useCatalogStats();
  const apps = catalog ?? [];
  // Framing is per-platform, so the page picks its imagery per platform too:
  // a browser story wants a landscape web capture, a flow strip wants handsets.
  // Both pools lead with the most deeply captured products: a thinly covered
  // app tends to open on a near-empty screen, which reads as a broken image.
  const byCoverage = (a: PreviewApp, b: PreviewApp) =>
    b.totalScreens - a.totalScreens;
  const webApps = apps
    .filter((app) => app.screens.some((screen) => screen.platform === "web"))
    .sort(byCoverage);
  const phoneApps = apps
    .filter((app) => app.screens.some((screen) => screen.platform !== "web"))
    .sort(byCoverage);

  // Every surface draws from one shared allocation, in page order, so no
  // product appears twice — the same app in the hero story and again in the
  // wall below reads as a thin catalog, which is the opposite of the claim.
  const used = new Set<string>();
  const take = (pool: PreviewApp[], n: number): PreviewApp[] => {
    const picked = pool.filter((app) => !used.has(app.id)).slice(0, n);
    picked.forEach((app) => used.add(app.id));
    return picked;
  };

  const carouselApps = apps
    .flatMap((app) => (app.iconUrl ? [{ ...app, iconUrl: app.iconUrl }] : []))
    .slice(0, 8);
  const stats = statCounts
    ? [
        { n: compact(statCounts.apps), label: "apps" },
        { n: compact(statCounts.screens), label: "screens" },
        { n: compact(statCounts.uiElements), label: "UI elements" },
      ]
    : FALLBACK_STATS;

  // Story 2 is a captured flow, so it needs consecutive screens from one app —
  // three unrelated shots would contradict the headline above it.
  const [flowApp] = take(
    phoneApps.filter((app) => screensOn(app, "phone").length >= 3),
    1,
  );
  const flowScreens = flowApp ? screensOn(flowApp, "phone") : [];
  const flowShots = flowScreens.slice(0, 3).map((screen, i) => ({
    url: screen.url,
    platform: screen.platform,
    appName: flowApp?.name ?? "",
    // Only the last frame carries the caption; three captions under one flow
    // repeat the same app name three times.
    iconUrl: i === 2 ? flowApp?.iconUrl : null,
    accent: flowApp?.accent,
    meta: i === 2 ? "captured steps from one product" : null,
  }));

  // `/api/catalog` returns no per-screen classification — every preview comes
  // back `Unclassified` with empty text and component arrays — so there is no
  // way to tell a dense screen from a splash or loading state. The page is
  // built around that: the two single-image slots use Vitrines' own captures,
  // which are known-good, and every catalog reference lives in a multi-tile
  // surface where one thin capture among ten is invisible rather than being
  // the largest thing on the page.
  const storyShots: Array<ShotSource> = [
    productShot(PRODUCT_SHOTS.catalog),
    // Only reached when no app has the 3 consecutive screens the strip needs.
    toShot(flowApp, { prefer: "phone" }) ??
      productShot(PRODUCT_SHOTS.publicPreview),
    productShot(PRODUCT_SHOTS.catalog),
  ];
  // Story 3 collects references, so it shows two of them rather than one — and
  // a pair survives a weak capture in a way a single hero image does not.
  const storyPairShots = take(webApps, 2)
    .map((app) => toShot(app, { prefer: "web" }))
    .filter((shot): shot is ShotSource => shot?.platform === "web");

  // Bento tiles alternate handset and browser so the grid does not read as six
  // of the same shape. Thumbnails are plenty at this size, and captions are
  // dropped — the card already carries a title right above the image.
  const bentoPhones = take(phoneApps, 3);
  const bentoWeb = take(webApps, 3);
  const bentoShots = CAPABILITIES.map((_, i) => {
    const phone = i % 2 === 0;
    const app = phone ? bentoPhones[i / 2] : bentoWeb[(i - 1) / 2];
    const shot = toShot(app, { prefer: phone ? "phone" : "web" });
    return shot && { ...shot, iconUrl: null, meta: null };
  });

  // Two grids, not one: a 9/19.5 handset and a 16/10 browser in the same row
  // leave a crater under the short one. Grouping by shape keeps rows even.
  const galleryWeb = take(webApps, 2)
    .map((app) => toShot(app, { prefer: "web" }))
    .filter((shot): shot is ShotSource => shot?.platform === "web");
  const galleryPhones = take(phoneApps, 4)
    .map((app) => toShot(app, { prefer: "phone" }))
    .filter(
      (shot): shot is ShotSource => shot !== null && shot.platform !== "web",
    );

  const heroMediaRef = useRef<HTMLDivElement>(null);
  const storiesRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(heroMediaRef);
  useRevealOnScroll(storiesRef);
  useRevealOnScroll(platformRef);
  useRevealOnScroll(galleryRef);
  useRevealOnScroll(proofRef);
  useRevealOnScroll(ctaRef);

  return (
    <div
      className="vitrine-page"
      style={{
        minHeight: "100vh",
        color: "var(--color-text-primary)",
        overflow: "clip",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom:
            "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)",
          background:
            "color-mix(in srgb, var(--color-background-body) 88%, transparent)",
          backdropFilter: "blur(18px) saturate(150%)",
          WebkitBackdropFilter: "blur(18px) saturate(150%)",
        }}
      >
        <div
          style={{
            ...wrap,
            minHeight: 62,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <Button
            type="button"
            label="Vitrines"
            variant="ghost"
            size="lg"
            onClick={onBrowse}
            icon={
              <img
                src="/favicon.svg"
                alt=""
                aria-hidden="true"
                width={24}
                height={24}
                style={{ display: "block" }}
              />
            }
            style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}
          />
          {isCompactNav ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Button
                label="Log in"
                variant="primary"
                size="sm"
                onClick={onLogin}
                style={navLink}
              />
              <AstryxMenu
                button={{
                  label: "Menu",
                  icon: <Icon icon="menu" />,
                  isIconOnly: true,
                  variant: "ghost",
                  size: "sm",
                }}
                items={[
                  { label: "Browse", onClick: onBrowse },
                  { label: "Pricing", onClick: onPricing },
                  { label: "Build in public", onClick: onBuildInPublic },
                  { label: "Log in", onClick: onLogin },
                ]}
              />
            </div>
          ) : (
            <nav
              aria-label="Main navigation"
              style={{ display: "flex", alignItems: "center", gap: 22 }}
            >
              <Button
                label="Browse"
                variant="ghost"
                onClick={onBrowse}
                style={navLink}
              />
              <Button
                label="Pricing"
                variant="ghost"
                onClick={onPricing}
                style={navLink}
              />
              <Button
                label="Build in public"
                variant="ghost"
                onClick={onBuildInPublic}
                style={navLink}
              />
              <Button
                label="Log in"
                variant="primary"
                onClick={onLogin}
                style={navLink}
              />
            </nav>
          )}
        </div>
      </header>

      <Section
        style={{
          paddingTop: isMobile ? 60 : 86,
          paddingBottom: isMobile ? 36 : 54,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <Heading
            level={1}
            type="display-1"
            style={{
              fontSize: isMobile ? 43 : 76,
              lineHeight: isMobile ? 1 : 0.96,
              letterSpacing: isMobile ? "-0.045em" : "-0.055em",
              animation: "hmFadeUp .55s cubic-bezier(.16,1,.3,1) both",
            }}
          >
            Product research for decisions that ship.
          </Heading>
          <div
            style={{
              margin: `${isMobile ? 18 : 24}px auto 0`,
              maxWidth: 620,
              animation: "hmFadeUp .55s cubic-bezier(.16,1,.3,1) .04s both",
            }}
          >
            <Text type="large" color="secondary">
              Search {stats[1].n} screens captured from {stats[0].n} real
              products — then keep the evidence attached to the decision your
              team ships.
            </Text>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              flexWrap: "wrap",
              marginTop: isMobile ? 24 : 30,
              animation: "hmFadeUp .55s cubic-bezier(.16,1,.3,1) .08s both",
            }}
          >
            <Button
              variant="primary"
              size="lg"
              label="Explore the library"
              clickAction={onBrowse}
            />
            {!isMobile && (
              <Button
                variant="ghost"
                size="lg"
                label="Start a project"
                clickAction={onLogin}
              />
            )}
          </div>
        </div>
      </Section>

      <div
        ref={heroMediaRef}
        style={{ ...wrap, paddingBottom: isMobile ? 74 : 112 }}
      >
        <div
          style={{
            position: "relative",
            borderRadius: isMobile ? 16 : 24,
            padding: isMobile ? 5 : 9,
            border: "1px solid var(--color-border)",
            background: "var(--color-background-surface)",
            boxShadow: "0 34px 110px rgba(0,0,0,.34)",
          }}
        >
          {isMobile ? (
            <video
              aria-label="Vitrines product evidence demo"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/landing/astryx-apps-catalog.png"
              style={{
                display: "block",
                width: "100%",
                aspectRatio: "4 / 3",
                objectFit: "cover",
                objectPosition: "center",
                borderRadius: 12,
                background: "#0f1012",
              }}
            >
              <source src="/landing/astryx-product-demo.mp4" type="video/mp4" />
            </video>
          ) : (
            <LiveHeroEmbed onBrowse={onBrowse} />
          )}
          <div
            style={{
              position: "absolute",
              left: isMobile ? 16 : 28,
              bottom: isMobile ? 16 : 28,
              padding: "8px 11px",
              borderRadius: 999,
              background: "color-mix(in srgb, var(--vitrine-color-surface) 82%, transparent)",
              color: "var(--vitrine-color-text-primary)",
              fontSize: 12,
              fontWeight: 700,
              backdropFilter: "blur(10px)",
            }}
          >
            Live Vitrines catalog · {stats[0].n} apps
          </div>
        </div>
      </div>

      <Section style={{ paddingBottom: isMobile ? 70 : 108 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Text type="supporting" color="secondary">
            CAPTURED FROM PRODUCTS YOUR USERS ALREADY KNOW
          </Text>
        </div>
        <div
          className="home-logo-carousel"
          aria-label="Products in the Vitrines research catalog"
          style={{ paddingBlock: isMobile ? 20 : 24 }}
        >
          <div className="home-logo-carousel__track">
            {[0, 1].map((group) => (
              <div
                key={group}
                className="home-logo-carousel__group"
                aria-hidden={group === 1 ? "true" : undefined}
              >
                {carouselApps.map((app) => (
                  <div
                    key={`${group}-${app.id}`}
                    className="home-logo-carousel__item"
                  >
                    <img
                      src={app.iconUrl}
                      alt={group === 0 ? `${app.name} app icon` : ""}
                      loading="lazy"
                    />
                    <span>{app.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <div
        ref={storiesRef}
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <Section
          style={{
            paddingTop: isMobile ? 74 : 112,
            paddingBottom: isMobile ? 78 : 120,
          }}
        >
          <div style={{ maxWidth: 690, marginBottom: isMobile ? 52 : 76 }}>
            <Text type="supporting" color="secondary">
              FROM FIRST LOOK TO FINAL HANDOFF
            </Text>
            <div style={{ marginTop: 12 }}>
              <Heading
                level={2}
                style={{
                  fontSize: isMobile ? 32 : 48,
                  lineHeight: 1.02,
                  letterSpacing: "-0.045em",
                }}
              >
                Evidence that works alongside you, not after you.
              </Heading>
            </div>
          </div>
          <div style={{ display: "grid", gap: isMobile ? 72 : 108 }}>
            {STORIES.map((story, index) => (
              <article
                key={story.title}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "minmax(0, 1.45fr) minmax(320px, .75fr)",
                  gap: isMobile ? 28 : 52,
                  alignItems: "center",
                }}
              >
                <div style={{ order: !isMobile && index % 2 === 1 ? 2 : 1 }}>
                  {index === 1 && flowShots.length === 3 ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: isMobile ? 8 : 14,
                        alignItems: "start",
                      }}
                    >
                      {flowShots.map((shot, step) => (
                        <Shot key={`${shot.url}-${step}`} shot={shot} />
                      ))}
                    </div>
                  ) : index === 2 && storyPairShots.length === 2 ? (
                    <div style={{ display: "grid", gap: isMobile ? 20 : 26 }}>
                      {storyPairShots.map((shot) => (
                        <Shot key={shot.url} shot={shot} />
                      ))}
                    </div>
                  ) : (
                    <Shot
                      shot={storyShots[index]}
                      style={
                        storyShots[index].platform === "web"
                          ? undefined
                          : { maxWidth: 300, margin: "0 auto" }
                      }
                    />
                  )}
                </div>
                <div style={{ order: !isMobile && index % 2 === 1 ? 1 : 2 }}>
                  <Text type="supporting" color="secondary">
                    {story.eyebrow}
                  </Text>
                  <div style={{ marginTop: 12 }}>
                    <Heading
                      level={3}
                      style={{
                        fontSize: isMobile ? 27 : 34,
                        lineHeight: 1.05,
                        letterSpacing: "-0.035em",
                      }}
                    >
                      {story.title}
                    </Heading>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <Text type="large" color="secondary">
                      {story.copy}
                    </Text>
                  </div>
                  <div style={{ marginTop: 24 }}>
                    <Button
                      variant="ghost"
                      label={story.action}
                      clickAction={index === 2 ? onLogin : onBrowse}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>
      </div>

      <div
        ref={platformRef}
        style={{
          borderBlock: "1px solid var(--color-border)",
          background: "var(--color-background-surface)",
        }}
      >
        <Section
          style={{
            paddingTop: isMobile ? 74 : 108,
            paddingBottom: isMobile ? 74 : 108,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "end",
              justifyContent: "space-between",
              gap: 30,
              marginBottom: 42,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 640 }}>
              <Text type="supporting" color="secondary">
                MORE THAN A REFERENCE LIBRARY
              </Text>
              <div style={{ marginTop: 12 }}>
                <Heading
                  level={2}
                  style={{
                    fontSize: isMobile ? 32 : 48,
                    lineHeight: 1.02,
                    letterSpacing: "-0.045em",
                  }}
                >
                  A full product research platform.
                </Heading>
              </div>
            </div>
            <Button
              variant="ghost"
              label="See what is inside"
              clickAction={onBrowse}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {CAPABILITIES.map((item, index) => {
              const tall = !isMobile && (index === 0 || index === 4);
              const shot = bentoShots[index];
              return (
                <article
                  key={item.title}
                  style={{
                    minHeight: tall ? 430 : 265,
                    // The shot runs off the bottom edge, so the card keeps no
                    // bottom padding of its own.
                    padding: "24px 24px 0",
                    borderRadius: 18,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-background-body)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    gridRow: tall ? "span 2" : undefined,
                  }}
                >
                  <Text type="supporting" color="secondary">
                    {item.eyebrow}
                  </Text>
                  <div style={{ marginTop: 14 }}>
                    <Heading level={3}>{item.title}</Heading>
                    <div style={{ marginTop: 9 }}>
                      <Text type="body" color="secondary">
                        {item.copy}
                      </Text>
                    </div>
                  </div>
                  {shot && (
                    <div
                      style={{
                        marginTop: 24,
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-start",
                      }}
                    >
                      <Shot
                        shot={shot}
                        style={{
                          width: "100%",
                          maxWidth: shot.platform === "web" ? undefined : 168,
                        }}
                      />
                    </div>
                  )}
                </article>
              );
            })}
            <article
              style={{
                minHeight: 220,
                padding: 24,
                borderRadius: 18,
                border: "1px solid var(--color-border)",
                background: "var(--color-background-body)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Text type="supporting" color="secondary">
                LIVE CATALOG
              </Text>
              <div
                style={{
                  marginTop: "auto",
                  fontSize: isMobile ? 52 : 68,
                  lineHeight: 0.9,
                  fontWeight: 800,
                  letterSpacing: "-0.06em",
                }}
              >
                {stats[1].n}
              </div>
              <div style={{ marginTop: 10 }}>
                <Text type="body" color="secondary">
                  real screens and counting
                </Text>
              </div>
            </article>
          </div>
        </Section>
      </div>

      <div ref={galleryRef}>
        <Section
          style={{
            paddingTop: isMobile ? 76 : 112,
            paddingBottom: isMobile ? 76 : 112,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "end",
              justifyContent: "space-between",
              gap: 24,
              marginBottom: 38,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 610 }}>
              <Text type="supporting" color="secondary">
                STRAIGHT FROM THE CATALOG
              </Text>
              <div style={{ marginTop: 12 }}>
                <Heading
                  level={2}
                  style={{
                    fontSize: isMobile ? 32 : 48,
                    lineHeight: 1.02,
                    letterSpacing: "-0.045em",
                  }}
                >
                  Patterns found in real products.
                </Heading>
              </div>
            </div>
            <Button
              variant="ghost"
              label="Browse all evidence"
              clickAction={onBrowse}
            />
          </div>
          <div style={{ display: "grid", gap: isMobile ? 34 : 44 }}>
            {galleryWeb.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "repeat(2, minmax(0, 1fr))",
                  gap: isMobile ? 28 : 24,
                }}
              >
                {galleryWeb.map((shot) => (
                  <Shot key={shot.url} shot={shot} />
                ))}
              </div>
            )}
            {galleryPhones.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "repeat(2, minmax(0, 1fr))"
                    : "repeat(4, minmax(0, 1fr))",
                  gap: isMobile ? 16 : 24,
                  justifyItems: "center",
                }}
              >
                {galleryPhones.map((shot) => (
                  <Shot
                    key={shot.url}
                    shot={shot}
                    style={{ width: "100%", maxWidth: 232 }}
                  />
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      <div
        ref={proofRef}
        style={{
          borderBlock: "1px solid var(--color-border)",
          background: "var(--color-background-surface)",
        }}
      >
        <Section
          style={{
            paddingTop: isMobile ? 72 : 104,
            paddingBottom: isMobile ? 72 : 104,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1,
              background: "var(--color-border)",
              border: "1px solid var(--color-border)",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: isMobile ? "25px 8px" : "36px 28px",
                  textAlign: "center",
                  background: "var(--color-background-body)",
                }}
              >
                <div
                  style={{
                    fontSize: isMobile ? 29 : 46,
                    lineHeight: 1,
                    fontWeight: 800,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {stat.n}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text type="supporting" color="secondary">
                    {stat.label}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div ref={ctaRef}>
        <Section
          style={{
            paddingTop: isMobile ? 88 : 140,
            paddingBottom: isMobile ? 88 : 140,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 800 }}>
            <Heading
              level={2}
              style={{
                fontSize: isMobile ? 38 : 60,
                lineHeight: 0.98,
                letterSpacing: "-0.05em",
              }}
            >
              Your next decision starts here.
            </Heading>
            <div style={{ margin: "16px auto 30px", maxWidth: 580 }}>
              <Text type="large" color="secondary">
                Start from what already shipped. Finish with a direction your
                team can understand, defend and build.
              </Text>
            </div>
          </div>
          <PromptSearch onBrowse={onBrowse} compact={isMobile} />
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: 18,
            }}
          >
            <Button
              variant="ghost"
              label="Browse onboarding flows"
              clickAction={onBrowse}
            />
            <Button
              variant="ghost"
              label="Compare mobile patterns"
              clickAction={onBrowse}
            />
          </div>
        </Section>
      </div>

      <footer
        style={{
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-background-surface)",
        }}
      >
        <Section style={{ paddingTop: 54, paddingBottom: 42 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "minmax(240px, 1.4fr) repeat(4, minmax(130px, 1fr))",
              gap: isMobile ? "42px 24px" : 34,
              paddingBottom: 54,
            }}
          >
            <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  fontSize: 19,
                  fontWeight: 750,
                  letterSpacing: "-0.03em",
                }}
              >
                <img
                  src="/favicon.svg"
                  alt=""
                  aria-hidden="true"
                  width={24}
                  height={24}
                />{" "}
                Vitrines
              </div>
              <div style={{ maxWidth: 260, marginTop: 14 }}>
                <Text type="body" color="secondary">
                  Product research, design decisions, and living handoff in one
                  workspace.
                </Text>
              </div>
            </div>
            <div>
              <Text type="supporting" color="secondary">
                PRODUCT
              </Text>
              <div
                style={{
                  display: "grid",
                  justifyItems: "start",
                  marginTop: 10,
                }}
              >
                <Button
                  label="Apps"
                  variant="ghost"
                  size="sm"
                  onClick={onBrowse}
                  style={navLink}
                />
                <Button
                  label="Sites"
                  variant="ghost"
                  size="sm"
                  onClick={onBrowse}
                  style={navLink}
                />
                <Button
                  label="Flows"
                  variant="ghost"
                  size="sm"
                  onClick={onBrowse}
                  style={navLink}
                />
                <Button
                  label="UI elements"
                  variant="ghost"
                  size="sm"
                  onClick={onBrowse}
                  style={navLink}
                />
              </div>
            </div>
            <div>
              <Text type="supporting" color="secondary">
                WORKSPACE
              </Text>
              <div
                style={{
                  display: "grid",
                  justifyItems: "start",
                  marginTop: 10,
                }}
              >
                <Button
                  label="Projects"
                  variant="ghost"
                  size="sm"
                  onClick={onLogin}
                  style={navLink}
                />
                <Button
                  label="Canvas"
                  variant="ghost"
                  size="sm"
                  onClick={onLogin}
                  style={navLink}
                />
                <Button
                  label="Documents"
                  variant="ghost"
                  size="sm"
                  onClick={onLogin}
                  style={navLink}
                />
                <Button
                  label="Public previews"
                  variant="ghost"
                  size="sm"
                  onClick={onBrowse}
                  style={navLink}
                />
              </div>
            </div>
            <div>
              <Text type="supporting" color="secondary">
                COMPANY
              </Text>
              <div
                style={{
                  display: "grid",
                  justifyItems: "start",
                  marginTop: 10,
                }}
              >
                <Button
                  label="Pricing"
                  variant="ghost"
                  size="sm"
                  onClick={onPricing}
                  style={navLink}
                />
                <Button
                  label="Build in public"
                  variant="ghost"
                  size="sm"
                  onClick={onBuildInPublic}
                  style={navLink}
                />
                <Button
                  label="Sign in"
                  variant="ghost"
                  size="sm"
                  onClick={onLogin}
                  style={navLink}
                />
              </div>
            </div>
            <div>
              <Text type="supporting" color="secondary">
                USE CASES
              </Text>
              <div
                style={{
                  display: "grid",
                  justifyItems: "start",
                  marginTop: 10,
                }}
              >
                <Button
                  label="Product design"
                  variant="ghost"
                  size="sm"
                  onClick={onBrowse}
                  style={navLink}
                />
                <Button
                  label="Competitive research"
                  variant="ghost"
                  size="sm"
                  onClick={onBrowse}
                  style={navLink}
                />
                <Button
                  label="Feature planning"
                  variant="ghost"
                  size="sm"
                  onClick={onBrowse}
                  style={navLink}
                />
              </div>
            </div>
          </div>
          <Divider />
          <div
            style={{
              paddingTop: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <Text type="supporting" color="secondary">
              © 2026 Vitrines. Built around real product evidence.
            </Text>
            <Button
              label="Start researching"
              variant="primary"
              size="sm"
              onClick={onBrowse}
            />
          </div>
        </Section>
      </footer>
    </div>
  );
}
