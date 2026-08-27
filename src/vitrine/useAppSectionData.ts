import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppVersion } from '../db';
import type { Platform } from '../platformFromUrl';
import { createAppSectionStore, type AppDataSection, type AppSectionKey } from './appSectionStore.ts';
import { listAppVersions } from './researchApi.ts';

export type DetailSection = 'screens' | 'elements' | 'flows' | 'design-system' | 'export';
export type DataDependency = 'versions' | 'screens' | 'ui-elements' | 'flows' | 'design-system';

export function sectionDependencies(section: DetailSection): DataDependency[] {
  switch (section) {
    case 'screens': return ['versions', 'screens'];
    case 'elements': return ['versions', 'ui-elements'];
    case 'flows': return ['versions', 'flows'];
    case 'design-system': return ['versions', 'design-system'];
    case 'export': return ['versions', 'design-system', 'screens'];
  }
}

function activeDataSection(section: DetailSection): AppDataSection | null {
  if (section === 'screens' || section === 'export') return 'screens';
  if (section === 'elements') return 'ui-elements';
  if (section === 'flows') return 'flows';
  return null;
}

export function activeAppSectionKey(input: {
  appId: string;
  activeSection: DetailSection;
  platform: Platform;
  selectedVersion?: number;
  screenTypes?: string[];
  flowTitles?: string[];
  versions: AppVersion[] | null;
}): AppSectionKey | null {
  const section = activeDataSection(input.activeSection);
  return section ? {
    appId: input.appId,
    section,
    platform: input.platform,
    version: input.selectedVersion ?? 'latest',
    ...(section === 'screens' && input.screenTypes?.length
      ? { screenTypes: input.screenTypes }
      : {}),
    ...(section === 'screens' && input.flowTitles?.length
      ? { flowTitles: input.flowTitles }
      : {}),
  } : null;
}

export function useAppSectionData(input: {
  appId: string;
  activeSection: DetailSection;
  platform: Platform;
  selectedVersion?: number;
  screenTypes?: string[];
  flowTitles?: string[];
}) {
  const storeRef = useRef<ReturnType<typeof createAppSectionStore> | null>(null);
  if (!storeRef.current) storeRef.current = createAppSectionStore();
  const store = storeRef.current;
  const versionsRef = useRef(new Map<string, AppVersion[]>());
  const [, render] = useState(0);
  const dependencies = sectionDependencies(input.activeSection);
  const versionsKey = `${input.appId}|${input.platform}`;
  const versions = versionsRef.current.get(versionsKey) ?? null;
  const needsVersions = dependencies.includes('versions');

  useEffect(() => store.subscribe(() => render((value) => value + 1)), [store]);

  useEffect(() => {
    if (!needsVersions || versionsRef.current.has(versionsKey)) return;
    const controller = new AbortController();
    void listAppVersions(input.appId, input.platform, controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      versionsRef.current.set(versionsKey, items);
      render((value) => value + 1);
    }).catch((error: Error) => {
      if (error.name !== 'AbortError') {
        versionsRef.current.set(versionsKey, []);
        render((value) => value + 1);
      }
    });
    return () => controller.abort();
  }, [input.appId, input.platform, needsVersions, versionsKey]);

  const resolvedVersion = input.selectedVersion
    ?? versions?.find(({ status }) => status === 'published')?.version_number
    ?? versions?.[0]?.version_number;
  const activeKey = useMemo<AppSectionKey | null>(() => activeAppSectionKey({
    ...input,
    versions,
  }), [
    input.appId,
    input.activeSection,
    input.platform,
    input.selectedVersion,
    input.screenTypes,
    input.flowTitles,
    versions,
  ]);

  useEffect(() => {
    if (!activeKey) return;
    const controller = new AbortController();
    void store.load(activeKey, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [
    activeKey?.appId,
    activeKey?.platform,
    activeKey?.section,
    activeKey?.version,
    activeKey?.screenTypes?.join(','),
    activeKey?.flowTitles?.join(','),
    store,
  ]);

  const state = activeKey ? store.get(activeKey) : { status: 'idle' as const, data: null, error: null };
  const setVersions = useCallback((items: AppVersion[]) => {
    versionsRef.current.set(versionsKey, items);
    render((value) => value + 1);
  }, [versionsKey]);

  return {
    versions,
    versionsLoading: needsVersions && versions === null,
    resolvedVersion,
    state,
    loadNext: () => activeKey ? store.loadNext(activeKey) : Promise.resolve(null),
    retry: () => activeKey ? store.retry(activeKey) : Promise.resolve(null),
    refreshApp: async () => {
      store.invalidate((key) => key.startsWith(`${input.appId}|`));
      const items = await listAppVersions(input.appId, input.platform);
      setVersions(items);
      return items;
    },
    setVersions,
    invalidateVersion: (platform: Platform, version: number) =>
      store.invalidate((key) => key.startsWith(`${input.appId}|`) && key.includes(`|${platform}|${version}`)),
  };
}
