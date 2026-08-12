// Collections is available by default and can be temporarily hidden through the
// deployment environment without removing its routes or stored data.
export const collectionsEnabled =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_COLLECTIONS_ENABLED !== "false";
