import {
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
import { useRevealOnScroll } from "./useRevealOnScroll";
import { useCatalogPreview, useCatalogStats } from "./useCatalogPreview";

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

const STORIES = [
  {
    eyebrow: "DISCOVER WITH CONTEXT",
    title: "Start with the product, not a blank search box.",
    copy: "Browse a living catalog of real apps, sites, screens, flows, and UI patterns. Filter by platform and category without losing the product around the reference.",
    action: "Explore the library",
  },
  {
    eyebrow: "TRACE COMPLETE FLOWS",
    title: "See what happens before and after the perfect screen.",
    copy: "Follow real journeys step by step. Vitrines keeps the surrounding states visible, so your team understands how a pattern works—not only how it looks.",
    action: "Browse product flows",
  },
  {
    eyebrow: "BUILD WITH EVIDENCE",
    title: "Collect the references. Keep the reasoning attached.",
    copy: "Bring screenshots, flow steps, notes, design tokens, and product observations into one research project. The source stays one click away as ideas turn into decisions.",
    action: "Start a research project",
  },
];

const CAPABILITIES = [
  {
    eyebrow: "SEARCH",
    title: "Apps & sites",
    copy: "Find product references across web and mobile.",
  },
  {
    eyebrow: "TRACE",
    title: "Screens & flows",
    copy: "Move through journeys, states, and edge cases.",
  },
  {
    eyebrow: "INSPECT",
    title: "UI elements",
    copy: "Compare reusable patterns in their real context.",
  },
  {
    eyebrow: "ORGANIZE",
    title: "Research projects",
    copy: "Keep evidence and observations together.",
  },
  {
    eyebrow: "SYNTHESIZE",
    title: "Living canvas",
    copy: "Arrange research, notes, and team feedback.",
  },
  {
    eyebrow: "HAND OFF",
    title: "Shareable briefs",
    copy: "Publish decisions with the source still visible.",
  },
];

function ProductMedia({
  src,
  alt,
  fit = "contain",
}: {
  src: string;
  alt: string;
  fit?: "contain" | "cover";
}) {
  return (
    <div
      style={{
        height: "100%",
        overflow: "hidden",
        borderRadius: 18,
        border: "1px solid var(--color-border)",
        background: "#111214",
        boxShadow: "0 28px 80px rgba(0,0,0,.24)",
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: fit,
          objectPosition: "center",
          background: "#111214",
        }}
      />
    </div>
  );
}

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
  const catalog = useCatalogPreview();
  const statCounts = useCatalogStats();
  const realScreens = (catalog ?? [])
    .flatMap((app) =>
      app.screens
        .slice(0, 1)
        .map((screen) => ({ name: app.name, url: screen.url })),
    )
    .filter((item): item is { name: string; url: string } => Boolean(item.url))
    .slice(0, 6);
  const carouselApps = (catalog ?? [])
    .flatMap((app) => (app.iconUrl ? [{ ...app, iconUrl: app.iconUrl }] : []))
    .slice(0, 8);
  const stats = statCounts
    ? [
        { n: String(statCounts.apps), label: "apps" },
        { n: String(statCounts.screens), label: "screens" },
        { n: String(statCounts.uiElements), label: "UI elements" },
      ]
    : FALLBACK_STATS;
  const storyMedia = [
    "/landing/astryx-apps-catalog.png",
    "/landing/astryx-public-preview-real-flows.png",
    realScreens[0]?.url ?? "/landing/astryx-apps-catalog.png",
  ];
  const galleryMedia = [
    realScreens[0]?.url ?? "/landing/astryx-apps-catalog.png",
    realScreens[1]?.url ?? "/landing/astryx-public-preview-real-flows.png",
    realScreens[2]?.url ?? "/landing/astryx-apps-catalog.png",
    realScreens[3]?.url ?? "/landing/astryx-public-preview-real-flows.png",
    realScreens[4]?.url ?? "/landing/astryx-apps-catalog.png",
    realScreens[5]?.url ?? "/landing/astryx-public-preview-real-flows.png",
  ];

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
              aspectRatio: isMobile ? "4 / 3" : "16 / 9",
              objectFit: "cover",
              objectPosition: "center",
              borderRadius: isMobile ? 12 : 17,
              background: "#0f1012",
            }}
          >
            <source src="/landing/astryx-product-demo.mp4" type="video/mp4" />
          </video>
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
            RESEARCH ACROSS THE PRODUCTS PEOPLE USE
          </Text>
        </div>
        <div
          className="home-logo-carousel"
          aria-label="Products in the Vitrines research catalog"
          style={{
            borderBlock: "1px solid var(--color-border)",
            paddingBlock: isMobile ? 20 : 24,
          }}
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
              A RESEARCH PARTNER FOR THE WHOLE JOURNEY
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
                <div
                  style={{
                    order: !isMobile && index % 2 === 1 ? 2 : 1,
                    height: isMobile ? 360 : 480,
                  }}
                >
                  <ProductMedia
                    src={storyMedia[index]}
                    alt={`${story.title} in Vitrines`}
                  />
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
            {CAPABILITIES.map((item, index) => (
              <article
                key={item.title}
                style={{
                  minHeight: index === 0 || index === 4 ? 300 : 220,
                  padding: 24,
                  borderRadius: 18,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-background-body)",
                  display: "flex",
                  flexDirection: "column",
                  gridRow:
                    !isMobile && (index === 0 || index === 4)
                      ? "span 2"
                      : undefined,
                }}
              >
                <Text type="supporting" color="secondary">
                  {item.eyebrow}
                </Text>
                <div style={{ marginTop: "auto", paddingTop: 42 }}>
                  <Heading level={3}>{item.title}</Heading>
                  <div style={{ marginTop: 9 }}>
                    <Text type="body" color="secondary">
                      {item.copy}
                    </Text>
                  </div>
                </div>
              </article>
            ))}
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
                INSIDE VITRINES
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(12, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {galleryMedia.map((src, index) => (
              <div
                key={`${src}-${index}`}
                style={{
                  gridColumn: isMobile
                    ? undefined
                    : `span ${index === 0 || index === 5 ? 7 : 5}`,
                  height: isMobile
                    ? index % 3 === 0
                      ? 250
                      : 190
                    : index === 0 || index === 5
                      ? 400
                      : 300,
                }}
              >
                <ProductMedia
                  src={src}
                  alt={`Real product reference ${index + 1} in Vitrines`}
                  fit="cover"
                />
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
          <div style={{ maxWidth: 780, marginBottom: 42 }}>
            <Text type="supporting" color="secondary">
              RESEARCH YOUR TEAM CAN USE
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
                Keep the source visible when the decision leaves your desk.
              </Heading>
            </div>
            <div style={{ marginTop: 16, maxWidth: 650 }}>
              <Text type="large" color="secondary">
                Public previews and living documents make the research legible
                without handing your team a folder of disconnected screenshots.
              </Text>
            </div>
          </div>
          <div style={{ height: isMobile ? 280 : 610 }}>
            <ProductMedia
              src="/landing/astryx-public-preview-real-flows.png"
              alt="A public Vitrines product-flow preview"
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1,
              marginTop: 12,
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
                Start with evidence. Finish with a direction your team can
                understand and build.
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
