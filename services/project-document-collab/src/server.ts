import { Database } from "@hocuspocus/extension-database";
import { Server } from "@hocuspocus/server";
import * as Y from "yjs";

import {
  PROJECT_DOCUMENT_STATE_BYTES_MAX,
  type ProjectDocumentRole,
} from "../../../src/projectDocumentStore.ts";

export interface ProjectDocumentCollaborationIdentity {
  userId: number;
  email: string;
}

export interface ProjectDocumentCollaborationAccess {
  documentId: number;
  role: ProjectDocumentRole;
}

export interface ProjectDocumentCollaborationDependencies {
  allowedOrigins?: ReadonlySet<string>;
  authenticate(input: {
    token: string;
    cookie: string | undefined;
  }): Promise<ProjectDocumentCollaborationIdentity | undefined>;
  authorize(
    identity: ProjectDocumentCollaborationIdentity,
    collaborationDocumentId: string,
  ): Promise<ProjectDocumentCollaborationAccess | undefined>;
  load(collaborationDocumentId: string): Promise<Uint8Array | null>;
  store(collaborationDocumentId: string, state: Uint8Array): Promise<void>;
}

export interface ProjectDocumentCollaborationContext {
  userId: number;
  email: string;
  documentId: number;
  role: ProjectDocumentRole;
}

const normalizedOrigin = (value: string): string => value.replace(/\/$/, "");

export function createProjectDocumentCollaborationService(
  dependencies: ProjectDocumentCollaborationDependencies,
): Server<ProjectDocumentCollaborationContext> {
  const allowedOrigins = new Set(
    [...(dependencies.allowedOrigins ?? [])].map(normalizedOrigin),
  );

  return new Server<ProjectDocumentCollaborationContext>({
    quiet: true,
    debounce: 500,
    maxDebounce: 2_000,
    websocketOptions: { maxPayload: PROJECT_DOCUMENT_STATE_BYTES_MAX },
    extensions: [
      new Database({
        fetch: ({ documentName }) => dependencies.load(documentName),
        store: async ({ document, documentName, state }) => {
          try {
            await dependencies.store(documentName, state);
          } catch (error) {
            document.broadcastStateless(JSON.stringify({
              type: "project-document.persistence-error",
            }));
            throw error;
          }
        },
      }),
    ],
    async afterStoreDocument({ document }) {
      document.broadcastStateless(JSON.stringify({
        type: "project-document.persisted",
        persistedAt: new Date().toISOString(),
        stateVector: Buffer.from(Y.encodeStateVector(document)).toString("base64"),
      }));
    },
    async onAuthenticate({
      documentName,
      token,
      requestHeaders,
      connectionConfig,
    }) {
      const origin = requestHeaders.get("origin");
      if (allowedOrigins.size > 0 && (!origin || !allowedOrigins.has(normalizedOrigin(origin)))) {
        throw new Error("Origin not allowed");
      }
      const identity = await dependencies.authenticate({
        token,
        cookie: requestHeaders.get("cookie") ?? undefined,
      });
      if (!identity) throw new Error("Authentication required");
      const access = await dependencies.authorize(identity, documentName);
      if (!access) throw new Error("Document access denied");
      connectionConfig.readOnly = access.role === "viewer";
      return {
        ...identity,
        documentId: access.documentId,
        role: access.role,
      };
    },
  });
}
