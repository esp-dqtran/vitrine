import { readFileSync, writeFileSync } from "node:fs";
import { crawl, crawlMany, exportMobbinStorageState, type AppTarget } from "./crawler.ts";
import { crawlBulkDownload, crawlFlowsDownload, type BulkObjectDependencies } from "./bulkDownload.ts";
import { discoverApps } from "./discoverApps.ts";
import { caption } from "./caption.ts";
import { synthesize } from "./synthesize.ts";
import { importFlowManifest } from "./flows.ts";
import { recordApp, smartCrawl, type LegacyCaptureDependencies } from "./smartCrawler.ts";
import { repairFlow, researchApp } from "./appResearch.ts";
import { startChatSession } from "./llmChat.ts";
import { insertImage, pool } from "./db.ts";
import { attachImageObject, attachThumbnailObject, imageObjectById } from "./objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "./objectStoreConfig.ts";
import { isPlatform } from "./platformFromUrl.ts";

function objectDependencies(): { bulk: BulkObjectDependencies & LegacyCaptureDependencies; caption: Parameters<typeof caption>[3] } {
  const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  return {
    bulk: {
      objectStore,
      insertImage,
      attachImage: async (imageId, metadata) => {
        const client = await pool.connect();
        try {
          await attachImageObject(client, { imageId, metadata });
        } finally {
          client.release();
        }
      },
      attachThumbnail: async (imageId, metadata) => {
        const client = await pool.connect();
        try {
          await attachThumbnailObject(client, { imageId, metadata });
        } finally {
          client.release();
        }
      },
    },
    caption: {
      objectStore,
      resolveObjectMetadata: (image) => imageObjectById(image.id),
    },
  };
}

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
  case "crawl-bulk":
  case "crawl-elements":
  case "crawl-flows": {
    const [appUrl, appName] = rest;
    if (!appUrl) {
      console.error(`Usage: npm run ${command} -- <mobbinAppUrl> [appName]`);
      process.exit(1);
    }
    const name = appName ?? new URL(appUrl).pathname.split("/").filter(Boolean).pop() ?? "app";
    const storage = objectDependencies().bulk;
    if (command === "crawl-flows") await crawlFlowsDownload(appUrl, name, undefined, storage);
    else await crawlBulkDownload(appUrl, name, command === "crawl-elements" ? "ui-elements" : "screens", undefined, storage);
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
    await caption(provider, limit, undefined, objectDependencies().caption);
    break;
  }
  case "synthesize": {
    const [app, platform, provider] = rest;
    if (!app || !platform || !isPlatform(platform)) {
      console.error("Usage: npm run synthesize -- <app> <ios|android|web> [chatgpt|claude|gemini]");
      process.exit(1);
    }
    await synthesize(app, platform, provider ?? "chatgpt");
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
  case "research": {
    const [appName, homepageUrl, provider] = rest;
    if (!appName || !homepageUrl) {
      console.error("Usage: npm run research -- <appName> <homepageUrl> [chatgpt|claude|gemini]");
      process.exit(1);
    }
    const session = await startChatSession(provider ?? "chatgpt");
    try {
      await researchApp(appName, homepageUrl, session.ask);
    } finally {
      await session.close();
    }
    break;
  }
  case "smart-crawl": {
    const [appName] = rest;
    if (!appName) {
      console.error("Usage: npm run smart-crawl -- <appName>");
      process.exit(1);
    }
    await smartCrawl(appName, "data", objectDependencies().bulk);
    break;
  }
  case "record": {
    const [appName, startUrl] = rest;
    if (!appName || !startUrl) {
      console.error("Usage: npm run record -- <appName> <startUrl>");
      process.exit(1);
    }
    await recordApp(appName, startUrl, "data", objectDependencies().bulk);
    break;
  }
  case "repair-flow": {
    const [appName, flowId, provider] = rest;
    if (!appName || !flowId) {
      console.error("Usage: npm run repair-flow -- <appName> <flowId> [chatgpt|claude|gemini]");
      process.exit(1);
    }
    const session = await startChatSession(provider ?? "chatgpt");
    const confirm = async (message: string): Promise<boolean> => {
      const { createInterface } = await import("node:readline/promises");
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(`${message} [y/N] `);
      rl.close();
      return answer.trim().toLowerCase() === "y";
    };
    try {
      await repairFlow(appName, flowId, session.ask, confirm);
    } finally {
      await session.close();
    }
    break;
  }
  default:
    console.error(
      "Usage: npm run crawl -- <mobbinAppScreensUrl> [appName]\n       npm run crawl -- --file <apps.json>\n       npm run crawl-bulk -- <mobbinAppScreensUrl> [appName]\n       npm run crawl-elements -- <mobbinAppUrl> [appName]\n       npm run crawl-flows -- <mobbinAppUrl> [appName]\n       npm run export-storage-state -- [outPath]\n       npm run discover-apps -- [outPath] [web,ios,android]\n       npm run caption -- [chatgpt|claude|gemini] [limit]\n       npm run synthesize -- <app> [chatgpt|claude|gemini]\n       npm run import-flows -- <app> <manifest.json>\n       npm run research -- <appName> <homepageUrl> [provider]\n       npm run smart-crawl -- <appName>\n       npm run record -- <appName> <startUrl>\n       npm run repair-flow -- <appName> <flowId> [provider]"
    );
    process.exit(1);
}
