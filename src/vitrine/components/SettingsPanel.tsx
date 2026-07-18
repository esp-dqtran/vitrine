import { useEffect, useState } from 'react';
import { Button, SegmentedControl, SegmentedControlItem, TextInput } from '@astryxdesign/core';
import { changePassword } from '../authApi';
import type { AuthUser } from '../authApi';
import { useThemeMode, type ThemeMode } from '../theme';
import { useSlidePanel } from '../useSlidePanel';

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
  const { overlayRef, panelRef } = useSlidePanel();

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
    <div ref={overlayRef} onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'var(--color-background-overlay, rgba(0,0,0,0.3))' }}>
      <aside ref={panelRef} role="dialog" aria-label="Account settings" onMouseDown={(event) => event.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 45, width: 'min(420px, 100vw)', overflowY: 'auto', background: 'var(--color-background-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: 'var(--shadow-high)', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ flex: 1, margin: 0 }}>Settings</h2>
          <Button label="Close" size="sm" onClick={onClose} />
        </div>

        <section style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 13.5 }}>Account</h3>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{user.email}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-disabled)', marginTop: 2 }}>{user.role}</div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Appearance</h3>
          <SegmentedControl label="Theme" value={themeMode} onChange={(value) => setThemeMode(value as ThemeMode)}>{THEME_OPTIONS.map(({ mode, label }) => <SegmentedControlItem key={mode} value={mode} label={label} />)}</SegmentedControl>
        </section>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Change password</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <TextInput
              label="Current password"
              isLabelHidden
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Current password"
              width="100%"
            />
            <TextInput
              label="New password"
              isLabelHidden
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="New password (min 8 characters)"
              width="100%"
            />
            <Button label="Update password" variant="primary" isDisabled={saving || !currentPassword || newPassword.length < 8} isLoading={saving} clickAction={submit} />
          </div>
          {error && <div role="alert" style={{ color: 'var(--color-text-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
          {success && <div style={{ color: 'var(--color-text-success, #1a7f37)', fontSize: 12, marginTop: 8 }}>Password updated.</div>}
        </section>
      </aside>
    </div>
  );
}
