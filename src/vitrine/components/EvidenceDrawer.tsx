import { useEffect, useState } from 'react';
import { Button, Card, FileInput, Selector, TextInput } from '@astryxdesign/core';
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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const evidenceCount = workspace.lanes.reduce((total, lane) => total + lane.items.length, 0);

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

  const upload = async (file: File | null) => {
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
    <aside className="research-side-panel evidence-drawer">
      <header className="research-side-panel__header">
        <div>
          <span className="research-project-kicker">Reference library</span>
          <h2>Evidence</h2>
          <p>Find observed screens or upload your own work.</p>
        </div>
        <span className="research-side-panel__count">{evidenceCount}</span>
      </header>
      <div className="evidence-drawer__target">
        <Selector label="Add to direction" value={String(targetLaneId)} isDisabled={disabled} onChange={(value) => setTargetLaneId(Number(value))} options={workspace.lanes.map((lane) => ({ value: String(lane.id), label: lane.title }))} size="sm" />
      </div>
      <div className="evidence-drawer__search">
        <TextInput label="Search evidence" isLabelHidden value={query} onChange={setQuery} placeholder="Search screens, flows, or products…" width="100%" />
        <Button label="Search" variant="primary" size="sm" isDisabled={disabled} clickAction={search} />
      </div>
      <div className="evidence-drawer__upload">
        <FileInput label="Upload your screenshot" value={uploadFile} onChange={(files) => setUploadFile(files as File | null)} changeAction={async (files) => { await upload(files as File | null); setUploadFile(null); }} accept="image/png,image/jpeg,image/webp" maxSize={RESEARCH_LIMITS.uploadBytesMax} isDisabled={disabled} mode="input" />
      </div>
      {message && <div className="research-side-panel__message" role="status">{message}</div>}
      <div className="evidence-drawer__results">
        {suggestions.map((suggestion) => (
          <Card key={suggestion.id} padding={2} className="evidence-drawer__result">
            <div>
              <strong>{suggestion.title}</strong>
              <span>{suggestion.app} · {suggestion.platform}</span>
            </div>
            <span>Matched: {suggestion.matchedFields.join(', ')}</span>
            <Button label="Add evidence" variant="secondary" size="sm" isDisabled={disabled || !targetLaneId} clickAction={() => add(suggestion)} />
          </Card>
        ))}
        {!suggestions.length && (
          <div className="evidence-drawer__empty">
            <strong>Start with a focused search</strong>
            <span>Try a screen, flow, or interaction such as “pricing comparison”.</span>
          </div>
        )}
      </div>
    </aside>
  );
}
