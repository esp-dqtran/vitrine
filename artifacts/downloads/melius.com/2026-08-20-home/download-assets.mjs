import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL(".", import.meta.url);
const origin = "https://www.melius.com";
const html = await readFile(new URL("raw.html", root), "utf8");
const output = new URL("network-assets/", root);
await mkdir(output, { recursive: true });

const candidates = new Set();
// Captured from the offline replay: this route chunk is requested only after
// hydration and is not named in the server-rendered HTML.
for (const url of [
  "https://www.melius.com/_next/static/chunks/36xbliaxexmbc.js?dpl=dpl_688kRX99Hye46uKj7LvVoFkdwNWj",
  "https://www.melius.com/_next/static/chunks/16cq4ti-62638.js?dpl=dpl_688kRX99Hye46uKj7LvVoFkdwNWj",
]) candidates.add(url);
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const value = match[1].replaceAll("&amp;", "&");
  if (value.startsWith("/") || value.startsWith(origin)) candidates.add(new URL(value, origin).href);
}
for (const match of html.matchAll(/(?:url|src)=%2F([^&"\\]+)|"(\/media\/[^"\\]+|\/images\/[^"\\]+)"/g)) {
  const value = match[1] ? `/${decodeURIComponent(match[1])}` : match[2];
  if (value) candidates.add(new URL(value, origin).href);
}
for (const match of html.matchAll(/\/(?:media|images)\/[A-Za-z0-9_./-]+\.(?:webp|webm|svg)/g)) {
  candidates.add(new URL(match[0], origin).href);
}

function extensionFor(url, contentType) {
  const extension = extname(new URL(url).pathname).toLowerCase();
  if (extension && extension.length < 10) return extension;
  const mime = contentType.split(";", 1)[0].trim();
  return ({
    "application/javascript": ".js", "image/avif": ".avif", "image/jpeg": ".jpg",
    "image/png": ".png", "image/svg+xml": ".svg", "image/webp": ".webp",
    "text/css": ".css", "video/webm": ".webm", "font/woff2": ".woff2",
  })[mime] || ".bin";
}

async function download(url) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": "VitrinesEvidenceCapture/1.0" }, signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const id = createHash("sha256").update(url).digest("hex").slice(0, 20);
    const path = `network-assets/${id}${extensionFor(url, contentType)}`;
    await writeFile(new URL(path, root), bytes);
    return { url, path, bytes: bytes.length, contentType, sha256: createHash("sha256").update(bytes).digest("hex") };
  } catch (error) {
    return { url, error: error instanceof Error ? error.message : String(error) };
  }
}

const urls = [...candidates].filter((url) => {
  const path = new URL(url).pathname;
  return path.startsWith("/_next/") || path.startsWith("/media/") || path.startsWith("/images/");
});
const results = [];
for (let index = 0; index < urls.length; index += 8) results.push(...await Promise.all(urls.slice(index, index + 8).map(download)));
const downloadedUrls = new Set(urls);

// Next/Turbopack loads some page code only after hydration. Follow those
// first-party chunk references so the local replay does not silently fall back
// to a partly interactive page.
for (let depth = 0; depth < 4; depth += 1) {
  const deferred = new Set();
  for (const asset of results.filter((item) => item.contentType?.includes("javascript"))) {
    const source = await readFile(new URL(asset.path, root), "utf8");
    for (const match of source.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_-]+\.js(?:\?[^"'`\\)]*)?/g)) {
      const url = new URL(match[0], origin).href;
      if (!downloadedUrls.has(url)) deferred.add(url);
    }
    for (const match of source.matchAll(/static\/chunks\/[A-Za-z0-9_-]+\.js/g)) {
      const url = new URL(`/_next/${match[0]}`, origin).href;
      if (!downloadedUrls.has(url)) deferred.add(url);
    }
  }
  if (deferred.size === 0) break;
  const next = [...deferred];
  next.forEach((url) => downloadedUrls.add(url));
  for (let index = 0; index < next.length; index += 8) results.push(...await Promise.all(next.slice(index, index + 8).map(download)));
}
const assets = results.filter((result) => !result.error);
const failures = results.filter((result) => result.error);
await writeFile(new URL("capture-manifest.json", root), JSON.stringify({ sourcePage: `${origin}/`, capturedAt: new Date().toISOString(), rawHtml: "raw.html", assets, failures }, null, 2));
console.log(JSON.stringify({ discovered: urls.length, downloaded: assets.length, failed: failures.length }, null, 2));
