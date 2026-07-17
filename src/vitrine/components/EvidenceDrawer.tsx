import { useEffect, useState } from 'react';
import { RESEARCH_LIMITS, type ResearchProjectWorkspace } from '../../researchProject.ts';
import type { ResearchSuggestion } from '../../researchSuggestions.ts';
import {
  addResearchItem,
  listResearchSuggestions,
  uploadResearchScreenshot,
} from '../researchProjectsApi.ts';

export function EvidenceDrawer({ workspace, disabled, onChange, initialSuggestions }: {
  workspace: ResearchProjectWorkspace;
  disabled: boolean;
  onChange(workspace: ResearchProjectWorkspace): void;
  initialSuggestions?: ResearchSuggestion[];
}) {
  const [suggestions, setSuggestions] = useState<ResearchSuggestion[]>(initialSuggestions ?? []);
  const [query, setQuery] = useState('');
  const [targetLaneId, setTargetLaneId] = useState(workspace.lanes[0]?.id ?? 0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialSuggestions) return;
    void listResearchSuggestions(workspace.id)
      .then(setSuggestions)
      .catch((error: Error) => setMessage(error.message));
  }, [initialSuggestions, workspace.id]);

  const search = async () => {
    try { setSuggestions(await listResearchSuggestions(workspace.id, query)); setMessage(''); }
    catch (error) { setMessage((error as Error).message); }
  };

  const add = async (suggestion: ResearchSuggestion) => {
    if (!suggestion.versionId || !suggestion.imageId || !targetLaneId) return;
    try {
      onChange(await addResearchItem({
        projectId: workspace.id,
        laneId: targetLaneId,
        expectedRevision: workspace.revision,
        sourceKind: suggestion.kind === 'screen' ? 'catalog_screen' : 'catalog_flow_step',
        snapshot: {
          title: suggestion.title,
          app: suggestion.app,
          platform: suggestion.platform,
          flow: suggestion.flowTitle,
          capturedAt: suggestion.capturedAt,
          sourcePath: suggestion.sourcePath,
          description: suggestion.description,
        },
        catalog: {
          app: suggestion.app,
          versionId: suggestion.versionId,
          imageId: suggestion.imageId,
          flowId: suggestion.flowId,
          stepIndex: suggestion.stepIndex,
        },
      }));
      setMessage('Evidence added.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || !targetLaneId) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage('Choose a PNG, JPEG, or WebP screenshot.');
      return;
    }
    if (file.size > RESEARCH_LIMITS.uploadBytesMax) {
      setMessage('Screenshot must be 10 MiB or smaller.');
      return;
    }
    try {
      onChange(await uploadResearchScreenshot(workspace.id, targetLaneId, workspace.revision, file));
      setMessage('Private screenshot added.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <aside style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 13, background: 'var(--color-background-surface)', alignSelf: 'start', display: 'grid', gap: 11 }}>
      <div><strong>Evidence</strong><div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>Search the published catalog or add your own screenshot.</div></div>
      <select aria-label="Target lane" value={targetLaneId} disabled={disabled} onChange={(event) => setTargetLaneId(Number(event.target.value))} style={fieldStyle}>
        {workspace.lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Search evidence" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={workspace.question} style={{ ...fieldStyle, minWidth: 0 }} />
        <button type="button" disabled={disabled} onClick={() => void search()} style={buttonStyle}>Search</button>
      </div>
      <label style={{ border: '1px dashed var(--color-border)', borderRadius: 9, padding: 10, textAlign: 'center', cursor: disabled ? 'default' : 'pointer', fontSize: 12 }}>
        Upload private screenshot
        <input type="file" hidden disabled={disabled} accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
      </label>
      {message && <div role="status" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 8, maxHeight: '65vh', overflowY: 'auto' }}>
        {suggestions.map((suggestion) => (
          <article key={suggestion.id} style={{ border: '1px solid var(--color-border)', borderRadius: 9, padding: 10, display: 'grid', gap: 6 }}>
            <strong style={{ fontSize: 12 }}>{suggestion.title}</strong>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{suggestion.app} · {suggestion.platform}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Matched: {suggestion.matchedFields.join(', ')}</span>
            <button type="button" disabled={disabled || !targetLaneId} onClick={() => void add(suggestion)} style={buttonStyle}>Add evidence</button>
          </article>
        ))}
        {!suggestions.length && <div style={{ padding: 12, color: 'var(--color-text-secondary)', fontSize: 12 }}>No suggestions yet. Try a more specific product question.</div>}
      </div>
    </aside>
  );
}

const fieldStyle = { border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 9px', background: 'var(--color-background-body)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 12 } as const;
const buttonStyle = { border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 9px', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12 } as const;
