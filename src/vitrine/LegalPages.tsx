import type { ReactNode } from 'react';

type LegalPageName = 'terms' | 'privacy' | 'refunds';

const LAST_UPDATED = 'August 17, 2026';
const CONTACT_EMAIL = 'security@vitrines.ai';

function LegalLayout({
  page,
  title,
  intro,
  onBrowse,
  onSignIn,
  children,
}: {
  page: LegalPageName;
  title: string;
  intro: string;
  onBrowse: () => void;
  onSignIn: () => void;
  children: ReactNode;
}) {
  return (
    <main className="vitrine-page legal-page">
      <header className="legal-page__header">
        <button type="button" className="legal-page__brand" onClick={onBrowse}>
          <img src="/favicon.svg" alt="" width={23} height={23} />
          Vitrines
        </button>
        <div className="legal-page__header-actions">
          <button type="button" className="legal-page__text-action" onClick={onBrowse}>Browse</button>
          <button type="button" className="legal-page__action" onClick={onSignIn}>Sign in</button>
        </div>
      </header>

      <article className="legal-page__content">
        <p className="legal-page__eyebrow">Legal</p>
        <h1>{title}</h1>
        <p className="legal-page__intro">{intro}</p>
        <p className="legal-page__updated">Last updated {LAST_UPDATED}</p>
        <nav aria-label="Legal pages" className="legal-page__nav">
          <a href="/terms" aria-current={page === 'terms' ? 'page' : undefined}>Terms</a>
          <a href="/privacy" aria-current={page === 'privacy' ? 'page' : undefined}>Privacy</a>
          <a href="/refunds" aria-current={page === 'refunds' ? 'page' : undefined}>Refunds</a>
        </nav>
        <div className="legal-page__body">{children}</div>
      </article>

      <footer className="legal-page__footer">
        <span>© {new Date().getFullYear()} Vitrines</span>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>
    </main>
  );
}

function TermsPage(props: Pick<Parameters<typeof LegalLayout>[0], 'onBrowse' | 'onSignIn'>) {
  return (
    <LegalLayout
      {...props}
      page="terms"
      title="Terms of Service"
      intro="These Terms govern your access to and use of Vitrines."
    >
      <section>
        <h2>1. The service</h2>
        <p>Vitrines is a subscription service for discovering and organizing product-design research, including catalog content, research workspaces, and related tools (the “Service”). By creating an account, accessing, or using the Service, you agree to these Terms.</p>
      </section>
      <section>
        <h2>2. Your account</h2>
        <p>You must provide accurate account information and keep your credentials confidential. You are responsible for activity under your account and must notify us promptly if you believe it has been accessed without authorization.</p>
      </section>
      <section>
        <h2>3. Subscriptions, billing, and cancellation</h2>
        <p>Paid plans renew on the billing interval shown at checkout until cancelled. Prices, taxes, and the renewal amount are presented before purchase. Paddle acts as merchant of record for purchases processed through Paddle and handles payment processing, tax collection, and receipts.</p>
        <p>You may cancel a subscription before its renewal date through your billing settings or Paddle’s customer portal. Cancellation stops the next renewal; you keep paid access through the end of the current paid period. Refund eligibility is described in our <a href="/refunds">Refund Policy</a>.</p>
      </section>
      <section>
        <h2>4. Permission to use Vitrines</h2>
        <p>Subject to these Terms and your plan, Vitrines grants you a limited, non-exclusive, non-transferable, revocable right to use the Service for your internal business or personal research. You may not resell, rent, sublicense, scrape, reverse engineer, disrupt, or circumvent access controls for the Service.</p>
      </section>
      <section>
        <h2>5. Your content and our content</h2>
        <p>You retain ownership of content you submit to your workspace. You give us the permission needed to host, process, and display it solely to provide and improve the Service. Vitrines and its licensors retain all rights in the Service, its catalog, software, and other materials, except where these Terms expressly say otherwise.</p>
      </section>
      <section>
        <h2>6. Acceptable use</h2>
        <p>Do not use the Service to violate law or third-party rights, upload malware, interfere with other users, collect data without authorization, or attempt to access accounts, systems, or content you are not authorized to access. We may suspend or terminate access for conduct that reasonably appears to violate these Terms or create risk for the Service or others.</p>
      </section>
      <section>
        <h2>7. Availability and liability</h2>
        <p>The Service is provided on an “as is” and “as available” basis to the fullest extent permitted by law. We do not promise that it will be uninterrupted, error-free, or suitable for every purpose. To the fullest extent permitted by law, Vitrines is not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the Service.</p>
      </section>
      <section>
        <h2>8. Changes and contact</h2>
        <p>We may update these Terms as the Service changes. If a change is material, we will provide reasonable notice by posting the updated Terms or through the Service. Continued use after the effective date means you accept the updated Terms. Questions can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </section>
    </LegalLayout>
  );
}

function PrivacyPage(props: Pick<Parameters<typeof LegalLayout>[0], 'onBrowse' | 'onSignIn'>) {
  return (
    <LegalLayout
      {...props}
      page="privacy"
      title="Privacy Policy"
      intro="This policy explains what information Vitrines processes, why, and the choices available to you."
    >
      <section>
        <h2>1. Information we process</h2>
        <p>We process information you provide, such as your name, email address, account details, workspace content, and messages to us. We also process service information such as device and browser data, IP address, log data, pages and features used, and subscription status. Payment-card details are processed by Paddle, not stored by Vitrines.</p>
      </section>
      <section>
        <h2>2. How we use information</h2>
        <p>We use information to provide, secure, maintain, and improve the Service; authenticate accounts; personalize workspaces; process subscriptions; communicate about the Service; prevent abuse; and meet legal obligations.</p>
      </section>
      <section>
        <h2>3. When we share information</h2>
        <p>We share information with service providers that help us operate Vitrines, such as hosting, authentication, email, analytics, and payment providers. We may also disclose information when required by law, to protect rights and safety, or in connection with a business transaction. We do not sell personal information.</p>
      </section>
      <section>
        <h2>4. Retention</h2>
        <p>We keep information for as long as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce agreements. Account information and workspace content are deleted or anonymized when no longer needed, subject to legitimate retention requirements.</p>
      </section>
      <section>
        <h2>5. Your choices and rights</h2>
        <p>You can update account information through the Service and cancel a subscription through billing settings. Depending on where you live, you may have rights to request access, correction, deletion, restriction, objection, or portability of your personal information. To make a request, contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </section>
      <section>
        <h2>6. Security and international processing</h2>
        <p>We use reasonable technical and organizational measures to protect information. No internet service is completely secure, so please protect your credentials. Information may be processed in countries other than your own when our service providers operate there.</p>
      </section>
      <section>
        <h2>7. Children and updates</h2>
        <p>Vitrines is not directed to children under 16, and we do not knowingly collect their personal information. We may update this policy as our practices or legal obligations change. The current version will always be posted here with its updated date.</p>
      </section>
    </LegalLayout>
  );
}

function RefundsPage(props: Pick<Parameters<typeof LegalLayout>[0], 'onBrowse' | 'onSignIn'>) {
  return (
    <LegalLayout
      {...props}
      page="refunds"
      title="Refund Policy"
      intro="We want you to be able to evaluate Vitrines with confidence."
    >
      <section>
        <h2>1. 14-day first-purchase window</h2>
        <p>If your first paid Vitrines subscription does not meet your needs, request a full refund within 14 calendar days of the original purchase. This applies to the initial payment for an individual or Team subscription.</p>
      </section>
      <section>
        <h2>2. How to request a refund</h2>
        <p>Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email address used for purchase and include your Paddle order number or receipt. We will review the request and, when eligible, submit it to Paddle for processing. Refunds are returned to the original payment method where possible.</p>
      </section>
      <section>
        <h2>3. Renewals and cancellation</h2>
        <p>Subscription renewal payments are not normally refundable after the 14-day first-purchase window. You can cancel before the next renewal date and will retain access through the end of the paid period. Cancelling does not automatically create a refund.</p>
      </section>
      <section>
        <h2>4. Exceptions</h2>
        <p>We may decline refund requests involving abuse, fraud, chargebacks, or material violation of our <a href="/terms">Terms of Service</a>. Nothing in this policy limits rights that cannot be excluded under applicable law. Paddle may need to approve a refund before it is completed.</p>
      </section>
    </LegalLayout>
  );
}

export function LegalPage({ page, onBrowse, onSignIn }: { page: LegalPageName; onBrowse: () => void; onSignIn: () => void }) {
  const props = { onBrowse, onSignIn };
  if (page === 'terms') return <TermsPage {...props} />;
  if (page === 'privacy') return <PrivacyPage {...props} />;
  return <RefundsPage {...props} />;
}
