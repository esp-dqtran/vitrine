-- Correct the word-boundary expressions used by the initial controlled Flow
-- taxonomy backfill. This overwrites its safe fallback assignments atomically.

SET LOCAL statement_timeout = '30min';

WITH normalized AS MATERIALIZED (
  SELECT
    flow.id,
    flow.normalized_name AS name,
    COALESCE(parent.normalized_name, '') AS parent_name
  FROM flows flow
  LEFT JOIN flows parent ON parent.id = flow.parent_id
), decisions AS (
  SELECT
    id,
    CASE
      -- Authentication must win before generic account and settings rules.
      WHEN name ~ '\m(log(ging)? out|sign(ing)? out)\M' THEN 'authentication/sign-out'
      WHEN name ~ '\m(reset|resetting|forgot|forgetting)\M.*\mpassword\M'
        OR name ~ '\mpassword\M.*\m(reset|forgot)\M'
        THEN 'authentication/password-reset'
      WHEN name ~ '\m(two factor|2fa|mfa|passkey)\M' THEN 'authentication/mfa-passkeys'
      WHEN name ~ '\m(verify|verifying|verification)\M.*\m(identity|id|document)\M'
        THEN 'authentication/identity-verification'
      WHEN name ~ '\m(verify|verifying|verification)\M.*\m(email|phone|mobile)\M'
        THEN 'authentication/email-phone-verification'
      WHEN name ~ '\m(sso|single sign on)\M' THEN 'authentication/single-sign-on'
      WHEN name ~ '\m(sign up|signup|register|creating an account|create account)\M'
        THEN 'authentication/sign-up'
      WHEN name ~ '\m(log in|logging in|login|sign in|signing in)\M'
        THEN 'authentication/sign-in'

      -- Terms and support are not Account settings, even when nested there.
      WHEN name ~ '\m(privacy policy|privacy consent|data consent)\M'
        THEN 'system-privacy-support/privacy-consent'
      WHEN name ~ '\m(terms|legal|conditions)\M'
        THEN 'system-privacy-support/legal-acknowledgement'
      WHEN name ~ '\m(help center|help centre|faq)\M'
        THEN 'system-privacy-support/help-center'
      WHEN name ~ '\m(contact support|customer support|support ticket)\M'
        THEN 'system-privacy-support/contact-support'
      WHEN name ~ '\m(permission|camera|microphone|location access|photo access)\M'
        THEN 'system-privacy-support/device-permissions'
      WHEN name ~ '\m(error|failed|failure|retry|recovery)\M'
        THEN 'system-privacy-support/error-recovery'
      WHEN name ~ '\m(offline|maintenance|service unavailable)\M'
        THEN 'system-privacy-support/offline-maintenance'
      WHEN name ~ '\m(empty state|no results|nothing here)\M'
        THEN 'system-privacy-support/empty-state'

      -- Billing precedes monetization and checkout.
      WHEN name ~ '\m(cancel|cancelling|canceling)\M.*\m(subscription|plan|membership)\M'
        THEN 'billing/cancel-subscription'
      WHEN name ~ '\m(invoice|receipt)\M' THEN 'billing/invoices'
      WHEN name ~ '\m(refund)\M' THEN 'billing/refund'
      WHEN name ~ '\m(restore purchase)\M' THEN 'billing/restore-purchase'
      WHEN name ~ '\m(payment method|card details|billing method)\M'
        THEN 'billing/payment-method'
      WHEN name ~ '\m(manage subscription|manage plan|subscription settings)\M'
        THEN 'billing/manage-subscription'
      WHEN name ~ '\m(change plan|switch plan|downgrade plan)\M'
        THEN 'billing/change-plan'
      WHEN name ~ '\m(paywall)\M' THEN 'monetization/paywall'
      WHEN name ~ '\m(free trial|trial offer)\M' THEN 'monetization/free-trial'
      WHEN name ~ '\m(usage limit|limit reached|quota)\M'
        THEN 'monetization/usage-limit-upsell'
      WHEN name ~ '\m(discount|promo offer|special offer)\M'
        THEN 'monetization/discount-offer'
      WHEN name ~ '\m(pricing|pricing plan)\M' THEN 'monetization/pricing-overview'
      WHEN name ~ '\m(subscribe|subscription|premium|upgrade|membership|choose plan|plan selection)\M'
        THEN 'monetization/plan-selection'

      -- Commerce and checkout.
      WHEN name ~ '\m(cart|bag|basket)\M' THEN 'commerce-checkout/cart'
      WHEN name ~ '\m(checkout|purchas|place order|placing an order|payment)\M'
        THEN 'commerce-checkout/checkout'
      WHEN name ~ '\m(address|delivery instruction|shipping address)\M'
        THEN 'commerce-checkout/address-delivery'
      WHEN name ~ '\m(booking|reservation|reserve)\M'
        THEN 'commerce-checkout/booking-reservation'
      WHEN name ~ '\m(order confirmation|order complete|completed order)\M'
        THEN 'commerce-checkout/order-confirmation'
      WHEN name ~ '\m(track|tracking|delivery status|ongoing delivery)\M'
        THEN 'commerce-checkout/order-tracking'
      WHEN name ~ '\m(return|exchange)\M'
        THEN 'commerce-checkout/returns-exchanges'
      WHEN name ~ '\m(shop|store|products|browse products)\M'
        THEN 'commerce-checkout/browse-products-services'

      -- Retention and engagement.
      WHEN name ~ '\m(turning on notifications|enable notifications|notification permission)\M'
        THEN 'retention-engagement/notification-prompt'
      WHEN name ~ '\m(notification|marking.*read)\M'
        THEN 'retention-engagement/notification-center'
      WHEN name ~ '\m(streak|milestone)\M' THEN 'retention-engagement/streak-milestone'
      WHEN name ~ '\m(reward|achievement|badge)\M' THEN 'retention-engagement/rewards-achievements'
      WHEN name ~ '\m(reminder)\M' THEN 'retention-engagement/reminders'
      WHEN name ~ '\m(feedback|rate app|review app)\M' THEN 'retention-engagement/feedback-request'
      WHEN name ~ '\m(referral|refer a friend|invite reward)\M'
        THEN 'retention-engagement/referral-reward'

      -- Communication and collaboration before creation (comments/invites/shares).
      WHEN name ~ '\m(message|chat|conversation|inbox|email detail)\M'
        THEN 'communication-collaboration/inbox-conversation'
      WHEN name ~ '\m(comment|reply|reacting)\M'
        THEN 'communication-collaboration/comment-reply'
      WHEN name ~ '\m(share|copy.*link)\M'
        THEN 'communication-collaboration/share-item'
      WHEN name ~ '\m(invite|inviting)\M'
        THEN 'communication-collaboration/invite-member'
      WHEN name ~ '\m(member|role|permissions)\M'
        THEN 'communication-collaboration/manage-members-roles'
      WHEN name ~ '\m(activity|updates)\M'
        THEN 'communication-collaboration/activity-updates'

      -- Search and navigation.
      WHEN name ~ '\m(no results)\M' THEN 'search/no-results'
      WHEN name ~ '\m(filter|sort)\M' AND (name ~ '\msearch\M' OR parent_name ~ '\msearch\M')
        THEN 'search/filters-sorting'
      WHEN name ~ '\m(searching|search)\M' THEN 'search/search-results'
      WHEN name ~ '\m(home|dashboard|today|overview)\M' THEN 'discovery-navigation/home-dashboard'
      WHEN name ~ '\m(explore|discover|browse|library|catalog)\M'
        THEN 'discovery-navigation/explore-browse'
      WHEN name ~ '\m(category|categories)\M' THEN 'discovery-navigation/categories'
      WHEN name ~ '\m(feed|for you)\M' THEN 'discovery-navigation/feed'
      WHEN name ~ '\m(menu|sidebar|navigation|tab bar)\M'
        THEN 'discovery-navigation/navigation-menu'
      WHEN name ~ '\m(recent|history|continue)\M'
        THEN 'discovery-navigation/recently-viewed'

      -- Account and settings.
      WHEN name ~ '\m(delete|deleting|deactivate)\M.*\m(account|profile)\M'
        THEN 'account-settings/deactivate-delete-account'
      WHEN name ~ '\m(edit|editing|update|updating|rename)\M.*\m(profile|account)\M'
        THEN 'account-settings/edit-profile'
      WHEN name ~ '\m(workspace|organization|organisation)\M'
        THEN 'account-settings/workspace-settings'
      WHEN name ~ '\m(integration|connect.*figma|connected app)\M'
        THEN 'account-settings/integrations'
      WHEN name ~ '\m(dark mode|theme|language|app icon|appearance)\M'
        THEN 'account-settings/appearance-language'
      WHEN name ~ '\m(data export|export data|download data)\M'
        THEN 'account-settings/data-export'
      WHEN name ~ '\m(settings|preferences|account settings|profile settings)\M'
        THEN 'account-settings/preferences'
      WHEN name ~ '\m(profile|my account|account)\M'
        THEN 'account-settings/view-account'

      -- Onboarding.
      WHEN name ~ '\m(invite|inviting)\M' AND parent_name ~ '\monboarding\M'
        THEN 'onboarding/team-invite'
      WHEN name ~ '\m(import|connect data)\M' THEN 'onboarding/data-import'
      WHEN name ~ '\m(goal|intent|choose.*interest)\M' THEN 'onboarding/goal-selection'
      WHEN name ~ '\m(personalize|personalise)\M' THEN 'onboarding/personalization'
      WHEN name ~ '\m(set up|setting up|account setup|profile setup|complete.*setup)\M'
        THEN 'onboarding/profile-setup'
      WHEN name ~ '\m(onboarding|welcome|get started|introduction)\M'
        THEN 'onboarding/welcome'

      -- Content, creation and the fully-classified safe default.
      WHEN name ~ '\m(analytics|report|insight)\M'
        THEN 'content-detail/analytics-report-detail'
      WHEN name ~ '\m(favorite|favourite|saved|collection|wishlist)\M'
        THEN 'content-detail/saved-items-collection'
      WHEN name ~ '\m(detail|reviews|rating|watching|playing|listening)\M'
        THEN 'content-detail/article-post-detail'
      WHEN name ~ '\m(delete|archive)\M'
        THEN 'creation-editing/delete-archive'
      WHEN name ~ '\m(duplicate|template)\M'
        THEN 'creation-editing/duplicate-template'
      WHEN name ~ '\m(upload|adding an image|adding image|adding a file)\M'
        THEN 'creation-editing/upload-media-file'
      WHEN name ~ '\m(publish|submit|schedule)\M'
        THEN 'creation-editing/publish-submit'
      WHEN name ~ '\m(edit|editing|format|rename|adding)\M'
        THEN 'creation-editing/edit-item'
      WHEN name ~ '\m(create|creating|new)\M'
        THEN 'creation-editing/create-item'
      WHEN parent_name ~ '\m(settings|account|profile)\M'
        THEN 'account-settings/preferences'
      WHEN parent_name ~ '\m(onboarding|logging in)\M'
        THEN 'onboarding/welcome'
      WHEN parent_name ~ '\m(home|discover|explore|menu|navigation)\M'
        THEN 'discovery-navigation/explore-browse'
      WHEN parent_name ~ '\m(search)\M' THEN 'search/search-results'
      WHEN parent_name ~ '\m(chat|inbox|message)\M'
        THEN 'communication-collaboration/inbox-conversation'
      ELSE 'content-detail/other-content-detail'
    END AS taxonomy_key
  FROM normalized
)
INSERT INTO flow_classifications (
  flow_id, flow_type_id, status, confidence, source, reviewed_at
)
SELECT
  decision.id,
  type.id,
  'approved',
  CASE WHEN decision.taxonomy_key = 'content-detail/other-content-detail' THEN 0.55 ELSE 0.9 END,
  'rule',
  now()
FROM decisions decision
JOIN flow_categories category
  ON category.slug = split_part(decision.taxonomy_key, '/', 1)
JOIN flow_types type
  ON type.category_id = category.id
 AND type.slug = split_part(decision.taxonomy_key, '/', 2)
ON CONFLICT (flow_id) DO UPDATE SET
  flow_type_id = EXCLUDED.flow_type_id,
  status = EXCLUDED.status,
  confidence = EXCLUDED.confidence,
  source = EXCLUDED.source,
  reviewed_by_user_id = NULL,
  reviewed_at = EXCLUDED.reviewed_at,
  updated_at = now();

DO $$
BEGIN
  IF (SELECT count(*) FROM flow_classifications) <> (SELECT count(*) FROM flows) THEN
    RAISE EXCEPTION 'Every canonical Flow must receive a controlled taxonomy classification';
  END IF;
END;
$$;


