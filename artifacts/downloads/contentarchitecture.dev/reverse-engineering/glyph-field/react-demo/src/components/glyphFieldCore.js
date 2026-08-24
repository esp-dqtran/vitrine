export const BASE_QUAD_POSITION = new Float32Array([
  -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
]);

export const BASE_QUAD_UV = new Float32Array([
  0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
]);

export function hexToRgb01(value) {
  const number = Number.parseInt(value.slice(1), 16);
  return [
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255,
  ];
}

export function getMonoFontCss(size, weight = 400) {
  return `${weight} ${Math.floor(size)}px ${getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mono")
    .trim() || "ui-monospace, monospace"}`;
}

export function createGlyphAtlas(atlas, glyphAspect) {
  const columns = 4;
  const rows = Math.ceil(atlas.length / columns);
  const tileWidth = Math.max(8, Math.round(64 * glyphAspect));
  const canvas = document.createElement("canvas");
  canvas.width = columns * tileWidth;
  canvas.height = rows * 64;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return { canvas, columns, rows };

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = getMonoFontCss(47.36, 500);
  for (let index = 0; index < atlas.length; index += 1) {
    const x = ((index % columns) + 0.5) * tileWidth;
    const y = (Math.floor(index / columns) + 0.58) * 64;
    context.fillText(atlas[index] ?? " ", x, y);
  }
  return { canvas, columns, rows };
}

export function createBrightnessCanvas(width, height, brightness) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return canvas;
  const image = context.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    const value = brightness[index] ?? 0;
    const offset = index * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function createVertexShader(phraseLength, glyphAspect) {
  return `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 position;
in vec2 uv;

uniform vec2 uGridSize;
uniform vec2 uAtlasGrid;
uniform float uTime;
uniform float uPhraseChars[${phraseLength}];
uniform vec2 uModelStart;
uniform vec2 uModelSize;
uniform vec2 uModelUVScale;
uniform vec2 uModelUVOffset;
uniform float uBackgroundBrightness;
uniform sampler2D tSourceBrightness;
uniform vec2 uEntranceCenter;
uniform float uEntranceStart;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform float uMouseRadius;
uniform float uRippleMaxRadius;
uniform float uRippleWidth;
uniform float uRippleStarts[16];
uniform vec2 uRippleCenters[16];
uniform float uActiveRippleCount;

const float RIPPLE_DURATION = 1.8;
const float ENTRANCE_FADE = 0.5;
const float GLYPH_ASPECT = ${glyphAspect.toFixed(4)};

out vec2 vUv;
out float vOpacity;

float screenDist(vec2 offset) {
  offset.y /= GLYPH_ASPECT;
  return length(offset);
}

float cellHash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}

float hash1D(float value) {
  return fract(sin(value * 12.9898) * 43758.5453);
}

float pickRandomGlyph(float seed, float count) {
  return 1.0 + floor(hash1D(seed) * (count - 1.0));
}

void main() {
  int instanceID = gl_InstanceID;
  int columns = int(uGridSize.x);
  vec2 cell = vec2(float(instanceID % columns), float(instanceID / columns));
  vec2 modelOffset = cell - uModelStart;
  bool inModel = modelOffset.x >= 0.0 && modelOffset.x < uModelSize.x
    && modelOffset.y >= 0.0 && modelOffset.y < uModelSize.y;

  int activeRippleCount = int(uActiveRippleCount);
  float rippleInfluence = 0.0;
  for (int rippleIndex = 0; rippleIndex < 16; rippleIndex++) {
    if (rippleIndex >= activeRippleCount) break;
    float elapsed = uTime - uRippleStarts[rippleIndex];
    if (elapsed < 0.0 || elapsed >= RIPPLE_DURATION) continue;
    float life = elapsed / RIPPLE_DURATION;
    float waveRadius = smoothstep(0.0, 1.0, life) * uRippleMaxRadius;
    float distanceToCenter = screenDist(cell - uRippleCenters[rippleIndex]);
    float bell = 1.0 - smoothstep(0.0, uRippleWidth * 0.5, abs(distanceToCenter - waveRadius));
    float fade = smoothstep(0.0, 0.22, life) * (1.0 - smoothstep(0.78, 1.0, life));
    rippleInfluence = max(rippleInfluence, bell * fade);
  }

  float mouseDistance = screenDist(cell - uMouse);
  float hoverInfluence = (1.0 - smoothstep(0.0, uMouseRadius, mouseDistance)) * uMouseInfluence;
  float threshold = cellHash(cell);
  float dimMask = step(threshold, hoverInfluence * 2.5) * step(0.001, hoverInfluence);
  float boostMask = step(threshold, rippleInfluence * 0.5) * step(0.001, rippleInfluence);

  float rowOffset = floor(hash1D(cell.y + 0.5) * float(${phraseLength}));
  float baseCharacter = uPhraseChars[int(mod(cell.x + rowOffset, float(${phraseLength})))];
  float atlasGlyphCount = uAtlasGrid.x * uAtlasGrid.y;

  float flipPhase = uTime * 0.18 + threshold * 6.2831853;
  float flipActive = step(0.985, sin(flipPhase) * 0.5 + 0.5) * float(inModel);
  float flipFrame = floor(uTime * 2.5);
  float flipCharacter = pickRandomGlyph(threshold * 17.13 + flipFrame * 1.7, atlasGlyphCount);
  float characterIndex = mix(baseCharacter, flipCharacter, flipActive);

  float scrambleFrame = floor(uTime * 24.0);
  float scrambleCharacter = pickRandomGlyph(threshold * 7.13 + scrambleFrame, atlasGlyphCount);
  characterIndex = mix(characterIndex, scrambleCharacter, boostMask);
  characterIndex = clamp(characterIndex, 0.0, atlasGlyphCount - 1.0);

  float atlasColumn = mod(characterIndex, uAtlasGrid.x);
  float atlasRow = floor(characterIndex / uAtlasGrid.x);
  vUv = vec2(
    (atlasColumn + uv.x) / uAtlasGrid.x,
    (atlasRow + (1.0 - uv.y)) / uAtlasGrid.y
  );

  float brightness = uBackgroundBrightness;
  if (inModel) {
    vec2 modelUv = (modelOffset + 0.5) / uModelSize;
    modelUv = modelUv * uModelUVScale + uModelUVOffset;
    brightness = max(uBackgroundBrightness, texture(tSourceBrightness, modelUv).r);
  }

  float baseOpacity = pow(brightness, 0.6);
  float effectiveOpacity = baseOpacity * (1.0 - hoverInfluence);
  effectiveOpacity = mix(effectiveOpacity, 0.0, dimMask);
  effectiveOpacity = mix(effectiveOpacity, 1.0, boostMask);

  float entranceAlpha = 1.0;
  if (uEntranceStart > -1e8) {
    float arrivalDistance = screenDist(cell - uEntranceCenter);
    float arrivalFraction = clamp(
      (arrivalDistance - uRippleWidth * 0.5) / uRippleMaxRadius,
      0.0,
      1.0
    );
    float inverseArg = clamp(1.0 - 2.0 * arrivalFraction, -1.0, 1.0);
    float arrival = (0.5 - sin(asin(inverseArg) / 3.0)) * RIPPLE_DURATION;
    entranceAlpha = clamp(
      (uTime - uEntranceStart - arrival) / ENTRANCE_FADE,
      0.0,
      1.0
    );
  }
  vOpacity = effectiveOpacity * entranceAlpha;

  vec2 cellSize = 2.0 / uGridSize;
  vec2 center = -1.0 + (cell + 0.5) * cellSize;
  center.y = -center.y;
  gl_Position = vec4(center + position * cellSize, 0.0, 1.0);
}
`;
}

export const FRAGMENT_SHADER = `#version 300 es
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
`;
