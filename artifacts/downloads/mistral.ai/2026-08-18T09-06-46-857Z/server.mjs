import { createHash } from "node:crypto";
import { createReadStream, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const host = process.env.VITRINES_MIRROR_HOST || "127.0.0.1";
const port = Number(process.env.VITRINES_MIRROR_PORT || 4179);
const sourceOrigin = "https://mistral.ai";

const assetsById = new Map();
const assetsByUrl = new Map();
const assetsByUrlWithoutQuery = new Map();

function mimeType(path, fallback = "application/octet-stream") {
  return ({
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".lottie": "application/zip",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".wasm": "application/wasm",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  })[extname(path).toLowerCase()] || fallback;
}

function registerAsset({ id, path, url, contentType }) {
  if (!url || !path) return;
  const asset = { id, path, url, contentType: contentType || mimeType(path) };
  if (!assetsById.has(id)) assetsById.set(id, asset);
  if (!assetsByUrl.has(url)) assetsByUrl.set(url, asset);
  const withoutQuery = url.split("?")[0];
  if (!assetsByUrlWithoutQuery.has(withoutQuery)) assetsByUrlWithoutQuery.set(withoutQuery, asset);
}

for (const directory of ["assets-desktop", "assets-mobile"]) {
  const directoryPath = join(root, directory);
  const manifest = JSON.parse(readFileSync(join(directoryPath, "manifest.json"), "utf8"));
  const files = readdirSync(directoryPath);
  for (const item of manifest.assets) {
    const filename = files.find((candidate) => candidate === item.id || candidate.startsWith(`${item.id}.`));
    if (!filename) continue;
    registerAsset({
      id: item.id,
      path: join(directoryPath, filename),
      url: item.url,
      contentType: item.contentType,
    });
  }
}

const inventories = ["desktop-inventory.json", "mobile-inventory.json"]
  .map((filename) => JSON.parse(readFileSync(join(root, filename), "utf8")));
const extraDirectory = join(root, "first-party-extra");
const extraFiles = readdirSync(extraDirectory);
for (const inventory of inventories) {
  for (const item of inventory.assets) {
    if (!item.url.startsWith(`${sourceOrigin}/`) || !["script", "other"].includes(item.kind)) continue;
    const id = createHash("sha256").update(item.url).digest("hex").slice(0, 16);
    const filename = extraFiles.find((candidate) => candidate.includes(id));
    if (!filename) continue;
    registerAsset({ id, path: join(extraDirectory, filename), url: item.url });
  }
}

registerAsset({
  id: "noise-rectangle",
  path: join(root, "supplemental-assets", "noise-rectangle.png"),
  url: `${sourceOrigin}/images/noise/noise-rectangle.png`,
  contentType: "image/png",
});

const completeManifestPath = join(root, "complete-assets-manifest.json");
try {
  const completeManifest = JSON.parse(readFileSync(completeManifestPath, "utf8"));
  for (const item of completeManifest.assets) {
    registerAsset({
      id: item.id,
      path: join(root, item.path),
      url: item.url,
      contentType: item.contentType,
    });
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const capturedUrlReplacements = [...assetsByUrl.entries()]
  .filter(([url]) => url.startsWith("http://") || url.startsWith("https://"))
  .sort(([left], [right]) => right.length - left.length)
  .map(([url, asset]) => [url, `/__asset/${asset.id}`]);

function rewriteCapturedUrls(text) {
  let rewritten = text;
  for (const [url, localUrl] of capturedUrlReplacements) {
    rewritten = rewritten.replaceAll(url, localUrl);
  }
  return rewritten;
}

const indexHtml = rewriteCapturedUrls(readFileSync(join(root, "raw.html"), "utf8"));

function findAsset(requestUrl) {
  const sourceUrl = new URL(requestUrl, sourceOrigin);
  return assetsByUrl.get(sourceUrl.href)
    || assetsByUrlWithoutQuery.get(`${sourceUrl.origin}${sourceUrl.pathname}`);
}

function serveAsset(response, asset) {
  const type = asset.contentType || mimeType(asset.path);
  if (type.startsWith("text/css") || type.startsWith("text/javascript")) {
    const body = rewriteCapturedUrls(readFileSync(asset.path, "utf8"));
    response.writeHead(200, {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": type,
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
      "Content-Security-Policy": "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-src 'none'",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(indexHtml);
    return;
  }

  if (requestUrl.pathname.startsWith("/__asset/")) {
    const asset = assetsById.get(decodeURIComponent(requestUrl.pathname.slice("/__asset/".length)));
    if (asset) return serveAsset(response, asset);
  } else {
    const asset = findAsset(`${requestUrl.pathname}${requestUrl.search}`);
    if (asset) return serveAsset(response, asset);
  }

  if ((request.headers.accept || "").includes("text/html")) {
    response.writeHead(302, { Location: `${sourceOrigin}${requestUrl.pathname}${requestUrl.search}` });
    response.end();
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Captured asset not found\n");
});

server.listen(port, host, () => {
  console.log(`Mistral mirror: http://${host}:${port}/`);
  console.log(`Captured URL mappings: ${assetsByUrl.size}`);
});
