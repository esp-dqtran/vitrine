import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  DomComponentEvidence,
  DomComponentStateEvidence,
  WrittenDomComponentEvidence,
} from "./types.ts";

export async function writeDomComponentEvidence(
  evidence: DomComponentEvidence,
  outputDirectory: string,
): Promise<WrittenDomComponentEvidence> {
  const output = resolve(outputDirectory);
  const statesDirectory = join(output, "states");
  const stylesheetsDirectory = join(output, "stylesheets");
  const screenshotsDirectory = join(output, "screenshots");
  await Promise.all([
    mkdir(statesDirectory, { recursive: true }),
    mkdir(stylesheetsDirectory, { recursive: true }),
    mkdir(screenshotsDirectory, { recursive: true }),
  ]);

  const statePaths: string[] = [];
  const screenshotPaths: string[] = [];
  for (const state of evidence.states) {
    const stateName = safeFileName(state.id);
    const statePath = join(statesDirectory, `${stateName}.json`);
    const screenshotPath = state.screenshot
      ? join(screenshotsDirectory, `${stateName}.png`)
      : undefined;
    const serializedState: Omit<DomComponentStateEvidence, "screenshot"> & {
      screenshot?: Omit<NonNullable<DomComponentStateEvidence["screenshot"]>, "base64"> & {
        path: string;
      };
    } = {
      ...state,
      ...(state.screenshot && screenshotPath
        ? {
          screenshot: {
            contentType: state.screenshot.contentType,
            width: state.screenshot.width,
            height: state.screenshot.height,
            path: relativePath(output, screenshotPath),
          },
        }
        : { screenshot: undefined }),
    };
    if (state.screenshot && screenshotPath) {
      await writeFile(screenshotPath, Buffer.from(state.screenshot.base64, "base64"));
      screenshotPaths.push(screenshotPath);
    }
    await writeJson(statePath, serializedState);
    statePaths.push(statePath);
  }

  const stylesheetPaths: string[] = [];
  const stylesheetManifest = [];
  for (const [index, stylesheet] of evidence.stylesheets.entries()) {
    const basename = `${String(index + 1).padStart(3, "0")}-${stylesheet.sha256.slice(0, 12)}.css`;
    const stylesheetPath = join(stylesheetsDirectory, basename);
    await writeFile(stylesheetPath, stylesheet.text, "utf8");
    stylesheetPaths.push(stylesheetPath);
    stylesheetManifest.push({
      ...stylesheet,
      text: undefined,
      path: relativePath(output, stylesheetPath),
    });
  }

  const firstOuterHtml = evidence.states[0]?.outerHtml ?? "";
  await Promise.all([
    writeFile(join(output, "subtree.html"), firstOuterHtml, "utf8"),
    writeJson(join(output, "assets.json"), evidence.assets),
    writeJson(join(output, "scripts.json"), evidence.scripts),
  ]);

  const manifestPath = join(output, "manifest.json");
  await writeJson(manifestPath, {
    schemaVersion: evidence.schemaVersion,
    source: evidence.source,
    warnings: evidence.warnings,
    states: evidence.states.map((state) => ({
      id: state.id,
      viewport: state.viewport,
      state: state.state,
      kind: state.kind,
      path: relativePath(output, join(statesDirectory, `${safeFileName(state.id)}.json`)),
      ...(state.screenshot
        ? { screenshotPath: relativePath(output, join(screenshotsDirectory, `${safeFileName(state.id)}.png`)) }
        : {}),
    })),
    stylesheets: stylesheetManifest,
    assetsPath: "assets.json",
    scriptsPath: "scripts.json",
    subtreePath: "subtree.html",
  });

  return {
    outputDirectory: output,
    manifestPath,
    statePaths,
    stylesheetPaths,
    screenshotPaths,
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeFileName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "state";
}

function relativePath(root: string, path: string): string {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}
