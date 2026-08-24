import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const captureRoot = resolve(
  process.env.VITRINES_CAPTURE_ROOT ||
    join(here, "../2026-08-18T09-36-04-737Z"),
);
const host = process.env.VITRINES_MIRROR_HOST || "127.0.0.1";
const port = Number(process.env.VITRINES_MIRROR_PORT || 4180);
const sourceOrigin = "https://www.contentarchitecture.dev";
const assetsById = new Map();
const assetsByUrl = new Map();
const assetsByUrlWithoutQuery = new Map();
const manifests = [
  "capture-manifest.json",
  "network-assets-manifest.json",
  "supplemental-assets-manifest.json",
].map((filename) =>
  JSON.parse(readFileSync(join(captureRoot, filename), "utf8")),
);

for (const manifest of manifests) {
  for (const item of manifest.assets) {
    const asset = { ...item, path: join(captureRoot, item.path) };
    assetsById.set(item.id, asset);
    assetsByUrl.set(item.url, asset);
    assetsByUrlWithoutQuery.set(item.url.split("?")[0], asset);
  }
}

function localAssetUrl(asset) {
  return `/__asset/${encodeURIComponent(asset.id)}?offline-replay=1`;
}

const replacementEntries = new Map();
for (const [url, asset] of assetsByUrl) {
  replacementEntries.set(url, localAssetUrl(asset));
  replacementEntries.set(url.split("?")[0], localAssetUrl(asset));
}
const replacements = [...replacementEntries.entries()].sort(
  ([left], [right]) => right.length - left.length,
);

function rewriteCapturedUrls(value) {
  let rewritten = value;
  for (const [url, localUrl] of replacements) {
    rewritten = rewritten.replaceAll(url, localUrl);
  }
  return rewritten;
}

function findAssetByUrl(url) {
  return assetsByUrl.get(url) || assetsByUrlWithoutQuery.get(url.split("?")[0]);
}

function rewriteCssUrls(value, stylesheetUrl) {
  return rewriteCapturedUrls(value).replace(
    /url\(\s*(["']?)([^"')]+)\1\s*\)/g,
    (match, quote, rawUrl) => {
      if (/^(?:data:|blob:|#)/i.test(rawUrl)) return match;
      const absoluteUrl = new URL(rawUrl, stylesheetUrl).href;
      const asset = findAssetByUrl(absoluteUrl);
      return asset ? `url("${localAssetUrl(asset)}")` : match;
    },
  );
}

const staticHtml = rewriteCapturedUrls(
  readFileSync(join(captureRoot, "index.source.html"), "utf8"),
);
const rawHtml = rewriteCapturedUrls(
  readFileSync(join(captureRoot, "raw.html"), "utf8"),
);

function findAsset(requestUrl) {
  const sourceUrl = new URL(requestUrl, sourceOrigin);
  return findAssetByUrl(sourceUrl.href);
}

function serveAsset(response, asset) {
  const type = asset.contentType || "application/octet-stream";
  if (type.startsWith("text/css")) {
    const body = rewriteCssUrls(readFileSync(asset.path, "utf8"), asset.url);
    response.writeHead(200, {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": `${type}; charset=utf-8`,
    });
    response.end(body);
    return;
  }
  if (type.includes("javascript") || type === "application/json") {
    const body = rewriteCapturedUrls(readFileSync(asset.path, "utf8"));
    response.writeHead(200, {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": `${type}; charset=utf-8`,
    });
    response.end(body);
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": statSync(asset.path).size,
    "Content-Type": type,
  });
  createReadStream(asset.path).pipe(response);
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
  if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(requestUrl.searchParams.get("mode") === "raw" ? rawHtml : staticHtml);
    return;
  }
  if (requestUrl.pathname.startsWith("/__asset/")) {
    const id = decodeURIComponent(requestUrl.pathname.slice("/__asset/".length));
    const asset = assetsById.get(id);
    if (asset) return serveAsset(response, asset);
  } else {
    const asset = findAsset(`${requestUrl.pathname}${requestUrl.search}`);
    if (asset) return serveAsset(response, asset);
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Captured asset not found\n");
});

server.listen(port, host, () => {
  console.log(`Content Architecture offline mirror: http://${host}:${port}/`);
  console.log(`Capture root: ${captureRoot}`);
  console.log(`Captured URL mappings: ${assetsByUrl.size}`);
});
