import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { fetchCatalogPage } from '../useApps.ts';
import type { App } from '../types.ts';
import { AppIcon } from './AppIcon.tsx';

const APP_ICON_CATALOG_PATH = '/api/apps?facets=summary&platform=web';
const MAX_REVEAL_APP_ICONS = 24;

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
const footerArrowCssUrl = footerArrowUrl.replaceAll('"', '%22');

export interface CarouselAppIcon {
  id: string;
  name: string;
  iconUrl: string | null;
  accent: string;
}

export function catalogAppIcons(apps: readonly App[]): CarouselAppIcon[] {
  const seen = new Set<string>();
  return apps.flatMap((app) => {
    if (seen.has(app.id)) return [];
    seen.add(app.id);
    return [{
      id: app.id,
      name: app.app,
      iconUrl: app.iconUrl ?? null,
      accent: app.accent,
    }];
  }).slice(0, MAX_REVEAL_APP_ICONS);
}

const resolvedMeliusStyles = (source: string) => source
  .replaceAll('/assets/9d8bb9ce2e47c0afc606.woff2', easeFontUrl)
  .replaceAll('/assets/97186eb32c0ce53d53e6.woff2', futuristFontUrl)
  .replaceAll('/assets/a662ed7b7683e32ac542.woff2', recklessFontUrl)
  .replaceAll("url('/assets/footer-signup-arrow.svg')", `url("${footerArrowCssUrl}")`)
  .replace(':root {', ':host {');

export function DiscoverySignupReveal() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<ReactElement | null>(null);
  const [appIcons, setAppIcons] = useState<CarouselAppIcon[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchCatalogPage(APP_ICON_CATALOG_PATH, controller.signal)
      .then((page) => setAppIcons(catalogAppIcons(page.apps)))
      .catch(() => {
        if (!controller.signal.aborted) setAppIcons([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const existingMount = shadow.querySelector<HTMLDivElement>('.melius-catalog-footer-root');
    const existingStyle = shadow.querySelector<HTMLStyleElement>('style[data-melius-catalog-footer-styles]');
    const nextMount = existingMount ?? document.createElement('div');
    const style = existingStyle ?? document.createElement('style');
    nextMount.className = 'melius-catalog-footer-root';
    style.dataset.meliusCatalogFooterStyles = '';
    if (!existingStyle) shadow.append(style);
    if (!existingMount) shadow.append(nextMount);
    setMount(nextMount);

    let active = true;
    void import(
      '../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/styles.css?raw'
    ).then((module) => {
      if (!active) return;
      style.textContent = `
        ${resolvedMeliusStyles(module.default)}
        :host {
          display: block;
          width: 100%;
          overflow: hidden;
          background: #111112;
          font-synthesis: none;
        }
        .melius-catalog-footer-root {
          width: 100%;
          background: #111112;
        }
        .footer-easter-egg[data-revealed="true"] {
          height: max(100svh, 1080px);
        }
        .footer-easter-egg[data-card-variant="icon"] .footer-easter-egg__card {
          border: 1px solid rgba(255, 255, 255, .2);
          border-radius: 25%;
          background: #1d1d20;
          box-shadow: 0 18px 42px rgba(0, 0, 0, .34);
        }
        .footer-easter-egg[data-card-variant="icon"] .footer-easter-egg__card .app-icon {
          width: 100% !important;
          height: 100% !important;
          border-radius: 25% !important;
        }
        @media (max-width: 767px) {
          .footer-easter-egg[data-revealed="true"] {
            height: max(100svh, 760px);
          }
        }
      `;
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (appIcons.length === 0) {
      setPreview(null);
      return undefined;
    }
    let active = true;
    void Promise.all([
      import('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/FooterEasterEgg.jsx'),
      import('../../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/MeliusScrollProvider.jsx'),
    ]).then(([{ FooterEasterEgg }, { MeliusScrollProvider }]) => {
      if (!active) return;
      setPreview(createElement(
        MeliusScrollProvider,
        { embedded: true },
        createElement(FooterEasterEgg, {
          autoScrollOnReveal: false,
          cardItems: appIcons,
          cardVariant: 'icon',
          ctaHref: '/signin',
          ctaRel: undefined,
          ctaTarget: undefined,
          initiallyRevealed: true,
          renderCard: (app: CarouselAppIcon, index: number, metrics: { width: number }) => createElement(AppIcon, {
            accent: app.accent,
            className: 'footer-easter-egg__app-icon',
            iconUrl: app.iconUrl,
            key: `${app.id}-${index}`,
            name: app.name,
            size: metrics.width,
          }),
          showTransitionStep: false,
        }),
      ));
    });
    return () => {
      active = false;
    };
  }, [appIcons]);

  return (
    <div
      className="discovery-signup-reveal"
      data-app-icon-count={appIcons.length}
      data-discovery-signup-reveal="true"
      data-melius-source-component="FooterEasterEgg"
      ref={hostRef}
    >
      {mount && preview ? createPortal(preview, mount) : null}
    </div>
  );
}
