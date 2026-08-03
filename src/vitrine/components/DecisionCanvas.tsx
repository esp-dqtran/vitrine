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
  const [addingLane, setAddingLane] = useState(false);
  const [newLaneTitle, setNewLaneTitle] = useState('');
  const addLane = () => {
    const title = newLaneTitle.trim();
    if (!title) return;
    void actions.addLane(title);
    setNewLaneTitle('');
    setAddingLane(false);
  };
  return (
    <section aria-label="Decision canvas" className="research-decision-canvas">
      <header className="research-decision-canvas__header">
        <div>
          <span className="research-project-kicker">Direction board</span>
          <h2>Compare visual directions</h2>
          <p>Organize references into clear alternatives before moving into the Playground.</p>
        </div>
        <div className="research-decision-canvas__header-actions">
          <span>{workspace.lanes.length} of {RESEARCH_LIMITS.lanesMax} directions</span>
          <Button
            label="New direction"
            variant="primary"
            size="sm"
            isDisabled={disabled || addingLane || workspace.lanes.length >= RESEARCH_LIMITS.lanesMax}
            clickAction={() => setAddingLane(true)}
          />
        </div>
      </header>
      {addingLane && (
        <form className="research-decision-canvas__add" onSubmit={(event) => { event.preventDefault(); addLane(); }}>
          <TextInput
            label="Direction name"
            isLabelHidden
            value={newLaneTitle}
            onChange={setNewLaneTitle}
            placeholder="e.g. Quiet editorial"
            width="100%"
          />
          <Button label="Cancel" variant="ghost" size="sm" clickAction={() => { setAddingLane(false); setNewLaneTitle(''); }} />
          <Button label="Add direction" variant="primary" size="sm" isDisabled={!newLaneTitle.trim()} clickAction={addLane} />
        </form>
      )}
      <div className="research-decision-canvas__lanes">
        {workspace.lanes.map((lane) => (
          <Card key={lane.id} padding={3} className="research-direction-card">
            <div className="research-direction-card__meta">
              <span>Direction {lane.position + 1}</span>
              <span>{lane.items.length} {lane.items.length === 1 ? 'reference' : 'references'}</span>
            </div>
            <LaneFields lane={lane} disabled={disabled} update={(patch) => actions.updateLane(lane.id, patch)} />
            <div className="research-direction-card__evidence">
              {lane.items.map((item) => (
                <EvidenceCard key={item.id} item={item} lane={lane} lanes={workspace.lanes} disabled={disabled} actions={{
                  update: (patch) => actions.updateItem(item.id, patch),
                  move: (targetLaneId, targetPosition) => actions.moveItem(item.id, targetLaneId, targetPosition),
                  remove: () => actions.removeItem(item.id),
                }} />
              ))}
            </div>
            {lane.items.length === 0 && (
              <div className="research-direction-card__empty">
                <strong>No references yet</strong>
                <span>Use the Evidence library to add screens to this direction.</span>
              </div>
            )}
            <div className="research-direction-card__footer">
              <Button label="Remove direction" variant="destructive" size="sm" isDisabled={disabled || workspace.lanes.length <= RESEARCH_LIMITS.lanesMin || lane.items.length > 0} clickAction={() => actions.deleteLane(lane.id)} />
            </div>
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
