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
    <aside style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 13, background: 'var(--color-background-surface)', alignSelf: 'start', display: 'grid', gap: 11 }}>
      <div><strong>Evidence</strong><div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>Search the published catalog or add your own screenshot.</div></div>
      <Selector label="Target lane" value={String(targetLaneId)} isDisabled={disabled} onChange={(value) => setTargetLaneId(Number(value))} options={workspace.lanes.map((lane) => ({ value: String(lane.id), label: lane.title }))} size="sm" />
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}><TextInput label="Search evidence" isLabelHidden value={query} onChange={setQuery} placeholder={workspace.question} width="100%" /></div>
        <Button label="Search" size="sm" isDisabled={disabled} clickAction={search} />
      </div>
      <FileInput label="Upload private screenshot" value={uploadFile} onChange={(files) => setUploadFile(files as File | null)} changeAction={async (files) => { await upload(files as File | null); setUploadFile(null); }} accept="image/png,image/jpeg,image/webp" maxSize={RESEARCH_LIMITS.uploadBytesMax} isDisabled={disabled} mode="input" />
      {message && <div role="status" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 8, maxHeight: '65vh', overflowY: 'auto' }}>
        {suggestions.map((suggestion) => (
          <Card key={suggestion.id} padding={2} style={{ display: 'grid', gap: 6 }}>
            <strong style={{ fontSize: 12 }}>{suggestion.title}</strong>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{suggestion.app} · {suggestion.platform}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Matched: {suggestion.matchedFields.join(', ')}</span>
            <Button label="Add evidence" size="sm" isDisabled={disabled || !targetLaneId} clickAction={() => add(suggestion)} />
          </Card>
        ))}
        {!suggestions.length && <div style={{ padding: 12, color: 'var(--color-text-secondary)', fontSize: 12 }}>No suggestions yet. Try a more specific product question.</div>}
      </div>
    </aside>
  );
}
