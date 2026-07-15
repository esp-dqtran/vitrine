import { useEffect, useState } from 'react';
import { changePassword } from '../authApi';
import type { AuthUser } from '../authApi';
import { useThemeMode, type ThemeMode } from '../theme';

interface SettingsPanelProps {
  user: AuthUser;
  onClose: () => void;
}

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

export function SettingsPanel({ user, onClose }: SettingsPanelProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = async () => {
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setSuccess(true);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'var(--color-background-overlay, rgba(0,0,0,0.3))' }}>
      <aside role="dialog" aria-label="Account settings" onMouseDown={(event) => event.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 45, width: 'min(420px, 100vw)', overflowY: 'auto', background: 'var(--color-background-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: 'var(--shadow-high)', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ flex: 1, margin: 0 }}>Settings</h2>
          <button type="button" onClick={onClose} style={buttonStyle}>Close</button>
        </div>

        <section style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 13.5 }}>Account</h3>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{user.email}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-disabled)', marginTop: 2 }}>{user.role}</div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Appearance</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {THEME_OPTIONS.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setThemeMode(mode)}
                style={{ ...buttonStyle, flex: 1, ...(themeMode === mode ? activeButtonStyle : null) }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Change password</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Current password"
              style={inputStyle}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password (min 8 characters)"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !currentPassword || newPassword.length < 8}
              style={buttonStyle}
            >
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </div>
          {error && <div role="alert" style={{ color: 'var(--color-text-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
          {success && <div style={{ color: 'var(--color-text-success, #1a7f37)', fontSize: 12, marginTop: 8 }}>Password updated.</div>}
        </section>
      </aside>
    </div>
  );
}

const buttonStyle = { border: '1px solid var(--color-border)', borderRadius: 9, padding: '8px 12px', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 600 };
const activeButtonStyle = { border: '1px solid var(--color-accent)', color: 'var(--color-accent)' };
const inputStyle = { height: 38, border: '1px solid var(--color-border)', borderRadius: 9, padding: '0 11px', background: 'var(--color-background-body)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 12.5 };
