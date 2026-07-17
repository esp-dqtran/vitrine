import type { ResearchProjectItem, ResearchProjectLane } from '../../researchProject.ts';

export interface EvidenceCardActions {
  update(patch: { stepLabel?: string; note?: string; tags?: string[]; important?: boolean }): Promise<void>;
  move(targetLaneId: number, targetPosition: number): Promise<void>;
  remove(): Promise<void>;
}

export function EvidenceCard({ item, lane, lanes, disabled, actions }: {
  item: ResearchProjectItem;
  lane: ResearchProjectLane;
  lanes: ResearchProjectLane[];
  disabled: boolean;
  actions: EvidenceCardActions;
}) {
  return (
    <article style={{ padding: 12, border: `1px solid ${item.important ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 10, background: 'var(--color-background-body)', display: 'grid', gap: 9 }}>
      <div>
        <strong style={{ display: 'block', fontSize: 13 }}>{item.stepLabel || item.snapshot.title}</strong>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {[item.snapshot.app, item.snapshot.platform, item.snapshot.state].filter(Boolean).join(' · ') || (item.sourceKind === 'private_upload' ? 'Private upload' : 'Catalog evidence')}
        </span>
      </div>
      {item.restricted && <div role="alert" style={{ fontSize: 12, color: 'var(--color-text-danger)' }}>Access to this evidence is restricted.</div>}
      <textarea
        aria-label={`Notes for ${item.snapshot.title}`}
        defaultValue={item.note}
        disabled={disabled}
        placeholder="Why is this useful?"
        onBlur={(event) => { if (event.target.value !== item.note) void actions.update({ note: event.target.value }); }}
        style={fieldStyle}
      />
      <input
        aria-label={`Tags for ${item.snapshot.title}`}
        defaultValue={item.tags.join(', ')}
        disabled={disabled}
        placeholder="Tags, comma separated"
        onBlur={(event) => void actions.update({ tags: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })}
        style={fieldStyle}
      />
      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={item.important} disabled={disabled} onChange={(event) => void actions.update({ important: event.target.checked })} />
        Important evidence
      </label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" disabled={disabled || item.position === 0} onClick={() => void actions.move(lane.id, item.position - 1)} style={actionStyle}>Move earlier</button>
        <button type="button" disabled={disabled || item.position === lane.items.length - 1} onClick={() => void actions.move(lane.id, item.position + 1)} style={actionStyle}>Move later</button>
        {lanes.filter(({ id }) => id !== lane.id).map((target) => (
          <button key={target.id} type="button" disabled={disabled} onClick={() => void actions.move(target.id, target.items.length)} style={actionStyle}>Move to {target.title}</button>
        ))}
        <button type="button" disabled={disabled} onClick={() => void actions.remove()} style={actionStyle}>Remove</button>
      </div>
    </article>
  );
}

const fieldStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)', borderRadius: 7, padding: '7px 8px', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 12 } as const;
const actionStyle = { border: '1px solid var(--color-border)', borderRadius: 7, padding: '5px 7px', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 11 } as const;
