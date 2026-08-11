import type { AuthUser } from '../authApi.ts';
import { SignIn } from '../SignIn.tsx';
import { AstryxModal } from './AstryxModal.tsx';

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
    <AstryxModal
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
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div
          data-catalog-login-message="true"
          style={{ textAlign: 'center', paddingInline: 24 }}
        >
          <strong>See more of the Vitrines catalog</strong>
          <p style={{ margin: '8px 0 0' }}>
            Create a free account or sign in to continue beyond the first 32 Apps, Sites, and Flows.
          </p>
        </div>
        <SignIn
          embedded
          authenticate={authenticate}
          register={register}
          onSignedIn={complete}
        />
      </div>
    </AstryxModal>
  );
}
