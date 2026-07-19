import { useEffect, useState } from "react";
import type { DesignSystemSnapshot, EvidenceView } from "../designSystem";
import type { Platform } from "../platformFromUrl";

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
  const [snapshot, setSnapshot] = useState<DesignSystemSnapshot<EvidenceView> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      setStatus("loading");
      return;
    }
    const controller = new AbortController();
    setSnapshot(null);
    setStatus("loading");
    loadDesignSystem(appId, platform, controller.signal, fetch, version)
      .then((result) => {
        if (result) {
          setSnapshot(result);
          setStatus("ready");
        } else {
          setStatus("missing");
        }
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [appId, enabled, platform, version]);

  return { snapshot, status };
}
