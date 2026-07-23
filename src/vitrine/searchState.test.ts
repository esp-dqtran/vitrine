import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearRecentSearches,
  defaultSearchState,
  parseSearchState,
  readRecentSearches,
  recordRecentSearch,
  serializeSearchState,
} from "./searchState.ts";

test("round trips canonical multi-select search state", () => {
  const state = parseSearchState(
    "?q=dark+checkout&platform=ios&platform=android&sort=recent",
  );
  assert.equal(
    serializeSearchState(state),
    "q=dark+checkout&platform=android&platform=ios&sort=recent",
  );
});

test("does not encode the pagination cursor in the URL", () => {
  assert.equal(
    serializeSearchState({ ...defaultSearchState, cursor: "secret" } as never),
    "",
  );
});

test("keeps ten unique recent submitted searches and tolerates corrupt storage", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: () => null,
    length: 0,
  } satisfies Storage;
  for (let index = 0; index < 12; index += 1) {
    recordRecentSearch(storage, `Query ${index}`);
  }
  recordRecentSearch(storage, "Query 5");
  assert.equal(readRecentSearches(storage).length, 10);
  assert.equal(readRecentSearches(storage)[0], "Query 5");
  values.set("astryx:recent-searches:v1", "{bad");
  assert.deepEqual(readRecentSearches(storage), []);
  clearRecentSearches(storage);
  assert.deepEqual(readRecentSearches(storage), []);
});
