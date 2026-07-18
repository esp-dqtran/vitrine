import { useEffect, useState } from 'react';
import { Button, Card, CheckboxInput, TextArea, TextInput } from '@astryxdesign/core';
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
  const [note, setNote] = useState(item.note);
  const [tags, setTags] = useState(item.tags.join(', '));
  useEffect(() => { setNote(item.note); setTags(item.tags.join(', ')); }, [item.note, item.tags]);
  return (
    <Card padding={3} style={{ borderColor: item.important ? 'var(--color-accent)' : 'var(--color-border)', display: 'grid', gap: 9 }}>
      <div>
        <strong style={{ display: 'block', fontSize: 13 }}>{item.stepLabel || item.snapshot.title}</strong>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {[item.snapshot.app, item.snapshot.platform, item.snapshot.state].filter(Boolean).join(' · ') || (item.sourceKind === 'private_upload' ? 'Private upload' : 'Catalog evidence')}
        </span>
      </div>
      {item.restricted && <div role="alert" style={{ fontSize: 12, color: 'var(--color-text-danger)' }}>Access to this evidence is restricted.</div>}
      <TextArea
        label={`Notes for ${item.snapshot.title}`}
        isLabelHidden
        value={note}
        onChange={setNote}
        isDisabled={disabled}
        placeholder="Why is this useful?"
        rows={3}
        width="100%"
        onBlur={() => { if (note !== item.note) void actions.update({ note }); }}
      />
      <TextInput
        label={`Tags for ${item.snapshot.title}`}
        isLabelHidden
        value={tags}
        onChange={setTags}
        isDisabled={disabled}
        placeholder="Tags, comma separated"
        width="100%"
        onBlur={() => void actions.update({ tags: tags.split(',').map((value) => value.trim()).filter(Boolean) })}
      />
      <CheckboxInput label="Important evidence" value={item.important} isDisabled={disabled} onChange={(checked) => void actions.update({ important: checked })} size="sm" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Button label="Move earlier" size="sm" isDisabled={disabled || item.position === 0} clickAction={() => actions.move(lane.id, item.position - 1)} />
        <Button label="Move later" size="sm" isDisabled={disabled || item.position === lane.items.length - 1} clickAction={() => actions.move(lane.id, item.position + 1)} />
        {lanes.filter(({ id }) => id !== lane.id).map((target) => (
          <Button key={target.id} label={`Move to ${target.title}`} size="sm" isDisabled={disabled} clickAction={() => actions.move(target.id, target.items.length)} />
        ))}
        <Button label="Remove" variant="destructive" size="sm" isDisabled={disabled} clickAction={actions.remove} />
      </div>
    </Card>
  );
}
