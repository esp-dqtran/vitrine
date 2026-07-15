import { parseMission, type AppDossier, type AutonomousMission } from "./autonomousCrawler.ts";

export interface CoverageSnapshot {
  queued: number;
  running: number;
  recoverable: number;
  unansweredHighValue: number;
  newStates: number;
  newTransitions: number;
  plateauRounds: number;
  ceilingReached?: boolean;
}

export interface FollowupMissionProposal {
  capabilityId: string;
  mission: AutonomousMission;
}

export function planInitialMissions(dossier: AppDossier, allowAll: boolean): AutonomousMission[] {
  const candidates: AutonomousMission[] = [
    {
      missionKey: "authentication-and-navigation",
      goal: "Authenticate and map primary navigation",
      productArea: "Account",
      mode: "read",
      prerequisites: [],
      budget: { actions: 80, recoveries: 4 },
    },
    ...dossier.candidateFlows.map(({ id, title, productArea, mode, prerequisites }) => ({
      missionKey: id,
      goal: title,
      productArea,
      mode,
      prerequisites,
      budget: { actions: 120, recoveries: 5 },
    })),
  ];
  const unique = new Map<string, AutonomousMission>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.missionKey) && (candidate.mode === "read" || allowAll)) {
      unique.set(candidate.missionKey, parseMission(candidate, allowAll));
    }
  }
  return [...unique.values()].sort((left, right) => Number(left.mode === "mutate") - Number(right.mode === "mutate"));
}

export function planFollowupMissions(
  proposals: FollowupMissionProposal[],
  dossier: AppDossier,
  reportedCapabilities: string[],
  existingMissionKeys: ReadonlySet<string>,
  allowAll: boolean,
): AutonomousMission[] {
  const capabilities = new Set([...dossier.capabilities, ...reportedCapabilities]);
  const planned = new Map<string, AutonomousMission>();
  for (const proposal of proposals) {
    if (!capabilities.has(proposal.capabilityId)) throw new Error("Follow-up mission capability is not cited or observed");
    const mission = parseMission(proposal.mission, allowAll);
    if (!existingMissionKeys.has(mission.missionKey) && !planned.has(mission.missionKey)) {
      planned.set(mission.missionKey, mission);
    }
  }
  return [...planned.values()].sort((left, right) => Number(left.mode === "mutate") - Number(right.mode === "mutate"));
}

export function coverageDecision(input: CoverageSnapshot): "continue" | "complete" | "partial" {
  if (input.ceilingReached) return "partial";
  if (input.queued || input.running || input.recoverable || input.unansweredHighValue) return "continue";
  return input.newStates === 0 && input.newTransitions === 0 && input.plateauRounds >= 2 ? "complete" : "continue";
}
