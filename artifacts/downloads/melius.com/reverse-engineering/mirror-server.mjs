import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const captureRoot = resolve(process.env.VITRINES_CAPTURE_ROOT || join(here, "../2026-08-20-home"));
const host = process.env.VITRINES_MIRROR_HOST || "127.0.0.1";
const port = Number(process.env.VITRINES_MIRROR_PORT || 4186);
const sourceOrigin = "https://www.melius.com";
const manifest = JSON.parse(readFileSync(join(captureRoot, "capture-manifest.json"), "utf8"));
const byUrl = new Map();
const byPath = new Map();
const byId = new Map();

for (const item of manifest.assets) {
  const asset = { ...item, id: basename(item.path, ""), path: join(captureRoot, item.path) };
  byUrl.set(item.url, asset);
  byPath.set(new URL(item.url).pathname + new URL(item.url).search, asset);
  if (!byPath.has(new URL(item.url).pathname)) byPath.set(new URL(item.url).pathname, asset);
  byId.set(asset.id, asset);
}

function localAssetUrl(asset) {
  return `/__asset/${encodeURIComponent(asset.id)}`;
}

const replacements = [...byUrl.entries()].flatMap(([url, asset]) => [
  [url, localAssetUrl(asset)],
  [url.replace("https://www.melius.com", "https://melius.com"), localAssetUrl(asset)],
]).sort(([left], [right]) => right.length - left.length);

function rewrite(value) {
  let rewritten = value;
  for (const [url, local] of replacements) rewritten = rewritten.replaceAll(url, local);
  return rewritten;
}

const html = rewrite(readFileSync(join(captureRoot, "raw.html"), "utf8"));

function findRequestAsset(requestUrl) {
  // Next/Image generates a different optimizer URL for each viewport width.
  // We captured the original first-party files, so serve those directly for
  // every local optimizer request instead of requiring each generated size.
  if (requestUrl.pathname === "/_next/image") {
    const sourcePath = requestUrl.searchParams.get("url");
    if (sourcePath?.startsWith("/")) {
      return byPath.get(sourcePath) || byPath.get(decodeURIComponent(sourcePath));
    }
  }

  return byPath.get(requestUrl.pathname + requestUrl.search) || byPath.get(requestUrl.pathname);
}

function serve(response, asset) {
  const type = asset.contentType || "application/octet-stream";
  if (type.startsWith("text/css") || type.includes("javascript")) {
    const body = rewrite(readFileSync(asset.path, "utf8"));
    response.writeHead(200, { "Content-Type": type, "Content-Length": Buffer.byteLength(body), "Cache-Control": "public, max-age=31536000, immutable" });
    response.end(body);
    return;
  }
  response.writeHead(200, { "Content-Type": type, "Content-Length": statSync(asset.path).size, "Cache-Control": "public, max-age=31536000, immutable" });
  createReadStream(asset.path).pipe(response);
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
  if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:",
    });
    response.end(html);
    return;
  }
  const asset = requestUrl.pathname.startsWith("/__asset/")
    ? byId.get(decodeURIComponent(requestUrl.pathname.slice(9)))
    : findRequestAsset(requestUrl);
  if (asset) return serve(response, asset);
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Captured asset not found\n");
});

server.listen(port, host, () => {
  console.log(`Melius offline mirror: http://${host}:${port}/`);
  console.log(`Capture root: ${captureRoot}`);
  console.log(`Captured URL mappings: ${byUrl.size}`);
});
