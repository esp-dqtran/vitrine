(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,756708,e=>{"use strict";var t=e.i(843476),l=e.i(642623),a=e.i(994964),r=e.i(80075),o=e.i(956850),i=e.i(221663),n=e.i(899925),s=e.i(271645),u=e.i(812152),c=e.i(88771),f=e.i(615683),h=e.i(801335),d=e.i(627293),p=e.i(281783);function m(e,t,l){let a=document.createElement("canvas");a.width=4*l,a.height=64*t;let r=a.getContext("2d",{alpha:!0});if(!r)return a;r.clearRect(0,0,a.width,a.height),r.fillStyle="#ffffff",r.textAlign="center",r.textBaseline="middle",r.font=(0,p.getMonoFontCss)(47.36,500);for(let t=0;t<e.length;t++){let a=(t%4+.5)*l,o=(Math.floor(t/4)+.58)*64;r.fillText(e[t]??" ",a,o)}return a}let v=`#version 300 es
precision mediump float;

uniform sampler2D tAtlas;
uniform vec3 uColor;

in vec2 vUv;
in float vOpacity;

out vec4 fragColor;

void main() {
  vec4 sampled = texture(tAtlas, vUv);
  fragColor = vec4(uColor, sampled.a * vOpacity);
}
`;e.s(["GlyphFieldScene",0,function({className:e,viewport:g,modelLayout:M="right",imageFit:R="contain",backgroundOnly:S=!1,interactive:w=!0,entrance:y=!0,maxFps:A,backgroundColor:x="#232323",color:C="#ffffff",data:b}){let E=s.useRef(null),_=s.useRef(null),[I,P]=s.useState(!1),k=s.useRef(b);k.current=b;let T=s.useRef(M);T.current=M;let L=s.useRef(R);L.current=R;let O=s.useRef(S);O.current=S;let D=s.useRef(w);D.current=w;let F=s.useRef(x);F.current=x;let G=s.useRef(C);G.current=C;let B=s.useRef(null),U=s.useRef(A);U.current=A;let{enteredForGate:z,vpResolved:N,viewportDisabled:H,onViewportEnter:V,onViewportLeave:W}=(0,f.useViewportEnteredForGate)(g),Y=(0,c.usePrefersReducedMotion)(),X=(0,u.useDraftMode)(),Z=X||Y||!y,$=X||z,j=s.useRef(null);return s.useEffect(()=>{var e;let t=E.current;if(!t)return;let{modelCols:l,modelRows:s,sourceAspect:u,atlas:c,phraseAtlasIndices:f,cellBrightness:h,glyphAspect:g}=k.current,M=Math.ceil(c.length/4),R=Math.max(8,Math.round(64*g)),S=(e=f.length,`#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 position;
in vec2 uv;

uniform vec2 uGridSize;
uniform vec2 uAtlasGrid;
uniform float uTime;

// Phrase mapping: cell at linear position i renders uPhraseChars[i % PHRASE_LEN].
uniform float uPhraseChars[${e}];

// Model region in cell coords: where the source image is sampled. Cells outside fall back to the
// dim background brightness. Computed on CPU at resize.
uniform vec2 uModelStart;
uniform vec2 uModelSize;
// Source-texture crop applied inside the model region: sampledUV = regionUV * scale + offset.
// "contain" sizes the region to the source aspect, so scale = (1,1) / offset = (0,0) — a no-op.
// "cover" fills the region with the whole container and crops the texture here to keep aspect.
uniform vec2 uModelUVScale;
uniform vec2 uModelUVOffset;
uniform float uBackgroundBrightness;
// 1 in background-only mode: extends the ambient twinkle to the whole phrase field (there is no
// image region to confine it to). 0 otherwise, so the twinkle stays inside the image.
uniform float uBackgroundTwinkle;
uniform sampler2D tSourceBrightness;

// Center cell of the model region; the entrance ripple anchors here so the reveal originates
// from the image.
uniform vec2 uEntranceCenter;

// simTime (seconds) the entrance wave started. +large sentinel = not triggered (alpha 0
// everywhere); -large sentinel = skip animation (alpha 1 everywhere); otherwise the start time.
uniform float uEntranceStart;

uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform float uMouseRadius;
uniform float uRippleMaxRadius;
uniform float uRippleWidth;
uniform float uRippleStarts[16];
uniform vec2 uRippleCenters[16];
// Active ripple count, so the loop breaks early instead of scanning all MAX_RIPPLES.
uniform float uActiveRippleCount;

const float RIPPLE_DURATION_S = 1.8000;
const float ENTRANCE_FADE_S = 0.5000;
const float GLYPH_ASPECT_S = ${g.toFixed(4)};
const float RIPPLE_SCALE_BOOST_S = 0.0000;
const float GENTLE_FLIP_OSC_HZ_S = 0.1800;
const float GENTLE_FLIP_THRESHOLD_S = 0.9850;
const float GENTLE_FLIP_SCRAMBLE_HZ_S = 2.5000;

out vec2 vUv;
out float vOpacity;

/** Distance metric that compensates for non-square cells — cellOffset.y is scaled by 1/aspect so
 * a unit step horizontally and vertically map to the same screen distance. */
float screenDist(vec2 cellOffset) {
  cellOffset.y /= GLYPH_ASPECT_S;
  return length(cellOffset);
}

/** Stable per-cell hash, used as the stippling threshold for hover/ripple masks. */
float cellHash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}

/** 1D hash for time-varying scramble seeds (flip + ripple wavefront). */
float hash1D(float x) {
  return fract(sin(x * 12.9898) * 43758.5453);
}

/** Pick a non-space atlas glyph from a 1D seed. Index 0 is the space tile — skipping it keeps
 * scrambled cells from briefly vanishing as the wave/twinkle passes through them. */
float pickRandomGlyph(float seed, float numGlyphs) {
  return 1.0 + floor(hash1D(seed) * (numGlyphs - 1.0));
}

void main() {
  int instanceID = gl_InstanceID;
  int cols = int(uGridSize.x);
  vec2 cell = vec2(float(instanceID % cols), float(instanceID / cols));

  // Computed here (not in the brightness block) so the gentle flip can gate on inModel — else
  // background cells twinkle as "stars" away from the image.
  vec2 modelOffset = cell - uModelStart;
  bool inModel = modelOffset.x >= 0.0 && modelOffset.x < uModelSize.x
              && modelOffset.y >= 0.0 && modelOffset.y < uModelSize.y;

  // Ripple influence: smoothstep travelling radius \xd7 bell falloff \xd7 birth/death life fade.
  int activeRippleCount = int(uActiveRippleCount);
  float rippleInfluence = 0.0;
  for (int r = 0; r < 16; r++) {
    if (r >= activeRippleCount) break;
    float start = uRippleStarts[r];
    float elapsed = uTime - start;
    if (elapsed < 0.0 || elapsed >= RIPPLE_DURATION_S) continue;
    float t = elapsed / RIPPLE_DURATION_S;
    float waveRadius = smoothstep(0.0, 1.0, t) * uRippleMaxRadius;
    float distToCenter = screenDist(cell - uRippleCenters[r]);
    float bell = 1.0 - smoothstep(0.0, uRippleWidth * 0.5, abs(distToCenter - waveRadius));
    float lifeFade = smoothstep(0.0, 0.22, t) * (1.0 - smoothstep(0.78, 1.0, t));
    rippleInfluence = max(rippleInfluence, bell * lifeFade);
  }

  // Hover bell — smoothstep falloff with \xd72.5 strength so the bell edges still dissolve.
  float mouseDist = screenDist(cell - uMouse);
  float hoverInfluence = (1.0 - smoothstep(0.0, uMouseRadius, mouseDist)) * uMouseInfluence;
  float threshold = cellHash(cell);
  // step(0,0) returns 1, so the second gate is needed: cells with cellHash exactly 0 would
  // otherwise stick dimMask/boostMask at 1 forever and become permanent bright stragglers.
  float dimMask = step(threshold, hoverInfluence * 2.5) * step(0.001, hoverInfluence);
  // ~50% of wavefront cells catch the boost (rippleInfluence \xd7 0.5 vs. threshold).
  float boostMask = step(threshold, rippleInfluence * 0.5) * step(0.001, rippleInfluence);

  // Each row reads a contiguous stretch of the phrase, starting at a hashed per-row offset.
  // A plain raster index (instanceID % PHRASE_LEN) repeats the same text every few rows shifted
  // by a constant, stacking identical claims along diagonal bands across the field.
  float rowPhraseOffset = floor(hash1D(cell.y + 0.5) * float(${e}));
  float baseCharIdx = uPhraseChars[int(mod(cell.x + rowPhraseOffset, float(${e})))];
  float numAtlasGlyphs = uAtlasGrid.x * uAtlasGrid.y;

  // Ambient twinkle inside the image: per-cell oscillator, gated on inModel.
  float flipPhase = uTime * GENTLE_FLIP_OSC_HZ_S + threshold * 6.2831853;
  float flipActive = step(GENTLE_FLIP_THRESHOLD_S, sin(flipPhase) * 0.5 + 0.5) * max(float(inModel), uBackgroundTwinkle);
  float flipFrame = floor(uTime * GENTLE_FLIP_SCRAMBLE_HZ_S);
  float flipChar = pickRandomGlyph(threshold * 17.13 + flipFrame * 1.7, numAtlasGlyphs);
  float charIdx = mix(baseCharIdx, flipChar, flipActive);

  // Ripple wavefront scramble. boostMask is zero outside ripples, so the mix is a no-op there.
  float scrambleFrame = floor(uTime * 24.0);
  float scrambleChar = pickRandomGlyph(threshold * 7.13 + scrambleFrame, numAtlasGlyphs);
  charIdx = mix(charIdx, scrambleChar, boostMask);
  charIdx = clamp(charIdx, 0.0, numAtlasGlyphs - 1.0);

  float atlasCol = mod(charIdx, uAtlasGrid.x);
  float atlasRow = floor(charIdx / uAtlasGrid.x);
  vUv = vec2((atlasCol + uv.x) / uAtlasGrid.x, (atlasRow + (1.0 - uv.y)) / uAtlasGrid.y);

  // Brightness inside the model = max(background, source); the image only adds, never subtracts.
  float brightness = uBackgroundBrightness;
  if (inModel) {
    vec2 modelUV = (modelOffset + 0.5) / uModelSize;
    modelUV = modelUV * uModelUVScale + uModelUVOffset;
    brightness = max(uBackgroundBrightness, texture(tSourceBrightness, modelUV).r);
  }

  float baseOpacity = pow(brightness, 0.6);
  // Smooth proximity dim under the stipple kill, so bright cells in the outer bell don't sit at
  // full opacity while dim cells dissolve around them.
  float effectiveOpacity = baseOpacity * (1.0 - hoverInfluence);
  effectiveOpacity = mix(effectiveOpacity, 0.0, dimMask);
  effectiveOpacity = mix(effectiveOpacity, 1.0, boostMask);

  // Entrance reveal: per-cell arrival time = analytic inverse of the smoothstep-eased wave radius.
  // The +large/-large sentinels skip the math (alpha 0 / alpha 1); JS flips to -large once done.
  float entranceAlpha = 1.0;
  if (uEntranceStart > -1e8) {
    float arrivalDist = screenDist(cell - uEntranceCenter);
    float arrivalFrac = clamp((arrivalDist - uRippleWidth * 0.5) / uRippleMaxRadius, 0.0, 1.0);
    float invSmoothArg = clamp(1.0 - 2.0 * arrivalFrac, -1.0, 1.0);
    float arrival = (0.5 - sin(asin(invSmoothArg) / 3.0)) * RIPPLE_DURATION_S;
    entranceAlpha = clamp((uTime - uEntranceStart - arrival) / ENTRANCE_FADE_S, 0.0, 1.0);
  }
  vOpacity = effectiveOpacity * entranceAlpha;

  // Position the cell in NDC. Grid fills the container exactly: cellSize = 2/gridSize.
  vec2 cellSize = 2.0 / uGridSize;
  vec2 cellCenter = -1.0 + (cell + 0.5) * cellSize;
  cellCenter.y = -cellCenter.y;

  float scaleBoost = 1.0 + rippleInfluence * RIPPLE_SCALE_BOOST_S;
  vec2 worldPos = cellCenter + position * cellSize * scaleBoost;

  gl_Position = vec4(worldPos, 0.0, 1.0);
}
`),w=Math.min(window.devicePixelRatio||1,2),y=new i.Renderer({webgl:2,alpha:!1,antialias:!1,depth:!1,stencil:!1,dpr:w,powerPreference:"high-performance"}),A=y.gl,[x,C,b]=(0,p.hexToRgb01)(F.current);A.clearColor(x,C,b,1),A.enable(A.BLEND),A.blendFunc(A.SRC_ALPHA,A.ONE_MINUS_SRC_ALPHA);let I=A.canvas;for(let e of(I.style.width="100%",I.style.height="100%",I.style.display="block",I.style.position="absolute",I.style.inset="0",Array.from(t.children)))e instanceof HTMLCanvasElement&&t.removeChild(e);t.appendChild(I);let z=m(c,M,R),N=new n.Texture(A,{image:z,generateMipmaps:!0,premultiplyAlpha:!1,flipY:!1});document.fonts.ready.then(()=>{ew.aborted||(N.image=m(c,M,R),N.needsUpdate=!0,eL())});let H=function(e,t,l){let a=document.createElement("canvas");a.width=e,a.height=t;let r=a.getContext("2d",{alpha:!1});if(!r)return a;let o=r.createImageData(e,t);for(let a=0;a<e*t;a++){let e=l[a]??0;o.data[4*a]=e,o.data[4*a+1]=e,o.data[4*a+2]=e,o.data[4*a+3]=255}return r.putImageData(o,0,0),a}(l,s,h),V=new n.Texture(A,{image:H,generateMipmaps:!1,premultiplyAlpha:!1,flipY:!1,minFilter:A.LINEAR,magFilter:A.LINEAR,wrapS:A.CLAMP_TO_EDGE,wrapT:A.CLAMP_TO_EDGE}),W=new a.Geometry(A,{position:{size:2,data:p.BASE_QUAD_POSITION},uv:{size:2,data:p.BASE_QUAD_UV},aInstance:{instanced:1,size:1,data:new Float32Array(1)}}),Y=new o.Program(A,{vertex:S,fragment:v,transparent:!0,depthTest:!1,depthWrite:!1,cullFace:0,uniforms:{tAtlas:{value:N},uColor:{value:new Float32Array((0,p.hexToRgb01)(G.current))},tSourceBrightness:{value:V},uGridSize:{value:new Float32Array([1,1])},uAtlasGrid:{value:new Float32Array([4,M])},uModelStart:{value:new Float32Array([0,0])},uModelSize:{value:new Float32Array([1,1])},uModelUVScale:{value:new Float32Array([1,1])},uModelUVOffset:{value:new Float32Array([0,0])},uEntranceCenter:{value:new Float32Array([0,0])},uEntranceStart:{value:1e9},uBackgroundBrightness:{value:.01},uBackgroundTwinkle:{value:0},uPhraseChars:{value:f},uTime:{value:0},uMouse:{value:new Float32Array([-999,-999])},uMouseInfluence:{value:0},uMouseRadius:{value:1},uRippleMaxRadius:{value:1},uRippleWidth:{value:1},uRippleStarts:{value:Array(16).fill(-1)},uRippleCenters:{value:Array.from({length:16},()=>[0,0])},uActiveRippleCount:{value:0}}}),X=new r.Mesh(A,{geometry:W,program:Y,frustumCulled:!1});if(!Y.uniformLocations){let e=A.getShaderInfoLog(Y.vertexShader);console.error("[GlyphField] shader failed to compile/link",{vsLog:e,fsLog:A.getShaderInfoLog(Y.fragmentShader),linkLog:A.getProgramInfoLog(Y.program)});try{t.removeChild(I)}catch{}return}let Z=Y.uniforms.uTime,$=Y.uniforms.uGridSize,q=Y.uniforms.uModelStart,K=Y.uniforms.uModelSize,Q=Y.uniforms.uModelUVScale,J=Y.uniforms.uModelUVOffset,ee=Y.uniforms.uEntranceCenter,et=Y.uniforms.uEntranceStart,el=Y.uniforms.uMouseRadius,ea=Y.uniforms.uRippleMaxRadius,er=Y.uniforms.uRippleWidth,eo=Y.uniforms.uMouse,ei=Y.uniforms.uMouseInfluence,en=Y.uniforms.uRippleStarts,es=Y.uniforms.uRippleCenters,eu=Y.uniforms.uActiveRippleCount,ec=Y.uniforms.uBackgroundTwinkle,ef=1,eh=1,ed=1,ep=1,em=1,ev=1,eg=0,eM=0,eR=(e=0)=>{let l,a,r,o,i,n=t.getBoundingClientRect();if(ef=Math.max(1,n.width),eh=Math.max(1,n.height),ed=(ep=14)*g,em=Math.max(8,Math.round(ef/ed)),ed=ef/em,O.current){let t=Math.max(8,Math.ceil(eh/ep));(t>ev||ev-t>32)&&(ev=16*Math.ceil((t+e)/16)),l=ev*ep}else ev=Math.max(8,Math.round(eh/ep)),ep=eh/ev,l=Math.max(1,Math.floor(eh));let s=Math.max(1,Math.floor(ef)),c=s!==eg||l!==eM;c&&(eg=s,eM=l,y.setSize(s,l));let f=1,h=1,d=0,p=0;if(O.current)a=0,r=0,o=0,i=0;else if("cover"===L.current){o=em,i=ev,a=0,r=0;let e=em*g/ev;u>e?d=(1-(f=e/u))/2:p=(1-(h=u/e))/2}else{let e=u/g,t=Math.min(ev,em/e);i=Math.max(1,Math.round(t)),o=Math.max(1,Math.min(em,Math.round(t*e))),"bottom"===T.current?(a=Math.round((em-o)/2),r=ev-i):(a=em-o,r=Math.round((ev-i)/2))}$.value[0]=em,$.value[1]=ev,q.value[0]=a,q.value[1]=r,K.value[0]=o,K.value[1]=i,Q.value[0]=f,Q.value[1]=h,J.value[0]=d,J.value[1]=p,ec.value=+!!O.current,ee.value[0]=O.current?em/2:a+o/2,ee.value[1]=O.current?Math.min(ev,eh/ep)/2:r+i/2;let m=em/2;return el.value=.35*m,ea.value=1.6*m,er.value=.85*m,W.setInstancedCount(em*ev),c};eR();let eS=new AbortController,{signal:ew}=eS,ey=window.matchMedia("(prefers-reduced-motion: reduce)"),eA=0,ex=!0,eC=!document.hidden,eb=!ey.matches,eE=performance.now(),e_=0,eI=[],eP=0,ek=new Float32Array([-999,-999]),eT=-1/0,eL=()=>{Z.value=e_,y.render({scene:X,update:!1,sort:!1,frustumCull:!1})},eO=e=>{let t=Math.min(.05,(e-eE)*.001);for(eE=e,eb&&(e_+=t);eI[0]&&e_-eI[0].start>=1.8;)eI.shift();let l=en.value,a=es.value;for(let e=0;e<16;e++){let t=a[e];if(!t)continue;let r=eI[e];l[e]=r?r.start:-1,t[0]=r?.centerX??0,t[1]=r?.centerY??0}eu.value=eI.length;let r=et.value;r>-1e8&&r<1e8&&e_-r>2.3499999999999996&&(et.value=-1e9);let o=1-Math.exp(-6*t);ei.value+=(eP-ei.value)*o;let i=1-Math.exp(-14*t);eo.value[0]=eo.value[0]+(ek[0]-eo.value[0])*i,eo.value[1]=eo.value[1]+(ek[1]-eo.value[1])*i;let n=U.current,s=eI.length>0||ei.value>.001||r>-1e8&&r<1e8;(!n||s||e-eT>=1e3/n)&&(eT=e,eL()),eA=ex&&eC&&eb?requestAnimationFrame(eO):0},eD=()=>{0!==eA&&(cancelAnimationFrame(eA),eA=0)},eF=()=>{ex&&eC&&eb?0===eA&&(eE=performance.now(),eA=requestAnimationFrame(eO)):(eD(),eL())},eG=!1,eB=null,eU=!1,ez=(e=0)=>{(eR(e)||0===eA)&&eL()};B.current=ez;let eN=new ResizeObserver(()=>{if(!ex){eG=!0;return}null===eB?ez(16):(O.current&&t.getBoundingClientRect().height>eM&&ez(16),window.clearTimeout(eB),eU=!0),eB=window.setTimeout(()=>{eB=null,eU&&(eU=!1,ez())},150)});eN.observe(t);let eH=new IntersectionObserver(e=>{let t=e[0];t&&((ex=t.isIntersecting)&&eG&&(eG=!1,ez()),eF())},{threshold:0});eH.observe(t),document.addEventListener("visibilitychange",()=>{eC=!document.hidden,eF()},{signal:ew}),ey.addEventListener("change",()=>{eb=!ey.matches,eF()},{signal:ew}),D.current&&(0,d.setupCursorTracking)({container:t,signal:ew,labelRef:_,setIsHovering:P,onPointerMove:(e,t)=>{ek[0]=e/ed,ek[1]=t/ep},onPointerEnter:(e,t)=>{ek[0]=e/ed,ek[1]=t/ep,eo.value[0]=ek[0],eo.value[1]=ek[1],eP=1},onPointerLeave:()=>{eP=0},onClick:(e,t)=>{for(eI.push({start:e_,centerX:e/ed,centerY:t/ep});eI.length>16;)eI.shift()}});let eV=!1;return j.current=e=>{if(!eV){if(eV=!0,"skip"===e){et.value=-1e9;return}et.value=e_,eI.push({start:e_,centerX:ee.value[0],centerY:ee.value[1]})}},eL(),eF(),()=>{j.current=null,B.current=null,eD(),eS.abort(),eH.disconnect(),eN.disconnect(),null!==eB&&window.clearTimeout(eB);try{t.removeChild(I)}catch{}A.getExtension("WEBGL_lose_context")?.loseContext()}},[]),s.useEffect(()=>{Z?j.current?.("skip"):$&&j.current?.("play")},[Z,$]),s.useEffect(()=>{B.current?.()},[M,R,S]),(0,t.jsx)(l.div,{ref:E,style:{backgroundColor:x},className:(0,h.cx)("relative size-full overflow-hidden",w&&"cursor-pointer",e),onViewportEnter:H?void 0:V,onViewportLeave:H?void 0:W,viewport:N,children:w?(0,t.jsx)(d.CursorLabel,{labelRef:_,isHovering:I}):null})}])}]);