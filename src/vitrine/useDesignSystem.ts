import { useEffect, useState } from "react";
import type { DesignSystemSnapshot, EvidenceView } from "../designSystem";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function loadDesignSystem(
  appId: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<DesignSystemSnapshot<EvidenceView> | null> {
  const response = await fetcher(`/api/design-systems/${appId}`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Design system returned ${response.status}`);
  return response.json() as Promise<DesignSystemSnapshot<EvidenceView>>;
}

export function useDesignSystem(appId: string) {
  const [snapshot, setSnapshot] = useState<DesignSystemSnapshot<EvidenceView> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null);
    setStatus("loading");
    loadDesignSystem(appId, controller.signal)
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
  }, [appId]);

  return { snapshot, status };
}
