import * as Y from "yjs";

export type ProjectDocumentPersistenceMessage =
  | {
      type: "project-document.persisted";
      persistedAt: string;
      stateVector: string;
    }
  | { type: "project-document.persistence-error" };

export function parseProjectDocumentPersistenceMessage(
  payload: string,
): ProjectDocumentPersistenceMessage | undefined {
  try {
    const message = JSON.parse(payload) as Partial<ProjectDocumentPersistenceMessage>;
    if (message.type === "project-document.persistence-error") {
      return { type: message.type };
    }
    if (
      message.type === "project-document.persisted"
      && typeof message.persistedAt === "string"
      && Number.isFinite(Date.parse(message.persistedAt))
      && typeof message.stateVector === "string"
      && message.stateVector.length > 0
      && message.stateVector.length <= 32_768
    ) {
      return {
        type: message.type,
        persistedAt: message.persistedAt,
        stateVector: message.stateVector,
      };
    }
  } catch {
    // Ignore stateless messages owned by other collaboration features.
  }
  return undefined;
}

export function decodeProjectDocumentStateVector(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function projectDocumentStateVectorCoversDocument(
  encodedStateVector: Uint8Array,
  document: Y.Doc,
): boolean {
  try {
    const persistedStateVector = Y.decodeStateVector(encodedStateVector);
    const currentStateVector = Y.decodeStateVector(Y.encodeStateVector(document));
    return [...currentStateVector].every(
      ([clientId, clock]) => (persistedStateVector.get(clientId) ?? 0) >= clock,
    );
  } catch {
    return false;
  }
}
