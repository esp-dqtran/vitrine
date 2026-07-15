import sharp from "sharp";

// Grid tiles render at ~200-240px CSS width; 480px covers retina without shipping a
// full-resolution (400KB-1.3MB) original just to shrink it client-side.
const THUMBNAIL_WIDTH = 480;
const JPEG_QUALITY = 82;

export async function generateThumbnail(input: Buffer): Promise<Buffer> {
  const { width = 0 } = await sharp(input).metadata();
  return sharp(input)
    .resize({ width: Math.min(THUMBNAIL_WIDTH, width || THUMBNAIL_WIDTH), withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}
