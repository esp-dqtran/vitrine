import type { ResearchCollection } from '../db.ts';
import type { SaveReference } from './researchApi.ts';

export const SAVED_COLLECTION_NAMES = new Set(['saved', 'all saved']);

export const isSavedCollection = (collection: Pick<ResearchCollection, 'name'>) =>
  SAVED_COLLECTION_NAMES.has(collection.name.trim().toLowerCase());

export const referenceMatchesCollectionItem = (
  reference: SaveReference,
  item: ResearchCollection['items'][number],
) => (
  item.kind === reference.kind
  && item.app === reference.app
  && item.reference_id === reference.referenceId
);

export const matchingCollectionItems = (
  collections: ResearchCollection[],
  reference: SaveReference,
) => collections.flatMap((collection) =>
  collection.items
    .filter((item) => referenceMatchesCollectionItem(reference, item))
    .map((item) => ({ collection, item })));

export const isReferenceSaved = (
  collections: ResearchCollection[],
  reference: SaveReference,
) => matchingCollectionItems(collections, reference).length > 0;

export const areReferencesSaved = (
  collections: ResearchCollection[],
  references: SaveReference[],
) => references.length > 0
  && references.every((reference) => isReferenceSaved(collections, reference));

export const dedupeSaveReferences = (references: SaveReference[]) => {
  const unique = new Map<string, SaveReference>();
  for (const reference of references) {
    unique.set(
      `${reference.kind}:${reference.app}:${reference.referenceId}`,
      reference,
    );
  }
  return [...unique.values()];
};

export const screenImageCopyUrl = (url: string) => {
  if (!url.startsWith('/api/media/')) return url;
  const target = new URL(url, 'http://localhost');
  target.searchParams.set('delivery', 'inline');
  return `${target.pathname}${target.search}${target.hash}`;
};

const fetchImageBlob = async (url: string) => {
  const response = await fetch(screenImageCopyUrl(url));
  if (!response.ok) {
    throw new Error(`Image copy failed with ${response.status}`);
  }
  return response.blob();
};

const canvasToBlob = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<Blob> => {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/png' });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode screen as PNG'));
    }, 'image/png');
  });
};

const createCanvas = (width: number, height: number) => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document === 'undefined') {
    throw new Error('PNG conversion is unavailable');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const imageToPng = async (blob: Blob) => {
  if (blob.type === 'image/png') return blob;
  if (typeof createImageBitmap === 'undefined') {
    throw new Error('PNG conversion is unavailable');
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = createCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG conversion is unavailable');
    context.drawImage(bitmap, 0, 0);
    return canvasToBlob(canvas);
  } finally {
    bitmap.close();
  }
};

const writePngToClipboard = async (blob: Blob) => {
  if (
    typeof navigator === 'undefined'
    || !navigator.clipboard?.write
    || typeof ClipboardItem === 'undefined'
  ) {
    throw new Error('Image clipboard is unavailable');
  }
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
};

export const copyScreenImageAsPng = async (url: string) => {
  const blob = await fetchImageBlob(url);
  await writePngToClipboard(await imageToPng(blob));
};

export const copyScreenImagesAsPng = async (urls: string[]) => {
  if (!urls.length) return;
  if (urls.length === 1) {
    await copyScreenImageAsPng(urls[0]);
    return;
  }
  if (typeof createImageBitmap === 'undefined') {
    throw new Error('PNG conversion is unavailable');
  }

  const bitmaps = await Promise.all(
    urls.map(async (url) => createImageBitmap(await fetchImageBlob(url))),
  );
  try {
    const maxTileHeight = 1200;
    const columns = Math.min(4, Math.ceil(Math.sqrt(bitmaps.length)));
    const rows = Math.ceil(bitmaps.length / columns);
    const gap = 24;
    const scaled = bitmaps.map((bitmap) => {
      const scale = Math.min(1, maxTileHeight / bitmap.height);
      return {
        bitmap,
        width: Math.max(1, Math.round(bitmap.width * scale)),
        height: Math.max(1, Math.round(bitmap.height * scale)),
      };
    });
    const tileWidth = Math.max(...scaled.map(({ width }) => width));
    const tileHeight = Math.max(...scaled.map(({ height }) => height));
    const rawWidth = columns * tileWidth + (columns - 1) * gap;
    const rawHeight = rows * tileHeight + (rows - 1) * gap;
    const fitScale = Math.min(1, 8192 / rawWidth, 8192 / rawHeight);
    const canvas = createCanvas(
      Math.max(1, Math.round(rawWidth * fitScale)),
      Math.max(1, Math.round(rawHeight * fitScale)),
    );
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG conversion is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    scaled.forEach(({ bitmap, width, height }, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = (column * (tileWidth + gap) + (tileWidth - width) / 2) * fitScale;
      const y = (row * (tileHeight + gap) + (tileHeight - height) / 2) * fitScale;
      context.drawImage(
        bitmap,
        x,
        y,
        width * fitScale,
        height * fitScale,
      );
    });
    await writePngToClipboard(await canvasToBlob(canvas));
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
};

export const copyShareLink = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard is unavailable');
  }
  await navigator.clipboard.writeText(value);
};

export const flowShareUrl = (
  pageUrl: string,
  flowId: string,
  screenIndex = 0,
) => {
  const url = new URL(pageUrl);
  url.searchParams.set('flow', flowId);
  url.searchParams.set('tab', 'screens');
  url.searchParams.set('screen', String(Math.max(0, screenIndex)));
  return url.toString();
};
