import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const outputDir = "/Users/kai/works/eastplayers/Astryx/.codex-tmp/vitrines-system-deck/refresh-output";
const finalPptx = "/Users/kai/works/eastplayers/Astryx/Vitrines-system-overview.pptx";
const W = 1280;
const H = 720;
const FONT = "Avenir Next";
const DARK = "#141820";
const CREAM = "#F7F3EB";
const MINT = "#B8F5D2";
const INK = "#151515";
const MUTED = "#656A72";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function text(slide, { name, value, left, top, width, height, size, color, bold = false, align = "left" }) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = value;
  box.text.style = { typeface: FONT, fontSize: size, color, bold, alignment: align, verticalAlignment: "top" };
  return box;
}

function line(slide, left, top, width, color) {
  return slide.shapes.add({
    geometry: "straightConnector1",
    position: { left, top, width, height: 0 },
    fill: "none",
    line: { style: "solid", fill: color, width: 1.5 },
  });
}

function box(slide, { name, left, top, width, height, fill, stroke = fill, radius = "rounded-xl" }) {
  return slide.shapes.add({
    geometry: "roundRect",
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: stroke, width: 1 },
    borderRadius: radius,
  });
}

function notes(slide, sources) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n${sources.map((source) => `- ${source}`).join("\n")}`);
  slide.speakerNotes.setVisible(true);
}

function slideNumber(slide, value, dark = false) {
  text(slide, { name: "slide-number", value, left: 1168, top: 654, width: 52, height: 24, size: 14, color: dark ? "#AEB6C3" : MUTED, align: "right" });
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  {
    const slide = presentation.slides.add();
    slide.background.fill = DARK;
    text(slide, { name: "eyebrow", value: "VITRINES", left: 72, top: 62, width: 260, height: 30, size: 18, color: MINT, bold: true });
    text(slide, { name: "title", value: "Product evidence,\nmade useful.", left: 72, top: 190, width: 920, height: 240, size: 80, color: "#FFFFFF", bold: true });
    text(slide, { name: "subtitle", value: "A workspace for seeing how products work — and deciding what to build next.", left: 76, top: 500, width: 760, height: 78, size: 26, color: "#C9D1DB" });
    line(slide, 76, 618, 1128, "#4B5563");
    text(slide, { name: "footer", value: "SYSTEM OVERVIEW", left: 76, top: 640, width: 260, height: 24, size: 14, color: "#AEB6C3", bold: true });
    notes(slide, ["Internal Vitrines repository inspection, 2026-08-11."]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = CREAM;
    text(slide, { name: "title", value: "One system for\nproduct decisions.", left: 72, top: 64, width: 660, height: 170, size: 62, color: INK, bold: true });
    text(slide, { name: "context", value: "A simple loop that turns reference material into forward motion.", left: 76, top: 260, width: 590, height: 48, size: 24, color: MUTED });
    text(slide, { name: "discover", value: "Discover", left: 760, top: 136, width: 360, height: 60, size: 38, color: INK, bold: true });
    text(slide, { name: "inspect", value: "Inspect", left: 760, top: 228, width: 360, height: 60, size: 38, color: INK, bold: true });
    text(slide, { name: "create", value: "Create", left: 760, top: 320, width: 360, height: 60, size: 38, color: INK, bold: true });
    text(slide, { name: "decide", value: "Decide", left: 760, top: 412, width: 360, height: 60, size: 38, color: INK, bold: true });
    line(slide, 760, 206, 352, "#C7C3BA");
    line(slide, 760, 298, 352, "#C7C3BA");
    line(slide, 760, 390, 352, "#C7C3BA");
    text(slide, { name: "caption", value: "Catalogs · Screens · Flows · Projects", left: 76, top: 592, width: 690, height: 32, size: 20, color: "#3E7B5C", bold: true });
    slideNumber(slide, "02");
    notes(slide, ["src/vitrine/router.ts", "src/vitrine/main.tsx"]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = DARK;
    text(slide, { name: "title", value: "Capture what happened.\nNot just what it looked like.", left: 72, top: 62, width: 990, height: 168, size: 58, color: "#FFFFFF", bold: true });
    line(slide, 100, 500, 1080, "#64748B");
    box(slide, { name: "plan-box", left: 96, top: 374, width: 238, height: 98, fill: "#1E2731", stroke: "#536273" });
    box(slide, { name: "observe-box", left: 521, top: 374, width: 238, height: 98, fill: "#1E2731", stroke: "#536273" });
    box(slide, { name: "pin-box", left: 946, top: 374, width: 238, height: 98, fill: "#B8F5D2", stroke: "#B8F5D2" });
    text(slide, { name: "plan", value: "Plan", left: 126, top: 401, width: 170, height: 38, size: 28, color: "#FFFFFF", bold: true });
    text(slide, { name: "observe", value: "Observe", left: 551, top: 401, width: 170, height: 38, size: 28, color: "#FFFFFF", bold: true });
    text(slide, { name: "pin", value: "Pin evidence", left: 976, top: 401, width: 180, height: 38, size: 28, color: DARK, bold: true });
    text(slide, { name: "detail-1", value: "Intent and safe scope", left: 96, top: 538, width: 240, height: 32, size: 19, color: "#B9C3D0" });
    text(slide, { name: "detail-2", value: "Visible UI + system feedback", left: 521, top: 538, width: 300, height: 32, size: 19, color: "#B9C3D0" });
    text(slide, { name: "detail-3", value: "Reusable canonical flows", left: 946, top: 538, width: 260, height: 32, size: 19, color: MINT });
    slideNumber(slide, "03", true);
    notes(slide, ["src/crawlPlan.ts", "src/crawlRun.ts", "src/flowPreparation.ts"]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = CREAM;
    text(slide, { name: "title", value: "Fast at the edge.\nDependable at the core.", left: 72, top: 58, width: 740, height: 170, size: 58, color: INK, bold: true });
    text(slide, { name: "caption", value: "Four responsibilities, one connected experience.", left: 76, top: 254, width: 600, height: 40, size: 23, color: MUTED });
    line(slide, 250, 478, 780, "#B9B4AA");
    box(slide, { name: "frontend", left: 72, top: 396, width: 210, height: 108, fill: "#FFFFFF", stroke: "#D7D1C8" });
    box(slide, { name: "edge", left: 338, top: 396, width: 210, height: 108, fill: "#FFFFFF", stroke: "#D7D1C8" });
    box(slide, { name: "api", left: 604, top: 396, width: 210, height: 108, fill: "#FFFFFF", stroke: "#D7D1C8" });
    box(slide, { name: "data", left: 870, top: 396, width: 250, height: 108, fill: "#E3F8EA", stroke: "#B8F5D2" });
    text(slide, { name: "frontend-label", value: "Vite web", left: 96, top: 426, width: 170, height: 32, size: 25, color: INK, bold: true, align: "center" });
    text(slide, { name: "edge-label", value: "Cloudflare", left: 362, top: 426, width: 160, height: 32, size: 25, color: INK, bold: true, align: "center" });
    text(slide, { name: "api-label", value: "Node API", left: 628, top: 426, width: 160, height: 32, size: 25, color: INK, bold: true, align: "center" });
    text(slide, { name: "data-label", value: "Postgres + media", left: 894, top: 426, width: 200, height: 32, size: 23, color: INK, bold: true, align: "center" });
    text(slide, { name: "foot", value: "Static delivery · API proxy · Product logic · Durable state", left: 76, top: 594, width: 920, height: 32, size: 20, color: "#3E7B5C", bold: true });
    slideNumber(slide, "04");
    notes(slide, ["src/cloudflareFrontendWorker.ts", "package.json", "src/objectGc.ts", "AGENTS.md"]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = DARK;
    text(slide, { name: "eyebrow", value: "THE OPERATING PRINCIPLE", left: 72, top: 62, width: 360, height: 28, size: 16, color: MINT, bold: true });
    text(slide, { name: "title", value: "Trust is built in.", left: 72, top: 160, width: 820, height: 100, size: 72, color: "#FFFFFF", bold: true });
    text(slide, { name: "one", value: "Guarded crawling", left: 76, top: 342, width: 450, height: 46, size: 33, color: "#FFFFFF", bold: true });
    text(slide, { name: "two", value: "Traceable evidence", left: 76, top: 422, width: 480, height: 46, size: 33, color: "#FFFFFF", bold: true });
    text(slide, { name: "three", value: "Verified releases", left: 76, top: 502, width: 420, height: 46, size: 33, color: "#FFFFFF", bold: true });
    line(slide, 680, 344, 424, "#536273");
    text(slide, { name: "close", value: "Vitrines turns\nproduct evidence\ninto momentum.", left: 680, top: 372, width: 450, height: 190, size: 42, color: MINT, bold: true });
    slideNumber(slide, "05", true);
    notes(slide, ["src/crawlPlan.ts", "AGENTS.md: Production deployment"]);
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const suffix = String(index + 1).padStart(2, "0");
    await writeBlob(`${outputDir}/slide-${suffix}.png`, await presentation.export({ slide, format: "png", scale: 2 }));
    await fs.writeFile(`${outputDir}/slide-${suffix}.layout.json`, await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(`${outputDir}/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  await fs.writeFile(`${outputDir}/inspect.ndjson`, (await presentation.inspect({ kind: "slide,textbox,shape,notes", maxChars: 20000 })).ndjson);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
