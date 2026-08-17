import { parseArgs } from "node:util";
import {
  researchDossierWithKiro,
  writeLocalFlowResearchMarkdown,
} from "../src/autonomousResearch.ts";

function usage(): never {
  throw new Error("Usage: npx tsx scripts/research-stage-one-local.ts --url https://example.com [--app example] [--flow flow-id] [--data-dir data]");
}

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    app: { type: "string" },
    flow: { type: "string" },
    "data-dir": { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});
if (values.help) {
  console.log("Usage: npx tsx scripts/research-stage-one-local.ts --url https://example.com [--app example] [--flow flow-id] [--data-dir data]");
  process.exit(0);
}
if (!values.url) usage();

const homepage = new URL(values.url);
if (!/^https?:$/.test(homepage.protocol)) throw new Error("--url must use http or https");
const app = values.app?.trim() || homepage.hostname.replace(/^www\./, "").split(".")[0];
const dossier = await researchDossierWithKiro({ app, homepageUrl: homepage.toString() });
const flow = values.flow
  ? dossier.candidateFlows.find(({ id }) => id === values.flow)
  : dossier.candidateFlows.find(({ readiness, mode }) => readiness === "ready" && mode === "read") ?? dossier.candidateFlows[0];
if (!flow) throw new Error("Kiro research returned no candidate flows; no Markdown was written");

const path = writeLocalFlowResearchMarkdown(dossier, flow.id, values["data-dir"] || "data");
console.log(`Stage 1 research complete. Local Markdown handoff: ${path}`);
