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
    <section aria-label="Decision canvas" className="research-decision-canvas">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div>
          <strong>Comparison lanes</strong>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>{workspace.lanes.length} of {RESEARCH_LIMITS.lanesMax} lanes</div>
        </div>
        <button type="button" disabled={disabled || workspace.lanes.length >= RESEARCH_LIMITS.lanesMax} onClick={addLane} style={buttonStyle}>Add lane</button>
      </div>
      <div className="research-decision-canvas__lanes">
        {workspace.lanes.map((lane) => (
          <section key={lane.id} style={{ padding: 13, border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-background-surface)', display: 'grid', alignContent: 'start', gap: 10 }}>
            <input aria-label="Lane title" defaultValue={lane.title} disabled={disabled} onBlur={(event) => { if (event.target.value.trim() !== lane.title) void actions.updateLane(lane.id, { title: event.target.value }); }} style={titleStyle} />
            <textarea aria-label={`Conclusion for ${lane.title}`} defaultValue={lane.conclusion} disabled={disabled} placeholder="Lane conclusion" onBlur={(event) => { if (event.target.value !== lane.conclusion) void actions.updateLane(lane.id, { conclusion: event.target.value }); }} style={fieldStyle} />
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
            <button type="button" disabled={disabled || workspace.lanes.length <= RESEARCH_LIMITS.lanesMin || lane.items.length > 0} onClick={() => void actions.deleteLane(lane.id)} style={buttonStyle}>Delete empty lane</button>
          </section>
        ))}
      </div>
    </section>
  );
}

const buttonStyle = { border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 9px', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' } as const;
const titleStyle = { border: 0, borderBottom: '1px solid var(--color-border)', padding: '6px 2px', background: 'transparent', color: 'var(--color-text-primary)', font: 'inherit', fontWeight: 700 } as const;
const fieldStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)', borderRadius: 8, padding: 8, background: 'var(--color-background-body)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 12 } as const;
