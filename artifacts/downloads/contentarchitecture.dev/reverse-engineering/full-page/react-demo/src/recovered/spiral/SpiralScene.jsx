import { Geometry, Mesh, Program, Renderer, Texture } from "ogl";
import { useEffect, useRef, useState } from "react";
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  BACKGROUND,
  BASE_QUAD_POSITION,
  BASE_QUAD_UV,
  createGlyphAtlas,
  createInstanceAttributes,
  createRingConfiguration,
  FRAGMENT_SHADER,
  hexToRgb01,
  inverseSmoothstep,
  RING_COUNT,
  smoothstep,
  VERTEX_SHADER,
} from "./spiralCore.js";
import "./SpiralScene.css";

const LABELS = {
  idle: "Click & hold",
  holding: "Keep holding",
  charged: "Release",
};

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

export function SpiralScene({ className = "", onStateChange, pixelRatio, style }) {
  const containerRef = useRef(null);
  const labelRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [interactionState, setInteractionState] = useState("idle");
  const [touchDevice, setTouchDevice] = useState(false);

  useEffect(() => {
    setTouchDevice(isTouchDevice());
  }, []);

  useEffect(() => {
    onStateChange?.(interactionState);
  }, [interactionState, onStateChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const dpr = Math.min(pixelRatio ?? window.devicePixelRatio ?? 1, 2);
    const renderer = new Renderer({
      webgl: 2,
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      dpr,
      powerPreference: "high-performance",
    });
    const gl = renderer.gl;
    const [red, green, blue] = hexToRgb01(BACKGROUND);
    gl.clearColor(red, green, blue, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const canvas = gl.canvas;
    Object.assign(canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
      position: "absolute",
      inset: "0",
    });
    canvas.setAttribute("aria-hidden", "true");
    container.querySelectorAll("canvas").forEach((existingCanvas) => existingCanvas.remove());
    container.appendChild(canvas);

    const atlas = createGlyphAtlas();
    const atlasTexture = new Texture(gl, {
      image: atlas,
      generateMipmaps: true,
      premultiplyAlpha: false,
      flipY: false,
    });

    const rings = createRingConfiguration();
    const arrivalTimes = Array(RING_COUNT).fill(0);
    rings.forEach((ring, index) => {
      const radialDistance = Math.max(0, ring.radius - 0.425);
      arrivalTimes[index] = 1.8 * inverseSmoothstep(Math.min(1, radialDistance / 1.6));
    });

    const attributes = createInstanceAttributes(rings);
    const geometry = new Geometry(gl, {
      position: { size: 2, data: BASE_QUAD_POSITION },
      uv: { size: 2, data: BASE_QUAD_UV },
      aRadius: { instanced: 1, size: 1, data: attributes.aRadius },
      aTheta0: { instanced: 1, size: 1, data: attributes.aTheta0 },
      aSpeed: { instanced: 1, size: 1, data: attributes.aSpeed },
      aSize: { instanced: 1, size: 1, data: attributes.aSize },
      aCharIdx: { instanced: 1, size: 1, data: attributes.aCharIdx },
      aRingIdx: { instanced: 1, size: 1, data: attributes.aRingIdx },
    });

    const uniforms = {
      uTime: { value: 0 },
      uFitScale: { value: new Float32Array([1, 1]) },
      uCenter: { value: new Float32Array([0, 0]) },
      uAtlasGrid: { value: new Float32Array([ATLAS_COLUMNS, ATLAS_ROWS]) },
      uPxToDesign: { value: 1 / 540 },
      uMouse: { value: new Float32Array([999, 999]) },
      uMouseInfluence: { value: 0 },
      uMouseRadius: { value: 0.35 },
      uRingCharge: { value: Array(RING_COUNT).fill(0) },
      uRingGather: { value: Array(RING_COUNT).fill(0) },
      uRippleStarts: { value: Array(16).fill(-1) },
      uRingOffsets: { value: Array(RING_COUNT).fill(0) },
      uRingArrivalTime: { value: arrivalTimes },
      tAtlas: { value: atlasTexture },
    };

    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
      uniforms,
    });
    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false });

    if (!program.uniformLocations || !program.attributeLocations) {
      console.error("SpiralScene could not initialize its WebGL program.");
      canvas.remove();
      return undefined;
    }

    let width = 1;
    let height = 1;
    let animationFrame = 0;
    let isIntersecting = true;
    let isVisible = !document.hidden;
    let motionEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let previousTime = performance.now();
    let elapsedTime = 0;
    const ripples = [];
    const velocityOffsets = new Float32Array(RING_COUNT);
    const smoothedOffsets = new Float32Array(RING_COUNT);
    const chargeByRing = new Float32Array(RING_COUNT);
    const gatherByRing = new Float32Array(RING_COUNT);
    const frozenRotation = new Float32Array(RING_COUNT);
    const targetMouse = new Float32Array([999, 999]);
    let targetMouseInfluence = 0;
    let holding = false;
    let charged = false;
    let chargeProgress = 0;
    let gatherProgress = 0;
    let scrollEnergy = 0;
    let scrollVelocity = 0;
    let releaseStart = -1;
    let lastScrollY = window.scrollY;
    let lastScrollTime = performance.now();
    let resizeTimer = null;
    let resizePending = false;
    let resizeAgain = false;

    function render() {
      uniforms.uTime.value = elapsedTime;
      renderer.render({ scene: mesh, update: false, sort: false, frustumCull: false });
    }

    function resize() {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
      const aspect = width / height;
      if (aspect >= 1) {
        uniforms.uFitScale.value[0] = 1;
        uniforms.uFitScale.value[1] = aspect;
      } else {
        uniforms.uFitScale.value[0] = 1 / aspect;
        uniforms.uFitScale.value[1] = 1;
      }
    }

    function toDesignCoordinates(localX, localY) {
      const invertedY = -(localY / height) * 2 + 1;
      return [
        ((localX / width) * 2 - 1) / uniforms.uFitScale.value[0],
        invertedY / uniforms.uFitScale.value[1],
      ];
    }

    function setMouse(localX, localY, immediate = false) {
      const [x, y] = toDesignCoordinates(localX, localY);
      targetMouse[0] = x;
      targetMouse[1] = y;
      if (immediate) {
        uniforms.uMouse.value[0] = x;
        uniforms.uMouse.value[1] = y;
      }
    }

    function setLabelPosition(event) {
      if (!labelRef.current || isTouchDevice()) return;
      const rect = container.getBoundingClientRect();
      labelRef.current.style.left = `${event.clientX - rect.left}px`;
      labelRef.current.style.top = `${event.clientY - rect.top}px`;
    }

    function onPointerMove(event) {
      const rect = container.getBoundingClientRect();
      setLabelPosition(event);
      setMouse(event.clientX - rect.left, event.clientY - rect.top);
    }

    function onPointerEnter(event) {
      const rect = container.getBoundingClientRect();
      setLabelPosition(event);
      setMouse(event.clientX - rect.left, event.clientY - rect.top, true);
      targetMouseInfluence = 1;
      setHovering(true);
    }

    function resetPointerState() {
      targetMouseInfluence = 0;
      holding = false;
      charged = false;
      setInteractionState("idle");
      setHovering(false);
    }

    function onPointerDown() {
      holding = true;
      charged = false;
      setInteractionState("holding");
    }

    function onPointerUp() {
      if (!holding) return;
      holding = false;
      if (charged) {
        releaseStart = elapsedTime;
        ripples.push({ start: elapsedTime, strength: 0.7 + 0.6 * gatherProgress });
        while (ripples.length > 16) ripples.shift();
      }
      charged = false;
      setInteractionState("idle");
    }

    function onScroll() {
      const now = performance.now();
      const frameDuration = Math.max(1, now - lastScrollTime) / (1000 / 60);
      scrollVelocity = (window.scrollY - lastScrollY) / frameDuration;
      lastScrollY = window.scrollY;
      lastScrollTime = now;
    }

    function animate(now) {
      const delta = Math.min(0.05, (now - previousTime) * 0.001);
      previousTime = now;
      if (motionEnabled) elapsedTime += delta;

      while (ripples.length && elapsedTime - ripples[0].start >= 1.8) ripples.shift();
      uniforms.uRippleStarts.value.fill(-1);
      ripples.forEach((ripple, index) => {
        uniforms.uRippleStarts.value[index] = ripple.start;
      });

      const hoverEase = 1 - Math.exp(-6 * delta);
      uniforms.uMouseInfluence.value +=
        (targetMouseInfluence - uniforms.uMouseInfluence.value) * hoverEase;
      const mouseEase = 1 - Math.exp(-14 * delta);
      uniforms.uMouse.value[0] += (targetMouse[0] - uniforms.uMouse.value[0]) * mouseEase;
      uniforms.uMouse.value[1] += (targetMouse[1] - uniforms.uMouse.value[1]) * mouseEase;

      if (holding) {
        chargeProgress = Math.min(1, chargeProgress + delta / 0.9);
        gatherProgress = 1 - (1 - gatherProgress) * Math.exp(-delta / 4);
        if (!charged && chargeProgress >= 1) {
          charged = true;
          setInteractionState("charged");
        }
      } else {
        chargeProgress *= Math.exp(-10 * delta);
        gatherProgress *= Math.exp(-10 * delta);
      }

      const releaseAge = elapsedTime - releaseStart;
      const releaseActive = releaseStart >= 0 && releaseAge < 1.8;
      const releasedRadius = releaseActive ? 1.6 * smoothstep(0, 1, releaseAge / 1.8) + 0.425 : Infinity;
      const decay = Math.exp(-10 * delta);

      for (let index = 0; index < RING_COUNT; index += 1) {
        const ring = rings[index];
        let ringCharge = chargeByRing[index] ?? 0;
        let ringGather = gatherByRing[index] ?? 0;

        if (holding) {
          const easing = 1 - Math.exp(-14 * delta);
          ringCharge += (chargeProgress - ringCharge) * easing;
          ringGather += (smoothstep(0, 1, chargeProgress) * gatherProgress - ringGather) * easing;
        } else if (!releaseActive || releasedRadius >= ring.radius) {
          ringCharge *= decay;
          ringGather *= decay;
        }

        chargeByRing[index] = ringCharge;
        gatherByRing[index] = ringGather;
        uniforms.uRingCharge.value[index] = smoothstep(0, 1, ringCharge);
        uniforms.uRingGather.value[index] = ringGather;
        frozenRotation[index] -= uniforms.uRingCharge.value[index] * ring.speed * delta;
      }

      scrollVelocity *= Math.exp(-5 * delta);
      const speed = Math.min(40, Math.abs(scrollVelocity));
      scrollEnergy += (speed - scrollEnergy) * (1 - Math.exp(-4 * delta));
      const offsetEase = 1 - Math.exp(-3 * delta);

      for (let index = 0; index < RING_COUNT; index += 1) {
        const ring = rings[index];
        let rippleInfluence = 0;

        ripples.forEach((ripple) => {
          const age = elapsedTime - ripple.start;
          if (age < 0 || age >= 1.8) return;
          const life = age / 1.8;
          const waveRadius = 1.6 * smoothstep(0, 1, life);
          const bell = 1 - smoothstep(0, 0.425, Math.abs(ring.radius - waveRadius));
          const fade = smoothstep(0, 0.22, life) * (1 - smoothstep(0.78, 1, life));
          rippleInfluence = Math.max(rippleInfluence, bell * fade * ripple.strength);
        });

        const direction = Math.sign(ring.speed) || 1;
        velocityOffsets[index] += (0.55 * rippleInfluence * direction + ring.speed * scrollEnergy) * delta;
        smoothedOffsets[index] += (velocityOffsets[index] - smoothedOffsets[index]) * offsetEase;
        uniforms.uRingOffsets.value[index] = smoothedOffsets[index] + frozenRotation[index];
      }

      render();
      animationFrame = isIntersecting && isVisible && motionEnabled ? requestAnimationFrame(animate) : 0;
    }

    function updateAnimation() {
      if (isIntersecting && isVisible && motionEnabled) {
        if (!animationFrame) {
          previousTime = performance.now();
          animationFrame = requestAnimationFrame(animate);
        }
      } else {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        render();
      }
    }

    resize();
    const abortController = new AbortController();
    const { signal } = abortController;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    container.addEventListener("pointermove", onPointerMove, { passive: true, signal });
    container.addEventListener("pointerenter", onPointerEnter, { signal });
    container.addEventListener("pointerleave", resetPointerState, { signal });
    container.addEventListener("pointercancel", resetPointerState, { signal });
    container.addEventListener("pointerdown", onPointerDown, { signal });
    container.addEventListener("pointerup", onPointerUp, { signal });
    window.addEventListener("scroll", onScroll, { passive: true, signal });

    const resizeObserver = new ResizeObserver(() => {
      if (!isIntersecting) {
        resizePending = true;
        return;
      }
      if (!resizeTimer) {
        resize();
        render();
      } else {
        window.clearTimeout(resizeTimer);
        resizeAgain = true;
      }
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        if (resizeAgain) {
          resizeAgain = false;
          resize();
          render();
        }
      }, 150);
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      isIntersecting = entry.isIntersecting;
      if (isIntersecting && resizePending) {
        resizePending = false;
        resize();
      }
      updateAnimation();
    });
    intersectionObserver.observe(container);

    function onVisibilityChange() {
      isVisible = !document.hidden;
      updateAnimation();
    }

    function onReducedMotionChange() {
      motionEnabled = !reducedMotion.matches;
      updateAnimation();
    }

    document.addEventListener("visibilitychange", onVisibilityChange, { signal });
    reducedMotion.addEventListener("change", onReducedMotionChange, { signal });

    if (motionEnabled) ripples.push({ start: 0, strength: 1 });
    else elapsedTime = 2.3;

    render();
    updateAnimation();
    document.fonts.ready.then(() => {
      if (signal.aborted) return;
      atlasTexture.image = createGlyphAtlas();
      atlasTexture.needsUpdate = true;
      render();
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      abortController.abort();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      if (resizeTimer) window.clearTimeout(resizeTimer);
      canvas.remove();
    };
  }, [pixelRatio]);

  const label = interactionState === "idle" && touchDevice ? "Tap & hold" : LABELS[interactionState];

  return (
    <div
      ref={containerRef}
      className={`spiral-scene ${className}`.trim()}
      style={{ backgroundColor: BACKGROUND, ...style }}
    >
      <div
        ref={labelRef}
        className={`spiral-scene__label ${touchDevice ? "spiral-scene__label--touch" : ""} ${
          hovering || touchDevice ? "is-visible" : ""
        }`.trim()}
        aria-hidden="true"
      >
        {label}
      </div>
    </div>
  );
}
