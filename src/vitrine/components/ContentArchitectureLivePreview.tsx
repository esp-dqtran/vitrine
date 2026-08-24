import { createElement, useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

type PreviewSurface = 'card' | 'full';

interface ContentArchitectureLivePreviewProps {
  componentName: string;
  surface: PreviewSurface;
}

interface StudioMinimapProps {
  armed: boolean;
  onToggle: () => void;
  scanRoot?: { current: HTMLDivElement | null };
}

const PREVIEW_DIMENSIONS: Record<string, { width: number; height: number }> = {
  AsciiShowcaseCard: { width: 960, height: 600 },
  ClosingAsciiPanel: { width: 1280, height: 540 },
  CommonProblemsPanel: { width: 1280, height: 620 },
  FeaturesSection: { width: 1280, height: 900 },
  GlyphField: { width: 1280, height: 900 },
  RepoExplorer: { width: 1280, height: 900 },
  TestimonialsCarousel: { width: 1280, height: 800 },
  ShowcaseSection: { width: 1280, height: 900 },
  SpiralScene: { width: 1000, height: 900 },
  StudioModeLauncher: { width: 960, height: 540 },
};

const geistSansUrl = new URL(
  '../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/public/assets/geist-sans.woff2',
  import.meta.url,
).href;
const geistMonoUrl = new URL(
  '../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/public/assets/geist-mono.woff2',
  import.meta.url,
).href;

const CLOSING_ASCII = String.raw` /$$$$$$$$ /$$                                                       /$$            /$$$$$$              /$$
|__  $$__/| $$                                                      | $$           /$$__  $$            | $$
   | $$   | $$$$$$$   /$$$$$$        /$$$$$$$   /$$$$$$  /$$   /$$ /$$$$$$        |__/  \ $$        /$$$$$$$  /$$$$$$  /$$   /$$  /$$$$$$$
   | $$   | $$__  $$ /$$__  $$      | $$__  $$ /$$__  $$|  $$ /$$/|_  $$_/           /$$$$$/       /$$__  $$ |____  $$| $$  | $$ /$$_____/
   | $$   | $$  \ $$| $$$$$$$$      | $$  \ $$| $$$$$$$$ \  $$$$/   | $$            |___  $$      | $$  | $$  /$$$$$$$| $$  | $$|  $$$$$$
   | $$   | $$  | $$| $$_____/      | $$  | $$| $$_____/  >$$  $$   | $$ /$$       /$$  \ $$      | $$  | $$ /$$__  $$| $$  | $$ \____  $$
   | $$   | $$  | $$|  $$$$$$$      | $$  | $$|  $$$$$$$ /$$/\  $$  |  $$$$/      |  $$$$$$/      |  $$$$$$$|  $$$$$$$|  $$$$$$$ /$$$$$$$/
   |__/   |__/  |__/ \_______/      |__/  |__/ \_______/|__/  \__/   \___/         \______/        \_______/ \_______/ \____  $$|_______/
                                                                                                                       /$$  | $$
                                                                                                                      |  $$$$$$/
                                                                                                                       \______/


  /$$$$$$   /$$$$$$   /$$$$$$        /$$   /$$  /$$$$$$  /$$   /$$  /$$$$$$   /$$$$$$$
 |____  $$ /$$__  $$ /$$__  $$      | $$  | $$ /$$__  $$| $$  | $$ /$$__  $$ /$$_____/
  /$$$$$$$| $$  \__/| $$$$$$$$      | $$  | $$| $$  \ $$| $$  | $$| $$  \__/|  $$$$$$
 /$$__  $$| $$      | $$_____/      | $$  | $$| $$  | $$| $$  | $$| $$       \____  $$
|  $$$$$$$| $$      |  $$$$$$$      |  $$$$$$$|  $$$$$$/|  $$$$$$/| $$       /$$$$$$$//$$
 \_______/|__/       \_______/       \____  $$ \______/  \______/ |__/      |_______/|__/
                                     /$$  | $$
                                    |  $$$$$$/
                                     \______/                                                                                             `;

function StudioModeLauncherPreview({
  Component,
}: {
  Component: ComponentType<StudioMinimapProps>;
}) {
  const [armed, setArmed] = useState(false);
  const scanRoot = useRef<HTMLDivElement>(null);
  return (
    <div className="ca-live-stage ca-live-stage--studio" ref={scanRoot}>
      <div className="ca-live-studio-document" data-page-builder-section="heroSection">
        <p data-studio-field="eyebrow">Built for agentic development.</p>
        <h2 data-studio-field="title">The Sanity setup agents don&apos;t reinvent.</h2>
        <p data-studio-field="appRichText">Every run invents a new one, none decided.</p>
        <button data-studio-field="action" type="button">Get access</button>
      </div>
      <Component armed={armed} onToggle={() => setArmed((value) => !value)} scanRoot={scanRoot} />
    </div>
  );
}

async function loadPreviewStyles(): Promise<string> {
  const [page, glyph, spiral, showcase] = await Promise.all([
    import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/page.css?raw').then((module) => module.default),
    import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/recovered/glyph/GlyphField.css?raw').then((module) => module.default),
    import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/recovered/spiral/SpiralScene.css?raw').then((module) => module.default),
    import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/ShowcaseCard.css?raw').then((module) => module.default),
  ]);

  return `
    @font-face { font-family: GeistSans; src: url("${geistSansUrl}") format("woff2"); font-weight: 100 900; font-display: swap; }
    @font-face { font-family: GeistMono; src: url("${geistMonoUrl}") format("woff2"); font-weight: 100 900; font-display: swap; }
    :host {
      --black: #232323;
      --off-white: #f1eee7;
      --orange: #ff9100;
      --font-sans: GeistSans, ui-sans-serif, system-ui, sans-serif;
      --font-mono: GeistMono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --fluid-slope: calc((100vw - 375px) / (1600 - 375));
      display: block;
      width: var(--ca-live-width);
      min-height: var(--ca-live-height);
      color: var(--black);
      background: var(--off-white);
      font-family: var(--font-sans);
      font-synthesis: none;
    }
    .ca-live-root {
      position: relative;
      width: var(--ca-live-width);
      min-height: var(--ca-live-height);
      overflow: visible;
      background: var(--off-white);
      transform: translateZ(0);
    }
    :host([data-surface="card"]) .ca-live-root {
      height: var(--ca-live-height);
      overflow: hidden;
    }
    :host([data-live-component="CommonProblemsPanel"]),
    :host([data-live-component="CommonProblemsPanel"]) .ca-live-root,
    :host([data-live-component="ClosingAsciiPanel"]),
    :host([data-live-component="ClosingAsciiPanel"]) .ca-live-root,
    :host([data-live-component="RepoExplorer"]),
    :host([data-live-component="RepoExplorer"]) .ca-live-root,
    :host([data-live-component="TestimonialsCarousel"]),
    :host([data-live-component="TestimonialsCarousel"]) .ca-live-root {
      background: transparent;
    }
    :host([data-live-component="TestimonialsCarousel"]) .ca-live-root {
      display: flex;
      align-items: center;
      color: #fff;
    }
    .ca-live-stage--spiral {
      width: var(--ca-live-width);
      height: var(--ca-live-height);
      background: var(--black);
    }
    .ca-live-stage--glyph {
      width: var(--ca-live-width);
      height: var(--ca-live-height);
      background: var(--black);
    }
    .ca-live-stage--closing {
      display: grid;
      width: var(--ca-live-width);
      height: var(--ca-live-height);
      place-items: center;
      padding: 40px;
      background: transparent;
    }
    .ca-live-stage--closing .closing-window {
      width: min(100%, 1120px);
    }
    .ca-live-stage--studio {
      position: relative;
      width: var(--ca-live-width);
      height: var(--ca-live-height);
      background: var(--off-white);
    }
    .ca-live-studio-document {
      display: flex;
      min-height: var(--ca-live-height);
      flex-direction: column;
      justify-content: center;
      gap: 24px;
      padding: 72px;
    }
    .ca-live-studio-document h2 {
      max-width: 720px;
      font-size: 64px;
      font-weight: 500;
      line-height: 1;
    }
    .ca-live-studio-document p {
      max-width: 620px;
      color: #5b5a56;
      font-size: 18px;
    }
    .ca-live-studio-document button {
      width: max-content;
      padding: 16px 24px;
      border: 0;
      border-radius: 4px;
      background: var(--black);
      color: #fff;
      font-family: var(--font-mono);
      text-transform: uppercase;
    }
    .ca-live-stage--problems {
      display: flex;
      min-height: var(--ca-live-height);
      align-items: center;
      padding: 0;
      background: transparent;
    }
    .common-problems-panel {
      width: 100%;
    }
    .ca-live-stage--showcase-card {
      width: var(--ca-live-width);
      height: var(--ca-live-height);
      padding: 30px;
      background: var(--black);
    }
    ${page}
    ${glyph}
    ${spiral}
    ${showcase}
  `;
}

async function loadPreviewElement(componentName: string): Promise<ReactElement> {
  switch (componentName) {
    case 'AsciiShowcaseCard': {
      const [componentModule, contentModule] = await Promise.all([
        // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
        import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/AsciiShowcaseCard.jsx'),
        import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/content.json'),
      ]);
      const AsciiShowcaseCard = componentModule.AsciiShowcaseCard as ComponentType<{
        href: string;
        imageAlt: string;
        imageSrc: string;
        studioIndex: number;
        title: string;
      }>;
      const content = contentModule.default as { showcase: Array<{ alt: string; href: string; title: string }> };
      const item = content.showcase[5] ?? content.showcase[0]!;
      const imageSrc = new URL(
        '../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/public/assets/serve-robotics.avif',
        import.meta.url,
      ).href;
      return (
        <div className="ca-live-stage--showcase-card">
          <AsciiShowcaseCard
            href={item.href}
            imageAlt={item.alt}
            imageSrc={imageSrc}
            studioIndex={5}
            title={item.title}
          />
        </div>
      );
    }
    case 'CommonProblemsPanel': {
      // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
      const module = await import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/ProblemSection.jsx');
      const Panel = module.CommonProblemsPanel as ComponentType<{ className?: string }>;
      return (
        <div className="ca-live-stage--problems">
          <Panel className="common-problems-panel" />
        </div>
      );
    }
    case 'ClosingAsciiPanel': {
      // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
      const module = await import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/ClosingSection.jsx');
      const ClosingAsciiPanel = module.ClosingAsciiPanel as ComponentType<{ ascii: string }>;
      return <div className="ca-live-stage--closing"><ClosingAsciiPanel ascii={CLOSING_ASCII} /></div>;
    }
    case 'FeaturesSection': {
      // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
      const module = await import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/FeaturesSection.jsx');
      return createElement(module.FeaturesSection as ComponentType);
    }
    case 'GlyphField': {
      // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
      const module = await import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/recovered/glyph/GlyphField.jsx');
      const GlyphField = module.GlyphField as ComponentType;
      return <div className="ca-live-stage--glyph"><GlyphField /></div>;
    }
    case 'RepoExplorer': {
      // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
      const module = await import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/RepoExplorer.jsx');
      const RepoExplorer = module.RepoExplorer as ComponentType;
      return <RepoExplorer />;
    }
    case 'TestimonialsCarousel': {
      // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
      const module = await import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/ReviewsSection.jsx');
      const TestimonialsCarousel = module.TestimonialsCarousel as ComponentType<{ reviews: Array<{ image: string; name: string; quote: string; role: string }> }>;
      const reviews = [
        {
          quote: "We shipped the Good Fella site on an early version and it saved us tons of time. Six months in, we're still building pages and sections in an afternoon without fighting the setup.",
          name: 'Julian Fella',
          role: 'Co-Founder, Good Fella',
          image: new URL('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/public/assets/julian.avif', import.meta.url).href,
        },
        {
          quote: "Edo and I ran a client project on this together. The plumbing was already handled, so the week we'd normally lose to setup went into the creative work the client actually remembers.",
          name: 'Elliott Mangham',
          role: 'Founder & Frontend Engineer',
          image: new URL('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/public/assets/elliott.avif', import.meta.url).href,
        },
        {
          quote: "I opened the fetch layer and found the revalidation problem I'd burned two days on last project, already solved and committed. That one folder paid for the whole thing, and the rest is six years of decisions I'd have made the slow way.",
          name: 'Malik Kotb',
          role: 'Web Designer & Engineer',
          image: new URL('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/public/assets/malik.jpg', import.meta.url).href,
        },
      ];
      return <TestimonialsCarousel reviews={reviews} />;
    }
    case 'ShowcaseSection': {
      const [componentModule, contentModule] = await Promise.all([
        // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
        import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/ShowcaseSection.jsx'),
        import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/content.json'),
      ]);
      const ShowcaseSection = componentModule.ShowcaseSection as ComponentType<{ items: unknown[] }>;
      const content = contentModule.default as { showcase: unknown[] };
      return <ShowcaseSection items={content.showcase} />;
    }
    case 'SpiralScene': {
      // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
      const module = await import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/recovered/spiral/SpiralScene.jsx');
      const SpiralScene = module.SpiralScene as ComponentType;
      return <div className="ca-live-stage--spiral"><SpiralScene /></div>;
    }
    case 'StudioModeLauncher': {
      // @ts-expect-error The downloaded reconstruction is JavaScript and is loaded as source evidence.
      const module = await import('../../../artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/StudioChrome.jsx');
      const StudioMinimap = module.StudioMinimap as ComponentType<StudioMinimapProps>;
      return <StudioModeLauncherPreview Component={StudioMinimap} />;
    }
    default:
      throw new Error(`No reconstructed preview is connected for ${componentName}.`);
  }
}

export function ContentArchitectureLivePreview({
  componentName,
  surface,
}: ContentArchitectureLivePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const dimensions = PREVIEW_DIMENSIONS[componentName] ?? { width: 1280, height: 720 };
  const responsiveCard = surface === 'card' && ['GlyphField', 'SpiralScene', 'TestimonialsCarousel'].includes(componentName);
  const previewWidth = responsiveCard
    ? '100%'
    : surface === 'full'
    ? `min(${dimensions.width}px, 1056px, calc(100vw - 112px))`
    : `${dimensions.width}px`;
  const previewHeight = responsiveCard ? '100%' : `${dimensions.height}px`;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let cancelled = false;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    const mount = document.createElement('div');
    let mountedRoot: ReturnType<typeof createRoot> | null = null;
    mount.className = 'ca-live-root';
    shadow.replaceChildren(style, mount);
    setError(null);

    Promise.all([loadPreviewStyles(), loadPreviewElement(componentName)])
      .then(([css, element]) => {
        if (cancelled) return;
        style.textContent = css;
        mountedRoot = createRoot(mount);
        mountedRoot.render(element);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : 'Unable to load reconstructed component.';
        setError(message);
      });

    return () => {
      cancelled = true;
      queueMicrotask(() => {
        mountedRoot?.unmount();
        if (mount.parentNode === shadow) shadow.replaceChildren();
      });
    };
  }, [componentName, dimensions.height, dimensions.width, surface]);

  return (
    <div
      className="content-architecture-live-preview"
      data-live-component={componentName}
      data-surface={surface}
      ref={hostRef}
      style={{
        '--ca-live-height': previewHeight,
        '--ca-live-width': previewWidth,
        height: surface === 'card' ? previewHeight : undefined,
        minHeight: responsiveCard ? '100%' : dimensions.height,
        width: previewWidth,
      } as CSSProperties}
    >
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
