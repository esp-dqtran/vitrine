import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, SegmentedControl, SegmentedControlItem, TextInput } from '@astryxdesign/core';
import {
  BellIcon,
  BookmarkHollowIcon,
  CogIcon,
  CreditIcon,
  DashboardIcon,
  FolderIcon,
  MenuIcon,
  PaintBrushIcon,
  PlusIcon,
  PowerIcon,
  QuestionIcon,
  ShieldIcon,
  UserIcon,
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
import { WorkspaceHeader, WorkspaceRail } from './WorkspaceChrome.tsx';

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

function useCompactSettingsNavigation(): boolean {
  const [compact, setCompact] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 980px)').matches
  ));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 980px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return compact;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const sectionNavRef = useRef<HTMLElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const compactNavigation = useCompactSettingsNavigation();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();

  useEffect(() => {
    if (user.role !== 'user') return;
    void loadReferralSummary().then(setReferralSummary).catch(() => setReferralSummary(null));
  }, [user.id, user.role]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const firstItem = sectionNavRef.current?.querySelector<HTMLButtonElement>('nav button');
    firstItem?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileMenuOpen(false);
      menuTriggerRef.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    profileMenuRef.current?.focus();
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (profileMenuRef.current?.contains(event.target) || profileTriggerRef.current?.contains(event.target)) return;
      setProfileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setProfileMenuOpen(false);
      profileTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);

  const selectSection = (nextSection: SettingsSection) => {
    setSection(nextSection);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
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

  return (
    <main className="settings-workspace">
      <WorkspaceRail
        workspace={{ label: 'Back to Projects', initial: 'P', onSelect: onBack }}
        quickAction={{ label: 'Create Team', icon: <PlusIcon aria-hidden="true" />, onSelect: () => selectSection('teams') }}
        primaryLabel="Personal navigation"
        primaryActions={[
          { label: 'Projects', icon: <FolderIcon aria-hidden="true" />, onSelect: onBack },
          { label: 'Collections', icon: <BookmarkHollowIcon aria-hidden="true" />, onSelect: () => navigate({ name: 'collections' }) },
        ]}
        settings={{ label: 'Account settings', icon: <CogIcon aria-hidden="true" />, active: true }}
      />

      <WorkspaceHeader
        variant="settings"
        menu={{
          label: mobileMenuOpen ? 'Close Settings menu' : 'Open Settings menu',
          expanded: mobileMenuOpen,
          icon: <MenuIcon aria-hidden="true" />,
          buttonRef: menuTriggerRef,
          onSelect: () => setMobileMenuOpen((open) => !open),
        }}
        onBrandSelect={onBack}
        actions={(
          <>
          <IconButton label="Help" tooltip="Help" variant="ghost" icon={<QuestionIcon aria-hidden="true" />} />
          <IconButton label="Notifications" tooltip="Notifications" variant="ghost" icon={<BellIcon aria-hidden="true" />} />
          <IconButton
            ref={profileTriggerRef}
            className={`settings-workspace__account${profileMenuOpen ? ' is-open' : ''}`}
            label="Profile settings"
            tooltip="Profile settings"
            variant="ghost"
            icon={<UserIcon aria-hidden="true" />}
            aria-haspopup="dialog"
            aria-expanded={profileMenuOpen}
            aria-controls="settings-profile-menu"
            onClick={() => setProfileMenuOpen((open) => !open)}
          />
          {profileMenuOpen ? (
            <div ref={profileMenuRef} id="settings-profile-menu" className="settings-profile-menu" role="dialog" aria-label="Account menu" tabIndex={-1}>
              <section className="settings-profile-menu__card settings-profile-menu__identity">
                <span className="settings-profile-menu__avatar" aria-hidden="true"><UserIcon /></span>
                <strong>Vitrines account</strong>
                <span>{user.email}</span>
                <small>{user.role === 'admin' ? 'Administrator' : 'Member'}</small>
              </section>

              <section className="settings-profile-menu__card settings-profile-menu__plan" aria-label="Plan and usage">
                <strong>Your plan</strong>
                <div className="settings-profile-menu__plan-row">
                  <img src="/favicon.svg" alt="" aria-hidden="true" />
                  <div>
                    <strong>Vitrines — {planLabel}</strong>
                    <span>{planInfo}</span>
                  </div>
                  {subscription?.plan !== 'pro' ? (
                    <Button label="Upgrade" variant="primary" size="sm" className="settings-profile-menu__upgrade" onClick={() => { setProfileMenuOpen(false); onUpgrade(); }} />
                  ) : null}
                </div>
                <Button label="View and manage subscription" variant="ghost" size="sm" className="settings-profile-menu__manage" onClick={() => selectSection('billing')} />
              </section>

              <nav className="settings-profile-menu__card settings-profile-menu__actions" aria-label="Account actions">
                <Button label="Profile" variant="ghost" icon={<UserIcon aria-hidden="true" />} onClick={() => selectSection('overview')} />
                <Button label="My settings" variant="ghost" icon={<CogIcon aria-hidden="true" />} onClick={() => selectSection('appearance')} />
                <span className="settings-profile-menu__divider" aria-hidden="true" />
                <Button label="Pricing & features" variant="ghost" icon={<CreditIcon aria-hidden="true" />} onClick={() => { setProfileMenuOpen(false); onUpgrade(); }} />
                <Button label="Back to Projects" variant="ghost" icon={<FolderIcon aria-hidden="true" />} onClick={() => { setProfileMenuOpen(false); onBack(); }} />
                <Button label="Sign out" variant="ghost" icon={<PowerIcon aria-hidden="true" />} className="settings-profile-menu__sign-out" onClick={() => { setProfileMenuOpen(false); void onSignOut(); }} />
              </nav>
            </div>
          ) : null}
          </>
        )}
      />

      <button type="button" className={`settings-workspace__backdrop${mobileMenuOpen ? ' is-open' : ''}`} aria-label="Close Settings menu" tabIndex={mobileMenuOpen ? 0 : -1} onClick={() => { setMobileMenuOpen(false); menuTriggerRef.current?.focus(); }} />

      <div className="settings-workspace__body">
        <aside
          ref={sectionNavRef}
          className={`settings-workspace__section-nav${mobileMenuOpen ? ' is-open' : ''}`}
          aria-label="Settings sections"
          aria-hidden={compactNavigation && !mobileMenuOpen ? true : undefined}
          inert={compactNavigation && !mobileMenuOpen ? true : undefined}
        >
          <div className="settings-workspace__section-nav-heading">
            <strong>Settings</strong>
            <small>Personal account</small>
          </div>
          <nav>
            {SETTINGS_SECTIONS.map(({ id, label, icon: SectionIcon }) => (
              <button key={id} type="button" className={section === id ? 'is-active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => selectSection(id)}>
                <SectionIcon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

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
                <SegmentedControl label="Theme" value={themeMode} onChange={(value) => setThemeMode(value as ThemeMode)}>
                  {THEME_OPTIONS.map(({ mode, label }) => <SegmentedControlItem key={mode} value={mode} label={label} />)}
                </SegmentedControl>
              </section>
            </div>
          ) : null}
        </section>
      </div>
      <AstryxAlertModal
        isOpen={referralActivationOpen}
        onOpenChange={setReferralActivationOpen}
        title="Activate one Pro Month?"
        description={`Your Pro access will end ${formatDate(activationExpiresAt)}.`}
        actionLabel="Activate Pro Month"
        isActionLoading={referralBusy}
        onAction={() => void activateReferralMonth()}
      />
    </main>
  );
}
