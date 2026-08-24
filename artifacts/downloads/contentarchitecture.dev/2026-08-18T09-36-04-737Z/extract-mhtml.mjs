import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const assetDirectory = join(root, "assets");
await mkdir(assetDirectory, { recursive: true });

function parseHeaders(value) {
  const unfolded = value.replace(/\r?\n[\t ]+/g, " ");
  const headers = new Map();
  for (const line of unfolded.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  return headers;
}

function decodeQuotedPrintable(value) {
  const input = value.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(input.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(input.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(input.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function decodeBody(body, encoding) {
  if (encoding === "base64") return Buffer.from(body.replace(/\s+/g, ""), "base64");
  if (encoding === "quoted-printable") return decodeQuotedPrintable(body);
  return Buffer.from(body, "latin1");
}

function extensionFor(location, contentType) {
  try {
    const extension = extname(new URL(location).pathname).toLowerCase();
    if (extension && extension.length <= 10) return extension;
  } catch {}
  return ({
    "application/javascript": ".js",
    "application/json": ".json",
    "application/wasm": ".wasm",
    "font/ttf": ".ttf",
    "font/woff": ".woff",
    "font/woff2": ".woff2",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
    "text/css": ".css",
    "text/html": ".html",
    "text/javascript": ".js",
  })[contentType] || ".bin";
}

function parseMhtml(value, source) {
  const headerEnd = value.search(/\r?\n\r?\n/);
  if (headerEnd === -1) throw new Error(`${source}: missing MIME headers`);
  const documentHeaders = parseHeaders(value.slice(0, headerEnd));
  const contentType = documentHeaders.get("content-type") || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!boundaryMatch) throw new Error(`${source}: missing multipart boundary`);
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const parts = [];
  for (const rawPart of value.split(`--${boundary}`).slice(1)) {
    if (rawPart.startsWith("--")) break;
    const part = rawPart.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    const separator = part.search(/\r?\n\r?\n/);
    if (separator === -1) continue;
    const separatorLength = part.slice(separator).startsWith("\r\n\r\n") ? 4 : 2;
    const headers = parseHeaders(part.slice(0, separator));
    const location = headers.get("content-location");
    if (!location) continue;
    const type = (headers.get("content-type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
    const encoding = (headers.get("content-transfer-encoding") || "").toLowerCase();
    const body = part.slice(separator + separatorLength).replace(/\r?\n$/, "");
    parts.push({ body: decodeBody(body, encoding), contentType: type, location, source });
  }
  return parts;
}

const captures = [];
for (const filename of ["desktop.mhtml", "mobile.mhtml"]) {
  const value = await readFile(join(root, filename), "latin1");
  captures.push(...parseMhtml(value, filename));
}

const assetsByLocation = new Map();
let mainHtml;
for (const part of captures) {
  if (part.contentType === "text/html" && part.location.replace(/\/$/, "") === "https://www.contentarchitecture.dev") {
    if (!mainHtml || part.source === "desktop.mhtml") mainHtml = part.body;
    continue;
  }
  if (assetsByLocation.has(part.location)) continue;
  const id = createHash("sha256").update(part.location).digest("hex").slice(0, 24);
  const path = `assets/${id}${extensionFor(part.location, part.contentType)}`;
  await writeFile(join(root, path), part.body);
  assetsByLocation.set(part.location, {
    bytes: part.body.length,
    contentType: part.contentType,
    id,
    path,
    sha256: createHash("sha256").update(part.body).digest("hex"),
    source: part.source,
    url: part.location,
  });
}

if (!mainHtml) throw new Error("Homepage HTML was not found in the captures");
await writeFile(join(root, "index.source.html"), mainHtml);
await writeFile(join(root, "capture-manifest.json"), JSON.stringify({
  assets: [...assetsByLocation.values()],
  captureParts: captures.length,
  sourceUrl: "https://www.contentarchitecture.dev/",
}, null, 2));
console.log(JSON.stringify({ captureParts: captures.length, assets: assetsByLocation.size, htmlBytes: mainHtml.length }, null, 2));
