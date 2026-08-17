import { useState, type FormEvent, type ReactNode } from 'react';
import { requestPasswordReset, resetPassword } from '../authApi.ts';
import { navigate } from '../router.ts';
import { CatalogShell } from './CatalogShell.tsx';

function AuthShell({
  accountControls,
  children,
}: {
  accountControls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CatalogShell
      accountControls={accountControls}
      sidebar={<div className="catalog-pricing__rail" aria-hidden="true" />}
    >
      {children}
    </CatalogShell>
  );
}

export interface CatalogForgotPasswordPageProps {
  accountControls?: ReactNode;
  onBack?: () => void;
}

export function CatalogForgotPasswordPage({
  accountControls,
  onBack,
}: CatalogForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell accountControls={accountControls}>
      <div className="catalog-static" data-catalog-forgot-password="true">
        <h1>Reset your password</h1>
        {sent ? (
          <>
            {/* Deliberately does not say whether the address exists — that
                would turn this form into an account-enumeration oracle. */}
            <p role="status">
              If an account exists for <strong>{email.trim()}</strong>, a reset
              link is on its way. The link expires, so use it soon.
            </p>
            <div className="catalog-static__actions">
              <button
                type="button"
                className="catalog-static__cta"
                onClick={() => (onBack ? onBack() : navigate({ name: 'browse' }))}
              >
                Back to sign in
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Enter the address you signed up with and we&#8217;ll send a link.</p>
            <form className="catalog-auth__form" onSubmit={submit}>
              <label className="catalog-auth__field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {error ? <p className="catalog-auth__error" role="alert">{error}</p> : null}
              <button type="submit" className="catalog-static__cta" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export interface CatalogResetPasswordPageProps {
  token?: string;
  accountControls?: ReactNode;
  onBack?: () => void;
}

export function CatalogResetPasswordPage({
  token,
  accountControls,
  onBack,
}: CatalogResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell accountControls={accountControls}>
      <div className="catalog-static" data-catalog-reset-password="true">
        <h1>Choose a new password</h1>
        {/* Reached from an email link, so a missing token is the common
            failure — say what to do rather than showing a dead form. */}
        {!token ? (
          <>
            <p role="alert">
              This link is missing its token. Reset links expire and can only be
              used once, so request a fresh one.
            </p>
            <div className="catalog-static__actions">
              <button
                type="button"
                className="catalog-static__cta"
                onClick={() => navigate({ name: 'browse-forgot-password' })}
              >
                Request a new link
              </button>
            </div>
          </>
        ) : done ? (
          <>
            <p role="status">Your password is updated. You can sign in with it now.</p>
            <div className="catalog-static__actions">
              <button
                type="button"
                className="catalog-static__cta"
                onClick={() => (onBack ? onBack() : navigate({ name: 'browse' }))}
              >
                Go to sign in
              </button>
            </div>
          </>
        ) : (
          <form className="catalog-auth__form" onSubmit={submit}>
            <label className="catalog-auth__field">
              <span>New password</span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? <p className="catalog-auth__error" role="alert">{error}</p> : null}
            <button type="submit" className="catalog-static__cta" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

