// Audits every "done" catalog-import job against its own crawl log: flags any job where
// the crawler's self-reported numbers show it came up short (fewer cards selected than
// Mobbin showed, or fewer flows imported than discovered) — signals a job was marked
// "done" without actually capturing everything.
import { readFileSync, existsSync } from "node:fs";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Job {
  platform: string;
  appName: string;
  slug: string;
  status: string;
}

interface Flag {
  worker: string;
  slug: string;
  platform: string;
  appName: string;
  issue: string;
}

const flags: Flag[] = [];
let checked = 0;

for (const w of ["1", "2", "3", "4"]) {
  const statePath = `data/catalog-import-state-${w}.json`;
  const logPath = `data/logs/catalog-import-${w}.log`;
  if (!existsSync(statePath) || !existsSync(logPath)) continue;

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const logLines = readFileSync(logPath, "utf8").split("\n");
  const doneJobs: Job[] = state.jobs.filter((j: Job) => j.status === "done");

  for (const job of doneJobs) {
    checked++;
    const importRe = new RegExp(`w${w}:Importing "${escapeRegex(job.appName)}" \\(${job.platform}\\)`);
    let startIdx = -1;
    for (let i = logLines.length - 1; i >= 0; i--) {
      if (importRe.test(logLines[i])) { startIdx = i; break; }
    }
    if (startIdx === -1) {
      flags.push({ worker: w, slug: job.slug, platform: job.platform, appName: job.appName, issue: "no log segment found for this job" });
      continue;
    }
    let endIdx = logLines.length;
    for (let i = startIdx + 1; i < logLines.length; i++) {
      if (/w\d:(Importing|Batch run complete)/.test(logLines[i])) { endIdx = i; break; }
    }
    const segment = logLines.slice(startIdx, endIdx);

    // The retry-until-stable selection pass logs "Pass 1: selected X of Y ..." then
    // "Pass 2: ...", etc. — take the LAST "Pass N: selected" line in the segment (the
    // final, most-complete count) rather than the first.
    let lastSelMatch: RegExpMatchArray | null = null;
    for (const line of segment) {
      const selMatch = line.match(/Pass \d+: selected (\d+) of (\d+) (screens|UI elements)/);
      if (selMatch) lastSelMatch = selMatch;
    }
    if (lastSelMatch) {
      const [, sel, tot, label] = lastSelMatch;
      if (Number(sel) < Number(tot)) {
        flags.push({ worker: w, slug: job.slug, platform: job.platform, appName: job.appName, issue: `${label}: selected ${sel}/${tot}` });
      }
    }
    for (const line of segment) {
      const flowMatch = line.match(/Imported (\d+)\/(\d+) flow\(s\)/);
      if (flowMatch) {
        const [, imp, disc] = flowMatch;
        if (Number(imp) < Number(disc)) {
          flags.push({ worker: w, slug: job.slug, platform: job.platform, appName: job.appName, issue: `flows: imported ${imp}/${disc}` });
        }
      }
    }
  }
}

console.log(`Checked ${checked} done jobs across 4 workers.`);
console.log(`Flagged ${flags.length} job(s) with a possible miss:\n`);
for (const f of flags) {
  console.log(`  w${f.worker} ${f.appName} (${f.platform}) [${f.slug}]: ${f.issue}`);
}
