import { test } from "node:test";
import assert from "node:assert/strict";
import { subscribeToProgress, type ProgressEventSource } from "./useProgress.ts";
import type { ProgressSnapshot } from "./types.ts";

class FakeEventSource implements ProgressEventSource {
  closed = false;
  private listeners = new Map<string, (event: MessageEvent<string>) => void>();

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener as (event: MessageEvent<string>) => void);
  }

  emit(type: string, data: string): void {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }

  close(): void {
    this.closed = true;
  }
}

test("subscribes to pushed progress, ignores invalid events, and closes cleanly", () => {
  const updates: ProgressSnapshot[] = [];
  const source = new FakeEventSource();
  let openedUrl = "";
  const close = subscribeToProgress(
    (snapshot) => updates.push(snapshot),
    (url) => {
      openedUrl = url;
      return source;
    },
  );
  const snapshot: ProgressSnapshot = {
    entries: [{
      id: "worker:1",
      stage: "smart-crawl",
      app: "linear",
      done: 2,
      total: 4,
      status: "running",
      message: "Downloading",
      updatedAt: "2026-07-19T00:00:00.000Z",
    }],
  };

  source.emit("progress", JSON.stringify(snapshot));
  source.emit("progress", "{broken");
  source.emit("progress", JSON.stringify({ entries: [{ app: "missing-fields" }] }));

  assert.equal(openedUrl, "/api/progress/stream");
  assert.deepEqual(updates, [snapshot]);
  close();
  assert.equal(source.closed, true);
});
