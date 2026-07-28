import type { FlowAnalysisProvider } from "./runner-config.ts";

export interface ProviderLane<T> {
  provider: FlowAnalysisProvider;
  items: T[];
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function providerForFlow(
  key: string,
  providers: readonly FlowAnalysisProvider[],
): FlowAnalysisProvider {
  if (providers.length === 0) throw new Error("At least one Flow analysis provider is required");
  return providers[stableHash(key) % providers.length];
}

export function distributeFlowWork<T>(
  items: readonly T[],
  providers: readonly FlowAnalysisProvider[],
  key: (item: T) => string,
): ProviderLane<T>[] {
  const lanes = new Map<FlowAnalysisProvider, T[]>(
    providers.map((provider) => [provider, []]),
  );
  for (const item of items) {
    lanes.get(providerForFlow(key(item), providers))!.push(item);
  }
  return providers.map((provider) => ({
    provider,
    items: lanes.get(provider)!,
  }));
}

export async function runProviderLanes<T>(
  lanes: readonly ProviderLane<T>[],
  run: (lane: ProviderLane<T>) => Promise<void>,
): Promise<void> {
  const results = await Promise.allSettled(
    lanes.filter(({ items }) => items.length > 0).map(run),
  );
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected?.status === "rejected") throw rejected.reason;
}
