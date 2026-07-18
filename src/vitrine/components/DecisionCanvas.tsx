import { useEffect, useState } from 'react';
import { Button, Card, TextArea, TextInput } from '@astryxdesign/core';
import { RESEARCH_LIMITS, type ResearchProjectWorkspace } from '../../researchProject.ts';
import { EvidenceCard } from './EvidenceCard.tsx';

export interface DecisionCanvasActions {
  addLane(title: string): Promise<void>;
  updateLane(laneId: number, patch: { title?: string; conclusion?: string }): Promise<void>;
  deleteLane(laneId: number): Promise<void>;
  updateItem(itemId: number, patch: { stepLabel?: string; note?: string; tags?: string[]; important?: boolean }): Promise<void>;
  moveItem(itemId: number, targetLaneId: number, targetPosition: number): Promise<void>;
  removeItem(itemId: number): Promise<void>;
}

export function DecisionCanvas({ workspace, disabled, actions }: {
  workspace: ResearchProjectWorkspace;
  disabled: boolean;
  actions: DecisionCanvasActions;
}) {
  const addLane = () => {
    const title = window.prompt('Lane title')?.trim();
    if (title) void actions.addLane(title);
  };
  return (
    <section aria-label="Decision canvas" style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div>
          <strong>Comparison lanes</strong>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>{workspace.lanes.length} of {RESEARCH_LIMITS.lanesMax} lanes</div>
        </div>
        <Button label="Add lane" size="sm" isDisabled={disabled || workspace.lanes.length >= RESEARCH_LIMITS.lanesMax} onClick={addLane} />
      </div>
      <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(280px, 1fr)', gap: 14, overflowX: 'auto', paddingBottom: 12 }}>
        {workspace.lanes.map((lane) => (
          <Card key={lane.id} padding={3} style={{ display: 'grid', alignContent: 'start', gap: 10 }}>
            <LaneFields lane={lane} disabled={disabled} update={(patch) => actions.updateLane(lane.id, patch)} />
            <div style={{ display: 'grid', gap: 9 }}>
              {lane.items.map((item) => (
                <EvidenceCard key={item.id} item={item} lane={lane} lanes={workspace.lanes} disabled={disabled} actions={{
                  update: (patch) => actions.updateItem(item.id, patch),
                  move: (targetLaneId, targetPosition) => actions.moveItem(item.id, targetLaneId, targetPosition),
                  remove: () => actions.removeItem(item.id),
                }} />
              ))}
            </div>
            {lane.items.length === 0 && <div style={{ border: '1px dashed var(--color-border)', borderRadius: 9, padding: 18, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 12 }}>Add evidence to compare this alternative.</div>}
            <Button label="Delete empty lane" variant="destructive" size="sm" isDisabled={disabled || workspace.lanes.length <= RESEARCH_LIMITS.lanesMin || lane.items.length > 0} clickAction={() => actions.deleteLane(lane.id)} />
          </Card>
        ))}
      </div>
    </section>
  );
}

function LaneFields({ lane, disabled, update }: { lane: ResearchProjectWorkspace['lanes'][number]; disabled: boolean; update(patch: { title?: string; conclusion?: string }): Promise<void> }) {
  const [title, setTitle] = useState(lane.title);
  const [conclusion, setConclusion] = useState(lane.conclusion);
  useEffect(() => { setTitle(lane.title); setConclusion(lane.conclusion); }, [lane.title, lane.conclusion]);
  return <>
    <TextInput label="Lane title" isLabelHidden value={title} onChange={setTitle} isDisabled={disabled} width="100%" onBlur={() => { if (title.trim() !== lane.title) void update({ title: title.trim() }); }} />
    <TextArea label={`Conclusion for ${lane.title}`} isLabelHidden value={conclusion} onChange={setConclusion} isDisabled={disabled} placeholder="Lane conclusion" rows={3} width="100%" onBlur={() => { if (conclusion !== lane.conclusion) void update({ conclusion }); }} />
  </>;
}
