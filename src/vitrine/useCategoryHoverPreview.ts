import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { FacetPreview } from './facetPreviewApi.ts';

interface CategoryPreviewMotion {
  show: (preview: FacetPreview, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
}

export function useCategoryHoverPreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<CategoryPreviewMotion | null>(null);

  useLayoutEffect(() => {
    const element = previewRef.current;
    const images = element ? Array.from(element.querySelectorAll('img')) : [];
    if (!element || images.length === 0) return;

    const matchMedia = gsap.matchMedia();
    matchMedia.add(
      {
        finePointer: '(hover: hover) and (pointer: fine)',
        reduceMotion: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { finePointer, reduceMotion } = context.conditions as {
          finePointer: boolean;
          reduceMotion: boolean;
        };
        if (!finePointer) return;

        gsap.set(element, {
          autoAlpha: 0,
          scale: reduceMotion ? 1 : 0.92,
        });
        const duration = reduceMotion ? 0 : 0.28;
        const xTo = gsap.quickTo(element, 'x', { duration, ease: 'power3.out' });
        const yTo = gsap.quickTo(element, 'y', { duration, ease: 'power3.out' });
        let visibilityTween: gsap.core.Tween | null = null;
        let flowTimeline: gsap.core.Timeline | null = null;

        const position = (x: number, y: number) => {
          const edge = 12;
          const left = Math.min(
            Math.max(x + 18, edge),
            Math.max(edge, window.innerWidth - element.offsetWidth - edge),
          );
          const top = Math.min(
            Math.max(y + 18, edge),
            Math.max(edge, window.innerHeight - element.offsetHeight - edge),
          );
          xTo(left);
          yTo(top);
        };

        motionRef.current = {
          show: (preview, x, y) => {
            flowTimeline?.kill();
            flowTimeline = null;
            element.dataset.kind = preview.kind;
            element.dataset.app = preview.app;
            const sources = preview.kind === 'icon'
              ? [preview.iconUrl].filter((url): url is string => Boolean(url))
              : preview.media.slice(0, 3);

            images.forEach((image, index) => {
              const source = sources[index];
              if (source) image.src = source;
              else image.removeAttribute('src');
              gsap.set(image, { autoAlpha: index === 0 && source ? 1 : 0 });
            });
            position(x, y);

            if (preview.kind === 'flow' && sources.length > 1 && !reduceMotion) {
              flowTimeline = gsap.timeline({ repeat: -1 });
              sources.forEach((_, index) => {
                const next = (index + 1) % sources.length;
                flowTimeline!
                  .to(images[index]!, { autoAlpha: 0, duration: 0.18 }, '+=0.72')
                  .to(images[next]!, { autoAlpha: 1, duration: 0.18 }, '<');
              });
            }

            visibilityTween?.kill();
            visibilityTween = gsap.to(element, {
              autoAlpha: 1,
              scale: 1,
              duration: reduceMotion ? 0 : 0.18,
              overwrite: 'auto',
            });
          },
          move: position,
          hide: () => {
            flowTimeline?.kill();
            flowTimeline = null;
            visibilityTween?.kill();
            visibilityTween = gsap.to(element, {
              autoAlpha: 0,
              scale: reduceMotion ? 1 : 0.96,
              duration: reduceMotion ? 0 : 0.14,
              overwrite: 'auto',
            });
          },
        };

        return () => {
          xTo.tween.kill();
          yTo.tween.kill();
          flowTimeline?.kill();
          visibilityTween?.kill();
          motionRef.current = null;
        };
      },
    );

    return () => {
      motionRef.current = null;
      matchMedia.revert();
    };
  }, []);

  return {
    previewRef,
    showPreview: (preview: FacetPreview, x: number, y: number) =>
      motionRef.current?.show(preview, x, y),
    movePreview: (x: number, y: number) => motionRef.current?.move(x, y),
    hidePreview: () => motionRef.current?.hide(),
  };
}
