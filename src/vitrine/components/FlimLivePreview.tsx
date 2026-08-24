import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

export type FlimLiveComponentName =
  | 'FlimHeroSearchSection'
  | 'FlimWhatIsFlimSection'
  | 'FlimDatabaseScrollSection';

const DESKTOP_PREVIEWS: Record<FlimLiveComponentName, { height: number; stage: string; width: number }> = {
  FlimHeroSearchSection: { width: 1057, height: 700, stage: 'hero-search' },
  FlimWhatIsFlimSection: { width: 846, height: 1913, stage: 'what-is-flim' },
  FlimDatabaseScrollSection: { width: 1057, height: 900, stage: 'database-scroll' },
};

const MOBILE_PREVIEWS: Record<FlimLiveComponentName, { height: number; stage: string; width: number }> = {
  FlimHeroSearchSection: { width: 390, height: 520, stage: 'hero-search' },
  FlimWhatIsFlimSection: { width: 390, height: 1077, stage: 'what-is-flim' },
  FlimDatabaseScrollSection: { width: 390, height: 1800, stage: 'database-scroll' },
};

const assetBase = '../../../artifacts/downloads/flim.ai/2026-08-23-home/reverse-engineering/selected-components-suite/public/assets';
const assetModules = typeof import.meta.glob === 'function'
  ? import.meta.glob(
      '../../../artifacts/downloads/flim.ai/2026-08-23-home/reverse-engineering/selected-components-suite/public/assets/**/*',
      { eager: true, import: 'default', query: '?url' },
    ) as Record<string, string>
  : {};

function assetUrl(path: string): string {
  const url = assetModules[`${assetBase}/${path}`];
  return url ?? new URL(`${assetBase}/${path}`, import.meta.url).href;
}

const heroImageNames = {
  'Knight on a Horse': [
    '695bc6699e9ebf7bc1099cad_knight-1.avif', '695bc6699e9ebf7bc1099c9e_knight-2.avif',
    '695bc6699e9ebf7bc1099c50_knight-3.avif', '695bc6699e9ebf7bc1099ca2_knight-4.avif',
    '695bc6699e9ebf7bc1099c51_knight-5.avif', '695bc6699e9ebf7bc1099ca3_knight-6.avif',
    '695bc6699e9ebf7bc1099cc7_knight-7.avif', '695bc6699e9ebf7bc1099cb0_knight-8.avif',
    '695bc6699e9ebf7bc1099c52_knight-9.avif', '695bc6699e9ebf7bc1099c53_knight-10.avif',
  ],
  'Reflections on the Water': [
    '695bc6699e9ebf7bc1099caf_water-1.avif', '695bc6699e9ebf7bc1099c78_water-2.avif',
    '695bc6699e9ebf7bc1099cbf_water-3.avif', '695bc6699e9ebf7bc1099c54_water-4.avif',
    '695bc6699e9ebf7bc1099c56_water-5.avif', '695bc6699e9ebf7bc1099cc1_water-6.avif',
    '695bc6699e9ebf7bc1099c55_water-7.avif', '695bc6699e9ebf7bc1099cc4_water-8.avif',
    '695bc6699e9ebf7bc1099c7c_water-9.avif', '695bc6699e9ebf7bc1099ca4_water-10.avif',
  ],
  'Black and white film': [
    '695bc6699e9ebf7bc1099cc3_film-1.avif', '695bc6699e9ebf7bc1099c59_film-2.avif',
    '695bc6699e9ebf7bc1099c7b_film-3.avif', '695bc6699e9ebf7bc1099c5a_film-4.avif',
    '695bc6699e9ebf7bc1099cc2_film-5.avif', '695bc6699e9ebf7bc1099ca9_film-6.avif',
    '695bc6699e9ebf7bc1099c5e_film-7.avif', '695bc6699e9ebf7bc1099c5d_film-8.avif',
    '695bc6699e9ebf7bc1099c5c_film-9.avif', '695bc6699e9ebf7bc1099cb9_film-10.avif',
  ],
  'Quiet moments': [
    '695bc6699e9ebf7bc1099cba_quiet-1.avif', '695bc6699e9ebf7bc1099c57_quiet-2.avif',
    '695bc6699e9ebf7bc1099c58_quiet-3.avif', '695bc6699e9ebf7bc1099c7f_quiet-4.avif',
    '695bc6699e9ebf7bc1099c80_quiet-5.avif', '695bc6699e9ebf7bc1099c5b_quiet-6.avif',
    '695bc6699e9ebf7bc1099c77_quiet-7.avif', '695bc6699e9ebf7bc1099c79_quiet-8.avif',
    '695bc6699e9ebf7bc1099ca0_quiet-9.avif', '695bc6699e9ebf7bc1099cae_quiet-10.avif',
  ],
} as const;

const swizzyUrl = assetUrl('fonts/Swizzy-Medium.woff2');
const monoUrl = assetUrl('fonts/PPNeueMontrealMono-Book.woff2');

const previewCss = `
@font-face { font-family: "Flim Swizzy"; src: url("${swizzyUrl}") format("woff2"); font-weight: 500; font-display: swap; }
@font-face { font-family: "Flim Mono"; src: url("${monoUrl}") format("woff2"); font-weight: 400; font-display: swap; }
:host {
  display: block;
  width: var(--flim-live-width);
  height: var(--flim-live-height);
  overflow: hidden;
  background: #f5f5f5;
  font-synthesis: none;
}
:host([data-preview-surface="full"]) { overflow: visible; }
.flim-live-root,
.flim-live-stage {
  position: relative;
  width: var(--flim-live-width);
  height: var(--flim-live-height);
  overflow: hidden;
}
.flim-live-root.is-full { overflow: visible; }
`;

async function loadPreviewStyles(): Promise<string> {
  const sourceCss = await import(
    '../../../artifacts/downloads/flim.ai/2026-08-23-home/reverse-engineering/selected-components-suite/src/styles.css?raw'
  ).then((module) => module.default);
  return `${sourceCss}\n${previewCss}`;
}

async function loadComponent(componentName: FlimLiveComponentName, surface: 'card' | 'full'): Promise<ReactElement> {
  switch (componentName) {
    case 'FlimHeroSearchSection': {
      const module = await import('../../../artifacts/downloads/flim.ai/2026-08-23-home/reverse-engineering/selected-components-suite/src/components/FlimHeroSearchSection.jsx');
      return createElement(module.FlimHeroSearchSection, {
        groups: Object.entries(heroImageNames).map(([term, names]) => ({
          term,
          images: names.map((name) => assetUrl(`hero/${name}`)),
        })),
        onSearch: () => undefined,
      });
    }
    case 'FlimWhatIsFlimSection': {
      const module = await import('../../../artifacts/downloads/flim.ai/2026-08-23-home/reverse-engineering/selected-components-suite/src/components/FlimWhatIsFlimSection.jsx');
      return createElement(module.FlimWhatIsFlimSection, {
        introHeaderUrl: assetUrl('what-is-flim/intro-header.svg'),
        imageUrls: [1, 3, 2, 4].map((index) => assetUrl(`what-is-flim/intro-image-${index}.avif`)),
        mobileImagesUrl: assetUrl('what-is-flim/intro-images-mobile.avif'),
        platformIconUrl: assetUrl('what-is-flim/platform-icon.svg'),
        platformUrl: assetUrl('what-is-flim/intro-platform.avif'),
        previewMode: surface,
      });
    }
    case 'FlimDatabaseScrollSection': {
      const module = await import('../../../artifacts/downloads/flim.ai/2026-08-23-home/reverse-engineering/selected-components-suite/src/components/FlimDatabaseScrollSection.jsx');
      return createElement(module.FlimDatabaseScrollSection, {
        headerUrl: assetUrl('database/search-header.svg'),
        mobileImagesUrl: assetUrl('database/search-images-mobile.avif'),
        platformImageUrl: assetUrl('database/search-platform.avif'),
        previewMode: surface === 'card' ? 'overview' : 'full',
        searchImageUrl: assetUrl('database/search-image.avif'),
      });
    }
  }
}

export function FlimLivePreview({
  componentName,
  surface = 'card',
}: {
  componentName: FlimLiveComponentName;
  surface?: 'card' | 'full';
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [element, setElement] = useState<ReactElement | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
  const basePreview = (mobile ? MOBILE_PREVIEWS : DESKTOP_PREVIEWS)[componentName];
  const preview = componentName === 'FlimDatabaseScrollSection'
    ? surface === 'full'
      ? { ...basePreview, height: mobile ? 1800 : 2200 }
      : { ...basePreview, width: 2114, height: 900 }
    : basePreview;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const update = () => setMobile(surface === 'full' && media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [surface]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const existingStyle = shadowRoot.querySelector<HTMLStyleElement>('style[data-flim-live-styles]');
    const existingNode = shadowRoot.querySelector<HTMLDivElement>('.flim-live-root');
    const style = existingStyle ?? document.createElement('style');
    const node = existingNode ?? document.createElement('div');
    style.dataset.flimLiveStyles = '';
    node.className = `flim-live-root flim-live-stage flim-live-stage--${preview.stage}${surface === 'full' ? ' is-full' : ''}`;
    if (!existingStyle) shadowRoot.append(style);
    if (!existingNode) shadowRoot.append(node);
    setMountNode(node);

    let cancelled = false;
    void loadPreviewStyles().then((styles) => {
      if (!cancelled) style.textContent = styles;
    });
    return () => { cancelled = true; };
  }, [componentName, preview.stage, surface]);

  useEffect(() => {
    let cancelled = false;
    setElement(null);
    void loadComponent(componentName, surface).then((nextElement) => {
      if (!cancelled) setElement(nextElement);
    });
    return () => { cancelled = true; };
  }, [componentName, surface]);

  return (
    <div
      aria-label={`${componentName} live component`}
      data-flim-live-component={componentName}
      data-flim-preview-mode={componentName === 'FlimDatabaseScrollSection' && surface === 'card' ? 'overview' : surface}
      data-preview-surface={surface}
      ref={hostRef}
      style={{
        '--flim-live-height': `${preview.height}px`,
        '--flim-live-width': `${preview.width}px`,
        height: preview.height,
        width: preview.width,
      } as CSSProperties}
    >
      {mountNode && element ? createPortal(element, mountNode) : null}
    </div>
  );
}
