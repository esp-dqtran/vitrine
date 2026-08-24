import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

type PreviewSurface = 'card' | 'full';

interface MeliusLivePreviewProps {
  componentName: 'FooterEasterEgg' | 'HeroSection' | 'MeliusFooter' | 'ModelWebGLCarousel' | 'PersonaStack' | 'SiteHeader';
  surface: PreviewSurface;
  viewport?: 'desktop' | 'mobile';
}

const PREVIEW_DIMENSIONS = {
  FooterEasterEgg: { width: 1280, height: 900 },
  HeroSection: { width: 1280, height: 900 },
  MeliusFooter: { width: 1280, height: 760 },
  ModelWebGLCarousel: { width: 1280, height: 900 },
  PersonaStack: { width: 1280, height: 933 },
  SiteHeader: { width: 230, height: 250 },
} as const;

const meliusAssetUrl = (file: string) => new URL(
  `../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/${file}`,
  import.meta.url,
).href;

const assetUrlMap = (files: readonly string[]) => Object.fromEntries(
  files.map((file) => [file, meliusAssetUrl(file)]),
);

const heroAssetUrls = {
  'c744197fe7a316ffb1a7.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/c744197fe7a316ffb1a7.webp', import.meta.url).href,
  'a70e8a1fa357d7d8b4e9.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/a70e8a1fa357d7d8b4e9.webp', import.meta.url).href,
  'f7bc251e57e3f9034df4.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/f7bc251e57e3f9034df4.webp', import.meta.url).href,
  '1c2f50a2c5c464e40073.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/1c2f50a2c5c464e40073.webp', import.meta.url).href,
  '37852bcf5c6bfaaab8ff.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/37852bcf5c6bfaaab8ff.webp', import.meta.url).href,
  '1a6e7add8a1fd085a80e.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/1a6e7add8a1fd085a80e.webp', import.meta.url).href,
  '9bbdd5eccadaf549fe64.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/9bbdd5eccadaf549fe64.webp', import.meta.url).href,
  '653bd6e4a73cbea877d0.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/653bd6e4a73cbea877d0.webp', import.meta.url).href,
  '70f8984d420f980d8880.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/70f8984d420f980d8880.webp', import.meta.url).href,
  'a2a1c53543141a5a1d56.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/a2a1c53543141a5a1d56.webp', import.meta.url).href,
  'd27bff07ce3bbfe5cfaa.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/d27bff07ce3bbfe5cfaa.webp', import.meta.url).href,
  'df6486e27575c6b99135.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/df6486e27575c6b99135.webp', import.meta.url).href,
  '170c66740407a99b8e6e.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/170c66740407a99b8e6e.webp', import.meta.url).href,
  '1bc32a267dd98ac82483.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/1bc32a267dd98ac82483.webp', import.meta.url).href,
  '892c27896e0502d9e70e.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/892c27896e0502d9e70e.webp', import.meta.url).href,
  '2604c2624531e684227c.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/2604c2624531e684227c.webp', import.meta.url).href,
  '16432f13146141542883.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/16432f13146141542883.webp', import.meta.url).href,
  '247724fee58885732724.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/247724fee58885732724.webp', import.meta.url).href,
  'afe73f171d27fc3dd0f8.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/afe73f171d27fc3dd0f8.webp', import.meta.url).href,
  'a480c428f5c7816cb9c1.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/a480c428f5c7816cb9c1.webp', import.meta.url).href,
  '3d2daf349971830b0927.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/3d2daf349971830b0927.webp', import.meta.url).href,
  'f88f24a8612b295ee20b.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/f88f24a8612b295ee20b.webp', import.meta.url).href,
  '0345cc7b45c4ceb43c1f.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/0345cc7b45c4ceb43c1f.webp', import.meta.url).href,
  '2da0635abbe3be67d2b6.webp': new URL('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/2da0635abbe3be67d2b6.webp', import.meta.url).href,
};
const easeFontUrl = new URL(
  '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/9d8bb9ce2e47c0afc606.woff2',
  import.meta.url,
).href;
const futuristFontUrl = new URL(
  '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/97186eb32c0ce53d53e6.woff2',
  import.meta.url,
).href;
const recklessFontUrl = new URL(
  '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/a662ed7b7683e32ac542.woff2',
  import.meta.url,
).href;
const footerArrowUrl = new URL(
  '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/public/assets/footer-signup-arrow.svg',
  import.meta.url,
).href;

async function loadPreviewStyles(): Promise<string> {
  const source = await import(
    '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/styles.css?raw'
  ).then((module) => module.default);

  const resolved = source
    .replaceAll('/assets/9d8bb9ce2e47c0afc606.woff2', easeFontUrl)
    .replaceAll('/assets/97186eb32c0ce53d53e6.woff2', futuristFontUrl)
    .replaceAll('/assets/a662ed7b7683e32ac542.woff2', recklessFontUrl)
    .replaceAll('/assets/footer-signup-arrow.svg', footerArrowUrl)
    .replace(':root {', ':host {');

  return `
    ${resolved}
    :host {
      display: block;
      width: var(--melius-live-width);
      height: var(--melius-live-height);
      overflow: hidden;
      font-synthesis: none;
    }
    .melius-live-root,
    .melius-live-stage {
      position: relative;
      width: var(--melius-live-width);
      height: var(--melius-live-height);
      overflow: hidden;
    }
    .melius-live-stage--models .model-webgl-section,
    .melius-live-stage--personas .personas,
    .melius-live-stage--easter-egg .footer-easter-egg {
      width: var(--melius-live-width);
      height: var(--melius-live-height);
      min-height: var(--melius-live-height);
    }
    .melius-live-stage--footer .melius-footer {
      width: var(--melius-live-width);
      min-height: var(--melius-live-height);
    }
    .melius-live-stage--header {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent !important;
      pointer-events: none;
    }
    .melius-live-stage--header .site-header {
      position: relative;
      display: block;
      width: auto;
      height: auto;
      padding: 0;
      background: transparent !important;
      pointer-events: auto;
    }
    :host([data-live-component="SiteHeader"]),
    :host([data-live-component="SiteHeader"]) .melius-live-root,
    :host([data-live-component="SiteHeader"]) .melius-live-stage--header {
      width: fit-content;
      height: fit-content;
      overflow: visible;
      background: transparent !important;
    }
    .melius-live-stage--header #melius-menu-toggle:focus,
    .melius-live-stage--header #melius-menu-toggle:focus-visible {
      outline: none;
      box-shadow: none;
    }
    :host([data-preview-viewport="desktop"]) .header-panel {
      width: 230px;
    }
    :host([data-preview-viewport="desktop"]) .header-menu {
      width: 100%;
    }
    :host([data-preview-viewport="mobile"]) .melius-live-stage--header {
      align-items: center;
    }
    :host([data-preview-viewport="mobile"]) .header-panel {
      width: 200px;
      transition: width .3s cubic-bezier(.76, 0, .24, 1);
    }
    :host([data-preview-viewport="mobile"]) .header-panel.is-open {
      width: calc(var(--melius-live-width) - 24px);
    }
    :host([data-preview-viewport="mobile"]) .header-menu {
      width: 100%;
    }
    :host([data-preview-viewport="mobile"]) .site-header nav {
      gap: 0;
      padding: 32px 16px 24px;
    }
    :host([data-preview-viewport="mobile"]) .menu-links {
      gap: 8px;
    }
    :host([data-preview-viewport="mobile"]) .site-header nav .menu-link {
      padding: 0;
      font-size: 40px;
      line-height: 1.05;
    }
    :host([data-preview-viewport="mobile"]) .menu-actions {
      display: flex;
      width: 100%;
      margin-top: 32px;
    }
    :host([data-preview-viewport="mobile"]) .menu-actions .melius-button--menu {
      height: 40px;
      flex: 0 0 auto;
      padding-inline: 14px;
    }
    :host([data-preview-viewport="mobile"]) .menu-actions .melius-button--yellow {
      display: none;
    }
  `;
}

async function loadPreviewElement(componentName: MeliusLivePreviewProps['componentName']): Promise<ReactElement> {
  if (componentName === 'HeroSection') {
    const { HeroSection } = await import(
      '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/HeroSection.jsx'
    );
    return createElement(HeroSection, { assetUrls: heroAssetUrls });
  }

  if (componentName === 'PersonaStack') {
    const [{ PersonaStack }, { personas }] = await Promise.all([
      import('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/PersonaStack.jsx'),
      import('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/App.jsx'),
    ]);
    const cards = personas.map((persona: {
      asset: string;
      copy: string;
      name: string;
      tags: string[];
      useCaseMedia: Array<{ asset: string; label: string; model: string; provider: string; type: string }>;
    }) => ({
      description: persona.copy,
      title: persona.name,
      useCases: persona.tags,
      useCaseMedia: persona.useCaseMedia.map((media) => ({ ...media, asset: meliusAssetUrl(media.asset) })),
      [persona.asset.endsWith('.webm') ? 'video' : 'image']: meliusAssetUrl(persona.asset),
    }));
    return createElement(
      'section',
      { className: 'melius-live-stage melius-live-stage--personas personas', id: 'personas' },
      createElement('h2', { className: 'sr-only' }, 'Personas'),
      createElement(PersonaStack, { assetBase: '', cards }),
    );
  }

  if (componentName === 'ModelWebGLCarousel') {
    const { MODEL_PROVIDERS, ModelWebGLCarousel } = await import(
      '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/ModelWebGLCarousel.jsx'
    );
    return createElement(
      'div',
      { className: 'melius-live-stage melius-live-stage--models' },
      createElement(ModelWebGLCarousel, {
        assetBase: '',
        assetUrls: assetUrlMap(MODEL_PROVIDERS.map(([, file]: [string, string]) => file)),
      }),
    );
  }

  if (componentName === 'MeliusFooter') {
    const { MeliusFooter } = await import(
      '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/MeliusFooter.jsx'
    );
    return createElement(
      'div',
      { className: 'melius-live-stage melius-live-stage--footer' },
      createElement(MeliusFooter, {
        assetBase: '',
        enableEasterEgg: false,
        initiallyEntered: true,
        wordmarkMaskUrl: meliusAssetUrl('a668d8cdad59095d755f.svg'),
      }),
    );
  }

  if (componentName === 'FooterEasterEgg') {
    const [{ EASTER_EGG_ASSETS, FooterEasterEgg }, { FooterDotBackground }, { MeliusScrollProvider }] = await Promise.all([
      import('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/FooterEasterEgg.jsx'),
      import('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/MeliusFooter.jsx'),
      import('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/MeliusScrollProvider.jsx'),
    ]);
    return createElement(
      'div',
      { className: 'melius-live-stage melius-live-stage--easter-egg' },
      createElement(
        'div',
        { 'aria-hidden': true, className: 'melius-footer__background' },
        createElement(FooterDotBackground),
      ),
      createElement(
        MeliusScrollProvider,
        { embedded: true },
        createElement(FooterEasterEgg, {
          assetBase: '',
          assetUrls: assetUrlMap([...EASTER_EGG_ASSETS, '782641dca23238877693.webp']),
          initiallyRevealed: true,
          viewportSize: PREVIEW_DIMENSIONS.FooterEasterEgg,
        }),
      ),
    );
  }

  const { SiteHeaderMenu } = await import(
    '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/SiteHeader.jsx'
  );
  return createElement(
    'div',
    { className: 'melius-live-stage melius-live-stage--header' },
    createElement('header', { className: 'site-header' }, createElement(SiteHeaderMenu)),
  );
}

export function MeliusLivePreview({ componentName, surface, viewport = 'desktop' }: MeliusLivePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<ReactElement | null>(null);
  const dimensions = componentName === 'SiteHeader' && viewport === 'mobile'
    ? { width: 390, height: 420 }
    : PREVIEW_DIMENSIONS[componentName];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const existingMount = shadow.querySelector<HTMLDivElement>('.melius-live-root');
    const existingStyle = shadow.querySelector<HTMLStyleElement>('style[data-melius-live-styles]');
    const nextMount = existingMount ?? document.createElement('div');
    const style = existingStyle ?? document.createElement('style');
    nextMount.className = 'melius-live-root';
    style.dataset.meliusLiveStyles = '';
    if (!existingStyle) shadow.append(style);
    if (!existingMount) shadow.append(nextMount);
    setMount(nextMount);
    setPreview(null);
    let active = true;

    Promise.all([loadPreviewStyles(), loadPreviewElement(componentName)]).then(([css, element]) => {
      if (!active) return;
      style.textContent = css;
      setPreview(element);
    });

    return () => {
      active = false;
    };
  }, [componentName]);

  return <>
    <div
      data-live-component={componentName}
      data-preview-viewport={viewport}
      data-surface={surface}
      ref={hostRef}
      style={{
        '--melius-live-height': `${dimensions.height}px`,
        '--melius-live-width': `${dimensions.width}px`,
      } as CSSProperties}
    />
    {mount && preview ? createPortal(preview, mount) : null}
  </>;
}
