import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const captureRoot = path.resolve(projectRoot, "..");
const mirrorRoot = path.join(captureRoot, "mirror");
const html = await readFile(path.join(mirrorRoot, "index.html"), "utf8");
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];

if (!body) throw new Error("Could not find the captured body markup.");

const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const runtimeParts = [];
for (const match of body.matchAll(scriptPattern)) {
  const src = match[1].match(/src=["']([^"']+)["']/i)?.[1];
  if (src) {
    runtimeParts.push(await readFile(path.join(mirrorRoot, src), "utf8"));
  } else if (match[2].trim()) {
    runtimeParts.push(match[2]);
  }
}

const markup = body.replace(scriptPattern, "").trim();
const mainOpen = markup.indexOf('<main id="top">');
const mainClose = markup.indexOf("</main>", mainOpen);
const footerStart = markup.indexOf("<footer", mainClose);

if (mainOpen < 0 || mainClose < 0 || footerStart < 0) {
  throw new Error("The captured page landmarks changed.");
}

const globalMarkup = markup.slice(0, mainOpen).trim();
const mainMarkup = markup.slice(mainOpen + '<main id="top">'.length, mainClose).trim();
const footerMarkup = markup.slice(footerStart).trim();
const markers = [
  ["hero", '<section class="hero" id="hero">'],
  ["intro", '<section class="intro"'],
  ["work", '<section class="caro" id="work">'],
  ["origin", '<div class="sheet">\n    <section class="ed" id="origin">'],
  ["shift", '<div class="sheet">\n    <section class="ed" id="shift">'],
  ["process", '<section class="proc" id="process">'],
  ["protocol", '<div class="sheet">\n    <section class="ed" id="protocol">'],
  ["protocolParts", '<section class="proc bcp-parts" id="protocol-parts">'],
  ["ai", '<div class="sheet">\n    <section class="ed" id="ai">'],
  ["lab", '<section class="caro" id="lab">'],
  ["contact", '<section class="cta" id="contact">'],
];

const starts = markers.map(([name, marker]) => {
  const index = mainMarkup.indexOf(marker);
  if (index < 0) throw new Error(`Missing captured fragment: ${name}`);
  return { name, index };
});

const fragments = { global: globalMarkup, footer: footerMarkup };
for (let index = 0; index < starts.length; index += 1) {
  const current = starts[index];
  const next = starts[index + 1];
  fragments[current.name] = mainMarkup.slice(current.index, next?.index ?? mainMarkup.length).trim();
}

const sourceStyle = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1];
if (!sourceStyle) throw new Error("Could not find the captured stylesheet.");

await writeFile(
  path.join(projectRoot, "src", "sourceFragments.js"),
  `// Generated from the downloaded source DOM. Do not hand-edit.\nexport const sourceFragments = ${JSON.stringify(fragments, null, 2)};\n`,
);
await writeFile(
  path.join(projectRoot, "src", "source.css"),
  sourceStyle.replaceAll('url("assets/', 'url("/assets/').trimStart(),
);
await writeFile(
  path.join(projectRoot, "public", "craft-runtime.js"),
  `/* Generated from the downloaded public page runtime. */\n${runtimeParts.join("\n\n")}`,
);

console.log(JSON.stringify({ fragments: Object.keys(fragments), runtimeBlocks: runtimeParts.length }, null, 2));
