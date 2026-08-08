import { Spinner } from './Spinner.tsx';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core';
import type { ResearchProjectWorkspace } from '../../researchProject.ts';
import {
  ResearchProjectApiError,
  createResearchLane,
  deleteResearchLane,
  getResearchProject,
  downloadResearchMarkdown,
  moveResearchItem,
  removeResearchItem,
  updateResearchItem,
  updateResearchLane,
  updateResearchProject,
  synthesizeResearch,
} from '../researchProjectsApi.ts';
import { navigate } from '../router.ts';
import { DecisionCanvas, type DecisionCanvasActions } from './DecisionCanvas.tsx';
import { EvidenceDrawer } from './EvidenceDrawer.tsx';
import { ProjectInsightsPanel, type ProjectInsightsActions } from './ProjectInsightsPanel.tsx';
import { ProjectWorkspaceNav } from './ProjectWorkspaceNav.tsx';

export function ResearchProjectPage({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ResearchProjectWorkspace>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try { setWorkspace(await getResearchProject(projectId)); setMessage(''); }
    catch (error) { setMessage((error as Error).message); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const mutate = async (operation: (current: ResearchProjectWorkspace) => Promise<ResearchProjectWorkspace>) => {
    if (!workspace || busy) return;
    setBusy(true);
    try {
      setWorkspace(await operation(workspace));
      setMessage('');
    } catch (error) {
      if (error instanceof ResearchProjectApiError && error.code === 'revision_conflict' && error.project) {
        setWorkspace(error.project);
        setMessage('This project changed in another session. The latest version is shown.');
      } else setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="vitrine-page" style={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><Spinner size="lg" /></div>;
  if (!workspace) return <main className="vitrine-page" style={{ padding: 28 }}><Button label="Back to projects" variant="ghost" onClick={() => navigate({ name: 'projects' })} /><p role="alert">{message || 'Research project not found.'}</p></main>;

  const actions: DecisionCanvasActions = {
    addLane: (title) => mutate((current) => createResearchLane(current.id, current.revision, title)),
    updateLane: (laneId, patch) => mutate((current) => updateResearchLane(current.id, laneId, current.revision, patch)),
    deleteLane: (laneId) => mutate((current) => deleteResearchLane(current.id, laneId, current.revision)),
    updateItem: (itemId, patch) => mutate((current) => updateResearchItem({ projectId: current.id, itemId, expectedRevision: current.revision, ...patch })),
    moveItem: (itemId, targetLaneId, targetPosition) => mutate((current) => moveResearchItem(current.id, itemId, current.revision, targetLaneId, targetPosition)),
    removeItem: (itemId) => mutate((current) => removeResearchItem(current.id, itemId, current.revision)),
  };
  const readOnly = workspace.access?.role === 'viewer';
  const insightActions: ProjectInsightsActions = {
    save: (patch) => mutate((current) => updateResearchProject(current.id, current.revision, patch)),
    synthesize: async () => {
      if (busy) return;
      setBusy(true);
      try {
        const synthesis = await synthesizeResearch(workspace.id);
        setWorkspace({ ...workspace, synthesis });
        setMessage('');
      } catch (error) { setMessage((error as Error).message); }
      finally { setBusy(false); }
    },
    exportMarkdown: async () => {
      try {
        const { blob, filename } = await downloadResearchMarkdown(workspace.id);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (error) { setMessage((error as Error).message); }
    },
  };

  return (
    <main className="vitrine-page research-project-page">
      <ProjectWorkspaceNav
        projectId={workspace.id}
        active="canvas"
        title={workspace.title}
        description={workspace.question || "Designer research and project decisions."}
      />
      {message && <p role="alert" style={{ color: 'var(--color-text-danger)' }}>{message}</p>}
      <div className="research-project-workspace">
        <DecisionCanvas workspace={workspace} disabled={busy || readOnly} actions={actions} />
        <div className="research-project-workspace__rail">
          <EvidenceDrawer workspace={workspace} disabled={busy || readOnly} onChange={setWorkspace} />
          <ProjectInsightsPanel key={workspace.revision} workspace={workspace} disabled={busy || readOnly} actions={insightActions} />
        </div>
      </div>
    </main>
  );
}
