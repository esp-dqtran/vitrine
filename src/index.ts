import { readFileSync, writeFileSync } from "node:fs";
import { crawl, crawlMany, exportMobbinStorageState, type AppTarget } from "./crawler.ts";
import { crawlBulkDownload } from "./bulkDownload.ts";
import { discoverApps } from "./discoverApps.ts";
import { caption } from "./caption.ts";
import { synthesize } from "./synthesize.ts";
import { importFlowManifest } from "./flows.ts";

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "crawl": {
    if (rest[0] === "--file") {
      const path = rest[1];
      if (!path) {
        console.error("Usage: npm run crawl -- --file <apps.json>");
        process.exit(1);
      }
      const apps = JSON.parse(readFileSync(path, "utf8")) as AppTarget[];
      await crawlMany(apps);
      break;
    }
    const [appUrl, appName] = rest;
    if (!appUrl) {
      console.error(
        "Usage: npm run crawl -- <mobbinAppScreensUrl> [appName]\n       npm run crawl -- --file <apps.json>"
      );
      process.exit(1);
    }
    await crawl(appUrl, appName ?? new URL(appUrl).pathname.split("/").filter(Boolean).pop() ?? "app");
    break;
  }
  case "crawl-bulk": {
    const [appUrl, appName] = rest;
    if (!appUrl) {
      console.error("Usage: npm run crawl-bulk -- <mobbinAppScreensUrl> [appName]");
      process.exit(1);
    }
    await crawlBulkDownload(appUrl, appName ?? new URL(appUrl).pathname.split("/").filter(Boolean).pop() ?? "app");
    break;
  }
  case "export-storage-state": {
    await exportMobbinStorageState(rest[0] ?? "data/mobbin-storage-state.json");
    break;
  }
  case "discover-apps": {
    const [outPath, platforms] = rest;
    const apps = await discoverApps(platforms ? platforms.split(",") : undefined);
    writeFileSync(outPath ?? "mobbin-apps.json", JSON.stringify(apps, null, 2));
    console.log(`Wrote ${apps.length} apps to ${outPath ?? "mobbin-apps.json"}`);
    break;
  }
  case "caption": {
    const provider = rest[0] ?? "chatgpt";
    const limit = rest[1] ? Number(rest[1]) : undefined;
    await caption(provider, limit);
    break;
  }
  case "synthesize": {
    const [app, provider] = rest;
    if (!app) {
      console.error("Usage: npm run synthesize -- <app> [chatgpt|claude|gemini]");
      process.exit(1);
    }
    await synthesize(app, provider ?? "chatgpt");
    break;
  }
  case "import-flows": {
    const [app, path] = rest;
    if (!app || !path) {
      console.error("Usage: npm run import-flows -- <app> <manifest.json>");
      process.exit(1);
    }
    const count = await importFlowManifest(app, path);
    console.log(`Imported ${count} flow(s) for ${app}.`);
    break;
  }
  default:
    console.error(
      "Usage: npm run crawl -- <mobbinAppScreensUrl> [appName]\n       npm run crawl -- --file <apps.json>\n       npm run crawl-bulk -- <mobbinAppScreensUrl> [appName]\n       npm run export-storage-state -- [outPath]\n       npm run discover-apps -- [outPath] [web,ios,android]\n       npm run caption -- [chatgpt|claude|gemini] [limit]\n       npm run synthesize -- <app> [chatgpt|claude|gemini]\n       npm run import-flows -- <app> <manifest.json>"
    );
    process.exit(1);
}
