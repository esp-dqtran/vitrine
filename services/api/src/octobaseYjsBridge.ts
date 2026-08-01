import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import WebSocket, { WebSocketServer, type RawData } from "ws";
import * as decoding from "lib0/decoding";

import { translateOctobaseYjsFrame } from "./octobaseYjsCompatibility.ts";

const MAX_PENDING_BYTES = 1_048_576;

export interface OctobaseYjsBridge {
  accept(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    target: {
      workspaceId: string;
      token: string;
      readOnly?: boolean;
      onWrite?(): void;
    },
  ): void;
  close(): void;
}

function rawDataBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

export function shouldForwardReadOnlyYjsFrame(
  data: Uint8Array,
): boolean {
  try {
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);
    if (messageType !== 0) return false;
    const syncMessageType = decoding.readVarUint(decoder);
    return syncMessageType === 0;
  } catch {
    return false;
  }
}

export function isWritableYjsFrame(data: Uint8Array): boolean {
  try {
    const decoder = decoding.createDecoder(data);
    if (decoding.readVarUint(decoder) !== 0) return false;
    return decoding.readVarUint(decoder) !== 0;
  } catch {
    return false;
  }
}

export function createOctobaseYjsBridge(octobaseUrl: string): OctobaseYjsBridge {
  const upstreamBase = octobaseUrl.replace(/^http/, "ws").replace(/\/+$/, "");
  const server = new WebSocketServer({
    noServer: true,
    handleProtocols: protocols => protocols.has("AFFiNE") ? "AFFiNE" : false,
  });
  const downstreamSockets = new Set<WebSocket>();
  const upstreamSockets = new Set<WebSocket>();

  function accept(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    target: {
      workspaceId: string;
      token: string;
      readOnly?: boolean;
      onWrite?(): void;
    },
  ): void {
    server.handleUpgrade(request, socket, head, downstream => {
      downstreamSockets.add(downstream);
      const upstream = new WebSocket(
        `${upstreamBase}/api/sync/${encodeURIComponent(target.workspaceId)}` +
          `?token=${encodeURIComponent(target.token)}`,
        ["AFFiNE"],
      );
      upstreamSockets.add(upstream);

      const pending: Buffer[] = [];
      let pendingBytes = 0;
      let closed = false;

      const closeBoth = () => {
        if (closed) return;
        closed = true;
        downstreamSockets.delete(downstream);
        upstreamSockets.delete(upstream);
        if (
          downstream.readyState === WebSocket.OPEN ||
          downstream.readyState === WebSocket.CONNECTING
        ) {
          downstream.close();
        }
        if (
          upstream.readyState === WebSocket.OPEN ||
          upstream.readyState === WebSocket.CONNECTING
        ) {
          upstream.close();
        }
      };

      downstream.on("message", data => {
        const message = rawDataBuffer(data);
        if (
          target.readOnly &&
          !shouldForwardReadOnlyYjsFrame(message)
        ) {
          return;
        }
        if (!target.readOnly && isWritableYjsFrame(message)) {
          target.onWrite?.();
        }
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(message, { binary: true });
          return;
        }
        pendingBytes += message.length;
        if (pendingBytes > MAX_PENDING_BYTES) {
          closeBoth();
          return;
        }
        pending.push(message);
      });
      downstream.once("close", closeBoth);
      downstream.once("error", closeBoth);

      upstream.once("open", () => {
        for (const message of pending) {
          upstream.send(message, { binary: true });
        }
        pending.length = 0;
        pendingBytes = 0;
      });
      upstream.on("message", data => {
        if (downstream.readyState !== WebSocket.OPEN) return;
        downstream.send(
          translateOctobaseYjsFrame(
            rawDataBuffer(data),
            target.workspaceId,
          ),
          { binary: true },
        );
      });
      upstream.once("close", closeBoth);
      upstream.once("error", closeBoth);
    });
  }

  return {
    accept,
    close() {
      for (const socket of downstreamSockets) socket.terminate();
      for (const socket of upstreamSockets) socket.terminate();
      downstreamSockets.clear();
      upstreamSockets.clear();
      server.close();
    },
  };
}
