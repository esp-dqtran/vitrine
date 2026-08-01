import assert from "node:assert/strict";
import test from "node:test";

import { projectDocumentMentionUsers } from "./projectDocumentMentions.ts";

const users = [
  { id: 10, email: "admin@localhost.test" },
  { id: 11, email: "designer@example.com" },
];

test("offers durable mail links for inline user mentions", () => {
  assert.deepEqual(projectDocumentMentionUsers("", users), [
    {
      id: 10,
      email: "admin@localhost.test",
      label: "@admin@localhost.test",
      link: "mailto:admin@localhost.test",
    },
    {
      id: 11,
      email: "designer@example.com",
      label: "@designer@example.com",
      link: "mailto:designer@example.com",
    },
  ]);
});

test("filters user mentions by email or local name", () => {
  assert.deepEqual(
    projectDocumentMentionUsers("DESIGN", users).map((user) => user.id),
    [11],
  );
  assert.deepEqual(
    projectDocumentMentionUsers("localhost", users).map((user) => user.id),
    [10],
  );
});
