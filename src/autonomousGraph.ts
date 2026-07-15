import { createHash } from "node:crypto";
import type { MissionMode, MissionStatus, StateFingerprint } from "./autonomousCrawler.ts";
import type { DesignFlow } from "./designSystem.ts";

export interface StateIdentityInput {
  normalizedUrl: string;
  title: string;
  landmarks: string[];
  domHash: string;
  screenshotHash: string;
  accountStateVersion: number;
}

export interface FlowProvenance {
  autonomousRunId: string;
  missionId: string;
  confidence: number;
  sourceUrls: string[];
  validationStatus: "complete" | "uncertain" | "incomplete";
}

interface GraphMission {
  id: string;
  run_id: string;
  missionKey: string;
  goal: string;
  productArea: string;
  mode: MissionMode;
  status: MissionStatus;
  result: unknown;
}

interface GraphState {
  id: string;
  run_id: string;
  platform?: string;
  version_id?: number;
  evidence_id: string | null;
  normalizedUrl: string;
  label: string;
  productArea: string;
  accountStateVersion: number;
  fingerprint: StateFingerprint;
}

interface GraphTransition {
  id: string;
  run_id: string;
  mission_id: string;
  source_state_id: string | null;
  destination_state_id: string | null;
  outcome: "completed" | "failed" | "blocked";
  confidence: number;
}

export interface GraphAssemblyInput {
  runId: string;
  platform: string;
  versionId?: number;
  missions: GraphMission[];
  states: GraphState[];
  transitions: GraphTransition[];
  verifiedEvidenceIds: ReadonlySet<string>;
}

export interface RejectedGraphFlow {
  missionId: string;
  flow: DesignFlow;
  reasons: string[];
}

export interface GraphFlowCandidates {
  flows: DesignFlow[];
  rejected: RejectedGraphFlow[];
}

export function normalizeAutonomousUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export function stateKey(input: StateIdentityInput): string {
  const landmarks = [...new Set(input.landmarks.map((value) => value.trim()).filter(Boolean))].sort();
  return createHash("sha256").update(JSON.stringify({
    url: normalizeAutonomousUrl(input.normalizedUrl),
    title: input.title.trim(),
    landmarks,
    domHash: input.domHash,
    screenshotHash: input.screenshotHash,
    accountStateVersion: input.accountStateVersion,
  })).digest("hex");
}

function sourceUrls(result: unknown): string[] {
  if (!result || typeof result !== "object" || Array.isArray(result)) return [];
  const value = (result as { sourceUrls?: unknown }).sourceUrls;
  return Array.isArray(value)
    ? [...new Set(value.filter((url): url is string => typeof url === "string" && url.trim() !== "").map((url) => url.trim()))]
    : [];
}

function evidenceId(state: GraphState): number | undefined {
  if (state.evidence_id == null || !/^\d+$/.test(state.evidence_id)) return undefined;
  const id = Number(state.evidence_id);
  return Number.isSafeInteger(id) ? id : undefined;
}

function statusFor(reasons: string[]): FlowProvenance["validationStatus"] {
  return reasons.length === 0 ? "complete" : reasons.every((reason) => reason.startsWith("confidence ")) ? "uncertain" : "incomplete";
}

export function assembleGraphFlowCandidates(input: GraphAssemblyInput): GraphFlowCandidates {
  const states = new Map(input.states.map((state) => [state.id, state]));
  const flows: DesignFlow[] = [];
  const rejected: RejectedGraphFlow[] = [];

  for (const mission of input.missions) {
    const reasons: string[] = [];
    const missionTransitions = input.transitions.filter((transition) => transition.mission_id === mission.id);
    const completed = missionTransitions.filter((transition) => transition.outcome === "completed");

    if (mission.run_id !== input.runId) reasons.push(`mission ${mission.id} belongs to run ${mission.run_id}`);
    if (mission.status !== "succeeded") reasons.push(`mission ${mission.id} status is ${mission.status}`);
    if (missionTransitions.some((transition) => transition.run_id !== input.runId)) reasons.push(`mission ${mission.id} contains transitions from another run`);
    if (missionTransitions.some((transition) => transition.outcome !== "completed")) reasons.push(`mission ${mission.id} contains unsuccessful transitions`);
    if (completed.length === 0) reasons.push(`mission ${mission.id} has no successful transitions`);

    const path: GraphState[] = [];
    for (const [index, transition] of completed.entries()) {
      const source = transition.source_state_id ? states.get(transition.source_state_id) : undefined;
      const destination = transition.destination_state_id ? states.get(transition.destination_state_id) : undefined;
      if (!source) reasons.push(`transition ${transition.id} has no source state`);
      if (!destination) reasons.push(`transition ${transition.id} has no destination state`);
      if (!source || !destination) continue;
      if (index === 0) path.push(source);
      else if (path.at(-1)?.id !== source.id) reasons.push(`transition ${transition.id} does not continue the mission path`);
      path.push(destination);
    }

    for (const state of path) {
      if (state.run_id !== input.runId) reasons.push(`state ${state.id} belongs to run ${state.run_id}`);
      if (state.platform != null && state.platform !== input.platform) reasons.push(`state ${state.id} belongs to platform ${state.platform}`);
      if (input.versionId != null && state.version_id != null && state.version_id !== input.versionId) reasons.push(`state ${state.id} belongs to version ${state.version_id}`);
    }

    for (const state of path.slice(1)) {
      if (evidenceId(state) == null || state.evidence_id == null || !input.verifiedEvidenceIds.has(state.evidence_id)) {
        reasons.push(`state ${state.id} has no verified destination evidence`);
      }
    }
    const first = path[0];
    if (first && (evidenceId(first) == null || first.evidence_id == null || !input.verifiedEvidenceIds.has(first.evidence_id))) {
      reasons.push(`state ${first.id} has no verified evidence`);
    }

    const seen = new Set<string>();
    for (const state of path) {
      if (seen.has(state.id)) reasons.push(`path repeats state ${state.id}`);
      seen.add(state.id);
    }

    const confidence = completed.length ? Math.min(...completed.map((transition) => transition.confidence)) : 0;
    if (confidence < 0.85) reasons.push(`confidence ${confidence} is below 0.85`);

    const flow: DesignFlow = {
      id: mission.missionKey,
      title: mission.goal,
      description: mission.goal,
      tags: [mission.productArea],
      steps: path.flatMap((state) => {
        const id = evidenceId(state);
        return id == null ? [] : [{ label: state.label, evidence: [id] }];
      }),
      provenance: {
        autonomousRunId: input.runId,
        missionId: mission.id,
        confidence,
        sourceUrls: sourceUrls(mission.result),
        validationStatus: statusFor(reasons),
      },
    };

    if (reasons.length === 0) flows.push(flow);
    else rejected.push({ missionId: mission.id, flow, reasons: [...new Set(reasons)] });
  }

  return { flows, rejected };
}

export function assembleGraphFlows(input: GraphAssemblyInput): DesignFlow[] {
  return assembleGraphFlowCandidates(input).flows;
}
