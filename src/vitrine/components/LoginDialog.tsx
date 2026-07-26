import { Dialog } from '@astryxdesign/core';
import type { AuthUser } from '../authApi.ts';
import { SignIn } from '../SignIn.tsx';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  authenticate: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, referralToken?: string) => Promise<AuthUser>;
  onSignedIn: (user: AuthUser) => void;
}

export function LoginDialog({
  isOpen,
  onClose,
  authenticate,
  register,
  onSignedIn,
}: LoginDialogProps) {
  const complete = (user: AuthUser) => {
    onSignedIn(user);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      purpose="info"
      width={460}
    >
      <div
        data-login-dialog="true"
        style={{
          minHeight: 'min(600px, 68vh)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <SignIn
          embedded
          authenticate={authenticate}
          register={register}
          onSignedIn={complete}
        />
      </div>
    </Dialog>
  );
}
