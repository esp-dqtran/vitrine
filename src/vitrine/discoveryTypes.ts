import type { Platform } from '../platformFromUrl.ts';

export interface DiscoveryFilter {
  group: string;
  value: string;
}

export interface DiscoveryState<Sort extends string> {
  platform: Platform;
  sort: Sort;
  query: string;
  filters: DiscoveryFilter[];
}

export interface DiscoveryFacet {
  group: string;
  value: string;
  count: number;
  section?: string;
  description?: string;
  aliases?: string[];
  sectionPosition?: number;
  position?: number;
}

export interface DiscoveryPage<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
  facets: DiscoveryFacet[];
}

export interface DiscoveryAdapter<
  T,
  Sort extends string,
  State extends DiscoveryState<Sort> = DiscoveryState<Sort>,
> {
  defaults: State;
  parse(search: string): State;
  serialize(state: State): string;
  request(
    state: State,
    cursor: string | null,
    signal: AbortSignal,
  ): Promise<DiscoveryPage<T>>;
  itemKey(item: T): string;
}
