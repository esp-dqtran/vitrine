import type { DesignFlow, EvidenceView } from '../../designSystem';
import { MediaGridCard } from './MediaGridCard';

export function FlowCard({ flow, onOpen }: { flow: DesignFlow<EvidenceView>; onOpen: () => void }) {
  const thumb = flow.steps[0]?.evidence[0];
  return (
    <MediaGridCard
      label={`Open ${flow.title} flow`}
      kind="image"
      url={thumb?.imageUrl}
      title={flow.title}
      badges={[`${flow.steps.length} ${flow.steps.length === 1 ? 'step' : 'steps'}`]}
      onOpen={onOpen}
    />
  );
}
