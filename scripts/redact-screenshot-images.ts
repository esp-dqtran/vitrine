import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { blurPngRectangles, type PixelRectangle } from "../src/imageRedaction.ts";

interface RedactionSpecItem {
  source: string;
  output: string;
  rectangles?: PixelRectangle[];
  blurBoxes?: [number, number, number, number][];
  sigma?: number;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function rectangles(item: RedactionSpecItem): PixelRectangle[] {
  if (item.rectangles) return item.rectangles;
  return (item.blurBoxes ?? []).map(([left, top, right, bottom]) => ({
    left,
    top,
    width: right - left,
    height: bottom - top,
  }));
}

async function outputExists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) throw new Error("Pass exactly one of --dry-run or --apply");
  const specPath = argument("--spec");
  if (!specPath) throw new Error("--spec <path> is required");

  const parsed = JSON.parse(await readFile(resolve(specPath), "utf8")) as {
    items?: RedactionSpecItem[];
    results?: RedactionSpecItem[];
  };
  const items = parsed.items ?? parsed.results ?? [];
  if (items.length === 0) throw new Error("The redaction spec has no items");

  const report = [];
  for (const [index, item] of items.entries()) {
    const source = resolve(item.source);
    const output = resolve(item.output);
    if (source === output) throw new Error(`Item ${index + 1} would overwrite its source image`);
    if (await outputExists(output)) throw new Error(`Item ${index + 1} output already exists: ${output}`);
    const redacted = await blurPngRectangles(await readFile(source), rectangles(item), { sigma: item.sigma });
    if (apply) {
      await mkdir(dirname(output), { recursive: true });
      const temporary = `${output}.tmp-${process.pid}`;
      try {
        await writeFile(temporary, redacted.body, { flag: "wx" });
        await rename(temporary, output);
      } finally {
        await rm(temporary, { force: true }).catch(() => undefined);
      }
    }
    report.push({
      source,
      output,
      width: redacted.width,
      height: redacted.height,
      rectangles: redacted.rectangles.length,
      status: apply ? "written" : "validated",
    });
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", count: report.length, items: report }, null, 2));
}

await main();
