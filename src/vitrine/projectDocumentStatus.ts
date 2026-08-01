export type ProjectDocumentSaveState =
  | "Saved"
  | "Saving"
  | "Offline"
  | "Save failed";

export interface ProjectDocumentSyncState {
  indexedDbReady: boolean;
  connected: boolean;
  synced: boolean;
  dirty: boolean;
  disconnected: boolean;
  failed: boolean;
}

export function projectDocumentSaveState(
  state: ProjectDocumentSyncState,
): ProjectDocumentSaveState {
  if (state.disconnected) return "Offline";
  if (state.failed) return "Save failed";
  if (!state.indexedDbReady || !state.synced || state.dirty) return "Saving";
  if (!state.connected) return "Saving";
  return "Saved";
}
