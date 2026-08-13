import type { Screen } from './types.ts';

export interface CanvasScreenInsertItem {
  appId: string;
  appName: string;
  screen: Screen;
}

export interface CanvasScreenInsertDestination {
  projectId: string;
  canvasId: string;
}

interface CanvasScreenInsertIntent {
  version: 1;
  items: CanvasScreenInsertItem[];
}

interface CanvasScreenInsertBatchIntent {
  version: 2;
  items: CanvasScreenInsertItem[];
  destinations: CanvasScreenInsertDestination[];
  cursor: number;
}

const keyPrefix = 'vitrines:canvas-screen-insert:';
const sharedScope = globalThis as typeof globalThis & {
  __vitrinesCanvasScreenInsertIntents?: Map<
    string,
    CanvasScreenInsertIntent | CanvasScreenInsertBatchIntent
  >;
};
const pendingIntents = sharedScope.__vitrinesCanvasScreenInsertIntents
  ??= new Map<string, CanvasScreenInsertIntent>();

const intentKey = (token: string) => `${keyPrefix}${token}`;

const isInsertItem = (value: unknown): value is CanvasScreenInsertItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CanvasScreenInsertItem>;
  return typeof item.appId === 'string'
    && typeof item.appName === 'string'
    && Boolean(item.screen)
    && typeof item.screen?.id === 'number'
    && typeof item.screen?.url === 'string';
};

const isDestination = (value: unknown): value is CanvasScreenInsertDestination => {
  if (!value || typeof value !== 'object') return false;
  const destination = value as Partial<CanvasScreenInsertDestination>;
  return typeof destination.projectId === 'string'
    && typeof destination.canvasId === 'string';
};

export function storeCanvasScreenInsertIntent(
  items: readonly CanvasScreenInsertItem[],
  storage: Pick<Storage, 'setItem'> = window.sessionStorage,
): string {
  const token = crypto.randomUUID();
  const intent: CanvasScreenInsertIntent = {
    version: 1,
    items: items.filter(isInsertItem),
  };
  pendingIntents.set(token, intent);
  storage.setItem(intentKey(token), JSON.stringify(intent));
  return token;
}

export function consumeCanvasScreenInsertIntent(
  token: string,
  storage: Pick<Storage, 'getItem' | 'removeItem'> = window.sessionStorage,
): CanvasScreenInsertItem[] {
  const key = intentKey(token);
  const pending = pendingIntents.get(token);
  pendingIntents.delete(token);
  const raw = pending ? JSON.stringify(pending) : storage.getItem(key);
  storage.removeItem(key);
  if (!raw) return [];
  try {
    const intent = JSON.parse(raw) as Partial<CanvasScreenInsertIntent>;
    return intent.version === 1 && Array.isArray(intent.items)
      ? intent.items.filter(isInsertItem)
      : [];
  } catch {
    return [];
  }
}

export function storeCanvasScreenInsertBatch(
  items: readonly CanvasScreenInsertItem[],
  destinations: readonly CanvasScreenInsertDestination[],
  storage: Pick<Storage, 'setItem'> = window.sessionStorage,
): string {
  const token = crypto.randomUUID();
  const uniqueDestinations = [...new Map(
    destinations
      .filter(isDestination)
      .map((destination) => [`${destination.projectId}:${destination.canvasId}`, destination]),
  ).values()];
  const intent: CanvasScreenInsertBatchIntent = {
    version: 2,
    items: items.filter(isInsertItem),
    destinations: uniqueDestinations,
    cursor: 0,
  };
  pendingIntents.set(token, intent);
  storage.setItem(intentKey(token), JSON.stringify(intent));
  return token;
}

export function consumeCanvasScreenInsertBatch(
  token: string,
  current: CanvasScreenInsertDestination,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.sessionStorage,
): { items: CanvasScreenInsertItem[]; next: CanvasScreenInsertDestination | undefined } | undefined {
  const key = intentKey(token);
  const pending = pendingIntents.get(token);
  const raw = pending ? JSON.stringify(pending) : storage.getItem(key);
  if (!raw) return undefined;
  try {
    const intent = JSON.parse(raw) as Partial<CanvasScreenInsertBatchIntent>;
    if (
      intent.version !== 2
      || !Array.isArray(intent.items)
      || !Array.isArray(intent.destinations)
      || typeof intent.cursor !== 'number'
    ) return undefined;
    const destinations = intent.destinations.filter(isDestination);
    const destination = destinations[intent.cursor];
    if (!destination || destination.projectId !== current.projectId || destination.canvasId !== current.canvasId) {
      return undefined;
    }
    const next = destinations[intent.cursor + 1];
    if (next) {
      const advanced: CanvasScreenInsertBatchIntent = {
        version: 2,
        items: intent.items.filter(isInsertItem),
        destinations,
        cursor: intent.cursor + 1,
      };
      pendingIntents.set(token, advanced);
      storage.setItem(key, JSON.stringify(advanced));
    } else {
      pendingIntents.delete(token);
      storage.removeItem(key);
    }
    return { items: intent.items.filter(isInsertItem), next };
  } catch {
    return undefined;
  }
}
