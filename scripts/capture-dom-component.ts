#!/usr/bin/env tsx

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  captureDomComponentEvidence,
  writeDomComponentEvidence,
  type DomComponentInteractionSpec,
  type DomComponentStateSpec,
  type DomComponentViewport,
  type ForcedPseudoClass,
} from "../src/domComponentEvidence/index.ts";

interface CaptureArguments {
  url: string;
  selector: string;
  output: string;
  viewports: DomComponentViewport[];
  states: DomComponentStateSpec[];
  interactions: DomComponentInteractionSpec[];
  headed: boolean;
  waitMs: number;
}

export async function captureDomComponentFromCommandLine(
  argv: string[],
): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const options = parseArguments(argv);
  const browser = await chromium.launch({ headless: !options.headed });
  try {
    const page = await browser.newPage({
      viewport: options.viewports[0]
        ? { width: options.viewports[0].width, height: options.viewports[0].height }
        : { width: 1440, height: 900 },
    });
    await page.goto(options.url, { waitUntil: "domcontentloaded" });
    if (options.waitMs > 0) await page.waitForTimeout(options.waitMs);
    await page.locator(options.selector).waitFor({ state: "attached" });

    const evidence = await captureDomComponentEvidence(page, {
      selector: options.selector,
      viewports: options.viewports.length ? options.viewports : undefined,
      states: options.states,
      interactions: options.interactions,
    });
    const written = await writeDomComponentEvidence(evidence, options.output);
    console.log(JSON.stringify({
      outputDirectory: written.outputDirectory,
      manifestPath: written.manifestPath,
      states: written.statePaths.length,
      stylesheets: written.stylesheetPaths.length,
      screenshots: written.screenshotPaths.length,
      warnings: evidence.warnings,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

function parseArguments(argv: string[]): CaptureArguments {
  let url = "";
  let selector = "";
  let output = "";
  let headed = false;
  let waitMs = 0;
  const viewports: DomComponentViewport[] = [];
  const states: DomComponentStateSpec[] = [{ name: "default" }];
  const interactions: DomComponentInteractionSpec[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--headed") {
      headed = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value after ${argument}`);
    index += 1;
    switch (argument) {
      case "--url":
        url = value;
        break;
      case "--selector":
        selector = value;
        break;
      case "--output":
        output = resolve(value);
        break;
      case "--viewport":
        viewports.push(parseViewport(value));
        break;
      case "--pseudo":
        states.push(parsePseudoState(value));
        break;
      case "--click":
        interactions.push({
          name: `click-${interactions.length + 1}`,
          actions: [{ type: "click", selector: value }],
        });
        break;
      case "--wait-ms":
        waitMs = parseNonNegativeInteger(value, "--wait-ms");
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!url || !selector || !output) {
    throw new Error("--url, --selector, and --output are required\n\n" + usage());
  }
  return { url, selector, output, viewports, states, interactions, headed, waitMs };
}

function parseViewport(value: string): DomComponentViewport {
  const match = /^(?<name>[a-z0-9_-]+):(?<width>\d+)x(?<height>\d+)$/i.exec(value);
  if (!match?.groups) {
    throw new Error(`Invalid viewport "${value}"; expected NAME:WIDTHxHEIGHT`);
  }
  return {
    name: match.groups.name!,
    width: parsePositiveInteger(match.groups.width!, "viewport width"),
    height: parsePositiveInteger(match.groups.height!, "viewport height"),
  };
}

function parsePseudoState(value: string): DomComponentStateSpec {
  const [name, pseudoList] = value.split(":", 2);
  if (!name || !pseudoList) {
    throw new Error(`Invalid pseudo state "${value}"; expected NAME:PSEUDO[,PSEUDO]`);
  }
  const forcePseudoClasses = pseudoList.split(",").map((pseudo) => {
    if (!FORCED_PSEUDO_CLASSES.has(pseudo as ForcedPseudoClass)) {
      throw new Error(`Unsupported forced pseudo class: ${pseudo}`);
    }
    return pseudo as ForcedPseudoClass;
  });
  return { name, forcePseudoClasses };
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function usage(): string {
  return `Capture a DOM component with Chromium's authored and computed CSS evidence.

Usage:
  npx tsx scripts/capture-dom-component.ts \\
    --url https://example.com \\
    --selector '#component' \\
    --output ./artifacts/component \\
    --viewport desktop:1440x900 \\
    --viewport mobile:390x844 \\
    --pseudo hover:hover \\
    --click 'button' \\
    --wait-ms 500

Options:
  --viewport NAME:WIDTHxHEIGHT  Repeat to capture responsive states.
  --pseudo NAME:PSEUDO[,PSEUDO] Repeat to force :hover/:focus/etc.
  --click SELECTOR              Repeat to capture a click interaction.
  --headed                     Show Chromium while capturing.
  --wait-ms NUMBER             Wait after navigation before capture.`;
}

const FORCED_PSEUDO_CLASSES = new Set<ForcedPseudoClass>([
  "active",
  "checked",
  "disabled",
  "enabled",
  "focus",
  "focus-visible",
  "focus-within",
  "hover",
  "invalid",
  "required",
  "target",
  "valid",
]);

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  captureDomComponentFromCommandLine(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
