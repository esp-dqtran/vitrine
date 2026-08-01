import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import type { SessionResolution } from "../../../src/authStore.ts";
import type { ProjectDocumentStore } from "../../../src/projectDocumentStore.ts";
import type { OctoBaseClient } from "./octobaseClient.ts";
import type { OctobaseYjsBridge } from "./octobaseYjsBridge.ts";
import { cookieValue, SESSION_COOKIE } from "./sessionCookie.ts";
import {
  projectDocumentShareHash,
  validProjectDocumentShareToken,
} from "./projectDocumentShares.ts";

export interface ProjectDocumentSyncGateway {
  handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void>;
  close(): void;
}

export interface ProjectDocumentSyncDependencies {
  enabled: boolean;
  testProjectId?: number;
  store: ProjectDocumentStore;
  octobaseClient: OctoBaseClient;
  bridge: OctobaseYjsBridge;
  resolveSessionState(token: string): Promise<SessionResolution>;
  revalidateMs?: number;
}

const positiveId = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export function createProjectDocumentSyncGateway(
  deps: ProjectDocumentSyncDependencies,
): ProjectDocumentSyncGateway {
  const active = new Map<Duplex, NodeJS.Timeout>();
  const revalidateMs = deps.revalidateMs ?? 30_000;
  let closed = false;

  function reject(socket: Duplex): void {
    socket.destroy();
  }

  return {
    async handleUpgrade(request, socket, head) {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const ownerMatch = url.pathname.match(
        /^\/project-document-sync\/([^/]+)\/([^/]+)$/,
      );
      const shareMatch = url.pathname.match(
        /^\/project-document-share-sync\/([^/]+)\/([^/]+)$/,
      );
      if (!ownerMatch && !shareMatch) return;
      const projectId = ownerMatch
        ? positiveId(ownerMatch[1]!)
        : deps.testProjectId;
      const documentId = positiveId(
        (ownerMatch ?? shareMatch)?.[2] ?? "",
      );
      if (
        closed ||
        !deps.enabled ||
        !projectId ||
        !documentId ||
        !deps.testProjectId ||
        projectId !== deps.testProjectId
      ) {
        reject(socket);
        return;
      }

      let document;
      let revalidate: (() => Promise<boolean>) | undefined;
      let readOnly = false;
      let writerUserId: number | undefined;
      if (shareMatch) {
        const shareToken = validProjectDocumentShareToken(shareMatch[1]);
        if (!shareToken || !deps.store.publicShare) {
          reject(socket);
          return;
        }
        const shareHash = projectDocumentShareHash(shareToken);
        const shared = await deps.store.publicShare(shareHash);
        if (
          !shared ||
          shared.document.id !== documentId ||
          shared.document.projectId !== projectId
        ) {
          reject(socket);
          return;
        }
        document = shared.document;
        readOnly = true;
        revalidate = async () => {
          const current = await deps.store.publicShare?.(shareHash);
          return Boolean(
            current &&
              current.document.id === documentId &&
              current.document.projectId === projectId,
          );
        };
      } else {
        const sessionToken = cookieValue(
          request.headers.cookie,
          SESSION_COOKIE,
        );
        if (!sessionToken) {
          reject(socket);
          return;
        }
        const resolution = await deps.resolveSessionState(sessionToken);
        if (resolution.status !== "authenticated") {
          reject(socket);
          return;
        }
        const access = deps.store.accessForUser
          ? await deps.store.accessForUser(resolution.user.id, projectId)
          : {
              ownerUserId: resolution.user.id,
              role: "owner" as const,
            };
        if (!access) {
          reject(socket);
          return;
        }
        document = await deps.store.findOwned(
          access.ownerUserId,
          projectId,
          documentId,
        );
        if (!document) {
          reject(socket);
          return;
        }
        readOnly = access.role === "viewer";
        const originalUserId = resolution.user.id;
        writerUserId = originalUserId;
        const originalRole = access.role;
        revalidate = async () => {
          const current = await deps.resolveSessionState(sessionToken);
          if (
            current.status !== "authenticated" ||
            current.user.id !== originalUserId
          ) {
            return false;
          }
          const currentAccess = deps.store.accessForUser
            ? await deps.store.accessForUser(originalUserId, projectId)
            : {
                ownerUserId: originalUserId,
                role: "owner" as const,
              };
          return Boolean(
            currentAccess &&
              currentAccess.ownerUserId === access.ownerUserId &&
              currentAccess.role === originalRole,
          );
        };
      }

      let token: string;
      try {
        token = await deps.octobaseClient.accessToken();
      } catch {
        reject(socket);
        return;
      }
      let touchTimer: NodeJS.Timeout | undefined;
      const touchLastEdited = () => {
        if (!writerUserId || !deps.store.touchLastEdited) return;
        if (touchTimer) clearTimeout(touchTimer);
        touchTimer = setTimeout(() => {
          void deps.store
            .touchLastEdited!(
              document.ownerUserId,
              projectId,
              documentId,
              writerUserId!,
            )
            .catch(() => undefined);
        }, 750);
        touchTimer.unref();
      };
      deps.bridge.accept(request, socket, head, {
        workspaceId: document.octobaseDocumentId,
        token,
        ...(readOnly ? { readOnly: true } : {}),
        ...(!readOnly ? { onWrite: touchLastEdited } : {}),
      });

      let validating = false;
      const interval = setInterval(async () => {
        if (validating || socket.destroyed) return;
        validating = true;
        try {
          if (!(await revalidate?.())) socket.destroy();
        } catch {
          socket.destroy();
        } finally {
          validating = false;
        }
      }, revalidateMs);
      interval.unref();
      active.set(socket, interval);
      const cleanup = () => {
        clearInterval(interval);
        if (touchTimer) clearTimeout(touchTimer);
        active.delete(socket);
      };
      socket.once("close", cleanup);
      socket.once("error", cleanup);
    },

    close() {
      if (closed) return;
      closed = true;
      for (const [socket, interval] of active) {
        clearInterval(interval);
        socket.destroy();
      }
      active.clear();
      deps.bridge.close();
    },
  };
}
