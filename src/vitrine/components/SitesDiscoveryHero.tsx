import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { appCatalogRequestPath, fetchCatalogPage } from '../useApps.ts';
import { MeliusLivePreview } from './MeliusLivePreview.tsx';

const HERO_WIDTH = 1280;
const HERO_HEIGHT = 900;
const HERO_IMAGE_COUNT = 24;
const HERO_HEADLINE_SOURCE_TOP = 251;
const HERO_HEADLINE_SAFE_TOP = 32;

export const SITES_HERO_ICON_TILE_STYLE = {
  background: '#1f1f22',
  border: '#494d53',
  borderWidth: 8,
  cornerRadius: 112,
  iconInset: 64,
  size: 512,
} as const;

interface HeroIconApp {
  iconUrl?: string | null;
}

export function selectSitesHeroAppIconUrls(
  apps: readonly HeroIconApp[],
  limit = HERO_IMAGE_COUNT,
): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();

  for (const app of apps) {
    const url = app.iconUrl?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    selected.push(url);
    if (selected.length === limit) break;
  }

  return selected;
}

export function sitesHeroLayout(frameWidth: number, frameHeight: number) {
  const scale = Math.max(
    frameWidth / HERO_WIDTH,
    frameHeight / HERO_HEIGHT,
  );
  const centeredTop = (frameHeight - HERO_HEIGHT * scale) / 2;
  const headlineSafeTop = HERO_HEADLINE_SAFE_TOP - HERO_HEADLINE_SOURCE_TOP * scale;

  return {
    scale,
    top: Math.max(centeredTop, headlineSafeTop),
  };
}

function roundedSquarePath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, size, size, radius);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not render the App icon tile.'));
    }, 'image/webp', 0.92);
  });
}

async function createAppIconTileUrl(iconUrl: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(iconUrl, { signal });
  if (!response.ok) throw new Error(`Could not load App icon (${response.status}).`);

  const bitmap = await createImageBitmap(await response.blob());
  const {
    background,
    border,
    borderWidth,
    cornerRadius,
    iconInset,
    size,
  } = SITES_HERO_ICON_TILE_STYLE;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Could not create the App icon tile canvas.');
  }

  canvas.width = size;
  canvas.height = size;

  const edgeInset = borderWidth / 2;
  roundedSquarePath(context, edgeInset, edgeInset, size - borderWidth, cornerRadius);
  context.fillStyle = background;
  context.fill();
  context.lineWidth = borderWidth;
  context.strokeStyle = border;
  context.stroke();

  const iconSize = size - iconInset * 2;
  const iconRadius = Math.round(iconSize * 0.25);
  const scale = Math.max(iconSize / bitmap.width, iconSize / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;

  context.save();
  roundedSquarePath(context, iconInset, iconInset, iconSize, iconRadius);
  context.clip();
  context.drawImage(
    bitmap,
    iconInset + (iconSize - drawWidth) / 2,
    iconInset + (iconSize - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  context.restore();
  bitmap.close();

  return URL.createObjectURL(await canvasBlob(canvas));
}

export function SitesDiscoveryHero() {
  const frameRef = useRef<HTMLElement>(null);
  const [{ scale, top }, setLayout] = useState({ scale: 1, top: 0 });
  const [appIconUrls, setAppIconUrls] = useState<string[]>([]);
  const [appIconsReady, setAppIconsReady] = useState(false);
  const [iconTreatment, setIconTreatment] = useState<'source' | 'tile' | 'tile-with-fallbacks'>('source');

  useEffect(() => {
    const controller = new AbortController();
    const generatedUrls: string[] = [];
    fetchCatalogPage(appCatalogRequestPath('', 'web'), controller.signal)
      .then(async ({ apps }) => {
        const sourceUrls = selectSitesHeroAppIconUrls(apps);
        const tiles = await Promise.all(sourceUrls.map(async (iconUrl) => {
          try {
            const tileUrl = await createAppIconTileUrl(iconUrl, controller.signal);
            generatedUrls.push(tileUrl);
            return { generated: true, url: tileUrl };
          } catch {
            return { generated: false, url: iconUrl };
          }
        }));
        if (controller.signal.aborted) return;
        setAppIconUrls(tiles.map(({ url }) => url));
        setIconTreatment(tiles.every(({ generated }) => generated) ? 'tile' : 'tile-with-fallbacks');
        setAppIconsReady(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAppIconsReady(true);
      });
    return () => {
      controller.abort();
      generatedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const fitHero = () => {
      setLayout(sitesHeroLayout(frame.clientWidth, frame.clientHeight));
    };

    fitHero();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(fitHero);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={frameRef}
      aria-label="Site inspiration"
      className="sites-discovery-hero"
      data-sites-discovery-hero="true"
      data-sites-hero-height="shared"
      data-sites-hero-icon-treatment={iconTreatment}
      style={{
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: `${HERO_HEIGHT}px`,
          left: '50%',
          position: 'absolute',
          top: `${top}px`,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
          width: `${HERO_WIDTH}px`,
        } as CSSProperties}
      >
        <MeliusLivePreview
          appearance="vitrines-dark"
          componentName="HeroSection"
          heroImageUrls={appIconUrls}
          heroImagesReady={appIconsReady}
          surface="full"
        />
      </div>
    </section>
  );
}
