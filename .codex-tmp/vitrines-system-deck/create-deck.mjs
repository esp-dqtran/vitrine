import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { buildSlide01 } from "./template/slide-01.mjs";
import { buildSlide05 } from "./template/slide-05.mjs";
import { buildSlide13 } from "./template/slide-13.mjs";
import { buildSlide18 } from "./template/slide-18.mjs";
import { buildSlide26 } from "./template/slide-26.mjs";

const outputDir = "/Users/kai/works/eastplayers/Astryx/.codex-tmp/vitrines-system-deck/output";
const finalPptx = "/Users/kai/works/eastplayers/Astryx/Vitrines-system-overview.pptx";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addNotes(slide, sources) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n${sources.map((source) => `- ${source}`).join("\n")}`);
  slide.speakerNotes.setVisible(true);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  const cover = buildSlide01(presentation, {
    title: "VITRINES · SYSTEM OVERVIEW",
    title2: "A research system for product experiences",
    title3: "How discovery, evidence, collaboration, and delivery work together",
  });
  addNotes(cover, ["Internal Vitrines repository inspection, 2026-08-11."]);

  const product = buildSlide13(presentation, {
    title: "Vitrines connects four jobs into one product loop",
    footer1: "2",
    body1: {
      titleGoesHere: "Discover",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Browse a catalog of apps, sites, screens, and flows as reusable reference material.",
    },
    body2: {
      titleGoesHere: "Investigate",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Inspect the evidence behind an interface—not just a final screenshot or summary.",
    },
    body3: {
      titleGoesHere: "Shape",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Turn references into research projects, feature documents, and collaborative working space.",
    },
    body4: {
      titleGoesHere: "Govern",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Use accounts, roles, billing, and controlled exports to keep access aligned with the work.",
    },
  });
  addNotes(product, ["src/vitrine/router.ts", "src/vitrine/main.tsx", "src/vitrine/authApi.ts"]);

  const evidence = buildSlide18(presentation, {
    title: "Live experiences become durable, evidence-backed flows",
    footer1: "3",
    body1: {
      titleHere: "Plan",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "A crawl flow defines start points, locators, expected states, and a safety classification for each action.",
    },
    body2: {
      titleHere: "Observe",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Execution records the action, URL, visible UI and system feedback, plus a confidence signal.",
    },
    body3: {
      titleHere: "Publish",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Validated, pinned observations are assembled into ordered canonical flows for people and downstream features.",
    },
    label1: "Reviewed scope",
    label2: "Durable evidence",
    label3: "Reusable flows",
  });
  addNotes(evidence, ["src/crawlPlan.ts", "src/crawlRun.ts", "src/flowPreparation.ts"]);

  const architecture = buildSlide13(presentation, {
    title: "The runtime is deliberately split by responsibility",
    footer1: "4",
    body1: {
      titleGoesHere: "Experience",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "A Vite frontend presents catalog, research, projects, flows, sites, and the shared design system.",
    },
    body2: {
      titleGoesHere: "Edge",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Cloudflare serves static assets, proxies same-origin /api requests, and can serve crawled media through its binding.",
    },
    body3: {
      titleGoesHere: "Core API",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "The Node API provides the product’s authenticated routes, catalog and project operations, crawl control, and billing integration.",
    },
    body4: {
      titleGoesHere: "State & media",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "PostgreSQL stores application records while object storage holds durable screenshots and captured media.",
    },
  });
  addNotes(architecture, ["src/cloudflareFrontendWorker.ts", "package.json", "src/objectGc.ts", "AGENTS.md"]);

  const control = buildSlide05(presentation, {
    title: "Safety and release controls keep the system explainable",
    footer1: "5",
    body1: {
      titleHere: "At run time",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Crawl actions separate read-only work from side effects. Unsafe flows require an explicit test-account guard, protecting against accidental real-world changes.",
    },
    body2: {
      titleHere: "At release time",
      loremIpsumDolorSitAmetConsecteturAdipiscing: "Production releases start from committed main, validate migration parity and environment requirements, and verify health before the public endpoints are checked.",
    },
  });
  addNotes(control, ["src/crawlPlan.ts", "AGENTS.md: Production deployment"]);

  const close = buildSlide26(presentation, {
    title: "VITRINES",
    title2: "Evidence is the system’s unit of trust.",
    title3: {
      loremIpsumDetails: "Discover",
      loremIpsumDetails2: "Understand",
      loremIpsumDetails3: "Build with confidence",
    },
  });
  addNotes(close, ["Internal Vitrines repository inspection, 2026-08-11."]);

  for (const [index, slide] of presentation.slides.items.entries()) {
    const number = String(index + 1).padStart(2, "0");
    await writeBlob(`${outputDir}/slide-${number}.png`, await presentation.export({ slide, format: "png", scale: 2 }));
    await fs.writeFile(`${outputDir}/slide-${number}.layout.json`, await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(`${outputDir}/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
  await fs.writeFile(`${outputDir}/inspect.ndjson`, (await presentation.inspect({ kind: "slide,textbox,shape,table,chart,notes", maxChars: 20000 })).ndjson);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
