import {
  Fragment,
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
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AstryxMenu } from "./components/AstryxDropdown";
import { Shot, type ShotSource } from "./components/Shot";
import {
  useParallaxDrift,
  useRevealOnScroll,
  useWordRise,
} from "./useRevealOnScroll";
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

const HERO_HEADLINE = "Product research for decisions that ship.";

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

// One line of context per headline stat, same order as the stats array.
const STAT_DETAILS = [
  "real products, captured across web, iOS and Android",
  "whole journeys kept in order, not hero shots",
  "patterns preserved in their real context",
];

// Heroicons-outline paths (MIT), same 24px/1.5 stroke language as the design
// system's own icons. The core registry only ships UI chrome (chevrons,
// close, search), so the stat glyphs are inlined: grid = apps,
// stack = screens, puzzle = UI elements. The text label moves to aria-label —
// the icon replaces it visually, not semantically.
const STAT_ICONS = [
  "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z",
  "M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122",
  "M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z",
];

// Real flow, same capture set the ad kit uses — the first three public steps
// of "Resetting password" (1Password, web). The claim is the catalog's own.
const FLOW_VIGNETTE = {
  caption: "Resetting password · 12 screens · observed in 277 apps",
  screens: [1, 2, 3].map(
    (step) => `/api/catalog/flow-media/1password/web/273/18360/${step}?variant=full`,
  ),
};

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

// One lattice cell of the platform bento. Framer's card anatomy: vignette
// floating on the cell ground, a single quiet label pinned bottom-left, no
// title or body copy — the vignette is the explanation.
function BentoCell({
  label,
  onAction,
  span = 1,
  rows = 1,
  height,
  children,
}: {
  label: string;
  onAction: () => void;
  span?: number;
  /** Lattice rows are a fixed 240px; tall cells span two of them. */
  rows?: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <article
      className="hm-bento"
      style={{
        gridColumn: span === 2 ? "span 2" : undefined,
        gridRow: rows === 2 ? "span 2" : undefined,
        minHeight: height,
        position: "relative",
        overflow: "hidden",
        background: "var(--color-background-body)",
        padding: "26px 26px 60px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div>{children}</div>
      <div style={{ position: "absolute", left: 15, bottom: 13 }}>
        <Button
          variant="ghost"
          size="sm"
          label={`${label} →`}
          clickAction={onAction}
        />
      </div>
    </article>
  );
}

// Section-heading words wrapped in individual clips so useWordRise can slide
// them up on scroll. The data-split wrapper is the scroll trigger. Rendering
// is inert without JS — the initial offset is applied by the hook, never by
// CSS, so the text can never be stuck hidden.
function SplitWords({ text }: { text: string }) {
  return (
    <span data-split>
      {text.split(" ").map((word, index) => (
        <Fragment key={index}>
          <span className="hm-word-scroll">
            <span>{word}</span>
          </span>{" "}
        </Fragment>
      ))}
    </span>
  );
}

// Headline stat that counts up from zero the first time it scrolls into view.
// Parses its own display string ("1,190", "422K") so the animated number and
// the final rendered value can never disagree with the live catalog stats.
// Deliberately not behind the reduced-motion guard: a ticking number is a
// content change, not vestibular motion, and it is this band's entire point.
function StatNumber({
  value,
  index,
  isMobile,
}: {
  value: string;
  index: number;
  isMobile: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const match = value.match(/^([\d.,]+)(.*)$/);
    if (!match) return;
    const target = parseFloat(match[1].replace(/,/g, ""));
    const suffix = match[2];
    const proxy = { n: 0 };
    el.textContent = `0${suffix}`;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 92%",
      once: true,
      onEnter: () =>
        gsap.to(proxy, {
          n: target,
          duration: 2,
          // One after another, left to right — reads as the catalog tallying.
          delay: index * 0.18,
          ease: "power3.out",
          onUpdate: () => {
            el.textContent =
              Math.round(proxy.n).toLocaleString("en-US") + suffix;
          },
        }),
    });
    return () => trigger.kill();
  }, [value, index]);

  return (
    <div
      ref={ref}
      style={{
        fontSize: isMobile ? 56 : 84,
        lineHeight: 0.95,
        fontWeight: 800,
        letterSpacing: "-0.055em",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
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
      // Slight perspective tilt toward the pointer; snaps flat on leave.
      onMouseMove={(event) => {
        const box = boxRef.current;
        if (!box) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return;
        }
        const rect = box.getBoundingClientRect();
        gsap.to(box, {
          rotateX: ((event.clientY - rect.top) / rect.height - 0.5) * -5,
          rotateY: ((event.clientX - rect.left) / rect.width - 0.5) * 5,
          transformPerspective: 1000,
          duration: 0.45,
          ease: "power2.out",
          overwrite: "auto",
        });
      }}
      onMouseLeave={() => {
        const box = boxRef.current;
        if (box) {
          gsap.to(box, {
            rotateX: 0,
            rotateY: 0,
            duration: 0.6,
            ease: "power3.out",
          });
        }
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

  // Bento vignettes: two handsets and one wide browser capture, chromeless.
  const bentoPhones = take(phoneApps, 2);
  const [bentoWebApp] = take(webApps, 1);
  const bentoShots = [
    toShot(bentoPhones[0], { prefer: "phone" }),
    toShot(bentoWebApp, { prefer: "web" }),
    toShot(bentoPhones[1], { prefer: "phone" }),
  ].map((shot) => shot && { ...shot, iconUrl: null, meta: null });

  // Full-bleed mosaic (the "Shipped with Framer" pattern): every app not yet
  // used on the page becomes a chromeless tile, mixed sizes, cropped at the
  // viewport edges — the crop itself says the catalog is bigger than the
  // screen. Captions are dropped; the artifacts are the pitch.
  const mosaic = apps
    .filter((app) => !used.has(app.id))
    .map((app) => toShot(app))
    .filter((shot): shot is ShotSource => shot !== null)
    .map((shot) => ({ ...shot, iconUrl: null, meta: null }));
  const mosaicRows: ShotSource[][] = [
    mosaic.filter((_, i) => i % 2 === 0),
    mosaic.filter((_, i) => i % 2 === 1),
  ];

  const heroMediaRef = useRef<HTMLDivElement>(null);
  const storiesRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // Past the hero, the nav firms up: fully opaque ground and a soft shadow so
  // it reads as a surface once real content scrolls beneath it.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const trigger = ScrollTrigger.create({
      start: 90,
      onEnter: () =>
        gsap.to(el, {
          background:
            "color-mix(in srgb, var(--color-background-body) 97%, transparent)",
          boxShadow: "0 14px 40px rgba(0,0,0,.35)",
          duration: 0.35,
          overwrite: "auto",
        }),
      onLeaveBack: () =>
        gsap.to(el, {
          background:
            "color-mix(in srgb, var(--color-background-body) 88%, transparent)",
          boxShadow: "0 0 0 rgba(0,0,0,0)",
          duration: 0.35,
          overwrite: "auto",
        }),
    });
    return () => trigger.kill();
  }, []);

  // Marquee reacts to scroll: GSAP takes over the CSS keyframe loop so fast
  // scrolling spins the logo belt up briefly before it settles back to
  // cruising speed. Hover still pauses it.
  const marqueeTrackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const track = marqueeTrackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    track.style.animation = "none";
    const belt = gsap.to(track, {
      xPercent: -50,
      ease: "none",
      duration: 30,
      repeat: -1,
    });
    const carousel = track.parentElement;
    const pause = () =>
      gsap.to(belt, { timeScale: 0, duration: 0.4, overwrite: true });
    const resume = () =>
      gsap.to(belt, { timeScale: 1, duration: 0.4, overwrite: true });
    carousel?.addEventListener("mouseenter", pause);
    carousel?.addEventListener("mouseleave", resume);
    const trigger = ScrollTrigger.create({
      onUpdate: (self) => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 700, 2.5);
        gsap.to(belt, {
          timeScale: boost,
          duration: 0.2,
          overwrite: true,
          onComplete: () =>
            gsap.to(belt, { timeScale: 1, duration: 1.2, overwrite: true }),
        });
      },
    });
    return () => {
      trigger.kill();
      belt.kill();
      carousel?.removeEventListener("mouseenter", pause);
      carousel?.removeEventListener("mouseleave", resume);
      track.style.animation = "";
      gsap.set(track, { xPercent: 0 });
    };
  }, []);

  // Mosaic rows creep in opposite directions as the section crosses the
  // viewport — scrubbed, shallow, and never in the way of scroll progress.
  const mosaicRowARef = useRef<HTMLDivElement>(null);
  const mosaicRowBRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = [mosaicRowARef.current, mosaicRowBRef.current];
    if (rows.some((row) => !row)) return;
    const tweens = rows.map((row, index) =>
      gsap.fromTo(
        row,
        { x: index ? -110 : 0 },
        {
          x: index ? 0 : -110,
          ease: "none",
          scrollTrigger: {
            trigger: row,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        },
      ),
    );
    return () => {
      for (const tween of tweens) {
        tween.scrollTrigger?.kill();
        tween.kill();
      }
    };
  }, [apps.length]);

  useRevealOnScroll(heroMediaRef);
  // Cards cascade in instead of arriving as one slab. Keyed on the catalog so
  // the stagger re-arms once the async previews actually exist.
  // Stories stay in normal document flow (scroll always makes progress —
  // pinning made skimmers feel stuck) and slide in from alternating sides.
  useRevealOnScroll(storiesRef, {
    stagger: "article",
    axis: "alternate-x",
    key: apps.length,
  });
  // Story media drifts a few px against the scroll — depth without a camera.
  useParallaxDrift(storiesRef, {
    selector: "[data-parallax]",
    key: apps.length,
  });
  // Section headings ride up word by word as they enter.
  useWordRise(storiesRef);
  useWordRise(platformRef);
  useWordRise(galleryRef);
  useWordRise(ctaRef);
  useRevealOnScroll(platformRef, { stagger: "article", key: apps.length });
  useRevealOnScroll(galleryRef, { stagger: "figure", key: apps.length });
  useRevealOnScroll(proofRef, { stagger: "[data-stat]", key: stats[0].n });
  useRevealOnScroll(ctaRef);

  return (
    <div
      className="vitrine-page"
      style={{
        position: "relative",
        minHeight: "100vh",
        color: "var(--color-text-primary)",
        overflow: "clip",
      }}
    >
      {/* Ambient ground behind the hero — decoration only, drifts slowly. */}
      <div
        className="hm-aurora"
        aria-hidden="true"
        style={{ inset: "0 0 auto", height: "min(120vh, 1300px)" }}
      />
      <header
        ref={navRef}
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
            }}
          >
            {/* Source keeps the literal: "Product research for decisions that ship." */}
            {HERO_HEADLINE.split(" ").map((word, index) => (
              <Fragment key={index}>
                <span
                  className="hm-word"
                  style={{ animationDelay: `${0.04 + index * 0.06}s` }}
                >
                  <span>{word}</span>
                </span>{" "}
              </Fragment>
            ))}
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
          <div ref={marqueeTrackRef} className="home-logo-carousel__track">
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
                <SplitWords text="Evidence that works alongside you, not after you." />
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
                <div
                  data-parallax
                  style={{ order: !isMobile && index % 2 === 1 ? 2 : 1 }}
                >
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
                  <SplitWords text="A full product research platform." />
                </Heading>
              </div>
            </div>
            <Button
              variant="ghost"
              label="See what is inside"
              clickAction={onBrowse}
            />
          </div>
          {/* Structure studied from framer.com's "Bento Features" lattice:
              3x400 columns, hairline dividers instead of gaps, square cells
              480/240 tall, wides spanning two columns, one quiet label per
              cell at bottom-left, vignettes floating on the cell ground.
              Structure only — every vignette below is Vitrines content. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(3, minmax(0, 1fr))",
              gridAutoRows: isMobile ? undefined : 240,
              gap: 1,
              background: "var(--color-border)",
              border: "1px solid var(--color-border)",
            }}
          >
            <BentoCell
              label="Apps & sites"
              onAction={onBrowse}
              rows={isMobile ? 1 : 2}
              height={isMobile ? 300 : 480}
            >
              {bentoShots[0] && (
                <Shot
                  shot={bentoShots[0]}
                  style={{ width: "100%", maxWidth: 180, margin: "0 auto" }}
                />
              )}
            </BentoCell>
            <BentoCell
              label="Screens & flows"
              onAction={onBrowse}
              span={isMobile ? 1 : 2}
              rows={isMobile ? 1 : 2}
              height={isMobile ? 300 : 480}
            >
              {/* Fills the whole cell: tiles stretch to the available height
                  (top-anchored cover crop — vignette, not reference), caption
                  pinned beneath. */}
              <div
                style={{
                  height: isMobile ? 214 : 394,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {FLOW_VIGNETTE.screens.map((src, step) => (
                    <div
                      key={src}
                      style={{
                        position: "relative",
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        background: "#17181b",
                      }}
                    >
                      <img
                        src={src}
                        alt={`Resetting password, captured step ${step + 1}`}
                        loading="lazy"
                        decoding="async"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "top center",
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 8,
                          top: 8,
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: "rgba(10,11,13,.82)",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {step + 1}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "center" }}>
                  <Text type="supporting" color="secondary">
                    {FLOW_VIGNETTE.caption}
                  </Text>
                </div>
              </div>
            </BentoCell>
            <BentoCell
              label="UI elements"
              onAction={onBrowse}
              rows={isMobile ? 1 : 2}
              height={isMobile ? 300 : 480}
            >
              {bentoShots[2] && (
                <Shot
                  shot={bentoShots[2]}
                  style={{ width: "100%", maxWidth: 180, margin: "0 auto" }}
                />
              )}
            </BentoCell>
            <BentoCell label="Research projects" onAction={onLogin} height={240}>
              {/* The documents feature in miniature: a project document with
                  prose and an embedded flow block, the way real docs cite
                  captured evidence inline. */}
              <div
                style={{
                  maxWidth: 270,
                  margin: "0 auto",
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "#17181b",
                  padding: 13,
                  display: "grid",
                  gap: 8,
                  alignContent: "start",
                }}
              >
                <div
                  style={{
                    height: 11,
                    width: "58%",
                    borderRadius: 5,
                    background:
                      "color-mix(in srgb, var(--color-border) 30%, #c7ccd4)",
                  }}
                />
                {[0.94, 0.7].map((w) => (
                  <div
                    key={w}
                    style={{
                      height: 7,
                      width: `${w * 100}%`,
                      borderRadius: 4,
                      background:
                        "color-mix(in srgb, var(--color-border) 68%, #9aa0aa)",
                    }}
                  />
                ))}
                <div
                  style={{
                    marginTop: 3,
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "#1d1f24",
                    padding: 8,
                    display: "grid",
                    gap: 7,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 6,
                    }}
                  >
                    {FLOW_VIGNETTE.screens.map((src, step) => (
                      <div
                        key={src}
                        style={{
                          height: 42,
                          borderRadius: 6,
                          overflow: "hidden",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <img
                          src={src}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: "top center",
                            opacity: step === 2 ? 0.85 : 1,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 650, opacity: 0.8 }}>
                    ⌘ 1Password · Resetting password · steps 1–3 of 12
                  </div>
                </div>
              </div>
            </BentoCell>
            <BentoCell label="Live catalog" onAction={onBrowse} height={240}>
              <div
                style={{
                  textAlign: "center",
                  fontSize: isMobile ? 46 : 58,
                  lineHeight: 0.95,
                  fontWeight: 800,
                  letterSpacing: "-0.055em",
                  marginTop: 12,
                }}
              >
                {stats[1].n}
              </div>
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <Text type="supporting" color="secondary">
                  real screens and counting
                </Text>
              </div>
            </BentoCell>
            <BentoCell label="Living canvas" onAction={onLogin} height={240}>
              {/* Drawn vignette: two pinned captures, a note, a connector and
                  a collaborator's cursor — the canvas mid-session. */}
              <div
                style={{
                  position: "relative",
                  height: 132,
                  margin: "4px auto 0",
                  maxWidth: 260,
                }}
              >
                <svg
                  aria-hidden="true"
                  width="260"
                  height="132"
                  style={{ position: "absolute", inset: 0 }}
                >
                  <path
                    d="M84 60 C 118 30, 146 34, 172 52"
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                </svg>
                {[
                  { x: 0, y: 18, r: -5, thumb: 0 },
                  { x: 172, y: 26, r: 2, thumb: 1 },
                ].map((card) => {
                  const src = apps[card.thumb]?.screens[0]?.thumbnailUrl;
                  return (
                    <div
                      key={card.x}
                      style={{
                        position: "absolute",
                        left: card.x,
                        top: card.y,
                        width: 84,
                        height: 96,
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        background: "#17181b",
                        transform: `rotate(${card.r}deg)`,
                        boxShadow: "0 12px 30px rgba(0,0,0,.35)",
                      }}
                    >
                      {src && (
                        <img
                          src={src}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: "top center",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                {/* The note card between the two captures. */}
                <div
                  style={{
                    position: "absolute",
                    left: 88,
                    top: 0,
                    width: 80,
                    height: 66,
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "#1d1f24",
                    transform: "rotate(3deg)",
                    boxShadow: "0 12px 30px rgba(0,0,0,.35)",
                    padding: 9,
                    display: "grid",
                    gap: 6,
                    alignContent: "start",
                  }}
                >
                  {[0.85, 0.6, 0.72].map((w) => (
                    <div
                      key={w}
                      style={{
                        height: 5,
                        width: `${w * 100}%`,
                        borderRadius: 3,
                        background:
                          "color-mix(in srgb, var(--color-border) 55%, #9aa0aa)",
                      }}
                    />
                  ))}
                </div>
                {/* Collaborator cursor + comment. */}
                <div
                  style={{
                    position: "absolute",
                    left: 96,
                    top: 84,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <svg aria-hidden="true" width="13" height="17" viewBox="0 0 12 19">
                    <path
                      d="M1 1l10 9.5-4.6.3 2.8 6-2.4 1.1-2.7-6L1 15z"
                      fill="#7aa2ff"
                    />
                  </svg>
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: "#7aa2ff",
                      color: "#0b0d12",
                      fontSize: 10.5,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Why 8 steps?
                  </span>
                </div>
              </div>
            </BentoCell>
            <BentoCell label="Shareable briefs" onAction={onLogin} height={240}>
              {/* Drawn vignette: the public preview link, ready to send. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  maxWidth: 280,
                  margin: "26px auto 0",
                  padding: "9px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--color-border)",
                  background: "#17181b",
                  fontSize: 12.5,
                  color: "var(--color-text-primary)",
                }}
              >
                <span aria-hidden="true">🔗</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  vitrines.app/preview/reset-flow
                </span>
                <span
                  style={{
                    flex: "none",
                    marginLeft: "auto",
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: 0.75,
                  }}
                >
                  Copy
                </span>
              </div>
            </BentoCell>
            <BentoCell
              label="Real screens, full pages"
              onAction={onBrowse}
              span={isMobile ? 1 : 2}
              rows={isMobile ? 1 : 2}
              height={isMobile ? 300 : 480}
            >
              {bentoShots[1] && (
                <div style={{ marginRight: isMobile ? 0 : -70 }}>
                  <Shot shot={bentoShots[1]} style={{ width: "100%" }} />
                </div>
              )}
            </BentoCell>
            <BentoCell
              label="Every platform"
              onAction={onBrowse}
              rows={isMobile ? 1 : 2}
              height={isMobile ? 260 : 480}
            >
              <div
                style={{
                  textAlign: "center",
                  fontSize: isMobile ? 46 : 58,
                  lineHeight: 0.95,
                  fontWeight: 800,
                  letterSpacing: "-0.055em",
                  marginTop: 12,
                }}
              >
                {stats[0].n}
              </div>
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <Text type="supporting" color="secondary">
                  real products captured
                </Text>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 22,
                  flexWrap: "wrap",
                }}
              >
                {["Web", "iOS", "Android"].map((platform) => (
                  <span
                    key={platform}
                    style={{
                      padding: "6px 13px",
                      borderRadius: 999,
                      border: "1px solid var(--color-border)",
                      fontSize: 12,
                      fontWeight: 650,
                    }}
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </BentoCell>
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
                  <SplitWords text="Patterns found in real products." />
                </Heading>
              </div>
            </div>
            <Button
              variant="ghost"
              label="Browse all evidence"
              clickAction={onBrowse}
            />
          </div>
          <div
            style={{
              width: "100vw",
              marginLeft: "calc(50% - 50vw)",
              overflowX: isMobile ? "auto" : "hidden",
              display: "grid",
              gap: isMobile ? 14 : 20,
            }}
          >
            {mosaicRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                ref={rowIndex === 0 ? mosaicRowARef : mosaicRowBRef}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: isMobile ? 14 : 20,
                  width: "max-content",
                  // Offset rows start at different phases so the edge crops
                  // never line up between rows.
                  marginLeft: rowIndex === 0 ? -40 : -150,
                }}
              >
                {row.map((shot) => (
                  <Shot
                    key={shot.url}
                    shot={shot}
                    style={{
                      flex: "none",
                      width:
                        shot.platform === "web"
                          ? isMobile
                            ? 300
                            : 440
                          : isMobile
                            ? 128
                            : 172,
                    }}
                  />
                ))}
              </div>
            ))}
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
          <div style={{ textAlign: "center", marginBottom: isMobile ? 34 : 54 }}>
            <Text type="supporting" color="secondary">
              THE CATALOG, RIGHT NOW
            </Text>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
            }}
          >
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                data-stat
                style={{
                  padding: isMobile ? "26px 8px" : "10px 44px",
                  textAlign: "center",
                  borderLeft:
                    !isMobile && index > 0
                      ? "1px solid var(--color-border)"
                      : undefined,
                  borderTop:
                    isMobile && index > 0
                      ? "1px solid var(--color-border)"
                      : undefined,
                }}
              >
                <StatNumber value={stat.n} index={index} isMobile={isMobile} />
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    justifyContent: "center",
                    opacity: 0.7,
                  }}
                >
                  <svg
                    role="img"
                    aria-label={stat.label}
                    width={22}
                    height={22}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={STAT_ICONS[index]} />
                  </svg>
                </div>
                <div style={{ marginTop: 7, maxWidth: 260, marginInline: "auto" }}>
                  <Text type="supporting" color="secondary">
                    {STAT_DETAILS[index]}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div ref={ctaRef} style={{ position: "relative" }}>
        <div className="hm-aurora" aria-hidden="true" />
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
              <SplitWords text="Your next decision starts here." />
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
