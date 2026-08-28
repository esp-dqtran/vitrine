import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

export const palmerMotion = {
  initialReveal: {
    itemDelay: 0.25,
    itemDuration: 0.5,
    itemStagger: 1.5,
    zoomDelay: 2,
    zoomDuration: 2,
    controlsAt: 3.5,
    controlsDuration: 1,
    controlsStagger: 0.2,
  },
  zoom: {
    duration: 1.5,
    ease: "expo.inOut",
  },
  drag: {
    desktopThrowResistance: 8000,
    portraitTouchThrowResistance: 1000,
    edgeResistance: 0.9,
    desktopLagDuration: 0.6,
    portraitTouchLagDuration: 0.2,
    lagEase: "cubic-bezier(0.33, 1, 0.68, 1)",
    proximityThreshold: 350,
    proximityScale: 0.15,
    proximityDuration: 0.6,
  },
  focus: {
    contextDelay: 0.5,
    contextDuration: 0.5,
    contextStagger: 0.005,
    titleDuration: 1,
    titleStagger: 0.05,
    wheelSnapDelay: 0.12,
  },
  carousel: {
    duration: 0.68,
    ease: "power3.out",
  },
};

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function duration(value) {
  return prefersReducedMotion() ? 0.01 : value;
}

export function usesPortraitTouchMotion() {
  const touchDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent) || "ontouchstart" in window;
  return touchDevice && !window.matchMedia("(orientation: landscape)").matches;
}

export { Draggable, gsap };
