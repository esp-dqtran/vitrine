import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Badge, Button, Divider, DropdownMenu, Heading, Icon, SegmentedControl, SegmentedControlItem, Text, useMediaQuery } from '@astryxdesign/core';
import type { AuthUser } from './authApi';
import { createCheckout, loadSubscription, type SubscriptionView } from './billingApi';

const wrap: CSSProperties = { maxWidth: 1080, margin: '0 auto', padding: '0 32px' };

function Check({ on }: { on: boolean }) {
  return <Icon icon={on ? 'check' : 'close'} size="sm" color={on ? 'success' : 'secondary'} />;
}

function FeatureRow({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <Check on />
      <span style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>{text}</span>
    </div>
  );
}

const FREE_FEATURES = [
  'Public catalog metadata and limited previews',
  '3 applications, unlocked permanently',
  'Complete screens, flows, components, tokens and evidence for those apps',
  '1 personal collection',
];

const PRO_FEATURES = [
  'Every current and future published application while subscribed',
  'Complete screens, flows, components, foundation tokens and evidence',
  'Full catalog search, filters and cross-application comparison',
  'Unlimited personal collections and research notes',
  'Selected editable exports within the fair-use policy',
];

const COMPARE_ROWS: [string, string | boolean, string | boolean][] = [
  ['Catalog access', '3 apps, chosen by you, unlocked for good', 'Every app — current and future'],
  ['Screens, flows, components, tokens, evidence', 'Full depth on your 3 apps', 'Full depth across the catalog'],
  ['Search, filters and comparison', 'Basic browse', 'Full search, filters and cross-app comparison'],
  ['Personal collections', '1', 'Unlimited'],
  ['Research notes', false, true],
  ['Editable exports', false, 'Selected, fair-use'],
];

const FAQS = [
  {
    q: 'What happens after I use my 3 free unlocks?',
    a: 'Nothing is taken away — your 3 unlocked applications stay fully accessible for good. To reach the rest of the catalog, upgrade to Pro.',
  },
  {
    q: 'Can I swap an unlocked app for a different one?',
    a: 'No. Selecting an application is a deliberate choice: you confirm an "Unlock this app" action and see how many unlocks remain. Once unlocked, an app can’t be exchanged for another.',
  },
  {
    q: 'Does opening a preview use up an unlock?',
    a: 'No. Browsing public catalog previews never consumes an unlock — only the explicit "Unlock this app" confirmation does.',
  },
  {
    q: 'What’s the difference between monthly and yearly Pro?',
    a: 'None, other than price. Monthly and yearly Pro subscriptions carry identical entitlements — yearly is simply billed once a year at a lower effective rate.',
  },
  {
    q: 'What exports are included with Pro?',
    a: 'Editable Figma exports for selected evidence or a complete observed application design system, plus secondary token and component formats, within the fair-use policy. Pro does not include a raw API, database export, bulk catalog download, or complete offline catalog.',
  },
  {
    q: 'Do you offer Team or Enterprise plans?',
    a: 'Not yet. Team pricing, seat billing, and shared workspaces launch once the corresponding collaboration features exist.',
  },
  {
    q: 'Can I get my own app analyzed?',
    a: 'Private application analysis isn’t part of the catalog subscription today. It may become a separate, credit-based add-on later.',
  },
];

function FaqRow({ q, a, open, onToggle, isLast }: { q: string; a: string; open: boolean; onToggle: () => void; isLast: boolean }) {
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-border)' }}>
      <Button
        label={q}
        variant="ghost"
        onClick={onToggle}
        aria-expanded={open}
        endContent={<span style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s cubic-bezier(.16,1,.3,1)' }}><Icon icon="chevronDown" size="sm" /></span>}
        style={{
          justifyContent: 'space-between',
          textAlign: 'left',
          width: '100%',
          padding: '20px 12px',
          fontSize: 15.5,
          fontWeight: 600,
        }}
      />
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .22s cubic-bezier(.16,1,.3,1)' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 12px 22px', maxWidth: 700 }}>
            <Text type="body" color="secondary">{a}</Text>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  highlighted,
  badge,
  name,
  tagline,
  price,
  priceNote,
  features,
  cta,
  ctaVariant,
  clickAction,
  disabled,
  loading,
}: {
  highlighted?: boolean;
  badge?: string;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  features: string[];
  cta: string;
  ctaVariant: 'primary' | 'secondary';
  clickAction?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        flex: '1 1 320px',
        minWidth: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '26px 28px 28px',
        borderRadius: 'var(--radius-container)',
        background: highlighted
          ? 'linear-gradient(180deg, var(--color-accent-muted, #eef1fd) 0%, var(--color-background-surface) 130px)'
          : 'var(--color-background-card, var(--color-background-surface))',
        border: highlighted ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
        boxShadow: highlighted ? 'var(--shadow-med)' : 'var(--shadow-low)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <Heading level={3}>{name}</Heading>
          <div style={{ marginTop: 4 }}>
            <Text type="supporting" color="secondary">{tagline}</Text>
          </div>
        </div>
        {badge ? <Badge variant={highlighted ? 'blue' : 'neutral'} label={badge} /> : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>{price}</span>
        <Text type="supporting" color="secondary">{priceNote}</Text>
      </div>

      <Divider />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {features.map((f) => (
          <FeatureRow key={f} text={f} />
        ))}
      </div>

      <Button variant={ctaVariant} label={cta} clickAction={clickAction} isDisabled={disabled} isLoading={loading} style={{ width: '100%' }} />
    </div>
  );
}

function Cell({ value }: { value: string | boolean }) {
  return (
    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      {typeof value === 'boolean' ? <Check on={value} /> : <Text type="supporting" color="secondary">{value}</Text>}
    </div>
  );
}

function Section({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return <div style={{ ...wrap, ...style }}>{children}</div>;
}

interface PricingViewProps {
  user: AuthUser | null;
  subscription: SubscriptionView | null;
  onBrowse: () => void;
  onSignIn: () => void;
  onCheckout: () => void;
  yearly?: boolean;
  onYearlyChange?: (yearly: boolean) => void;
  loading?: boolean;
  error?: string;
}

export function PricingView({
  user,
  subscription,
  onBrowse,
  onSignIn,
  onCheckout,
  yearly = false,
  onYearlyChange = () => undefined,
  loading = false,
  error = '',
}: PricingViewProps) {
  const isCompactNav = useMediaQuery('(max-width: 640px)', false);
  const proPrice = yearly ? '$70' : '$7';
  const proNote = yearly ? '/year' : '/month';
  const proSub = yearly ? 'billed yearly · save $14 vs monthly' : 'billed monthly';
  const navLink: CSSProperties = { fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)' };

  return (
    <div style={{ minHeight: '100vh', color: 'var(--color-text-primary)' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'color-mix(in srgb, var(--color-background-body) 92%, transparent)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Section style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <Button type="button" label="Vitrine" variant="ghost" onClick={onBrowse} icon={<span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--color-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#FFFFFF' }} /></span>} style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
            {isCompactNav ? (
              <DropdownMenu
                button={{ label: 'Menu', icon: <Icon icon="menu" />, isIconOnly: true, variant: 'ghost', size: 'sm' }}
                items={[
                  { label: 'Browse', onClick: onBrowse },
                  { label: 'Sign in', onClick: onSignIn },
                ]}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                <Button label="Browse" variant="ghost" onClick={onBrowse} style={navLink} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', borderBottom: '2px solid var(--color-text-primary)', paddingBottom: 2 }}>Pricing</span>
                <Button label="Sign in" variant="ghost" onClick={onSignIn} style={navLink} />
              </div>
            )}
            <Button variant="primary" size="sm" label="Get started" clickAction={onSignIn} />
          </div>
        </Section>
      </div>

      <Section style={{ padding: '64px 32px 32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Badge variant="neutral" label="Pricing" />
        </div>
        <Heading level={1} type="display-2">Free to explore. $7/month to go deeper.</Heading>
        <div style={{ margin: '16px auto 0', maxWidth: 560 }}>
          <Text type="large" color="secondary">
            Vitrine is a research library of observed application design systems — screens, flows, components, tokens and evidence, reconstructed once and reused by every subscriber.
          </Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
          <SegmentedControl label="Billing period" value={yearly ? 'yearly' : 'monthly'} onChange={(v) => onYearlyChange(v === 'yearly')}>
            <SegmentedControlItem label="Monthly" value="monthly" />
            <SegmentedControlItem label="Yearly · save $14" value="yearly" />
          </SegmentedControl>
        </div>
      </Section>

      <Section style={{ padding: '24px 32px 64px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' }}>
          <PlanCard
            name="Free"
            tagline="Evaluate the product, no card required"
            price="$0"
            priceNote="forever"
            features={FREE_FEATURES}
            cta={user ? subscription?.plan === 'pro' ? 'Included with Pro' : 'Current Free plan' : 'Start free'}
            ctaVariant="secondary"
            clickAction={user ? undefined : onSignIn}
            disabled={Boolean(user)}
          />
          <PlanCard
            highlighted
            badge="Full catalog"
            name="Pro"
            tagline="Everything in Free, plus the whole library"
            price={proPrice}
            priceNote={proNote}
            features={PRO_FEATURES}
            cta={subscription?.plan === 'pro' ? 'Current Pro plan' : 'Upgrade to Pro'}
            ctaVariant="primary"
            clickAction={user ? onCheckout : onSignIn}
            disabled={loading || subscription?.plan === 'pro' || user?.role === 'admin'}
            loading={loading}
          />
        </div>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Text type="supporting" color="secondary">{`${proSub} · no exports on Free`}</Text>
          {error && <div role="alert" style={{ marginTop: 10, color: 'var(--color-text-danger)' }}>{error}</div>}
        </div>
      </Section>

      <Section style={{ padding: '8px 32px 64px' }}>
        <div style={{ marginBottom: 24 }}>
          <Heading level={2}>Compare plans</Heading>
        </div>
        {/* Horizontal scroll (not a JS breakpoint) so the 3-column grid never squeezes
            illegibly — it only kicks in once real content width exceeds the viewport. */}
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              minWidth: 480,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-container)',
              overflow: 'hidden',
              background: 'var(--color-background-card, var(--color-background-surface))',
              boxShadow: 'var(--shadow-low)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', background: 'var(--color-background-muted)', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ padding: '14px 20px' }}><Text type="label" color="secondary">Feature</Text></div>
              <div style={{ padding: '14px 20px', textAlign: 'center' }}><Text weight="semibold">Free</Text></div>
              <div style={{ padding: '14px 20px', textAlign: 'center' }}><Text weight="semibold">Pro</Text></div>
            </div>
            {COMPARE_ROWS.map(([label, freeVal, proVal], i) => (
              <div
                key={label}
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', borderBottom: i < COMPARE_ROWS.length - 1 ? '1px solid var(--color-border)' : 'none' }}
              >
                <div style={{ padding: '16px 20px' }}><Text type="body">{label}</Text></div>
                <Cell value={freeVal} />
                <Cell value={proVal} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 20, padding: 20, borderRadius: 'var(--radius-container)', background: 'var(--color-background-muted)' }}>
          <Text type="label" color="secondary">Not part of the initial launch: </Text>
          <Text type="body" color="secondary">
            Team and Enterprise plans, seat-based billing, shared collections, a raw API, database or bulk catalog export, a complete offline catalog, and private or user-submitted app analysis.
          </Text>
        </div>
      </Section>

      <Section style={{ padding: '8px 32px 80px' }}>
        <div style={{ marginBottom: 24, maxWidth: 640 }}>
          <Heading level={2}>Questions</Heading>
          <div style={{ marginTop: 8 }}>
            <Text type="body" color="secondary">The details behind the Free and Pro plans.</Text>
          </div>
        </div>
        <Faq />
      </Section>

      <Section style={{ padding: '0 32px 48px' }}>
        <Divider />
        <div style={{ paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Text type="supporting" color="secondary">Vitrine · a research library of observed application design systems.</Text>
          <div style={{ display: 'flex', gap: 20 }}>
            <Button label="Browse" variant="ghost" size="sm" onClick={onBrowse} style={{ ...navLink, fontSize: 13 }} />
            <Button label="Sign in" variant="ghost" size="sm" onClick={onSignIn} style={{ ...navLink, fontSize: 13 }} />
          </div>
        </div>
      </Section>
    </div>
  );
}

export function Pricing({ user, onBrowse, onSignIn }: { user: AuthUser | null; onBrowse: () => void; onSignIn: () => void }) {
  const [yearly, setYearly] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'user') {
      setSubscription(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    loadSubscription()
      .then((view) => { if (active) { setSubscription(view); setError(''); } })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, user?.role]);

  const onCheckout = async () => {
    if (user?.role !== 'user' || subscription?.plan === 'pro') return;
    setLoading(true);
    setError('');
    try {
      const session = await createCheckout(yearly ? 'year' : 'month');
      const target = new URL(session.url);
      if (target.protocol !== 'https:') throw new Error('Billing returned an unsafe redirect');
      window.location.assign(target.href);
    } catch (reason) {
      setError((reason as Error).message);
      setLoading(false);
    }
  };

  return <PricingView user={user} subscription={subscription} onBrowse={onBrowse} onSignIn={onSignIn} onCheckout={() => void onCheckout()} yearly={yearly} onYearlyChange={setYearly} loading={loading} error={error} />;
}

function Faq() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-container)',
        background: 'var(--color-background-card, var(--color-background-surface))',
        boxShadow: 'var(--shadow-low)',
        padding: '6px 24px',
      }}
    >
      {FAQS.map((f, i) => (
        <FaqRow key={f.q} q={f.q} a={f.a} isLast={i === FAQS.length - 1} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
      ))}
    </div>
  );
}
