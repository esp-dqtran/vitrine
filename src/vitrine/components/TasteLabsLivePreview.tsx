import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

export type TasteLabsLiveComponentName =
  | 'TasteHeroSection'
  | 'TasteChallengeCarouselSection'
  | 'TasteMissionSection'
  | 'TasteStackSection'
  | 'TasteSwipeFooter';

const COMPONENT_PREVIEWS: Record<TasteLabsLiveComponentName, { height: number; stage: string; width: number }> = {
  TasteHeroSection: { width: 1280, height: 880, stage: 'hero' },
  TasteChallengeCarouselSection: { width: 1280, height: 780, stage: 'challenge' },
  TasteMissionSection: { width: 1280, height: 650, stage: 'mission' },
  TasteStackSection: { width: 1280, height: 970, stage: 'stack' },
  TasteSwipeFooter: { width: 1280, height: 720, stage: 'footer' },
};

const MOBILE_COMPONENT_PREVIEWS: Record<TasteLabsLiveComponentName, { height: number; stage: string; width: number }> = {
  TasteHeroSection: { width: 390, height: 720, stage: 'hero' },
  TasteChallengeCarouselSection: { width: 390, height: 489, stage: 'challenge' },
  TasteMissionSection: { width: 390, height: 820, stage: 'mission' },
  TasteStackSection: { width: 390, height: 1420, stage: 'stack' },
  TasteSwipeFooter: { width: 390, height: 660, stage: 'footer' },
};

function resolveTasteAsset(path: string): string {
  return `/tastelabs-component-assets${path}`;
}

const animationDataCache = new Map<string, Promise<ArrayBuffer | undefined>>();

function loadAnimationData(url: string): Promise<ArrayBuffer | undefined> {
  const cached = animationDataCache.get(url);
  if (cached) return cached;
  const pending = fetch(url)
    .then((response) => response.ok ? response.arrayBuffer() : undefined)
    .catch(() => undefined);
  animationDataCache.set(url, pending);
  return pending;
}

const challengeImageNames = [
  '6a50cb1142b609298bb2d75d_448c933e9deebbb2156d4ae1d58d188c_Frame%201171280140.avif',
  '6a50cb117f04b11c29aea486_ab1e2f502f4f5a9711ee55518b286ae9_Frame%201171280141.avif',
  '6a50cb117fba4e209a4c71ea_4aa8e137ef5595f1cdfce591c930ae61_Frame%201171280139.avif',
  '6a50cb1142b609298bb2d74b_093da6815205c58ef56f0fb47c1e9da8_Frame%201171280138.avif',
  '6a50cb119b397fb853e34b86_de05d9ebd3cc9297bd79ca13f63bbd86_Frame%201171280137.avif',
  '6a50cb112dd15c70d1860836_ee4e1d2628004fdd3fa05ce3cfacfdb4_Frame%201171280131.png',
  '6a50cb11f8dc9bd6d894b70b_32646e38172599d705d461d760c24fbe_Frame%201171280132.avif',
  '6a50cb115e1240f3d257f84b_3348cbd99d403a1c72c8cbc60dca1305_Frame%201171280136.avif',
  '6a50cb11dd8c37dcbb6096e9_05124003ce29eb0bf8befdc97f0f1022_Frame%201171280129.avif',
  '6a50cb115840e0a456bc0585_feb11ca417d753006dc7d42ee9318870_Frame%201171280125.avif',
  '6a50cb115840e0a456bc0580_c0dbb93828d225013217535c8d8cc21e_Frame%201171280128.avif',
  '6a50cb1183ddf2489b3d7bc7_eb46a89d20bcb0ee031b78603fb13fcf_Frame%201171280130.avif',
  '6a50cb11f6ced96c53b657a3_75682d69f3a3d4e3e22f88e05d5f8d56_Frame%201171280124.avif',
  '6a50cb11ed08fd2374bab01a_e9cd5a7ed19bdca4330eb67fde5539c6_Frame%201171280126.avif',
  '6a50cb112fd9144b363a0127_867efbcb282ef55777e85f117637cfcb_Frame%201171280135.avif',
  '6a50cb1152b12491ba980add_7c4f21fea80a1e9bcff4b3226dee3e7d_Frame%201171280127.avif',
  '6a50d22a42b609298bb7780d_Frame%201171280059.avif',
  '6a50d22a6627c349e8613fca_Frame%201171280142.avif',
];

const footerTileNames = [
  '0f76a459fdec8ae13af949e3fb865c57137a4f85.png',
  '276c135b4254309c274010e0361414d09395c2ee.png',
  '2d0dfffdec136b2454ff060456a207b80e19d863.png',
  '422bd6299cb4ef1494c2813aa0acdd6739346d10.png',
  '435ef17f31a8b8818eca668ef21c807aed729aa2.png',
  '46fc3bf6d901c97c2566930f4ee9621a73c483d7.jpg',
  '4ccd30439df99379dcfe655af0bd1e8d3d2940ff.png',
  '521baef0b44c6a08d64244dc9bc16c9e55e63f71.png',
  '638fd8e8773dcc799b28de7c623e8f7662556840.jpg',
  '6527e06483138d050995ea1f8dd6b650bf0a050a.png',
  '751c027fd08529f057e201c04de5822dda5c92bb.png',
];

const matterRegularUrl = resolveTasteAsset('/assets/fonts/Matter-Regular.woff2');
const matterLightUrl = resolveTasteAsset('/assets/fonts/Matter-Light.woff2');
const matterMediumUrl = resolveTasteAsset('/assets/fonts/Matter-Medium.woff2');
const monoRegularUrl = resolveTasteAsset('/assets/fonts/AzeretSemiMono-Regular.otf');
const monoLightUrl = resolveTasteAsset('/assets/fonts/AzeretSemiMono-Light.otf');

const previewCss = `
@font-face { font-family: "Taste Matter"; src: url("${matterRegularUrl}") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Taste Matter"; src: url("${matterLightUrl}") format("woff2"); font-weight: 300; font-display: swap; }
@font-face { font-family: "Taste Matter"; src: url("${matterMediumUrl}") format("woff2"); font-weight: 500 800; font-display: swap; }
@font-face { font-family: "Taste Mono"; src: url("${monoRegularUrl}") format("opentype"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Taste Mono"; src: url("${monoLightUrl}") format("opentype"); font-weight: 300; font-display: swap; }

:host {
  display: block;
  width: var(--taste-live-width);
  height: var(--taste-live-height);
  overflow: hidden;
  background: #1e1e1e;
  font-synthesis: none;
}

.taste-labs-live-root,
.taste-labs-live-stage {
  position: relative;
  width: var(--taste-live-width);
  height: var(--taste-live-height);
  overflow: hidden;
}
`;

async function loadPreviewStyles(): Promise<string> {
  const sourceCss = await import(
    '../../../artifacts/downloads/tastelabs.com/2026-08-22-product/reverse-engineering/selected-components-suite/src/styles.css?raw'
  ).then((module) => module.default);
  return `${sourceCss}\n${previewCss}`;
}

async function loadComponent(componentName: TasteLabsLiveComponentName): Promise<ReactElement> {
  switch (componentName) {
    case 'TasteHeroSection': {
      const module = await import('../../../artifacts/downloads/tastelabs.com/2026-08-22-product/reverse-engineering/selected-components-suite/src/components/TasteHeroSection.jsx');
      return createElement(module.TasteHeroSection, {
        videoUrl: resolveTasteAsset('/assets/hero/home_hero_loop_desktop.webm'),
      });
    }
    case 'TasteChallengeCarouselSection': {
      const module = await import('../../../artifacts/downloads/tastelabs.com/2026-08-22-product/reverse-engineering/selected-components-suite/src/components/TasteChallengeCarouselSection.jsx');
      return createElement(module.TasteChallengeCarouselSection, {
        imageUrls: challengeImageNames.map((name) => resolveTasteAsset(`/assets/challenge/${name}`)),
      });
    }
    case 'TasteMissionSection': {
      const animationUrl = resolveTasteAsset('/assets/mission/mission-animation.lottie');
      const [module, animationData] = await Promise.all([
        import('../../../artifacts/downloads/tastelabs.com/2026-08-22-product/reverse-engineering/selected-components-suite/src/components/TasteMissionSection.jsx'),
        loadAnimationData(animationUrl),
      ]);
      return createElement(module.TasteMissionSection, {
        animationUrl,
        animationData,
      });
    }
    case 'TasteStackSection': {
      const trainingAnimationUrl = resolveTasteAsset('/assets/stack/training-models.lottie');
      const agentsAnimationUrl = resolveTasteAsset('/assets/stack/agents-apps.lottie');
      const [module, trainingAnimationData, agentsAnimationData] = await Promise.all([
        import('../../../artifacts/downloads/tastelabs.com/2026-08-22-product/reverse-engineering/selected-components-suite/src/components/TasteStackSection.jsx'),
        loadAnimationData(trainingAnimationUrl),
        loadAnimationData(agentsAnimationUrl),
      ]);
      return createElement(module.TasteStackSection, {
        trainingAnimationUrl,
        trainingAnimationData,
        agentsAnimationUrl,
        agentsAnimationData,
      });
    }
    case 'TasteSwipeFooter': {
      const module = await import('../../../artifacts/downloads/tastelabs.com/2026-08-22-product/reverse-engineering/selected-components-suite/src/components/TasteSwipeFooter.jsx');
      return createElement(module.TasteSwipeFooter, {
        tileUrls: footerTileNames.map((name) => resolveTasteAsset(`/assets/footer/${name}`)),
      });
    }
  }
}

export function TasteLabsLivePreview({
  componentName,
  surface = 'card',
}: {
  componentName: TasteLabsLiveComponentName;
  surface?: 'card' | 'full';
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
  const [element, setElement] = useState<ReactElement | null>(null);
  const [mobile, setMobile] = useState(false);
  const preview = (mobile ? MOBILE_COMPONENT_PREVIEWS : COMPONENT_PREVIEWS)[componentName];

  useEffect(() => {
    const compactSource = componentName === 'TasteChallengeCarouselSection' || componentName === 'TasteSwipeFooter';
    const media = window.matchMedia(compactSource ? '(max-width: 480px)' : '(max-width: 700px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [componentName]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const existingStyle = shadowRoot.querySelector<HTMLStyleElement>('style[data-taste-labs-live-styles]');
    const existingNode = shadowRoot.querySelector<HTMLDivElement>('.taste-labs-live-root');
    const style = existingStyle ?? document.createElement('style');
    const node = existingNode ?? document.createElement('div');
    style.dataset.tasteLabsLiveStyles = '';
    node.className = `taste-labs-live-root taste-labs-live-stage taste-labs-live-stage--${preview.stage}`;
    if (!existingStyle) shadowRoot.append(style);
    if (!existingNode) shadowRoot.append(node);
    setMountNode(node);

    let cancelled = false;
    void loadPreviewStyles().then((styles) => {
      if (!cancelled) style.textContent = styles;
    });
    return () => { cancelled = true; };
  }, [componentName, preview.stage]);

  useEffect(() => {
    let cancelled = false;
    setElement(null);
    void loadComponent(componentName).then((nextElement) => {
      if (!cancelled) setElement(nextElement);
    });
    return () => { cancelled = true; };
  }, [componentName]);

  return (
    <div
      aria-label={`${componentName} live component`}
      data-preview-surface={surface}
      data-taste-labs-live-component={componentName}
      ref={hostRef}
      style={{
        '--taste-live-height': `${preview.height}px`,
        '--taste-live-width': `${preview.width}px`,
        height: preview.height,
        width: preview.width,
      } as CSSProperties}
    >
      {mountNode && element ? createPortal(element, mountNode) : null}
    </div>
  );
}
