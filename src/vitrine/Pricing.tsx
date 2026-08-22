import { useEffect, useState, type ReactNode } from 'react';
import { Button, Divider, Heading, Icon, Text, useMediaQuery } from '@astryxdesign/core';
import type { AuthUser } from './authApi';
import { createCheckout, createTeamCheckout, loadSubscription, type SubscriptionView } from './billingApi';
import { openPaddleCheckout } from './paddleCheckout';
import { createTeam, listTeams } from './organizationsApi.ts';
import { PRO_PRICE_CENTS, TEAM_EDITOR_PRICE_CENTS, TEAM_MINIMUM_EDITORS, teamAnnualPriceCents } from '../pricing.ts';
import { AstryxMenu } from './components/AstryxDropdown';

type ComparisonValue = string | boolean;

const FEATURES: Array<{ icon: 'search' | 'bookOpen' | 'folder' | 'download' | 'users'; label: string; detail: string; free: ComparisonValue; pro: ComparisonValue; team: ComparisonValue }> = [
  { icon: 'bookOpen', label: 'Catalog access', detail: 'How much of the library you can study.', free: '3 apps, unlocked for good', pro: 'Every app, current and future', team: 'Every app for every editor' },
  { icon: 'search', label: 'Depth and insight', detail: 'Screens, flows, components, tokens and evidence.', free: 'Full depth on your 3 apps', pro: 'Full depth across the catalog', team: 'Full depth across the catalog' },
  { icon: 'folder', label: 'Research workspace', detail: 'Save, organize and return to what matters.', free: '1 personal collection', pro: 'Unlimited personal collections', team: 'Shared organization projects' },
  { icon: 'download', label: 'Compare and export', detail: 'Turn selected evidence into useful output.', free: false, pro: 'Search, compare and selected exports', team: 'Team-wide comparison and exports' },
  { icon: 'users', label: 'Collaboration', detail: 'Build a shared research habit.', free: false, pro: false, team: 'Shared workspace and member management' },
];

const FAQS = [
  ['What happens after I use my 3 free unlocks?', 'Nothing is taken away — your 3 unlocked applications stay fully accessible for good. Pro opens the rest of the catalog.'],
  ['What changes with yearly Pro?', 'Nothing except the price. Yearly Pro has the same entitlements and is billed once a year at a lower effective rate.'],
  ['How does Team billing work?', 'Team is annual-only at launch: $29 per editor per month, billed annually, with a three-editor minimum. Every Team member is an editor today.'],
  ['What is included in an export?', 'Selected editable evidence and complete observed design-system exports are included within the fair-use policy.'],
] as const;

function Value({ value, pro = false }: { value: ComparisonValue; pro?: boolean }) {
  if (typeof value === 'boolean') return value ? <Icon icon="check" size="sm" color={pro ? 'inherit' : 'success'} /> : <span className="pricing-v2__dash">—</span>;
  return <span className="pricing-v2__cell-copy">{value}</span>;
}

function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`pricing-v2__section ${className}`}>{children}</section>;
}

function Faq() {
  const [open, setOpen] = useState(0);
  return <div className="pricing-v2__faq">
    {FAQS.map(([question, answer], index) => <div className="pricing-v2__faq-row" key={question}>
      <Button
        label={question}
        variant="ghost"
        aria-expanded={open === index}
        clickAction={() => setOpen(open === index ? -1 : index)}
        endContent={<Icon icon={open === index ? 'chevronUp' : 'chevronDown'} size="sm" />}
        className="pricing-v2__faq-button"
      />
      {open === index ? <Text color="secondary" className="pricing-v2__faq-answer">{answer}</Text> : null}
    </div>)}
  </div>;
}

function FreeUnlockUsage({ subscription, onBrowse, onCheckout, loading }: { subscription: SubscriptionView; onBrowse: () => void; onCheckout: () => void; loading: boolean }) {
  const used = subscription.freeUnlocks.length;
  const limit = used + subscription.freeUnlocksRemaining;
  const exhausted = subscription.freeUnlocksRemaining === 0;
  return <Section className="pricing-v2__unlock">
    <div>
      <span className="pricing-v2__eyebrow">Your Free access</span>
      <Heading level={3}>{used} of {limit} permanent app unlocks used</Heading>
      {exhausted ? <Text color="secondary"><strong>All unlocks used.</strong> Your unlocked apps stay available forever; Pro opens the complete library.</Text> : <Text color="secondary">{subscription.freeUnlocksRemaining} remaining. Browse public previews freely, then choose the applications you want to keep. Your unlocked apps are yours for good.</Text>}
    </div>
    <div className="pricing-v2__unlock-actions">
      <Button label="Browse apps" variant="secondary" clickAction={onBrowse} />
      <Button label={exhausted ? 'Open the full catalog' : 'Upgrade to Pro'} variant="primary" clickAction={onCheckout} isDisabled={loading} isLoading={loading} />
    </div>
  </Section>;
}

interface PricingViewProps {
  user: AuthUser | null;
  subscription: SubscriptionView | null;
  onBrowse: () => void;
  onSignIn: () => void;
  onCheckout: () => void;
  onTeamCheckout?: () => void;
  yearly?: boolean;
  onYearlyChange?: (yearly: boolean) => void;
  loading?: boolean;
  error?: string;
}

export function PricingView({ user, subscription, onBrowse, onSignIn, onCheckout, onTeamCheckout = () => undefined, yearly = false, onYearlyChange = () => undefined, loading = false, error = '' }: PricingViewProps) {
  const compact = useMediaQuery('(max-width: 720px)', false);
  const proAmount = (PRO_PRICE_CENTS[yearly ? 'year' : 'month'] / 100).toFixed(2);
  const teamAnnual = `$${(teamAnnualPriceCents() / 100).toLocaleString()}`;
  const nav = <>{compact ? <AstryxMenu button={{ label: 'Menu', icon: <Icon icon="menu" />, isIconOnly: true, variant: 'ghost', size: 'sm' }} items={[{ label: 'Browse', onClick: onBrowse }, { label: 'Sign in', onClick: onSignIn }]} /> : <><Button label="Browse" variant="ghost" clickAction={onBrowse} /><Button label="Sign in" variant="ghost" clickAction={onSignIn} /></>}<Button label="Get started" variant="primary" size="sm" clickAction={onSignIn} /></>;

  return <main className="vitrine-page pricing-v2">
    <header
      className="pricing-v2__nav"
      style={{
        position: 'sticky',
        background: 'var(--color-background-body)',
        backdropFilter: 'none',
      }}
    >
      <Button label="Vitrines" variant="ghost" clickAction={onBrowse} icon={<img src="/favicon.svg" alt="" width={26} />} className="pricing-v2__wordmark" />
      <nav aria-label="Pricing navigation" className="pricing-v2__nav-links"><Button label="Library" variant="ghost" clickAction={onBrowse} /><span>Pricing</span></nav>
      <div className="pricing-v2__nav-actions">{nav}</div>
    </header>

    <Section className="pricing-v2__hero">
      <div>
        <span className="pricing-v2__eyebrow">Vitrines membership</span>
        <Heading level={1} type="display-2">Choose the depth<br />of your research.</Heading>
        <Text type="large" color="secondary">From surface scans to deep system analysis — access the observed design systems you need to ship with confidence.</Text>
      </div>
      <div className="pricing-v2__billing-control">
        <Text type="label">Save with annual billing</Text>
        <div className="pricing-v2__billing-toggle" role="radiogroup" aria-label="Billing period">
          <button type="button" role="radio" aria-checked={!yearly} onClick={() => onYearlyChange(false)}>Monthly</button>
          <button type="button" role="radio" aria-checked={yearly} onClick={() => onYearlyChange(true)}>Annual</button>
        </div>
        <Text type="supporting" color="secondary">{yearly ? 'Save 26% on Pro' : 'Switch to annual and save 26%'}</Text>
      </div>
    </Section>

    {user?.role === 'user' && subscription?.plan === 'free' ? <FreeUnlockUsage subscription={subscription} onBrowse={onBrowse} onCheckout={onCheckout} loading={loading} /> : null}

    <Section className="pricing-v2__board-section">
      <div className="pricing-v2__board" role="table" aria-label="Vitrines pricing comparison">
        <div className="pricing-v2__board-head" role="row">
          <div className="pricing-v2__feature-head" role="columnheader"><span>What’s included</span><Text type="supporting" color="secondary">Compare each level of access.</Text></div>
          <div role="columnheader" className="pricing-v2__plan-head"><strong>Free</strong><span>For individual explorers</span><b>$0</b><small>Forever</small></div>
          <div role="columnheader" className="pricing-v2__plan-head pricing-v2__pro"><strong>Pro</strong><span>For dedicated researchers</span><b>${proAmount}<small>{yearly ? ' /year' : ' /month'}</small></b><small>{yearly ? `Billed $${proAmount} annually` : 'Billed monthly'}</small></div>
          <div role="columnheader" className="pricing-v2__plan-head"><strong>Team</strong><span>For design and product teams</span><b>${(TEAM_EDITOR_PRICE_CENTS / 100).toFixed(0)}<small> / editor / month</small></b><small>Billed annually · {TEAM_MINIMUM_EDITORS}-editor minimum</small></div>
        </div>
        {FEATURES.map((feature) => <div className="pricing-v2__board-row" role="row" key={feature.label}>
          <div role="rowheader" className="pricing-v2__feature"><Icon icon={feature.icon} size="md" /><div><strong>{feature.label}</strong><span>{feature.detail}</span></div></div>
          <div role="cell"><Value value={feature.free} /></div>
          <div role="cell" className="pricing-v2__pro"><Value value={feature.pro} pro /></div>
          <div role="cell"><Value value={feature.team} /></div>
        </div>)}
        <div className="pricing-v2__board-footer" role="row">
          <div role="cell" className="pricing-v2__footer-note">Your free apps stay unlocked.</div>
          <div role="cell"><Button label={user ? subscription?.plan === 'pro' ? 'Included with Pro' : 'Current Free plan' : 'Start free'} variant="secondary" clickAction={user ? undefined : onSignIn} isDisabled={Boolean(user)} /></div>
          <div role="cell" className="pricing-v2__pro"><Button label={subscription?.plan === 'pro' ? 'Current Pro plan' : 'Upgrade to Pro'} variant="secondary" clickAction={user ? onCheckout : onSignIn} isDisabled={loading || subscription?.plan === 'pro' || user?.role === 'admin'} isLoading={loading} /></div>
          <div role="cell"><Button label={user ? subscription?.entitlementSource === 'team' ? 'Current Team plan' : 'Set up Team' : 'Start with a team'} variant="ghost" clickAction={user ? onTeamCheckout : onSignIn} isDisabled={loading || subscription?.entitlementSource === 'team'} /></div>
        </div>
      </div>
      {error ? <p role="alert" className="pricing-v2__error">{error}</p> : null}
      <Text type="supporting" color="secondary" className="pricing-v2__team-note">Team starts at {teamAnnual}/year for {TEAM_MINIMUM_EDITORS} editors. Team checkout is organization-scoped and access is confirmed by Paddle.</Text>
    </Section>

    <Section className="pricing-v2__proof">
      <div><Icon icon="search" size="md" /><strong>Observed, not guessed</strong><span>Every system starts with real shipped products.</span></div>
      <div><Icon icon="bookOpen" size="md" /><strong>Repeatable method</strong><span>Structured research makes decisions traceable.</span></div>
      <div><Icon icon="refresh" size="md" /><strong>Continuously updated</strong><span>The catalog evolves as products evolve.</span></div>
    </Section>

    <Section className="pricing-v2__questions">
      <div className="pricing-v2__section-title"><div><span className="pricing-v2__eyebrow">Common questions</span><Heading level={2}>Straight answers before you choose.</Heading></div><Button label="Browse the library" variant="ghost" clickAction={onBrowse} endContent={<Icon icon="arrowRight" size="sm" />} /></div>
      <Faq />
    </Section>

    <footer className="pricing-v2__footer">
      <Divider />
      <div className="pricing-v2__footer-row">
        <Text type="supporting" color="secondary">Vitrines · a research library of observed application design systems.</Text>
        <nav aria-label="Legal information" className="pricing-v2__legal-links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/refunds">Refunds</a>
        </nav>
      </div>
    </footer>
  </main>;
}

export function Pricing({ user, onBrowse, onSignIn }: { user: AuthUser | null; onBrowse: () => void; onSignIn: () => void }) {
  const [yearly, setYearly] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (user?.role !== 'user') { setSubscription(null); return; } let active = true; setLoading(true); loadSubscription().then((view) => { if (active) setSubscription(view); }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [user?.id, user?.role]);
  const onCheckout = async () => { if (user?.role !== 'user' || subscription?.plan === 'pro') return; setLoading(true); setError(''); try { await openPaddleCheckout((await createCheckout(yearly ? 'year' : 'month')).transactionId); } catch (reason) { setError((reason as Error).message); } finally { setLoading(false); } };
  const onTeamCheckout = async () => { if (user?.role !== 'user') return; setLoading(true); setError(''); try { const teams = await listTeams(); const owned = teams.filter((team) => team.role === 'owner'); let team = owned[0]; if (owned.length > 1) { const selected = Number(window.prompt(`Choose the Team workspace to bill:\n${owned.map((candidate) => `${candidate.id}: ${candidate.name}`).join('\n')}`)); team = owned.find((candidate) => candidate.id === selected); if (!team) throw new Error('Choose one of your Team workspaces before starting checkout'); } if (!team) { const name = window.prompt('Name your shared Vitrines workspace'); if (!name?.trim()) return; team = await createTeam(name.trim()); } await openPaddleCheckout((await createTeamCheckout(team.id)).transactionId); } catch (reason) { setError((reason as Error).message); } finally { setLoading(false); } };
  return <PricingView user={user} subscription={subscription} onBrowse={onBrowse} onSignIn={onSignIn} onCheckout={() => void onCheckout()} onTeamCheckout={() => void onTeamCheckout()} yearly={yearly} onYearlyChange={setYearly} loading={loading} error={error} />;
}
