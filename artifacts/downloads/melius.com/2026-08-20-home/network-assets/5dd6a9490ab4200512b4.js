(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,96345,(e,t,i)=>{function s(e){if(e){var t;return Object.assign(t=e,s.prototype),t._callbacks=new Map,t}this._callbacks=new Map}s.prototype.on=function(e,t){let i=this._callbacks.get(e)??[];return i.push(t),this._callbacks.set(e,i),this},s.prototype.once=function(e,t){let i=(...s)=>{this.off(e,i),t.apply(this,s)};return i.fn=t,this.on(e,i),this},s.prototype.off=function(e,t){if(void 0===e&&void 0===t)return this._callbacks.clear(),this;if(void 0===t)return this._callbacks.delete(e),this;let i=this._callbacks.get(e);if(i){for(let[e,s]of i.entries())if(s===t||s.fn===t){i.splice(e,1);break}0===i.length?this._callbacks.delete(e):this._callbacks.set(e,i)}return this},s.prototype.emit=function(e,...t){let i=this._callbacks.get(e);if(i)for(let e of[...i])e.apply(this,t);return this},s.prototype.listeners=function(e){return this._callbacks.get(e)??[]},s.prototype.listenerCount=function(e){if(e)return this.listeners(e).length;let t=0;for(let e of this._callbacks.values())t+=e.length;return t},s.prototype.hasListeners=function(e){return this.listenerCount(e)>0},s.prototype.addEventListener=s.prototype.on,s.prototype.removeListener=s.prototype.off,s.prototype.removeEventListener=s.prototype.off,s.prototype.removeAllListeners=s.prototype.off,t.exports=s},77889,e=>{"use strict";let t,i,s,r,a;var n=e.i(34729),o=e.i(32919);let l=`
<vert>
</vert>

<frag>
precision highp float;

// uniform sampler2D inputBuffer;

uniform vec2 uScreenRes;
uniform float uDistortionK1;
uniform float uDistortionK2;
uniform float uDistortionCylindricalFactor;

<inject>uvs</inject>

vec2 brownConradyDistortion(in vec2 uv, in float k1, in float k2) {
    uv = uv * 2.0 - 1.0;	// brown conrady takes [-1:1]

    // positive values of K1 give barrel distortion, negative give pincushion
    float r2 = uv.x*uv.x + uv.y*uv.y;
    uv *= 1.0 + k1 * r2 + k2 * r2 * r2;
    
    // tangential distortion (due to off center lens elements)
    // is not modeled in this function, but if it was, the terms would go here
    
    uv = (uv * .5 + .5);	// restore -> [0:1]
    return uv;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = vec3(0.0);
  float alpha = 1.0;

	// Barrel distortion
  vec2 uvBarrel = brownConradyDistortion(uv, uDistortionK1, uDistortionK2);

	// Cylindrical distortion
	float cylindricalFactor = uDistortionCylindricalFactor;
	float stretchedY = uv.y * cylindricalFactor + (1.0 - cylindricalFactor) * 0.5;
	float xFactor = abs(0.5 - uv.x) * 2.0;
	xFactor = pow(xFactor, 2.0);

	vec2 uvCylindrical = uv;
	uvCylindrical.y = mix(uv.y, stretchedY, xFactor);
	
	vec4 sampleDistorted = texture2D(inputBuffer, uvCylindrical);

	color = sampleDistorted.rgb;
	alpha = sampleDistorted.a;

  outputColor = vec4(color, alpha);
}
</frag>`,h=`
<vert>
// attribute vec2 uv;
// attribute vec2 position;

varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0, 1);
}
</vert>

<frag>
precision highp float;
 
varying vec2 vUv;

uniform float uTime;
uniform vec2 uScreenRes;
uniform vec3 uColor;

void main() {
  vec3 color = uColor;

  gl_FragColor.rgb = color;
  gl_FragColor.a = 1.0;

  #include <colorspace_fragment>
}
</frag>`,d=`
<vert>
// attribute vec2 uv;
// attribute vec3 position;
// attribute vec3 normal;

// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// uniform mat3 normalMatrix;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
</vert>

<frag>
precision highp float;
 
uniform sampler2D tMap;
uniform float uAlpha;
 
varying vec2 vUv;

// Rounded box SDF
float sdRoundBox( in vec2 p, in vec2 b, in vec4 r ) 
{
    r.xy = (p.x>0.0)?r.xy : r.zw;
    r.x  = (p.y>0.0)?r.x  : r.y;
    vec2 q = abs(p)-b+r.x;
    return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
}
 
void main() {
	vec3 color = vec3(0.0, 0.0, 0.0);
	float alpha = 1.0;

	vec4 sampleMap = texture2D(tMap, vUv);
	color = sampleMap.rgb;

  vec2 uvSDF = vUv * 2.0 - 1.0;
	float roundedBox = sdRoundBox(uvSDF, vec2(1.0), vec4(0.04));
	alpha *= step(roundedBox, 0.0);

	// Debug
	// color = vec3(1.0);
	// alpha = 1.0;

  gl_FragColor.rgba = vec4(color, alpha);

  #include <colorspace_fragment>
}
</frag>`,c=`
<vert>
// attribute vec2 uv;
// attribute vec3 position;
// attribute vec3 normal;

// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// uniform mat3 normalMatrix;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
</vert>

<frag>
precision highp float;
 
uniform sampler2D tMap;
uniform float uAlpha;
 
varying vec2 vUv;
 
void main() {
	vec3 color = vec3(1.0, 0.0, 0.0);
	float alpha = 1.0;

	vec4 sampleMap = texture2D(tMap, vUv);
	color = sampleMap.rgb;
	alpha = sampleMap.a;

	alpha *= uAlpha;

	// Debug
	// color = vec3(1.0);
	// alpha = 1.0;

  gl_FragColor.rgba = vec4(color, alpha);

  #include <colorspace_fragment>
}
</frag>`,u={uvs:`
vec2 generateCoverUv(vec2 uv, vec2 screenRes, vec2 videoRes) {
  vec2 s = screenRes; // Screen
  vec2 i = videoRes; // Image
  float rs = s.x / s.y;
  float ri = i.x / i.y;
  vec2 new = rs < ri ? vec2(i.x * s.y / i.y, s.y) : vec2(s.x, i.y * s.x / i.x);
  vec2 offset = (rs < ri ? vec2((new.x - s.x) / 2.0, 0.0) : vec2(0.0, (new.y - s.y) / 2.0)) / new;
  vec2 videoUv = uv * s / new + offset;

  return videoUv;
}

vec2 generateCoverUvNoOffset(vec2 uv, vec2 screenRes, vec2 videoRes) {
  vec2 s = screenRes; // Screen
  vec2 i = videoRes; // Image
  float rs = s.x / s.y;
  float ri = i.x / i.y;
  vec2 new = rs < ri ? vec2(i.x * s.y / i.y, s.y) : vec2(s.x, i.y * s.x / i.x);
  vec2 videoUv = uv * s / new;

  return videoUv;
}

// Scale UV centered on [0.5, 0.5]
vec2 scaleUv(vec2 uv, float scale) {
  float invScale = 1.0 / scale;

  vec2 scaledUv = uv * 2.0 - 1.0;
  scaledUv *= invScale;
  scaledUv = scaledUv * 0.5 + 0.5;

  return scaledUv;
}

vec2 scaleUvTarget(vec2 uv, float scale, vec2 center) {
  float invScale = 1.0 / scale;

  vec2 scaledUv = uv * 2.0 - center * 2.0;
  scaledUv *= invScale;
  scaledUv = scaledUv * 0.5 + center;

  return scaledUv;
}`,conditionals:`
float when_eq(float x, float y) {
  return 1.0 - abs(sign(x - y));
}

float when_neq(float x, float y) {
  return abs(sign(x - y));
}

float when_gt(float x, float y) {
  return max(sign(x - y), 0.0);
}

float when_lt(float x, float y) {
  return max(sign(y - x), 0.0);
}

float when_ge(float x, float y) {
  return 1.0 - when_lt(x, y);
}

float when_le(float x, float y) {
  return 1.0 - when_gt(x, y);
}`,cnoise:`
//
// GLSL textureless classic 2D noise "cnoise".
// Author:  Stefan Gustavson
//
// Many thanks to Ian McEwan of Ashima Arts for the
// ideas for permutation and gradient selection.
//
// Copyright (c) 2011 Stefan Gustavson. All rights reserved.
// Distributed under the MIT license. See LICENSE file.
// https://github.com/stegu/webgl-noise
//

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec2 fade(vec2 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise
float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi); // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;  
  g01 *= norm.y;  
  g10 *= norm.z;  
  g11 *= norm.w;  

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}`,snoise:`
//
// Description : Array and textureless GLSL 2D simplex noise function.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x*34.0)+1.0)*x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Local addition, not covered by the notice above.
vec3 scurlnoise2d(vec2 v) {
  float s = snoise(v);
  float s1 = snoise(vec2(v.x - 19.1, v.y + 33.4));
  float s2 = snoise(vec2(v.y + 74.2, v.x - 124.5));
  vec3 c = vec3(s, s1, s2);
  return c;
}`,blendModes:`
//
// Photoshop blend modes in GLSL, from glsl-blend.
//
// Copyright (c) 2015 Jamie Owen.
// Distributed under the MIT license. See LICENSE file.
// https://github.com/jamieowen/glsl-blend
//

// Add
float blendAdd(float base, float blend) {
	return min(base+blend,1.0);
}

vec3 blendAdd(vec3 base, vec3 blend) {
	return min(base+blend,vec3(1.0));
}

vec3 blendAdd(vec3 base, vec3 blend, float opacity) {
	return (blendAdd(base, blend) * opacity + base * (1.0 - opacity));
}

// Average
vec3 blendAverage(vec3 base, vec3 blend) {
	return (base+blend)/2.0;
}

vec3 blendAverage(vec3 base, vec3 blend, float opacity) {
	return (blendAverage(base, blend) * opacity + base * (1.0 - opacity));
}

// Color Burn
float blendColorBurn(float base, float blend) {
	return (blend==0.0)?blend:max((1.0-((1.0-base)/blend)),0.0);
}

vec3 blendColorBurn(vec3 base, vec3 blend) {
	return vec3(blendColorBurn(base.r,blend.r),blendColorBurn(base.g,blend.g),blendColorBurn(base.b,blend.b));
}

vec3 blendColorBurn(vec3 base, vec3 blend, float opacity) {
	return (blendColorBurn(base, blend) * opacity + base * (1.0 - opacity));
}

// Color Dodge
float blendColorDodge(float base, float blend) {
	return (blend==1.0)?blend:min(base/(1.0-blend),1.0);
}

vec3 blendColorDodge(vec3 base, vec3 blend) {
	return vec3(blendColorDodge(base.r,blend.r),blendColorDodge(base.g,blend.g),blendColorDodge(base.b,blend.b));
}

vec3 blendColorDodge(vec3 base, vec3 blend, float opacity) {
	return (blendColorDodge(base, blend) * opacity + base * (1.0 - opacity));
}

// Darken
float blendDarken(float base, float blend) {
	return min(blend,base);
}

vec3 blendDarken(vec3 base, vec3 blend) {
	return vec3(blendDarken(base.r,blend.r),blendDarken(base.g,blend.g),blendDarken(base.b,blend.b));
}

vec3 blendDarken(vec3 base, vec3 blend, float opacity) {
	return (blendDarken(base, blend) * opacity + base * (1.0 - opacity));
}

// Difference
vec3 blendDifference(vec3 base, vec3 blend) {
	return abs(base-blend);
}

vec3 blendDifference(vec3 base, vec3 blend, float opacity) {
	return (blendDifference(base, blend) * opacity + base * (1.0 - opacity));
}

// Exclusion
vec3 blendExclusion(vec3 base, vec3 blend) {
	return base+blend-2.0*base*blend;
}

vec3 blendExclusion(vec3 base, vec3 blend, float opacity) {
	return (blendExclusion(base, blend) * opacity + base * (1.0 - opacity));
}

// Glow
vec3 blendGlow(vec3 base, vec3 blend) {
	return blendReflect(blend,base);
}

vec3 blendGlow(vec3 base, vec3 blend, float opacity) {
	return (blendGlow(base, blend) * opacity + base * (1.0 - opacity));
}

// Hard Light
vec3 blendHardLight(vec3 base, vec3 blend) {
	return blendOverlay(blend,base);
}

vec3 blendHardLight(vec3 base, vec3 blend, float opacity) {
	return (blendHardLight(base, blend) * opacity + base * (1.0 - opacity));
}

// Hard Mix
float blendHardMix(float base, float blend) {
	return (blendVividLight(base,blend)<0.5)?0.0:1.0;
}

vec3 blendHardMix(vec3 base, vec3 blend) {
	return vec3(blendHardMix(base.r,blend.r),blendHardMix(base.g,blend.g),blendHardMix(base.b,blend.b));
}

vec3 blendHardMix(vec3 base, vec3 blend, float opacity) {
	return (blendHardMix(base, blend) * opacity + base * (1.0 - opacity));
}

// Lighten
float blendLighten(float base, float blend) {
	return max(blend,base);
}

vec3 blendLighten(vec3 base, vec3 blend) {
	return vec3(blendLighten(base.r,blend.r),blendLighten(base.g,blend.g),blendLighten(base.b,blend.b));
}

vec3 blendLighten(vec3 base, vec3 blend, float opacity) {
	return (blendLighten(base, blend) * opacity + base * (1.0 - opacity));
}

// Linear Burn
float blendLinearBurn(float base, float blend) {
	// Note : Same implementation as BlendSubtractf
	return max(base+blend-1.0,0.0);
}

vec3 blendLinearBurn(vec3 base, vec3 blend) {
	// Note : Same implementation as BlendSubtract
	return max(base+blend-vec3(1.0),vec3(0.0));
}

vec3 blendLinearBurn(vec3 base, vec3 blend, float opacity) {
	return (blendLinearBurn(base, blend) * opacity + base * (1.0 - opacity));
}

// Linear Dodge
float blendLinearDodge(float base, float blend) {
	// Note : Same implementation as BlendAddf
	return min(base+blend,1.0);
}

vec3 blendLinearDodge(vec3 base, vec3 blend) {
	// Note : Same implementation as BlendAdd
	return min(base+blend,vec3(1.0));
}

vec3 blendLinearDodge(vec3 base, vec3 blend, float opacity) {
	return (blendLinearDodge(base, blend) * opacity + base * (1.0 - opacity));
}

// Linear Light
float blendLinearLight(float base, float blend) {
	return blend<0.5?blendLinearBurn(base,(2.0*blend)):blendLinearDodge(base,(2.0*(blend-0.5)));
}

vec3 blendLinearLight(vec3 base, vec3 blend) {
	return vec3(blendLinearLight(base.r,blend.r),blendLinearLight(base.g,blend.g),blendLinearLight(base.b,blend.b));
}

vec3 blendLinearLight(vec3 base, vec3 blend, float opacity) {
	return (blendLinearLight(base, blend) * opacity + base * (1.0 - opacity));
}

// Multiply
vec3 blendMultiply(vec3 base, vec3 blend) {
	return base * blend;
}

vec3 blendMultiply(vec3 base, vec3 blend, float opacity) {
	return (blendMultiply(base, blend) * opacity + base * (1.0 - opacity));
}

// Negation
vec3 blendNegation(vec3 base, vec3 blend) {
	return vec3(1.0)-abs(vec3(1.0)-base-blend);
}

vec3 blendNegation(vec3 base, vec3 blend, float opacity) {
	return (blendNegation(base, blend) * opacity + base * (1.0 - opacity));
}

// Overlay
float blendOverlay(float base, float blend) {
	return base<0.5?(2.0*base*blend):(1.0-2.0*(1.0-base)*(1.0-blend));
}

vec3 blendOverlay(vec3 base, vec3 blend) {
	return vec3(blendOverlay(base.r,blend.r),blendOverlay(base.g,blend.g),blendOverlay(base.b,blend.b));
}

vec3 blendOverlay(vec3 base, vec3 blend, float opacity) {
	return (blendOverlay(base, blend) * opacity + base * (1.0 - opacity));
}

// Phoenix
vec3 blendPhoenix(vec3 base, vec3 blend) {
	return min(base,blend)-max(base,blend)+vec3(1.0);
}

vec3 blendPhoenix(vec3 base, vec3 blend, float opacity) {
	return (blendPhoenix(base, blend) * opacity + base * (1.0 - opacity));
}

// Reflect
float blendReflect(float base, float blend) {
	return (blend==1.0)?blend:min(base*base/(1.0-blend),1.0);
}

vec3 blendReflect(vec3 base, vec3 blend) {
	return vec3(blendReflect(base.r,blend.r),blendReflect(base.g,blend.g),blendReflect(base.b,blend.b));
}

vec3 blendReflect(vec3 base, vec3 blend, float opacity) {
	return (blendReflect(base, blend) * opacity + base * (1.0 - opacity));
}

// Screen
float blendScreen(float base, float blend) {
	return 1.0-((1.0-base)*(1.0-blend));
}

vec3 blendScreen(vec3 base, vec3 blend) {
	return vec3(blendScreen(base.r,blend.r),blendScreen(base.g,blend.g),blendScreen(base.b,blend.b));
}

vec3 blendScreen(vec3 base, vec3 blend, float opacity) {
	return (blendScreen(base, blend) * opacity + base * (1.0 - opacity));
}

// Soft Light
float blendSoftLight(float base, float blend) {
	return (blend<0.5)?(2.0*base*blend+base*base*(1.0-2.0*blend)):(sqrt(base)*(2.0*blend-1.0)+2.0*base*(1.0-blend));
}

vec3 blendSoftLight(vec3 base, vec3 blend) {
	return vec3(blendSoftLight(base.r,blend.r),blendSoftLight(base.g,blend.g),blendSoftLight(base.b,blend.b));
}

vec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {
	return (blendSoftLight(base, blend) * opacity + base * (1.0 - opacity));
}

// Subtract
float blendSubtract(float base, float blend) {
	return max(base+blend-1.0,0.0);
}

vec3 blendSubtract(vec3 base, vec3 blend) {
	return max(base+blend-vec3(1.0),vec3(0.0));
}

vec3 blendSubtract(vec3 base, vec3 blend, float opacity) {
	return (blendSubtract(base, blend) * opacity + base * (1.0 - opacity));
}

// Vivid Light
float blendVividLight(float base, float blend) {
	return (blend<0.5)?blendColorBurn(base,(2.0*blend)):blendColorDodge(base,(2.0*(blend-0.5)));
}

vec3 blendVividLight(vec3 base, vec3 blend) {
	return vec3(blendVividLight(base.r,blend.r),blendVividLight(base.g,blend.g),blendVividLight(base.b,blend.b));
}

vec3 blendVividLight(vec3 base, vec3 blend, float opacity) {
	return (blendVividLight(base, blend) * opacity + base * (1.0 - opacity));
}`,dither:`
float dither(vec2 uv, vec2 uvCover, vec2 screenRes, sampler2D samplerInput, sampler2D samplerDither, float ditherSize, float ditherContrast, float ditherBrightness) {
  float ditherFrequency = floor(screenRes.x / ditherSize);
  vec4 texInput = texture2D(samplerInput, uv);
  vec4 texDither = texture2D(samplerDither, uv * ditherFrequency);

  // Dithering - Contrast & Brightness
  vec3 inputColorAdjusted = (texInput.rgb - 0.5) * ditherContrast + 0.5 + ditherBrightness;
  inputColorAdjusted = clamp(inputColorAdjusted, 0.0, 1.0);

  // Dithering - Luminance
  float luminance = dot(inputColorAdjusted, vec3(0.2126, 0.7152, 0.0722));
  float dithered = step(texDither.r, luminance);

  return dithered;
}`,linearMap:`
float linearMap(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}`},f=new class{constructor(){this.urlParams=new URLSearchParams(window.location.search),this.isActive=null!==this.urlParams.get("dev"),this.hasLoaded=!1,this.hasCreated=!1,this.queue=[],this.isActive&&this.init(),this.TAB_SCENE=0,this.TAB_ENTITIES=1}async init(){let s=e.A(44996),r=e.A(8327),[a,n]=await Promise.all([s,r]);t=a.Pane,i=n,this.hasLoaded=!0,this.create()}getUrlParameter(e){return this.urlParams.get(e)}create(){this.pane=new t({title:"GUI"}),this.pane.registerPlugin(i),this.fpsGraph=this.pane.addBlade({view:"fpsgraph",label:"FPS",rows:2}),this.tabs=this.pane.addTab({pages:[{title:"Scenes"},{title:"Entities"}]}),this.sceneFolders={},this.sceneEntitiesFolders={},this.folderActions=this.tabs.pages[this.TAB_SCENE].addFolder({title:"Actions"}),this.queue.forEach(e=>{e()}),this.queue=[],this.pane.element.parentElement.style.position="fixed",this.pane.element.parentElement.style.zIndex=999999,this.pane.element.parentElement.style.width="300px",this.pane.element.parentElement.style.maxWidth="90%",this.hasCreated=!0}destroy(){}clear(){this.hasCreated&&this.tabs&&this.tabs.pages&&(this.tabs.pages[this.TAB_SCENE]&&this.tabs.pages[this.TAB_SCENE].children.forEach(e=>{e.dispose()}),this.tabs.pages[this.TAB_ENTITIES]&&this.tabs.pages[this.TAB_ENTITIES].children.forEach(e=>{e.dispose()}))}checkOrWaitLoading(e){this.isActive&&(this.hasLoaded&&0===this.queue.length?e():this.queue.push(e))}addScene(e,t=!1){this.checkOrWaitLoading(()=>{this.sceneFolders[e]=this.tabs.pages[this.TAB_SCENE].addFolder({title:e,expanded:t}),this.sceneEntitiesFolders[e]=this.tabs.pages[this.TAB_ENTITIES].addFolder({title:e,expanded:t})})}addAction({label:e,callback:t,scene:i}={label:"",callback:()=>{},scene:null}){this.checkOrWaitLoading(()=>{if(void 0===t)return console.warn(`GUI.addAction(${e}): callback is undefined`);(null!==i?this.sceneFolders[i]:this.tabs.pages[this.TAB_SCENE]).addButton({title:e}).on("click",t)})}addList({label:e,options:t,callback:i,scene:s}={label:"",options:[],callback:()=>{},scene:null}){this.checkOrWaitLoading(()=>{if(0===t.length)return console.warn(`GUI.addList(${e}): options array is empty`);(null!==s?this.sceneFolders[s]:this.tabs.pages[this.TAB_SCENE]).addBlade({view:"list",label:e,options:t,value:t[0].value}).on("change",i)})}addSceneGlobal({name:e,config:t,scene:i,expanded:s}={name:"",config:{},scene:null,expanded:!1}){this.checkOrWaitLoading(()=>{let r=(null!==i?this.sceneFolders[i]:this.tabs.pages[this.TAB_SCENE]).addFolder({title:e,expanded:s||!1});if(!t)return console.warn(`GUI.addSceneGlobal(${e}): config array is empty`);for(let[e,i]of Object.entries(t)){let t=r.addBinding(i,"value",{...i.params,label:e});i.onChange&&t.on("change",e=>{i.onChange(e)})}return r})}addEntity({name:e,config:t,scene:i,expanded:s}={label:"",config:{},scene:null,expanded:!1}){this.checkOrWaitLoading(()=>{let r=(null!==i?this.sceneEntitiesFolders[i]:this.tabs.pages[this.TAB_ENTITIES]).addFolder({title:e,expanded:s||!1});if(!t)return console.warn(`GUI.addEntity(${e}): config array is empty`);for(let[e,i]of Object.entries(t)){let t=r.addBinding(i,"value",{...i.params,label:e});i.onChange&&t.on("change",e=>{i.onChange(e)})}return r})}removeEntity(e){e&&e.dispose()}fpsCaptureBegin(){this.isActive&&this.hasLoaded&&this.hasCreated&&this.fpsGraph.begin()}fpsCaptureEnd(){this.isActive&&this.hasLoaded&&this.hasCreated&&this.fpsGraph.end()}addEventListeners(){}removeEventListeners(){}},p=(e,{defines:t,vertPrefix:i,fragPrefix:s}={defines:"",vertPrefix:"",fragPrefix:""})=>{if("string"!=typeof e)return console.error(`Parsed file is not a string : ${e}`),{vert:g,frag:m};if(!e.includes("<vert>")||!e.includes("</vert>")||!e.includes("<frag>")||!e.includes("</frag>"))return console.error(`Parsed file doesn't contain correct shader tags : ${e}`),{vert:g,frag:m};for(;e.search(/<inject>(.*?)<\/inject>/g)>=0;){let t=v(e,"<inject>","</inject>");if(!u.hasOwnProperty(t))return console.error(`Parsed file contains incorrect commons : ${e}`),{vert:g,frag:m};e=e.replace(`<inject>${t}</inject>`,u[t])}let r=v(e,"<vert>","</vert>"),a=v(e,"<frag>","</frag>");return r=r.replace(/^\n+|\n+$/g,""),a=a.replace(/^\n+|\n+$/g,""),{vert:r=i+t+r,frag:a=s+t+a}},v=(e,t,i)=>e.substring(e.indexOf(t)+t.length,e.indexOf(i)),g=`
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}`,m=`
void main() {
  gl_FragColor.rgba = vec4(0.0, 0.0, 0.0, 1.0);
}`;var b=e.i(21348);class S{constructor({name:e,scene:t,parent:i,config:s}){this.name=e||"Background",this.scene=t,this.parent=i||t.root,this.sceneVars=t.sceneVars,this.isActive=!1,this.setInitialState(),this.createConfig(s),this.createMesh()}enable(){this.isActive=!0,this.addEventListeners(),this.mesh.visible=!0}disable(){this.isActive=!1,this.removeEventListeners(),this.mesh.visible=!1}reset(){this.setInitialState()}destroy(){this.disable(),this.mesh.parent.remove(this.mesh),this.mesh=null}initDebug(){f.isActive&&f.addEntity({name:this.name,config:this.config,scene:this.scene.name})}setInitialState(){}createConfig(e){if(this.config={color:{value:n.COLORS.darkGrey}},e)for(let[t,i]of Object.entries(e))void 0!==this.config[t]&&(this.config[t].value=i)}createMesh(){let e=new b.PlaneGeometry(2,2),t=p(h);this.material=new b.ShaderMaterial({vertexShader:t.vert,fragmentShader:t.frag,uniforms:{uScreenRes:{value:[this.sceneVars.width,this.sceneVars.height]},uAspectRatio:{value:this.sceneVars.aspectRatio},uTime:{value:0},uColor:{value:new b.Color(this.config.color.value)}},depthTest:!1,depthWrite:!1}),this.mesh=new b.Mesh(e,this.material),this.mesh.renderOrder=-1,this.parent.add(this.mesh),this.enable()}addEventListeners(){}removeEventListeners(){}handleResize(){this.material.uniforms.uScreenRes.value=[this.sceneVars.width,this.sceneVars.height],this.material.uniforms.uAspectRatio.value=this.sceneVars.aspectRatio}handleAssetsLoad(){}update(e,t){this.isActive&&(this.material.uniforms.uTime.value=.001*e,f.isActive&&(this.material.uniforms.uColor.value=new b.Color(this.config.color.value)))}}var E=b,y=(s=new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),r=new Float32Array([0,0,2,0,0,2]),(a=new E.BufferGeometry).setAttribute("position",new E.BufferAttribute(s,3)),a.setAttribute("uv",new E.BufferAttribute(r,2)),a),w=class e{static get fullscreenGeometry(){return y}constructor(e="Pass",t=new E.Scene,i=new E.OrthographicCamera){this.name=e,this.renderer=null,this.scene=t,this.camera=i,this.screen=null,this.rtt=!0,this.needsSwap=!0,this.needsDepthBlit=!1,this.needsDepthTexture=!1,this.enabled=!0}get renderToScreen(){return!this.rtt}set renderToScreen(e){if(this.rtt===e){let t=this.fullscreenMaterial;null!==t&&(t.needsUpdate=!0),this.rtt=!e}}set mainScene(e){}set mainCamera(e){}setRenderer(e){this.renderer=e}isEnabled(){return this.enabled}setEnabled(e){this.enabled=e}get fullscreenMaterial(){return null!==this.screen?this.screen.material:null}set fullscreenMaterial(t){let i=this.screen;null!==i?i.material=t:((i=new E.Mesh(e.fullscreenGeometry,t)).frustumCulled=!1,null===this.scene&&(this.scene=new E.Scene),this.scene.add(i),this.screen=i)}getFullscreenMaterial(){return this.fullscreenMaterial}setFullscreenMaterial(e){this.fullscreenMaterial=e}getDepthTexture(){return null}setDepthTexture(e,t=E.BasicDepthPacking){}render(e,t,i,s,r){throw Error("Render method not implemented!")}setSize(e,t){}initialize(e,t,i){}dispose(){for(let t of Object.keys(this)){let i=this[t];(i instanceof E.WebGLRenderTarget||i instanceof E.Material||i instanceof E.Texture||i instanceof e)&&this[t].dispose()}null!==this.fullscreenMaterial&&this.fullscreenMaterial.dispose()}},x=class extends w{constructor(){super("ClearMaskPass",null,null),this.needsSwap=!1}render(e,t,i,s,r){let a=e.state.buffers.stencil;a.setLocked(!1),a.setTest(!1)}},T=`#ifdef COLOR_WRITE
#include <common>
#include <dithering_pars_fragment>
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
#endif
#ifdef DEPTH_WRITE
#include <packing>
#ifdef GL_FRAGMENT_PRECISION_HIGH
uniform highp sampler2D depthBuffer;
#else
uniform mediump sampler2D depthBuffer;
#endif
float readDepth(const in vec2 uv){
#if DEPTH_PACKING == 3201
return unpackRGBAToDepth(texture2D(depthBuffer,uv));
#else
return texture2D(depthBuffer,uv).r;
#endif
}
#endif
#ifdef USE_WEIGHTS
uniform vec4 channelWeights;
#endif
uniform float opacity;varying vec2 vUv;void main(){
#ifdef COLOR_WRITE
vec4 texel=texture2D(inputBuffer,vUv);
#ifdef USE_WEIGHTS
texel*=channelWeights;
#endif
gl_FragColor=opacity*texel;
#ifdef COLOR_SPACE_CONVERSION
#include <colorspace_fragment>
#endif
#include <dithering_fragment>
#else
gl_FragColor=vec4(0.0);
#endif
#ifdef DEPTH_WRITE
gl_FragDepth=readDepth(vUv);
#endif
}`,A=class extends E.ShaderMaterial{constructor(){super({name:"CopyMaterial",defines:{COLOR_SPACE_CONVERSION:"1",DEPTH_PACKING:"0",COLOR_WRITE:"1"},uniforms:{inputBuffer:new E.Uniform(null),depthBuffer:new E.Uniform(null),channelWeights:new E.Uniform(null),opacity:new E.Uniform(1)},blending:E.NoBlending,toneMapped:!1,depthWrite:!1,depthTest:!1,fragmentShader:T,vertexShader:"varying vec2 vUv;void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}"}),this.depthFunc=E.AlwaysDepth}get inputBuffer(){return this.uniforms.inputBuffer.value}set inputBuffer(e){let t=null!==e;this.colorWrite!==t&&(t?this.defines.COLOR_WRITE=!0:delete this.defines.COLOR_WRITE,this.colorWrite=t,this.needsUpdate=!0),this.uniforms.inputBuffer.value=e}get depthBuffer(){return this.uniforms.depthBuffer.value}set depthBuffer(e){let t=null!==e;this.depthWrite!==t&&(t?this.defines.DEPTH_WRITE=!0:delete this.defines.DEPTH_WRITE,this.depthTest=t,this.depthWrite=t,this.needsUpdate=!0),this.uniforms.depthBuffer.value=e}set depthPacking(e){this.defines.DEPTH_PACKING=e.toFixed(0),this.needsUpdate=!0}get colorSpaceConversion(){return void 0!==this.defines.COLOR_SPACE_CONVERSION}set colorSpaceConversion(e){this.colorSpaceConversion!==e&&(e?this.defines.COLOR_SPACE_CONVERSION=!0:delete this.defines.COLOR_SPACE_CONVERSION,this.needsUpdate=!0)}get channelWeights(){return this.uniforms.channelWeights.value}set channelWeights(e){null!==e?(this.defines.USE_WEIGHTS="1",this.uniforms.channelWeights.value=e):delete this.defines.USE_WEIGHTS,this.needsUpdate=!0}setInputBuffer(e){this.uniforms.inputBuffer.value=e}getOpacity(e){return this.uniforms.opacity.value}setOpacity(e){this.uniforms.opacity.value=e}},R=class extends w{constructor(e,t=!0){super("CopyPass"),this.fullscreenMaterial=new A,this.needsSwap=!1,this.renderTarget=e,void 0===e&&(this.renderTarget=new E.WebGLRenderTarget(1,1,{minFilter:E.LinearFilter,magFilter:E.LinearFilter,stencilBuffer:!1,depthBuffer:!1}),this.renderTarget.texture.name="CopyPass.Target"),this.autoResize=t}get resize(){return this.autoResize}set resize(e){this.autoResize=e}get texture(){return this.renderTarget.texture}getTexture(){return this.renderTarget.texture}setAutoResizeEnabled(e){this.autoResize=e}render(e,t,i,s,r){this.fullscreenMaterial.inputBuffer=t.texture,e.setRenderTarget(this.renderToScreen?null:this.renderTarget),e.render(this.scene,this.camera)}setSize(e,t){this.autoResize&&this.renderTarget.setSize(e,t)}initialize(e,t,i){void 0!==i&&(this.renderTarget.texture.type=i,i!==E.UnsignedByteType?this.fullscreenMaterial.defines.FRAMEBUFFER_PRECISION_HIGH="1":null!==e&&e.outputColorSpace===E.SRGBColorSpace&&(this.renderTarget.texture.colorSpace=E.SRGBColorSpace))}},C=new E.Color,L=class extends w{constructor(e=!0,t=!0,i=!1){super("ClearPass",null,null),this.needsSwap=!1,this.color=e,this.depth=t,this.stencil=i,this.overrideClearColor=null,this.overrideClearAlpha=-1}setClearFlags(e,t,i){this.color=e,this.depth=t,this.stencil=i}getOverrideClearColor(){return this.overrideClearColor}setOverrideClearColor(e){this.overrideClearColor=e}getOverrideClearAlpha(){return this.overrideClearAlpha}setOverrideClearAlpha(e){this.overrideClearAlpha=e}render(e,t,i,s,r){let a=this.overrideClearColor,n=this.overrideClearAlpha,o=e.getClearAlpha(),l=null!==a,h=n>=0;l?(e.getClearColor(C),e.setClearColor(a,h?n:o)):h&&e.setClearAlpha(n),e.setRenderTarget(this.renderToScreen?null:t),e.clear(this.color,this.depth,this.stencil),l?e.setClearColor(C,o):h&&e.setClearAlpha(o)}},M=class extends w{constructor(e,t){super("MaskPass",e,t),this.needsSwap=!1,this.clearPass=new L(!1,!1,!0),this.inverse=!1}set mainScene(e){this.scene=e}set mainCamera(e){this.camera=e}get inverted(){return this.inverse}set inverted(e){this.inverse=e}get clear(){return this.clearPass.enabled}set clear(e){this.clearPass.enabled=e}getClearPass(){return this.clearPass}isInverted(){return this.inverted}setInverted(e){this.inverted=e}render(e,t,i,s,r){let a=e.getContext(),n=e.state.buffers,o=this.scene,l=this.camera,h=this.clearPass,d=+!this.inverted;n.color.setMask(!1),n.depth.setMask(!1),n.color.setLocked(!0),n.depth.setLocked(!0),n.stencil.setTest(!0),n.stencil.setOp(a.REPLACE,a.REPLACE,a.REPLACE),n.stencil.setFunc(a.ALWAYS,d,0xffffffff),n.stencil.setClear(1-d),n.stencil.setLocked(!0),this.clearPass.enabled&&(this.renderToScreen?h.render(e,null):(h.render(e,t),h.render(e,i))),this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),e.render(o,l),e.setRenderTarget(i)),e.render(o,l),n.color.setLocked(!1),n.depth.setLocked(!1),n.stencil.setLocked(!1),n.stencil.setFunc(a.EQUAL,1,0xffffffff),n.stencil.setOp(a.KEEP,a.KEEP,a.KEEP),n.stencil.setLocked(!0)}},D=class{constructor(){this.startTime=performance.now(),this.previousTime=0,this.currentTime=0,this._delta=0,this._elapsed=0,this._fixedDelta=1e3/60,this.timescale=1,this.useFixedDelta=!1,this._autoReset=!1}get autoReset(){return this._autoReset}set autoReset(e){"u">typeof document&&void 0!==document.hidden&&(e?document.addEventListener("visibilitychange",this):document.removeEventListener("visibilitychange",this),this._autoReset=e)}get delta(){return .001*this._delta}get fixedDelta(){return .001*this._fixedDelta}set fixedDelta(e){this._fixedDelta=1e3*e}get elapsed(){return .001*this._elapsed}update(e){this.useFixedDelta?this._delta=this.fixedDelta:(this.previousTime=this.currentTime,this.currentTime=(void 0!==e?e:performance.now())-this.startTime,this._delta=this.currentTime-this.previousTime),this._delta*=this.timescale,this._elapsed+=this._delta}reset(){this._delta=0,this._elapsed=0,this.currentTime=performance.now()-this.startTime}getDelta(){return this.delta}getElapsed(){return this.elapsed}handleEvent(e){document.hidden||(this.currentTime=performance.now()-this.startTime)}dispose(){this.autoReset=!1}},F=class{constructor(e=null,{depthBuffer:t=!0,stencilBuffer:i=!1,multisampling:s=0,frameBufferType:r}={}){this.renderer=null,this.inputBuffer=this.createBuffer(t,i,r,s),this.outputBuffer=this.inputBuffer.clone(),this.copyPass=new R,this.depthTexture=null,this.depthRenderTarget=null,this.passes=[],this.timer=new D,this.autoRenderToScreen=!0,this.setRenderer(e)}get multisampling(){return this.inputBuffer.samples}set multisampling(e){let t=this.inputBuffer,i=this.multisampling;i>0&&e>0?(this.inputBuffer.samples=e,this.outputBuffer.samples=e,this.inputBuffer.dispose(),this.outputBuffer.dispose()):i!==e&&(this.inputBuffer.dispose(),this.outputBuffer.dispose(),this.inputBuffer=this.createBuffer(t.depthBuffer,t.stencilBuffer,t.texture.type,e),this.outputBuffer=this.inputBuffer.clone())}getTimer(){return this.timer}getRenderer(){return this.renderer}setRenderer(e){if(this.renderer=e,null!==e){let t=e.getSize(new E.Vector2),i=e.getContext().getContextAttributes().alpha,s=this.inputBuffer.texture.type;for(let r of(s===E.UnsignedByteType&&e.outputColorSpace===E.SRGBColorSpace&&(this.inputBuffer.texture.colorSpace=E.SRGBColorSpace,this.outputBuffer.texture.colorSpace=E.SRGBColorSpace,this.inputBuffer.dispose(),this.outputBuffer.dispose()),e.autoClear=!1,this.setSize(t.width,t.height),this.passes))r.initialize(e,i,s)}}replaceRenderer(e,t=!0){let i=this.renderer,s=i.domElement.parentNode;return this.setRenderer(e),t&&null!==s&&(s.removeChild(i.domElement),s.appendChild(e.domElement)),i}createDepthTexture(){let e=this.inputBuffer,t=new E.DepthTexture;this.depthTexture=t,e.stencilBuffer?(t.format=E.DepthStencilFormat,t.type=E.UnsignedInt248Type):t.type=E.FloatType;let i=t.clone();return i.name="EffectComposer.StableDepth",this.depthRenderTarget=new E.WebGLRenderTarget(e.width,e.height,{depthBuffer:!0,stencilBuffer:e.stencilBuffer,depthTexture:i}),i}blitDepthBuffer(e){let t=this.renderer,i=this.depthRenderTarget,s=t.properties,r=t.getContext();t.setRenderTarget(i);let a=s.get(e).__webglFramebuffer,n=s.get(i).__webglFramebuffer,o=e.stencilBuffer?r.DEPTH_BUFFER_BIT|r.STENCIL_BUFFER_BIT:r.DEPTH_BUFFER_BIT;r.bindFramebuffer(r.READ_FRAMEBUFFER,a),r.bindFramebuffer(r.DRAW_FRAMEBUFFER,n),r.blitFramebuffer(0,0,e.width,e.height,0,0,i.width,i.height,o,r.NEAREST),r.bindFramebuffer(r.READ_FRAMEBUFFER,null),r.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),t.setRenderTarget(null)}deleteDepthTexture(){if(null!==this.depthTexture)for(let e of(this.depthTexture.dispose(),this.depthTexture=null,this.depthRenderTarget.dispose(),this.depthRenderTarget=null,this.inputBuffer.depthTexture=null,this.outputBuffer.depthTexture=null,this.passes))e.setDepthTexture(null)}createBuffer(e,t,i,s){let r=this.renderer,a=null===r?new E.Vector2:r.getDrawingBufferSize(new E.Vector2),n={minFilter:E.LinearFilter,magFilter:E.LinearFilter,stencilBuffer:t,depthBuffer:e,type:i},o=new E.WebGLRenderTarget(a.width,a.height,n);return s>0&&(o.samples=s),i===E.UnsignedByteType&&null!==r&&r.outputColorSpace===E.SRGBColorSpace&&(o.texture.colorSpace=E.SRGBColorSpace),o.texture.name="EffectComposer.Buffer",o.texture.generateMipmaps=!1,o}setMainScene(e){for(let t of this.passes)t.mainScene=e}setMainCamera(e){for(let t of this.passes)t.mainCamera=e}addPass(e,t){let i=this.passes,s=this.renderer,r=s.getDrawingBufferSize(new E.Vector2),a=s.getContext().getContextAttributes().alpha,n=this.inputBuffer.texture.type;if(e.renderer=s,e.setSize(r.width,r.height),e.initialize(s,a,n),this.autoRenderToScreen&&(i.length>0&&(i[i.length-1].renderToScreen=!1),e.renderToScreen&&(this.autoRenderToScreen=!1)),void 0!==t?i.splice(t,0,e):i.push(e),this.autoRenderToScreen&&(i[i.length-1].renderToScreen=!0),e.needsDepthTexture||null!==this.depthTexture)if(null===this.depthTexture){let t=this.createDepthTexture();for(e of i)e.setDepthTexture(t)}else{let t=this.depthRenderTarget.depthTexture;e.setDepthTexture(t)}}removePass(e){let t=this.passes,i=t.indexOf(e);if(-1!==i&&t.splice(i,1).length>0){if(null!==this.depthTexture&&!t.reduce((e,t)=>e||t.needsDepthTexture,!1)){let t=this.depthRenderTarget.depthTexture;e.getDepthTexture()===t&&e.setDepthTexture(null),this.deleteDepthTexture()}this.autoRenderToScreen&&i===t.length&&(e.renderToScreen=!1,t.length>0&&(t[t.length-1].renderToScreen=!0))}}removeAllPasses(){let e=this.passes;this.deleteDepthTexture(),e.length>0&&(this.autoRenderToScreen&&(e[e.length-1].renderToScreen=!1),this.passes=[])}render(e){let t,i=this.renderer,s=this.copyPass,r=this.inputBuffer,a=this.outputBuffer,n=!1;for(let o of(void 0===e&&(this.timer.update(),e=this.timer.getDelta()),this.passes))if(o.enabled){if(r.depthTexture=this.depthTexture,a.depthTexture=null,o.render(i,r,a,e,n),o.needsDepthBlit&&null!==this.depthRenderTarget&&this.blitDepthBuffer(r),o.needsSwap){if(n){s.renderToScreen=o.renderToScreen;let t=i.getContext(),l=i.state.buffers.stencil;l.setFunc(t.NOTEQUAL,1,0xffffffff),s.render(i,r,a,e,n),l.setFunc(t.EQUAL,1,0xffffffff)}t=r,r=a,a=t}o instanceof M?n=!0:o instanceof x&&(n=!1)}}setSize(e,t,i){let s=this.renderer,r=s.getSize(new E.Vector2);(void 0===e||void 0===t)&&(e=r.width,t=r.height),(r.width!==e||r.height!==t)&&s.setSize(e,t,i);let a=s.getDrawingBufferSize(new E.Vector2);for(let e of(this.inputBuffer.setSize(a.width,a.height),this.outputBuffer.setSize(a.width,a.height),null!==this.depthRenderTarget&&this.depthRenderTarget.setSize(a.width,a.height),this.passes))e.setSize(a.width,a.height)}reset(){this.dispose(),this.autoRenderToScreen=!0}dispose(){for(let e of this.passes)e.dispose();this.passes=[],null!==this.inputBuffer&&this.inputBuffer.dispose(),null!==this.outputBuffer&&this.outputBuffer.dispose(),this.deleteDepthTexture(),this.copyPass.dispose(),this.timer.dispose(),w.fullscreenGeometry.dispose()}},_={FRAGMENT_HEAD:"FRAGMENT_HEAD",FRAGMENT_MAIN_UV:"FRAGMENT_MAIN_UV",FRAGMENT_MAIN_IMAGE:"FRAGMENT_MAIN_IMAGE",VERTEX_HEAD:"VERTEX_HEAD",VERTEX_MAIN_SUPPORT:"VERTEX_MAIN_SUPPORT"},B=class{constructor(){this.shaderParts=new Map([[_.FRAGMENT_HEAD,null],[_.FRAGMENT_MAIN_UV,null],[_.FRAGMENT_MAIN_IMAGE,null],[_.VERTEX_HEAD,null],[_.VERTEX_MAIN_SUPPORT,null]]),this.defines=new Map,this.uniforms=new Map,this.blendModes=new Map,this.extensions=new Set,this.attributes=0,this.varyings=new Set,this.uvTransformation=!1,this.readDepth=!1,this.colorSpace=E.LinearSRGBColorSpace}},P=!1,U=class{constructor(e=null){this.originalMaterials=new Map,this.material=null,this.materials=null,this.materialsBackSide=null,this.materialsDoubleSide=null,this.materialsFlatShaded=null,this.materialsFlatShadedBackSide=null,this.materialsFlatShadedDoubleSide=null,this.setMaterial(e),this.meshCount=0,this.replaceMaterial=e=>{if(e.isMesh){let t;if(e.material.flatShading)switch(e.material.side){case E.DoubleSide:t=this.materialsFlatShadedDoubleSide;break;case E.BackSide:t=this.materialsFlatShadedBackSide;break;default:t=this.materialsFlatShaded}else switch(e.material.side){case E.DoubleSide:t=this.materialsDoubleSide;break;case E.BackSide:t=this.materialsBackSide;break;default:t=this.materials}this.originalMaterials.set(e,e.material),e.isSkinnedMesh?e.material=t[2]:e.isInstancedMesh?e.material=t[1]:e.material=t[0],++this.meshCount}}}cloneMaterial(e){if(!(e instanceof E.ShaderMaterial))return e.clone();let t=e.uniforms,i=new Map;for(let e in t){let s=t[e].value;s.isRenderTargetTexture&&(t[e].value=null,i.set(e,s))}let s=e.clone();for(let e of i)t[e[0]].value=e[1],s.uniforms[e[0]].value=e[1];return s}setMaterial(e){if(this.disposeMaterials(),this.material=e,null!==e){let t=this.materials=[this.cloneMaterial(e),this.cloneMaterial(e),this.cloneMaterial(e)];for(let i of t)i.uniforms=Object.assign({},e.uniforms),i.side=E.FrontSide;t[2].skinning=!0,this.materialsBackSide=t.map(t=>{let i=this.cloneMaterial(t);return i.uniforms=Object.assign({},e.uniforms),i.side=E.BackSide,i}),this.materialsDoubleSide=t.map(t=>{let i=this.cloneMaterial(t);return i.uniforms=Object.assign({},e.uniforms),i.side=E.DoubleSide,i}),this.materialsFlatShaded=t.map(t=>{let i=this.cloneMaterial(t);return i.uniforms=Object.assign({},e.uniforms),i.flatShading=!0,i}),this.materialsFlatShadedBackSide=t.map(t=>{let i=this.cloneMaterial(t);return i.uniforms=Object.assign({},e.uniforms),i.flatShading=!0,i.side=E.BackSide,i}),this.materialsFlatShadedDoubleSide=t.map(t=>{let i=this.cloneMaterial(t);return i.uniforms=Object.assign({},e.uniforms),i.flatShading=!0,i.side=E.DoubleSide,i})}}render(e,t,i){let s=e.shadowMap.enabled;if(e.shadowMap.enabled=!1,P){let s=this.originalMaterials;for(let r of(this.meshCount=0,t.traverse(this.replaceMaterial),e.render(t,i),s))r[0].material=r[1];this.meshCount!==s.size&&s.clear()}else{let s=t.overrideMaterial;t.overrideMaterial=this.material,e.render(t,i),t.overrideMaterial=s}e.shadowMap.enabled=s}disposeMaterials(){if(null!==this.material)for(let e of this.materials.concat(this.materialsBackSide).concat(this.materialsDoubleSide).concat(this.materialsFlatShaded).concat(this.materialsFlatShadedBackSide).concat(this.materialsFlatShadedDoubleSide))e.dispose()}dispose(){this.originalMaterials.clear(),this.disposeMaterials()}static get workaroundEnabled(){return P}static set workaroundEnabled(e){P=e}};E.EventDispatcher;var O={SKIP:9,SET:30,ADD:0,ALPHA:1,AVERAGE:2,COLOR:3,COLOR_BURN:4,COLOR_DODGE:5,DARKEN:6,DIFFERENCE:7,DIVIDE:8,DST:9,EXCLUSION:10,HARD_LIGHT:11,HARD_MIX:12,HUE:13,INVERT:14,INVERT_RGB:15,LIGHTEN:16,LINEAR_BURN:17,LINEAR_DODGE:18,LINEAR_LIGHT:19,LUMINOSITY:20,MULTIPLY:21,NEGATION:22,NORMAL:23,OVERLAY:24,PIN_LIGHT:25,REFLECT:26,SATURATION:27,SCREEN:28,SOFT_LIGHT:29,SRC:30,SUBTRACT:31,VIVID_LIGHT:32},G=new Map([[O.ADD,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb+src.rgb;return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.ALPHA,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){return mix(dst,src,src.a*opacity);}"],[O.AVERAGE,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=(dst.rgb+src.rgb)*0.5;return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.COLOR,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=RGBToHSL(dst.rgb);vec3 b=RGBToHSL(src.rgb);vec3 c=HSLToRGB(vec3(b.xy,a.z));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.COLOR_BURN,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=dst.rgb,b=src.rgb;vec3 c=mix(step(0.0,b)*(1.0-min(vec3(1.0),(1.0-a)/max(b,1e-9))),vec3(1.0),step(1.0,a));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.COLOR_DODGE,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=dst.rgb,b=src.rgb;vec3 c=step(0.0,a)*mix(min(vec3(1.0),a/max(1.0-b,1e-9)),vec3(1.0),step(1.0,b));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.DARKEN,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=min(dst.rgb,src.rgb);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.DIFFERENCE,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=abs(dst.rgb-src.rgb);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.DIVIDE,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb/max(src.rgb,1e-9);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.DST,null],[O.EXCLUSION,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb+src.rgb-2.0*dst.rgb*src.rgb;return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.HARD_LIGHT,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=min(dst.rgb,1.0);vec3 b=min(src.rgb,1.0);vec3 c=mix(2.0*a*b,1.0-2.0*(1.0-a)*(1.0-b),step(0.5,b));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.HARD_MIX,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=step(1.0,dst.rgb+src.rgb);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.HUE,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=RGBToHSL(dst.rgb);vec3 b=RGBToHSL(src.rgb);vec3 c=HSLToRGB(vec3(b.x,a.yz));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.INVERT,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=max(1.0-src.rgb,0.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.INVERT_RGB,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=src.rgb*max(1.0-dst.rgb,0.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.LIGHTEN,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=max(dst.rgb,src.rgb);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.LINEAR_BURN,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=clamp(src.rgb+dst.rgb-1.0,0.0,1.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.LINEAR_DODGE,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=min(dst.rgb+src.rgb,1.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.LINEAR_LIGHT,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=clamp(2.0*src.rgb+dst.rgb-1.0,0.0,1.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.LUMINOSITY,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=RGBToHSL(dst.rgb);vec3 b=RGBToHSL(src.rgb);vec3 c=HSLToRGB(vec3(a.xy,b.z));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.MULTIPLY,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb*src.rgb;return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.NEGATION,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=max(1.0-abs(1.0-dst.rgb-src.rgb),0.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.NORMAL,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){return mix(dst,src,opacity);}"],[O.OVERLAY,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=2.0*src.rgb*dst.rgb;vec3 b=1.0-2.0*(1.0-src.rgb)*(1.0-dst.rgb);vec3 c=mix(a,b,step(0.5,dst.rgb));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.PIN_LIGHT,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 src2=2.0*src.rgb;vec3 c=mix(mix(src2,dst.rgb,step(0.5*dst.rgb,src.rgb)),max(src2-1.0,vec3(0.0)),step(dst.rgb,src2-1.0));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.REFLECT,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=min(dst.rgb*dst.rgb/max(1.0-src.rgb,1e-9),1.0);vec3 c=mix(a,src.rgb,step(1.0,src.rgb));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.SATURATION,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=RGBToHSL(dst.rgb);vec3 b=RGBToHSL(src.rgb);vec3 c=HSLToRGB(vec3(a.x,b.y,a.z));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.SCREEN,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb+src.rgb-min(dst.rgb*src.rgb,1.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.SOFT_LIGHT,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 src2=2.0*src.rgb;vec3 d=dst.rgb+(src2-1.0);vec3 w=step(0.5,src.rgb);vec3 a=dst.rgb-(1.0-src2)*dst.rgb*(1.0-dst.rgb);vec3 b=mix(d*(sqrt(dst.rgb)-dst.rgb),d*dst.rgb*((16.0*dst.rgb-12.0)*dst.rgb+3.0),w*(1.0-step(0.25,dst.rgb)));vec3 c=mix(a,b,w);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.SRC,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){return src;}"],[O.SUBTRACT,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=max(dst.rgb-src.rgb,0.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"],[O.VIVID_LIGHT,"vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=mix(max(1.0-min((1.0-dst.rgb)/(2.0*src.rgb),1.0),0.0),min(dst.rgb/(2.0*(1.0-src.rgb)),1.0),step(0.5,src.rgb));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}"]]),V=class extends E.EventDispatcher{constructor(e,t=1){super(),this._blendFunction=e,this.opacity=new E.Uniform(t)}getOpacity(){return this.opacity.value}setOpacity(e){this.opacity.value=e}get blendFunction(){return this._blendFunction}set blendFunction(e){this._blendFunction=e,this.dispatchEvent({type:"change"})}getBlendFunction(){return this.blendFunction}setBlendFunction(e){this.blendFunction=e}getShaderCode(){return G.get(this.blendFunction)}};E.CanvasTexture;var I=class extends E.EventDispatcher{constructor(e,t,{attributes:i=0,blendFunction:s=O.NORMAL,defines:r=new Map,uniforms:a=new Map,extensions:n=null,vertexShader:o=null}={}){super(),this.name=e,this.renderer=null,this.attributes=i,this.fragmentShader=t,this.vertexShader=o,this.defines=r,this.uniforms=a,this.extensions=n,this.blendMode=new V(s),this.blendMode.addEventListener("change",e=>this.setChanged()),this._inputColorSpace=E.LinearSRGBColorSpace,this._outputColorSpace=E.NoColorSpace}get inputColorSpace(){return this._inputColorSpace}set inputColorSpace(e){this._inputColorSpace=e,this.setChanged()}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e,this.setChanged()}set mainScene(e){}set mainCamera(e){}getName(){return this.name}setRenderer(e){this.renderer=e}getDefines(){return this.defines}getUniforms(){return this.uniforms}getExtensions(){return this.extensions}getBlendMode(){return this.blendMode}getAttributes(){return this.attributes}setAttributes(e){this.attributes=e,this.setChanged()}getFragmentShader(){return this.fragmentShader}setFragmentShader(e){this.fragmentShader=e,this.setChanged()}getVertexShader(){return this.vertexShader}setVertexShader(e){this.vertexShader=e,this.setChanged()}setChanged(){this.dispatchEvent({type:"change"})}setDepthTexture(e,t=E.BasicDepthPacking){}update(e,t,i){}setSize(e,t){}initialize(e,t,i){}dispose(){for(let e of Object.keys(this)){let t=this[e];(t instanceof E.WebGLRenderTarget||t instanceof E.Material||t instanceof E.Texture||t instanceof w)&&this[e].dispose()}}};new Float32Array([0,0]),new Float32Array([0,1,1]),new Float32Array([0,1,1,2]),new Float32Array([0,1,2,2,3]),new Float32Array([0,1,2,3,4,4,5]),new Float32Array([0,1,2,3,4,5,7,8,9,10]),E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial,E.DataTexture;E.ShaderMaterial;var N=class extends w{constructor(e,t,i=null){super("RenderPass",e,t),this.needsSwap=!1,this.needsDepthBlit=!0,this.clearPass=new L,this.overrideMaterialManager=null===i?null:new U(i),this.ignoreBackground=!1,this.skipShadowMapUpdate=!1,this.selection=null}set mainScene(e){this.scene=e}set mainCamera(e){this.camera=e}get renderToScreen(){return super.renderToScreen}set renderToScreen(e){super.renderToScreen=e,this.clearPass.renderToScreen=e}get overrideMaterial(){let e=this.overrideMaterialManager;return null!==e?e.material:null}set overrideMaterial(e){let t=this.overrideMaterialManager;null!==e?null!==t?t.setMaterial(e):this.overrideMaterialManager=new U(e):null!==t&&(t.dispose(),this.overrideMaterialManager=null)}getOverrideMaterial(){return this.overrideMaterial}setOverrideMaterial(e){this.overrideMaterial=e}get clear(){return this.clearPass.enabled}set clear(e){this.clearPass.enabled=e}getSelection(){return this.selection}setSelection(e){this.selection=e}isBackgroundDisabled(){return this.ignoreBackground}setBackgroundDisabled(e){this.ignoreBackground=e}isShadowMapDisabled(){return this.skipShadowMapUpdate}setShadowMapDisabled(e){this.skipShadowMapUpdate=e}getClearPass(){return this.clearPass}render(e,t,i,s,r){let a=this.scene,n=this.camera,o=this.selection,l=n.layers.mask,h=a.background,d=e.shadowMap.autoUpdate,c=this.renderToScreen?null:t;null!==o&&n.layers.set(o.getLayer()),this.skipShadowMapUpdate&&(e.shadowMap.autoUpdate=!1),(this.ignoreBackground||null!==this.clearPass.overrideClearColor)&&(a.background=null),this.clearPass.enabled&&this.clearPass.render(e,t),e.setRenderTarget(c),null!==this.overrideMaterialManager?this.overrideMaterialManager.render(e,a,n):e.render(a,n),n.layers.mask=l,a.background=h,e.shadowMap.autoUpdate=d}};function H(e,t,i){let s=document.createElement("canvas"),r=s.getContext("2d");if(s.width=e,s.height=t,i instanceof Image)r.drawImage(i,0,0);else{let s=r.createImageData(e,t);s.data.set(i),r.putImageData(s,0,0)}return s}var k=class e{constructor(e=0,t=0,i=null){this.width=e,this.height=t,this.data=i}toCanvas(){return"u"<typeof document?null:H(this.width,this.height,this.data)}static from(t){let i,{width:s,height:r}=t;if(t instanceof Image){let e=H(s,r,t);null!==e&&(i=e.getContext("2d").getImageData(0,0,s,r).data)}else i=t.data;return new e(s,r,i)}},W=new E.Color;(class e extends E.Data3DTexture{constructor(e,t){super(e,t,t,t),this.type=E.FloatType,this.format=E.RGBAFormat,this.minFilter=E.LinearFilter,this.magFilter=E.LinearFilter,this.wrapS=E.ClampToEdgeWrapping,this.wrapT=E.ClampToEdgeWrapping,this.wrapR=E.ClampToEdgeWrapping,this.unpackAlignment=1,this.needsUpdate=!0,this.colorSpace=E.LinearSRGBColorSpace,this.domainMin=new E.Vector3(0,0,0),this.domainMax=new E.Vector3(1,1,1)}get isLookupTexture3D(){return!0}scaleUp(t,i=!0){let s=this.image;return t<=s.width?Promise.reject(Error("The target size must be greater than the current size")):new Promise((r,a)=>{let n=URL.createObjectURL(new Blob(['(()=>{var O={SCALE_UP:"lut.scaleup"};var _=[new Float32Array(3),new Float32Array(3)],n=[new Float32Array(3),new Float32Array(3),new Float32Array(3),new Float32Array(3)],Z=[[new Float32Array([0,0,0]),new Float32Array([1,0,0]),new Float32Array([1,1,0]),new Float32Array([1,1,1])],[new Float32Array([0,0,0]),new Float32Array([1,0,0]),new Float32Array([1,0,1]),new Float32Array([1,1,1])],[new Float32Array([0,0,0]),new Float32Array([0,0,1]),new Float32Array([1,0,1]),new Float32Array([1,1,1])],[new Float32Array([0,0,0]),new Float32Array([0,1,0]),new Float32Array([1,1,0]),new Float32Array([1,1,1])],[new Float32Array([0,0,0]),new Float32Array([0,1,0]),new Float32Array([0,1,1]),new Float32Array([1,1,1])],[new Float32Array([0,0,0]),new Float32Array([0,0,1]),new Float32Array([0,1,1]),new Float32Array([1,1,1])]];function d(a,t,r,m){let i=r[0]-t[0],e=r[1]-t[1],y=r[2]-t[2],h=a[0]-t[0],A=a[1]-t[1],w=a[2]-t[2],c=e*w-y*A,l=y*h-i*w,x=i*A-e*h,u=Math.sqrt(c*c+l*l+x*x),b=u*.5,s=c/u,F=l/u,f=x/u,p=-(a[0]*s+a[1]*F+a[2]*f),M=m[0]*s+m[1]*F+m[2]*f;return Math.abs(M+p)*b/3}function V(a,t,r,m,i,e){let y=(r+m*t+i*t*t)*4;e[0]=a[y+0],e[1]=a[y+1],e[2]=a[y+2]}function k(a,t,r,m,i,e){let y=r*(t-1),h=m*(t-1),A=i*(t-1),w=Math.floor(y),c=Math.floor(h),l=Math.floor(A),x=Math.ceil(y),u=Math.ceil(h),b=Math.ceil(A),s=y-w,F=h-c,f=A-l;if(w===y&&c===h&&l===A)V(a,t,y,h,A,e);else{let p;s>=F&&F>=f?p=Z[0]:s>=f&&f>=F?p=Z[1]:f>=s&&s>=F?p=Z[2]:F>=s&&s>=f?p=Z[3]:F>=f&&f>=s?p=Z[4]:f>=F&&F>=s&&(p=Z[5]);let[M,g,X,Y]=p,P=_[0];P[0]=s,P[1]=F,P[2]=f;let o=_[1],L=x-w,S=u-c,U=b-l;o[0]=L*M[0]+w,o[1]=S*M[1]+c,o[2]=U*M[2]+l,V(a,t,o[0],o[1],o[2],n[0]),o[0]=L*g[0]+w,o[1]=S*g[1]+c,o[2]=U*g[2]+l,V(a,t,o[0],o[1],o[2],n[1]),o[0]=L*X[0]+w,o[1]=S*X[1]+c,o[2]=U*X[2]+l,V(a,t,o[0],o[1],o[2],n[2]),o[0]=L*Y[0]+w,o[1]=S*Y[1]+c,o[2]=U*Y[2]+l,V(a,t,o[0],o[1],o[2],n[3]);let T=d(g,X,Y,P)*6,q=d(M,X,Y,P)*6,C=d(M,g,Y,P)*6,E=d(M,g,X,P)*6;n[0][0]*=T,n[0][1]*=T,n[0][2]*=T,n[1][0]*=q,n[1][1]*=q,n[1][2]*=q,n[2][0]*=C,n[2][1]*=C,n[2][2]*=C,n[3][0]*=E,n[3][1]*=E,n[3][2]*=E,e[0]=n[0][0]+n[1][0]+n[2][0]+n[3][0],e[1]=n[0][1]+n[1][1]+n[2][1]+n[3][1],e[2]=n[0][2]+n[1][2]+n[2][2]+n[3][2]}}var v=class{static expand(t,r){let m=Math.cbrt(t.length/4),i=new Float32Array(3),e=new t.constructor(r**3*4),y=t instanceof Uint8Array?255:1,h=r**2,A=1/(r-1);for(let w=0;w<r;++w)for(let c=0;c<r;++c)for(let l=0;l<r;++l){let x=l*A,u=c*A,b=w*A,s=Math.round(l+c*r+w*h)*4;k(t,m,x,u,b,i),e[s+0]=i[0],e[s+1]=i[1],e[s+2]=i[2],e[s+3]=y}return e}};self.addEventListener("message",a=>{let t=a.data,r=t.data;t.operation===O.SCALE_UP&&(r=v.expand(r,t.size)),postMessage(r,[r.buffer]),close()});})();\n'],{type:"text/javascript"})),o=new Worker(n);o.addEventListener("error",e=>a(e.error)),o.addEventListener("message",i=>{let s=new e(i.data,t);this.colorSpace=s.colorSpace,s.type=this.type,s.name=this.name,URL.revokeObjectURL(n),r(s)});let l=i?[s.data.buffer]:[];o.postMessage({operation:"lut.scaleup",data:s.data,size:t},l)})}applyLUT(e){let t=this.image,i=e.image,s=Math.min(t.width,t.height,t.depth);if(s!==Math.min(i.width,i.height,i.depth))console.error("Size mismatch");else if(e.type!==E.FloatType||this.type!==E.FloatType)console.error("Both LUTs must be FloatType textures");else if(e.format!==E.RGBAFormat||this.format!==E.RGBAFormat)console.error("Both LUTs must be RGBA textures");else{let e=t.data,r=i.data,a=s**2,n=s-1;for(let t=0,i=s**3;t<i;++t){let i=4*t,o=4*Math.round(e[i+0]*n+e[i+1]*n*s+e[i+2]*n*a);e[i+0]=r[o+0],e[i+1]=r[o+1],e[i+2]=r[o+2]}this.needsUpdate=!0}return this}convertToUint8(){if(this.type===E.FloatType){let e=this.image.data,t=new Uint8Array(e.length);for(let i=0,s=e.length;i<s;++i)t[i]=255*e[i]+.5;this.image.data=t,this.type=E.UnsignedByteType,this.needsUpdate=!0}return this}convertToFloat(){if(this.type===E.UnsignedByteType){let e=this.image.data,t=new Float32Array(e.length);for(let i=0,s=e.length;i<s;++i)t[i]=e[i]/255;this.image.data=t,this.type=E.FloatType,this.needsUpdate=!0}return this}convertToRGBA(){return console.warn("LookupTexture","convertToRGBA() is deprecated, LUTs are now RGBA by default"),this}convertLinearToSRGB(){let e=this.image.data;if(this.type===E.FloatType){for(let t=0,i=e.length;t<i;t+=4)W.fromArray(e,t).convertLinearToSRGB().toArray(e,t);this.colorSpace=E.SRGBColorSpace,this.needsUpdate=!0}else console.error("Color space conversion requires FloatType data");return this}convertSRGBToLinear(){let e=this.image.data;if(this.type===E.FloatType){for(let t=0,i=e.length;t<i;t+=4)W.fromArray(e,t).convertSRGBToLinear().toArray(e,t);this.colorSpace=E.LinearSRGBColorSpace,this.needsUpdate=!0}else console.error("Color space conversion requires FloatType data");return this}toDataTexture(){let e=this.image.width,t=this.image.height*this.image.depth,i=new E.DataTexture(this.image.data,e,t);return i.name=this.name,i.type=this.type,i.format=this.format,i.minFilter=E.LinearFilter,i.magFilter=E.LinearFilter,i.wrapS=this.wrapS,i.wrapT=this.wrapT,i.generateMipmaps=!1,i.needsUpdate=!0,this.colorSpace=i.colorSpace,i}static from(t){let i,s=t.image,{width:r,height:a}=s,n=Math.min(r,a);if(s instanceof Image){let e=k.from(s).data;if(r>a){i=new Uint8Array(e.length);for(let t=0;t<n;++t)for(let s=0;s<n;++s)for(let r=0;r<n;++r){let a=(r+t*n+s*n*n)*4,o=(r+s*n+t*n*n)*4;i[o+0]=e[a+0],i[o+1]=e[a+1],i[o+2]=e[a+2],i[o+3]=e[a+3]}}else i=new Uint8Array(e.buffer)}else i=s.data.slice();let o=new e(i,n);return o.type=t.type,o.name=t.name,t.colorSpace=o.colorSpace,o}static createNeutral(t){let i=new Float32Array(t**3*4),s=t**2,r=1/(t-1);for(let e=0;e<t;++e)for(let a=0;a<t;++a)for(let n=0;n<t;++n){let o=(e+a*t+n*s)*4;i[o+0]=e*r,i[o+1]=a*r,i[o+2]=n*r,i[o+3]=1}let a=new e(i,t);return a.name="neutral",a}}),E.ShaderMaterial,E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial;E.ShaderMaterial,E.Loader,E.Loader,E.Loader;E.ShaderMaterial;E.ShaderMaterial;var z=`#include <common>
#include <packing>
#include <dithering_pars_fragment>
#define packFloatToRGBA(v) packDepthToRGBA(v)
#define unpackRGBAToFloat(v) unpackRGBAToDepth(v)
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
#if DEPTH_PACKING == 3201
uniform lowp sampler2D depthBuffer;
#elif defined(GL_FRAGMENT_PRECISION_HIGH)
uniform highp sampler2D depthBuffer;
#else
uniform mediump sampler2D depthBuffer;
#endif
uniform vec2 resolution;uniform vec2 texelSize;uniform float cameraNear;uniform float cameraFar;uniform float aspect;uniform float time;varying vec2 vUv;vec4 sRGBToLinear(const in vec4 value){return vec4(mix(pow(value.rgb*0.9478672986+vec3(0.0521327014),vec3(2.4)),value.rgb*0.0773993808,vec3(lessThanEqual(value.rgb,vec3(0.04045)))),value.a);}float readDepth(const in vec2 uv){
#if DEPTH_PACKING == 3201
float depth=unpackRGBAToDepth(texture2D(depthBuffer,uv));
#else
float depth=texture2D(depthBuffer,uv).r;
#endif
#if defined(USE_LOGARITHMIC_DEPTH_BUFFER) || defined(LOG_DEPTH)
float d=pow(2.0,depth*log2(cameraFar+1.0))-1.0;float a=cameraFar/(cameraFar-cameraNear);float b=cameraFar*cameraNear/(cameraNear-cameraFar);depth=a+b/d;
#elif defined(USE_REVERSED_DEPTH_BUFFER)
depth=1.0-depth;
#endif
return depth;}float getViewZ(const in float depth){
#ifdef PERSPECTIVE_CAMERA
return perspectiveDepthToViewZ(depth,cameraNear,cameraFar);
#else
return orthographicDepthToViewZ(depth,cameraNear,cameraFar);
#endif
}vec3 RGBToHCV(const in vec3 RGB){vec4 P=mix(vec4(RGB.bg,-1.0,2.0/3.0),vec4(RGB.gb,0.0,-1.0/3.0),step(RGB.b,RGB.g));vec4 Q=mix(vec4(P.xyw,RGB.r),vec4(RGB.r,P.yzx),step(P.x,RGB.r));float C=Q.x-min(Q.w,Q.y);float H=abs((Q.w-Q.y)/(6.0*C+EPSILON)+Q.z);return vec3(H,C,Q.x);}vec3 RGBToHSL(const in vec3 RGB){vec3 HCV=RGBToHCV(RGB);float L=HCV.z-HCV.y*0.5;float S=HCV.y/(1.0-abs(L*2.0-1.0)+EPSILON);return vec3(HCV.x,S,L);}vec3 HueToRGB(const in float H){float R=abs(H*6.0-3.0)-1.0;float G=2.0-abs(H*6.0-2.0);float B=2.0-abs(H*6.0-4.0);return clamp(vec3(R,G,B),0.0,1.0);}vec3 HSLToRGB(const in vec3 HSL){vec3 RGB=HueToRGB(HSL.x);float C=(1.0-abs(2.0*HSL.z-1.0))*HSL.y;return(RGB-0.5)*C+HSL.z;}FRAGMENT_HEAD void main(){FRAGMENT_MAIN_UV vec4 color0=texture2D(inputBuffer,UV);vec4 color1=vec4(0.0);FRAGMENT_MAIN_IMAGE color0.a=clamp(color0.a,0.0,1.0);gl_FragColor=color0;
#ifdef ENCODE_OUTPUT
#include <colorspace_fragment>
#endif
#include <dithering_fragment>
}`,j=class extends E.ShaderMaterial{constructor(e,t,i,s,r=!1){super({name:"EffectMaterial",defines:{THREE_REVISION:E.REVISION.replace(/\D+/g,""),DEPTH_PACKING:"0",ENCODE_OUTPUT:"1"},uniforms:{inputBuffer:new E.Uniform(null),depthBuffer:new E.Uniform(null),resolution:new E.Uniform(new E.Vector2),texelSize:new E.Uniform(new E.Vector2),cameraNear:new E.Uniform(.3),cameraFar:new E.Uniform(1e3),aspect:new E.Uniform(1),time:new E.Uniform(0)},blending:E.NoBlending,toneMapped:!1,depthWrite:!1,depthTest:!1,dithering:r}),e&&this.setShaderParts(e),t&&this.setDefines(t),i&&this.setUniforms(i),this.copyCameraSettings(s)}set inputBuffer(e){this.uniforms.inputBuffer.value=e}setInputBuffer(e){this.uniforms.inputBuffer.value=e}get depthBuffer(){return this.uniforms.depthBuffer.value}set depthBuffer(e){this.uniforms.depthBuffer.value=e}get depthPacking(){return Number(this.defines.DEPTH_PACKING)}set depthPacking(e){this.defines.DEPTH_PACKING=e.toFixed(0),this.needsUpdate=!0}setDepthBuffer(e,t=E.BasicDepthPacking){this.depthBuffer=e,this.depthPacking=t}setShaderData(e){this.setShaderParts(e.shaderParts),this.setDefines(e.defines),this.setUniforms(e.uniforms),this.setExtensions(e.extensions)}setShaderParts(e){return this.fragmentShader=z.replace(_.FRAGMENT_HEAD,e.get(_.FRAGMENT_HEAD)||"").replace(_.FRAGMENT_MAIN_UV,e.get(_.FRAGMENT_MAIN_UV)||"").replace(_.FRAGMENT_MAIN_IMAGE,e.get(_.FRAGMENT_MAIN_IMAGE)||""),this.vertexShader="uniform vec2 resolution;uniform vec2 texelSize;uniform float cameraNear;uniform float cameraFar;uniform float aspect;uniform float time;varying vec2 vUv;VERTEX_HEAD void main(){vUv=position.xy*0.5+0.5;VERTEX_MAIN_SUPPORT gl_Position=vec4(position.xy,1.0,1.0);}".replace(_.VERTEX_HEAD,e.get(_.VERTEX_HEAD)||"").replace(_.VERTEX_MAIN_SUPPORT,e.get(_.VERTEX_MAIN_SUPPORT)||""),this.needsUpdate=!0,this}setDefines(e){for(let t of e.entries())this.defines[t[0]]=t[1];return this.needsUpdate=!0,this}setUniforms(e){for(let t of e.entries())this.uniforms[t[0]]=t[1];return this}setExtensions(e){for(let t of(this.extensions={},e))this.extensions[t]=!0;return this}get encodeOutput(){return void 0!==this.defines.ENCODE_OUTPUT}set encodeOutput(e){this.encodeOutput!==e&&(e?this.defines.ENCODE_OUTPUT="1":delete this.defines.ENCODE_OUTPUT,this.needsUpdate=!0)}isOutputEncodingEnabled(e){return this.encodeOutput}setOutputEncodingEnabled(e){this.encodeOutput=e}get time(){return this.uniforms.time.value}set time(e){this.uniforms.time.value=e}setDeltaTime(e){this.uniforms.time.value+=e}adoptCameraSettings(e){this.copyCameraSettings(e)}copyCameraSettings(e){e&&(this.uniforms.cameraNear.value=e.near,this.uniforms.cameraFar.value=e.far,e instanceof E.PerspectiveCamera?this.defines.PERSPECTIVE_CAMERA="1":delete this.defines.PERSPECTIVE_CAMERA,this.needsUpdate=!0)}setSize(e,t){let i=this.uniforms;i.resolution.value.set(e,t),i.texelSize.value.set(1/e,1/t),i.aspect.value=e/t}static get Section(){return _}};E.ShaderMaterial,E.REVISION.replace(/\D+/g,"");var K=255/256;function X(e,t,i){for(let s of t){let t="$1"+e+s.charAt(0).toUpperCase()+s.slice(1),r=RegExp("([^\\.])(\\b"+s+"\\b)","g");for(let e of i.entries())null!==e[1]&&i.set(e[0],e[1].replace(r,t))}}new Float32Array([255/256/0x1000000,255/256/65536,255/256/256,255/256]),new Float32Array([K,K/256,K/65536,1/0x1000000]);var $=class extends w{constructor(e,...t){super("EffectPass"),this.fullscreenMaterial=new j(null,null,null,e),this.listener=e=>this.handleEvent(e),this.effects=[],this.setEffects(t),this.skipRendering=!1,this.minTime=1,this.maxTime=1/0,this.timeScale=1}set mainScene(e){for(let t of this.effects)t.mainScene=e}set mainCamera(e){for(let t of(this.fullscreenMaterial.copyCameraSettings(e),this.effects))t.mainCamera=e}get encodeOutput(){return this.fullscreenMaterial.encodeOutput}set encodeOutput(e){this.fullscreenMaterial.encodeOutput=e}get dithering(){return this.fullscreenMaterial.dithering}set dithering(e){let t=this.fullscreenMaterial;t.dithering=e,t.needsUpdate=!0}setEffects(e){for(let e of this.effects)e.removeEventListener("change",this.listener);for(let t of(this.effects=e.sort((e,t)=>t.attributes-e.attributes),this.effects))t.addEventListener("change",this.listener)}updateMaterial(){let e=new B,t=0;for(let i of this.effects)if(i.blendMode.blendFunction===O.DST)e.attributes|=1&i.getAttributes();else if((e.attributes&i.getAttributes()&2)!=0)throw Error(`Convolution effects cannot be merged (${i.name})`);else!function(e,t,i){let s=t.getFragmentShader(),r=t.getVertexShader(),a=void 0!==s&&/mainImage/.test(s),n=void 0!==s&&/mainUv/.test(s);if(i.attributes|=t.getAttributes(),void 0===s)throw Error(`Missing fragment shader (${t.name})`);if(n&&(2&i.attributes)!=0)throw Error(`Effects that transform UVs are incompatible with convolution effects (${t.name})`);if(a||n){let o=/\w+\s+(\w+)\([\w\s,]*\)\s*{/g,l=i.shaderParts,h=l.get(_.FRAGMENT_HEAD)||"",d=l.get(_.FRAGMENT_MAIN_UV)||"",c=l.get(_.FRAGMENT_MAIN_IMAGE)||"",u=l.get(_.VERTEX_HEAD)||"",f=l.get(_.VERTEX_MAIN_SUPPORT)||"",p=new Set,v=new Set;if(n&&(d+=`	${e}MainUv(UV);
`,i.uvTransformation=!0),null!==r&&/mainSupport/.test(r)){let t=/mainSupport *\([\w\s]*?uv\s*?\)/.test(r);for(let s of(f+=`	${e}MainSupport(`,f+=t?"vUv);\n":");\n",r.matchAll(/(?:varying\s+\w+\s+([\S\s]*?);)/g)))for(let e of s[1].split(/\s*,\s*/))i.varyings.add(e),p.add(e),v.add(e);for(let e of r.matchAll(o))v.add(e[1])}for(let e of s.matchAll(o))v.add(e[1]);for(let e of t.defines.keys())v.add(e.replace(/\([\w\s,]*\)/g,""));for(let e of t.uniforms.keys())v.add(e);v.delete("while"),v.delete("for"),v.delete("if"),t.uniforms.forEach((t,s)=>i.uniforms.set(e+s.charAt(0).toUpperCase()+s.slice(1),t)),t.defines.forEach((t,s)=>i.defines.set(e+s.charAt(0).toUpperCase()+s.slice(1),t));let g=new Map([["fragment",s],["vertex",r]]);X(e,v,i.defines),X(e,v,g),s=g.get("fragment"),r=g.get("vertex");let m=t.blendMode;if(i.blendModes.set(m.blendFunction,m),a){null!==t.inputColorSpace&&t.inputColorSpace!==i.colorSpace&&(c+=t.inputColorSpace===E.SRGBColorSpace?"color0 = sRGBTransferOETF(color0);\n	":"color0 = sRGBToLinear(color0);\n	"),t.outputColorSpace!==E.NoColorSpace?i.colorSpace=t.outputColorSpace:null!==t.inputColorSpace&&(i.colorSpace=t.inputColorSpace),c+=`${e}MainImage(color0, UV, `,(1&i.attributes)!=0&&/MainImage *\([\w\s,]*?depth[\w\s,]*?\)/.test(s)&&(c+="depth, ",i.readDepth=!0),c+="color1);\n	";let r=e+"BlendOpacity";i.uniforms.set(r,m.opacity),c+=`color0 = blend${m.blendFunction}(color0, color1, ${r});

	`,h+=`uniform float ${r};

`}if(h+=s+"\n",null!==r&&(u+=r+"\n"),l.set(_.FRAGMENT_HEAD,h),l.set(_.FRAGMENT_MAIN_UV,d),l.set(_.FRAGMENT_MAIN_IMAGE,c),l.set(_.VERTEX_HEAD,u),l.set(_.VERTEX_MAIN_SUPPORT,f),null!==t.extensions)for(let e of t.extensions)i.extensions.add(e)}else throw Error(`Could not find mainImage or mainUv function (${t.name})`)}("e"+t++,i,e);let i=e.shaderParts.get(_.FRAGMENT_HEAD),s=e.shaderParts.get(_.FRAGMENT_MAIN_IMAGE),r=e.shaderParts.get(_.FRAGMENT_MAIN_UV),a=/\bblend\b/g;for(let t of e.blendModes.values())i+=t.getShaderCode().replace(a,`blend${t.blendFunction}`)+"\n";for(let[t,a]of((1&e.attributes)!=0?(e.readDepth&&(s="float depth = readDepth(UV);\n\n	"+s),this.needsDepthTexture=null===this.getDepthTexture()):this.needsDepthTexture=!1,e.colorSpace===E.SRGBColorSpace&&(s+="color0 = sRGBToLinear(color0);\n	"),e.uvTransformation?(r="vec2 transformedUv = vUv;\n"+r,e.defines.set("UV","transformedUv")):e.defines.set("UV","vUv"),e.shaderParts.set(_.FRAGMENT_HEAD,i),e.shaderParts.set(_.FRAGMENT_MAIN_IMAGE,s),e.shaderParts.set(_.FRAGMENT_MAIN_UV,r),e.shaderParts))null!==a&&e.shaderParts.set(t,a.trim().replace(/^#/,"\n#"));this.skipRendering=0===t,this.needsSwap=!this.skipRendering,this.fullscreenMaterial.setShaderData(e)}recompile(){this.updateMaterial()}getDepthTexture(){return this.fullscreenMaterial.depthBuffer}setDepthTexture(e,t=E.BasicDepthPacking){for(let i of(this.fullscreenMaterial.depthBuffer=e,this.fullscreenMaterial.depthPacking=t,this.effects))i.setDepthTexture(e,t)}render(e,t,i,s,r){for(let i of this.effects)i.update(e,t,s);if(!this.skipRendering||this.renderToScreen){let r=this.fullscreenMaterial;r.inputBuffer=t.texture,r.time+=s*this.timeScale,e.setRenderTarget(this.renderToScreen?null:i),e.render(this.scene,this.camera)}}setSize(e,t){for(let i of(this.fullscreenMaterial.setSize(e,t),this.effects))i.setSize(e,t)}initialize(e,t,i){for(let s of(this.renderer=e,this.effects))s.initialize(e,t,i);this.updateMaterial(),void 0!==i&&i!==E.UnsignedByteType&&(this.fullscreenMaterial.defines.FRAMEBUFFER_PRECISION_HIGH="1")}dispose(){for(let e of(super.dispose(),this.effects))e.removeEventListener("change",this.listener),e.dispose()}handleEvent(e){"change"===e.type&&this.recompile()}};function q(e,t,i,s){var r;return(r=e+(t-e)*.75)+(i+(s-i)*.75-r)*.875}new Float32Array(3),new Float32Array(3),new Float32Array(3),new Float32Array(3),new Float32Array(3),new Float32Array(3),new Float32Array([0,0,0]),new Float32Array([1,0,0]),new Float32Array([1,1,0]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([1,0,0]),new Float32Array([1,0,1]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([0,0,1]),new Float32Array([1,0,1]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([0,1,0]),new Float32Array([1,1,0]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([0,1,0]),new Float32Array([0,1,1]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([0,0,1]),new Float32Array([0,1,1]),new Float32Array([1,1,1]),new Float32Array(2),new Float32Array(2),new Float32Array([0,-.25,.25,-.125,.125,-.375,.375]),new Float32Array([0,0]),new Float32Array([.25,-.25]),new Float32Array([-.25,.25]),new Float32Array([.125,-.125]),new Float32Array([-.125,.125]),new Uint8Array([0,0]),new Uint8Array([3,0]),new Uint8Array([0,3]),new Uint8Array([3,3]),new Uint8Array([1,0]),new Uint8Array([4,0]),new Uint8Array([1,3]),new Uint8Array([4,3]),new Uint8Array([0,1]),new Uint8Array([3,1]),new Uint8Array([0,4]),new Uint8Array([3,4]),new Uint8Array([1,1]),new Uint8Array([4,1]),new Uint8Array([1,4]),new Uint8Array([4,4]),new Uint8Array([0,0]),new Uint8Array([1,0]),new Uint8Array([0,2]),new Uint8Array([1,2]),new Uint8Array([2,0]),new Uint8Array([3,0]),new Uint8Array([2,2]),new Uint8Array([3,2]),new Uint8Array([0,1]),new Uint8Array([1,1]),new Uint8Array([0,3]),new Uint8Array([1,3]),new Uint8Array([2,1]),new Uint8Array([3,1]),new Uint8Array([2,3]),new Uint8Array([3,3]),q(0,0,0,0),new Float32Array([0,0,0,0]),q(0,0,0,1),new Float32Array([0,0,0,1]),q(0,0,1,0),new Float32Array([0,0,1,0]),q(0,0,1,1),new Float32Array([0,0,1,1]),q(0,1,0,0),new Float32Array([0,1,0,0]),q(0,1,0,1),new Float32Array([0,1,0,1]),q(0,1,1,0),new Float32Array([0,1,1,0]),q(0,1,1,1),new Float32Array([0,1,1,1]),q(1,0,0,0),new Float32Array([1,0,0,0]),q(1,0,0,1),new Float32Array([1,0,0,1]),q(1,0,1,0),new Float32Array([1,0,1,0]),q(1,0,1,1),new Float32Array([1,0,1,1]),q(1,1,0,0),new Float32Array([1,1,0,0]),q(1,1,0,1),new Float32Array([1,1,0,1]),q(1,1,1,0),new Float32Array([1,1,1,0]),q(1,1,1,1),new Float32Array([1,1,1,1]);let Y=p(l);class Z extends I{constructor(){super("EffectBarrel",Y.frag,{blendFunction:O.Normal,uniforms:new Map([["uScreenRes",new b.Uniform(new b.Vector2(1,1))],["uDistortionK1",new b.Uniform(0)],["uDistortionK2",new b.Uniform(0)],["uDistortionCylindricalFactor",new b.Uniform(.7)]])})}get screenRes(){return this.uniforms.get("uScreenRes").value}set screenRes(e){this.uniforms.get("uScreenRes").value=e}get distortionK1(){return this.uniforms.get("uDistortionK1").value}set distortionK1(e){this.uniforms.get("uDistortionK1").value=e}get distortionK2(){return this.uniforms.get("uDistortionK2").value}set distortionK2(e){this.uniforms.get("uDistortionK2").value=e}get distortionCylindricalFactor(){return this.uniforms.get("uDistortionCylindricalFactor").value}set distortionCylindricalFactor(e){this.uniforms.get("uDistortionCylindricalFactor").value=e}}var Q=e.i(24795);class J{constructor({manager:e,isDesktop:t}){this.manager=e,this.canvas=e.canvas,this.renderer=e.renderer,this.gl=e.renderer.gl,this.name="Scene Base",this.isDestroyed=!1,this.isActive=!1,this.hasLoaded=!1,this.hasEventListeners=!1,this.shouldTriggerLoadEvents=!0,this.isDesktop=t,this.sceneVars={isDesktop:this.isDesktop,width:0,height:0,vWidth:0,vHeight:0,aspectRatio:0,cu:0,documentHeight:0},this.entities=[],this.textures={},this.scene=new b.Scene}enable(){this.isActive=!0,this.hasEventListeners&&this.removeEventListeners(),this.addEventListeners(),this.hasEventListeners=!0,this.handleResize()}disable(){this.isActive=!1,this.removeEventListeners(),this.hasEventListeners=!1}destroy(){this.disable(),this.isDestroyed=!0,this.entities=[],this.textures=[],this.entities.forEach(e=>{e&&e.destroy&&e.destroy()})}reset(){}manageLoadPromises(e,t={start:n.EVENTS.WEBGL_LOAD_START,progress:n.EVENTS.WEBGL_LOAD_PROGRESS,complete:n.EVENTS.WEBGL_LOAD_COMPLETE},i=()=>{}){this.shouldTriggerLoadEvents&&Q.default.trigger(t.start);let s=Promise.all(e).then(()=>{this.shouldTriggerLoadEvents&&Q.default.trigger(t.complete),i()}),r=0;return e.forEach(i=>{i.then(()=>{let i=(r+=1)/e.length;this.shouldTriggerLoadEvents&&Q.default.trigger(t.progress,{progress:i})})}),s}load(){let e=[];return this.hasLoaded?(this.shouldTriggerLoadEvents&&(Q.default.trigger(n.EVENTS.WEBGL_LOAD_PROGRESS,{progress:1}),Q.default.trigger(n.EVENTS.WEBGL_LOAD_COMPLETE)),e):(e=[...e=[...e=[...e,...this.loadTextures()],...this.loadModels()],...this.loadAudio()],this.manageLoadPromises(e,{start:n.EVENTS.WEBGL_LOAD_START,progress:n.EVENTS.WEBGL_LOAD_PROGRESS,complete:n.EVENTS.WEBGL_LOAD_COMPLETE},this.handleAssetsLoad.bind(this)))}loadTextures(){return[]}loadModels(){return[]}loadAudio(){return[]}addEventListeners(){}removeEventListeners(){this.entities.forEach(e=>{e.removeEventListeners&&e.removeEventListeners()})}handleResize(){this.updateSceneVarsDom(),this.camera&&(this.camera.aspect=this.sceneVars.aspectRatio,this.camera.updateProjectionMatrix()),this.debugCamera&&(this.debugCamera.aspect=this.sceneVars.aspectRatio,this.debugCamera.updateProjectionMatrix()),this.updateSceneVarsFov(),this.entities.forEach(e=>{e.handleResize&&e.handleResize(this.sceneVars)})}handleAssetsLoad(){this.isDestroyed||(this.hasLoaded=!0,this.entities.forEach(e=>{e.handleAssetsLoad&&e.handleAssetsLoad()}),this.handleAfterLoad())}handleAfterLoad(){}handleVisibilityChange(e){}updateSceneVarsDom(){let e=this.canvas.parentNode;this.sceneVars.width=e.offsetWidth,this.sceneVars.height=e.offsetHeight,this.sceneVars.aspectRatio=this.sceneVars.width/this.sceneVars.height,this.sceneVars.documentHeight=document.body.offsetHeight,this.sceneVars.pixelRatio=this.manager.pixelRatio}updateSceneVarsFov(){if(this.camera){let e=2*Math.tan(this.camera.fov*(Math.PI/180)/2)*this.camera.position.z,t=e*this.camera.aspect;this.sceneVars.vHeight=e,this.sceneVars.vWidth=t}}update(){}}let ee={commons:{},noises:{},envs:{},placeholders:{}},et=(e,t=!1)=>{e&&(e.progress(1,t),e.kill())},ei=/Macintosh|Windows NT|X11/,es=/Xbox|PlayStation|Nintendo|SMART-TV|Android|iPhone|iPad|iPod/,er=new class{constructor(){this.isDesktop=(e=>!!e&&ei.test(e)&&!es.test(e))(navigator.userAgent)}},ea=new b.TextureLoader,en=e=>{let t=()=>{},i=new Promise(e=>{t=e}),s=ea.load(e.src,t);return s.colorSpace=b.SRGBColorSpace,s.loaded=i,s.generateMipmaps=!1,e.options&&(e.options.includes("repeat")&&(s.wrapS=b.RepeatWrapping,s.wrapT=b.RepeatWrapping),e.options.includes("clamp")&&(s.wrapS=b.ClampToEdgeWrapping,s.wrapT=b.ClampToEdgeWrapping),e.options.includes("flipY")?s.flipY=!0:s.flipY=!1,e.options.includes("nomipmaps")&&(s.generateMipmaps=!1),e.options.includes("nearestFilter")&&(s.magFilter=b.NearestFilter,s.minFilter=b.NearestFilter)),s};class eo extends J{constructor(e){super(e),this.name="Scene Background",this.currentCamera=null,this.entities=[],this.textures={},this.init()}reset(){super.reset(),this.setInitialState()}init(){this.root=new b.Group,this.scene.add(this.root),this.setInitialState(),this.initConfig(),this.initCamera(),this.initLights(),this.initPost()}initConfig(){this.config={ditherSize:{value:32,params:{min:8,max:64,step:8}},ditherBrightness:{value:0,params:{min:-1,max:1,step:.01}},ditherContrast:{value:1.1,params:{min:0,max:2,step:.01}},ditherColorBackground:{value:n.COLORS.darkGrey},ditherColorForeground:{value:n.COLORS.lightGrey},maskDitherFactor:{value:1,params:{min:0,max:1,step:.01}},maskColorsFactor:{value:1,params:{min:0,max:1,step:.01}}}}setInitialState(){}initCamera(){this.camera=new b.PerspectiveCamera(45,this.sceneVars.aspectRatio,.1,1e3),this.camera.position.set(0,0,5),this.camera.lookAt(0,0,0),this.currentCamera=this.camera}initLights(){}initEntities(){this.background=new S({scene:this,parent:this.root,config:{color:n.COLORS.black}}),this.entities=[...this.entities,this.background]}initPost(){let e=this.renderer.getContext(),t=e.getParameter(e.MAX_SAMPLES);this.composer=new F(this.renderer,{frameBufferType:b.HalfFloatType,multisampling:er.isDesktop?Math.min(2,t):0}),this.composer.setSize(this.sceneVars.width,this.sceneVars.height),this.passRender=new N(this.scene,this.currentCamera),this.composer.addPass(this.passRender),this.effectDither=new Z,this.passDither=new $(this.currentCamera,this.effectDither),this.composer.addPass(this.passDither)}initDebug(){f.addScene(this.name,!0),f.addSceneGlobal({name:"Post",config:this.config,scene:this.name,expanded:!0}),this.entities.forEach(e=>{e.initDebug&&e.initDebug()})}setupPostEffects(){this.effectDither.texNoise=this.textures.noise_blue_1,this.effectDither.texDither=this.textures.dithering_bayer_8,this.updatePostEffectsUniforms()}updatePostEffectsUniforms(){this.effectDither.ditherSize=this.config.ditherSize.value,this.effectDither.ditherBrightness=this.config.ditherBrightness.value,this.effectDither.ditherContrast=this.config.ditherContrast.value,this.effectDither.ditherColorBackground=this.config.ditherColorBackground.value,this.effectDither.ditherColorForeground=this.config.ditherColorForeground.value,this.effectDither.maskDitherFactor=this.config.maskDitherFactor.value,this.effectDither.maskColorsFactor=this.config.maskColorsFactor.value}loadTextures(){let e=[],t=t=>{for(let i in ee[t]){let s=en(ee[t][i]);this.textures[i]=s,e.push(s.loaded)}};return t("placeholders"),t("noises"),t("dithering"),e}show(e={onStart:()=>{},onComplete:()=>{}}){let t=()=>{this.setInitialState(),this.enable(),e.onStart&&e.onStart()};return this.animateShow({onStart:t,onComplete:e.onComplete})}hide(e={onStart:()=>{},onComplete:()=>{}}){let t=()=>{this.disable(),e.onComplete&&e.onComplete()};return this.animateHide({onStart:e.onStart,onComplete:t})}animateShow({onStart:e,onComplete:t}={}){return et(this.tlShow),this.tlShow=o.default.timeline({onStart:e,onComplete:t}),e?.(),t?.(),this.tlShow}animateHide({onStart:e,onComplete:t}={}){return et(this.tlHide),this.tlHide=o.default.timeline({onStart:e,onComplete:t}),et(this.tlHide),e?.(),t?.(),this.tlHide}addEventListeners(){this.offMouseDown=Q.default.on(n.EVENTS.MOUSE_DOWN,this.handleMouseDown.bind(this)),this.offMouseUp=Q.default.on(n.EVENTS.MOUSE_UP,this.handleMouseUp.bind(this))}removeEventListeners(){this.offMouseDown(),this.offMouseUp()}handleAfterLoad(){this.initEntities(),this.composer&&this.setupPostEffects(),f.isActive&&this.initDebug()}handleResize(){super.handleResize(),this.composer&&(this.composer.setSize(this.sceneVars.width,this.sceneVars.height),this.effectDither.screenRes=new b.Vector2(this.sceneVars.width*this.sceneVars.pixelRatio,this.sceneVars.height*this.sceneVars.pixelRatio))}handleMouseDown(){this.entities.forEach(e=>{e&&e.handleMouseDown&&e.handleMouseDown()})}handleMouseUp(){this.entities.forEach(e=>{e&&e.handleMouseUp&&e.handleMouseUp()})}handleRouteChange(e){switch(e){case"/about":this.config.ditherColorBackground.value=n.COLORS.babyPink,this.config.ditherColorForeground.value=n.COLORS.bourbon;break;case"/projects/[slug]":this.config.ditherColorBackground.value=n.COLORS.black,this.config.ditherColorForeground.value=n.COLORS.lightGrey;break;default:this.config.ditherColorBackground.value=n.COLORS.darkGrey,this.config.ditherColorForeground.value=n.COLORS.lightGrey}}update(e,t){this.isActive&&(this.entities.forEach(i=>{i&&i.update(e,t)}),this.composer?(this.updatePostEffectsUniforms(),this.composer.render()):this.renderer.render(this.scene,this.currentCamera))}}class el{constructor({name:e,scene:t,parent:i,config:s,data:r,cardScale:a=1}){this.name=e||"ModelsCard",this.scene=t,this.parent=i||t.root,this.sceneVars=t.sceneVars,this.data=r,this.cardScale=a,this.isActive=!1,this.setInitialState(),this.createConfig(s),this.createMesh()}enable(){this.isActive=!0,this.addEventListeners(),this.mesh.visible=!0}disable(){this.isActive=!1,this.removeEventListeners(),this.mesh.visible=!1}reset(){this.setInitialState()}destroy(){this.disable(),et(this.tlShow),this.mesh.geometry.dispose(),this.material.dispose(),this.mesh.parent?.remove(this.mesh),this.mesh=null,this.material=null}initDebug(){f.isActive&&f.addEntity({name:this.name,config:this.config,scene:this.scene.name})}setInitialState(){this.animPosition=new b.Vector3,this.animRotation=new b.Vector3,this.animScale=new b.Vector3(1,1,1)}createConfig(e){if(this.config={},e)for(let[t,i]of Object.entries(e))void 0!==this.config[t]&&(this.config[t].value=i)}createMesh(){let e=(er.isDesktop?1.1:.9)*this.cardScale,t=e/this.data.aspectRatio,i=new b.PlaneGeometry(e,t),s=p(c);this.material=new b.ShaderMaterial({vertexShader:s.vert,fragmentShader:s.frag,uniforms:{tMap:{value:this.scene.textures[`card_${this.data.id}`]},uAlpha:{value:1}},depthTest:!0,depthWrite:!0,transparent:!0}),this.mesh=new b.Mesh(i,this.material),this.parent.add(this.mesh),this.disable()}show({isImmediate:e=!1}={}){return this.enable(),this.animateShow({isImmediate:e})}animateShow({isImmediate:e=!1}={}){return et(this.tlShow),this.tlShow=o.default.timeline({}),this.tlShow.fromTo(this.animPosition,{y:er.isDesktop?-.85:-.65},{y:0,duration:1.25*!e,ease:"power4.out"},0),this.tlShow.fromTo(this.animScale,{x:.75,y:.85},{x:1,y:1,duration:.75*!e,ease:"power3.out"},0),this.material?.uniforms?.uAlpha&&this.tlShow.fromTo(this.material.uniforms.uAlpha,{value:0},{value:1,duration:.75*!e,ease:"power2.out"},0),this.tlShow}addEventListeners(){}removeEventListeners(){}handleResize(){}handleAssetsLoad(){}update(e,t){this.isActive&&(this.mesh.position.copy(this.animPosition),this.mesh.rotation.set(this.animRotation.x,this.animRotation.y,this.animRotation.z),this.mesh.scale.copy(this.animScale))}}class eh{constructor({name:e,scene:t,parent:i,config:s,dataCards:r}){this.name=e||"ModelsSlider",this.scene=t,this.parent=i||t.root,this.sceneVars=t.sceneVars,this.dataCards=r,this.isActive=!1,this.entities=[],this.setInitialState(),this.createConfig(s),this.createMesh(),this.createSlides()}enable(){this.isActive=!0,this.addEventListeners(),this.group.visible=!0}disable(){this.isActive=!1,this.removeEventListeners(),this.group.visible=!1}reset(){this.setInitialState()}destroy(){this.disable(),et(this.tlVisibility),this.entities.forEach(e=>e.destroy?.()),this.entities=[],this.slideWrappers=[],this.group.parent?.remove(this.group),this.group=null}initDebug(){f.isActive&&f.addEntity({name:this.name,config:this.config,scene:this.scene.name})}setInitialState(){this.offset=0,this.offsetTarget=0,this.dragStartOffset=0,this.progress=0,this.isDragging=!1}createConfig(e){this.config={cardSpacing:{value:er.isDesktop?1.3:1.1,params:{min:.1,max:5,step:.01}},cardScale:{value:1},dragSpeed:{value:1,params:{min:0,max:5,step:.01}},wheelSpeed:{value:.003,params:{min:0,max:.02,step:.001}},easing:{value:.1,params:{min:.001,max:1,step:.001}},shouldSnap:{value:!0},autoPlaySpeed:{value:0},shouldEmitProgress:{value:!0}},this.updateConfig(e)}updateConfig(e){if(e)for(let[t,i]of Object.entries(e))void 0!==this.config[t]&&(this.config[t].value=i)}get pitch(){return this.config.cardSpacing.value*this.config.cardScale.value}createMesh(){this.group=new b.Group,this.parent.add(this.group),this.enable()}createSlides(){this.slideWrappers=[];let e=this.dataCards.length;if(!e)return;let t=this.pitch,i=Math.max(1,Math.ceil(2*this.sceneVars.vWidth/(e*t))),s=e*i;for(let t=0;t<s;t++){let i=this.dataCards[t%e],s=Math.floor(t/e),r=new b.Group;r.name=`Models Slide Wrapper - ${i.id} (#${s})`,this.group.add(r),this.slideWrappers.push(r);let a=new el({name:`Models Card - ${i.id} (#${s})`,scene:this.scene,parent:r,data:i,cardScale:this.config.cardScale.value});this.entities.push(a)}this.layoutSlides()}updateProgress(){if(!this.config.shouldEmitProgress.value)return;let e=this.dataCards.length;if(!e)return;let t=e*this.pitch,i=(-this.offset/t%1+1)%.999;i!==this.progress&&(this.progress=i,Q.default.trigger(n.EVENTS.MODELS_SLIDER_PROGRESS,{progress:this.progress}))}layoutSlides(){if(!this.slideWrappers?.length)return;let e=this.pitch,t=this.slideWrappers.length*e,i=t/2;this.slideWrappers.forEach((s,r)=>{let a=r*e+this.offset;s.position.x=((a+i)%t+t)%t-i})}show({isImmediate:e=!1}={}){return this.animateShow({isImmediate:e})}hide(){return this.animateHide()}goToNextSlide(){let e=this.pitch;this.offsetTarget=Math.round(this.offsetTarget/e)*e-e}goToPrevSlide(){let e=this.pitch;this.offsetTarget=Math.round(this.offsetTarget/e)*e+e}animateShow({isImmediate:e=!1}={}){et(this.tlVisibility),this.setInitialState();let t=[-3,-2,-1,0,1,2,3],i=this.entities.length,s=0===i?[]:t.map(e=>this.entities[(e%i+i)%i]).filter(Boolean),r=this.entities.filter(e=>e&&!s.includes(e));return this.tlVisibility=o.default.timeline({}),s.forEach((i,s)=>{"function"==typeof i.show?this.tlVisibility.add(i.show({isImmediate:e}),e?0:.1*Math.abs(t[s])):console.warn("Entity is missing a show() method:",i)}),r.forEach(e=>{"function"==typeof e.enable&&this.tlVisibility.add(e.enable(),0)}),this.tlVisibility}animateHide(){et(this.tlVisibility),this.tlVisibility=o.default.timeline({}).to(this.group,{opacity:0,duration:1,ease:"power2.inOut"})}addEventListeners(){this.offDragStart=Q.default.on(n.EVENTS.CARD_CAROUSEL_DRAG_START,this.handleDragStart.bind(this)),this.offDragMove=Q.default.on(n.EVENTS.CARD_CAROUSEL_DRAG_MOVE,this.handleDragMove.bind(this)),this.offDragEnd=Q.default.on(n.EVENTS.CARD_CAROUSEL_DRAG_END,this.handleDragEnd.bind(this)),this.offPrevClick=Q.default.on(n.EVENTS.MODELS_SLIDER_PREV,this.goToPrevSlide.bind(this)),this.offNextClick=Q.default.on(n.EVENTS.MODELS_SLIDER_NEXT,this.goToNextSlide.bind(this)),this.offWheel=Q.default.on(n.EVENTS.CARD_CAROUSEL_WHEEL,this.handleWheel.bind(this))}removeEventListeners(){this.offDragStart&&this.offDragStart(),this.offDragMove&&this.offDragMove(),this.offDragEnd&&this.offDragEnd(),this.offPrevClick&&this.offPrevClick(),this.offNextClick&&this.offNextClick(),this.offWheel&&this.offWheel(),this.offDragStart=null,this.offDragMove=null,this.offDragEnd=null,this.offPrevClick=null,this.offNextClick=null,this.offWheel=null}handleResize(){}handleAssetsLoad(){}handleDragStart(){this.isDragging=!0,this.dragStartOffset=this.offsetTarget,document.body.style.cursor="grabbing"}handleDragMove({dragTotalRel:e}){this.isDragging&&(this.offsetTarget=this.dragStartOffset+e.x*this.sceneVars.vWidth*this.config.dragSpeed.value)}handleDragEnd(){if(document.body.style.cursor="",this.isDragging=!1,this.config.shouldSnap.value){let e=this.pitch;this.offsetTarget=Math.round(this.offsetTarget/e)*e}}handleWheel({horizontalDelta:e}){this.offsetTarget-=e*this.config.wheelSpeed.value}update(e,t){if(!this.isActive)return;let i=Math.min(t,100);this.config.autoPlaySpeed.value>0&&!this.isDragging&&(this.offsetTarget-=this.config.autoPlaySpeed.value*(i/1e3));let s=1-Math.pow(1-this.config.easing.value,i/16.666666666666668);this.offset=b.MathUtils.lerp(this.offset,this.offsetTarget,s),this.updateProgress(),this.layoutSlides(),this.entities.forEach(t=>{t.update(e,i)})}}class ed extends J{constructor(e){super(e),this.name="Scene Models",this.currentCamera=null,this._pendingSliderShow=!1,this.entities=[],this.textures={},this.dataCards=[],this.sliderConfig={},this.init()}destroy(){et(this.tlShow),et(this.tlHide),super.destroy()}reset(){super.reset(),this.setInitialState()}init(){this.root=new b.Group,this.scene.add(this.root),this.setInitialState(),this.initConfig(),this.initCamera(),this.initLights(),this.initPost()}initConfig(){this.config={distortionK1:{value:er.isDesktop?-.15:-.075,params:{min:-1,max:1,step:.001}},distortionK2:{value:0,params:{min:-1,max:1,step:.001}},distortionCylindricalFactor:{value:.7,params:{min:0,max:1,step:.001}}}}setInitialState(){}initCamera(){this.camera=new b.PerspectiveCamera(45,this.sceneVars.aspectRatio,.1,1e3),this.camera.position.set(0,0,5),this.camera.lookAt(0,0,0),this.currentCamera=this.camera}initLights(){}initEntities(){this.slider=new eh({scene:this,parent:this.root,dataCards:this.dataCards,config:this.sliderConfig}),this.entities=[...this.entities,this.slider],this._pendingSliderShow&&(this.slider.show(this._pendingSliderShow),this._pendingSliderShow=!1)}initPost(){let e=this.renderer.getContext(),t=e.getParameter(e.MAX_SAMPLES);this.composer=new F(this.renderer,{frameBufferType:b.HalfFloatType,multisampling:er.isDesktop?Math.min(2,t):0}),this.composer.setSize(this.sceneVars.width,this.sceneVars.height),this.passRender=new N(this.scene,this.currentCamera),this.composer.addPass(this.passRender),this.effectBarrel=new Z,this.passDither=new $(this.currentCamera,this.effectBarrel),this.composer.addPass(this.passDither)}initDebug(){f.addScene(this.name,!0),f.addSceneGlobal({name:"Post",config:this.config,scene:this.name,expanded:!0}),this.entities.forEach(e=>{e.initDebug&&e.initDebug()})}setupPostEffects(){this.updatePostEffectsUniforms()}updatePostEffectsUniforms(){this.effectBarrel.distortionK1=this.config.distortionK1.value,this.effectBarrel.distortionK2=this.config.distortionK2.value,this.effectBarrel.distortionCylindricalFactor=this.config.distortionCylindricalFactor.value}load(){let e=[];return this.hasLoaded?(this.shouldTriggerLoadEvents&&(Q.default.trigger(n.EVENTS.WEBGL_LOAD_MODELS_PROGRESS,{progress:1}),Q.default.trigger(n.EVENTS.WEBGL_LOAD_MODELS_COMPLETE)),e):(e=[...e,...this.loadTextures()],this.manageLoadPromises(e,{start:n.EVENTS.WEBGL_LOAD_MODELS_START,progress:n.EVENTS.WEBGL_LOAD_MODELS_PROGRESS,complete:n.EVENTS.WEBGL_LOAD_MODELS_COMPLETE},this.handleAssetsLoad.bind(this)))}loadTextures(){let e=[];return(t=>{for(let i in ee[t]){let s=en(ee[t][i]);this.textures[i]=s,e.push(s.loaded)}})("placeholders"),e}loadTexturesDynamic(e,t={}){this.dataCards=e,this.sliderConfig=t;let i=[];return e.forEach(e=>{let t=e.textureSource?this.createCanvasTexture(e.textureSource):en({src:e.imageSource,options:["repeat","flipY","nomipmaps"]});this.textures[`card_${e.id}`]=t,i.push(t.loaded||Promise.resolve())}),Promise.all(i).then(()=>{this.isDestroyed||this.handleAfterLoadDynamic()})}createCanvasTexture(e){let t=new b.CanvasTexture(e);return t.colorSpace=b.SRGBColorSpace,t.flipY=!0,t.generateMipmaps=!1,t.minFilter=b.LinearFilter,t.magFilter=b.LinearFilter,t.needsUpdate=!0,t}configureSlider(e){this.sliderConfig={...this.sliderConfig,...e},this.slider?.updateConfig(e)}show(e={onStart:()=>{},onComplete:()=>{}}){let t=()=>{this.setInitialState(),this.enable(),e.onStart&&e.onStart()};return this.animateShow({onStart:t,onComplete:e.onComplete,isImmediate:e.isImmediate})}hide(e={onStart:()=>{},onComplete:()=>{}}){let t=()=>{this.disable(),e.onComplete&&e.onComplete()};return this.animateHide({onStart:e.onStart,onComplete:t})}animateShow({onStart:e,onComplete:t,isImmediate:i=!1}={}){et(this.tlShow),this.tlShow=o.default.timeline({onStart:e,onComplete:t}),this.config?.distortionCylindricalFactor&&this.tlShow.fromTo(this.config.distortionCylindricalFactor,{value:1},{value:er.isDesktop?.7:.85,duration:1.5*!i,ease:"expo.out"},0);let s=()=>{this.slider&&"function"==typeof this.slider.show&&this.slider.show({isImmediate:i})};return this.slider?s():this._pendingSliderShow={isImmediate:i},this.tlShow}animateHide({onStart:e,onComplete:t}={}){return et(this.tlHide),this.tlHide=o.default.timeline({onStart:e,onComplete:t}),this.tlHide.add(this.slider.hide(),0),this.tlHide}addEventListeners(){this.offMouseDown=Q.default.on(n.EVENTS.MOUSE_DOWN,this.handleMouseDown.bind(this)),this.offMouseUp=Q.default.on(n.EVENTS.MOUSE_UP,this.handleMouseUp.bind(this)),this.offModelsShow=Q.default.on(n.EVENTS.WEBGL_MODELS_SHOW,this.show.bind(this)),this.offModelsHide=Q.default.on(n.EVENTS.WEBGL_MODELS_HIDE,this.hide.bind(this))}removeEventListeners(){this.offMouseDown(),this.offMouseUp(),this.offModelsShow(),this.offModelsHide()}handleAfterLoad(){this.composer&&this.setupPostEffects(),f.isActive&&this.initDebug()}handleAfterLoadDynamic(){this.initEntities()}handleResize(){super.handleResize(),this.composer&&(this.composer.setSize(this.sceneVars.width,this.sceneVars.height),this.effectBarrel.screenRes=new b.Vector2(this.sceneVars.width*this.sceneVars.pixelRatio,this.sceneVars.height*this.sceneVars.pixelRatio))}handleMouseDown(){this.entities.forEach(e=>{e&&e.handleMouseDown&&e.handleMouseDown()})}handleMouseUp(){this.entities.forEach(e=>{e&&e.handleMouseUp&&e.handleMouseUp()})}update(e,t){this.isActive&&(this.entities.forEach(i=>{i&&i.update(e,t)}),this.composer?(this.updatePostEffectsUniforms(),this.composer.render()):this.renderer.render(this.scene,this.currentCamera))}}var ec=e.i(12980);class eu{constructor({name:e,scene:t,parent:i,config:s,data:r,index:a,direction:n}){this.name=e||"HeroCard",this.scene=t,this.parent=i||t.root,this.sceneVars=t.sceneVars,this.data=r,this.index=a,this.direction=n,this.isActive=!1,this.setInitialState(),this.createConfig(s),this.createMesh()}enable(){this.isActive=!0,this.addEventListeners(),this.mesh.visible=!0}disable(){this.isActive=!1,this.removeEventListeners(),this.mesh.visible=!1}reset(){this.setInitialState()}destroy(){this.disable(),this.innerGroup.parent.remove(this.innerGroup),this.innerGroup=null,this.mesh.parent.remove(this.mesh),this.mesh=null}initDebug(){f.isActive&&f.addEntity({name:this.name,config:this.config,scene:this.scene.name})}setInitialState(){this.animPosition=new b.Vector3,this.animRotation=new b.Vector3,this.animScale=new b.Vector3(1,1,1),this.isFiring=!1,this.fireProgress=0,this.fireDuration=3,this.fireTargetX=0,this.revealFactor=0}createConfig(e){if(this.config={},e)for(let[t,i]of Object.entries(e))void 0!==this.config[t]&&(this.config[t].value=i)}createMesh(){let e=new b.PlaneGeometry(1,1),t=p(d);this.material=new b.ShaderMaterial({vertexShader:t.vert,fragmentShader:t.frag,uniforms:{tMap:{value:this.scene.textures[`card_${this.data.id}`]}},depthTest:!0,depthWrite:!0,transparent:!0}),this.mesh=new b.Mesh(e,this.material),this.innerGroup=new b.Group,this.innerGroup.add(this.mesh),this.parent.add(this.innerGroup),this.enable(),this.innerGroup.visible=!1,this.innerGroup.position.x=0,this.innerGroup.scale.set(0,0,0),this.computeDimensions(),this.computeFireTargetX()}computeDimensions(){let e=er.isDesktop?.75*this.sceneVars.vWidth:1.2*this.sceneVars.vWidth,t=e/this.data.aspectRatio;this.mesh.scale.set(e,t,1)}computeFireTargetX(){let e="left"===this.direction?-1:1;this.fireTargetX=e*this.sceneVars.vWidth*1.65}fire({duration:e=3,initialProgress:t=0}={}){this.isFiring||(this.fireDuration=e,this.fireProgress=t,this.innerGroup.position.x=0,this.innerGroup.scale.set(0,0,0),this.innerGroup.visible=!0,this.isFiring=!0)}addEventListeners(){}removeEventListeners(){}handleResize(){this.computeDimensions(),this.computeFireTargetX()}handleAssetsLoad(){}handleAfterLoadDynamic(){this.material.uniforms.tMap.value=this.scene.textures[`card_${this.data.id}`]}update(e,t){if(!this.isActive||!this.isFiring)return;if(this.fireProgress+=t/(1e3*this.fireDuration),this.fireProgress>=1){this.isFiring=!1,this.innerGroup.visible=!1,this.innerGroup.position.x=0,this.innerGroup.scale.set(0,0,0),this.innerGroup.renderOrder=0;return}let i=this.fireProgress*this.revealFactor,s=(0,ec.smoothstep)(0,1,i);s=.5*(0,ec.easeInQuad)(s)+.5*s;let r=er.isDesktop?.2:.3,a=.125*(0,ec.smoothstep)(0,.15,i)+.875*(0,ec.smoothstep)(r,1,i),n=new b.Vector3,o=new b.Vector3,l=new b.Vector3;n.copy(this.animPosition),o.copy(this.animRotation),l.copy(this.animScale),n.x+=this.fireTargetX*s,l.multiplyScalar(a),this.innerGroup.position.copy(n),this.innerGroup.rotation.set(o.x,o.y,o.z),this.innerGroup.scale.copy(l),this.innerGroup.renderOrder=s+a}}class ef{constructor({name:e,scene:t,parent:i,config:s,dataCards:r}){this.name=e||"HeroCards",this.scene=t,this.parent=i||t.root,this.sceneVars=t.sceneVars,this.dataCards=r,this.isActive=!1,this.entities=[],this.setInitialState(),this.createConfig(s),this.createMesh(),this.createSlides()}enable(){this.isActive=!0,this.addEventListeners(),this.group.visible=!0}disable(){this.isActive=!1,this.removeEventListeners(),this.group.visible=!1}reset(){this.setInitialState()}destroy(){this.disable(),this.group.parent.remove(this.group),this.group=null}initDebug(){f.isActive&&f.addEntity({name:this.name,config:this.config,scene:this.scene.name})}setInitialState(){this.animPosition=new b.Vector3,this.animRotation=new b.Vector3,this.animScale=new b.Vector3(1.2,1.2,1.2),this.isFiringActive=!1,this.fireInterval=1e3,this.fireDuration=3,this.fireAccumulator=0,this.nextFireIndexLeft=0,this.nextFireIndexRight=0,this.revealFactor=0}createConfig(e){if(this.config={},e)for(let[t,i]of Object.entries(e))void 0!==this.config[t]&&(this.config[t].value=i)}createMesh(){this.group=new b.Group,this.parent.add(this.group),this.enable()}createSlides(){this.slideWrappers=[],this.entitiesLeft=[],this.entitiesRight=[],this.dataCards.forEach((e,t)=>{let i=new b.Group;i.name=`Hero Card Wrapper - ${e.id}`,this.group.add(i),this.slideWrappers.push(i);let s=t%2==0?"left":"right",r=new eu({name:`Hero Card - ${e.id}`,scene:this.scene,parent:i,data:e,index:t,direction:s});this.entities.push(r),"left"===s?this.entitiesLeft.push(r):this.entitiesRight.push(r)})}animateReveal(){let e={revealFactor:1,duration:1.75,ease:"power3.inOut",stagger:0};return o.default.timeline({}).to(this.entitiesLeft,{...e},0).to(this.entitiesRight,{...e},0)}animateZoomOut(){return o.default.timeline({}).to(this.animScale,{x:.5,y:.5,z:.5,duration:1.5,ease:"power3.inOut"})}startFiring({interval:e=900,duration:t=9.6}={}){this.fireInterval=e,this.fireDuration=t,this.fireAccumulator=0,this.nextFireIndexLeft=0,this.nextFireIndexRight=0,this.isFiringActive=!0,this.preDistributeCards(),this.tweenReveal&&this.tweenReveal.kill(),this.revealFactor=0,this.animateReveal()}stopFiring(){this.isFiringActive=!1,this.tweenReveal&&this.tweenReveal.kill()}preDistributeCards(){if(!this.sceneVars.vWidth)return;let e=this.fireInterval/(1e3*this.fireDuration),t=t=>{for(let i=0;i<t.length;i++){let s=i*e;if(s>=1)break;t[i].fire({duration:this.fireDuration,initialProgress:s})}};t(this.entitiesLeft),t(this.entitiesRight)}fireNextPair(){this.fireNextInPool(this.entitiesLeft,"left"),this.fireNextInPool(this.entitiesRight,"right")}fireNextInPool(e,t){if(!e||!e.length||!this.sceneVars.vWidth)return;let i="left"===t?"nextFireIndexLeft":"nextFireIndexRight",s=e.length;for(let t=0;t<s;t++){let r=(this[i]+t)%s,a=e[r];if(!a.isFiring){a.fire({duration:this.fireDuration}),this[i]=(r+1)%s;return}}}addEventListeners(){}removeEventListeners(){}handleResize(){this.entities.forEach(e=>{e.handleResize()})}handleAssetsLoad(){}handleAfterLoadDynamic(){this.entities.forEach(e=>{e.handleAfterLoadDynamic()})}update(e,t){if(!this.isActive)return;let i=Math.min(t,100),s=new b.Vector3,r=new b.Vector3,a=new b.Vector3;if(s.copy(this.animPosition),r.copy(this.animRotation),a.copy(this.animScale),this.group.position.copy(s),this.group.rotation.set(r.x,r.y,r.z),this.group.scale.copy(a),this.isFiringActive&&this.sceneVars.vWidth>0)for(this.fireAccumulator+=i;this.fireAccumulator>=this.fireInterval;)this.fireAccumulator-=this.fireInterval,this.fireNextPair();this.entities.forEach(t=>{t.update(e,i)})}}class ep extends J{constructor(e){super(e),this.name="Scene Hero",this.currentCamera=null,this.entities=[],this.textures={},this.dataCards=[],this.init()}reset(){super.reset(),this.setInitialState()}init(){this.root=new b.Group,this.scene.add(this.root),this.setInitialState(),this.initConfig(),this.initCamera(),this.initLights(),this.initPost()}initConfig(){this.config={distortionK1:{value:er.isDesktop?-.15:-.075,params:{min:-1,max:1,step:.001}},distortionK2:{value:0,params:{min:-1,max:1,step:.001}},distortionCylindricalFactor:{value:.7,params:{min:0,max:1,step:.001}}}}setInitialState(){}initCamera(){this.camera=new b.PerspectiveCamera(45,this.sceneVars.aspectRatio,.1,1e3),this.camera.position.set(0,0,5),this.camera.lookAt(0,0,0),this.currentCamera=this.camera}initLights(){}initEntities(){this.cards=new ef({scene:this,parent:this.root,dataCards:this.dataCards}),this.entities=[...this.entities,this.cards]}initPost(){let e=this.renderer.getContext(),t=e.getParameter(e.MAX_SAMPLES);this.composer=new F(this.renderer,{frameBufferType:b.HalfFloatType,multisampling:er.isDesktop?Math.min(2,t):0}),this.composer.setSize(this.sceneVars.width,this.sceneVars.height),this.passRender=new N(this.scene,this.currentCamera),this.composer.addPass(this.passRender),this.effectBarrel=new Z,this.passDither=new $(this.currentCamera,this.effectBarrel),this.composer.addPass(this.passDither)}initDebug(){f.addScene(this.name,!0),f.addSceneGlobal({name:"Post",config:this.config,scene:this.name,expanded:!0}),this.entities.forEach(e=>{e.initDebug&&e.initDebug()})}setupPostEffects(){this.updatePostEffectsUniforms()}updatePostEffectsUniforms(){this.effectBarrel.distortionK1=this.config.distortionK1.value,this.effectBarrel.distortionK2=this.config.distortionK2.value,this.effectBarrel.distortionCylindricalFactor=this.config.distortionCylindricalFactor.value}load(){let e=[];return this.hasLoaded?(this.shouldTriggerLoadEvents&&(Q.default.trigger(n.EVENTS.WEBGL_LOAD_HERO_PROGRESS,{progress:1}),Q.default.trigger(n.EVENTS.WEBGL_LOAD_HERO_COMPLETE)),e):(e=[...e,...this.loadTextures()],this.manageLoadPromises(e,{start:n.EVENTS.WEBGL_LOAD_HERO_START,progress:n.EVENTS.WEBGL_LOAD_HERO_PROGRESS,complete:n.EVENTS.WEBGL_LOAD_HERO_COMPLETE},this.handleAssetsLoad.bind(this)))}loadTextures(){return[]}loadTexturesDynamic(e){this.dataCards=e,this.initEntities();let t=[];return e.forEach(e=>{let i=en({src:e.imageSrc,options:["repeat","flipY","nomipmaps"]});this.textures[`card_${e.id}`]=i,t.push(i.loaded)}),Promise.all(t).then(()=>{this.handleAfterLoadDynamic()}),Promise.all(t)}show(e={onStart:()=>{},onComplete:()=>{}}){let t=()=>{this.setInitialState(),this.enable(),e.onStart&&e.onStart()};return this.animateShow({onStart:t,onComplete:e.onComplete})}hide(e={onStart:()=>{},onComplete:()=>{}}){let t=()=>{this.disable(),e.onComplete&&e.onComplete()};return this.animateHide({onStart:e.onStart,onComplete:t})}animateShow({onStart:e,onComplete:t}={}){return et(this.tlShow),this.tlShow=o.default.timeline({onStart:e,onComplete:t}),e?.(),t?.(),this.tlShow}animateHide({onStart:e,onComplete:t}={}){return et(this.tlHide),this.tlHide=o.default.timeline({onStart:e,onComplete:t}),et(this.tlHide),e?.(),t?.(),this.tlHide}animateImagesShow(){et(this.tlImagesShow),this.tlImagesShow=o.default.timeline({}).set(this.config.distortionCylindricalFactor,{value:1},0).to(this.config.distortionCylindricalFactor,{value:.7,duration:2,ease:"power4.out"},0).call(()=>this.cards.startFiring(),null,0).call(()=>this.cards.animateZoomOut(),null,0)}animateZoomOut(){}addEventListeners(){this.offHeroImagesShow=Q.default.on(n.EVENTS.WEBGL_HERO_IMAGES_SHOW,this.handleHeroImagesShow.bind(this)),this.offHeroZoomOut=Q.default.on(n.EVENTS.WEBGL_HERO_ZOOM_OUT,this.handleHeroZoomOut.bind(this)),this.offMouseDown=Q.default.on(n.EVENTS.MOUSE_DOWN,this.handleMouseDown.bind(this)),this.offMouseUp=Q.default.on(n.EVENTS.MOUSE_UP,this.handleMouseUp.bind(this))}removeEventListeners(){this.offHeroImagesShow(),this.offHeroZoomOut(),this.offMouseDown(),this.offMouseUp()}handleAfterLoad(){this.composer&&this.setupPostEffects(),f.isActive&&this.initDebug()}handleAfterLoadDynamic(){this.cards.handleAfterLoadDynamic()}handleResize(){super.handleResize(),this.composer&&(this.composer.setSize(this.sceneVars.width,this.sceneVars.height),this.effectBarrel.screenRes=new b.Vector2(this.sceneVars.width*this.sceneVars.pixelRatio,this.sceneVars.height*this.sceneVars.pixelRatio))}handleMouseDown(){this.entities.forEach(e=>{e&&e.handleMouseDown&&e.handleMouseDown()})}handleMouseUp(){this.entities.forEach(e=>{e&&e.handleMouseUp&&e.handleMouseUp()})}handleHeroImagesShow(){this.animateImagesShow()}handleHeroZoomOut(){this.animateZoomOut()}update(e,t){this.isActive&&(this.entities.forEach(i=>{i&&i.update(e,t)}),this.composer?(this.updatePostEffectsUniforms(),this.composer.render()):this.renderer.render(this.scene,this.currentCamera))}}let ev=(e,t)=>{let i,s=0;return(...r)=>{let a=performance.now(),n=a-s;n>t?(s=a,e(...r)):(clearTimeout(i),i=setTimeout(()=>{s=performance.now(),e(...r)},t-n))}};var eg=e.i(46154);let em=class{static isWebGL2Available(){try{let e=document.createElement("canvas");return!!(window.WebGL2RenderingContext&&e.getContext("webgl2"))}catch(e){return!1}}static isColorSpaceAvailable(e){try{let t=document.createElement("canvas"),i=window.WebGL2RenderingContext&&t.getContext("webgl2");return i.drawingBufferColorSpace=e,i.drawingBufferColorSpace===e}catch(e){return!1}}static getWebGL2ErrorMessage(){return this._getErrorMessage(2)}static _getErrorMessage(e){let t={1:window.WebGLRenderingContext,2:window.WebGL2RenderingContext},i='Your $0 does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">$1</a>',s=document.createElement("div");return s.id="webglmessage",s.style.fontFamily="monospace",s.style.fontSize="13px",s.style.fontWeight="normal",s.style.textAlign="center",s.style.background="#fff",s.style.color="#000",s.style.padding="1.5em",s.style.width="400px",s.style.margin="5em auto 0",s.innerHTML=i=(i=t[e]?i.replace("$0","graphics card"):i.replace("$0","browser")).replace("$1",{1:"WebGL",2:"WebGL 2"}[e]),s}};class eb{constructor({canvas:e}){this.canvas=e,this.isRendering=!1,this.isWindowVisible=!0,this.isDesktop=er.isDesktop,window.isDesktop=this.isDesktop,this.initRenderer(),this.sceneBackground=new eo({manager:this,isDesktop:this.isDesktop}),this.sceneModels=new ed({manager:this,isDesktop:this.isDesktop}),this.sceneHero=new ep({manager:this,isDesktop:this.isDesktop}),this.currentScene=null,this.addEventListeners(),this.isRendering=!0}destroy(){this.currentScene&&this.currentScene.destroy(),this.currentScene=null,this.removeEventListeners(),f.isActive&&f.clear()}initRenderer(){this.isWebgl2=em.isWebGL2Available(),this.pixelRatio=Math.min(window.devicePixelRatio?window.devicePixelRatio:1,2),this.renderer=new eg.WebGLRenderer({canvas:this.canvas,antialias:!0,stencil:!1,depth:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.outputColorSpace=b.SRGBColorSpace,this.renderer.setPixelRatio(this.pixelRatio),this.renderer.setClearColor(new b.Color(0),0),this.gl=this.renderer.gl}findScene(e){switch(e){case"models":return this.sceneModels;case"hero":return this.sceneHero;default:return this.sceneBackground}}setScene(e){this.currentScene=e}addEventListeners(){this.throttledHandleResize=ev(this.handleResize.bind(this),16),window.addEventListener("resize",this.throttledHandleResize,{passive:!0}),this.resizeObserver=new ResizeObserver(this.throttledHandleResize),this.resizeObserver.observe(this.canvas.parentNode),this.bindedHandleVisibilityChange=this.handleVisibilityChange.bind(this),document.addEventListener("visibilitychange",this.bindedHandleVisibilityChange)}removeEventListeners(){window.removeEventListener("resize",this.throttledHandleResize),this.resizeObserver.disconnect(),document.removeEventListener("visibilitychange",this.bindedHandleVisibilityChange)}handleResize(){let e=this.canvas.parentNode;this.renderer.setSize(e.offsetWidth,e.offsetHeight),this.pixelRatio=Math.min(window.devicePixelRatio?window.devicePixelRatio:1,2),this.renderer.setPixelRatio(this.pixelRatio),this.currentScene&&this.currentScene.handleResize()}async handleRouteChange({route:e}){this.currentScene&&(this.currentScene.hide?this.currentScene.hide():this.currentScene.disable(),this.currentScene.reset()),this.currentScene=this.findScene(e),this.currentScene&&this.currentScene&&(this.currentScene.show?this.currentScene.show():this.currentScene.enable())}handleLoaderHideComplete(){this.currentScene&&this.currentScene.show&&this.currentScene.show()}handleVisibilityChange(){let e="visible"===document.visibilityState;this.isWindowVisible=e,this.currentScene&&this.currentScene.handleVisibilityChange(e)}update(e=0,t=0){this.isRendering&&this.isWindowVisible&&this.currentScene&&(f.isActive&&f.fpsCaptureBegin(),this.currentScene.update(e,t),f.isActive&&f.fpsCaptureEnd())}}let eS=ev(()=>Q.default.trigger("resize",{width:window.innerWidth,height:window.innerHeight}),16);window.addEventListener("resize",eS,{passive:!0});let eE=new class{constructor(){this.isActive=!1,this.isVisible=!0,this.rafId=null,this.shouldFpsCap=!1,this.maxFps=144,this.fpsInterval=1e3/this.maxFps,this.lastDate=Date.now(),this.dt=0,this.now=0,this.handlers={},this.addEventListeners()}addEventListeners(){this.bindedHandleVisibilityChange=this.handleVisibilityChange.bind(this),document.addEventListener("visibilitychange",this.bindedHandleVisibilityChange)}removeEventListeners(){document.removeEventListener("visibilitychange",this.bindedHandleVisibilityChange)}handleVisibilityChange(){this.isVisible="visible"===document.visibilityState}subscribe(e,t){this.handlers[e]?console.warn(`RAF handler with id ${e} already exists`):(this.isActive||(this.isActive=!0,this.update()),this.handlers[e]=t)}unsubscribe(e){this.handlers[e]?(delete this.handlers[e],0===Object.keys(this.handlers).length&&(this.isActive=!1,cancelAnimationFrame(this.rafId))):console.warn(`RAF handler with id ${e} does not exist`)}update(e=0){if(this.rafId=requestAnimationFrame(this.update.bind(this)),this.isActive&&this.isVisible)if(this.now=Date.now(),this.dt=this.now-this.lastDate,this.shouldFpsCap){let t=this.dt%this.fpsInterval;this.dt>=this.fpsInterval&&(this.updateHandlers(e,this.dt),this.lastDate=this.now-t)}else this.updateHandlers(e,this.dt),this.lastDate=this.now}updateHandlers(e,t){Object.keys(this.handlers).forEach(i=>{this.handlers[i](e,t)})}},ey=new class{constructor(){this.domTarget=window,this.screenDimensions=new b.Vector2(this.domTarget.innerWidth,this.domTarget.innerHeight),this.lastTime=0,this.preventIOSGestures=!0,this.hasMoved=!1,this.isDown=!1,this.isDragging=!1,this.position=new b.Vector2(0),this.positionLast=new b.Vector2(0),this.positionLastRel=new b.Vector2(0),this.positionRel=new b.Vector2(0),this.positionRelCenter=new b.Vector2(0),this.distanceTravelled=0,this.distanceTravelledRel=0,this.dragActivationThreshold=.01,this.drag=new b.Vector2(0),this.dragFirst=new b.Vector2(0),this.dragLast=new b.Vector2(0),this.dragRel=new b.Vector2(0),this.dragTotal=new b.Vector2(0),this.dragTotalRel=new b.Vector2(0),this.isEased=!0,this.easing=.075,this.positionEased=new b.Vector2(.01),this.positionEasedRel=new b.Vector2(.01),this.positionEasedRelCenter=new b.Vector2(.01),this.velocity=new b.Vector2(0),this.velocityEased=new b.Vector2(0),this.addEventListeners()}updateDomTarget(e){this.removeEventListeners(),this.domTarget=e,this.addEventListeners(),this.handleResize()}resume(){this.addEventListeners()}pause(){this.removeEventListeners(),this.isDown&&this.handleUp()}addEventListeners(){var e;let t;this.offResize=(e=this.handleResize.bind(this),t=Q.default.on("resize",e),eS(),t),this.bindedMove=this.handleMove.bind(this),this.bindedDown=this.handleDown.bind(this),this.bindedUp=this.handleUp.bind(this),this.bindedTouchMove=this.handleTouchMove.bind(this),this.bindedTouchStart=this.handleTouchStart.bind(this),this.bindedTouchEnd=this.handleTouchEnd.bind(this),this.bindedIosGestureChange=this.handleIosGestureChange.bind(this),this.bindedIosGestureEnd=this.handleIosGestureEnd.bind(this),er.isDesktop?(this.domTarget.addEventListener("mousemove",this.bindedMove,{passive:!0}),this.domTarget.addEventListener("mousedown",this.bindedDown,{passive:!0}),window.addEventListener("mouseup",this.bindedUp,{passive:!0})):(document.addEventListener("touchmove",this.bindedTouchMove,{passive:!0}),document.addEventListener("touchstart",this.bindedTouchStart,{passive:!0}),document.addEventListener("touchend",this.bindedTouchEnd,{passive:!0}),this.preventIOSGestures&&(document.addEventListener("gesturestart",this.bindedIosGestureChange),document.addEventListener("gesturechange",this.bindedIosGestureChange),document.addEventListener("gestureend",this.bindedIosGestureEnd))),this.isEased&&eE.subscribe("mouse",this.update.bind(this))}removeEventListeners(){this.offResize(),er.isDesktop?(this.domTarget.removeEventListener("mousemove",this.bindedMove),this.domTarget.removeEventListener("mousedown",this.bindedDown),this.domTarget.removeEventListener("mouseup",this.bindedUp)):(this.domTarget.removeEventListener("touchmove",this.bindedTouchMove),this.domTarget.removeEventListener("touchstart",this.bindedTouchStart),this.domTarget.removeEventListener("touchend",this.bindedTouchEnd)),this.preventIOSGestures&&(document.removeEventListener("gesturestart",this.bindedIosGestureChange),document.removeEventListener("gesturechange",this.bindedIosGestureChange),document.removeEventListener("gestureend",this.bindedIosGestureEnd)),this.isEased&&eE.unsubscribe("mouse")}getPositions(e){let t=this.domTarget===window?e.clientX:e.offsetX,i=this.domTarget===window?e.clientY:e.offsetY;this.positionLast.copy(this.position),this.position.set(t,i),this.positionRel.set(this.position.x/this.screenDimensions.x,1-this.position.y/this.screenDimensions.y),this.positionRelCenter.set((this.positionRel.x-.5)*2,(this.positionRel.y-.5)*2)}handleResize(){this.screenDimensions.set(this.domTarget===window?window.innerWidth:this.domTarget.offsetWidth,this.domTarget===window?window.innerHeight:this.domTarget.offsetHeight)}handleMove(e){this.hasMoved||(this.hasMoved=!0,Q.default.trigger(n.EVENTS.MOUSE_HAS_MOVED)),this.getPositions(e),Q.default.trigger(n.EVENTS.MOUSE_MOVE,{position:this.position,positionRel:this.positionRel,positionRelCenter:this.positionRelCenter}),this.isDown&&(this.drag.set(this.position.x-this.dragLast.x,this.position.y-this.dragLast.y),this.dragLast.set(this.position.x,this.position.y),this.dragTotal.set(this.position.x-this.dragFirst.x,this.position.y-this.dragFirst.y),this.dragRel.set(this.drag.x/this.screenDimensions.x,this.drag.y/this.screenDimensions.y),this.dragTotalRel.set(this.dragTotal.x/this.screenDimensions.x,this.dragTotal.y/this.screenDimensions.y),this.dragTotal.length()>this.dragActivationThreshold&&(this.isDragging||(this.isDragging=!0,document.body.classList.add("is-dragging"),Q.default.trigger(n.EVENTS.MOUSE_DRAG_START,{drag:this.drag,dragRel:this.dragRel,dragTotal:this.dragTotal,dragTotalRel:this.dragTotalRel})),Q.default.trigger(n.EVENTS.MOUSE_DRAG_MOVE,{drag:this.drag,dragRel:this.dragRel,dragTotal:this.dragTotal,dragTotalRel:this.dragTotalRel})))}handleTouchMove(e){let t=e.touches[0]?e.touches[0]:e;this.handleMove(t)}handleDown(e){this.isDown=!0,this.getPositions(e),this.dragFirst.copy(this.position),this.dragLast.copy(this.position),Q.default.trigger(n.EVENTS.MOUSE_DOWN,{position:this.position,positionRel:this.positionRel,positionRelCenter:this.positionRelCenter})}handleTouchStart(e){let t=e.touches[0]?e.touches[0]:e;this.handleDown(t)}handleUp(){this.isDown=!1,Q.default.trigger(n.EVENTS.MOUSE_UP,{position:this.position,positionRel:this.positionRel,positionRelCenter:this.positionRelCenter}),this.isDragging&&(this.isDragging=!1,document.body.classList.remove("is-dragging"),getSelection().empty(),this.drag.set(0,0),this.dragRel.set(0,0),this.dragTotal.set(0,0),this.dragTotalRel.set(0,0),Q.default.trigger(n.EVENTS.MOUSE_DRAG_END,{drag:this.drag,dragRel:this.dragRel,dragTotal:this.dragTotal,dragTotalRel:this.dragTotalRel}))}handleTouchEnd(e){let t=e.touches[0]?e.touches[0]:e;this.handleUp(t)}handleIosGestureChange(e){e.preventDefault(),document.body.style.zoom=.99}handleIosGestureEnd(){document.body.style.zoom=1}update(e){this.positionEased.lerp(this.position,this.easing),this.positionEasedRel.lerp(this.positionRel,this.easing),this.positionEasedRelCenter.lerp(this.positionRelCenter,this.easing);let t=Math.max(14,e-this.lastTime),i=this.positionLast.x-this.position.x,s=this.positionLast.y-this.position.y;this.velocity.set(i/t,s/t),this.velocityEased.lerp(this.velocity,.1),this.distanceTravelled=this.position.distanceTo(this.positionLast),this.distanceTravelledRel=this.positionRel.distanceTo(this.positionLastRel),this.lastTime=e,this.positionLast.copy(this.position),this.positionLastRel.copy(this.positionRel)}};var ew=e.i(96345);class ex{constructor(){this.isActive=!1,this.isRendering=!1,this.promiseInit=null,this.promiseAssetsStatic=null,this.resetFlags()}init({canvas:e,sceneName:t}){this.promiseInit=new Promise(i=>{this.manager=new eb({canvas:e}),this.scene=this.manager.findScene(t),this.manager.setScene(this.scene),this.addEventListeners(),this.isActive=!0,i()})}destroy(){this.disable(),this.manager.destroy(),this.removeEventListeners(),this.manager=null,this.scene=null,this.isActive=!1}enable(){this.scene.enable(),this.startRendering()}disable(){this.scene.disable(),this.stopRendering()}resetFlags(){}loadAssetsStatic(){return this.promiseAssetsStatic=this.scene.load(),this.promiseAssetsStatic}startRendering(e="webgl"){this.isRendering=!0,eE.subscribe(e,this.manager.update.bind(this.manager))}stopRendering(e="webgl"){this.isRendering=!1,eE.unsubscribe(e)}resetScene(){this.scene.reset()}resumeMouse(){ey.resume()}pauseMouse(){ey.pause()}addEventListeners(){for(let[e,t]of((0,ew.default)(this),this.offHandlers=[],Object.entries({loadStaticStart:n.EVENTS.WEBGL_LOAD_START,loadStaticProgress:n.EVENTS.WEBGL_LOAD_PROGRESS,loadStaticComplete:n.EVENTS.WEBGL_LOAD_COMPLETE})))this.offHandlers.push(Q.default.on(t,t=>{this.emit(e,t)}))}removeEventListeners(){this.off(),this.offHandlers.forEach(e=>e())}}new ex,e.s(["WebglAPI",0,ex],77889)}]);