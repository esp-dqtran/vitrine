import type { ObjectStore } from "./objectStore.ts";

export async function verifyObjectStoreReady(objectStore: ObjectStore): Promise<void> {
  try {
    const iterator = objectStore.list()[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
  } catch {
    throw new Error("Object storage is unavailable");
  }
}
