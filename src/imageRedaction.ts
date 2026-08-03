import sharp from "sharp";

export interface PixelRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImageRedactionResult {
  body: Buffer;
  width: number;
  height: number;
  channels: number;
  rectangles: PixelRectangle[];
}

function normalizedRectangle(
  rectangle: PixelRectangle,
  imageWidth: number,
  imageHeight: number,
): PixelRectangle {
  const values = [rectangle.left, rectangle.top, rectangle.width, rectangle.height];
  if (!values.every(Number.isInteger)) {
    throw new Error("Redaction rectangle values must be integers");
  }
  if (rectangle.left < 0 || rectangle.top < 0 || rectangle.width < 1 || rectangle.height < 1) {
    throw new Error("Redaction rectangle must have a positive size and non-negative origin");
  }
  if (rectangle.left + rectangle.width > imageWidth || rectangle.top + rectangle.height > imageHeight) {
    throw new Error("Redaction rectangle exceeds the image bounds");
  }
  return { ...rectangle };
}

function copyRegion(
  source: Buffer,
  imageWidth: number,
  channels: number,
  rectangle: PixelRectangle,
): Buffer {
  const rowBytes = rectangle.width * channels;
  const region = Buffer.allocUnsafe(rowBytes * rectangle.height);
  for (let row = 0; row < rectangle.height; row += 1) {
    const sourceOffset = ((rectangle.top + row) * imageWidth + rectangle.left) * channels;
    source.copy(region, row * rowBytes, sourceOffset, sourceOffset + rowBytes);
  }
  return region;
}

function pasteRegion(
  target: Buffer,
  region: Buffer,
  imageWidth: number,
  channels: number,
  rectangle: PixelRectangle,
): void {
  const rowBytes = rectangle.width * channels;
  for (let row = 0; row < rectangle.height; row += 1) {
    const targetOffset = ((rectangle.top + row) * imageWidth + rectangle.left) * channels;
    region.copy(target, targetOffset, row * rowBytes, (row + 1) * rowBytes);
  }
}

export async function blurPngRectangles(
  input: Uint8Array,
  rectangles: PixelRectangle[],
  options: { sigma?: number } = {},
): Promise<ImageRedactionResult> {
  if (rectangles.length === 0) throw new Error("At least one redaction rectangle is required");
  const sigma = options.sigma ?? 14;
  if (!Number.isFinite(sigma) || sigma < 0.3 || sigma > 1000) {
    throw new Error("Blur sigma must be between 0.3 and 1000");
  }

  const image = sharp(input, { failOn: "error" });
  const metadata = await image.metadata();
  if (metadata.format !== "png") throw new Error("Deterministic screenshot redaction requires PNG input");

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const normalized = rectangles.map((rectangle) => normalizedRectangle(rectangle, info.width, info.height));
  const output = Buffer.from(data);

  for (const rectangle of normalized) {
    const region = copyRegion(output, info.width, info.channels, rectangle);
    const blurred = await sharp(region, {
      raw: {
        width: rectangle.width,
        height: rectangle.height,
        channels: info.channels,
      },
    }).blur(sigma).raw().toBuffer();
    pasteRegion(output, blurred, info.width, info.channels, rectangle);
  }

  const body = await sharp(output, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();

  return {
    body,
    width: info.width,
    height: info.height,
    channels: info.channels,
    rectangles: normalized,
  };
}
