import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const host = process.env.VITRINES_MIRROR_HOST || "127.0.0.1";
const port = Number(process.env.VITRINES_MIRROR_PORT || 4180);
const sourceOrigin = "https://www.contentarchitecture.dev";
const assetsById = new Map();
const assetsByUrl = new Map();
const assetsByUrlWithoutQuery = new Map();
const manifests = ["capture-manifest.json", "network-assets-manifest.json", "supplemental-assets-manifest.json"]
  .map((filename) => JSON.parse(readFileSync(join(root, filename), "utf8")));

for (const manifest of manifests) {
  for (const item of manifest.assets) {
    const asset = { ...item, path: join(root, item.path) };
    assetsById.set(item.id, asset);
    assetsByUrl.set(item.url, asset);
    const withoutQuery = item.url.split("?")[0];
    assetsByUrlWithoutQuery.set(withoutQuery, asset);
  }
}

const replacementEntries = new Map();
for (const [url, asset] of assetsByUrl) {
  replacementEntries.set(url, `/__asset/${asset.id}`);
  replacementEntries.set(url.split("?")[0], `/__asset/${asset.id}`);
}
const replacements = [...replacementEntries.entries()]
  .sort(([left], [right]) => right.length - left.length)
  .map(([url, localUrl]) => [url, localUrl]);

function rewriteCapturedUrls(value) {
  let rewritten = value;
  for (const [url, localUrl] of replacements) rewritten = rewritten.replaceAll(url, localUrl);
  return rewritten;
}

function rewriteMarkupUrls(value) {
  return value
    .split(/(<script\b[\s\S]*?<\/script>)/gi)
    .map((part, index) => index % 2 === 0 ? rewriteCapturedUrls(part) : part)
    .join("");
}

const indexHtml = rewriteCapturedUrls(readFileSync(join(root, "index.source.html"), "utf8"));
const rawHtml = rewriteCapturedUrls(readFileSync(join(root, "raw.html"), "utf8"));
let liveIndexHtml;

async function getLiveIndexHtml() {
  if (liveIndexHtml) return liveIndexHtml;
  const liveResponse = await fetch(`${sourceOrigin}/`);
  if (!liveResponse.ok) throw new Error(`Source returned ${liveResponse.status}`);
  liveIndexHtml = rewriteMarkupUrls(await liveResponse.text());
  return liveIndexHtml;
}

function findAsset(requestUrl) {
  const sourceUrl = new URL(requestUrl, sourceOrigin);
  return assetsByUrl.get(sourceUrl.href)
    || assetsByUrlWithoutQuery.get(`${sourceUrl.origin}${sourceUrl.pathname}`);
}

function serveAsset(response, asset) {
  const type = asset.contentType || "application/octet-stream";
  if (type.startsWith("text/css") || type.includes("javascript") || type === "application/json") {
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

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
  if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' blob: https:; connect-src 'self' https:; worker-src 'self' blob:; frame-src 'none'",
      "Content-Type": "text/html; charset=utf-8",
    });
    const mode = requestUrl.searchParams.get("mode");
    if (mode !== "static" && mode !== "raw") {
      try {
        response.end(await getLiveIndexHtml());
        return;
      } catch (error) {
        console.warn(`Live document unavailable; using static capture: ${error.message}`);
      }
    }
    response.end(mode === "raw" ? rawHtml : indexHtml);
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
  console.log(`Content Architecture mirror: http://${host}:${port}/`);
  console.log(`Captured URL mappings: ${assetsByUrl.size}`);
});
