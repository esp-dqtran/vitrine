// Runs `worker` over `items` using a fixed pool of `lanes`, each lane pulling the next
// item off a shared cursor as soon as it's free — no library, just a shared index closure.
// `shouldStop` is checked between items so a lane finishes its current item before exiting.
export async function runPool<T, L>(
  items: T[],
  lanes: L[],
  worker: (lane: L, item: T) => Promise<void>,
  shouldStop?: () => boolean
): Promise<void> {
  let next = 0;
  await Promise.all(
    lanes.map(async (lane) => {
      while (next < items.length && !shouldStop?.()) {
        const item = items[next++];
        await worker(lane, item);
      }
    })
  );
}
