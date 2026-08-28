// Source order and sizes extracted from the downloaded Palmer HTML. The
// canonical 15-column desktop topology is the source runtime's 114-item
// calculateGrid/reconstructDOM result at its 1920 × 1080 reference viewport.
const sourceSizes = [
  15, 16, 22, 20.5, 28, 27.5, 12, 17, 9, 15, 15, 22, 11, 22, 22,
  29, 27.5, 16, 21, 19, 29, 19, 21, 19, 14, 22, 28, 22, 22, 9,
  11, 19, 20.5, 11.5, 22.5, 21, 12, 19, 16, 22, 22, 16, 22, 12, 21,
  19, 25.5, 19, 17, 19, 14.5, 16, 16, 28, 20.5, 8, 22, 12.5, 28, 12.5,
  28.5, 14.5, 19, 28, 28, 27, 15, 26, 21, 16, 15, 28, 25.5, 11, 7,
  23.5, 16, 14, 9, 14.5, 29, 22, 17, 22, 22, 26, 27, 7.5, 22, 7.5,
  16, 20.5, 8, 16, 14, 12, 26, 22, 28, 23.5, 28, 6, 17, 28, 22,
  12, 14, 22, 16, 28, 22, 22, 15, 22,
];

export const PALMER_SOURCE_COLUMN_COUNT = 15;
export const PALMER_SOURCE_ROW_COUNT = 8;
export const PALMER_SOURCE_SLOTS = sourceSizes.map((size, index) => ({
  index,
  size,
  runtimeColumn: index % PALMER_SOURCE_COLUMN_COUNT,
  runtimeRow: Math.floor(index / PALMER_SOURCE_COLUMN_COUNT),
}));
