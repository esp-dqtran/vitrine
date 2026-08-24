export const MESSAGE = "THE CONTENT ARCHITECTURE.";
export const DOT_INDEX = MESSAGE.indexOf(".");
export const LETTER_INDEXES = Array.from(MESSAGE, (_character, index) => index).filter(
  (index) => index !== DOT_INDEX,
);
export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = Math.ceil(MESSAGE.length / ATLAS_COLUMNS);
export const RING_COUNT = 30;
export const BACKGROUND = "#232323";

export const BASE_QUAD_POSITION = new Float32Array([
  -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
]);

export const BASE_QUAD_UV = new Float32Array([
  0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
]);

export function smoothstep(start, end, value) {
  if (start === end) return value < start ? 0 : 1;
  const normalized = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return normalized * normalized * (3 - 2 * normalized);
}

export function inverseSmoothstep(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;

  let estimate = value;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const square = estimate * estimate;
    const error = 3 * square - 2 * square * estimate - value;
    const derivative = 6 * estimate - 6 * square;
    if (derivative === 0) break;
    estimate -= error / derivative;
  }

  return Math.max(0, Math.min(1, estimate));
}

export function wrapAngle(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

export function hexToRgb01(value) {
  const number = Number.parseInt(value.slice(1), 16);
  return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
}

export function createGlyphAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64 * ATLAS_ROWS;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return canvas;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "400 57px GeistMono, ui-monospace, monospace";

  for (let index = 0; index < MESSAGE.length; index += 1) {
    const x = ((index % ATLAS_COLUMNS) + 0.5) * 64;
    const y = (Math.floor(index / ATLAS_COLUMNS) + 0.55) * 64;
    const character = MESSAGE[index];

    if (character === ".") {
      context.beginPath();
      context.arc(x, y, 5.76, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillText(character ?? "", x, y);
    }
  }

  return canvas;
}

export function createRingConfiguration(random = Math.random) {
  return Array.from({ length: RING_COUNT }, (_value, index) => {
    const normalized = index / (RING_COUNT - 1);
    const radius = 0.06 + 1.39 * normalized;
    const speed = (index % 2 === 0 ? 1 : -1) * (0.006 + (1 - normalized) * 0.029);
    const letterSizePx = 14 + 16 * normalized;
    const charsCount = Math.max(
      8,
      Math.floor((Math.PI * 2 * radius) / (0.6 * letterSizePx * (1 / 540))),
    );
    const bandCenter =
      random() < 0.15 ? random() * Math.PI * 2 : 0.25 + (random() - 0.5) * (0.65 * Math.PI);
    const widthSeed =
      random() < 0.1 ? 0.05 + 0.15 * random() : 0.25 + 0.35 * normalized + 0.3 * random();

    return {
      radius,
      speed,
      letterSizePx,
      charsCount,
      bandCenter,
      bandHalfWidth: Math.min(0.98, widthSeed) * Math.PI,
      bandSoftness: Math.PI * (0.07 + 0.13 * random()),
    };
  });
}

function createLetterPattern(length, random) {
  const isLetter = new Uint8Array(length);
  const letterIndex = new Uint16Array(length);
  let cursor = 0;

  while (cursor < length) {
    for (let index = 0; index < LETTER_INDEXES.length && cursor < length; index += 1) {
      isLetter[cursor] = 1;
      letterIndex[cursor] = LETTER_INDEXES[index] ?? 0;
      cursor += 1;
    }

    const dotCount = 1 + Math.floor(3 * random());
    cursor += Math.min(dotCount, length - cursor);
  }

  return { isLetter, letterIndex };
}

export function createInstanceAttributes(rings, random = Math.random) {
  const total = rings.reduce((sum, ring) => sum + ring.charsCount, 0);
  const aRadius = new Float32Array(total);
  const aTheta0 = new Float32Array(total);
  const aSpeed = new Float32Array(total);
  const aSize = new Float32Array(total);
  const aCharIdx = new Float32Array(total);
  const aRingIdx = new Float32Array(total);
  let cursor = 0;

  rings.forEach((ring, ringIndex) => {
    const { isLetter, letterIndex } = createLetterPattern(ring.charsCount, random);
    const startAngle = random() * Math.PI * 2;
    const angleStep = (Math.PI * 2) / ring.charsCount;
    const outerBand = ring.bandHalfWidth + ring.bandSoftness;
    const innerBand = Math.max(0, ring.bandHalfWidth - ring.bandSoftness);

    for (let index = 0; index < ring.charsCount; index += 1) {
      const theta = startAngle + index * angleStep;
      const distance = Math.abs(wrapAngle(theta - ring.bandCenter));
      const letterWeight = smoothstep(outerBand, innerBand, distance);
      const showLetter =
        isLetter[index] === 1 &&
        (letterWeight > 0.7 || (letterWeight >= 0.3 && random() < letterWeight));

      aRadius[cursor] = ring.radius;
      aTheta0[cursor] = theta;
      aSpeed[cursor] = ring.speed;
      aRingIdx[cursor] = ringIndex;
      aCharIdx[cursor] = showLetter ? (letterIndex[index] ?? 0) : DOT_INDEX;
      aSize[cursor] = showLetter ? ring.letterSizePx * (0.85 + 0.15 * letterWeight) : 5;
      cursor += 1;
    }
  });

  return { aRadius, aTheta0, aSpeed, aSize, aCharIdx, aRingIdx, total };
}

export const VERTEX_SHADER = `#version 300 es
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

const float RIPPLE_DURATION = 1.8;
const float RIPPLE_MAX_RADIUS = 1.6;
const float RIPPLE_WIDTH = 0.85;
const float RIPPLE_PUSH = 0.045;
const float RIPPLE_SCALE = 0.5;
const float DOT_SIZE = 5.0;
const float ENTRANCE_FADE = 0.5;
const float GATHER_SCALE = 0.12;
const float SHAKE_AMPLITUDE = 0.002;
const float SHAKE_FRACTION = 0.18;
const float GLITCH_RATE = 9.0;
const float GLITCH_FRACTION = 0.15;

out vec2 vUv;
out float vRingT;
out float vAlpha;

void main() {
  float rippleInfluence = 0.0;
  for (int rippleIndex = 0; rippleIndex < 16; rippleIndex++) {
    float start = uRippleStarts[rippleIndex];
    if (start < 0.0) continue;
    float elapsed = uTime - start;
    if (elapsed < 0.0 || elapsed >= RIPPLE_DURATION) continue;
    float life = elapsed / RIPPLE_DURATION;
    float waveRadius = smoothstep(0.0, 1.0, life) * RIPPLE_MAX_RADIUS;
    float bell = 1.0 - smoothstep(0.0, RIPPLE_WIDTH * 0.5, abs(aRadius - waveRadius));
    float fade = smoothstep(0.0, 0.22, life) * (1.0 - smoothstep(0.78, 1.0, life));
    rippleInfluence = max(rippleInfluence, bell * fade);
  }

  float charge = uRingCharge[int(aRingIdx)];
  float gather = uRingGather[int(aRingIdx)];
  float effectiveRadius = aRadius * (1.0 - gather * GATHER_SCALE) + rippleInfluence * RIPPLE_PUSH;
  float theta = aTheta0 + uTime * aSpeed + uRingOffsets[int(aRingIdx)];
  float cosine = cos(theta);
  float sine = sin(theta);
  vec2 ringCenter = vec2(cosine, sine) * effectiveRadius;

  float mouseDistance = length(ringCenter - uMouse);
  float hover = (1.0 - smoothstep(0.0, uMouseRadius, mouseDistance)) * uMouseInfluence;
  float strength = max(hover * 2.5, rippleInfluence);
  float seed = aTheta0 * 7.13 + aRadius * 13.97;
  float threshold = fract(sin(seed * 12.9898) * 43758.5453);
  float isDot = step(threshold, strength);

  float glitchTick = floor(uTime * GLITCH_RATE);
  float glitchNoise = fract(sin(seed * 91.7 + glitchTick * 7.31) * 43758.5453);
  isDot = max(isDot, step(glitchNoise, charge * GLITCH_FRACTION));
  float characterIndex = mix(aCharIdx, ${DOT_INDEX}.0, isDot);
  float sizePx = mix(aSize, DOT_SIZE, isDot) * (1.0 + rippleInfluence * RIPPLE_SCALE);

  float designSize = sizePx * uPxToDesign;
  vec2 rotated = vec2(
    -position.x * sine - position.y * cosine,
    position.x * cosine - position.y * sine
  ) * designSize;

  float shakeSeed = fract(sin(aTheta0 * 91.17 + aRadius * 47.91) * 24634.6345);
  float shakes = step(shakeSeed, SHAKE_FRACTION);
  vec2 tremor = vec2(
    sin(uTime * (38.0 + shakeSeed * 14.0) + shakeSeed * 271.0),
    cos(uTime * (34.0 + shakeSeed * 17.0) + shakeSeed * 113.0)
  ) * (charge * shakes * SHAKE_AMPLITUDE);

  vec2 worldPosition = (ringCenter + rotated + tremor) * uFitScale + uCenter;
  float column = mod(characterIndex, uAtlasGrid.x);
  float row = floor(characterIndex / uAtlasGrid.x);
  vUv = vec2((column + uv.x) / uAtlasGrid.x, (row + (1.0 - uv.y)) / uAtlasGrid.y);
  vRingT = clamp(aRadius, 0.0, 1.2);
  float arrival = uRingArrivalTime[int(aRingIdx)];
  vAlpha = clamp((uTime - arrival) / ENTRANCE_FADE, 0.0, 1.0);
  gl_Position = vec4(worldPosition, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform sampler2D tAtlas;
in vec2 vUv;
in float vRingT;
in float vAlpha;
out vec4 fragColor;

void main() {
  vec4 sampled = texture(tAtlas, vUv);
  float brightness = mix(0.85, 1.0, smoothstep(0.0, 0.85, vRingT));
  fragColor = vec4(vec3(brightness), sampled.a * vAlpha);
}
`;

