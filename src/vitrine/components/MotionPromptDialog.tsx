import { Button, Icon, IconButton } from '@astryxdesign/core';
import { useEffect, useRef, useState } from 'react';
import { useSlidingIndicator } from '../useSlidingIndicator.ts';
import { AstryxDropdown } from './AstryxDropdown.tsx';
import { AstryxModal, AstryxModalSurface } from './AstryxModal.tsx';
import { useCopyAction } from './CopyButton.tsx';
import type { MotionPrompt } from './MotionPromptsPage.tsx';

type MotionPromptMode = 'site' | 'prompt';
type MotionPromptAgent = 'claude-code' | 'cursor' | 'lovable' | 'v0' | 'bolt';

const AGENT_OPTIONS: ReadonlyArray<{ value: MotionPromptAgent; label: string }> = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'lovable', label: 'Lovable' },
  { value: 'v0', label: 'v0' },
  { value: 'bolt', label: 'Bolt' },
];

function AgentModelIcon({ agent }: { agent: MotionPromptAgent }) {
  const icon = {
    'claude-code': {
      src: '/brand-icons/claude.svg',
    },
    cursor: {
      src: 'https://cursor.com/favicon.svg',
    },
    lovable: {
      src: 'https://lovable.dev/favicon.svg',
    },
    v0: {
      src: 'https://cdn.simpleicons.org/vercel/FFFFFF?viewbox=auto',
    },
    bolt: {
      src: 'https://bolt.new/static/favicon.svg',
    },
  }[agent];

  return (
    <img className="motion-agent-icon" data-agent={agent} src={icon.src} alt="" aria-hidden="true" />
  );
}

function agentInstruction(agent: MotionPromptAgent): string {
  switch (agent) {
    case 'claude-code':
      return 'Work directly in the existing codebase. Inspect the current component and styling seams first, then make the smallest production-ready change.';
    case 'cursor':
      return 'Edit the existing React codebase. Reuse its components and tokens, keep the change scoped, and include verification steps.';
    case 'lovable':
      return 'Build this as a polished responsive web experience. Keep the visible controls functional and use accessible semantic HTML.';
    case 'v0':
      return 'Return a responsive React component using the existing design system where available. Do not add dependencies unless essential.';
    case 'bolt':
      return 'Build the complete responsive React page. Keep the implementation lightweight, accessible, and ready to run.';
  }
}

export function motionPromptForAgent(prompt: MotionPrompt, agent: MotionPromptAgent): string {
  return `${agentInstruction(agent)}\n\n${prompt.prompt}`;
}

export function MotionPromptDialog({
  prompt,
  onClose,
  initialMode = 'site',
}: {
  prompt: MotionPrompt;
  onClose: () => void;
  initialMode?: MotionPromptMode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<MotionPromptMode>(initialMode);
  const [agent, setAgent] = useState<MotionPromptAgent>('claude-code');
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const {
    indicatorRef,
    registerItem,
  } = useSlidingIndicator<MotionPromptMode>(mode);
  const promptText = motionPromptForAgent(prompt, agent);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const copyPrompt = async () => {
    if (!navigator.clipboard) throw new Error('Clipboard is unavailable');
    await navigator.clipboard.writeText(promptText);
  };
  const { copy, state: copyState } = useCopyAction({
    action: copyPrompt,
    successMessage: 'Prompt copied',
  });

  return (
    <AstryxModal
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      variant="fullscreen"
      purpose="info"
      padding={0}
      className="flow-preview-dialog-shell motion-prompt-dialog-shell"
      aria-label={`${prompt.title} motion prompt`}
    >
      <AstryxModalSurface
        ref={dialogRef}
        className="flow-preview-dialog flow-preview-dialog--web motion-prompt-dialog"
        data-motion-prompt-dialog={prompt.id}
        tabIndex={-1}
      >
        <header className="flow-preview-dialog__header">
          <div className="flow-preview-dialog__identity">
            <h2>{prompt.title}</h2>
            <span className="flow-preview-dialog__connector">for</span>
            <span className="flow-preview-dialog__app flow-preview-dialog__app--static">
              <strong>Vitrines Motion</strong>
            </span>
          </div>

          <div
            className="flow-preview-dialog__modes"
            role="tablist"
            aria-label="Motion prompt mode"
            data-active-mode={mode}
          >
            <span ref={indicatorRef} className="flow-preview-dialog__mode-indicator" aria-hidden="true" />
            <Button
              ref={registerItem('site')}
              label="Site"
              variant="ghost"
              role="tab"
              aria-selected={mode === 'site'}
              onClick={() => setMode('site')}
            />
            <Button
              ref={registerItem('prompt')}
              label="Prompt"
              variant="ghost"
              role="tab"
              aria-selected={mode === 'prompt'}
              onClick={() => setMode('prompt')}
            />
          </div>

          <div className="flow-preview-dialog__header-actions">
            <IconButton
              label="Close Motion prompt"
              icon={<Icon icon="close" size="sm" />}
              variant="ghost"
              onClick={onClose}
            />
          </div>
        </header>

        <div
          className={`motion-prompt-dialog__body motion-prompt-dialog__body--${mode}`}
          role="tabpanel"
          aria-label={mode === 'site' ? 'Site reference' : 'AI agent prompt'}
        >
          {mode === 'site' ? (
            <figure className="motion-prompt-dialog__site">
              <img src={prompt.imageUrl} alt={`${prompt.title} site reference`} />
            </figure>
          ) : (
            <section className="motion-prompt-dialog__prompt">
              <header className="motion-prompt-dialog__prompt-toolbar">
                <div className="motion-prompt-dialog__prompt-actions">
                  <AstryxDropdown
                    label={AGENT_OPTIONS.find((option) => option.value === agent)?.label ?? 'AI agent'}
                    ariaLabel={`AI agent: ${AGENT_OPTIONS.find((option) => option.value === agent)?.label}`}
                    open={agentPickerOpen}
                    hasChevron={false}
                    triggerClassName="motion-prompt-dialog__agent-picker"
                    triggerIcon={<AgentModelIcon agent={agent} />}
                    triggerEndContent={<Icon icon="chevronDown" size="sm" />}
                    menuWidth={184}
                    onOpenChange={setAgentPickerOpen}
                  >
                    {AGENT_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        label={option.label}
                        icon={<AgentModelIcon agent={option.value} />}
                        role="menuitem"
                        aria-current={option.value === agent ? 'true' : undefined}
                        tabIndex={-1}
                        variant="ghost"
                        size="sm"
                        className={[
                          'astryx-dropdown__item',
                          'motion-agent-picker__item',
                          option.value === agent ? 'astryx-dropdown__item--selected' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => {
                          setAgent(option.value);
                          setAgentPickerOpen(false);
                        }}
                      />
                    ))}
                  </AstryxDropdown>
                  <Button
                    label={copyState === 'copying' ? 'Copying…' : 'Copy prompt'}
                    icon={<Icon icon="copy" size="sm" />}
                    variant="primary"
                    size="md"
                    isLoading={copyState === 'copying'}
                    isDisabled={copyState === 'copying'}
                    onClick={() => void copy()}
                  />
                </div>
              </header>
              <pre aria-label={`${prompt.title} prompt for ${AGENT_OPTIONS.find((option) => option.value === agent)?.label}`}><code>{promptText}</code></pre>
            </section>
          )}
        </div>
      </AstryxModalSurface>
    </AstryxModal>
  );
}
