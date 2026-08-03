export interface ObjectInventoryEntry {
  key: string;
  byteSize: number;
}

export interface ObjectInventorySizeMismatch {
  key: string;
  databaseBytes: number;
  bucketBytes: number;
}

export interface ObjectInventoryReport {
  databaseObjects: number;
  databaseBytes: number;
  bucketObjects: number;
  bucketBytes: number;
  matchedObjects: number;
  matchedBytes: number;
  missingObjects: number;
  unexpectedObjects: number;
  sizeMismatches: number;
  missingSamples: string[];
  unexpectedSamples: string[];
  sizeMismatchSamples: ObjectInventorySizeMismatch[];
}

type Side = "database" | "bucket";

interface InventoryState {
  previousKey?: string;
  objects: number;
  bytes: number;
}

function validateEntry(entry: ObjectInventoryEntry, side: Side, state: InventoryState): void {
  if (!entry.key || entry.key.includes("\0")) throw new Error(`${side}_inventory_key_invalid`);
  if (!Number.isSafeInteger(entry.byteSize) || entry.byteSize < 0) {
    throw new Error(`${side}_inventory_size_invalid`);
  }
  if (state.previousKey !== undefined && entry.key <= state.previousKey) {
    throw new Error(`${side}_inventory_not_strictly_sorted`);
  }
}

async function nextEntry(
  iterator: AsyncIterator<ObjectInventoryEntry>,
  side: Side,
  state: InventoryState,
): Promise<ObjectInventoryEntry | undefined> {
  const result = await iterator.next();
  if (result.done) return undefined;
  validateEntry(result.value, side, state);
  state.previousKey = result.value.key;
  state.objects += 1;
  state.bytes += result.value.byteSize;
  if (!Number.isSafeInteger(state.bytes)) throw new Error(`${side}_inventory_bytes_invalid`);
  return result.value;
}

export async function reconcileObjectInventories(
  database: AsyncIterable<ObjectInventoryEntry>,
  bucket: AsyncIterable<ObjectInventoryEntry>,
  sampleLimit = 20,
): Promise<ObjectInventoryReport> {
  if (!Number.isSafeInteger(sampleLimit) || sampleLimit < 0 || sampleLimit > 100) {
    throw new Error("sample_limit_invalid");
  }

  const databaseState: InventoryState = { objects: 0, bytes: 0 };
  const bucketState: InventoryState = { objects: 0, bytes: 0 };
  const databaseIterator = database[Symbol.asyncIterator]();
  const bucketIterator = bucket[Symbol.asyncIterator]();
  let expected = await nextEntry(databaseIterator, "database", databaseState);
  let actual = await nextEntry(bucketIterator, "bucket", bucketState);
  let matchedObjects = 0;
  let matchedBytes = 0;
  let missingObjects = 0;
  let unexpectedObjects = 0;
  let sizeMismatches = 0;
  const missingSamples: string[] = [];
  const unexpectedSamples: string[] = [];
  const sizeMismatchSamples: ObjectInventorySizeMismatch[] = [];

  while (expected || actual) {
    if (!actual || (expected && expected.key < actual.key)) {
      missingObjects += 1;
      if (missingSamples.length < sampleLimit) missingSamples.push(expected!.key);
      expected = await nextEntry(databaseIterator, "database", databaseState);
      continue;
    }
    if (!expected || actual.key < expected.key) {
      unexpectedObjects += 1;
      if (unexpectedSamples.length < sampleLimit) unexpectedSamples.push(actual.key);
      actual = await nextEntry(bucketIterator, "bucket", bucketState);
      continue;
    }

    matchedObjects += 1;
    matchedBytes += expected.byteSize;
    if (!Number.isSafeInteger(matchedBytes)) throw new Error("matched_inventory_bytes_invalid");
    if (expected.byteSize !== actual.byteSize) {
      sizeMismatches += 1;
      if (sizeMismatchSamples.length < sampleLimit) {
        sizeMismatchSamples.push({
          key: expected.key,
          databaseBytes: expected.byteSize,
          bucketBytes: actual.byteSize,
        });
      }
    }
    expected = await nextEntry(databaseIterator, "database", databaseState);
    actual = await nextEntry(bucketIterator, "bucket", bucketState);
  }

  return {
    databaseObjects: databaseState.objects,
    databaseBytes: databaseState.bytes,
    bucketObjects: bucketState.objects,
    bucketBytes: bucketState.bytes,
    matchedObjects,
    matchedBytes,
    missingObjects,
    unexpectedObjects,
    sizeMismatches,
    missingSamples,
    unexpectedSamples,
    sizeMismatchSamples,
  };
}

export function objectInventoriesMatch(report: ObjectInventoryReport): boolean {
  return report.missingObjects === 0
    && report.unexpectedObjects === 0
    && report.sizeMismatches === 0;
}
