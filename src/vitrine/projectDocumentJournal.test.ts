import assert from "node:assert/strict";
import test from "node:test";

import { projectDocumentMentionDates } from "./projectDocumentJournal.ts";

test("offers relative and upcoming dates for inline Journal mentions", () => {
  const dates = projectDocumentMentionDates(
    "",
    new Date("2026-07-31T12:00:00"),
  );

  assert.deepEqual(dates.slice(0, 3), [
    { dateKey: "2026-07-31", label: "Today", suffix: "Jul 31, 2026" },
    { dateKey: "2026-08-01", label: "Tomorrow", suffix: "Aug 1, 2026" },
    { dateKey: "2026-07-30", label: "Yesterday", suffix: "Jul 30, 2026" },
  ]);
  assert.equal(dates.length, 9);
});

test("finds a typed date outside the upcoming date window", () => {
  assert.deepEqual(
    projectDocumentMentionDates(
      "2026-12-24",
      new Date("2026-07-31T12:00:00"),
    ),
    [
      {
        dateKey: "2026-12-24",
        label: "Thursday",
        suffix: "Dec 24, 2026",
      },
    ],
  );
});

test("filters date mentions by relative label and formatted date", () => {
  const value = new Date("2026-07-31T12:00:00");
  assert.equal(
    projectDocumentMentionDates("tomorrow", value)[0]?.dateKey,
    "2026-08-01",
  );
  assert.equal(
    projectDocumentMentionDates("aug 3", value)[0]?.dateKey,
    "2026-08-03",
  );
});
