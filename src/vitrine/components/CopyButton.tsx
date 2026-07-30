import { Button, Icon } from '@astryxdesign/core';
import {
  useCallback,
  useRef,
  useState,
} from 'react';
import { useApplicationToast } from './ApplicationToast.tsx';

export type CopyActionState = 'idle' | 'copying';

interface UseCopyActionOptions {
  action: () => Promise<void>;
  successMessage: string;
}

export function useCopyAction({
  action,
  successMessage,
}: UseCopyActionOptions) {
  const showToast = useApplicationToast();
  const actionRef = useRef(action);
  const [state, setState] = useState<CopyActionState>('idle');
  actionRef.current = action;

  const copy = useCallback(async () => {
    setState('copying');
    try {
      await actionRef.current();
      showToast(successMessage);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Copy failed';
      showToast(message);
    } finally {
      setState('idle');
    }
  }, [showToast, successMessage]);

  return {
    copy,
    state,
  };
}

interface CopyButtonProps {
  action: () => Promise<void>;
  label: string;
  successMessage: string;
  copyingLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isDisabled?: boolean;
}

export function CopyButton({
  action,
  label,
  successMessage,
  copyingLabel = 'Copying…',
  variant = 'secondary',
  size = 'sm',
  className,
  isDisabled = false,
}: CopyButtonProps) {
  const {
    copy,
    state,
  } = useCopyAction({
    action,
    successMessage,
  });

  return (
    <>
      <Button
        label={state === 'copying' ? copyingLabel : label}
        icon={<Icon icon="copy" size="sm" />}
        variant={variant}
        size={size}
        className={className}
        isDisabled={isDisabled || state === 'copying'}
        isLoading={state === 'copying'}
        onClick={() => void copy()}
      />
    </>
  );
}
