import { consumeJobs } from "../../../src/queue.ts";
import { createPipelineHandler } from "./pipeline.ts";

console.log("[import-worker] Waiting for jobs...");
await consumeJobs(createPipelineHandler());
