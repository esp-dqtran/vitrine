import { useEffect, useState } from 'react';
import { Button, Icon, IconButton, SegmentedControl, SegmentedControlItem, TextInput } from '@astryxdesign/core';
import {
  CommandIcon,
  CreditIcon,
  DashboardIcon,
  PowerIcon,
} from '@storybook/icons';
import type { AuthUser } from '../authApi.ts';
import { changePassword } from '../authApi.ts';
import {
  createMcpAccessToken,
  listMcpAccessTokens,
  revokeMcpAccessToken,
  type McpAccessToken,
} from '../mcpApi.ts';
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

type SettingsSection = 'overview' | 'teams' | 'billing' | 'security' | 'integrations';

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof DashboardIcon;
}> = [
  { id: 'overview', label: 'Profile', icon: DashboardIcon },
  { id: 'billing', label: 'Billing', icon: CreditIcon },
  { id: 'integrations', label: 'Integrations', icon: CommandIcon },
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
  initialSection = 'overview',
  onUpgrade,
  onEntitlementsChanged,
  onBack,
  onSignOut,
}: {
  user: AuthUser;
  subscription?: SubscriptionView | null;
  initialSection?: SettingsSection;
  onUpgrade: () => void;
  onEntitlementsChanged: () => void;
  onBack: () => void;
  onSignOut: () => void | Promise<void>;
}) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [mcpTokens, setMcpTokens] = useState<McpAccessToken[]>([]);
  const [newMcpToken, setNewMcpToken] = useState('');
  const [mcpBusy, setMcpBusy] = useState(false);
  const [mcpError, setMcpError] = useState('');
  const [mcpUrlCopied, setMcpUrlCopied] = useState(false);
  const [mcpTokenPendingRevoke, setMcpTokenPendingRevoke] = useState<McpAccessToken | null>(null);
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

  useEffect(() => {
    if (section !== 'integrations') return;
    void listMcpAccessTokens().then(setMcpTokens).catch((reason: Error) => setMcpError(reason.message));
  }, [section]);



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

  const createFlowAccessToken = async () => {
    if (mcpBusy) return;
    setMcpBusy(true);
    setMcpError('');
    try {
      const created = await createMcpAccessToken();
      setNewMcpToken(created.token);
      setMcpTokens((current) => [created.accessToken, ...current]);
    } catch (reason) {
      setMcpError((reason as Error).message);
    } finally {
      setMcpBusy(false);
    }
  };

  const revokeFlowAccessToken = async (token: McpAccessToken) => {
    if (mcpBusy) return;
    setMcpBusy(true);
    setMcpError('');
    try {
      await revokeMcpAccessToken(token.id);
      setMcpTokens((current) => current.filter((currentToken) => currentToken.id !== token.id));
      setMcpTokenPendingRevoke(null);
    } catch (reason) {
      setMcpError((reason as Error).message);
    } finally {
      setMcpBusy(false);
    }
  };

  const mcpUrl = 'https://vitrines.ai/api/mcp';
  const copyMcpUrl = async () => {
    setMcpError('');
    try {
      await copyShareLink(mcpUrl);
      setMcpUrlCopied(true);
    } catch (reason) {
      setMcpError((reason as Error).message);
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
      : subscription.entitlementSource === 'admin_grant' ? 'Pro access granted by an administrator'
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
              <section className="settings-workspace__form-card settings-workspace__profile-preferences" aria-labelledby="settings-profile-appearance-title">
                <div className="settings-workspace__profile-preferences-copy">
                  <h2 id="settings-profile-appearance-title">Appearance</h2>
                  <p>Choose how Vitrines looks on this device.</p>
                </div>
                <div className="settings-workspace__profile-theme-setting">
                  <span>Theme</span>
                  <SegmentedControl ref={themeSwitcherRef} label="Theme" value={themeMode} onChange={(value) => setThemeMode(value as ThemeMode)}>
                    {THEME_OPTIONS.map(({ mode, label }) => <SegmentedControlItem key={mode} value={mode} label={label} />)}
                  </SegmentedControl>
                </div>
              </section>
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

          {section === 'integrations' ? (
            <div className="settings-workspace__panel settings-workspace__integrations">
              <div className="settings-workspace__title-row"><div><h1 id="settings-integrations-title">Integrations</h1><p>Connect Vitrines research to the tools where you work.</p></div></div>
              <section className="settings-workspace__integration-card" aria-labelledby="flow-mcp-title">
                <div className="settings-workspace__integration-heading">
                  <div>
                    <span className="settings-workspace__integration-kicker">Model Context Protocol</span>
                    <h2 id="flow-mcp-title">Flow MCP</h2>
                    <p>Search published product flows and inspect their screen captures directly in Codex.</p>
                  </div>
                </div>
                <ol className="settings-workspace__integration-steps">
                  <li>
                    <span aria-hidden="true">1</span>
                    <div><strong>Create an access token</strong><p>Use this token only for your MCP client. It is shown once.</p></div>
                    <Button label="Create token" size="sm" variant="primary" isDisabled={mcpBusy} isLoading={mcpBusy} clickAction={() => void createFlowAccessToken()} />
                  </li>
                  <li>
                    <span aria-hidden="true">2</span>
                    <div><strong>Add Vitrines in Codex</strong><p>Open Codex Settings → MCP servers → Add server, then choose Streamable HTTP.</p></div>
                  </li>
                  <li>
                    <span aria-hidden="true">3</span>
                    <div><strong>Paste the endpoint and token</strong><p>Use this endpoint and add the access token as a Bearer token.</p></div>
                    <div className="settings-workspace__integration-endpoint">
                      <code>{mcpUrl}</code>
                      <Button className="settings-workspace__integration-copy-url" label={mcpUrlCopied ? 'Copied' : 'Copy URL'} size="sm" variant="secondary" clickAction={() => void copyMcpUrl()} />
                    </div>
                  </li>
                </ol>
                {newMcpToken ? (
                  <div role="status" className="settings-workspace__success">
                    Copy this token now. It will not be shown again: <code>{newMcpToken}</code>
                  </div>
                ) : null}
                {mcpTokens.length ? (
                  <div className="settings-workspace__integration-tokens">
                    <h3>Active access tokens</h3>
                    <div className="settings-workspace__integration-token-table" role="table" aria-label="Active Flow MCP access tokens">
                      <div className="settings-workspace__integration-token-head" role="row">
                        <span role="columnheader">Name</span>
                        <span role="columnheader">Token</span>
                        <span role="columnheader">Expires</span>
                        <span role="columnheader">Action</span>
                      </div>
                      {mcpTokens.map((token) => (
                        <div key={token.id} className="settings-workspace__integration-token-row" role="row">
                          <strong role="cell">{token.label}</strong>
                          <code role="cell">{token.prefix}…</code>
                          <span role="cell">{formatDate(token.expiresAt)}</span>
                          <span role="cell"><Button className="settings-workspace__integration-revoke" label="Revoke" size="sm" variant="ghost" isDisabled={mcpBusy} clickAction={() => setMcpTokenPendingRevoke(token)} /></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {mcpError ? <div role="alert" className="settings-workspace__error">{mcpError}</div> : null}
              </section>
            </div>
          ) : null}

        </section>
      <AstryxAlertModal
        isOpen={mcpTokenPendingRevoke !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setMcpTokenPendingRevoke(null);
        }}
        title="Revoke this access token?"
        description={mcpTokenPendingRevoke
          ? `This immediately disconnects MCP clients using ${mcpTokenPendingRevoke.label}. This cannot be undone.`
          : ''}
        cancelLabel="Keep token"
        actionLabel="Revoke token"
        actionVariant="destructive"
        isActionLoading={mcpBusy}
        onAction={() => {
          if (mcpTokenPendingRevoke) void revokeFlowAccessToken(mcpTokenPendingRevoke);
        }}
      />
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
