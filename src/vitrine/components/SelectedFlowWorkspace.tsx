import { Button } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import type { FlowRepresentation } from '../router.ts';
import { DocumentFlowPanel } from './DocumentFlowPanel.tsx';
import { VisualFlowPanel } from './VisualFlowPanel.tsx';

export interface SelectedFlowWorkspaceProps {
  flow: DesignFlow<EvidenceView>;
  app?: string;
  platform?: Platform;
  version?: number;
  userRole: 'admin' | 'user';
  view: FlowRepresentation;
  selectedStep?: number;
  onViewChange(view: FlowRepresentation, step?: number): void;
  onStepChange(step?: number): void;
  onBack(): void;
}

export function SelectedFlowWorkspace(props: SelectedFlowWorkspaceProps) {
  const { flow, view } = props;
  const panelId = `flow-${flow.id}-${view}-panel`;
  return (
    <section className="selected-flow-workspace" aria-labelledby={`flow-${flow.id}-title`}>
      <header className="selected-flow-workspace__header">
        <div>
          <h2 id={`flow-${flow.id}-title`}>{flow.title}</h2>
          <p>{flow.category ?? 'Flow'} · {flow.steps.length} {flow.steps.length === 1 ? 'step' : 'steps'}</p>
        </div>
        <Button label="Back to flows" variant="ghost" clickAction={props.onBack} />
      </header>
      <div role="tablist" aria-label="Flow representation" className="selected-flow-workspace__tabs">
        {(['visual', 'document'] as const).map((candidate) => (
          <Button
            key={candidate}
            label={candidate === 'visual' ? 'Screens' : 'Document Flow'}
            variant="ghost"
            role="tab"
            aria-selected={view === candidate}
            aria-controls={`flow-${flow.id}-${candidate}-panel`}
            clickAction={() => props.onViewChange(candidate, props.selectedStep)}
          />
        ))}
      </div>
      <div id={panelId} role="tabpanel">
        {view === 'visual'
          ? (
              <VisualFlowPanel
                flow={flow}
                platform={props.platform}
                selectedStep={props.selectedStep}
                onStepChange={props.onStepChange}
              />
            )
          : (
              <DocumentFlowPanel
                flow={flow}
                app={props.app}
                platform={props.platform}
                version={props.version}
                userRole={props.userRole}
                selectedStep={props.selectedStep}
                onOpenVisualStep={(step: number) => props.onViewChange('visual', step)}
              />
            )}
      </div>
    </section>
  );
}
