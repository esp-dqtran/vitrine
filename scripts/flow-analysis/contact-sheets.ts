import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { ObjectMetadata, ObjectStore } from "../../src/objectStore.ts";

export type FlowPlatform = "android" | "ios" | "web";

export interface FlowEvidenceItem {
  imageId: number;
  evidenceId: string;
  stepIndex: number;
  imageIndex: number;
  stepLabel: string;
  interaction?: string;
}

export interface ContactSheet {
  path: string;
  buffer: Buffer;
  evidence: FlowEvidenceItem[];
  sheetNumber: number;
  columns: number;
}

interface SheetLayout {
  cellWidth: number;
  imageHeight: number;
  columns: number;
  gap: number;
  labelHeight: number;
}

export const EVIDENCE_PER_SHEET = 4;

export function sheetLayout(platform: FlowPlatform): SheetLayout {
  return platform === "web"
    ? { cellWidth: 960, imageHeight: 600, columns: 2, gap: 16, labelHeight: 44 }
    : { cellWidth: 512, imageHeight: 1_110, columns: 2, gap: 16, labelHeight: 44 };
}

export function splitEvidence(
  evidence: FlowEvidenceItem[],
  size = EVIDENCE_PER_SHEET,
): FlowEvidenceItem[][] {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("Invalid contact-sheet size");
  const chunks: FlowEvidenceItem[][] = [];
  for (let index = 0; index < evidence.length; index += size) {
    chunks.push(evidence.slice(index, index + size));
  }
  return chunks;
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function evidenceLabel(item: FlowEvidenceItem, width: number, height: number): Buffer {
  const text = `${item.evidenceId} · Step ${item.stepIndex + 1} · Image ${item.imageIndex + 1}`;
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
      + `<rect width="100%" height="100%" fill="#111827"/>`
      + `<text x="16" y="29" fill="#ffffff" font-family="Arial, sans-serif" `
      + `font-size="20" font-weight="700">${xml(text)}</text></svg>`,
  );
}

export async function createContactSheets(input: {
  baseName: string;
  outputDirectory: string;
  platform: FlowPlatform;
  evidence: FlowEvidenceItem[];
  images: Map<number, ObjectMetadata>;
  store: ObjectStore;
}): Promise<ContactSheet[]> {
  const chunks = splitEvidence(input.evidence);
  const layout = sheetLayout(input.platform);

  return await Promise.all(chunks.map(async (evidence, chunkIndex) => {
    const sheetNumber = chunkIndex + 1;
    const outputPath = join(
      input.outputDirectory,
      `${input.baseName}-sheet-v2-${String(sheetNumber).padStart(2, "0")}.png`,
    );
    const columns = Math.min(layout.columns, evidence.length);
    try {
      return {
        path: outputPath,
        buffer: await readFile(outputPath),
        evidence,
        sheetNumber,
        columns,
      };
    } catch {}

    const cellHeight = layout.labelHeight + layout.imageHeight;
    const rows = Math.ceil(evidence.length / columns);
    const width = columns * layout.cellWidth + (columns - 1) * layout.gap;
    const height = rows * cellHeight + Math.max(0, rows - 1) * layout.gap;
    const composites: OverlayOptions[] = [];

    for (const [index, item] of evidence.entries()) {
      const metadata = input.images.get(item.imageId);
      if (!metadata) throw new Error(`Missing metadata for image ${item.imageId}`);
      const object = await input.store.get(metadata.key);
      const screenshot = await sharp(object.body)
        .rotate()
        .resize({
          width: layout.cellWidth,
          height: layout.imageHeight,
          fit: "contain",
          background: { r: 246, g: 247, b: 249, alpha: 1 },
        })
        .png({ compressionLevel: 6, adaptiveFiltering: true })
        .toBuffer();
      const column = index % columns;
      const row = Math.floor(index / columns);
      const left = column * (layout.cellWidth + layout.gap);
      const top = row * (cellHeight + layout.gap);
      composites.push(
        { input: evidenceLabel(item, layout.cellWidth, layout.labelHeight), left, top },
        { input: screenshot, left, top: top + layout.labelHeight },
      );
    }

    const buffer = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 229, g: 231, b: 235 },
      },
    })
      .composite(composites)
      .png({ compressionLevel: 6, adaptiveFiltering: true })
      .toBuffer();
    await writeFile(outputPath, buffer);
    return { path: outputPath, buffer, evidence, sheetNumber, columns };
  }));
}
