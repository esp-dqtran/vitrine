import { useEffect, useState } from 'react';
import { Button, SegmentedControl, SegmentedControlItem, Selector, TextInput } from '@astryxdesign/core';
import { changePassword } from '../authApi';
import type { AuthUser } from '../authApi';
import { createPortal, type SubscriptionView } from '../billingApi';
import {
  activateProMonth,
  createReferralLink,
  loadReferralSummary,
  type ReferralSummaryView,
} from '../referralApi';
import { copyShareLink } from '../screenActions.ts';
import {
  addTeamMember,
  createTeam,
  listTeamMembers,
  listTeams,
  removeTeamMember,
  type TeamMember,
  type TeamSummary,
} from '../organizationsApi.ts';
import { useThemeMode, type ThemeMode } from '../theme';
import { AstryxAlertModal, AstryxModal } from './AstryxModal.tsx';
import { CopyButton } from './CopyButton.tsx';

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
  const isTeam = subscription.entitlementSource === 'team';
  const isPromotion = subscription.entitlementSource === 'promotion';
  const isAdminGrant = subscription.entitlementSource === 'admin_grant';
  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Subscription</h3>
      <div style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>{isTeam ? 'Team plan' : isPromotion ? 'Promotional Pro' : isAdminGrant ? 'Administrator-granted Pro' : isPro ? 'Pro plan' : 'Free plan'}</strong>
        {isPaid ? (
          <>
            <span>{subscription.interval === 'year' ? 'Yearly billing' : 'Monthly billing'}</span>
            {subscription.currentPeriodEnd && <span>{subscription.cancelAtPeriodEnd ? 'Access ends' : 'Renews'} {formatDate(subscription.currentPeriodEnd)}</span>}
            {subscription.status === 'past_due' && subscription.graceExpiresAt && <span style={{ color: 'var(--color-text-danger)' }}>Payment past due · grace ends {formatDate(subscription.graceExpiresAt)}</span>}
            <span>{subscription.exportUsage.used} of {subscription.exportUsage.limit} exports used</span>
          </>
        ) : isTeam ? (
          <>
            <span>{subscription.team?.organizationName} · {subscription.team?.seats} editor seats</span>
            <span>{subscription.exportUsage.used} of {subscription.exportUsage.limit} shared exports used</span>
          </>
        ) : isPromotion ? (
          <>
            {subscription.promotionExpiresAt && <span>Access ends {formatDate(subscription.promotionExpiresAt)}</span>}
            <span>{subscription.exportUsage.used} of {subscription.exportUsage.limit} exports used</span>
          </>
        ) : isAdminGrant ? (
          <>
            <span>Pro access granted by an administrator</span>
            <span>{subscription.exportUsage.used} of {subscription.exportUsage.limit} exports used</span>
          </>
        ) : <span>{3 - subscription.freeUnlocksRemaining} of 3 apps unlocked</span>}
      </div>
      <div style={{ marginTop: 12 }}>
        {isAdminGrant && !subscription.hasBillingCustomer ? null : isPaid || isTeam || subscription.hasBillingCustomer
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
  onCopy: () => Promise<void>;
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
          <CopyButton
            label="Copy referral link"
            successMessage="Referral link copied"
            size="sm"
            variant="secondary"
            isDisabled={busy}
            action={onCopy}
          />
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

export function TeamSettings({ currentUserId }: { currentUserId: number }) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member'>('member');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState('');

  const selectedTeam = teams.find(({ id }) => id === selectedTeamId);
  const canManage = selectedTeam?.role === 'owner' || selectedTeam?.role === 'admin';

  const refreshTeams = async (preferredId?: number) => {
    try {
      const nextTeams = await listTeams();
      setTeams(nextTeams);
      setAvailable(true);
      setSelectedTeamId((current) => preferredId
        ?? (nextTeams.some(({ id }) => id === current) ? current : nextTeams[0]?.id));
    } catch (reason) {
      if ((reason as Error).message === 'Not found') setAvailable(false);
      else setError((reason as Error).message);
    }
  };

  useEffect(() => { void refreshTeams(); }, []);
  useEffect(() => {
    if (!selectedTeamId) { setMembers([]); return; }
    void listTeamMembers(selectedTeamId)
      .then((nextMembers) => { setMembers(nextMembers); setError(''); })
      .catch((reason: Error) => setError(reason.message));
  }, [selectedTeamId]);

  if (!available) return null;

  const submitTeam = async () => {
    if (!newTeamName.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const created = await createTeam(newTeamName.trim());
      setNewTeamName('');
      await refreshTeams(created.id);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitMember = async () => {
    if (!selectedTeamId || !memberEmail.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const member = await addTeamMember(selectedTeamId, memberEmail.trim(), memberRole);
      setMembers((current) => [...current.filter(({ userId }) => userId !== member.userId), member]);
      setMemberEmail('');
      await refreshTeams(selectedTeamId);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: TeamMember) => {
    if (!selectedTeamId || busy) return;
    setBusy(true);
    setError('');
    try {
      await removeTeamMember(selectedTeamId, member.userId);
      setMembers((current) => current.filter(({ userId }) => userId !== member.userId));
      await refreshTeams(selectedTeamId);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="team-settings" aria-label="Team management">
      <div className="team-settings__grid">
        <section className="team-settings__card" aria-labelledby="current-team-heading">
          <header className="team-settings__card-header">
            <div>
              <span className="team-settings__eyebrow">Your teams</span>
              <h2 id="current-team-heading">Current team</h2>
              <p>Choose the shared space you want to manage.</p>
            </div>
            {selectedTeam ? <span className="team-settings__role-badge">{selectedTeam.role}</span> : null}
          </header>

          {teams.length ? (
            <div className="team-settings__selector">
              <Selector
                label="Team"
                value={String(selectedTeamId ?? '')}
                onChange={(value) => setSelectedTeamId(Number(value))}
                options={teams.map((team) => ({
                  value: String(team.id),
                  label: `${team.name} · ${team.memberCount} ${team.memberCount === 1 ? 'member' : 'members'}`,
                }))}
                width="100%"
              />
            </div>
          ) : (
            <div className="team-settings__empty">
              <strong>No teams yet</strong>
              <span>Create your first Team to start sharing work.</span>
            </div>
          )}

          {selectedTeam ? (
            <div className="team-settings__summary">
              <span className="team-settings__avatar" aria-hidden="true">{selectedTeam.name.charAt(0).toUpperCase()}</span>
              <div>
                <strong>{selectedTeam.name}</strong>
                <span>{selectedTeam.memberCount} {selectedTeam.memberCount === 1 ? 'member' : 'members'}</span>
              </div>
            </div>
          ) : null}

          <div className="team-settings__create">
            <div>
              <h3>Create a new team</h3>
              <p>Start a separate space for another product or group.</p>
            </div>
            <div className="team-settings__create-form">
              <TextInput
                label="Team name"
                placeholder="e.g. Product design"
                value={newTeamName}
                onChange={setNewTeamName}
                width="100%"
                isDisabled={busy}
              />
              <Button label="Create team" size="sm" variant="secondary" isDisabled={!newTeamName.trim() || busy} clickAction={() => void submitTeam()} />
            </div>
          </div>
        </section>

        <section className="team-settings__card team-settings__members-card" aria-labelledby="team-members-heading">
          <header className="team-settings__card-header">
            <div>
              <span className="team-settings__eyebrow">Access</span>
              <div className="team-settings__heading-with-count">
                <h2 id="team-members-heading">Members</h2>
                {selectedTeam ? <span>{members.length}</span> : null}
              </div>
              <p>People who can access projects in this team.</p>
            </div>
          </header>

          {selectedTeam ? (
            <div className="team-settings__member-list" role="list" aria-label="Team members">
              {members.map((member) => (
                <div key={member.userId} className="team-settings__member" role="listitem">
                  <span className="team-settings__avatar" aria-hidden="true">{member.email.charAt(0).toUpperCase()}</span>
                  <div className="team-settings__member-identity">
                    <strong>{member.email}</strong>
                    {member.userId === currentUserId ? <span>You</span> : null}
                  </div>
                  <span className="team-settings__role-badge">{member.role}</span>
                  {canManage && member.role !== 'owner' && member.userId !== currentUserId ? (
                    <Button label="Remove" size="sm" variant="ghost" isDisabled={busy} clickAction={() => void removeMember(member)} />
                  ) : null}
                </div>
              ))}
              {!members.length ? <div className="team-settings__empty"><span>No members found for this team.</span></div> : null}
            </div>
          ) : (
            <div className="team-settings__empty"><span>Select or create a team to manage its members.</span></div>
          )}

          {selectedTeam && canManage ? (
            <div className="team-settings__invite">
              <div>
                <h3>Invite a member</h3>
                <p>Add an existing Vitrines account and choose their access level.</p>
              </div>
              <div className="team-settings__invite-form">
                <TextInput
                  label="Member email"
                  placeholder="name@company.com"
                  value={memberEmail}
                  onChange={setMemberEmail}
                  width="100%"
                  isDisabled={busy}
                />
                <Selector
                  label="Role"
                  value={memberRole}
                  onChange={(value) => setMemberRole(value as 'admin' | 'member')}
                  options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]}
                  width="100%"
                />
                <Button label="Add member" size="sm" variant="primary" isDisabled={!memberEmail.trim() || busy} isLoading={busy} clickAction={() => void submitMember()} />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {error ? <div role="alert" className="team-settings__error">{error}</div> : null}
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
  const [referralActivationOpen, setReferralActivationOpen] = useState(false);
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();

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
      const portal = await createPortal(subscription?.team?.organizationId);
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
      await copyShareLink(url);
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

  return (
    <>
      <AstryxModal
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      purpose="info"
      width="min(420px, 100vw)"
      maxHeight="100vh"
      position={{ top: 0, right: 0, bottom: 0 }}
      padding={0}
      presentation="drawer-right"
      aria-label="Account settings"
      className="settings-panel-dialog"
    >
      <div style={{ height: '100%', overflowY: 'auto', padding: 22, boxSizing: 'border-box' }}>
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
            onCopy={copyReferralLink}
            onActivate={() => setReferralActivationOpen(true)}
            busy={referralBusy}
            error={referralError}
          />
        )}

        <TeamSettings currentUserId={user.id} />

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
          {success && <div style={{ color: 'var(--color-text-success)', fontSize: 12, marginTop: 8 }}>Password updated.</div>}
        </section>
      </div>
      </AstryxModal>
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
