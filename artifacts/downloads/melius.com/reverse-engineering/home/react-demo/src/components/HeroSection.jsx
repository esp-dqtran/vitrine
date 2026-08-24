import { useEffect, useRef, useState } from "react";

const HERO_IMAGES = [
  "c744197fe7a316ffb1a7.webp", "a70e8a1fa357d7d8b4e9.webp", "f7bc251e57e3f9034df4.webp", "1c2f50a2c5c464e40073.webp",
  "37852bcf5c6bfaaab8ff.webp", "1a6e7add8a1fd085a80e.webp", "9bbdd5eccadaf549fe64.webp", "653bd6e4a73cbea877d0.webp",
  "70f8984d420f980d8880.webp", "a2a1c53543141a5a1d56.webp", "d27bff07ce3bbfe5cfaa.webp", "df6486e27575c6b99135.webp",
  "170c66740407a99b8e6e.webp", "1bc32a267dd98ac82483.webp", "892c27896e0502d9e70e.webp", "2604c2624531e684227c.webp",
  "16432f13146141542883.webp", "247724fee58885732724.webp", "afe73f171d27fc3dd0f8.webp", "a480c428f5c7816cb9c1.webp",
  "3d2daf349971830b0927.webp", "f88f24a8612b295ee20b.webp", "0345cc7b45c4ceb43c1f.webp", "2da0635abbe3be67d2b6.webp",
];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (min, max, value) => {
  const x = clamp((value - min) / (max - min));
  return x * x * (3 - 2 * x);
};
const easeInOutPower3 = (value) => value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
const easeOutPower4 = (value) => 1 - Math.pow(1 - value, 4);

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Hero shader failed");
  return shader;
}

function program(gl, vertex, fragment) {
  const result = gl.createProgram();
  gl.attachShader(result, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(result, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(result);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) || "Hero program failed");
  return result;
}

const CARD_VERTEX = `
attribute vec2 aPosition;
attribute vec2 aUv;
varying vec2 vUv;
void main(){ vUv=aUv; gl_Position=vec4(aPosition,0.0,1.0); }
`;

const CARD_FRAGMENT = `
precision highp float;
uniform sampler2D tMap;
varying vec2 vUv;
float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q=abs(p)-b+r;
  return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;
}
void main(){
  if(sdRoundBox(vUv*2.0-1.0,vec2(1.0),0.04)>0.0) discard;
  gl_FragColor=texture2D(tMap,vUv);
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

function HeroBackgroundCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  return <canvas className="hero__background-canvas" ref={ref} />;
}

function HeroWebGL({ assetBase, assetUrls }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: true, antialias: true, depth: false, premultipliedAlpha: false });
    if (!gl) return undefined;

    let disposed = false;
    let frame = 0;
    let visible = true;
    let width = 1;
    let height = 1;
    let sceneTexture;
    let framebuffer;
    let renderbuffer;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();

    const cardProgram = program(gl, CARD_VERTEX, CARD_FRAGMENT);
    const postProgram = program(gl, CARD_VERTEX, POST_FRAGMENT);
    const cardBuffer = gl.createBuffer();
    const postBuffer = gl.createBuffer();
    const fullscreen = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, -1,1,0,1, 1,-1,1,0, 1,1,1,1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, postBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fullscreen, gl.STATIC_DRAW);

    const images = HERO_IMAGES.map((file, id) => new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve({ id, image, aspect: image.naturalWidth / image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = assetUrls?.[file] ?? `${assetBase}${file}`;
    }));

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
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

    function bindAttributes(activeProgram, buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const position = gl.getAttribLocation(activeProgram, "aPosition");
      const uv = gl.getAttribLocation(activeProgram, "aUv");
      gl.enableVertexAttribArray(position);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    }

    function render(cards) {
      resize();
      const elapsed = reduced ? 4.5 : (performance.now() - startedAt) / 1000;
      const desktop = width >= 1024;
      const reveal = reduced ? 1 : easeInOutPower3(clamp(elapsed / 1.75));
      const zoom = reduced ? 0.5 : 1.2 + (0.5 - 1.2) * easeInOutPower3(clamp(elapsed / 1.5));
      const baseWidth = width * (desktop ? 0.75 : 1.2);
      const growthStart = desktop ? 0.2 : 0.3;
      const poolStep = 0.9 / 9.6;
      const moving = cards.map((card, index) => {
        const poolIndex = Math.floor(index / 2);
        const progress = reduced ? (poolIndex * poolStep + 0.43) % 1 : (elapsed / 9.6 + poolIndex * poolStep) % 1;
        const revealedProgress = progress * reveal;
        let travel = smoothstep(0, 1, revealedProgress);
        travel = 0.5 * travel * travel + 0.5 * travel;
        const cardScale = 0.125 * smoothstep(0, 0.15, revealedProgress) + 0.875 * smoothstep(growthStart, 1, revealedProgress);
        return { ...card, progress, travel, scale: cardScale * zoom, order: travel + cardScale };
      }).sort((a, b) => a.order - b.order);

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(cardProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      bindAttributes(cardProgram, cardBuffer);
      gl.uniform1i(gl.getUniformLocation(cardProgram, "tMap"), 0);

      moving.forEach((card) => {
        if (card.scale <= 0.002) return;
        const direction = card.id % 2 === 0 ? -1 : 1;
        const cardWidth = baseWidth * card.scale;
        const cardHeight = cardWidth / card.aspect;
        const centerX = width / 2 + direction * width * 1.65 * card.travel * zoom;
        const centerY = height / 2;
        const x0 = centerX - cardWidth / 2;
        const x1 = centerX + cardWidth / 2;
        const y0 = centerY - cardHeight / 2;
        const y1 = centerY + cardHeight / 2;
        const left = x0 / width * 2 - 1;
        const right = x1 / width * 2 - 1;
        const top = 1 - y0 / height * 2;
        const bottom = 1 - y1 / height * 2;
        const vertices = new Float32Array([left,bottom,0,0, right,bottom,1,0, left,top,0,1, left,top,0,1, right,bottom,1,0, right,top,1,1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, cardBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, card.texture);
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
      const cylindrical = reduced ? 0.7 : 1 - 0.3 * easeOutPower4(clamp(elapsed / 2));
      gl.uniform1f(gl.getUniformLocation(postProgram, "uCylindricalFactor"), cylindrical);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduced && visible && !disposed) frame = requestAnimationFrame(() => render(cards));
    }

    let textures = [];
    Promise.all(images).then((loaded) => {
      if (disposed) return;
      textures = loaded.filter(Boolean).map((item) => ({ ...item, texture: createTexture(gl, item.image) }));
      render(textures);
    });

    const observer = new IntersectionObserver(([entry]) => {
      const nextVisible = entry.isIntersecting;
      if (nextVisible && !visible && textures.length && !reduced) {
        visible = true;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => render(textures));
      } else visible = nextVisible;
    });
    observer.observe(canvas);
    const onResize = () => textures.length && render(textures);
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      disposed = true;
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
  }, [assetBase, assetUrls]);

  return <canvas aria-hidden="true" className="hero-webgl" ref={canvasRef} />;
}

export function HeroSection({ assetBase = "/assets/", assetUrls }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  return <section className="hero" data-background="gray-background" id="hero">
    <div className="hero__background" aria-hidden="true">
      <div className="hero__dot-field"><HeroBackgroundCanvas /></div>
    </div>
    <div className="hero__scene" aria-hidden="true">
      <div className="hero__mask">
        <svg viewBox="0 0 8015 1515" xmlns="http://www.w3.org/2000/svg"><path d="m416.739 1466.24-188.798 43.67C111.464 1536.88 0 1448.35 0 1328.79V186.225C0 66.67 111.464-21.862 227.941 5.103l188.798 43.67C1235.42 238.246 2072.96 333.938 2913.36 333.938h2187.52c840.4 0 1677.94-95.691 2496.62-285.165l188.8-43.908c116.48-26.965 227.94 61.567 227.94 181.36V1328.79c0 119.56-111.46 208.09-227.94 181.12l-188.32-43.67c-818.44-189.47-1655.98-284.92-2496.14-284.92h-2189.2c-840.16 0-1677.46 95.69-2495.901 284.92" fill="#202020" id="melius" /></svg>
      </div>
      <div className="hero__webgl-container"><HeroWebGL assetBase={assetBase} assetUrls={assetUrls} /></div>
    </div>
    <div className="hero__content">
      <h1 data-entered={entered ? "true" : "false"}><span>One platform.</span><span>Every creative outcome.</span></h1>
      <div className="hero__intro" data-entered={entered ? "true" : "false"}>
        <div className="hero__copy"><p>Be the creative director. Let agents be your team.<br />Brief our agent Mel, watch the work assemble, and steer any prompt until the output lands exactly as you imagined.</p></div>
        <div aria-hidden="true" className="hero__prompt-slot" id="hero-prompt-slot" />
      </div>
    </div>
  </section>;
}
