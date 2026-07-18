import { useCallback, useEffect, useState } from "react";
import { Button, CheckboxInput, Selector, TextArea, TextInput } from "@astryxdesign/core";
import { parseCrawlPlan, type CrawlPlan, type CrawlStep } from "../../crawlPlan";
import type {
  CrawlPlanView,
  AutonomousRunDetailView,
  CreateAutonomousRunRequest,
  CrawlRepairView,
  CrawlResearchProvider,
  CrawlRunDetailView,
  CreateCrawlRunRequest,
  Job,
} from "../types";
import {
  applyCrawlRepair,
  approveCrawlPlan,
  cancelCrawlRun,
  createCrawlRun,
  getCrawlPlan,
  getCrawlRun,
  listCrawlPlans,
  listCrawlRuns,
  rejectCrawlRepair,
  requestCrawlRepair,
  researchCrawlApp,
  retryCrawlRun,
  saveCrawlPlan,
  createAutonomousRun,
  getAutonomousRun,
  pauseAutonomousRun,
  cancelAutonomousRun,
  resumeAutonomousRun,
  saveCrawlSession,
} from "../researchApi";
import { useJobs } from "../useJobs";

interface PollingTimers {
  set(callback: () => void): unknown;
  clear(timer: unknown): void;
}

const pollingTimers: PollingTimers = {
  set: (callback) => setInterval(callback, 1_500),
  clear: (timer) => clearInterval(timer as ReturnType<typeof setInterval>),
};

export function startRunPolling(
  load: () => Promise<CrawlRunDetailView>,
  update: (value: CrawlRunDetailView) => void,
  timers: PollingTimers = pollingTimers,
  fail: (error: unknown) => void = () => undefined,
  settled?: (value: CrawlRunDetailView) => void | Promise<void>,
): () => void {
  let active = true;
  const poll = () => {
    void load().then((value) => {
      if (!active) return;
      update(value);
      if (settledRunStatuses.has(value.run.status) && settled) {
        void Promise.resolve().then(() => settled(value)).catch(fail);
      }
    }).catch((error) => {
      if (active) fail(error);
    });
  };
  poll();
  const timer = timers.set(poll);
  return () => {
    active = false;
    timers.clear(timer);
  };
}

export function shouldPollRunStatus(status: CrawlRunDetailView["run"]["status"]): boolean {
  return status === "queued" || status === "running" || status === "interrupted";
}

export function preparePlanRevision(planJson: string, current: CrawlPlanView): CrawlPlan {
  let value: unknown;
  try {
    value = JSON.parse(planJson);
  } catch {
    throw new Error("Plan must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Plan must be a JSON object");
  return parseCrawlPlan(JSON.stringify({
    ...value,
    app: current.app,
    revision: current.revision + 1,
    reviewed: false,
  }));
}

interface CrawlWorkspaceCommandApi {
  researchCrawlApp: typeof researchCrawlApp;
  saveCrawlPlan: typeof saveCrawlPlan;
  approveCrawlPlan: typeof approveCrawlPlan;
  createCrawlRun: typeof createCrawlRun;
  cancelCrawlRun: typeof cancelCrawlRun;
  retryCrawlRun: typeof retryCrawlRun;
  requestCrawlRepair: typeof requestCrawlRepair;
  applyCrawlRepair: typeof applyCrawlRepair;
  rejectCrawlRepair: typeof rejectCrawlRepair;
  createAutonomousRun?: typeof createAutonomousRun;
  pauseAutonomousRun?: typeof pauseAutonomousRun;
  cancelAutonomousRun?: typeof cancelAutonomousRun;
  resumeAutonomousRun?: typeof resumeAutonomousRun;
  saveCrawlSession?: typeof saveCrawlSession;
}

const commandApi: CrawlWorkspaceCommandApi = {
  researchCrawlApp,
  saveCrawlPlan,
  approveCrawlPlan,
  createCrawlRun,
  cancelCrawlRun,
  retryCrawlRun,
  requestCrawlRepair,
  applyCrawlRepair,
  rejectCrawlRepair,
  createAutonomousRun,
  pauseAutonomousRun,
  cancelAutonomousRun,
  resumeAutonomousRun,
  saveCrawlSession,
};

export function createCrawlWorkspaceCommands(api: CrawlWorkspaceCommandApi = commandApi) {
  return {
    research: (app: string, homepageUrl: string, provider?: CrawlResearchProvider) =>
      api.researchCrawlApp(app, homepageUrl, provider),
    save: (current: CrawlPlanView, planJson: string) =>
      api.saveCrawlPlan(current.id, preparePlanRevision(planJson, current)),
    approve: (planId: string) => api.approveCrawlPlan(planId),
    async start(
      app: string,
      planId: string,
      request: Omit<CreateCrawlRunRequest, "planId" | "mode">,
      onDraftVersionChange?: () => void | Promise<void>,
    ) {
      const run = await api.createCrawlRun(app, { planId, mode: "full", ...request });
      try {
        void Promise.resolve(onDraftVersionChange?.()).catch(() => undefined);
      } catch {
        // The durable run already exists; a view refresh cannot turn creation into failure.
      }
      return run;
    },
    cancel: (runId: string) => api.cancelCrawlRun(runId),
    retry: (runId: string, mode: "full" | "failed") => api.retryCrawlRun(runId, mode),
    proposeRepair: (runId: string, flowId: string, stepId: string, provider: CrawlResearchProvider) =>
      api.requestCrawlRepair(runId, { flowId, stepId, provider }),
    reviewRepair: (repairId: string, decision: "apply" | "reject") =>
      decision === "apply" ? api.applyCrawlRepair(repairId) : api.rejectCrawlRepair(repairId),
    startAutonomous: (app: string, request: CreateAutonomousRunRequest) => {
      if (!api.createAutonomousRun) throw new Error("Autonomous crawl API is unavailable");
      return api.createAutonomousRun(app, request);
    },
    pauseAutonomous: (runId: string) => {
      if (!api.pauseAutonomousRun) throw new Error("Autonomous crawl API is unavailable");
      return api.pauseAutonomousRun(runId);
    },
    cancelAutonomous: (runId: string) => {
      if (!api.cancelAutonomousRun) throw new Error("Autonomous crawl API is unavailable");
      return api.cancelAutonomousRun(runId);
    },
    resumeAutonomous: (runId: string, acknowledged: boolean) => {
      if (!api.resumeAutonomousRun) throw new Error("Autonomous crawl API is unavailable");
      return api.resumeAutonomousRun(runId, acknowledged);
    },
    saveSession: (app: string, storageState: unknown) => {
      if (!api.saveCrawlSession) throw new Error("Autonomous crawl API is unavailable");
      return api.saveCrawlSession(app, storageState);
    },
  };
}

const workspaceCommands = createCrawlWorkspaceCommands();

async function loadWorkspace(app: string): Promise<{ plan?: CrawlPlanView; run?: CrawlRunDetailView; runPlan?: CrawlPlanView }> {
  const [plans, runs] = await Promise.all([listCrawlPlans(app), listCrawlRuns(app)]);
  const run = runs[0] ? await getCrawlRun(runs[0].id) : undefined;
  const runPlan = run?.run.plan_id
    ? plans.find(({ id }) => id === run.run.plan_id) ?? await getCrawlPlan(run.run.plan_id)
    : undefined;
  return {
    ...(plans[0] ? { plan: plans[0] } : {}),
    ...(run ? { run } : {}),
    ...(runPlan ? { runPlan } : {}),
  };
}

interface CrawlWorkspacePanelProps {
  app: string;
  role: "admin" | "user";
  initialPlan?: CrawlPlanView;
  initialRun?: CrawlRunDetailView;
  initialRunPlan?: CrawlPlanView;
  initialRepairs?: CrawlRepairView[];
  initialResearchJob?: Job;
  onDraftVersionChange?: () => void | Promise<void>;
}

export function CrawlWorkspacePanel({ app, role, initialPlan, initialRun, initialRunPlan, initialRepairs = [], initialResearchJob, onDraftVersionChange }: CrawlWorkspacePanelProps) {
  if (role !== "admin") return null;
  return <AdminCrawlWorkspace initialApp={app} initialPlan={initialPlan} initialRun={initialRun} initialRunPlan={initialRunPlan} initialRepairs={initialRepairs} initialResearchJob={initialResearchJob} onDraftVersionChange={onDraftVersionChange} />;
}

function AdminCrawlWorkspace({
  initialApp,
  initialPlan,
  initialRun,
  initialRunPlan,
  initialRepairs,
  initialResearchJob,
  onDraftVersionChange,
}: {
  initialApp: string;
  initialPlan?: CrawlPlanView;
  initialRun?: CrawlRunDetailView;
  initialRunPlan?: CrawlPlanView;
  initialRepairs: CrawlRepairView[];
  initialResearchJob?: Job;
  onDraftVersionChange?: () => void | Promise<void>;
}) {
  const [app, setApp] = useState(initialApp);
  const [homepageUrl, setHomepageUrl] = useState(initialPlan?.plan.startUrl ?? "");
  const [planJson, setPlanJson] = useState(initialPlan ? JSON.stringify(initialPlan.plan, null, 2) : "");
  const [plan, setPlan] = useState(initialPlan);
  const [run, setRun] = useState(initialRun);
  const [runPlan, setRunPlan] = useState(initialRunPlan ?? (
    initialRun && initialPlan?.id === initialRun.run.plan_id ? initialPlan : undefined
  ));
  const [repairs, setRepairs] = useState(initialRepairs);
  const [researchJob, setResearchJob] = useState(initialResearchJob);
  const [researchJobId, setResearchJobId] = useState(initialResearchJob?.id);
  const [refreshedResearchJobId, setRefreshedResearchJobId] = useState<number>();
  const [headless, setHeadless] = useState(true);
  const [unsafeApproved, setUnsafeApproved] = useState(false);
  const [disposableAccountAcknowledged, setDisposableAccountAcknowledged] = useState(false);
  const [allowSideEffects, setAllowSideEffects] = useState(false);
  const [autonomousRun, setAutonomousRun] = useState<AutonomousRunDetailView>();
  const [autonomousProvider, setAutonomousProvider] = useState<CrawlResearchProvider>("chatgpt");
  const [autonomousPlatform, setAutonomousPlatform] = useState<"web" | "ios" | "android">("web");
  const [requiredSecretNames, setRequiredSecretNames] = useState("");
  const [allowAll, setAllowAll] = useState(false);
  const [allowAllAcknowledged, setAllowAllAcknowledged] = useState(false);
  const [agentConcurrency, setAgentConcurrency] = useState(3);
  const [sessionJson, setSessionJson] = useState('{"cookies":[],"origins":[]}');
  const [sessionStatus, setSessionStatus] = useState("Not uploaded");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { jobs, error: jobsError, refresh: refreshJobs } = useJobs();

  const acceptPlan = useCallback((next: CrawlPlanView | undefined) => {
    setPlan(next);
    setPlanJson(next ? JSON.stringify(next.plan, null, 2) : "");
    if (next) setHomepageUrl(next.plan.startUrl);
  }, []);

  const refreshWorkspace = useCallback(async (slug: string) => {
    const next = await loadWorkspace(slug);
    acceptPlan(next.plan);
    setRun(next.run);
    setRunPlan(next.runPlan);
    setRepairs(next.run?.repairs ?? []);
  }, [acceptPlan]);

  useEffect(() => {
    if (initialPlan || initialRun) return;
    let active = true;
    void loadWorkspace(initialApp).then((next) => {
      if (!active) return;
      acceptPlan(next.plan);
      setRun(next.run);
      setRunPlan(next.runPlan);
      setRepairs(next.run?.repairs ?? []);
    }).catch((error) => {
      if (active) setMessage((error as Error).message);
    });
    return () => { active = false; };
  }, [acceptPlan, initialApp, initialPlan, initialRun]);

  useEffect(() => {
    if (!researchJobId) return;
    const next = jobs.find((job) => job.id === researchJobId);
    if (!next) return;
    setResearchJob(next);
    if (next.status === "done" && refreshedResearchJobId !== next.id) {
      setRefreshedResearchJobId(next.id);
      void refreshWorkspace(app).catch((error) => setMessage((error as Error).message));
    }
  }, [app, jobs, refreshedResearchJobId, refreshWorkspace, researchJobId]);

  useEffect(() => {
    if (!run || !shouldPollRunStatus(run.run.status)) return;
    return startRunPolling(
      () => getCrawlRun(run.run.id),
      (next) => {
        setRun(next);
        setRepairs(next.repairs ?? []);
      },
      undefined,
      (error) => setMessage((error as Error).message),
      onDraftVersionChange ? () => onDraftVersionChange() : undefined,
    );
  }, [run?.run.id, run?.run.status]);

  useEffect(() => {
    if (!autonomousRun || !shouldPollRunStatus(autonomousRun.run.status)) return;
    const poll = () => void getAutonomousRun(autonomousRun.run.id).then(setAutonomousRun).catch((error) => setMessage((error as Error).message));
    const timer = setInterval(poll, 1_500);
    return () => clearInterval(timer);
  }, [autonomousRun?.run.id, autonomousRun?.run.status]);

  const perform = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const generateResearch = () => perform(async () => {
    const queued = await workspaceCommands.research(app.trim(), homepageUrl.trim());
    const job: Job = {
      id: queued.jobId,
      parent_id: null,
      type: "research-app",
      payload: { name: queued.app, homepageUrl: queued.homepageUrl },
      status: "queued",
      message: null,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    setResearchJob(job);
    setResearchJobId(job.id);
    setRefreshedResearchJobId(undefined);
    setMessage(`Research queued as job ${job.id}.`);
    await refreshJobs();
  });

  const saveRevision = () => perform(async () => {
    if (!plan) throw new Error("Generate a crawl plan first");
    acceptPlan(await workspaceCommands.save(plan, planJson));
    setMessage("Saved a new unapproved plan revision.");
  });

  const approve = () => perform(async () => {
    if (!plan) throw new Error("Generate a crawl plan first");
    acceptPlan(await workspaceCommands.approve(plan.id));
    setMessage("Plan approved.");
  });

  const start = () => perform(async () => {
    if (!plan) throw new Error("Approve a crawl plan first");
    const created = await workspaceCommands.start(app, plan.id, {
      unsafeApproved,
      disposableAccountAcknowledged,
      allowSideEffects,
      environment: { headless, browserName: "chromium" },
    }, onDraftVersionChange ? () => Promise.resolve()
      .then(() => onDraftVersionChange())
      .catch((error) => { setMessage(`Run queued; version refresh failed: ${(error as Error).message}`); }) : undefined);
    setRun({ run: created, steps: [], evidence: [], repairs: [] });
    setRunPlan(plan);
    setRepairs([]);
    setMessage(`Run ${created.id} queued.`);
  });

  const cancel = () => perform(async () => {
    if (!run) return;
    const updated = await workspaceCommands.cancel(run.run.id);
    setRun({ ...run, run: updated });
    setMessage("Cancellation requested.");
  });

  const retry = (mode: "full" | "failed") => perform(async () => {
    if (!run) return;
    const created = await workspaceCommands.retry(run.run.id, mode);
    setRun({ run: created, steps: [], evidence: [], repairs: [] });
    if (runPlan?.id !== created.plan_id) setRunPlan(plan?.id === created.plan_id ? plan : undefined);
    setRepairs([]);
    setMessage(`Retry run ${created.id} queued.`);
  });

  const proposeRepair = (flowId: string, stepId: string) => perform(async () => {
    if (!run) return;
    const proposed = await workspaceCommands.proposeRepair(run.run.id, flowId, stepId, "chatgpt");
    setRepairs((current) => [...current.filter(({ id }) => id !== proposed.id), proposed]);
  });

  const reviewRepair = (repair: CrawlRepairView, decision: "apply" | "reject") => perform(async () => {
    const reviewed = await workspaceCommands.reviewRepair(repair.id, decision);
    setRepairs((current) => current.map((item) => item.id === reviewed.id ? reviewed : item));
    if (decision === "apply") await refreshWorkspace(app);
    setMessage(decision === "apply" ? "Repair applied as a new unapproved plan revision." : "Repair rejected.");
  });

  const startAutonomous = () => perform(async () => {
    const created = await workspaceCommands.startAutonomous(app.trim(), {
      homepageUrl: homepageUrl.trim(),
      platform: autonomousPlatform,
      provider: autonomousProvider,
      requiredSecrets: [...new Set(requiredSecretNames.split(",").map((name) => name.trim()).filter(Boolean))],
      allowAll,
      allowAllAcknowledged,
      ceilings: { runtimeMinutes: 120, actions: 500, modelRequests: 50, storageBytes: 100_000_000 },
      agentConcurrency,
    });
    setAutonomousRun({ run: created, missions: [], states: [], transitions: [] });
    setMessage(`Autonomous run ${created.id} queued.`);
  });

  const saveSharedSession = () => perform(async () => {
    const storageState = JSON.parse(sessionJson) as unknown;
    const saved = await workspaceCommands.saveSession(app.trim(), storageState);
    setSessionStatus(`Version ${saved.stateVersion}`);
  });

  let displayedPlan = plan?.plan;
  try {
    displayedPlan = planJson ? parseCrawlPlan(planJson) : undefined;
  } catch {
    // Keep the last valid server copy visible while the curator repairs draft JSON.
  }
  const canStartPlan = plan?.status === "approved"
    && (!run || (terminalStatuses.has(run.run.status) && run.run.plan_id !== plan.id));

  return (
    <section aria-label={`${app || "Application"} intelligent crawler`} style={workspaceStyle}>
      <header>
        <h2 style={titleStyle}>Intelligent crawler</h2>
        <p style={mutedStyle}>Research, approve, run, and review captured evidence before publication.</p>
      </header>

      <section style={panelStyle}>
        <h3>Research and plan</h3>
        <div style={fieldsStyle}>
          <div style={fieldStyle}><TextInput label="App slug" htmlName="app" value={app} onChange={setApp} width="100%" /></div>
          <div style={{ ...fieldStyle, flex: 2 }}><TextInput label="Public homepage" htmlName="homepageUrl" value={homepageUrl} onChange={setHomepageUrl} placeholder="https://www.example.com" width="100%" /></div>
          <Button variant="primary" label={plan ? "Regenerate research" : "Generate research"} isDisabled={busy || !app.trim() || !homepageUrl.trim()} isLoading={busy} clickAction={generateResearch} />
        </div>
        {researchJob && (
          <p role="status" style={researchJob.status === "error" ? warningStyle : mutedStyle}>
            Research {researchJob.status}{researchJob.message ? ` · ${researchJob.message}` : ""}
          </p>
        )}
        {plan && displayedPlan ? (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <div style={fieldsStyle}>
              <strong>Revision {plan.revision}</strong>
              <span style={badgeStyle}>{label(plan.status)}</span>
              <span style={{ ...mutedStyle, marginLeft: "auto" }}>{displayedPlan.reviewed ? "Reviewed" : "Awaiting approval"}</span>
            </div>
            <div>
              <strong style={smallHeadingStyle}>Sources</strong>
              <ul style={listStyle}>{displayedPlan.sources.map((source) => <li key={source}><a href={source} target="_blank" rel="noreferrer" style={linkStyle}>{source}</a></li>)}</ul>
            </div>
            {plan.requiredSecrets.length > 0 && (
              <div>
                <strong style={smallHeadingStyle}>Required secrets</strong>
                <div style={fieldsStyle}>{plan.requiredSecrets.map((secret) => (
                  <span key={secret.name} style={badgeStyle}>{secret.name} · {secret.configured ? "Configured" : "Missing"}</span>
                ))}</div>
              </div>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {displayedPlan.flows.map((flow) => (
                <article key={flow.id} style={nestedStyle}>
                  <div style={fieldsStyle}><code>{flow.id}</code><strong>{flow.title}</strong><span style={badgeStyle}>{flow.safe ? "Safe" : "Unsafe"}</span></div>
                  <p style={mutedStyle}>{flow.description}</p>
                  <ol style={listStyle}>{flow.steps.map((step) => (
                    <li key={step.id}><code>{step.id}</code> · {step.action} · {step.safety} · {step.expected.state}</li>
                  ))}</ol>
                </article>
              ))}
            </div>
            <TextArea label="Editable plan JSON" value={planJson} onChange={setPlanJson} rows={18} hasSpellCheck={false} width="100%" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }} />
            <div style={fieldsStyle}>
              <Button label="Save revision" isDisabled={busy} isLoading={busy} clickAction={saveRevision} />
              {plan.status !== "approved" && <Button variant="primary" label="Approve plan" isDisabled={busy} isLoading={busy} clickAction={approve} />}
            </div>
          </div>
        ) : <p style={mutedStyle}>No crawl plan yet.</p>}
      </section>

      <section style={panelStyle}>
        <h3>Autonomous discovery</h3>
        <p style={mutedStyle}>Research the app, delegate deep flow discovery to multiple agents, and retain only evidence-backed candidates.</p>
        <div style={fieldsStyle}>
          <div style={fieldStyle}><Selector label="Provider" value={autonomousProvider} onChange={(value) => setAutonomousProvider(value as CrawlResearchProvider)} options={[{ value: "chatgpt", label: "ChatGPT" }, { value: "claude", label: "Claude" }]} width="100%" /></div>
          <div style={fieldStyle}><Selector label="Platform" value={autonomousPlatform} onChange={(value) => setAutonomousPlatform(value as typeof autonomousPlatform)} options={[{ value: "web", label: "Web" }, { value: "ios", label: "iOS" }, { value: "android", label: "Android" }]} width="100%" /></div>
          <div style={fieldStyle}><Selector label="Agent concurrency" value={String(agentConcurrency)} onChange={(value) => setAgentConcurrency(Number(value))} options={Array.from({ length: 8 }, (_, index) => String(index + 1))} width="100%" /></div>
          <div style={{ ...fieldStyle, flex: 2 }}><TextInput label="Secret names (comma separated)" value={requiredSecretNames} onChange={setRequiredSecretNames} placeholder="APP_TEST_EMAIL, APP_TEST_PASSWORD" width="100%" /></div>
        </div>
        <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
          <CheckboxInput label="Allow all actions" value={allowAll} onChange={(checked) => { setAllowAll(checked); if (!checked) setAllowAllAcknowledged(false); }} />
          <CheckboxInput label="I acknowledge this shared test account may be mutated" value={allowAllAcknowledged} isDisabled={!allowAll} onChange={setAllowAllAcknowledged} />
        </div>
        <div style={{ ...fieldsStyle, marginTop: 10 }}>
          <Button variant="primary" label="Start autonomous crawl" isDisabled={busy || !app.trim() || !homepageUrl.trim() || (allowAll && !allowAllAcknowledged)} isLoading={busy} clickAction={startAutonomous} />
          {autonomousRun && <><span style={badgeStyle}>Run {autonomousRun.run.id}</span><span style={badgeStyle}>{label(autonomousRun.run.status)}</span></>}
          {autonomousRun && ["queued", "running"].includes(autonomousRun.run.status) && <Button label="Pause" isDisabled={busy} clickAction={() => perform(async () => { setAutonomousRun(await workspaceCommands.pauseAutonomous(autonomousRun.run.id)); })} />}
          {autonomousRun?.run.status === "interrupted" && <Button label="Resume" isDisabled={busy} clickAction={() => perform(async () => { setAutonomousRun(await workspaceCommands.resumeAutonomous(autonomousRun.run.id, allowAllAcknowledged)); })} />}
          {autonomousRun && !["succeeded", "failed", "cancelled"].includes(autonomousRun.run.status) && <Button variant="destructive" label="Cancel autonomous run" isDisabled={busy} clickAction={() => perform(async () => { const updated = await workspaceCommands.cancelAutonomous(autonomousRun.run.id); setAutonomousRun({ ...autonomousRun, run: updated }); })} />}
        </div>
        <details style={{ marginTop: 12 }}><summary>Shared account session · {sessionStatus}</summary><TextArea label="Playwright storage state" value={sessionJson} onChange={setSessionJson} rows={5} width="100%" /><Button label="Save shared account session" isDisabled={busy} isLoading={busy} clickAction={saveSharedSession} /></details>
        {autonomousRun && <div style={{ ...fieldsStyle, marginTop: 10 }}><span>{autonomousRun.missions.length} missions</span><span>{autonomousRun.states.length} states</span><span>{autonomousRun.transitions.length} transitions</span></div>}
      </section>

      <section style={panelStyle}>
        <h3>Run</h3>
        {run ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={fieldsStyle}>
              <strong>Run {run.run.id}</strong>
              <span style={badgeStyle}>{label(run.run.status)}</span>
              <span style={badgeStyle}>{run.run.environment.headless === false ? "Headed" : "Headless"}</span>
              <span style={badgeStyle}>{label(run.run.environment.browserName ?? "chromium")}</span>
            </div>
            <div style={fieldsStyle}>
              <span>{run.run.completed_count} completed</span>
              <span>{run.run.failed_count} failed</span>
              <span>{run.run.skipped_count} skipped</span>
            </div>
            {(run.run.current_flow_id || run.run.current_step_id) && (
              <p style={mutedStyle}>Current: <code>{run.run.current_flow_id}</code> / <code>{run.run.current_step_id}</code></p>
            )}
            <div style={fieldsStyle}>
              {(run.run.status === "queued" || run.run.status === "running") && <Button variant="destructive" label="Cancel run" isDisabled={busy} clickAction={cancel} />}
              {terminalStatuses.has(run.run.status) && run.run.failed_count > 0 && <Button label="Retry failed flows" isDisabled={busy} clickAction={() => retry("failed")} />}
              {terminalStatuses.has(run.run.status) && <Button label="Retry full run" isDisabled={busy} clickAction={() => retry("full")} />}
            </div>
          </div>
        ) : !canStartPlan ? <p style={mutedStyle}>Approve a plan before starting a crawl.</p> : null}
        {canStartPlan && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={fieldsStyle}>
              <Selector
                label="Execution mode"
                size="sm"
                value={headless ? "headless" : "headed"}
                onChange={(value) => setHeadless(value === "headless")}
                options={[{ value: "headless", label: "Headless" }, { value: "headed", label: "Headed" }]}
              />
              <span style={badgeStyle}>Chromium</span><span style={mutedStyle}>Safe flows only by default</span>
            </div>
            {displayedPlan?.flows.some((flow) => !flow.safe) && <div style={{ display: "grid", gap: 7 }}>
              <CheckboxInput label="Approve unsafe read-only prefix" value={unsafeApproved} onChange={setUnsafeApproved} />
              <CheckboxInput label="Disposable test account acknowledged" value={disposableAccountAcknowledged} onChange={setDisposableAccountAcknowledged} />
              <CheckboxInput label="Allow declared side-effect steps" value={allowSideEffects} isDisabled={!unsafeApproved || !disposableAccountAcknowledged} onChange={setAllowSideEffects} />
              <span style={warningStyle}>The server also requires TEST_ACCOUNT=1 and every declared secret. Side effects stay disabled unless all gates pass.</span>
            </div>}
            <Button variant="primary" label="Start crawl" isDisabled={busy} isLoading={busy} clickAction={start} style={{ justifySelf: "start" }} />
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h3>Evidence and failures</h3>
        {run && run.run.status !== "succeeded" && (run.steps.length > 0 || (run.evidence?.length ?? 0) > 0) && (
          <p style={warningStyle}>Incomplete run evidence remains attached to this draft and is not publishable as a completed flow.</p>
        )}
        {(run?.evidence?.length ?? 0) > 0 && (
          <div style={cardGridStyle}>{run!.evidence!.map((evidence) => (
            <article key={evidence.id} style={nestedStyle}>
              <strong>{evidence.state_label}</strong>
              <p style={mutedStyle}><code>{evidence.flow_id}</code> / <code>{evidence.step_id}</code></p>
              <p style={mutedStyle}>{evidence.viewport_width}×{evidence.viewport_height} · {evidence.final_url}</p>
              {evidence.imageUrl && <a href={evidence.imageUrl} target="_blank" rel="noreferrer" style={linkStyle}>Validated capture</a>}
            </article>
          ))}</div>
        )}
        {run?.steps.filter((step) => step.status === "failed").map((step) => {
          const original = findPlanStep(runPlan?.plan, step.flow_id, step.step_id);
          return (
            <article key={`${step.flow_id}:${step.step_id}`} style={{ ...nestedStyle, marginTop: 10 }}>
              <div style={fieldsStyle}><strong>{step.error_class ?? "Crawl failure"}</strong><code>{step.flow_id} / {step.step_id}</code></div>
              <p style={mutedStyle}><strong>Action:</strong> {original?.action ?? "Unavailable"} · <strong>Locator:</strong> {describeStepTarget(original)}</p>
              <p style={warningStyle}>{step.error_message}</p>
              <details><summary>Expected</summary><pre style={preStyle}>{JSON.stringify(step.expected, null, 2)}</pre></details>
              <details><summary>Actual</summary><pre style={preStyle}>{JSON.stringify(step.actual, null, 2)}</pre></details>
              <div style={fieldsStyle}>
                {step.failureScreenshotUrl && <a href={step.failureScreenshotUrl} target="_blank" rel="noreferrer" style={linkStyle}>Failure screenshot</a>}
                <Button label="Request repair" size="sm" isDisabled={busy} clickAction={() => proposeRepair(step.flow_id, step.step_id)} />
              </div>
            </article>
          );
        })}
        {repairs.map((repair) => {
          const original = repair.plan_id === runPlan?.id
            ? findPlanStep(runPlan.plan, repair.flow_id, repair.step_id)
            : undefined;
          return (
            <article key={repair.id} style={{ ...nestedStyle, marginTop: 10 }}>
              <div style={fieldsStyle}><strong>Repair {repair.id}</strong><span style={badgeStyle}>{label(repair.status)}</span></div>
              <p style={mutedStyle}>Changed fields: {changedStepFields(original, repair.proposed_step).join(", ") || "none"}</p>
              <div style={cardGridStyle}>
                <div><strong style={smallHeadingStyle}>Original step</strong><pre style={preStyle}>{JSON.stringify(original ?? null, null, 2)}</pre></div>
                <div><strong style={smallHeadingStyle}>Proposed step</strong><pre style={preStyle}>{JSON.stringify(repair.proposed_step, null, 2)}</pre></div>
              </div>
              {repair.status === "proposed" && <>
                <p style={mutedStyle}>Applying this repair creates a new unapproved revision.</p>
                <div style={fieldsStyle}><Button variant="primary" label="Apply repair" isDisabled={busy} clickAction={() => reviewRepair(repair, "apply")} /><Button variant="destructive" label="Reject repair" isDisabled={busy} clickAction={() => reviewRepair(repair, "reject")} /></div>
              </>}
            </article>
          );
        })}
        {!run && <p style={mutedStyle}>Validated captures and exact failure diagnostics will appear here.</p>}
      </section>

      <section style={panelStyle}>
        <h3>Draft and publication</h3>
        {run ? <>
          <p>Draft version {run.run.version_id} · plan revision {plan?.revision ?? "—"}</p>
          <p style={mutedStyle}>Use the existing capture-version controls above to inspect, submit for review, and publish after all gates pass.</p>
        </> : <p style={mutedStyle}>Successful observations stay in a draft until the existing review gates are used.</p>}
      </section>
      {(message || jobsError) && <p role="status" style={message || jobsError ? warningStyle : mutedStyle}>{message || jobsError}</p>}
    </section>
  );
}

const workspaceStyle = { display: "grid", gap: 14, color: "var(--color-text-primary)" };
const titleStyle = { margin: "0 0 4px", fontSize: 22 };
const mutedStyle = { margin: "6px 0 0", color: "var(--color-text-secondary)", fontSize: 13 };
const panelStyle = { padding: 16, border: "1px solid var(--color-border)", borderRadius: 13, background: "var(--color-background-muted)" };
const fieldsStyle = { display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap" as const };
const fieldStyle = { display: "grid", gap: 5, flex: 1, minWidth: 180, color: "var(--color-text-secondary)", fontSize: 12 };
const nestedStyle = { padding: 12, border: "1px solid var(--color-border)", borderRadius: 9, background: "var(--color-background-muted)" };
const badgeStyle = { display: "inline-flex", alignItems: "center", minHeight: 24, border: "1px solid var(--color-border)", borderRadius: 999, padding: "0 8px", color: "var(--color-text-secondary)", fontSize: 11 };
const smallHeadingStyle = { display: "block", marginBottom: 6, color: "var(--color-text-secondary)", fontSize: 12 };
const listStyle = { display: "grid", gap: 5, margin: "6px 0 0", paddingLeft: 20, color: "var(--color-text-secondary)", fontSize: 12 };
const linkStyle = { color: "var(--color-text-purple)" };
const warningStyle = { margin: "8px 0", color: "var(--color-text-yellow)", fontSize: 12 };
const preStyle = { maxHeight: 240, overflow: "auto", padding: 10, borderRadius: 8, background: "var(--color-background-muted)", color: "var(--color-text-secondary)", fontSize: 11, whiteSpace: "pre-wrap" as const };
const cardGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 };
const terminalStatuses = new Set(["succeeded", "failed", "cancelled", "interrupted"]);
const settledRunStatuses = new Set(["succeeded", "failed", "cancelled"]);

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function findPlanStep(plan: CrawlPlan | undefined, flowId: string, stepId: string): CrawlStep | undefined {
  return plan?.flows.find(({ id }) => id === flowId)?.steps.find(({ id }) => id === stepId);
}

function describeStepTarget(step: CrawlStep | undefined): string {
  if (!step) return "Unavailable";
  if (step.role) return `role=${step.role}${step.name ? ` name=${step.name}` : ""}`;
  if (step.text) return `text=${step.text}`;
  if (step.css) return `css=${step.css}`;
  if (step.url) return `url=${step.url}`;
  if (step.key) return `key=${step.key}`;
  return "None";
}

function changedStepFields(original: CrawlStep | undefined, proposed: CrawlStep): string[] {
  if (!original) return Object.keys(proposed);
  return [...new Set([...Object.keys(original), ...Object.keys(proposed)])]
    .filter((key) => JSON.stringify(original[key as keyof CrawlStep]) !== JSON.stringify(proposed[key as keyof CrawlStep]));
}
