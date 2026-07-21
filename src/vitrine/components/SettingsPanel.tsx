import { useEffect, useState } from 'react';
import { Button, SegmentedControl, SegmentedControlItem, TextInput } from '@astryxdesign/core';
import { changePassword } from '../authApi';
import type { AuthUser } from '../authApi';
import { createPortal, type SubscriptionView } from '../billingApi';
import {
  activateProMonth,
  createReferralLink,
  loadReferralSummary,
  type ReferralSummaryView,
} from '../referralApi';
import { useThemeMode, type ThemeMode } from '../theme';
import { useSlidePanel } from '../useSlidePanel';

interface SettingsPanelProps {
  user: AuthUser;
  subscription?: SubscriptionView | null;
  onUpgrade?: () => void;
  onEntitlementsChanged?: () => void;
  onClose: () => void;
}

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

export function BillingSettings({ subscription, onUpgrade, onManage, busy = false, error = '' }: {
  subscription: SubscriptionView;
  onUpgrade: () => void;
  onManage: () => void;
  busy?: boolean;
  error?: string;
}) {
  const isPro = subscription.plan === 'pro';
  const isPaid = subscription.entitlementSource === 'paid';
  const isPromotion = subscription.entitlementSource === 'promotion';
  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Subscription</h3>
      <div style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>{isPromotion ? 'Promotional Pro' : isPro ? 'Pro plan' : 'Free plan'}</strong>
        {isPaid ? (
          <>
            <span>{subscription.interval === 'year' ? 'Yearly billing' : 'Monthly billing'}</span>
            {subscription.currentPeriodEnd && <span>{subscription.cancelAtPeriodEnd ? 'Access ends' : 'Renews'} {formatDate(subscription.currentPeriodEnd)}</span>}
            {subscription.status === 'past_due' && subscription.graceExpiresAt && <span style={{ color: 'var(--color-text-danger)' }}>Payment past due · grace ends {formatDate(subscription.graceExpiresAt)}</span>}
            <span>{subscription.exportUsage.used} of {subscription.exportUsage.limit} exports used</span>
          </>
        ) : isPromotion ? (
          <>
            {subscription.promotionExpiresAt && <span>Access ends {formatDate(subscription.promotionExpiresAt)}</span>}
            <span>{subscription.exportUsage.used} of {subscription.exportUsage.limit} exports used</span>
          </>
        ) : <span>{3 - subscription.freeUnlocksRemaining} of 3 apps unlocked</span>}
      </div>
      <div style={{ marginTop: 12 }}>
        {isPaid || subscription.hasBillingCustomer
          ? <Button label="Manage billing" size="sm" variant="secondary" isLoading={busy} isDisabled={busy} clickAction={onManage} />
          : <Button label="Upgrade to Pro" size="sm" variant="primary" clickAction={onUpgrade} />}
      </div>
      {error && <div role="alert" style={{ color: 'var(--color-text-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </section>
  );
}

export function ReferralSettings({
  summary,
  currentPro,
  activationExpiresAt,
  onCopy,
  onActivate,
  busy = false,
  error = '',
}: {
  summary: ReferralSummaryView;
  currentPro: boolean;
  activationExpiresAt: string;
  onCopy: () => void;
  onActivate: () => void;
  busy?: boolean;
  error?: string;
}) {
  const available = summary.availableMonths;
  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 13.5 }}>Invite friends</h3>
      <div style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        <span>Give a friend one month of Pro. Earn one when they become active.</span>
        <strong style={{ color: 'var(--color-text-primary)' }}>{summary.earnedCount} of 3 rewards earned</strong>
        <span>Campaign ends {formatDate(summary.campaign.endsAt)}</span>
        {summary.referrals.map((referral, index) => (
          <span key={referral.id}>Invite {index + 1}: {referral.state[0].toUpperCase() + referral.state.slice(1)}</span>
        ))}
      </div>
      {summary.campaign.active && (
        <div style={{ marginTop: 12 }}>
          <Button label="Copy referral link" size="sm" variant="secondary" isDisabled={busy} clickAction={onCopy} />
        </div>
      )}
      <div style={{ marginTop: 14, display: 'grid', gap: 6, fontSize: 12.5 }}>
        <strong>{available === 1 ? '1 Pro Month ready' : `${available} Pro Months ready`}</strong>
        {available > 0 && currentPro && <span style={{ color: 'var(--color-text-secondary)' }}>Available after your current Pro access ends.</span>}
        {available > 0 && !currentPro && (
          <>
            <span style={{ color: 'var(--color-text-secondary)' }}>Activate now and access ends {formatDate(activationExpiresAt)}.</span>
            <Button label="Activate 1 Pro Month" size="sm" variant="primary" isLoading={busy} isDisabled={busy} clickAction={onActivate} />
          </>
        )}
      </div>
      {error && <div role="alert" style={{ color: 'var(--color-text-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </section>
  );
}

export function SettingsPanel({ user, subscription, onUpgrade = () => undefined, onEntitlementsChanged = () => undefined, onClose }: SettingsPanelProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [referralSummary, setReferralSummary] = useState<ReferralSummaryView | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralError, setReferralError] = useState('');
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { overlayRef, panelRef } = useSlidePanel();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (user.role !== 'user') return;
    void loadReferralSummary()
      .then(setReferralSummary)
      .catch((reason: Error) => setReferralError(reason.message));
  }, [user.id, user.role]);

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

  const manageBilling = async () => {
    setBillingBusy(true);
    setBillingError('');
    try {
      const portal = await createPortal();
      const target = new URL(portal.url);
      if (target.protocol !== 'https:') throw new Error('Billing returned an unsafe redirect');
      window.location.assign(target.href);
    } catch (reason) {
      setBillingError((reason as Error).message);
      setBillingBusy(false);
    }
  };

  const copyReferralLink = async () => {
    setReferralBusy(true);
    setReferralError('');
    try {
      const { url } = await createReferralLink();
      await navigator.clipboard.writeText(url);
    } catch (reason) {
      setReferralError((reason as Error).message);
    } finally {
      setReferralBusy(false);
    }
  };

  const activationExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const activateReferralMonth = async () => {
    if (!window.confirm(`Activate one Pro Month now? Access will end ${formatDate(activationExpiresAt)}.`)) return;
    setReferralBusy(true);
    setReferralError('');
    try {
      await activateProMonth();
      onEntitlementsChanged();
      setReferralSummary(await loadReferralSummary());
    } catch (reason) {
      setReferralError((reason as Error).message);
    } finally {
      setReferralBusy(false);
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

        {subscription && <BillingSettings subscription={subscription} onUpgrade={onUpgrade} onManage={() => void manageBilling()} busy={billingBusy} error={billingError} />}

        {user.role === 'user' && referralSummary && (
          <ReferralSettings
            summary={referralSummary}
            currentPro={subscription?.plan === 'pro'}
            activationExpiresAt={activationExpiresAt}
            onCopy={() => void copyReferralLink()}
            onActivate={() => void activateReferralMonth()}
            busy={referralBusy}
            error={referralError}
          />
        )}

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
