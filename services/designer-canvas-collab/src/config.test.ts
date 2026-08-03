import assert from "node:assert/strict";
import { test } from "node:test";
import { designerCanvasAllowedOrigins } from "./config.ts";

test("allows the active loopback origin during development", () => {
  assert.deepEqual([...designerCanvasAllowedOrigins({ NODE_ENV: "development" })], []);
});

test("normalizes explicit collaboration origins", () => {
  assert.deepEqual([...designerCanvasAllowedOrigins({
    CANVAS_COLLAB_ALLOWED_ORIGINS: "https://astryx.design/path, http://localhost:5174",
  })], ["https://astryx.design", "http://localhost:5174"]);
});

test("fails closed around the application origin in production", () => {
  assert.deepEqual([...designerCanvasAllowedOrigins({
    NODE_ENV: "production",
    APP_URL: "https://app.astryx.design/projects",
  })], ["https://app.astryx.design"]);
  assert.throws(
    () => designerCanvasAllowedOrigins({ NODE_ENV: "production" }),
    /APP_URL or CANVAS_COLLAB_ALLOWED_ORIGINS is required/,
  );
});
