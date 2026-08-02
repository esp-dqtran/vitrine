import assert from "node:assert/strict";
import { test } from "node:test";

import { projectDocumentAllowedOrigins } from "./config.ts";

test("allows local project document collaboration during development", () => {
  assert.deepEqual([...projectDocumentAllowedOrigins({ NODE_ENV: "development" })], []);
});

test("normalizes explicit project document collaboration origins", () => {
  assert.deepEqual([...projectDocumentAllowedOrigins({
    PROJECT_DOCUMENT_COLLAB_ALLOWED_ORIGINS:
      "https://astryx.design/projects, http://localhost:5173",
  })], ["https://astryx.design", "http://localhost:5173"]);
});

test("fails closed around the application origin in production", () => {
  assert.deepEqual([...projectDocumentAllowedOrigins({
    NODE_ENV: "production",
    APP_URL: "https://app.astryx.design/projects",
  })], ["https://app.astryx.design"]);
  assert.throws(
    () => projectDocumentAllowedOrigins({ NODE_ENV: "production" }),
    /APP_URL or PROJECT_DOCUMENT_COLLAB_ALLOWED_ORIGINS is required/,
  );
});
