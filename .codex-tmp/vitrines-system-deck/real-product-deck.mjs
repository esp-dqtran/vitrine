import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const root = "/Users/kai/works/eastplayers/Astryx/.codex-tmp/vitrines-system-deck";
const assets = `${root}/real-assets`;
const output = `${root}/real-product-output`;
const finalPptx = "/Users/kai/works/eastplayers/Astryx/Vitrines-system-overview.pptx";
const FONT = "Avenir Next";
const DARK = "#141820";
const CREAM = "#F7F3EB";
const MINT = "#B8F5D2";
const INK = "#151515";
const MUTED = "#6D727C";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, { name, value, left, top, width, height, size, color, bold = false, align = "left" }) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = { typeface: FONT, fontSize: size, color, bold, alignment: align, verticalAlignment: "top" };
  return shape;
}

function addRule(slide, { left, top, width, color, weight = 1 }) {
  return slide.shapes.add({
    geometry: "straightConnector1",
    position: { left, top, width, height: 0 },
    fill: "none",
    line: { style: "solid", fill: color, width: weight },
  });
}

async function addImage(slide, { name, file, contentType, alt, left, top, width, height, fit = "cover", crop }) {
  const blob = await fs.readFile(`${assets}/${file}`);
  return slide.images.add({
    blob,
    contentType,
    name,
    alt,
    fit,
    position: { left, top, width, height },
    ...(crop ? { crop } : {}),
    geometry: "roundRect",
    borderRadius: "rounded-xl",
  });
}

function addNotes(slide, sources) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n${sources.map((source) => `- ${source}`).join("\n")}`);
  slide.speakerNotes.setVisible(true);
}

function addPage(slide, value, dark = false) {
  addText(slide, { name: "page", value, left: 1168, top: 654, width: 54, height: 24, size: 14, color: dark ? "#AEB6C3" : MUTED, align: "right" });
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  {
    const slide = presentation.slides.add();
    slide.background.fill = DARK;
    addText(slide, { name: "brand", value: "VITRINES", left: 72, top: 58, width: 250, height: 28, size: 17, color: MINT, bold: true });
    addText(slide, { name: "title", value: "Product research\nfor decisions that ship.", left: 72, top: 132, width: 610, height: 210, size: 60, color: "#FFFFFF", bold: true });
    addText(slide, { name: "support", value: "Real products. Real context. Decision-ready evidence.", left: 76, top: 384, width: 550, height: 42, size: 23, color: "#C9D1DB" });
    await addImage(slide, { name: "live-catalog", file: "catalog.png", contentType: "image/png", alt: "Vitrines live apps catalog", left: 690, top: 74, width: 520, height: 548, crop: { left: 0.06, top: 0.05, right: 0.06, bottom: 0.07 } });
    addText(slide, { name: "image-caption", value: "LIVE VITRINES CATALOG", left: 694, top: 640, width: 300, height: 20, size: 13, color: "#AEB6C3", bold: true });
    addNotes(slide, ["Live Vitrines landing page, inspected locally 2026-08-11.", "public/landing/astryx-apps-catalog.png"]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = CREAM;
    addText(slide, { name: "eyebrow", value: "WHO IT SERVES", left: 72, top: 62, width: 260, height: 24, size: 16, color: "#3E7B5C", bold: true });
    addText(slide, { name: "title", value: "Built for people\nwho turn research into direction.", left: 72, top: 128, width: 690, height: 180, size: 54, color: INK, bold: true });
    addText(slide, { name: "use-case-1", value: "Product design", left: 780, top: 170, width: 360, height: 46, size: 34, color: INK, bold: true });
    addText(slide, { name: "use-case-2", value: "Competitive research", left: 780, top: 276, width: 400, height: 46, size: 34, color: INK, bold: true });
    addText(slide, { name: "use-case-3", value: "Feature planning", left: 780, top: 382, width: 360, height: 46, size: 34, color: INK, bold: true });
    addRule(slide, { left: 780, top: 242, width: 342, color: "#C7C3BA" });
    addRule(slide, { left: 780, top: 348, width: 342, color: "#C7C3BA" });
    addText(slide, { name: "anchor", value: "Product designers and design-minded teams start from what already shipped — then make the next call with context.", left: 76, top: 470, width: 590, height: 86, size: 25, color: MUTED });
    addPage(slide, "02");
    addNotes(slide, ["Live Vitrines landing page: use cases and closing positioning, inspected locally 2026-08-11.", "src/vitrine/Home.tsx"]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = DARK;
    addText(slide, { name: "eyebrow", value: "THE PRODUCT", left: 72, top: 58, width: 240, height: 24, size: 16, color: MINT, bold: true });
    addText(slide, { name: "title", value: "A live catalog,\nnot a moodboard.", left: 72, top: 124, width: 560, height: 160, size: 56, color: "#FFFFFF", bold: true });
    addText(slide, { name: "metric-1", value: "430K", left: 76, top: 370, width: 235, height: 72, size: 54, color: MINT, bold: true });
    addText(slide, { name: "metric-2", value: "1,188", left: 350, top: 370, width: 250, height: 72, size: 54, color: MINT, bold: true });
    addText(slide, { name: "label-1", value: "screens captured", left: 76, top: 442, width: 210, height: 30, size: 19, color: "#C9D1DB" });
    addText(slide, { name: "label-2", value: "real products", left: 350, top: 442, width: 210, height: 30, size: 19, color: "#C9D1DB" });
    addText(slide, { name: "platforms", value: "Web  ·  iOS  ·  Android", left: 76, top: 560, width: 450, height: 32, size: 22, color: "#FFFFFF", bold: true });
    await addImage(slide, { name: "catalog-surface", file: "catalog.png", contentType: "image/png", alt: "Vitrines app catalog with real products", left: 680, top: 96, width: 530, height: 528, crop: { left: 0.04, top: 0.08, right: 0.04, bottom: 0.08 } });
    addPage(slide, "03", true);
    addNotes(slide, ["Live Vitrines landing page stats, inspected locally 2026-08-11.", "public/landing/astryx-apps-catalog.png"]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = CREAM;
    addText(slide, { name: "eyebrow", value: "FLOW EVIDENCE", left: 72, top: 62, width: 250, height: 24, size: 16, color: "#3E7B5C", bold: true });
    addText(slide, { name: "title", value: "See the journey,\nnot just the hero screen.", left: 72, top: 122, width: 650, height: 168, size: 54, color: INK, bold: true });
    await addImage(slide, { name: "trello-step-one", file: "trello-1.jpg", contentType: "image/jpeg", alt: "Trello iOS Adding a card flow step 1", left: 730, top: 106, width: 135, height: 438, fit: "contain" });
    await addImage(slide, { name: "trello-step-two", file: "trello-2.jpg", contentType: "image/jpeg", alt: "Trello iOS Adding a card flow step 2", left: 890, top: 106, width: 135, height: 438, fit: "contain" });
    await addImage(slide, { name: "trello-step-three", file: "trello-3.jpg", contentType: "image/jpeg", alt: "Trello iOS Adding a card flow step 3", left: 1050, top: 106, width: 135, height: 438, fit: "contain" });
    addText(slide, { name: "flow-detail", value: "Trello · Adding a card\n64 screens · observed in 47 apps", left: 76, top: 406, width: 410, height: 78, size: 25, color: INK, bold: true });
    addText(slide, { name: "flow-caption", value: "Context before. Action in the middle. Confirmation after.", left: 76, top: 528, width: 510, height: 42, size: 22, color: MUTED });
    addPage(slide, "04");
    addNotes(slide, ["src/vitrine/Home.tsx: FLOW_VIGNETTE", "Live Vitrines catalog flow media: Trello iOS, Adding a card, steps 1–3."]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = DARK;
    addText(slide, { name: "eyebrow", value: "FROM EVIDENCE TO HANDOFF", left: 72, top: 58, width: 360, height: 24, size: 16, color: MINT, bold: true });
    addText(slide, { name: "title", value: "The work keeps\nits evidence attached.", left: 72, top: 122, width: 550, height: 160, size: 54, color: "#FFFFFF", bold: true });
    addText(slide, { name: "list", value: "Research projects\nLiving canvas\nDocuments & public previews", left: 76, top: 382, width: 420, height: 144, size: 29, color: "#FFFFFF", bold: true });
    await addImage(slide, { name: "public-preview", file: "public-preview.png", contentType: "image/png", alt: "Vitrines public preview with captured flows", left: 640, top: 100, width: 570, height: 470, crop: { left: 0.02, top: 0.04, right: 0.02, bottom: 0.04 } });
    addText(slide, { name: "caption", value: "Evidence can move from private research to a shared, source-linked brief.", left: 646, top: 604, width: 540, height: 36, size: 20, color: "#C9D1DB" });
    addPage(slide, "05", true);
    addNotes(slide, ["Live Vitrines landing page: Research projects, Living canvas, Documents, Public previews, inspected locally 2026-08-11.", "public/landing/astryx-public-preview-real-flows.png"]);
  }

  {
    const slide = presentation.slides.add();
    slide.background.fill = CREAM;
    addText(slide, { name: "brand", value: "VITRINES", left: 72, top: 62, width: 220, height: 26, size: 17, color: "#3E7B5C", bold: true });
    addText(slide, { name: "title", value: "Start from what shipped.\nFinish with a direction\nyour team can defend and build.", left: 72, top: 150, width: 800, height: 260, size: 58, color: INK, bold: true });
    await addImage(slide, {
      name: "product-context",
      file: "artlist.png",
      contentType: "image/png",
      alt: "Artlist product screen captured in Vitrines",
      left: 850,
      top: 130,
      width: 350,
      height: 360,
      fit: "cover",
      crop: { left: 0.08, top: 0.05, right: 0.08, bottom: 0.05 },
    });
    addText(slide, { name: "caption", value: "Real product context, not isolated inspiration.", left: 76, top: 520, width: 600, height: 34, size: 23, color: MUTED });
    addPage(slide, "06");
    addNotes(slide, ["Live Vitrines landing page closing statement, inspected locally 2026-08-11.", "Live Vitrines catalog preview media: Artlist web capture."]);
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const number = String(index + 1).padStart(2, "0");
    await writeBlob(`${output}/slide-${number}.png`, await presentation.export({ slide, format: "png", scale: 2 }));
    await fs.writeFile(`${output}/slide-${number}.layout.json`, await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(`${output}/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  await fs.writeFile(`${output}/inspect.ndjson`, (await presentation.inspect({ kind: "slide,textbox,shape,image,notes", maxChars: 24000 })).ndjson);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
