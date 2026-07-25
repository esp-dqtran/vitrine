import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { AppsFacetPreview } from './appsDiscovery.ts';

interface CategoryPreviewMotion {
  show: (preview: AppsFacetPreview, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
}

export function useCategoryHoverPreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<CategoryPreviewMotion | null>(null);

  useLayoutEffect(() => {
    const element = previewRef.current;
    const image = element?.querySelector('img');
    if (!element || !image) return;

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
          xPercent: -50,
          yPercent: -50,
        });
        const duration = reduceMotion ? 0 : 0.35;
        const xTo = gsap.quickTo(element, 'x', { duration, ease: 'power3.out' });
        const yTo = gsap.quickTo(element, 'y', { duration, ease: 'power3.out' });
        let imageTween: gsap.core.Tween | null = null;
        let visibilityTween: gsap.core.Tween | null = null;

        motionRef.current = {
          show: (preview, x, y) => {
            image.src = preview.url;
            image.dataset.app = preview.app;
            xTo(x + 28);
            yTo(y + 24);
            imageTween?.kill();
            visibilityTween?.kill();
            imageTween = gsap.fromTo(
              image,
              { autoAlpha: reduceMotion ? 1 : 0.3, scale: reduceMotion ? 1 : 1.03 },
              { autoAlpha: 1, scale: 1, duration: reduceMotion ? 0 : 0.18, overwrite: 'auto' },
            );
            visibilityTween = gsap.to(element, {
              autoAlpha: 1,
              scale: 1,
              duration: reduceMotion ? 0 : 0.2,
              overwrite: 'auto',
            });
          },
          move: (x, y) => {
            xTo(x + 28);
            yTo(y + 24);
          },
          hide: () => {
            visibilityTween?.kill();
            visibilityTween = gsap.to(element, {
              autoAlpha: 0,
              scale: reduceMotion ? 1 : 0.96,
              duration: reduceMotion ? 0 : 0.16,
              overwrite: 'auto',
            });
          },
        };

        return () => {
          xTo.tween.kill();
          yTo.tween.kill();
          imageTween?.kill();
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
    showPreview: (preview: AppsFacetPreview, x: number, y: number) =>
      motionRef.current?.show(preview, x, y),
    movePreview: (x: number, y: number) => motionRef.current?.move(x, y),
    hidePreview: () => motionRef.current?.hide(),
  };
}
