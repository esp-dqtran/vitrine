import { lookup } from "node:dns/promises";
import { createServer, request as requestHttp, type Server } from "node:http";
import { request as requestHttps } from "node:https";
import { connect, type Socket } from "node:net";
import { canonicalPublicPageUrl, PublicPageValidationError } from "./publicPage.ts";

export interface PinnedPublicTarget {
  url: string;
  hostname: string;
  port: number;
  address: string;
  family: number;
}

type AddressResolver = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

export async function resolvePinnedPublicTarget(
  value: string,
  resolve: AddressResolver =
    async (hostname) => lookup(hostname, { all: true, verbatim: true }),
): Promise<PinnedPublicTarget> {
  const identity = canonicalPublicPageUrl(value);
  const parsed = new URL(identity.requestedUrl);
  const addresses = await resolve(parsed.hostname);
  if (addresses.length === 0) {
    throw new PublicPageValidationError("Public page host did not resolve");
  }
  for (const candidate of addresses) {
    const literal = candidate.family === 6
      ? `[${candidate.address}]`
      : candidate.address;
    canonicalPublicPageUrl(`${parsed.protocol}//${literal}/`);
  }
  const selected = addresses[0]!;
  return {
    url: identity.requestedUrl,
    hostname: parsed.hostname,
    port: parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "https:"
      ? 443
      : 80,
    address: selected.address,
    family: selected.family,
  };
}

export interface PinnedPublicProxy {
  server: string;
  close(): Promise<void>;
}

export async function requestPinnedPublicUrl(
  value: string,
  maximumBytes: number,
): Promise<{
  url: string;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}> {
  const target = await resolvePinnedPublicTarget(value);
  const parsed = new URL(target.url);
  return new Promise((resolve, reject) => {
    const request = (parsed.protocol === "https:" ? requestHttps : requestHttp)({
      host: target.address,
      family: target.family,
      port: target.port,
      path: `${parsed.pathname}${parsed.search}`,
      method: "GET",
      servername: parsed.hostname,
      headers: {
        accept: "application/json,text/plain,*/*",
        host: parsed.host,
      },
      timeout: 5_000,
    }, (response) => {
      const headers = Object.fromEntries(
        Object.entries(response.headers)
          .filter((entry): entry is [string, string | string[]] =>
            entry[1] !== undefined
          )
          .map(([key, header]) => [
            key,
            Array.isArray(header) ? header.join(", ") : String(header),
          ]),
      );
      const declared = Number(headers["content-length"]);
      if (Number.isFinite(declared) && declared > maximumBytes) {
        response.destroy();
        resolve({
          url: target.url,
          status: response.statusCode ?? 502,
          headers,
          body: Buffer.alloc(0),
        });
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.byteLength;
        if (total > maximumBytes) {
          response.destroy(new Error("Public resource is too large"));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.once("end", () => resolve({
        url: target.url,
        status: response.statusCode ?? 502,
        headers,
        body: Buffer.concat(chunks),
      }));
      response.once("error", reject);
    });
    request.once("timeout", () => request.destroy(new Error("Public resource timed out")));
    request.once("error", reject);
    request.end();
  });
}

export async function createPinnedPublicProxy(): Promise<PinnedPublicProxy> {
  const sockets = new Set<Socket>();
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      const target = await resolvePinnedPublicTarget(incoming.url ?? "");
      if (!target.url.startsWith("http:")) {
        throw new PublicPageValidationError("Plain proxy requests must use HTTP");
      }
      const parsed = new URL(target.url);
      const upstream = requestHttp({
        host: target.address,
        family: target.family,
        port: target.port,
        method: incoming.method,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          ...incoming.headers,
          host: parsed.host,
          "proxy-authorization": undefined,
          "proxy-connection": undefined,
        },
      }, (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      });
      upstream.on("error", () => {
        if (!outgoing.headersSent) outgoing.writeHead(502);
        outgoing.end();
      });
      incoming.pipe(upstream);
    })().catch(() => {
      if (!outgoing.headersSent) outgoing.writeHead(403);
      outgoing.end();
    });
  });
  server.on("connection", (socket) => trackSocket(socket, sockets));
  server.on("connect", (request, client, head) => {
    void (async () => {
      const target = await resolvePinnedPublicTarget(
        `https://${request.url ?? ""}/`,
      );
      const upstream = connect({
        host: target.address,
        family: target.family,
        port: target.port,
      });
      trackSocket(upstream, sockets);
      upstream.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.byteLength) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.once("error", () => {
        if (!client.destroyed) {
          client.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
          client.destroy();
        }
      });
    })().catch(() => {
      if (!client.destroyed) {
        client.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        client.destroy();
      }
    });
  });
  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server, sockets);
    throw new Error("Public network proxy did not bind");
  }
  return {
    server: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server, sockets),
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function trackSocket(socket: Socket, sockets: Set<Socket>): void {
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
}

async function closeServer(server: Server, sockets: Set<Socket>): Promise<void> {
  for (const socket of sockets) socket.destroy();
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
