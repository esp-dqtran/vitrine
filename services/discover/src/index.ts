import express from "express";
import { publishJob } from "../../../src/queue.ts";

const PORT = Number(process.env.PORT ?? 3001);
const app = express();

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Doesn't touch Playwright itself — only import-worker ever holds the Mobbin browser
// session. This just enqueues a job; the worker does the actual discovery scroll+scrape.
app.post("/trigger", async (_req, res) => {
  await publishJob({ type: "discover-catalog" });
  res.status(202).json({ status: "queued" });
});

app.listen(PORT, () => console.log(`[discover] listening on :${PORT}`));
