import { useEffect, useRef, useState } from "react";
import type { DesignSystemSnapshot, EvidenceView } from "../designSystem";
import type { Platform } from "../platformFromUrl";
import { createDesignSystemStore, type DesignSystemStore } from "./designSystemStore.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function loadDesignSystem(
  appId: string,
  platform: Platform,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
  version?: number,
): Promise<DesignSystemSnapshot<EvidenceView> | null> {
  const response = await fetcher(`/api/design-systems/${appId}?platform=${platform}${version ? `&version=${version}` : ''}`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Design system returned ${response.status}`);
  return response.json() as Promise<DesignSystemSnapshot<EvidenceView>>;
}

export function useDesignSystem(appId: string, platform: Platform, version?: number, enabled = true) {
  const storeRef = useRef<DesignSystemStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createDesignSystemStore((key, signal) =>
      loadDesignSystem(key.appId, key.platform, signal, fetch, key.version));
  }
  const store = storeRef.current;
  const [, render] = useState(0);
  const key = { appId, platform, version };

  useEffect(() => store.subscribe(() => render((value) => value + 1)), [store]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void store.load(key, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [appId, enabled, platform, version, store]);

  const state = store.get(key);
  return {
    snapshot: state.snapshot,
    status: state.status === "idle" ? "loading" as const : state.status,
    error: state.error,
    retry: () => store.retry(key),
    reload: () => store.reload(key),
    invalidate: () => store.invalidate((candidate) => candidate === `${appId}|${platform}|${version ?? 'latest'}`),
  };
}
