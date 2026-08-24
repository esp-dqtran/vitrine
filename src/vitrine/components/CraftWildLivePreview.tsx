import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

const sneakMediumUrl = new URL(
  '../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/fonts/Sneak-Medium.woff2',
  import.meta.url,
).href;
const sneakRegularUrl = new URL(
  '../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/fonts/Sneak-Regular.woff2',
  import.meta.url,
).href;

export type CraftWildLiveComponentName =
  | 'HeroSection'
  | 'WorkCarouselSection'
  | 'ProcessFlowSection'
  | 'ProtocolPartsSection'
  | 'ExperimentsCarouselSection'
  | 'ContactSection'
  | 'TetrisFooter';

const COMPONENT_PREVIEWS: Record<CraftWildLiveComponentName, { height: number; stage: string; width: number }> = {
  HeroSection: { width: 1280, height: 720, stage: 'hero' },
  WorkCarouselSection: { width: 1280, height: 720, stage: 'work' },
  ProcessFlowSection: { width: 1280, height: 820, stage: 'process' },
  ProtocolPartsSection: { width: 1280, height: 620, stage: 'protocol' },
  ExperimentsCarouselSection: { width: 1280, height: 980, stage: 'experiments' },
  ContactSection: { width: 1280, height: 920, stage: 'contact' },
  TetrisFooter: { width: 1280, height: 390, stage: 'footer' },
};

const craftWildAssetUrls: Record<string, string> = {
  '/assets/wild-logo.svg': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/wild-logo.svg', import.meta.url).href,
  '/assets/work/replit-agent-3.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/replit-agent-3.mp4', import.meta.url).href,
  '/assets/work/serve-robotics.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/serve-robotics.mp4', import.meta.url).href,
  '/assets/work/unstructured.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/unstructured.mp4', import.meta.url).href,
  '/assets/work/ouster.avif': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/ouster.avif', import.meta.url).href,
  '/assets/work/ibm.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/ibm.mp4', import.meta.url).href,
  '/assets/work/ordinary.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/ordinary.mp4', import.meta.url).href,
  '/assets/work/montefiore.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/montefiore.mp4', import.meta.url).href,
  '/assets/work/tersa.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/tersa.mp4', import.meta.url).href,
  '/assets/work/nutrafol.avif': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/work/nutrafol.avif', import.meta.url).href,
  '/assets/experiments/wild-week-athens.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/experiments/wild-week-athens.mp4', import.meta.url).href,
  '/assets/experiments/very-fluffy.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/experiments/very-fluffy.mp4', import.meta.url).href,
  '/assets/experiments/active-heads.mp4': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/experiments/active-heads.mp4', import.meta.url).href,
  '/assets/experiments/asset-pipeline.avif': new URL('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/public/assets/experiments/asset-pipeline.avif', import.meta.url).href,
};

function resolveCraftWildAsset(path: string): string {
  return craftWildAssetUrls[path] ?? path;
}

const previewCss = `
@font-face {
  font-family: "Sneak";
  src: url("${sneakRegularUrl}") format("woff2");
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: "Sneak";
  src: url("${sneakMediumUrl}") format("woff2");
  font-style: normal;
  font-weight: 500 700;
  font-display: swap;
}

:host {
  display: block;
  width: var(--craft-live-width);
  height: var(--craft-live-height);
  overflow: hidden;
  background: var(--paper, #f4f1e8);
  font-synthesis: none;
}

.craft-wild-live-root,
.craft-wild-live-stage {
  position: relative;
  width: var(--craft-live-width);
  height: var(--craft-live-height);
  overflow: hidden;
}

.craft-wild-live-stage--protocol {
  display: flex;
  align-items: center;
}

.craft-wild-live-stage--hero .hero {
  height: 720px;
  min-height: 720px;
}

.craft-wild-live-stage--hero .intro {
  display: none;
}

.craft-wild-live-stage--contact .contact-ambient-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.craft-wild-live-stage--contact #hero-kv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.craft-wild-live-stage--hero .hero,
.craft-wild-live-stage--work .caro,
.craft-wild-live-stage--process .process-flow,
.craft-wild-live-stage--experiments .caro,
.craft-wild-live-stage--protocol .proc,
.craft-wild-live-stage--contact .cta,
.craft-wild-live-stage--footer footer {
  width: 100%;
}
`;

async function loadPreviewStyles(): Promise<string> {
  const craftWildSourceCss = await import(
    '../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/src/styles.css?raw'
  ).then((module) => module.default);

  const sourceCss = craftWildSourceCss
    .replaceAll(':root', ':host')
    .replaceAll('url("/assets/fonts/Sneak-Regular.woff2")', `url("${sneakRegularUrl}")`)
    .replaceAll('url("/assets/fonts/Sneak-Medium.woff2")', `url("${sneakMediumUrl}")`);

  return `${sourceCss}\n${previewCss}`;
}

async function loadComponent(componentName: CraftWildLiveComponentName): Promise<ReactElement> {
  switch (componentName) {
    case 'HeroSection': {
      const module = await import('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/src/components/HeroSection.jsx');
      return createElement(module.HeroSection, { assetUrl: resolveCraftWildAsset });
    }
    case 'WorkCarouselSection': {
      const module = await import('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/src/components/WorkCarouselSection.jsx');
      return createElement(module.WorkCarouselSection, { assetUrl: resolveCraftWildAsset });
    }
    case 'ProcessFlowSection': {
      const module = await import('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/src/components/ProcessFlowSection.jsx');
      return createElement(module.ProcessFlowSection);
    }
    case 'ProtocolPartsSection': {
      const module = await import('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/src/components/ProtocolPartsSection.jsx');
      return createElement(module.ProtocolPartsSection);
    }
    case 'ExperimentsCarouselSection': {
      const module = await import('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/src/components/ExperimentsCarouselSection.jsx');
      return createElement(module.ExperimentsCarouselSection, { assetUrl: resolveCraftWildAsset });
    }
    case 'ContactSection': {
      const module = await import('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/src/components/ContactAmbientPreview.jsx');
      return createElement(module.ContactAmbientPreview);
    }
    case 'TetrisFooter': {
      const module = await import('../../../artifacts/downloads/craft.wild.as/2026-08-21-home/reverse-engineering/selected-components-suite/src/components/TetrisFooter.jsx');
      return createElement(module.TetrisFooter);
    }
  }
}

export function CraftWildLivePreview({
  componentName,
  surface = 'card',
}: {
  componentName: CraftWildLiveComponentName;
  surface?: 'card' | 'full';
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
  const [element, setElement] = useState<ReactElement | null>(null);
  const preview = COMPONENT_PREVIEWS[componentName];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const existingStyle = shadowRoot.querySelector<HTMLStyleElement>('style[data-craft-wild-live-styles]');
    const existingNode = shadowRoot.querySelector<HTMLDivElement>('.craft-wild-live-root');
    const style = existingStyle ?? document.createElement('style');
    const node = existingNode ?? document.createElement('div');
    style.dataset.craftWildLiveStyles = '';
    node.className = `craft-wild-live-root craft-wild-live-stage craft-wild-live-stage--${preview.stage}`;
    if (!existingStyle) shadowRoot.append(style);
    if (!existingNode) shadowRoot.append(node);
    setMountNode(node);

    let cancelled = false;
    void loadPreviewStyles().then((styles) => {
      if (!cancelled) style.textContent = styles;
    });

    return () => {
      cancelled = true;
    };
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
      data-craft-wild-live-component={componentName}
      data-preview-surface={surface}
      ref={hostRef}
      style={{
        '--craft-live-height': `${preview.height}px`,
        '--craft-live-width': `${preview.width}px`,
        height: preview.height,
        width: preview.width,
      } as CSSProperties}
    >
      {mountNode && element ? createPortal(element, mountNode) : null}
    </div>
  );
}
