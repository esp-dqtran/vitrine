(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,565458,e=>{"use strict";var t=e.i(843476),a=e.i(500932),o=e.i(255667),n=e.i(994964),i=e.i(80075),r=e.i(956850),l=e.i(221663),s=e.i(899925),h=e.i(271645),u=e.i(537836),d=e.i(801335),f=e.i(627293),c=e.i(281783);let m="THE CONTENT ARCHITECTURE.",p=m.indexOf("."),g=Array.from(m).map((e,t)=>t).filter(e=>e!==p),v=Math.ceil(m.length/8),A=.65*Math.PI,R={idle:"Click & hold",holding:"Keep holding",charged:"Release"},S="#232323";function w(){let e=document.createElement("canvas");e.width=512,e.height=64*v;let t=e.getContext("2d",{alpha:!0});if(!t)return e;t.clearRect(0,0,e.width,e.height),t.fillStyle="#ffffff",t.textAlign="center",t.textBaseline="middle",t.font=(0,c.getMonoFontCss)(57.6);for(let e=0;e<m.length;e++){let a=(e%8+.5)*64,o=(Math.floor(e/8)+.55)*64,n=m[e];if("."===n){t.beginPath(),t.arc(a,o,5.76,0,2*Math.PI),t.fill();continue}t.fillText(n??"",a,o)}return e}let _=`#version 300 es
precision highp float;

in vec2 position;
in vec2 uv;
in float aRadius;
in float aTheta0;
in float aSpeed;
in float aSize;
in float aCharIdx;
in float aRingIdx;

uniform float uTime;
uniform vec2 uFitScale;
uniform vec2 uCenter;
uniform vec2 uAtlasGrid;
uniform float uPxToDesign;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform float uMouseRadius;
uniform float uRingCharge[30];
uniform float uRingGather[30];
uniform float uRippleStarts[16];
uniform float uRingOffsets[30];
uniform float uRingArrivalTime[30];

const float RIPPLE_DURATION_S = 1.8000;
const float RIPPLE_MAX_RADIUS_S = 1.6000;
const float RIPPLE_WIDTH_S = 0.8500;
const float RIPPLE_RADIAL_PUSH_S = 0.0450;
const float RIPPLE_SCALE_BOOST_S = 0.5000;
const float DOT_SIZE_PX_S = 5.0000;
const float ENTRANCE_FADE_S = 0.5000;
const float HOLD_GATHER_SCALE_S = 0.1200;
const float HOLD_SHAKE_AMPLITUDE_S = 0.0020;
const float HOLD_SHAKE_FRACTION_S = 0.1800;
const float HOLD_GLITCH_RATE_S = 9.0000;
const float HOLD_GLITCH_FRACTION_S = 0.1500;

out vec2 vUv;
out float vRingT;
out float vAlpha;

void main() {
  // Reveal strength from any active ripple wavefront (-1 = slot empty).
  // Triple smoothing for a connected, swell-like read:
  //  1. Wavefront radius eases in/out (smoothstep), so the wave doesn't pop out of center.
  //  2. Spatial envelope is a pure bell (no plateau), so rings rise and fall continuously instead
  //     of slamming into a flat top.
  //  3. Life envelope fades the wave in at birth and out at death so it never appears/disappears
  //     mid-strength.
  float rippleInfluence = 0.0;
  for (int r = 0; r < 16; r++) {
    float start = uRippleStarts[r];
    if (start < 0.0) continue;
    float elapsed = uTime - start;
    if (elapsed < 0.0 || elapsed >= RIPPLE_DURATION_S) continue;
    float t = elapsed / RIPPLE_DURATION_S;
    float waveRadius = smoothstep(0.0, 1.0, t) * RIPPLE_MAX_RADIUS_S;
    float bell = 1.0 - smoothstep(0.0, RIPPLE_WIDTH_S * 0.5, abs(aRadius - waveRadius));
    float lifeFade = smoothstep(0.0, 0.22, t) * (1.0 - smoothstep(0.78, 1.0, t));
    rippleInfluence = max(rippleInfluence, bell * lifeFade);
  }

  // Push and size share the influence directly. The envelope is already shaped above, no extra
  // sharpening here or the rise from zero becomes the abrupt edge again.
  // Hold anticipation. uRingCharge is the fast tension (drives shiver/glitch and, on the CPU,
  // the rotation freeze); uRingGather is the slow zoom creep that keeps deepening for as long
  // as the hold lasts. Both are per ring: on a charged release the CPU only lets them decay
  // once the wave's leading edge reaches that ring, so the spring-back outward travels with the
  // ripple itself — drawback, then wave, as one continuous gesture.
  float holdCharge = uRingCharge[int(aRingIdx)];
  float gatherAmt = uRingGather[int(aRingIdx)];
  float effectiveRadius = aRadius * (1.0 - gatherAmt * HOLD_GATHER_SCALE_S) + rippleInfluence * RIPPLE_RADIAL_PUSH_S;

  float theta = aTheta0 + uTime * aSpeed + uRingOffsets[int(aRingIdx)];
  float c = cos(theta);
  float s = sin(theta);
  vec2 ringCenter = vec2(c, s) * effectiveRadius;

  // Pure bell falloff from the cursor (no inner plateau). Combined with the smoothed influence
  // amplitude and the trailing cursor position lerped on the CPU, this produces a continuous
  // gradient of dissolution around the pointer instead of a hard disc that snaps with movement.
  float mouseDist = length(ringCenter - uMouse);
  float hoverInfluence = (1.0 - smoothstep(0.0, uMouseRadius, mouseDist)) * uMouseInfluence;

  // Both effects dissolve chars into the dot field. Hover is more aggressive (\xd72.5 strength)
  // so it converts more chars under the cursor than the ripple converts as it passes.
  float strength = max(hoverInfluence * 2.5, rippleInfluence);
  float seed = aTheta0 * 7.13 + aRadius * 13.97;
  float threshold = fract(sin(seed * 12.9898) * 43758.5453);
  float isDot = step(threshold, strength);

  // Hold glitch: while charged, sparse slots blink letter↔dot on a coarse clock (re-rolled each
  // tick, so a different subset glitches every beat). The armed spiral is frozen in space, but
  // the type itself never stops glitching — the stillness stays tense instead of going dead.
  float glitchTick = floor(uTime * HOLD_GLITCH_RATE_S);
  float glitchNoise = fract(sin(seed * 91.7 + glitchTick * 7.31) * 43758.5453);
  isDot = max(isDot, step(glitchNoise, holdCharge * HOLD_GLITCH_FRACTION_S));
  float charIdxNow = mix(aCharIdx, ${p}.0, isDot);
  // When a letter dissolves to a dot, shrink to dot size or it'd render at the letter's tile size.
  // Same envelope inflates the glyph as the wavefront passes, pairing with the radial push so
  // each ring both swells outward and grows in mass continuously through the wave.
  float sizePx = mix(aSize, DOT_SIZE_PX_S, isDot) * (1.0 + rippleInfluence * RIPPLE_SCALE_BOOST_S);

  // Glyph is rotated tangent to the ring (theta + π/2), reusing (c, s) via the identity
  // cos(θ+π/2) = -sin(θ) and sin(θ+π/2) = cos(θ) — saves two trig calls per vertex.
  float designSize = sizePx * uPxToDesign;
  vec2 rotated = vec2(
    -position.x * s - position.y * c,
    position.x * c - position.y * s
  ) * designSize;

  // Hold shiver: a sparse subset of slots trembles (per-slot hash vs HOLD_SHAKE_FRACTION), each
  // with its own phase and detuned frequency so nothing pulses in unison. Scales with the charge
  // and keeps going at full strength while armed — only the release wave calms it, ring by ring.
  float shakeSeed = fract(sin(aTheta0 * 91.17 + aRadius * 47.91) * 24634.6345);
  float shakes = step(shakeSeed, HOLD_SHAKE_FRACTION_S);
  vec2 tremor = vec2(
    sin(uTime * (38.0 + shakeSeed * 14.0) + shakeSeed * 271.0),
    cos(uTime * (34.0 + shakeSeed * 17.0) + shakeSeed * 113.0)
  ) * (holdCharge * shakes * HOLD_SHAKE_AMPLITUDE_S);

  vec2 worldPos = (ringCenter + rotated + tremor) * uFitScale + uCenter;

  float col = mod(charIdxNow, uAtlasGrid.x);
  float row = floor(charIdxNow / uAtlasGrid.x);
  vUv = vec2((col + uv.x) / uAtlasGrid.x, (row + (1.0 - uv.y)) / uAtlasGrid.y);

  vRingT = clamp(aRadius, 0.0, 1.2);

  // Entrance opacity: each ring fades in starting at the moment the entrance ripple's leading
  // edge reaches it, so the alpha reveal travels with the bulge instead of via a separate linear
  // stagger. After the entrance window, vAlpha sticks at 1.0 forever.
  float arrival = uRingArrivalTime[int(aRingIdx)];
  vAlpha = clamp((uTime - arrival) / ENTRANCE_FADE_S, 0.0, 1.0);

  gl_Position = vec4(worldPos, 0.0, 1.0);
}
`,I=`#version 300 es
precision mediump float;

uniform sampler2D tAtlas;

in vec2 vUv;
in float vRingT;
in float vAlpha;

out vec4 fragColor;

void main() {
  vec4 sampled = texture(tAtlas, vUv);
  float dim = mix(0.85, 1.0, smoothstep(0.0, 0.85, vRingT));
  fragColor = vec4(vec3(dim), sampled.a * vAlpha);
}
`;e.s(["SpiralScene",0,function(e){let m,T,M,y,C,P,x,b=(0,a.c)(12),{className:L}=e,E=h.useRef(null),D=h.useRef(null),[H,O]=h.useState(!1),[F,k]=h.useState("idle"),U=(0,u.useIsTouchDevice)(),z=h.useRef(0);b[0]===Symbol.for("react.memo_cache_sentinel")?(m=e=>{z.current=e.velocity},b[0]=m):m=b[0],(0,o.useLenis)(m);let N="idle"===F&&U?"Tap & hold":R[F];return b[1]===Symbol.for("react.memo_cache_sentinel")?(T=()=>{let e=E.current;if(!e)return;let t=Math.min(window.devicePixelRatio||1,2),a=new l.Renderer({webgl:2,alpha:!1,antialias:!1,depth:!1,stencil:!1,dpr:t,powerPreference:"high-performance"}),o=a.gl,[h,u,d]=(0,c.hexToRgb01)(S);o.clearColor(h,u,d,1),o.enable(o.BLEND),o.blendFunc(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA);let m=o.canvas;for(let t of(m.style.width="100%",m.style.height="100%",m.style.display="block",m.style.position="absolute",m.style.inset="0",Array.from(e.children)))t instanceof HTMLCanvasElement&&e.removeChild(t);e.appendChild(m);let R=w(),T=new s.Texture(o,{image:R,generateMipmaps:!0,premultiplyAlpha:!1,flipY:!1});document.fonts.ready.then(()=>{et.aborted||(T.image=w(),T.needsUpdate=!0,eI())});let M=function(){let e=Array(30);for(let t=0;t<30;t++){let a=t/29,o=.06+1.39*a,n=(t%2==0?1:-1)*(.006+(1-a)*.029000000000000005),i=14+16*a,r=Math.max(8,Math.floor(2*Math.PI*o/(.6*i*.001851851851851852))),l=.15>Math.random()?Math.random()*Math.PI*2:.25+(Math.random()-.5)*A,s=.1>Math.random()?.05+.15*Math.random():.25+.35*a+.3*Math.random();e[t]={radius:o,charsCount:r,speed:n,letterSizePx:i,bandCenter:l,bandHalfWidth:Math.min(.98,s)*Math.PI,bandSoftness:Math.PI*(.07+.13*Math.random())}}return e}(),y=Array(30).fill(0);for(let e=0;e<30;e++){let t=M[e];if(!t)continue;let a=Math.max(0,t.radius-.425);y[e]=1.8*(0,c.smoothstepInverse)(Math.min(1,a/1.6))}let{aRadius:C,aTheta0:P,aSpeed:x,aSize:b,aCharIdx:L,aRingIdx:H}=function(e){let t=0;for(let a of e)t+=a.charsCount;let a=new Float32Array(t),o=new Float32Array(t),n=new Float32Array(t),i=new Float32Array(t),r=new Float32Array(t),l=new Float32Array(t),s=0;for(let t=0;t<e.length;t++){let h=e[t];if(!h)continue;let{isLetter:u,letterIdx:d}=function(e){let t=new Uint8Array(e),a=new Uint16Array(e),o=0;for(;o<e;){for(let n=0;n<g.length&&o<e;n++)t[o]=1,a[o]=g[n]??0,o++;let n=1+Math.floor(3*Math.random());for(let t=0;t<n&&o<e;t++)o++}return{isLetter:t,letterIdx:a}}(h.charsCount),f=Math.random()*Math.PI*2,m=2*Math.PI/h.charsCount,v=h.bandHalfWidth+h.bandSoftness,A=Math.max(0,h.bandHalfWidth-h.bandSoftness);for(let e=0;e<h.charsCount;e++){let g=(Math.random()-.5)*m*0,R=f+e*m+g,S=Math.abs((0,c.wrapAngle)(R-h.bandCenter)),w=(0,c.smoothstep01)(v,A,S),_=1===u[e]&&(w>.7||!(w<.3)&&Math.random()<w);a[s]=h.radius,o[s]=R,n[s]=h.speed,l[s]=t,_?(r[s]=d[e]??0,i[s]=h.letterSizePx*(.85+.15*w)):(r[s]=p,i[s]=5),s++}}return{aRadius:a,aTheta0:o,aSpeed:n,aSize:i,aCharIdx:r,aRingIdx:l,total:t}}(M),F=new n.Geometry(o,{position:{size:2,data:c.BASE_QUAD_POSITION},uv:{size:2,data:c.BASE_QUAD_UV},aRadius:{instanced:1,size:1,data:C},aTheta0:{instanced:1,size:1,data:P},aSpeed:{instanced:1,size:1,data:x},aSize:{instanced:1,size:1,data:b},aCharIdx:{instanced:1,size:1,data:L},aRingIdx:{instanced:1,size:1,data:H}}),U=new r.Program(o,{vertex:_,fragment:I,transparent:!0,depthTest:!1,depthWrite:!1,cullFace:!1,uniforms:{uTime:{value:0},uFitScale:{value:new Float32Array([1,1])},uCenter:{value:new Float32Array([0,0])},uAtlasGrid:{value:new Float32Array([8,v])},uPxToDesign:{value:.001851851851851852},uMouse:{value:new Float32Array([999,999])},uMouseInfluence:{value:0},uMouseRadius:{value:.35},uRingCharge:{value:Array(30).fill(0)},uRingGather:{value:Array(30).fill(0)},uRippleStarts:{value:Array(16).fill(-1)},uRingOffsets:{value:Array(30).fill(0)},uRingArrivalTime:{value:y},tAtlas:{value:T}}}),N=new i.Mesh(o,{geometry:F,program:U,frustumCulled:!1});if(!U.uniformLocations||!U.attributeLocations){let t=o.getShaderInfoLog(U.vertexShader);console.error("[Spiral] shader failed to compile/link",{vsLog:t,fsLog:o.getShaderInfoLog(U.fragmentShader),linkLog:o.getProgramInfoLog(U.program)});try{e.removeChild(m)}catch{}return}let G=U.uniforms.uTime,B=U.uniforms.uFitScale,K=U.uniforms.uCenter,W=U.uniforms.uMouse,X=U.uniforms.uMouseInfluence,j=U.uniforms.uRingCharge,q=U.uniforms.uRingGather,Q=U.uniforms.uRippleStarts,Z=U.uniforms.uRingOffsets,V=1,Y=1,$=()=>{let t=e.getBoundingClientRect();V=Math.max(1,t.width),Y=Math.max(1,t.height),a.setSize(Math.max(1,Math.floor(t.width)),Math.max(1,Math.floor(t.height)));let o=V/Y;o>=1?(B.value[0]=1,B.value[1]=o):(B.value[0]=1/o,B.value[1]=1)};$();let J=new AbortController,{signal:ee}=J,et=ee,ea=window.matchMedia("(prefers-reduced-motion: reduce)"),eo=0,en=!0,ei=!document.hidden,er=!ea.matches,el=performance.now(),es=0,eh=[],eu=new Float32Array(30),ed=new Float32Array(30),ef=0,ec=new Float32Array([999,999]),em=!1,ep=!1,eg=0,ev=0,eA=0,eR=-1,eS=new Float32Array(30),ew=new Float32Array(30),e_=new Float32Array(30),eI=()=>{G.value=es,a.render({scene:N,update:!1,sort:!1,frustumCull:!1})},eT=e=>{let t=Math.min(.05,(e-el)*.001);for(el=e,er&&(es+=t);eh.length>0;){let e=eh[0];if(!e||es-e.start<1.8)break;eh.shift()}let a=Q.value;for(let e=0;e<16;e++){let t=eh[e];a[e]=t?t.start:-1}let o=1-Math.exp(-6*t);X.value=X.value+(ef-X.value)*o;let n=1-Math.exp(-14*t);W.value[0]=W.value[0]+(ec[0]-W.value[0])*n,W.value[1]=W.value[1]+(ec[1]-W.value[1])*n,em?(eg=Math.min(1,eg+t/.9),ev=1-(1-ev)*Math.exp(-t/4),!ep&&eg>=1&&(ep=!0,k("charged"))):(eg*=Math.exp(-10*t),ev*=Math.exp(-10*t));let i=Math.exp(-10*t),r=es-eR,l=eR>=0&&r<1.8,s=l?1.6*(0,c.smoothstep01)(0,1,r/1.8)+.425:1/0,h=j.value,u=q.value;for(let e=0;e<30;e++){let a=M[e];if(!a)continue;let o=eS[e]??0,n=ew[e]??0;if(em){let e=1-Math.exp(-14*t);o+=(eg-o)*e,n+=((0,c.smoothstep01)(0,1,eg)*ev-n)*e}else(!l||s>=a.radius)&&(o*=i,n*=i);eS[e]=o,ew[e]=n,u[e]=n;let r=(0,c.smoothstep01)(0,1,o);h[e]=r,e_[e]=(e_[e]??0)-r*a.speed*t}z.current=z.current*Math.exp(-5*t);let d=Math.min(40,+Math.abs(z.current));eA+=(d-eA)*(1-Math.exp(-4*t));let f=1-Math.exp(-3*t),m=Z.value;for(let e=0;e<30;e++){let a=M[e];if(!a)continue;let o=0;for(let e of eh){let t=es-e.start;if(t<0||t>=1.8)continue;let n=t/1.8,i=1.6*(0,c.smoothstep01)(0,1,n),r=(1-(0,c.smoothstep01)(0,.425,Math.abs(a.radius-i)))*((0,c.smoothstep01)(0,.22,n)*(1-(0,c.smoothstep01)(.78,1,n)))*e.strength;r>o&&(o=r)}let n=Math.sign(a.speed)||1;eu[e]=eu[e]+(.55*o*n+a.speed*eA)*t;let i=ed[e]+(eu[e]-ed[e])*f;ed[e]=i,m[e]=i+(e_[e]??0)}eI(),eo=en&&ei&&er?requestAnimationFrame(eT):0},eM=()=>{0!==eo&&(cancelAnimationFrame(eo),eo=0)},ey=()=>{en&&ei&&er?0===eo&&(el=performance.now(),eo=requestAnimationFrame(eT)):(eM(),eI())},eC=!1,eP=null,ex=!1,eb=()=>{$(),0===eo&&eI()},eL=new ResizeObserver(()=>{if(!en){eC=!0;return}null===eP?eb():(window.clearTimeout(eP),ex=!0),eP=window.setTimeout(()=>{eP=null,ex&&(ex=!1,eb())},150)});eL.observe(e);let eE=new IntersectionObserver(e=>{let t=e[0];t&&((en=t.isIntersecting)&&eC&&(eC=!1,$()),ey())},{threshold:0});eE.observe(e),document.addEventListener("visibilitychange",()=>{ei=!document.hidden,ey()},{signal:et}),ea.addEventListener("change",()=>{er=!ea.matches,ey()},{signal:et});let eD=(e,t)=>{let a=-(t/Y*2-1);return[(e/V*2-1-K.value[0])/B.value[0],(a-K.value[1])/B.value[1]]};return(0,f.setupCursorTracking)({container:e,signal:et,labelRef:D,setIsHovering:O,onPointerMove:(e,t)=>{let[a,o]=eD(e,t);ec[0]=a,ec[1]=o},onPointerEnter:(e,t)=>{let[a,o]=eD(e,t);ec[0]=a,ec[1]=o,W.value[0]=ec[0],W.value[1]=ec[1],ef=1},onPointerLeave:()=>{ef=0,em=!1,ep=!1,k("idle")},onPointerDown:()=>{em=!0,ep=!1,k("holding")},onPointerUp:()=>{if(em){if(em=!1,ep)for(eR=es,eh.push({start:es,strength:.7+.6*ev});eh.length>16;)eh.shift();ep=!1,k("idle")}}}),er?eh.push({start:0,strength:1}):es=2.3,eI(),ey(),()=>{eM(),J.abort(),eE.disconnect(),eL.disconnect(),null!==eP&&window.clearTimeout(eP);try{e.removeChild(m)}catch{}}},M=[],b[1]=T,b[2]=M):(T=b[1],M=b[2]),h.useEffect(T,M),b[3]===Symbol.for("react.memo_cache_sentinel")?(y={backgroundColor:S},b[3]=y):y=b[3],b[4]!==L?(C=(0,d.cx)("relative size-full cursor-pointer select-none overflow-hidden",L),b[4]=L,b[5]=C):C=b[5],b[6]!==H||b[7]!==N?(P=(0,t.jsx)(f.CursorLabel,{labelRef:D,isHovering:H,text:N}),b[6]=H,b[7]=N,b[8]=P):P=b[8],b[9]!==C||b[10]!==P?(x=(0,t.jsx)("div",{ref:E,style:y,className:C,children:P}),b[9]=C,b[10]=P,b[11]=x):x=b[11],x}])},452868,function(e){e.n(e.i(565458))}]);