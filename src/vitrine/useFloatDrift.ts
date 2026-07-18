import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';

interface FloatDriftOptions {
  rotate?: number;
  dx: number;
  dy: number;
  duration: number;
  delay?: number;
  rswing?: number;
}

// Organic, non-repeating float — one yoyo'd sinusoid per axis rather than a single
// `keyframes` tween: keyframes' per-segment ease (`easeEach`) defaults to
// power1.inOut, which parks the element at a dead stop on every keyframe
// boundary. A yoyo'd sine.inOut is a true sinusoid — velocity passes through
// the reversal continuously, so there is no stutter anywhere in the loop.
//
// The three periods are deliberately incommensurate (1 : 1.32 : 0.86). Equal
// periods would let all axes hit their extremes together and freeze the
// element in lockstep; detuned, the composite path never repeats exactly and
// never fully stops. Amplitudes are centred on the authored position (±half)
// so the element drifts around where it was placed, not away from it.
export function useFloatDrift(ref: RefObject<HTMLElement | null>, { rotate = 0, dx, dy, duration, delay = 0, rswing = 0 }: FloatDriftOptions) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.set(el, { rotate, x: 0, y: 0 });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const spin = (from: object, to: object, period: number, offset: number) =>
      gsap.fromTo(el, from, { ...to, duration: period, delay: delay + offset, repeat: -1, yoyo: true, ease: 'sine.inOut' });

    const tweens = [
      spin({ y: -dy / 2 }, { y: dy / 2 }, duration, 0),
      spin({ x: -dx / 2 }, { x: dx / 2 }, duration * 1.32, 0.21),
      spin({ rotate: rotate - rswing }, { rotate: rotate + rswing }, duration * 0.86, 0.13),
    ];
    return () => {
      tweens.forEach((t) => t.kill());
    };
  }, [ref, rotate, dx, dy, rswing, duration, delay]);
}
