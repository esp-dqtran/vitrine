import { useEffect, useState } from 'react';
import { Button, Icon, IconButton, SegmentedControl, SegmentedControlItem, TextInput } from '@astryxdesign/core';
import {
  BookmarkHollowIcon,
  CreditIcon,
  DashboardIcon,
  PaintBrushIcon,
  PowerIcon,
  ShieldIcon,
  UsersIcon,
} from '@storybook/icons';
import type { AuthUser } from '../authApi.ts';
import { changePassword } from '../authApi.ts';
import { createPortal, type SubscriptionView } from '../billingApi.ts';
import {
  activateProMonth,
  createReferralLink,
  loadReferralSummary,
  type ReferralSummaryView,
} from '../referralApi.ts';
import { copyShareLink } from '../screenActions.ts';
import { navigate } from '../router.ts';
import { useThemeMode, type ThemeMode } from '../theme.tsx';
import { AstryxAlertModal } from './AstryxModal.tsx';
import { ReferralSettings, TeamSettings } from './SettingsPanel.tsx';
import { useWorkspaceChrome } from './WorkspaceChromeContext.tsx';
import { useSegmentedIndicator } from './useSegmentedIndicator.ts';

type SettingsSection = 'overview' | 'teams' | 'billing' | 'security' | 'appearance';

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof DashboardIcon;
}> = [
  { id: 'overview', label: 'Profile', icon: DashboardIcon },
  { id: 'teams', label: 'Teams', icon: UsersIcon },
  { id: 'billing', label: 'Billing', icon: CreditIcon },
  { id: 'security', label: 'Security', icon: ShieldIcon },
  { id: 'appearance', label: 'Appearance', icon: PaintBrushIcon },
];

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function SettingsWorkspacePage({
  user,
  subscription,
  onUpgrade,
  onEntitlementsChanged,
  onBack,
  onSignOut,
}: {
  user: AuthUser;
  subscription?: SubscriptionView | null;
  onUpgrade: () => void;
  onEntitlementsChanged: () => void;
  onBack: () => void;
  onSignOut: () => void | Promise<void>;
}) {
  const [section, setSection] = useState<SettingsSection>('billing');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [referralSummary, setReferralSummary] = useState<ReferralSummaryView | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referralActivationOpen, setReferralActivationOpen] = useState(false);
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const themeSwitcherRef = useSegmentedIndicator(themeMode);

  useEffect(() => {
    if (user.role !== 'user') return;
    void loadReferralSummary().then(setReferralSummary).catch(() => setReferralSummary(null));
  }, [user.id, user.role]);



  const selectSection = (nextSection: SettingsSection) => {
    setSection(nextSection);
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

  const submitPassword = async () => {
    if (!currentPassword || newPassword.length < 8 || passwordBusy) return;
    setPasswordBusy(true);
    setPasswordError('');
    setPasswordSuccess(false);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSuccess(true);
    } catch (reason) {
      setPasswordError((reason as Error).message);
    } finally {
      setPasswordBusy(false);
    }
  };

  const copyReferralLink = async () => {
    setReferralBusy(true);
    setReferralError('');
    try {
      const { url } = await createReferralLink();
      await copyShareLink(url);
    } catch (reason) {
      setReferralError((reason as Error).message);
    } finally {
      setReferralBusy(false);
    }
  };

  const activationExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const activateReferralMonth = async () => {
    setReferralActivationOpen(false);
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

  const planLabel = subscription?.plan === 'pro' ? 'Pro' : 'Free';
  const planInfo = subscription?.plan === 'pro'
    ? subscription.entitlementSource === 'paid'
      ? `${subscription.interval === 'year' ? 'Yearly' : 'Monthly'} plan${subscription.currentPeriodEnd ? ` · ${subscription.cancelAtPeriodEnd ? 'ends' : 'renews'} ${formatDate(subscription.currentPeriodEnd)}` : ''}`
      : subscription.promotionExpiresAt ? `Promotional access · ends ${formatDate(subscription.promotionExpiresAt)}` : 'Pro access'
    : `${3 - (subscription?.freeUnlocksRemaining ?? 3)} of 3 apps unlocked`;

  useWorkspaceChrome(
    () => ({
      className: 'settings-workspace',
      workspace: { label: 'Back to Projects', name: 'Personal', initial: 'P', onSelect: onBack },
      nav: {
        primaryLabel: 'Settings',
        primaryActions: [
          {
            label: 'Back to App',
            icon: <Icon icon="chevronLeft" size="sm" />,
            onSelect: onBack,
          },
          ...SETTINGS_SECTIONS.map(({ id, label, icon: SectionIcon }) => ({
            label,
            icon: <SectionIcon aria-hidden="true" />,
            active: section === id,
            onSelect: () => selectSection(id),
          })),
        ],
        settings: {
          label: 'Sign out',
          icon: <PowerIcon aria-hidden="true" />,
          onSelect: () => void onSignOut(),
        },
      },
      onBrandSelect: onBack,
    }),
    [section],
  );

  return (
    <>
        <section className="settings-workspace__content" aria-labelledby={`settings-${section}-title`}>
          {section === 'overview' ? (
            <div className="settings-workspace__panel settings-workspace__profile">
              <div className="settings-workspace__title-row">
                <div><h1 id="settings-overview-title">Profile</h1><p>Manage your Vitrines account details.</p></div>
              </div>
              <div className="settings-workspace__profile-card">
                <span className="settings-workspace__profile-avatar" aria-hidden="true">{user.email.charAt(0).toUpperCase()}</span>
                <div><strong>{user.email}</strong><small>{user.role === 'admin' ? 'Administrator' : 'Member'}</small></div>
              </div>
              <dl className="settings-workspace__details">
                <div><dt>Email</dt><dd>{user.email}</dd></div>
                <div><dt>Account role</dt><dd>{user.role}</dd></div>
                <div><dt>Plan</dt><dd>{planLabel}</dd></div>
              </dl>
            </div>
          ) : null}

          {section === 'teams' ? (
            <div className="settings-workspace__panel settings-workspace__teams">
              <div className="settings-workspace__title-row"><div><h1 id="settings-teams-title">Teams</h1><p>Manage shared Projects and the people you work with.</p></div></div>
              <TeamSettings currentUserId={user.id} />
            </div>
          ) : null}

          {section === 'billing' ? (
            <div className="settings-workspace__panel settings-workspace__billing">
              <div className="settings-workspace__title-row"><div><h1 id="settings-billing-title">Subscription</h1><p>Manage and view your Vitrines plan.</p></div></div>
              <div className="settings-workspace__subscription-table product-data-table" role="table" aria-label="Subscription">
                <div className="settings-workspace__subscription-head" role="row">
                  <span role="columnheader">Product</span><span role="columnheader">Tier</span><span role="columnheader">Info</span><span role="columnheader">Action</span>
                </div>
                <div className="settings-workspace__subscription-row" role="row">
                  <span role="cell" className="settings-workspace__product"><img src="/favicon.svg" alt="" aria-hidden="true" /><strong>Vitrines</strong></span>
                  <span role="cell">{planLabel}</span>
                  <span role="cell">{planInfo}</span>
                  <span role="cell">
                    {subscription?.hasBillingCustomer
                      ? <Button label="Manage" size="sm" variant="secondary" isLoading={billingBusy} isDisabled={billingBusy} clickAction={() => void manageBilling()} />
                      : <Button label="Upgrade" size="sm" variant="primary" clickAction={onUpgrade} />}
                  </span>
                </div>
              </div>
              {billingError ? <div role="alert" className="settings-workspace__error">{billingError}</div> : null}
              {user.role === 'user' && referralSummary ? (
                <div className="settings-workspace__referrals">
                  <ReferralSettings
                    summary={referralSummary}
                    currentPro={subscription?.plan === 'pro'}
                    activationExpiresAt={activationExpiresAt}
                    onCopy={copyReferralLink}
                    onActivate={() => setReferralActivationOpen(true)}
                    busy={referralBusy}
                    error={referralError}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {section === 'security' ? (
            <div className="settings-workspace__panel settings-workspace__security">
              <div className="settings-workspace__title-row"><div><h1 id="settings-security-title">Authentication</h1><p>Keep your Vitrines account secure.</p></div></div>
              <section className="settings-workspace__form-card">
                <h2>Change password</h2>
                <p>Use at least eight characters for your new password.</p>
                <div className="settings-workspace__form-grid">
                  <TextInput label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} placeholder="Current password" width="100%" />
                  <TextInput label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="New password" width="100%" />
                  <Button label="Update password" variant="primary" isDisabled={!currentPassword || newPassword.length < 8 || passwordBusy} isLoading={passwordBusy} clickAction={() => void submitPassword()} />
                </div>
                {passwordError ? <div role="alert" className="settings-workspace__error">{passwordError}</div> : null}
                {passwordSuccess ? <div role="status" className="settings-workspace__success">Password updated.</div> : null}
              </section>
            </div>
          ) : null}

          {section === 'appearance' ? (
            <div className="settings-workspace__panel settings-workspace__appearance">
              <div className="settings-workspace__title-row"><div><h1 id="settings-appearance-title">Appearance</h1><p>Choose how Vitrines looks on this device.</p></div></div>
              <section className="settings-workspace__form-card">
                <h2>Theme</h2>
                <p>Use a light theme, dark theme, or follow your system.</p>
                <SegmentedControl ref={themeSwitcherRef} label="Theme" value={themeMode} onChange={(value) => setThemeMode(value as ThemeMode)}>
                  {THEME_OPTIONS.map(({ mode, label }) => <SegmentedControlItem key={mode} value={mode} label={label} />)}
                </SegmentedControl>
              </section>
            </div>
          ) : null}
        </section>
      <AstryxAlertModal
        isOpen={referralActivationOpen}
        onOpenChange={setReferralActivationOpen}
        title="Activate one Pro Month?"
        description={`Your Pro access will end ${formatDate(activationExpiresAt)}.`}
        actionLabel="Activate Pro Month"
        isActionLoading={referralBusy}
        onAction={() => void activateReferralMonth()}
      />
    </>
  );
}
