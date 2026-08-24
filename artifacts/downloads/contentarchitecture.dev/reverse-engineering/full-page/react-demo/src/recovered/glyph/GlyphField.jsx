import { Geometry, Mesh, Program, Renderer, Texture } from "ogl";
import { useEffect, useRef, useState } from "react";
import { decodeBrightness, GLYPH_FIELD_DATA, phraseAtlasIndices } from "./glyphData.js";
import { ensureGeistMono } from "./geistMonoData.js";
import {
  BASE_QUAD_POSITION,
  BASE_QUAD_UV,
  createBrightnessCanvas,
  createGlyphAtlas,
  createVertexShader,
  FRAGMENT_SHADER,
  hexToRgb01,
} from "./glyphFieldCore.js";
import "./GlyphField.css";

const MAX_RIPPLES = 16;
const RIPPLE_DURATION = 1.8;

export function GlyphField({
  backgroundColor = "#232323",
  backgroundOnly = false,
  className = "",
  color = "#ffffff",
  data = GLYPH_FIELD_DATA,
  entrance = true,
  interactive = true,
  maxFps,
  modelLayout = "auto",
  pixelRatio,
  style,
}) {
  const containerRef = useRef(null);
  const labelRef = useRef(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const fontReady = ensureGeistMono();
    const phraseCharacters = phraseAtlasIndices(data);
    const glyphAtlas = createGlyphAtlas(data.atlas, data.glyphAspect);
    const brightnessCanvas = createBrightnessCanvas(
      data.modelCols,
      data.modelRows,
      decodeBrightness(data),
    );
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
    const [backgroundRed, backgroundGreen, backgroundBlue] = hexToRgb01(backgroundColor);
    gl.clearColor(backgroundRed, backgroundGreen, backgroundBlue, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const canvas = gl.canvas;
    canvas.className = "glyph-field__canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Interactive ASCII glyph field");
    container.querySelectorAll("canvas").forEach((existing) => existing.remove());
    container.appendChild(canvas);

    const atlasTexture = new Texture(gl, {
      image: glyphAtlas.canvas,
      generateMipmaps: true,
      premultiplyAlpha: false,
      flipY: false,
    });
    const brightnessTexture = new Texture(gl, {
      image: brightnessCanvas,
      generateMipmaps: false,
      premultiplyAlpha: false,
      flipY: true,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    const geometry = new Geometry(gl, {
      position: { size: 2, data: BASE_QUAD_POSITION },
      uv: { size: 2, data: BASE_QUAD_UV },
      aInstance: { instanced: 1, size: 1, data: new Float32Array(1) },
    });
    const uniforms = {
      tAtlas: { value: atlasTexture },
      uColor: { value: new Float32Array(hexToRgb01(color)) },
      tSourceBrightness: { value: brightnessTexture },
      uGridSize: { value: new Float32Array([1, 1]) },
      uAtlasGrid: {
        value: new Float32Array([glyphAtlas.columns, glyphAtlas.rows]),
      },
      uModelStart: { value: new Float32Array([0, 0]) },
      uModelSize: { value: new Float32Array([1, 1]) },
      uModelUVScale: { value: new Float32Array([1, 1]) },
      uModelUVOffset: { value: new Float32Array([0, 0]) },
      uEntranceCenter: { value: new Float32Array([0, 0]) },
      uEntranceStart: { value: entrance ? 0 : -1e9 },
      uBackgroundBrightness: { value: 0.01 },
      uBackgroundTwinkle: { value: backgroundOnly ? 1 : 0 },
      uPhraseChars: { value: phraseCharacters },
      uTime: { value: 0 },
      uMouse: { value: new Float32Array([-999, -999]) },
      uMouseInfluence: { value: 0 },
      uMouseRadius: { value: 1 },
      uRippleMaxRadius: { value: 1 },
      uRippleWidth: { value: 1 },
      uRippleStarts: { value: Array(MAX_RIPPLES).fill(-1) },
      uRippleCenters: {
        value: Array.from({ length: MAX_RIPPLES }, () => [0, 0]),
      },
      uActiveRippleCount: { value: 0 },
    };
    const program = new Program(gl, {
      vertex: createVertexShader(phraseCharacters.length, data.glyphAspect),
      fragment: FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
      uniforms,
    });
    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false });

    if (!program.uniformLocations || !program.attributeLocations) {
      console.error("GlyphField could not initialize its WebGL program.");
      canvas.remove();
      return undefined;
    }

    let animationFrame = 0;
    let elapsed = 0;
    let previousTime = performance.now();
    let visible = !document.hidden;
    let intersecting = true;
    let motionEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!motionEnabled) uniforms.uEntranceStart.value = -1e9;
    let cellWidth = 1;
    let cellHeight = 1;
    let targetInfluence = 0;
    let resizeTimer = 0;
    let allocatedRows = 1;
    let lastRenderTime = -Infinity;
    const targetMouse = new Float32Array([-999, -999]);
    const ripples = [];

    function layoutForViewport() {
      if (modelLayout !== "auto") return modelLayout;
      return window.matchMedia("(min-width: 1024px)").matches ? "right" : "bottom";
    }

    function resize(extraRows = 0) {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      cellHeight = 14;
      cellWidth = cellHeight * data.glyphAspect;
      const columns = Math.max(8, Math.round(width / cellWidth));
      cellWidth = width / columns;
      let rows;
      let rendererHeight;
      if (backgroundOnly) {
        const targetRows = Math.max(8, Math.ceil(height / cellHeight));
        if (targetRows > allocatedRows || allocatedRows - targetRows > 32) {
          allocatedRows = 16 * Math.ceil((targetRows + extraRows) / 16);
        }
        rows = allocatedRows;
        rendererHeight = rows * cellHeight;
      } else {
        rows = Math.max(8, Math.round(height / cellHeight));
        cellHeight = height / rows;
        rendererHeight = height;
      }
      renderer.setSize(Math.floor(width), Math.floor(rendererHeight));

      let modelHeight;
      let modelWidth;
      let startX;
      let startY;
      if (backgroundOnly) {
        modelHeight = 0;
        modelWidth = 0;
        startX = 0;
        startY = 0;
      } else {
        const sourceCellsAspect = data.sourceAspect / data.glyphAspect;
        const modelRows = Math.min(rows, columns / sourceCellsAspect);
        modelHeight = Math.max(1, Math.round(modelRows));
        modelWidth = Math.max(
          1,
          Math.min(columns, Math.round(modelRows * sourceCellsAspect)),
        );
        const layout = layoutForViewport();
        startX =
          layout === "bottom"
            ? Math.round((columns - modelWidth) / 2)
            : columns - modelWidth;
        startY =
          layout === "bottom"
            ? rows - modelHeight
            : Math.round((rows - modelHeight) / 2);
      }

      uniforms.uGridSize.value[0] = columns;
      uniforms.uGridSize.value[1] = rows;
      uniforms.uModelStart.value[0] = startX;
      uniforms.uModelStart.value[1] = startY;
      uniforms.uModelSize.value[0] = modelWidth;
      uniforms.uModelSize.value[1] = modelHeight;
      uniforms.uEntranceCenter.value[0] = backgroundOnly
        ? columns / 2
        : startX + modelWidth / 2;
      uniforms.uEntranceCenter.value[1] = backgroundOnly
        ? Math.min(rows, height / cellHeight) / 2
        : startY + modelHeight / 2;
      const halfGrid = columns / 2;
      uniforms.uMouseRadius.value = 0.35 * halfGrid;
      uniforms.uRippleMaxRadius.value = 1.6 * halfGrid;
      uniforms.uRippleWidth.value = 0.85 * halfGrid;
      geometry.setInstancedCount(columns * rows);
    }

    function render(now = performance.now(), force = true) {
      const hasActiveEffect =
        ripples.length > 0 ||
        uniforms.uMouseInfluence.value > 0.001 ||
        (uniforms.uEntranceStart.value > -1e8 &&
          uniforms.uEntranceStart.value < 1e8);
      if (
        !force &&
        maxFps &&
        !hasActiveEffect &&
        now - lastRenderTime < 1000 / maxFps
      ) {
        return;
      }
      lastRenderTime = now;
      uniforms.uTime.value = elapsed;
      renderer.render({ scene: mesh, update: false, sort: false, frustumCull: false });
    }

    function animate(now) {
      const delta = Math.min(0.05, (now - previousTime) * 0.001);
      previousTime = now;
      if (motionEnabled) elapsed += delta;

      while (ripples.length && elapsed - ripples[0].start >= RIPPLE_DURATION) {
        ripples.shift();
      }
      for (let index = 0; index < MAX_RIPPLES; index += 1) {
        const ripple = ripples[index];
        uniforms.uRippleStarts.value[index] = ripple?.start ?? -1;
        uniforms.uRippleCenters.value[index][0] = ripple?.x ?? 0;
        uniforms.uRippleCenters.value[index][1] = ripple?.y ?? 0;
      }
      uniforms.uActiveRippleCount.value = ripples.length;

      if (
        uniforms.uEntranceStart.value > -1e8 &&
        elapsed - uniforms.uEntranceStart.value > 2.35
      ) {
        uniforms.uEntranceStart.value = -1e9;
      }
      const influenceEase = 1 - Math.exp(-6 * delta);
      uniforms.uMouseInfluence.value +=
        (targetInfluence - uniforms.uMouseInfluence.value) * influenceEase;
      const mouseEase = 1 - Math.exp(-14 * delta);
      uniforms.uMouse.value[0] +=
        (targetMouse[0] - uniforms.uMouse.value[0]) * mouseEase;
      uniforms.uMouse.value[1] +=
        (targetMouse[1] - uniforms.uMouse.value[1]) * mouseEase;
      render(now, false);
      animationFrame =
        intersecting && visible && motionEnabled ? requestAnimationFrame(animate) : 0;
    }

    function refreshAnimation() {
      if (intersecting && visible && motionEnabled) {
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

    function coordinates(event) {
      const rect = container.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / cellWidth,
        y: (event.clientY - rect.top) / cellHeight,
      };
    }

    function positionLabel(event) {
      if (!labelRef.current) return;
      const rect = container.getBoundingClientRect();
      labelRef.current.style.left = `${event.clientX - rect.left}px`;
      labelRef.current.style.top = `${event.clientY - rect.top}px`;
    }

    const abortController = new AbortController();
    const { signal } = abortController;
    if (interactive) {
      container.addEventListener(
        "pointermove",
        (event) => {
          const point = coordinates(event);
          targetMouse[0] = point.x;
          targetMouse[1] = point.y;
          positionLabel(event);
        },
        { passive: true, signal },
      );
      container.addEventListener(
        "pointerenter",
        (event) => {
          const point = coordinates(event);
          targetMouse[0] = point.x;
          targetMouse[1] = point.y;
          uniforms.uMouse.value[0] = point.x;
          uniforms.uMouse.value[1] = point.y;
          targetInfluence = 1;
          positionLabel(event);
          setHovering(true);
        },
        { signal },
      );
      const leave = () => {
        targetInfluence = 0;
        setHovering(false);
      };
      container.addEventListener("pointerleave", leave, { signal });
      container.addEventListener("pointercancel", leave, { signal });
      container.addEventListener(
        "click",
        (event) => {
          const point = coordinates(event);
          ripples.push({ start: elapsed, x: point.x, y: point.y });
          while (ripples.length > MAX_RIPPLES) ripples.shift();
        },
        { signal },
      );
    }

    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        render();
      }, 80);
    });
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? true;
      refreshAnimation();
    });
    intersectionObserver.observe(container);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedMotion = () => {
      motionEnabled = !reducedMotion.matches;
      if (!motionEnabled) {
        uniforms.uEntranceStart.value = -1e9;
        uniforms.uMouseInfluence.value = 0;
        uniforms.uActiveRippleCount.value = 0;
        targetInfluence = 0;
        ripples.length = 0;
        for (let index = 0; index < MAX_RIPPLES; index += 1) {
          uniforms.uRippleStarts.value[index] = -1;
        }
      }
      refreshAnimation();
    };
    const onVisibility = () => {
      visible = !document.hidden;
      refreshAnimation();
    };
    document.addEventListener("visibilitychange", onVisibility, { signal });
    reducedMotion.addEventListener("change", onReducedMotion, { signal });

    resize();
    render();
    refreshAnimation();
    fontReady.then(() => {
      if (signal.aborted) return;
      const refreshed = createGlyphAtlas(data.atlas, data.glyphAspect);
      atlasTexture.image = refreshed.canvas;
      atlasTexture.needsUpdate = true;
      render();
    });

    return () => {
      abortController.abort();
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(resizeTimer);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    backgroundColor,
    backgroundOnly,
    color,
    data,
    entrance,
    interactive,
    maxFps,
    modelLayout,
    pixelRatio,
  ]);

  return (
    <div
      ref={containerRef}
      className={`glyph-field ${interactive ? "is-interactive" : ""} ${className}`.trim()}
      style={{ backgroundColor, ...style }}
    >
      {interactive ? (
        <span
          ref={labelRef}
          className={`glyph-field__label ${hovering ? "is-visible" : ""}`}
          aria-hidden="true"
        >
          Click
        </span>
      ) : null}
    </div>
  );
}
