import Lenis from "lenis";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const MeliusScrollContext = createContext(null);

function nativeTarget(target, offset = 0) {
  if (typeof target === "number") return target + offset;
  if (target === "bottom") return document.documentElement.scrollHeight - window.innerHeight + offset;
  if (target instanceof Element) return window.scrollY + target.getBoundingClientRect().top + offset;
  return 0;
}

export function MeliusScrollProvider({ children, stopped = false, embedded = false }) {
  const lenisRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const stoppedRef = useRef(stopped);
  stoppedRef.current = stopped;
  const scrollListeners = useRef(new Set());
  const virtualScrollListeners = useRef(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (embedded) {
      reducedMotionRef.current = mediaQuery.matches;
      setReady(true);
      return undefined;
    }
    const previousScrollRestoration = window.history.scrollRestoration;
    let lenis;
    let unsubscribeScroll;
    let unsubscribeVirtualScroll;

    function createLenis(preservePosition = false) {
      const position = preservePosition ? window.scrollY : 0;
      reducedMotionRef.current = mediaQuery.matches;
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.1,
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: !mediaQuery.matches,
        syncTouch: false,
        touchMultiplier: 1,
        wheelMultiplier: 1,
        overscroll: true,
      });
      lenisRef.current = lenis;
      unsubscribeScroll = lenis.on("scroll", (event) => {
        scrollListeners.current.forEach((listener) => listener(event));
      });
      unsubscribeVirtualScroll = lenis.on("virtual-scroll", (event) => {
        virtualScrollListeners.current.forEach((listener) => listener(event));
      });
      lenis.scrollTo(position, { immediate: true, force: true });
      if (stoppedRef.current) lenis.stop();
      setReady(true);
    }

    function destroyLenis() {
      unsubscribeScroll?.();
      unsubscribeVirtualScroll?.();
      lenis?.destroy();
      lenisRef.current = null;
    }

    function handleMotionPreferenceChange() {
      destroyLenis();
      createLenis(true);
    }

    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    createLenis();
    const resetFrame = window.requestAnimationFrame(() => {
      lenis?.scrollTo(0, { immediate: true, force: true });
    });
    mediaQuery.addEventListener("change", handleMotionPreferenceChange);
    return () => {
      window.cancelAnimationFrame(resetFrame);
      window.history.scrollRestoration = previousScrollRestoration;
      mediaQuery.removeEventListener("change", handleMotionPreferenceChange);
      destroyLenis();
    };
  }, [embedded]);

  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (stopped) lenis.stop();
    else lenis.start();
  }, [ready, stopped]);

  const scrollTo = useCallback((target, options = {}) => {
    if (embedded) return;
    const immediate = options.immediate ?? reducedMotionRef.current;
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.resize();
      lenis.scrollTo(target, { ...options, immediate });
      return;
    }
    window.scrollTo({
      top: nativeTarget(target, options.offset),
      behavior: immediate ? "auto" : "smooth",
    });
  }, [embedded]);

  const onScroll = useCallback((listener) => {
    scrollListeners.current.add(listener);
    return () => scrollListeners.current.delete(listener);
  }, []);

  const onVirtualScroll = useCallback((listener) => {
    virtualScrollListeners.current.add(listener);
    return () => virtualScrollListeners.current.delete(listener);
  }, []);

  const value = useMemo(() => ({
    isReady: ready,
    onScroll,
    onVirtualScroll,
    prefersReducedMotion: () => reducedMotionRef.current,
    scrollTo,
  }), [onScroll, onVirtualScroll, ready, scrollTo]);

  return <MeliusScrollContext.Provider value={value}>{children}</MeliusScrollContext.Provider>;
}

export function useMeliusScroll() {
  const value = useContext(MeliusScrollContext);
  if (!value) throw new Error("useMeliusScroll must be used inside MeliusScrollProvider");
  return value;
}
