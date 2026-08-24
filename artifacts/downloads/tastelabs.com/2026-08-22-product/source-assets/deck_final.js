

(function () {
  "use strict";

  const canvas = document.getElementById("deck");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: false,
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  /* ---- Bunny CDN assets (absolute paths, fixed list) ---- */
  const ASSET_BASE = "https://footertaste.b-cdn.net/";
  const CARD_URL   = "https://footertaste.b-cdn.net/card.png";
  const HEX_IMAGES = [
    "0f76a459fdec8ae13af949e3fb865c57137a4f85.png",
    "276c135b4254309c274010e0361414d09395c2ee.png",
    "2d0dfffdec136b2454ff060456a207b80e19d863.png",
    "422bd6299cb4ef1494c2813aa0acdd6739346d10.png",
    "435ef17f31a8b8818eca668ef21c807aed729aa2.png",
    "46fc3bf6d901c97c2566930f4ee9621a73c483d7.jpg",
    "4ccd30439df99379dcfe655af0bd1e8d3d2940ff.png",
    "521baef0b44c6a08d64244dc9bc16c9e55e63f71.png",
    "638fd8e8773dcc799b28de7c623e8f7662556840.jpg",
    "6527e06483138d050995ea1f8dd6b650bf0a050a.png",
    "751c027fd08529f057e201c04de5822dda5c92bb.png",
    "796831b1c25e300e973962986dccbb03decabb8a.png",
    "7a043ae6831181b88e10c9c202fcc62f26654d4a.png",
    "7a37d9dca630dc330008d2467353d459551f8bd1.png",
    "7d80dd3bf92ab1e247f578f5d8f876df0160736c.png",
    "8311afc81230a9d65b0cd7dcbd5d9f649861ed2d.png",
    "8cc19372e068a84dbc660c56778201b9646afa7f.png",
    "8f357800c97c101f8b9b9d26aa1df60fefc28374.png",
    "9175aae4c60d5fc222f38e920c8b161328f8e783.png",
    "b5622cf06fd2d9fe0956236543d2b51ad84b9e7b.png",
    "c9df02c959c4a3ee89043502e08cd0b4babaa3af.png",
    "cb1d6f92c66a748b997f01ad87e70ed4fb39eee0.png"
  ].map(function (f) { return ASSET_BASE + f; });

  const SLOTS = 11;
  const TILE_RATIO = 1;

  /* --- Tunables -------------------------------------------------- */
  const GRID = 50;
  const POINT_OVERLAP = 1.4;
  const ALPHA_CUTOFF = 120;
  const DAMP_RATIO = 1.0;
  const K_MIN = 28, K_MAX = 150;
  const ORBIT_SPEED = 0.55;
  const ORBIT_NOISE = 0.10;
  const DRAG_FBM = 0.42;
  const DRAG_FBM_SCALE = 0.006;
  const DRAG_FBM_DRIFT = 0.28;
  const MORPH_RATE = 3.2;
  const SETTLE_DELAY = 1.4;
  const MAX_RINGS = 7;
  const FAVORITES = 4;
  const CARD_REVEAL_RATE = 2.0;
  const CARD_TILT = 0.15;
  const CARD_SHEEN = 0.17;
  const ORBIT_FRACTION = 0.01;
  const ORBIT_DUR = 12.0;
  const ORBIT_GAP = ORBIT_DUR * (1 / ORBIT_FRACTION - 1);

  const TILT_GLSL = `
    uniform vec2  uTilt;
    uniform vec2  uTiltPivot;
    uniform float uFocal;
    vec2 applyTilt(vec2 p2, out float persp) {
      persp = 1.0;
      if (uTilt.x == 0.0 && uTilt.y == 0.0) return p2;
      vec3 p = vec3(p2 - uTiltPivot, 0.0);
      float cx = cos(uTilt.x), sx = sin(uTilt.x);
      float cy = cos(uTilt.y), sy = sin(uTilt.y);
      p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
      p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
      persp = uFocal / (uFocal - p.z);
      return uTiltPivot + p.xy * persp;
    }
  `;
  const VERT = `
    precision highp float;
    attribute vec2 aOffset;
    attribute vec4 aColor;
    attribute vec2 aPos;
    attribute float aThresh;
    uniform vec2  uCenter;
    uniform float uSize;
    uniform vec2  uRes;
    uniform float uFree;
    uniform float uPointSize;
    uniform float uDpr;
    uniform float uSnap;
    varying vec4 vColor;
    varying float vThresh;
    ${TILT_GLSL}
    void main () {
      vec2 px = mix(uCenter + aOffset * uSize, aPos, uFree);
      if (uSnap > 0.5) { vec2 dev = px * uDpr; px = (floor(dev) + 0.5) / uDpr; }
      float persp;
      px = applyTilt(px, persp);
      gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
      gl_PointSize = uPointSize * persp;
      vColor = aColor;
      vThresh = aThresh;
    }
  `;
  const FRAG = `
    precision highp float;
    varying vec4 vColor;
    varying float vThresh;
    uniform float uMorph;
    uniform float uAlpha;
    void main () {
      if (uMorph < vThresh) discard;
      vec2 d = gl_PointCoord - 0.5;
      float r = dot(d, d);
      if (r > 0.25) discard;
      float m = smoothstep(0.25, 0.16, r);
      float fade = smoothstep(vThresh, vThresh + 0.06, uMorph);
      float a = vColor.a * m * fade * uAlpha;
      gl_FragColor = vec4(vColor.rgb * a, a);
    }
  `;
  const VERT_Q = `
    precision highp float;
    attribute vec2 aQuad;
    uniform vec2 uCenter;
    uniform vec2 uHalf;
    uniform vec2 uRes;
    varying vec2 vUv;
    ${TILT_GLSL}
    void main () {
      vUv = vec2(aQuad.x * 0.5 + 0.5, 0.5 - aQuad.y * 0.5);
      vec2 ndc0 = uCenter + aQuad * uHalf;
      vec2 px = vec2((ndc0.x + 1.0) * 0.5 * uRes.x, (1.0 - ndc0.y) * 0.5 * uRes.y);
      float persp;
      px = applyTilt(px, persp);
      vec2 ndc = vec2(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0);
      float w = uFocal / persp;
      gl_Position = vec4(ndc * w, 0.0, w);
    }
  `;
  const FRAG_Q = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform sampler2D uNoise;
    uniform float uMorph;
    uniform float uSheen;
    uniform float uSheenPos;
    void main () {
      float thr = texture2D(uNoise, vUv).r;
      if (uMorph > thr) discard;
      vec4 c = texture2D(uTex, vUv);
      if (uSheen > 0.0) {
        float coord = dot(vUv - 0.5, vec2(0.7071, -0.7071));
        float e = (coord - uSheenPos) / 0.18;
        float s = exp(-e * e) * uSheen;
        c.rgb += s * c.a;
      }
      gl_FragColor = c;
    }
  `;
  const FRAG_SHADOW = `
    precision highp float;
    varying vec2 vUv;
    uniform float uAlpha;
    void main () {
      vec2 d = abs(vUv - 0.5) * 2.0;
      float r = max(d.x, d.y);
      float a = smoothstep(1.0, 0.25, r) * uAlpha;
      gl_FragColor = vec4(0.0, 0.0, 0.0, a);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  function link(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
    return p;
  }

  const prog = link(VERT, FRAG);
  const U = {};
  ["uCenter", "uSize", "uRes", "uFree", "uPointSize", "uDpr", "uSnap", "uMorph",
   "uTilt", "uTiltPivot", "uFocal", "uAlpha"].forEach(
    (n) => (U[n] = gl.getUniformLocation(prog, n)));
  const A = {
    offset: gl.getAttribLocation(prog, "aOffset"),
    color: gl.getAttribLocation(prog, "aColor"),
    pos: gl.getAttribLocation(prog, "aPos"),
    thresh: gl.getAttribLocation(prog, "aThresh"),
  };

  const progQ = link(VERT_Q, FRAG_Q);
  const UQ = {
    uCenter: gl.getUniformLocation(progQ, "uCenter"),
    uHalf: gl.getUniformLocation(progQ, "uHalf"),
    uRes: gl.getUniformLocation(progQ, "uRes"),
    uTex: gl.getUniformLocation(progQ, "uTex"),
    uNoise: gl.getUniformLocation(progQ, "uNoise"),
    uMorph: gl.getUniformLocation(progQ, "uMorph"),
    uTilt: gl.getUniformLocation(progQ, "uTilt"),
    uTiltPivot: gl.getUniformLocation(progQ, "uTiltPivot"),
    uFocal: gl.getUniformLocation(progQ, "uFocal"),
    uSheen: gl.getUniformLocation(progQ, "uSheen"),
    uSheenPos: gl.getUniformLocation(progQ, "uSheenPos"),
  };
  const AQ = { quad: gl.getAttribLocation(progQ, "aQuad") };

  const progShadow = link(VERT_Q, FRAG_SHADOW);
  const US = {
    uCenter: gl.getUniformLocation(progShadow, "uCenter"),
    uHalf: gl.getUniformLocation(progShadow, "uHalf"),
    uRes: gl.getUniformLocation(progShadow, "uRes"),
    uTilt: gl.getUniformLocation(progShadow, "uTilt"),
    uTiltPivot: gl.getUniformLocation(progShadow, "uTiltPivot"),
    uFocal: gl.getUniformLocation(progShadow, "uFocal"),
    uAlpha: gl.getUniformLocation(progShadow, "uAlpha"),
  };
  const ASq = { quad: gl.getAttribLocation(progShadow, "aQuad") };
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) { let val = 0, amp = 0.5; for (let o = 0; o < 4; o++) { val += amp * vnoise(x, y); x = x * 2 + 1.7; y = y * 2 + 9.2; amp *= 0.5; } return val; }

  const noiseField = new Float32Array(GRID * GRID);
  {
    let mn = Infinity, mx = -Infinity;
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
      const v = fbm(c * 0.18, r * 0.18); noiseField[r * GRID + c] = v;
      if (v < mn) mn = v; if (v > mx) mx = v;
    }
    const inv = 1 / Math.max(1e-5, mx - mn);
    for (let i = 0; i < noiseField.length; i++) noiseField[i] = 0.03 + (noiseField[i] - mn) * inv * 0.87;
  }
  const noiseTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, noiseTex);
  const nbytes = new Uint8Array(GRID * GRID);
  for (let i = 0; i < nbytes.length; i++) nbytes[i] = Math.round(noiseField[i] * 255);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, GRID, GRID, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, nbytes);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const ALPHA_RES = 72;
  let assets = [];

  function drawCover(ctx, img, size) {
    const s = Math.max(size / img.width, size / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  }
  const MASK_VB = [184, 186];
  const MASK_PATH2D = new Path2D(
    "M91.6646 0.041662C98.1264 0.041662 103.66 0.79153 108.341 2.24961C113.023 3.70769 117.55 6.1656 122 9.54002L169.013 44.9089C173.462 48.2833 176.906 51.8244 179.344 55.5321C182.014 59.3647 183.329 63.8639 183.329 69.0297V116.813C183.329 121.979 182.091 126.395 179.653 130.102C177.216 133.935 173.656 137.56 168.974 140.934L145.487 158.639L122 176.344C117.318 179.719 112.675 182.177 107.993 183.635C103.543 185.093 98.0877 185.843 91.6646 185.843C85.2415 185.843 79.6697 185.093 74.9878 183.635C70.538 182.177 65.9722 179.719 61.329 176.344L37.8421 158.639L14.3552 140.934C9.67333 137.56 6.11355 133.935 3.67587 130.102C1.23819 126.436 0 121.979 0 116.813L0 69.0297C0 63.8639 1.23819 59.3647 3.67587 55.5321C6.11355 51.866 9.67333 48.325 14.3552 44.9089L37.8421 27.2036L61.329 9.49836C66.0109 6.12394 70.538 3.66603 74.9878 2.20795C79.6697 0.749871 85.2028 0 91.6646 0V0.041662Z"
  );
  function clipHex(ctx, size) {
    const s = size / MASK_VB[1];
    ctx.save();
    ctx.translate((size - MASK_VB[0] * s) / 2, 0);
    ctx.scale(s, s);
    ctx.fill(MASK_PATH2D);
    ctx.restore();
  }
  function buildMasked(img, size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const cx = c.getContext("2d");
    drawCover(cx, img, size);
    cx.globalCompositeOperation = "destination-in";
    clipHex(cx, size);
    cx.globalCompositeOperation = "source-over";
    return c;
  }

  function loadAsset(as) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const masked = buildMasked(img, 256);
      const g = document.createElement("canvas");
      g.width = g.height = GRID;
      const gx = g.getContext("2d");
      gx.drawImage(masked, 0, 0, GRID, GRID);
      const px = gx.getImageData(0, 0, GRID, GRID).data;

      const offs = [], cols = [], ths = [], rnds = [], ks = [], cs = [];
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        const p = (r * GRID + c) * 4, a = px[p + 3];
        if (a < ALPHA_CUTOFF) continue;
        offs.push((c + 0.5) / GRID - 0.5, (r + 0.5) / GRID - 0.5);
        cols.push(px[p] / 255, px[p + 1] / 255, px[p + 2] / 255, a / 255);
        ths.push(noiseField[r * GRID + c]);
        const rnd = Math.random(); rnds.push(rnd);
        const k = K_MIN + rnd * (K_MAX - K_MIN); ks.push(k);
        cs.push(2 * Math.sqrt(k) * DAMP_RATIO);
      }
      as.N = rnds.length;
      as.off = new Float32Array(offs);
      as.thresh = new Float32Array(ths);
      as.rnd = new Float32Array(rnds);
      as.k = new Float32Array(ks);
      as.c = new Float32Array(cs);

      as.bufOffset = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, as.bufOffset);
      gl.bufferData(gl.ARRAY_BUFFER, as.off, gl.STATIC_DRAW);
      as.col = new Float32Array(cols);
      as.bufColor = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, as.bufColor);
      gl.bufferData(gl.ARRAY_BUFFER, as.col, gl.STATIC_DRAW);
      as.bufThresh = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, as.bufThresh);
      gl.bufferData(gl.ARRAY_BUFFER, as.thresh, gl.STATIC_DRAW);

      as.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, as.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, masked);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.generateMipmap(gl.TEXTURE_2D);

      const ac = document.createElement("canvas");
      ac.width = ac.height = ALPHA_RES;
      const acx = ac.getContext("2d");
      acx.drawImage(masked, 0, 0, ALPHA_RES, ALPHA_RES);
      const ad = acx.getImageData(0, 0, ALPHA_RES, ALPHA_RES).data;
      as.alpha = new Uint8Array(ALPHA_RES * ALPHA_RES);
      for (let k = 0; k < as.alpha.length; k++) as.alpha[k] = ad[k * 4 + 3];

      as.loaded = true;
      seedInitialDeck();
    };
    img.src = as.src;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function initAssets(srcs) {
    assets = shuffle(srcs.slice()).map((src) => ({ src, loaded: false }));
    assets.forEach(loadAsset);
  }

  function randomAsset() {
    const ready = assets.filter((a) => a.loaded);
    if (!ready.length) return null;
    const inUse = new Set(instances.map((t) => t.asset));
    const free = ready.filter((a) => !inUse.has(a));
    const pool = free.length ? free : ready;
    return pool[(Math.random() * pool.length) | 0];
  }

  /* ---- Instances ---- */
  let W = 0, H = 0, dpr = 1, tileW = 120;
  let zoneLeftX = -1, zoneRightX = 1e9;
  let slotCount = SLOTS;
  const homes = [];
  const slots = new Array(SLOTS).fill(null);
  const instances = [];
  const yesPile = [], noPile = [];
  const MAXP = 20000;
  const SEP_R = 9;
  const gsnap = {
    yes: { x: new Float32Array(MAXP), y: new Float32Array(MAXP), n: 0 },
    no: { x: new Float32Array(MAXP), y: new Float32Array(MAXP), n: 0 },
  };
  const grid = {
    yes: { head: new Int32Array(1), next: new Int32Array(MAXP), cols: 0, rows: 0 },
    no: { head: new Int32Array(1), next: new Int32Array(MAXP), cols: 0, rows: 0 },
  };
  function buildGrid(key) {
    const s = gsnap[key], g = grid[key], n = s.n;
    const cols = Math.max(1, Math.ceil(W / SEP_R) + 1);
    const rows = Math.max(1, Math.ceil(H / SEP_R) + 1);
    const need = cols * rows;
    if (g.head.length < need) g.head = new Int32Array(need);
    g.head.fill(-1, 0, need);
    g.cols = cols; g.rows = rows;
    const head = g.head, next = g.next, sx = s.x, sy = s.y;
    for (let p = 0; p < n; p++) {
      let gx = (sx[p] / SEP_R) | 0; gx = gx < 0 ? 0 : gx >= cols ? cols - 1 : gx;
      let gy = (sy[p] / SEP_R) | 0; gy = gy < 0 ? 0 : gy >= rows ? rows - 1 : gy;
      const ci = gy * cols + gx;
      next[p] = head[ci]; head[ci] = p;
    }
  }
  let yesCount = 0, noCount = 0;
  let favoritesFired = false;
  let finale = false;
  let cardPS = 0;
  let cardCx = 0, cardCy = 0, cardR = 1;
  const zones = { yes: null, no: null };

  let cardAsset = null;
  let cardShown = false;
  let cardReveal = 0;
  let cardList = [];
  let tiltX = 0, tiltY = 0;
  let hexCx = 0, hexCy = 0;
  const cardQuad = { cx: 0, cy: 0, w: 0, h: 0 };
  const CARD_AR = 896 / 1152;
  const CARD_PANEL = { u0: 0.213, u1: 0.787, v0: 0.3605, v1: 0.7895 };

  function computeCardQuad() {
    const cx = hexCx || W * 0.72, cy = hexCy || H * 0.5;
    const boxW = 2 * Math.min(cx, W - cx) * 0.92, boxH = H * 0.86;
    const h = Math.min(boxH, boxW / CARD_AR);
    cardQuad.h = h;
    cardQuad.w = h * CARD_AR;
    cardQuad.cx = cx;
    cardQuad.cy = cy - 70 + (W <= 640 ? 6 : 0);
  }

  function loadCard() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      cardAsset = { tex, loaded: true };
    };
    img.src = CARD_URL;
  }

  function makeInstance(asset, slot, spawn) {
    if (!asset) return null;
    const N = asset.N;
    const inst = {
      asset, slot,
      x: 0, y: 0, scale: 1, near: 0,
      free: !!spawn, morph: spawn ? 1 : 0, morphTarget: spawn ? 0 : 0,
      state: "deck", grabOff: [0, 0], ringR: 60, orbit: 0, rebindAt: 0,
      disperse: 0, dispCx: 0, dispCy: 0,
      tx: null, ty: null,
      fx: new Float32Array(N), fy: new Float32Array(N),
      vx: new Float32Array(N), vy: new Float32Array(N),
      posArr: new Float32Array(N * 2),
      bufPos: gl.createBuffer(),
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, inst.posArr, gl.DYNAMIC_DRAW);

    const hx = homes[slot] ? homes[slot][0] : W / 2;
    const hy = homes[slot] ? homes[slot][1] : H / 2;
    inst.x = hx; inst.y = hy;
    if (spawn) {
      inst.rebindAt = 0;
      for (let i = 0; i < N; i++) {
        const ang = asset.rnd[i] * TAU * 3.17;
        const dist = tileW * (0.7 + asset.rnd[i] * 1.2);
        inst.fx[i] = hx + asset.off[2 * i] * tileW + Math.cos(ang) * dist;
        inst.fy[i] = hy + asset.off[2 * i + 1] * tileW + Math.sin(ang) * dist;
      }
    }
    if (slot >= 0) slots[slot] = inst;
    instances.push(inst);
    return inst;
  }

  function destroyInstance(inst) {
    const i = instances.indexOf(inst);
    if (i >= 0) instances.splice(i, 1);
    if (inst.bufPos) gl.deleteBuffer(inst.bufPos);
  }

  function seedInitialDeck() {
    for (let s = 0; s < slotCount; s++) {
      if (!slots[s] && assets[s] && assets[s].loaded) makeInstance(assets[s], s, false);
    }
  }

  function layout() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const mobile = W <= 640;
    slotCount = mobile ? 7 : SLOTS;
    tileW = mobile
      ? Math.max(62, Math.min(132, W * 0.195))
      : Math.max(46, Math.min(124, W * 0.078));
    const th = tileW * TILE_RATIO, gap = tileW * 0.05, stepX = tileW + gap;

    const sideC = {};
    [["yes"], ["no"]].forEach(([key]) => {
      const el = document.querySelector('.taste-footer-embed .hero__side[data-zone="' + key + '"]');
      if (!el) return;
      const lr = el.getBoundingClientRect();
      sideC[key] = {
        cx: lr.left - r.left + lr.width / 2,
        cy: lr.top - r.top + lr.height / 2,
        half: lr.width / 2,
      };
    });
    const clusterCx = W / 2;
    const clusterCy = sideC.yes && sideC.no ? (sideC.yes.cy + sideC.no.cy) / 2
      : sideC.yes ? sideC.yes.cy
      : sideC.no ? sideC.no.cy
      : H * 0.5;
    hexCx = clusterCx; hexCy = clusterCy;

    homes.length = 0;
    let halfW;
    if (mobile) {
      const dy = 0.832 * th;
      for (let i = 0; i < 2; i++) homes.push([clusterCx + (i - 0.5) * stepX, clusterCy - dy]);
      for (let i = 0; i < 3; i++) homes.push([clusterCx + (i - 1.0) * stepX, clusterCy]);
      for (let i = 0; i < 2; i++) homes.push([clusterCx + (i - 0.5) * stepX, clusterCy + dy]);
      halfW = 1.0 * stepX + tileW / 2;
    } else {
      const bottomY = clusterCy + th * 0.416, topY = bottomY - th * 0.832;
      const startX = clusterCx - 2.5 * stepX;
      for (let i = 0; i < 6; i++) homes.push([startX + i * stepX, bottomY]);
      for (let i = 0; i < 5; i++) homes.push([startX + stepX / 2 + i * stepX, topY]);
      halfW = 3.125 * tileW;
    }

    zoneLeftX = clusterCx - halfW - tileW * 0.35;
    zoneRightX = clusterCx + halfW + tileW * 0.35;

    slots.forEach((inst, s) => {
      if (!inst) return;
      if (s < slotCount) {
        if (!inst.free) { inst.x = homes[s][0]; inst.y = homes[s][1]; }
      } else if (!inst.free) {
        slots[s] = null;
        destroyInstance(inst);
      }
    });
    seedInitialDeck();

    zones.yes = sideC.yes ? { cx: sideC.yes.cx, cy: sideC.yes.cy, half: sideC.yes.half } : null;
    zones.no = sideC.no ? { cx: sideC.no.cx, cy: sideC.no.cy, half: sideC.no.half } : null;

    if (finale && cardShown && cardList.length) buildCard(cardList.slice());
  }

  function ringRadius(key, idx, count) {
    const z = zones[key];
    const inner = Math.max(40, (z ? z.half : 30) + 26);
    const step = Math.min(tileW * 0.18, (tileW * 1.05) / (count + 1));
    return inner + idx * step;
  }

  /* ---- Pointer / drag ---- */
  let active = null;
  let pointer = { x: 0, y: 0 };
  let armed = null;
  const hover = { x: 0, y: 0, on: false };

  let orient = null, orientRest = null, orientReady = false;
  function onOrient(e) {
    if (e.gamma == null && e.beta == null) return;
    const g = e.gamma || 0, b = e.beta || 0;
    if (!orientRest) orientRest = { gamma: g, beta: b };
    orient = { gamma: g, beta: b };
  }
  function enableOrientation() {
    if (orientReady) return;
    if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return;
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    const add = () => { orientReady = true; window.addEventListener("deviceorientation", onOrient); };
    if (typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then((res) => { if (res === "granted") add(); }).catch(() => {});
    } else {
      add();
    }
  }
  window.addEventListener("pointerdown", enableOrientation);

  function trackHover(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    hover.x = x; hover.y = y;
    hover.on = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
  }
  window.addEventListener("pointermove", trackHover);
  window.addEventListener("pointerout", (e) => { if (!e.relatedTarget) hover.on = false; });

  function localPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitAlpha(inst, p) {
    const hw = (tileW * inst.scale) / 2, hh = hw * TILE_RATIO;
    const u = (p.x - (inst.x - hw)) / (2 * hw);
    const v = (p.y - (inst.y - hh)) / (2 * hh);
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const ax = Math.min(ALPHA_RES - 1, (u * ALPHA_RES) | 0);
    const ay = Math.min(ALPHA_RES - 1, (v * ALPHA_RES) | 0);
    return inst.asset.alpha[ay * ALPHA_RES + ax];
  }

  function topTileAt(p) {
    const deck = instances.filter((t) => t.state === "deck" && !t.free);
    for (let k = deck.length - 1; k >= 0; k--) if (hitAlpha(deck[k], p) > 40) return deck[k];
    return null;
  }

  function zoneForX(x) { return x < zoneLeftX ? "yes" : x > zoneRightX ? "no" : null; }

  function goFree(inst) {
    const a = inst.asset, size = tileW * inst.scale;
    for (let i = 0; i < a.N; i++) {
      inst.fx[i] = inst.x + a.off[2 * i] * size;
      inst.fy[i] = inst.y + a.off[2 * i + 1] * size;
      inst.vx[i] = inst.vy[i] = 0;
    }
    inst.free = true;
  }

  function onDown(e) {
    if (finale) return;
    const p = localPoint(e);
    const t = topTileAt(p);
    if (!t) return;
    e.preventDefault();
    active = t;
    t.grabOff = [t.x - p.x, t.y - p.y];
    goFree(t);
    t.state = "drag";
    t.morphTarget = 1;
    pointer = p;
    canvas.classList.add("is-grabbing");
    if (canvas.setPointerCapture && e.pointerId != null) canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (!active) return;
    pointer = localPoint(e);
    setArmed(zoneForX(pointer.x + active.grabOff[0]));
  }

  function onUp() {
    if (!active) return;
    const t = active;
    const z = zoneForX(pointer.x + t.grabOff[0]);
    if (z === "yes" || z === "no") {
      const pile = z === "yes" ? yesPile : noPile;
      const slot = t.slot;
      t.state = z; t.slot = -1;
      pile.push(t);
      if (z === "yes") yesCount++; else noCount++;
      if (pile.length > MAX_RINGS) {
        const old = pile.shift();
        const zc = zones[z];
        const cx = zc ? zc.cx : W / 2, cy = zc ? zc.cy : H / 2;
        old.state = "disperse";
        old.disperse = 1;
        const a = old.asset;
        for (let i = 0; i < a.N; i++) {
          const dx = old.fx[i] - cx, dy = old.fy[i] - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const speed = 440 + Math.random() * 620;
          old.vx[i] = (dx / d) * speed + (Math.random() - 0.5) * 300;
          old.vy[i] = (dy / d) * speed + (Math.random() - 0.5) * 300;
        }
      }
      pile.forEach((tt, idx) => (tt.ringR = ringRadius(z, idx, pile.length)));
      if (slot >= 0) { slots[slot] = null; makeInstance(randomAsset(), slot, true); }
    } else {
      t.state = "deck";
      t.rebindAt = time + SETTLE_DELAY;
    }
    active = null;
    setArmed(null);
    canvas.classList.remove("is-grabbing");
    updateCounts();
  }

  function setArmed(z) {
    if (armed === z) return;
    armed = z;
    document.querySelectorAll(".taste-footer-embed .hero__side").forEach((el) =>
      el.classList.toggle("is-armed", el.dataset.zone === z));
  }
  function updateCounts() {
    const r = document.getElementById("remaining");
    if (r) r.textContent = String(Math.max(0, FAVORITES - yesCount)).padStart(2, "0");
    if (!favoritesFired && yesCount >= FAVORITES) {
      favoritesFired = true;
      document.dispatchEvent(new CustomEvent("taste:favorited", { detail: { yesCount, noCount } }));
      setTimeout(runFinale, 700);
    }
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  /* ---- Free-particle physics ---- */
  function stepFree(inst, dt) {
    const a = inst.asset, N = a.N, off = a.off, k = a.k, c = a.c, rnd = a.rnd;
    const fx = inst.fx, fy = inst.fy, vx = inst.vx, vy = inst.vy, posArr = inst.posArr;

    if (inst.state === "drag") {
      const cx = pointer.x + inst.grabOff[0], cy = pointer.y + inst.grabOff[1];
      const s = DRAG_FBM_SCALE, drift = time * DRAG_FBM_DRIFT, amp = tileW * DRAG_FBM, th = a.thresh, m = inst.morph;
      for (let i = 0; i < N; i++) {
        if (m <= th[i]) {
          fx[i] = inst.x + off[2 * i] * tileW; fy[i] = inst.y + off[2 * i + 1] * tileW;
          vx[i] = vy[i] = 0; posArr[2 * i] = fx[i]; posArr[2 * i + 1] = fy[i]; continue;
        }
        const nx = fbm(fx[i] * s, fy[i] * s + drift) - 0.5;
        const ny = fbm(fx[i] * s + 11.3, fy[i] * s - drift) - 0.5;
        const wamp = amp * (0.5 + rnd[i]);
        const tx = cx + off[2 * i] * tileW + nx * wamp;
        const ty = cy + off[2 * i + 1] * tileW + ny * wamp;
        vx[i] += ((tx - fx[i]) * k[i] - vx[i] * c[i]) * dt;
        vy[i] += ((ty - fy[i]) * k[i] - vy[i] * c[i]) * dt;
        fx[i] += vx[i] * dt; fy[i] += vy[i] * dt;
        posArr[2 * i] = fx[i]; posArr[2 * i + 1] = fy[i];
      }
    } else if (inst.state === "yes" || inst.state === "no") {
      const z = zones[inst.state];
      const zcx = z ? Math.min(W - 30, Math.max(30, z.cx)) : W / 2;
      const zcy = z ? z.cy : H / 2;
      const snap = gsnap[inst.state], sx = snap.x, sy = snap.y;
      const g = grid[inst.state], cols = g.cols, rows = g.rows, head = g.head, next = g.next;
      const sepR2 = SEP_R * SEP_R, sepK = 1500, cD = 9;
      const SMAX = 4200, VMAX = 1500;
      const R = Math.max(60, SEP_R * Math.sqrt(snap.n) * 0.55), kEdge = 30;
      for (let i = 0; i < N; i++) {
        let ax = -vx[i] * cD, ay = -vy[i] * cD;
        const cx = zcx - fx[i], cy = zcy - fy[i], dc = Math.sqrt(cx * cx + cy * cy);
        if (dc > R) { const inv = kEdge * (dc - R) / dc; ax += cx * inv; ay += cy * inv; }
        let gx = (fx[i] / SEP_R) | 0; gx = gx < 0 ? 0 : gx >= cols ? cols - 1 : gx;
        let gy = (fy[i] / SEP_R) | 0; gy = gy < 0 ? 0 : gy >= rows ? rows - 1 : gy;
        let sX = 0, sY = 0, checked = 0;
        for (let oy = -1; oy <= 1; oy++) {
          const ry = gy + oy; if (ry < 0 || ry >= rows) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const rx = gx + ox; if (rx < 0 || rx >= cols) continue;
            let p = head[ry * cols + rx];
            while (p !== -1 && checked < 24) {
              const dx = fx[i] - sx[p], dy = fy[i] - sy[p], d2 = dx * dx + dy * dy;
              if (d2 > 0.01 && d2 < sepR2) {
                const d = Math.sqrt(d2), f = (1 - d / SEP_R) * sepK;
                sX += (dx / d) * f; sY += (dy / d) * f;
              }
              checked++; p = next[p];
            }
          }
        }
        const sm = Math.sqrt(sX * sX + sY * sY);
        if (sm > SMAX) { const k2 = SMAX / sm; sX *= k2; sY *= k2; }
        ax += sX; ay += sY;
        vx[i] += ax * dt; vy[i] += ay * dt;
        const sp = vx[i] * vx[i] + vy[i] * vy[i];
        if (sp > VMAX * VMAX) { const k2 = VMAX / Math.sqrt(sp); vx[i] *= k2; vy[i] *= k2; }
        fx[i] += vx[i] * dt; fy[i] += vy[i] * dt;
        posArr[2 * i] = fx[i]; posArr[2 * i + 1] = fy[i];
      }
    } else if (inst.state === "disperse") {
      for (let i = 0; i < N; i++) {
        vx[i] *= 0.965; vy[i] *= 0.965;
        fx[i] += vx[i] * dt; fy[i] += vy[i] * dt;
        posArr[2 * i] = fx[i]; posArr[2 * i + 1] = fy[i];
      }
    } else if (inst.state === "card") {
      const tx = inst.tx, ty = inst.ty;
      const M = inst.cardN || N;
      const RR = Math.max(70, cardR * 0.2), R2 = RR * RR;
      const fs = 0.005, fdrift = time * 0.2;
      if (!inst.orbT) {
        inst.orbT = new Float32Array(N);
        inst.orbActive = new Uint8Array(N);
        inst.orbNext = new Float32Array(N);
        inst.orbAng = new Float32Array(N);
        inst.orbSweep = new Float32Array(N);
        inst.orbDur = new Float32Array(N);
        for (let j = 0; j < N; j++) inst.orbNext[j] = time + Math.random() * ORBIT_GAP;
      }
      const orbT = inst.orbT, orbActive = inst.orbActive, orbNext = inst.orbNext,
        orbAng = inst.orbAng, orbSweep = inst.orbSweep, orbDur = inst.orbDur;
      for (let i = 0; i < M; i++) {
        const ph = (tx[i] + ty[i]) * 0.012;
        const sc = 1 + (reduceMotion ? 0 : Math.sin(time * 2.2 + ph) * 0.014);
        let gx = cardCx + (tx[i] - cardCx) * sc;
        let gy = cardCy + (ty[i] - cardCy) * sc;
        if (!reduceMotion) {
          if (!orbActive[i]) {
            if (time >= orbNext[i]) {
              orbActive[i] = 1; orbT[i] = 0;
              orbDur[i] = ORBIT_DUR / (1 + Math.random() * 0.5);
              orbAng[i] = Math.atan2(ty[i] - cardQuad.cy, tx[i] - cardQuad.cx);
              orbSweep[i] = (Math.random() < 0.5 ? 1 : -1) * TAU * (0.6 + Math.random() * 0.8);
            }
          } else {
            orbT[i] += dt / orbDur[i];
            if (orbT[i] >= 1) {
              orbActive[i] = 0;
              orbNext[i] = time + ORBIT_GAP * (0.6 + Math.random() * 0.8);
            } else {
              const op = orbT[i], wob = Math.sin(op * Math.PI);
              const ang = orbAng[i] + orbSweep[i] * op;
              let ringX = cardQuad.cx + Math.cos(ang) * cardQuad.w * 0.6;
              let ringY = cardQuad.cy + Math.sin(ang) * cardQuad.h * 0.54;
              const ow = (0.5 + rnd[i]) * tileW * 1.6;
              ringX += (fbm(fx[i] * fs + 4.0, fy[i] * fs + fdrift) - 0.5) * ow;
              ringY += (fbm(fx[i] * fs + 19.0, fy[i] * fs - fdrift) - 0.5) * ow;
              gx += (ringX - gx) * wob;
              gy += (ringY - gy) * wob;
            }
          }
        }
        if (hover.on) {
          const dx = gx - hover.x, dy = gy - hover.y, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / RR) * RR * 0.4;
            gx += (dx / d) * f; gy += (dy / d) * f;
          }
        }
        const ddx = gx - fx[i], ddy = gy - fy[i], distT = Math.sqrt(ddx * ddx + ddy * ddy);
        if (distT > 4 && !reduceMotion && !orbActive[i]) {
          const w = Math.min(distT, 170) * 0.6;
          gx += (fbm(fx[i] * fs, fy[i] * fs + fdrift) - 0.5) * w;
          gy += (fbm(fx[i] * fs + 9.1, fy[i] * fs - fdrift) - 0.5) * w;
        }
        const K = 55 + rnd[i] * 80, C = 2 * Math.sqrt(K) * DAMP_RATIO;
        vx[i] += ((gx - fx[i]) * K - vx[i] * C) * dt;
        vy[i] += ((gy - fy[i]) * K - vy[i] * C) * dt;
        fx[i] += vx[i] * dt; fy[i] += vy[i] * dt;
        posArr[2 * i] = fx[i]; posArr[2 * i + 1] = fy[i];
      }
    } else {
      const hx = homes[inst.slot] ? homes[inst.slot][0] : inst.x;
      const hy = homes[inst.slot] ? homes[inst.slot][1] : inst.y;
      for (let i = 0; i < N; i++) {
        const tx = hx + off[2 * i] * tileW, ty = hy + off[2 * i + 1] * tileW;
        vx[i] += ((tx - fx[i]) * k[i] - vx[i] * c[i]) * dt;
        vy[i] += ((ty - fy[i]) * k[i] - vy[i] * c[i]) * dt;
        fx[i] += vx[i] * dt; fy[i] += vy[i] * dt;
        posArr[2 * i] = fx[i]; posArr[2 * i + 1] = fy[i];
      }
    }
  }

  /* ---- Finale ---- */
  function hueOf(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 1e-4) return 0;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; return h < 0 ? h + 360 : h;
  }
  function colorCompare(a, b) {
    const ga = a.sat < 0.12 ? 0 : 1, gb = b.sat < 0.12 ? 0 : 1;
    if (ga !== gb) return ga - gb;
    if (ga === 0) return a.lum - b.lum;
    if (Math.abs(a.hue - b.hue) > 8) return a.hue - b.hue;
    return a.lum - b.lum;
  }
  function hilbertXY(n, d) {
    let t = d, x = 0, y = 0;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & Math.floor(t / 2);
      const ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
        const tmp = x; x = y; y = tmp;
      }
      x += s * rx; y += s * ry; t = Math.floor(t / 4);
    }
    return [x, y];
  }
  function hilbertOrder(cols, rows) {
    let n = 1; while (n < cols || n < rows) n *= 2;
    const out = [];
    for (let d = 0; d < n * n; d++) {
      const xy = hilbertXY(n, d);
      if (xy[0] < cols && xy[1] < rows) out.push(xy);
    }
    return out;
  }
  function explode(t, cx, cy, strength) {
    strength = strength || 1;
    const a = t.asset;
    if (!t.free) goFree(t);
    t.free = true;
    t.state = "disperse";
    t.disperse = 1;
    t.morph = 1; t.morphTarget = 1;
    for (let i = 0; i < a.N; i++) {
      const dx = t.fx[i] - cx, dy = t.fy[i] - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const sp = (480 + Math.random() * 680) * strength;
      t.vx[i] = (dx / d) * sp + (Math.random() - 0.5) * 340 * strength;
      t.vy[i] = (dy / d) * sp + (Math.random() - 0.5) * 340 * strength;
    }
  }

  function buildCard(list) {
    const Ntot = list.reduce((s, t) => s + t.asset.N, 0);
    if (!Ntot) return;
    const target = Math.min(Ntot, 3000);
    const parts = [];
    for (const t of list) {
      const N = t.asset.N, col = t.asset.col;
      if (!t.tx) { t.tx = new Float32Array(N); t.ty = new Float32Array(N); }
      t.cardN = Math.max(1, Math.round(target * N / Ntot));
      for (let i = 0; i < t.cardN; i++) {
        const r = col[i * 4], g = col[i * 4 + 1], b = col[i * 4 + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        parts.push({
          t, i,
          lum: 0.299 * r + 0.587 * g + 0.114 * b,
          hue: hueOf(r, g, b),
          sat: mx < 1e-4 ? 0 : (mx - mn) / mx,
        });
      }
    }
    if (!parts.length) return;

    computeCardQuad();
    const cq = cardQuad;
    const cardW = (CARD_PANEL.u1 - CARD_PANEL.u0) * cq.w;
    const cardH = (CARD_PANEL.v1 - CARD_PANEL.v0) * cq.h;
    cardCx = cq.cx + ((CARD_PANEL.u0 + CARD_PANEL.u1) / 2 - 0.5) * cq.w - 4;
    cardCy = cq.cy + ((CARD_PANEL.v0 + CARD_PANEL.v1) / 2 - 0.5) * cq.h - 24;
    cardR = cardW;
    const x0 = cardCx - cardW / 2, y0 = cardCy - cardH / 2;
    const P = parts.length;
    const cols = Math.max(10, Math.round(Math.sqrt(P * (cardW / cardH))));
    const rows = Math.ceil(P / cols);
    const cellW = cardW / cols, cellH = cardH / rows;
    cardPS = Math.max(cellW, cellH) * 0.45 * dpr;

    parts.sort(colorCompare);
    const order = hilbertOrder(cols, rows);
    const n = Math.min(parts.length, order.length);
    for (let k = 0; k < n; k++) {
      const p = parts[k], cell = order[k];
      p.t.tx[p.i] = x0 + (cell[0] + 0.5) * cellW;
      p.t.ty[p.i] = y0 + (cell[1] + 0.5) * cellH;
    }
    for (const t of list) { t.state = "card"; t.free = true; }
    cardList = list;
  }

  function runFinale() {
    if (finale) return;
    finale = true;
    setArmed(null);
    orientRest = null;
    canvas.classList.remove("is-grabbing");
    for (const t of instances.slice()) {
      if (t.state === "yes" || t.state === "no") continue;
      explode(t, t.x, t.y, 0.18);
    }
    const nz = zones.no;
    for (const t of noPile.slice()) explode(t, nz ? nz.cx : W / 2, nz ? nz.cy : H / 2);
    noPile.length = 0;
    computeCardQuad();
    cardShown = true;
    cardReveal = reduceMotion ? 0 : 1;
    buildCard(yesPile.slice());
    yesPile.length = 0;
  }

  function resetDeck() {
    for (const t of instances) if (t.bufPos) gl.deleteBuffer(t.bufPos);
    instances.length = 0;
    for (let s = 0; s < SLOTS; s++) slots[s] = null;
    yesPile.length = 0; noPile.length = 0;
    yesCount = 0; noCount = 0; cardPS = 0;
    finale = false; favoritesFired = false;
    cardShown = false; cardReveal = 0; cardList = []; tiltX = 0; tiltY = 0;
    gsnap.yes.n = 0; gsnap.no.n = 0;
    shuffle(assets);
    seedInitialDeck();
    updateCounts();
  }
  document.addEventListener("taste:reset", resetDeck);

  /* ---- Render loop ---- */
  let time = 0, last = -1;

  function frame(now) {
    requestAnimationFrame(frame);
    if (last < 0) last = now;
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.033);
    if (!reduceMotion) time += dt;

    if (cardShown && cardReveal > 0) {
      cardReveal -= cardReveal * (1 - Math.exp(-CARD_REVEAL_RATE * dt));
      if (cardReveal < 0.002) cardReveal = 0;
    }

    let tTx = 0, tTy = 0;
    if (cardShown && !reduceMotion) {
      computeCardQuad();
      let nx, ny;
      if (orient && orientRest) {
        nx = Math.max(-1, Math.min(1, (orient.gamma - orientRest.gamma) / 28));
        ny = Math.max(-1, Math.min(1, (orient.beta - orientRest.beta) / 28));
      } else {
        nx = Math.max(-1, Math.min(1, (hover.x - cardQuad.cx) / (W * 0.5)));
        ny = Math.max(-1, Math.min(1, (hover.y - cardQuad.cy) / (H * 0.5)));
      }
      tTy = nx * CARD_TILT;
      tTx = -ny * CARD_TILT;
    }
    tiltX += (tTx - tiltX) * (1 - Math.exp(-9 * dt));
    tiltY += (tTy - tiltY) * (1 - Math.exp(-9 * dt));
    const tiltMag = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
    const sheenI = CARD_SHEEN * Math.min(1, tiltMag / CARD_TILT) * (1 - cardReveal);
    const sheenPos = (tiltY + tiltX) * 1.6;

    gsnap.yes.n = 0; gsnap.no.n = 0;
    for (const t of instances) {
      if (t.state !== "yes" && t.state !== "no") continue;
      const s = gsnap[t.state], fx = t.fx, fy = t.fy, M = t.asset.N;
      let n = s.n;
      for (let i = 0; i < M && n < MAXP; i++) { s.x[n] = fx[i]; s.y[n] = fy[i]; n++; }
      s.n = n;
    }
    buildGrid("yes"); buildGrid("no");

    const dead = [];
    for (const t of instances) {
      t.morph += (t.morphTarget - t.morph) * (1 - Math.exp(-MORPH_RATE * dt));

      if (t.free) {
        if (t.state === "yes") t.orbit += dt * ORBIT_SPEED;
        else if (t.state === "no") t.orbit -= dt * ORBIT_SPEED;
        stepFree(t, dt);
        t.scale += (1 - t.scale) * (1 - Math.exp(-12 * dt));
        if (t.slot >= 0) { t.x = homes[t.slot][0]; t.y = homes[t.slot][1]; }
        if (t.state === "deck") {
          if (time > (t.rebindAt || 0)) t.morphTarget = 0;
          if (t.morph < 0.03) { t.free = false; t.morphTarget = 0; }
        } else if (t.state === "disperse") {
          t.disperse += (0 - t.disperse) * (1 - Math.exp(-3 * dt));
          if (t.disperse < 0.05) dead.push(t);
        }
        continue;
      }

      if (t.slot >= 0) {
        t.x += (homes[t.slot][0] - t.x) * (1 - Math.exp(-12 * dt));
        t.y += (homes[t.slot][1] - t.y) * (1 - Math.exp(-12 * dt));
      }
      const phase = (t.x + t.y) * 0.004;
      const breathe = reduceMotion ? 0 : Math.sin(time * 2.5 + phase) * 0.03;
      let near = 0;
      if (hover.on && !reduceMotion) {
        const dx = t.x - hover.x, dy = t.y - hover.y;
        near = Math.exp(-(dx * dx + dy * dy) / (tileW * tileW * 0.6));
      }
      t.near = near;
      t.scale += (1 + breathe + near * 0.1 - t.scale) * (1 - Math.exp(-14 * dt));
    }
    for (const d of dead) destroyInstance(d);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (cardShown && cardAsset && cardAsset.loaded) {
      computeCardQuad();
      const offx = -tiltY * cardQuad.h * 0.12;
      const offy = tiltX * cardQuad.h * 0.12 + cardQuad.h * 0.025;
      gl.useProgram(progShadow);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(ASq.quad);
      gl.vertexAttribPointer(ASq.quad, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(US.uRes, W, H);
      gl.uniform2f(US.uTilt, 0, 0);
      gl.uniform1f(US.uFocal, Math.max(1, cardQuad.h * 1.3));
      gl.uniform2f(US.uTiltPivot, cardQuad.cx, cardQuad.cy);
      gl.uniform2f(US.uCenter,
        ((cardQuad.cx + offx) / W) * 2 - 1, 1 - ((cardQuad.cy + offy) / H) * 2);
      gl.uniform2f(US.uHalf, (cardQuad.w * 1.08) / W, (cardQuad.h * 1.05) / H);
      gl.uniform1f(US.uAlpha, 0.5 * (1 - cardReveal));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(ASq.quad);
    }

    if (cardShown && cardAsset && cardAsset.loaded) {
      computeCardQuad();
      gl.useProgram(progQ);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(AQ.quad);
      gl.vertexAttribPointer(AQ.quad, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, noiseTex);
      gl.uniform1i(UQ.uNoise, 1);
      gl.uniform2f(UQ.uRes, W, H);
      gl.uniform2f(UQ.uCenter, (cardQuad.cx / W) * 2 - 1, 1 - (cardQuad.cy / H) * 2);
      gl.uniform2f(UQ.uHalf, cardQuad.w / W, cardQuad.h / H);
      gl.uniform1f(UQ.uMorph, cardReveal);
      gl.uniform2f(UQ.uTilt, tiltX, tiltY);
      gl.uniform2f(UQ.uTiltPivot, cardQuad.cx, cardQuad.cy);
      gl.uniform1f(UQ.uFocal, Math.max(1, cardQuad.h * 1.3));
      gl.uniform1f(UQ.uSheen, sheenI);
      gl.uniform1f(UQ.uSheenPos, sheenPos);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cardAsset.tex);
      gl.uniform1i(UQ.uTex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(AQ.quad);
    }

    gl.useProgram(prog);
    gl.uniform2f(U.uRes, W, H);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uFree, 1);
    gl.uniform1f(U.uSnap, 0);
    gl.uniform2f(U.uTiltPivot, cardQuad.cx, cardQuad.cy);
    gl.uniform1f(U.uFocal, Math.max(1, cardQuad.h * 1.3));
    gl.enableVertexAttribArray(A.offset);
    gl.enableVertexAttribArray(A.color);
    gl.enableVertexAttribArray(A.pos);
    gl.enableVertexAttribArray(A.thresh);
    const basePoint = (tileW / GRID) * POINT_OVERLAP * dpr;
    const order = instances.filter((t) => t.free && t.state !== "drag")
      .concat(instances.filter((t) => t.free && t.state === "drag"));
    for (const t of order) {
      const a = t.asset;
      if (!a.loaded || a.N === 0) continue;
      gl.uniform1f(U.uMorph, t.morph);
      const isCard = t.state === "card";
      gl.uniform2f(U.uTilt, isCard ? tiltX : 0, isCard ? tiltY : 0);
      let ps = basePoint;
      if (t.state === "disperse") ps = basePoint * t.disperse;
      else if (t.state === "card") ps = cardPS || basePoint;
      gl.uniform1f(U.uPointSize, ps);
      gl.uniform1f(U.uAlpha,
        t.state === "disperse" ? Math.max(0, Math.min(1, (t.disperse - 0.05) / 0.35)) : 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, a.bufOffset);
      gl.vertexAttribPointer(A.offset, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, a.bufColor);
      gl.vertexAttribPointer(A.color, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, a.bufThresh);
      gl.vertexAttribPointer(A.thresh, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.bufPos);
      gl.bufferData(gl.ARRAY_BUFFER, t.posArr, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(A.pos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, t.cardN || a.N);
    }
    gl.disableVertexAttribArray(A.offset);
    gl.disableVertexAttribArray(A.color);
    gl.disableVertexAttribArray(A.pos);
    gl.disableVertexAttribArray(A.thresh);

    gl.useProgram(progQ);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(AQ.quad);
    gl.vertexAttribPointer(AQ.quad, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(UQ.uNoise, 1);
    gl.uniform2f(UQ.uRes, W, H);
    gl.uniform2f(UQ.uTilt, 0, 0);
    gl.uniform1f(UQ.uFocal, 1);
    gl.uniform1f(UQ.uSheen, 0);
    for (const t of instances) {
      if (!t.asset.loaded || t.morph >= 0.93) continue;
      const tw = tileW * t.scale, th = tw * TILE_RATIO;
      gl.uniform2f(UQ.uCenter, (t.x / W) * 2 - 1, 1 - (t.y / H) * 2);
      gl.uniform2f(UQ.uHalf, tw / W, th / H);
      gl.uniform1f(UQ.uMorph, t.morph);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t.asset.tex);
      gl.uniform1i(UQ.uTex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disableVertexAttribArray(AQ.quad);
  }

  /* ---- Boot ---- */
  layout();
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });
  updateCounts();
  loadCard();
  requestAnimationFrame(frame);
  initAssets(HEX_IMAGES);
})();

