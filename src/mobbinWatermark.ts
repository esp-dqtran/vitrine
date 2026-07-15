import sharp from "sharp";

// Mobbin stamps a fixed, full-width dark footer bar ("<app> · curated by Mobbin") onto the
// bottom of every exported screen. Across a full app export it is byte-for-byte the same
// element every time — same position, same height — while the app content just above it
// varies (light, gray, or dark-mode). So pixel-hunting for the bar's top edge is unreliable
// (dark content above merges with it); a fixed crop is both simpler and more robust.
//
// The bar's height is a FIXED pixel count, not proportional to image width: measured at
// 121px on both a 1179px-wide mobile export and a 1920px-wide web export (same text/logo
// render size regardless of screenshot width). A width-scaled ratio was tried first and
// undershoots on mobile / overshoots on web, landing the darkness probe above the real bar
// on wide exports and silently skipping the crop. Override with MOBBIN_WATERMARK_PX, or
// disable entirely with MOBBIN_WATERMARK=keep.
//
// ponytail: fixed-px crop, not detection. Ceiling: if a future export sizes the bar
// differently across resolutions again, tune MOBBIN_WATERMARK_PX rather than reaching for
// per-pixel detection.

const DEFAULT_BAND_PX = 121; // measured bar height, constant across export widths
const MAX_FRACTION = 0.25; // refuse to trim more than 25% of height (bad px / tiny image guard)
const BOTTOM_DARK = 90; // the bar's bottom edge is solid ~47; require it before cropping

const num = (name: string) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

export async function stripMobbinWatermark(input: Buffer): Promise<Buffer> {
  if (process.env.MOBBIN_WATERMARK === "keep") return input;
  try {
    return await crop(input);
  } catch {
    // Best-effort: a decode hiccup must not break ingestion. The downstream signature check
    // still validates the (uncropped) bytes; a truly corrupt file is rejected there, not here.
    return input;
  }
}

async function crop(input: Buffer): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(input).metadata();
  if (width < 8 || height < 40) return input;

  const ratio = num("MOBBIN_WATERMARK_RATIO");
  const band = Math.round(num("MOBBIN_WATERMARK_PX") ?? (ratio ? ratio * width : DEFAULT_BAND_PX));
  if (band < 8 || band > height * MAX_FRACTION) return input;

  // Confirm a bar is actually there: the bottom edge of Mobbin's bar is solid dark. If the
  // bottom rows aren't dark, this isn't a watermarked screen (or the crop would eat content).
  // resize(1,1) averages the strip to one pixel — note .stats() would read the whole input,
  // ignoring .extract(), so we must reduce the extracted region explicitly.
  const probe = Math.max(2, Math.round(band * 0.25));
  const [r, g, b] = await sharp(input)
    .extract({ left: 0, top: height - probe, width, height: probe })
    .resize(1, 1, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  if (0.299 * r + 0.587 * g + 0.114 * b > BOTTOM_DARK) return input;

  // Same format in as out (sharp keeps the input codec), so the signature/content-type checks
  // downstream still hold.
  return sharp(input).extract({ left: 0, top: 0, width, height: height - band }).toBuffer();
}
