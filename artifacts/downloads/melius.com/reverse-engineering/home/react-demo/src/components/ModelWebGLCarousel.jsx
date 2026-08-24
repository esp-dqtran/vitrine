import { useCallback, useEffect, useRef } from "react";

import { ModelCarouselControls } from "./ModelCarouselControls";

export const MODEL_PROVIDERS = [
  ["Google", "d8a16ed11aa3a2fb404c.webp"], ["OpenAI", "3c5835ba0efc3539bbd4.webp"],
  ["ElevenLabs", "f11f5118fbe0f269f736.webp"], ["Sync Labs", "96906e71bcecf1f9148c.webp"],
  ["Mistral", "28d25b4b131f75ab8cdc.webp"], ["DeepSeek", "bdc48656e02c57768270.webp"],
  ["PixVerse", "50c956f451f3c0e63e52.webp"], ["ByteDance", "3053ee7bd66a498928e9.webp"],
  ["KlingAI", "6a2523e389e31cddbeea.webp"], ["Black Forest Labs", "be9d3f1f828c5bcaf77c.webp"],
  ["Topaz Labs", "b053db6f6fceeddc7baa.webp"], ["MultiTalk", "a3bf3502a6ebbf691085.webp"],
  ["HeyGen", "c2bef62c899cfb98dcce.webp"], ["Vidu", "e0fed2aed80704e798bc.webp"],
  ["Meta", "af3050fb7d311b286ce3.webp"], ["xAI", "d71fd7fb5ace372115c1.webp"],
  ["Lightricks", "ec355877de633fbb52ef.webp"],
];

const CAMERA_HEIGHT = 2 * Math.tan(Math.PI / 8) * 5;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const modulo = (value, length) => ((value % length) + length) % length;
const easeOutPower2 = (value) => 1 - Math.pow(1 - value, 2);
const easeOutPower3 = (value) => 1 - Math.pow(1 - value, 3);
const easeOutPower4 = (value) => 1 - Math.pow(1 - value, 4);

const VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUv;
varying vec2 vUv;
void main(){ vUv=aUv; gl_Position=vec4(aPosition,0.0,1.0); }
`;

const CARD_FRAGMENT = `
precision highp float;
uniform sampler2D tMap;
uniform float uAlpha;
varying vec2 vUv;
void main(){
  vec4 color=texture2D(tMap,vUv);
  gl_FragColor=vec4(color.rgb,color.a*uAlpha);
}
`;

const POST_FRAGMENT = `
precision highp float;
uniform sampler2D inputBuffer;
uniform float uCylindricalFactor;
varying vec2 vUv;
void main(){
  float stretchedY=vUv.y*uCylindricalFactor+(1.0-uCylindricalFactor)*0.5;
  float xFactor=pow(abs(0.5-vUv.x)*2.0,2.0);
  vec2 uv=vUv;
  uv.y=mix(vUv.y,stretchedY,xFactor);
  gl_FragColor=texture2D(inputBuffer,uv);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Models shader failed");
  return shader;
}

function makeProgram(gl, vertex, fragment) {
  const result = gl.createProgram();
  gl.attachShader(result, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(result, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(result);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) || "Models program failed");
  return result;
}

function createTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return texture;
}

function ModelBackgroundCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const draw = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(255,255,255,.08)";
      for (let y = 7.5; y < height; y += 15) for (let x = 7.5; x < width; x += 15) context.fillRect(x, y, 1, 1);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  return <canvas className="model-webgl-section__background-canvas" ref={canvasRef} />;
}

function ModelCanvas({ assetBase, assetUrls, carouselApiRef, shuttleRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: true, antialias: true, depth: false, premultipliedAlpha: false });
    if (!gl) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { current: 0, target: 0, pitch: 1.3, visible: false, enteredAt: 0, previousTime: 0, ready: false };
    let disposed = false;
    let frame = 0;
    let width = 1;
    let height = 1;
    let sceneTexture;
    let framebuffer;
    let renderbuffer;

    const cardProgram = makeProgram(gl, VERTEX_SHADER, CARD_FRAGMENT);
    const postProgram = makeProgram(gl, VERTEX_SHADER, POST_FRAGMENT);
    const cardBuffer = gl.createBuffer();
    const postBuffer = gl.createBuffer();
    const fullscreen = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, -1,1,0,1, 1,-1,1,0, 1,1,1,1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, postBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fullscreen, gl.STATIC_DRAW);

    function bindAttributes(activeProgram, buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const position = gl.getAttribLocation(activeProgram, "aPosition");
      const uv = gl.getAttribLocation(activeProgram, "aUv");
      gl.enableVertexAttribArray(position);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      state.pitch = width < 768 ? 1.1 : 1.3;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      if (sceneTexture) gl.deleteTexture(sceneTexture);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      if (renderbuffer) gl.deleteRenderbuffer(renderbuffer);
      sceneTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pixelWidth, pixelHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTexture, 0);
      renderbuffer = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, pixelWidth, pixelHeight);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    let textures = [];
    function requestRender() {
      if (!frame && state.visible && textures.length && !disposed) frame = requestAnimationFrame(render);
    }
    function setTarget(next) {
      state.target = next;
      canvas.dataset.target = state.target.toFixed(4);
      requestRender();
    }

    function render(time) {
      frame = 0;
      if (disposed || !state.visible || !textures.length) return;
      resize();
      const elapsed = reduced ? 2 : Math.max(0, (time - state.enteredAt) / 1000);
      const dt = state.previousTime ? Math.min(50, time - state.previousTime) : 16.6667;
      state.previousTime = time;
      if (reduced) state.current = state.target;
      else state.current += (state.target - state.current) * (1 - Math.pow(0.9, dt / 16.6667));

      const mobile = width < 768;
      const visibleWidth = CAMERA_HEIGHT * (width / height);
      const pixelsPerWorld = height / CAMERA_HEIGHT;
      const cardWidthWorld = mobile ? 0.9 : 1.1;
      const cardHeightWorld = cardWidthWorld / (512 / 487);
      const totalWidth = MODEL_PROVIDERS.length * state.pitch;

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(cardProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      bindAttributes(cardProgram, cardBuffer);
      gl.uniform1i(gl.getUniformLocation(cardProgram, "tMap"), 0);

      textures.forEach((card, index) => {
        const centerWorld = modulo(index * state.pitch + state.current + totalWidth / 2, totalWidth) - totalWidth / 2;
        if (centerWorld < -visibleWidth / 2 - cardWidthWorld || centerWorld > visibleWidth / 2 + cardWidthWorld) return;
        const distance = Math.abs(centerWorld / state.pitch);
        const staggerElapsed = Math.max(0, elapsed - Math.min(3, distance) * 0.1);
        const entrance = reduced ? 1 : easeOutPower4(clamp(staggerElapsed / 1.25));
        const scaleX = reduced ? 1 : 0.75 + 0.25 * easeOutPower3(clamp(staggerElapsed / 0.75));
        const scaleY = reduced ? 1 : 0.85 + 0.15 * easeOutPower3(clamp(staggerElapsed / 0.75));
        const alpha = reduced ? 1 : easeOutPower2(clamp(staggerElapsed / 0.75));
        const centerX = width / 2 + centerWorld * pixelsPerWorld;
        const centerY = height / 2 + (mobile ? 0.65 : 0.85) * (1 - entrance) * pixelsPerWorld;
        const cardWidth = cardWidthWorld * pixelsPerWorld * scaleX;
        const cardHeight = cardHeightWorld * pixelsPerWorld * scaleY;
        const left = (centerX - cardWidth / 2) / width * 2 - 1;
        const right = (centerX + cardWidth / 2) / width * 2 - 1;
        const top = 1 - (centerY - cardHeight / 2) / height * 2;
        const bottom = 1 - (centerY + cardHeight / 2) / height * 2;
        const vertices = new Float32Array([left,bottom,0,0, right,bottom,1,0, left,top,0,1, left,top,0,1, right,bottom,1,0, right,top,1,1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, cardBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, card.texture);
        gl.uniform1f(gl.getUniformLocation(cardProgram, "uAlpha"), alpha);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(postProgram);
      gl.disable(gl.BLEND);
      bindAttributes(postProgram, postBuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
      gl.uniform1i(gl.getUniformLocation(postProgram, "inputBuffer"), 0);
      const cylindricalTarget = mobile ? 0.85 : 0.7;
      const cylindrical = reduced ? cylindricalTarget : 1 - (1 - cylindricalTarget) * easeOutPower4(clamp(elapsed / 1.5));
      gl.uniform1f(gl.getUniformLocation(postProgram, "uCylindricalFactor"), cylindrical);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // The downloaded source intentionally wraps by .999, so the idle shuttle
      // begins at .001 instead of a mathematically exact zero.
      const progress = modulo(modulo(-state.current / totalWidth, 1) + 1, 0.999);
      if (shuttleRef.current) shuttleRef.current.style.transform = `translate3d(${progress * 105}px,0,0)`;
      canvas.dataset.offset = state.current.toFixed(4);
      canvas.dataset.target = state.target.toFixed(4);
      canvas.dataset.progress = progress.toFixed(4);
      if (Math.abs(state.target - state.current) > 0.0001 || (!reduced && elapsed < 1.75)) frame = requestAnimationFrame(render);
    }

    const loading = MODEL_PROVIDERS.map(([, file], index) => new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve({ index, texture: createTexture(gl, image) });
      image.onerror = () => resolve(null);
      image.src = assetUrls?.[file] ?? `${assetBase}${file}`;
    }));

    carouselApiRef.current = {
      next: () => setTarget(Math.round(state.target / state.pitch) * state.pitch - state.pitch),
      previous: () => setTarget(Math.round(state.target / state.pitch) * state.pitch + state.pitch),
      drag: (relativeX, startTarget) => setTarget(startTarget + relativeX * CAMERA_HEIGHT * (width / height)),
      snap: () => setTarget(Math.round(state.target / state.pitch) * state.pitch),
      wheel: (delta) => setTarget(state.target - delta * 0.003),
      target: () => state.target,
      ready: () => state.ready,
    };

    Promise.all(loading).then((loaded) => {
      if (disposed) return;
      textures = loaded.filter(Boolean).sort((a, b) => a.index - b.index);
      state.ready = textures.length === MODEL_PROVIDERS.length;
      canvas.dataset.ready = String(state.ready);
      canvas.style.opacity = state.ready ? "1" : "0";
      resize();
      requestRender();
    });

    const observer = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting;
      if (state.visible) {
        if (!state.enteredAt) state.enteredAt = performance.now();
        state.previousTime = 0;
        requestRender();
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }, { rootMargin: "0px 0px 50% 0px" });
    observer.observe(canvas);
    const onResize = () => requestRender();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      disposed = true;
      carouselApiRef.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      textures.forEach(({ texture }) => gl.deleteTexture(texture));
      if (sceneTexture) gl.deleteTexture(sceneTexture);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      if (renderbuffer) gl.deleteRenderbuffer(renderbuffer);
      gl.deleteBuffer(cardBuffer);
      gl.deleteBuffer(postBuffer);
      gl.deleteProgram(cardProgram);
      gl.deleteProgram(postProgram);
    };
  }, [assetBase, assetUrls, carouselApiRef, shuttleRef]);

  return <canvas aria-hidden="true" className="model-webgl-section__canvas" data-card-count={MODEL_PROVIDERS.length} data-engine="native-webgl" data-pitch="1.3000" data-progress="0.0010" data-ready="false" data-target="0.0000" ref={canvasRef} />;
}

export function ModelWebGLCarousel({ assetBase = "/assets/", assetUrls }) {
  const carouselApiRef = useRef(null);
  const dragRef = useRef(null);
  const dragSurfaceRef = useRef(null);
  const shuttleRef = useRef(null);
  const previous = useCallback(() => carouselApiRef.current?.previous(), []);
  const next = useCallback(() => carouselApiRef.current?.next(), []);
  const pointerDown = useCallback((event) => {
    if (!carouselApiRef.current?.ready() || (event.button !== 0 && event.button !== -1)) return;
    dragRef.current = { x: event.clientX, target: carouselApiRef.current?.target() || 0 };
    document.body.style.cursor = "grabbing";
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const pointerMove = useCallback((event) => {
    if (!dragRef.current) return;
    carouselApiRef.current?.drag((event.clientX - dragRef.current.x) / (event.currentTarget.clientWidth || 1), dragRef.current.target);
  }, []);
  const pointerUp = useCallback((event) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    document.body.style.cursor = "";
    carouselApiRef.current?.snap();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);
  const wheel = useCallback((event) => {
    const horizontal = event.shiftKey ? event.deltaY : event.deltaX;
    if (!event.shiftKey && Math.abs(event.deltaY) >= Math.abs(event.deltaX)) return;
    event.preventDefault();
    carouselApiRef.current?.wheel(horizontal);
  }, []);

  useEffect(() => {
    const surface = dragSurfaceRef.current;
    if (!surface) return undefined;
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => surface.removeEventListener("wheel", wheel);
  }, [wheel]);

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  return <section className="model-webgl-section" id="models">
    <div aria-hidden="true" className="model-webgl-section__background"><ModelBackgroundCanvas /></div>
    <div className="model-webgl-section__render-layer">
      <ModelCanvas assetBase={assetBase} assetUrls={assetUrls} carouselApiRef={carouselApiRef} shuttleRef={shuttleRef} />
      <div aria-hidden="true" className="model-webgl-section__drag" onPointerCancel={pointerUp} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} ref={dragSurfaceRef} />
      <ModelCarouselControls className="model-webgl-section__controls" onNext={next} onPrevious={previous} shuttleRef={shuttleRef} />
      <div className="sr-only" role="group" aria-label="Available AI models"><ul>{MODEL_PROVIDERS.map(([name]) => <li key={name}>{name}</li>)}</ul></div>
    </div>
    <div className="model-webgl-section__heading"><h2>One subscription.<br />Every image &amp; video model.</h2></div>
  </section>;
}
