import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(root, "assets-complete");
const sourceUrls = JSON.parse(await readFile(join(root, "captured-asset-urls.json"), "utf8"));
const allowedOrigin = "https://mistral.ai";
const assetExtension = /\.(?:css|gif|ico|jpe?g|js|lottie|mjs|mp4|png|svg|ttf|wasm|webm|webp|woff2?)(?:$|\?)/i;
const assetPrefix = /^\/(?:_astro|cms-media\/api\/media\/file|fonts|images|\.netlify\/scripts)\//;
const urls = sourceUrls.filter((value) => {
  const url = new URL(value);
  return url.origin === allowedOrigin && (assetExtension.test(`${url.pathname}${url.search}`) || assetPrefix.test(url.pathname));
});

await mkdir(outputDirectory, { recursive: true });

function extensionFor(url, contentType) {
  const existing = extname(new URL(url).pathname).toLowerCase();
  if (existing && existing.length <= 10) return existing;
  return ({
    "application/javascript": ".js",
    "application/wasm": ".wasm",
    "font/ttf": ".ttf",
    "font/woff": ".woff",
    "font/woff2": ".woff2",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
    "text/css": ".css",
    "text/javascript": ".js",
  })[contentType.split(";")[0].trim()] || ".bin";
}

async function download(url) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "VitrinesHomepageCapture/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > 30 * 1024 * 1024) throw new Error(`Asset exceeds 30 MB limit (${declaredSize} bytes)`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 30 * 1024 * 1024) throw new Error(`Asset exceeds 30 MB limit (${bytes.length} bytes)`);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const id = createHash("sha256").update(url).digest("hex").slice(0, 24);
    const path = `assets-complete/${id}${extensionFor(url, contentType)}`;
    await writeFile(join(root, path), bytes);
    return {
      bytes: bytes.length,
      contentType,
      id,
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      url,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), url };
  }
}

const results = [];
for (let index = 0; index < urls.length; index += 8) {
  results.push(...await Promise.all(urls.slice(index, index + 8).map(download)));
}

const assets = results.filter((result) => !result.error);
const failures = results.filter((result) => result.error);
await writeFile(join(root, "complete-assets-manifest.json"), JSON.stringify({ assets, failures }, null, 2));
console.log(JSON.stringify({ discovered: urls.length, downloaded: assets.length, failed: failures.length }, null, 2));
if (failures.length) console.log(JSON.stringify(failures, null, 2));
