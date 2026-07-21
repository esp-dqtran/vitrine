# Astryx Launch Referral Design

**Date:** 2026-07-21
**Status:** Approved concept, pending written-spec review
**Scope:** First-launch referral campaign for individual Free and Pro accounts

## Objective

Use referrals to spread Astryx among product designers during the first 90 days after launch. The campaign optimizes for new activated users rather than immediate referred revenue.

The program must create a useful reason to share while avoiding rewards for empty or disposable signups.

## Offer

The customer-facing promise is:

> Give a friend one month of Pro. Earn one month of Pro when they become active.

- A new user who signs up through a valid referral link receives 30 days of promotional Pro immediately.
- The inviter earns a reward only after the invited user becomes activated.
- Every inviter reward is one banked Pro Month pass, regardless of the inviter's current plan.
- The inviter chooses when to activate each earned pass. Activation starts 30 consecutive days of promotional Pro.
- A paid Pro subscriber keeps earned passes banked for use after their paid subscription ends; the reward does not become Stripe billing credit.
- Each inviter may earn at most three rewards during the launch campaign.
- Promotional access never requests a card, starts a Stripe subscription, or charges automatically.
- When promotional Pro expires, an account without an active paid subscription returns to Free with its existing Free entitlements intact.

The pricing assumption for the campaign is $8.99 monthly and $79.99 yearly. Referral rewards are promotional access, not currency, billing credit, or MRR.

## Qualification Rules

### Referred user

A referral qualifies only when all of the following are true:

1. The invited person follows a valid, unexpired referral URL.
2. They create a new Astryx account; existing accounts cannot be retroactively attributed.
3. The inviter and invited account are different users.
4. The invited account has not previously received a referral promotion.

The first valid referral attached at signup wins. Later referral links cannot replace it.

### Activation

An invited user becomes activated when both conditions are met:

1. They open full references for at least three distinct applications.
2. Their qualifying application activity spans at least two UTC dates and at least 24 elapsed hours.

This is deliberately lighter than requiring payment. It proves that the invited account returned and used the core research library without adding friction to the spread loop.

### Reward limits

- An inviter can earn no more than three rewards during the campaign.
- Earned Pro Month passes remain banked until the inviter activates them.
- An inviter may bank at most three passes and activate them one at a time.
- A referred user's signup promotion does not count against the inviter's reward cap.
- One referred account can qualify exactly one inviter reward.
- Rewards are non-transferable and have no cash value.

## Entitlement Model

Stripe subscription records remain authoritative for paid Pro. Referral access is a separate, explicit promotional entitlement and must not create a synthetic Stripe subscription.

The effective customer plan is resolved in this order:

1. Active or grace-valid Stripe Pro subscription.
2. Unexpired promotional Pro grant.
3. Free.

The subscription response should identify the entitlement source as `paid`, `promotion`, or `free`, and include the promotional expiry when applicable. Existing feature gates continue to consume one effective Free/Pro result rather than embedding referral rules throughout the application.

Earning a reward creates an idempotent, unactivated Pro Month pass. Activating a pass creates a 30-day promotional entitlement and permanently marks that pass as consumed in the same database transaction. Paid subscribers cannot activate a pass while their paid entitlement is active, preventing accidental overlap; their passes remain available for later use.

## Data Boundaries

The referral domain should remain separate from billing and account authentication:

- `referral_codes`: one opaque, revocable share token per inviter.
- `referrals`: immutable inviter-to-new-user attribution, signup promotion state, activation state, and campaign identity.
- `referral_activity`: distinct application and UTC-day evidence used to evaluate activation.
- `referral_rewards`: one idempotent, banked Pro Month pass per qualified referral, with available, activated, or revoked state and an optional promotional-entitlement reference.
- `promotional_entitlements`: bounded Pro grants with source, start, expiry, and revocation fields.

Referral tokens must be random opaque values, not encoded user IDs or emails. Public APIs accept only the token; internal rows retain the user relationships.

Reward qualification and issuance run in one database transaction after each qualifying activity event. A unique constraint on the referral ID prevents double rewards under concurrent requests.

## Product Experience

### Sharing

Account Settings contains a launch card with:

- the offer summary;
- a `Copy referral link` action;
- progress such as `1 of 3 rewards earned`;
- the number of available Pro Month passes and an `Activate 1 Pro Month` action;
- each referral's state: joined, active, or rewarded;
- the campaign end date and concise fair-use terms.

The first release uses a copyable referral link. Sending invitation emails, importing contacts, social-network APIs, and address-book access are out of scope.

### Referred landing and signup

Following a referral link shows a small, persistent banner through signup:

> Your friend gave you 30 days of Astryx Pro. No card required.

After signup, the user lands in the catalog with the promotional expiry visible in Settings. The interface must state that access returns to Free automatically and that no charge will occur.

### Activation and reward feedback

The inviter sees progress only in coarse states; private activity details about the invited user are never exposed. When activation completes, the inviter receives an in-product confirmation that one Pro Month is ready to use. Activating it requires an explicit confirmation and shows the exact 30-day expiry before submission. Email notification may be added later but is not required for launch.

## Abuse Controls

The first launch uses bounded, explainable controls rather than invasive device fingerprinting:

- new accounts only;
- immutable single-referrer attribution;
- 24-hour, two-day activation gate;
- three-reward cap;
- one reward per referred account;
- idempotent fulfillment;
- administrator ability to revoke a referral, reward, or promotional grant;
- existing redacted access and audit events for investigation.

The system may flag repeated network or session patterns for manual review, but it must not automatically block legitimate coworkers, households, schools, or shared networks solely because they share an IP address.

## Campaign Lifecycle

- The initial campaign runs for 90 days from its configured launch timestamp.
- Referral links stop accepting new attributions when the campaign closes.
- Signup promotions granted before closure remain valid through their stored expiry.
- Pro Month passes earned before closure remain banked and may be activated after the campaign ends. Banked passes do not expire in the initial launch program.
- Campaign dates, reward cap, signup grant duration, and activation thresholds are server configuration, persisted with a campaign identifier on every referral.
- Changing a later campaign must not reinterpret historical referrals.

## Measurement

The launch dashboard should report:

- users who copied a referral link;
- unique referral visits;
- referred signups;
- referred activations;
- inviter rewards issued;
- referral signup-to-activation rate;
- referred promotional users who later purchase Pro;
- non-referred Free-to-Pro conversion for comparison;
- referred-user retention at days 7, 30, and 60;
- rewards revoked or held for suspected abuse.

The primary launch metric is activated referred users. Paid conversion is a secondary signal during this campaign.

## Success Criteria

At the end of 90 days, keep or iterate the program if:

- at least 25% of users who copy a link produce one referred signup;
- at least 40% of referred signups reach activation;
- referred users retain at least as well at day 30 as non-referred Free users;
- abuse-related revocations remain below 5% of issued rewards.

These are campaign decision thresholds, not external industry benchmarks. If traffic is too small for stable percentages, review the individual funnel and qualitative feedback instead of treating the thresholds as statistically conclusive.

## Failure Handling

- An invalid, revoked, expired, or closed-campaign referral link falls back to normal signup without promotional claims.
- Referral attribution failure must not prevent account creation; it records a bounded internal error and continues as normal Free signup.
- Pass activation failure leaves the pass available and retryable. It must never consume a pass without creating its promotional entitlement.
- Promotion resolution fails closed to the user's paid Stripe entitlement or Free plan; it never grants permanent Pro because a referral lookup failed.

## Verification

Automated coverage must include:

- token validation and immutable attribution;
- immediate referred-user promotional Pro;
- no automatic Stripe subscription or charge;
- three-distinct-app and two-day activation boundaries;
- concurrent activation issuing exactly one reward;
- three-reward inviter cap;
- banking at most three Pro Month passes;
- explicit pass activation creating exactly one 30-day promotional entitlement;
- failed or concurrent activation never losing or double-consuming a pass;
- paid inviters retaining passes and being prevented from activating them during paid access;
- expiry returning an unpaid account to Free;
- active paid Pro taking precedence over promotional Pro;
- campaign closure preserving previously issued rewards;
- revoked referrals and grants;
- referral analytics without exposing invited-user activity details.

An end-to-end sandbox scenario must cover referral link → new signup → immediate promotional Pro → second-day activation → banked inviter Pro Month → explicit activation → promotional expiry.

## Out of Scope

- Team invitations or shared workspaces.
- Affiliate commissions or cash payouts.
- Physical referral prizes.
- Contact importing and invitation email delivery.
- Public leaderboards.
- Permanent or lifetime Pro rewards.
- Referral rewards based on a referred purchase during the initial spread-focused campaign.
