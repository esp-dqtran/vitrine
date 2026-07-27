import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingHttpHeaders } from "node:http";
import { Socket } from "node:net";
import * as publicNetworkProxyModule from "./publicNetworkProxy.ts";

const { resolvePinnedPublicTarget } = publicNetworkProxyModule;

test("pins a public hostname to the validated address", async () => {
  const result = await resolvePinnedPublicTarget(
    "https://example.com:8443/app.js",
    async () => [{ address: "203.0.114.10", family: 4 }],
  );
  assert.deepEqual(result, {
    url: "https://example.com:8443/app.js",
    hostname: "example.com",
    port: 8443,
    address: "203.0.114.10",
    family: 4,
  });
});

test("rejects a hostname when any DNS answer is non-public", async () => {
  await assert.rejects(
    () => resolvePinnedPublicTarget(
      "https://example.com/",
      async () => [
        { address: "203.0.114.10", family: 4 },
        { address: "::ffff:7f00:1", family: 6 },
      ],
    ),
    /public/i,
  );
});

test("tracked proxy sockets tolerate late pipe errors", () => {
  const trackSocket = (
    publicNetworkProxyModule as typeof publicNetworkProxyModule & {
      trackSocket?: (socket: Socket, sockets: Set<Socket>) => void;
    }
  ).trackSocket;
  assert.equal(typeof trackSocket, "function");
  const socket = new Socket();
  const sockets = new Set<Socket>();

  trackSocket!(socket, sockets);

  assert.doesNotThrow(() => socket.emit("error", Object.assign(
    new Error("write EPIPE"),
    { code: "EPIPE" },
  )));
  socket.destroy();
});

test("plain HTTP forwarding removes proxy-only headers instead of sending undefined values", () => {
  const forwardProxyHeaders = (
    publicNetworkProxyModule as typeof publicNetworkProxyModule & {
      forwardProxyHeaders?: (
        headers: IncomingHttpHeaders,
        host: string,
      ) => IncomingHttpHeaders;
    }
  ).forwardProxyHeaders;
  assert.equal(typeof forwardProxyHeaders, "function");

  assert.deepEqual(
    forwardProxyHeaders!({
      accept: "text/html",
      host: "127.0.0.1:1234",
      "proxy-authorization": "Basic private",
      "proxy-connection": "keep-alive",
    }, "info.cern.ch"),
    {
      accept: "text/html",
      host: "info.cern.ch",
    },
  );
});
