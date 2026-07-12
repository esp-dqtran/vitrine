# Astryx Customer Identity Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete secure self-service customer identity for Astryx Free/Pro: registration, verification, sign-in/out, password recovery/change, session management, profile/deletion request, durable email, and explicit non-rotating administrator management.

**Architecture:** PostgreSQL owns users, hashed purpose-bound tokens, sessions, deletion requests, rate-limit windows, and a durable email outbox. The API returns neutral responses for address-sensitive actions and strictly validates cookie mutations. A small SMTP worker drains the outbox; staging uses Mailpit through the same adapter. Existing users are backfilled as verified, and the current two-session `signed_in_elsewhere` policy remains intact.

**Tech Stack:** TypeScript, PostgreSQL migrations, Node crypto/test runner, Express, React, Nodemailer SMTP, Docker Compose Mailpit.

---

## Verified starting point

- `src/authCrypto.ts` provides scrypt password hashing, session-token generation/hashing, and constant-time verification.
- `src/authStore.ts` normalizes email, authenticates, creates/deletes sessions, and enforces two active normal-user sessions with `signed_in_elsewhere`.
- `/auth/login`, `/auth/logout`, and `/auth/me` exist with HttpOnly, SameSite=Strict, production-Secure cookies.
- The frontend has only email/password sign-in and hash routing.
- Missing: registration, verification, resend, recovery, password change, session list/revoke, profile, deletion request, SMTP, neutral address-sensitive responses, distributed identity limits.
- `seedAdmin()` currently rotates the password and deletes every administrator session on each API startup; this behavior must be removed before launch.

## File map

### Create

- `migrations/0003_customer_identity.sql` — verification/profile/session metadata/tokens/deletion/rate limits/email outbox.
- `src/identityStore.ts` / `src/identityStore.test.ts` — transactional customer lifecycle and neutral result model.
- `src/authToken.ts` / `src/authToken.test.ts` — random purpose-bound token generation and hashing.
- `src/emailTokenEnvelope.ts` / `src/emailTokenEnvelope.test.ts` — authenticated encryption for one-time delivery payloads.
- `src/distributedRateLimit.ts` / `src/distributedRateLimit.test.ts` — PostgreSQL fixed-window limiter.
- `src/emailOutbox.ts` / `src/emailOutbox.test.ts` — claim/send/retry/dead-letter state.
- `src/smtp.ts` / `src/smtp.test.ts` — strict SMTP config and injected transport.
- `services/email-worker/Dockerfile`, `services/email-worker/src/index.ts`, `services/email-worker/src/worker.ts`, `services/email-worker/src/worker.test.ts` — outbox delivery service.
- `scripts/admin-create.ts`, `scripts/admin-password.ts`, `scripts/admin-disable.ts` — explicit administrator management.
- `src/vitrine/identityApi.ts` / `src/vitrine/identityApi.test.ts` — typed account API client.
- `src/vitrine/routes.ts` / `src/vitrine/routes.test.ts` — History API route parser/navigation.
- `src/vitrine/Register.tsx`, `VerifyEmail.tsx`, `RecoverPassword.tsx`, `ResetPassword.tsx`, `Account.tsx` plus rendered tests.
- `docs/operations/identity.md` — bootstrap, SMTP, recovery, deletion, and support runbook.

### Modify

- `package.json`, `package-lock.json` — Nodemailer and identity/admin commands.
- `src/migrations.test.ts`, migration verifier/fixture — migration head and upgrade preservation.
- `src/authStore.ts`, `src/authStore.test.ts` — verified-login rule, session metadata/list/revoke/change-password behavior, no startup seed.
- `services/api/src/app.ts`, `app.test.ts`, `config.ts`, `config.test.ts`, `index.ts` — routes, neutral errors, cookie/origin/trusted proxy controls.
- `src/vitrine/authApi.ts`, `AuthProvider.tsx`, `main.tsx`, `SignIn.tsx`, `App.tsx` and tests — lifecycle navigation and session-expiry states.
- `docker-compose.yml` — Mailpit and email worker.
- `docs/ARCHITECTURE.md`, production matrix — implemented identity authority and gates.

## Task 1: Expand the identity schema without breaking existing accounts

**Files:**
- Create: `migrations/0003_customer_identity.sql`
- Modify: `src/migrations.test.ts`
- Modify: `scripts/verify-migrations.ts`
- Modify: `tests/fixtures/current-schema-upgrade.sql`

- [ ] **Step 1: Write failing upgrade-preservation tests**

Assert the synthetic existing customer/admin remain active, verified, authenticated by the same hashes, and retain sessions after migration. Assert new control tables are empty and rerun applies zero.

```typescript
test("identity migration verifies existing users without rotating credentials or sessions", async () => {
  const before = await pool.query("SELECT id, email, password_hash, active FROM users ORDER BY id");
  const sessions = await pool.query("SELECT id, user_id, token_hash, revoked_at FROM sessions ORDER BY id");
  await applyMigrations(pool);
  assert.deepEqual((await pool.query("SELECT id, email, password_hash, active FROM users ORDER BY id")).rows, before.rows);
  assert.deepEqual((await pool.query("SELECT id, user_id, token_hash, revoked_at FROM sessions ORDER BY id")).rows, sessions.rows);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM users WHERE email_verified_at IS NULL")).rows[0].count, 0);
});
```

- [ ] **Step 2: Run and confirm missing schema**

Run: `node --experimental-strip-types --test --test-name-pattern='identity migration' src/migrations.test.ts`

Expected: FAIL because migration 0003 and `email_verified_at` do not exist.

- [ ] **Step 3: Create migration 0003**

```sql
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Normalized user email collision blocks identity migration';
  END IF;
END $$;
UPDATE users SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));
ALTER TABLE users ADD CONSTRAINT users_email_normalized_check
  CHECK (email = lower(btrim(email))) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_email_normalized_check;
CREATE UNIQUE INDEX users_email_normalized_uidx ON users(lower(btrim(email)));

ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN display_name TEXT CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 120);
UPDATE users SET email_verified_at = COALESCE(created_at, now()) WHERE email_verified_at IS NULL;

ALTER TABLE sessions ADD COLUMN client_name TEXT NOT NULL DEFAULT 'Unknown device';
ALTER TABLE sessions ADD COLUMN created_ip_prefix TEXT;
ALTER TABLE sessions ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE auth_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_purpose_idx ON auth_tokens(user_id, purpose, created_at DESC);

CREATE TABLE account_deletion_requests (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('requested', 'in_review', 'fulfilled', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ
);

CREATE TABLE rate_limit_windows (
  scope TEXT NOT NULL,
  subject_hash TEXT NOT NULL CHECK (length(subject_hash) = 64),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, subject_hash, window_start)
);
CREATE INDEX rate_limit_windows_expiry_idx ON rate_limit_windows(expires_at);

CREATE TABLE email_outbox (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auth_token_id BIGINT REFERENCES auth_tokens(id) ON DELETE CASCADE,
  template TEXT NOT NULL CHECK (template IN ('verify_email', 'reset_password', 'password_changed', 'deletion_requested')),
  token_ciphertext BYTEA,
  token_iv BYTEA,
  token_tag BYTEA,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_token_payload_check CHECK (
  (template IN ('verify_email', 'reset_password') AND auth_token_id IS NOT NULL AND (
    (status IN ('pending', 'sending') AND token_ciphertext IS NOT NULL
      AND token_iv IS NOT NULL AND token_tag IS NOT NULL)
    OR
    (status IN ('sent', 'dead') AND token_ciphertext IS NULL
      AND token_iv IS NULL AND token_tag IS NULL)
  ))
  OR
  (template NOT IN ('verify_email', 'reset_password') AND auth_token_id IS NULL
    AND token_ciphertext IS NULL AND token_iv IS NULL AND token_tag IS NULL)
);
CREATE INDEX email_outbox_ready_idx ON email_outbox(status, next_attempt_at, id);
```

Do not add Team, organization, tenant, or seat columns.

- [ ] **Step 4: Run empty/upgrade/rerun verification and commit**

```bash
node --experimental-strip-types --test src/migrations.test.ts
MIGRATION_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres MIGRATION_TEST_ALLOW_DROP=1 npm run db:verify
git add migrations/0003_customer_identity.sql src/migrations.test.ts scripts/verify-migrations.ts tests/fixtures/current-schema-upgrade.sql
git commit -m "feat: add customer identity schema"
```

## Task 2: Implement purpose-bound tokens and transactional lifecycle

**Files:**
- Create: `src/authToken.ts`, `src/authToken.test.ts`
- Create: `src/emailTokenEnvelope.ts`, `src/emailTokenEnvelope.test.ts`
- Create: `src/identityStore.ts`, `src/identityStore.test.ts`
- Modify: `src/authStore.ts`, `src/authStore.test.ts`

- [ ] **Step 1: Write failing token tests**

Require 32 random bytes encoded base64url, SHA-256-only storage, purpose binding, constant-time hash comparison, one-hour verification expiry, 30-minute reset expiry, and no token value in errors.

```typescript
const issued = issueAuthToken("verify_email", () => Buffer.alloc(32, 7));
assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);
assert.match(issued.hash, /^[0-9a-f]{64}$/);
assert.notEqual(issued.token, issued.hash);
assert.equal(hashAuthToken(issued.token), issued.hash);
```

- [ ] **Step 2: Write failing store tests**

Cover concurrent normalized-email registration, neutral duplicate registration, unverified login denial, verification single-use/expiry, neutral resend, neutral reset request for present/absent email, reset single-use/expiry, password change requiring current password, other-session revocation, current-session preservation, session list/revoke ownership, profile update, idempotent deletion request, and all mutations in one database transaction.

At the server boundary, email is at most 254 UTF-8 bytes after trim/lowercase and must have one valid local/domain split; passwords are 12–128 Unicode code points, are never trimmed, and reject NUL/control characters. Registration and password changes apply the same validator.

Also test AES-256-GCM token envelopes with a 32-byte `EMAIL_TOKEN_ENCRYPTION_KEY`: random 12-byte IV, authenticated `purpose\0userId`, tamper/wrong-purpose/wrong-user rejection, and no plaintext token in the stored ciphertext/IV/tag or errors.

- [ ] **Step 3: Implement minimal lifecycle API**

```typescript
export type NeutralRequestResult = { accepted: true };
export async function registerCustomer(input: { email: string; password: string }): Promise<NeutralRequestResult>;
export async function verifyCustomerEmail(token: string): Promise<{ verified: true } | { verified: false }>;
export async function requestVerification(email: string): Promise<NeutralRequestResult>;
export async function requestPasswordReset(email: string): Promise<NeutralRequestResult>;
export async function resetPassword(input: { token: string; password: string }): Promise<{ changed: true } | { changed: false }>;
export async function changePassword(input: { userId: number; currentPassword: string; password: string; keepSessionId: number }): Promise<boolean>;
export async function requestAccountDeletion(userId: number): Promise<void>;
```

Registration inserts an inactive user with `email_verified_at=NULL`, creates one current verification token, seals its raw value for delivery, and inserts one email-outbox row transactionally. Duplicate addresses perform a password hash calculation and return the same result/timing class without changing the password; an unverified account may receive a fresh verification token without exposing that fact to the caller. Verification sets `active=true`, sets `email_verified_at`, consumes the token, and consumes other verification tokens. Password reset consumes all reset tokens and revokes every existing session. Authenticated password change revokes all sessions except the current one.

- [ ] **Step 4: Extend safe sessions**

`createSession()` accepts `{ clientName, ipPrefix }`, updates last-seen at most once per five minutes, and returns the inserted session ID internally. Public list fields are only `id`, `current`, `clientName`, `createdAt`, `lastSeenAt`; never return token hash or IP. Revoke queries require both `session.id` and `user_id`.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test --test-concurrency=1 src/authToken.test.ts src/emailTokenEnvelope.test.ts src/identityStore.test.ts src/authStore.test.ts
npx tsc --noEmit
git add src/authToken.ts src/authToken.test.ts src/emailTokenEnvelope.ts src/emailTokenEnvelope.test.ts src/identityStore.ts src/identityStore.test.ts src/authStore.ts src/authStore.test.ts
git commit -m "feat: complete customer identity lifecycle"
```

## Task 3: Add PostgreSQL-backed identity abuse limits

**Files:**
- Create: `src/distributedRateLimit.ts`, `src/distributedRateLimit.test.ts`

- [ ] **Step 1: Write failing concurrency tests**

Test exact window boundaries, concurrent increments across two pools, per-scope isolation, normalized email/IP subjects, SHA-256-at-rest subjects, retry-after calculation, expired cleanup, and that no row contains a raw email or IP.

- [ ] **Step 2: Implement one atomic upsert**

```typescript
export async function consumeRateLimit(input: {
  scope: "register" | "verify" | "login" | "reset";
  subject: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }>;
```

Hash `${scope}\0${normalizedSubject}` with a server-side `RATE_LIMIT_HASH_SECRET`, floor `now` to the requested window, and use one atomic statement:

```sql
INSERT INTO rate_limit_windows
  (scope, subject_hash, window_start, request_count, expires_at)
VALUES ($1, $2, $3, 1, $4)
ON CONFLICT (scope, subject_hash, window_start) DO UPDATE SET
  request_count = rate_limit_windows.request_count + 1,
  expires_at = GREATEST(rate_limit_windows.expires_at, EXCLUDED.expires_at)
RETURNING request_count, expires_at;
```

Delete only expired rows with a bounded batch query.

- [ ] **Step 3: Verify and commit**

```bash
node --experimental-strip-types --test src/distributedRateLimit.test.ts
npx tsc --noEmit
git add src/distributedRateLimit.ts src/distributedRateLimit.test.ts
git commit -m "feat: distribute identity rate limits"
```

## Task 4: Deliver identity email durably through SMTP

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/smtp.ts`, `src/smtp.test.ts`
- Create: `src/emailOutbox.ts`, `src/emailOutbox.test.ts`
- Create: `services/email-worker/src/worker.ts`, `worker.test.ts`, `index.ts`, `services/email-worker/Dockerfile`

- [ ] **Step 1: Install SMTP dependencies**

Run: `npm install nodemailer && npm install --save-dev @types/nodemailer`

- [ ] **Step 2: Write failing SMTP configuration tests**

Development permits Mailpit without auth/TLS; production requires host, port, authenticated TLS, verified `EMAIL_FROM`, and a public HTTPS `APP_URL`. Reject credentials in logs/errors. Email bodies contain only one HTTPS token URL and support contact; they never contain a password, database ID, or raw account state.

- [ ] **Step 3: Write failing outbox lease/retry tests**

Prove `FOR UPDATE SKIP LOCKED` single ownership, five-minute lease, success, transient bounded exponential backoff (30s, 2m, 10m, 30m), permanent error dead-letter after five attempts, abandoned lease recovery, and token-expired messages becoming dead without sending.

- [ ] **Step 4: Implement adapter and worker**

```typescript
export interface MailSender { send(message: { to: string; subject: string; text: string; html: string }): Promise<void>; }
export async function claimEmail(workerId: string): Promise<ClaimedEmail | undefined>;
export async function completeEmail(id: string, workerId: string): Promise<void>;
export async function failEmail(id: string, workerId: string, classification: "transient" | "permanent", code: string): Promise<void>;
```

The claimed record joins the user's email and the still-valid token metadata, decrypts the delivery envelope only in memory using `EMAIL_TOKEN_ENCRYPTION_KEY`, and clears ciphertext/IV/tag after sent/dead. The encryption key is server-side only and never logged.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test src/smtp.test.ts src/emailOutbox.test.ts services/email-worker/src/worker.test.ts
npx tsc --noEmit
git add package.json package-lock.json src/smtp.ts src/smtp.test.ts src/emailOutbox.ts src/emailOutbox.test.ts services/email-worker
git commit -m "feat: deliver identity email durably"
```

## Task 5: Expose neutral, origin-protected identity routes

**Files:**
- Modify: `services/api/src/config.ts`, `config.test.ts`
- Modify: `services/api/src/app.ts`, `app.test.ts`
- Modify: `services/api/src/index.ts`

- [ ] **Step 1: Write failing route tests**

Cover 202-neutral registration/resend/reset responses for present and absent email; invalid/expired verification/reset tokens; verified-only login; password change; session list/revoke ownership; profile/deletion; strict Origin on every cookie mutation; missing/foreign Origin rejection; signed Stripe webhook exemption; Secure/HttpOnly/SameSite/Max-Age cookie flags; configured proxy hop; body limits; distributed rate-limit 429/retry-after; generic errors with correlation ID.

- [ ] **Step 2: Add exact routes**

```text
POST /auth/register
POST /auth/verify
POST /auth/verification/request
POST /auth/password/reset/request
POST /auth/password/reset
POST /auth/password/change
GET  /auth/sessions
DELETE /auth/sessions/:sessionId
GET  /account
PATCH /account
POST /account/deletion-request
```

All request fields are bounded and schema-checked. Registration/reset-request/resend return `{accepted:true}` regardless of address existence. Verification/reset return one generic invalid-or-expired result. Passwords never appear in structured error context.

- [ ] **Step 3: Enforce same-origin mutations and proxy policy**

Set `app.set("trust proxy", configuredHopCount)`. For non-webhook `POST/PATCH/PUT/DELETE`, require an absolute `Origin` exactly equal to the configured `APP_URL` origin. Reject `null`, missing, multiple, or malformed values with 403. Keep SameSite=Strict; set `maxAge` equal to session expiry; use production Secure; never reflect arbitrary origins.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test services/api/src/config.test.ts services/api/src/app.test.ts src/identityStore.test.ts
npx tsc --noEmit
git add services/api/src/config.ts services/api/src/config.test.ts services/api/src/app.ts services/api/src/app.test.ts services/api/src/index.ts
git commit -m "feat: expose secure customer identity APIs"
```

## Task 6: Replace rotating startup seed with explicit admin commands

**Files:**
- Modify: `src/authStore.ts`, `src/authStore.test.ts`
- Modify: `services/api/src/index.ts`, startup tests
- Create: `scripts/admin-create.ts`, `scripts/admin-password.ts`, `scripts/admin-disable.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing no-rotation tests**

Starting API twice must not change an administrator password hash or sessions. `admin:create` creates a missing admin and is a no-op for an existing normalized email. Password rotation requires `admin:password`; disable requires `admin:disable`; neither prints a password/hash/session.

- [ ] **Step 2: Implement explicit commands**

```json
{
  "admin:create": "node --experimental-strip-types scripts/admin-create.ts",
  "admin:password": "node --experimental-strip-types scripts/admin-password.ts",
  "admin:disable": "node --experimental-strip-types scripts/admin-disable.ts"
}
```

Read email/password from environment or hidden stdin; never command-line arguments. `admin:create` uses `ON CONFLICT DO NOTHING`. `admin:password` rehashes and revokes sessions intentionally. `admin:disable` sets inactive, consumes auth tokens, revokes sessions, and leaves audit-compatible rows.

- [ ] **Step 3: Remove admin credentials from API startup**

API startup validates migrations/config and listens without reading `ADMIN_PASSWORD` or calling `seedAdmin`. Compose/staging runs `admin:create` once as an explicit bootstrap job.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/authStore.test.ts services/api/src/startup.test.ts
npx tsc --noEmit
git add src/authStore.ts src/authStore.test.ts services/api/src/index.ts services/api/src/startup.test.ts scripts/admin-create.ts scripts/admin-password.ts scripts/admin-disable.ts package.json
git commit -m "fix: make administrator bootstrap explicit"
```

## Task 7: Build direct-route registration, recovery, and account UI

**Files:**
- Create: `src/vitrine/identityApi.ts`, `identityApi.test.ts`, `routes.ts`, `routes.test.ts`
- Create: identity page components and rendered tests
- Modify: `src/vitrine/main.tsx`, `AuthProvider.tsx`, `authApi.ts`, `SignIn.tsx`, `App.tsx`
- Modify: `vite.config.ts`, `src/viteConfig.test.ts`

- [ ] **Step 1: Write failing route/API tests**

Parse `/`, `/pricing`, `/signin`, `/register`, `/verify-email`, `/recover`, `/reset-password`, and `/account`; reject token query values from logs/sessionStorage; preserve an intended catalog search only through sign-in; replace history after token consumption. API requests always send JSON, credentials same-origin, and `Origin` is browser-generated rather than manually spoofed.

- [ ] **Step 2: Replace hash routing with History API**

Use `useSyncExternalStore` over `popstate`, `history.pushState`, and one typed route parser; no router dependency. Vite and the production static server fall back unknown non-asset paths to `index.html`.

- [ ] **Step 3: Implement complete states**

Registration: password requirements, neutral success, verification-wait/resend. Verification/reset: loading/success/invalid-expired. Recovery: neutral success. Account: profile, billing summary link, sessions/current marker/revoke, password change, deletion request/support copy. `signed_in_elsewhere` gets a distinct re-auth screen; ordinary expiry returns to sign-in with a recoverable notice.

- [ ] **Step 4: Verify accessibility and rendering**

Every form has semantic label, described error, loading-disabled submit, focus moved to result/error heading, keyboard-visible focus, polite status region, no color-only meaning, and mobile layouts at 320px. Run rendered tests plus browser keyboard checks.

- [ ] **Step 5: Commit**

```bash
node --experimental-strip-types --test src/vitrine/identityApi.test.ts src/vitrine/routes.test.ts src/viteConfig.test.ts
tsx --test src/vitrine/*.test.tsx
npx tsc --noEmit
git add src/vitrine vite.config.ts
git commit -m "feat: add customer identity experience"
```

## Task 8: Run Mailpit and complete identity acceptance

**Files:**
- Modify: `docker-compose.yml`
- Modify: deployment/container environment
- Create: `docs/operations/identity.md`
- Modify: `docs/ARCHITECTURE.md`, production matrix

- [ ] **Step 1: Add Mailpit and email worker to Compose**

Pin Mailpit, expose its UI only on the development loopback port, health-check SMTP/API, and configure the email worker with the same production-shaped SMTP settings except TLS/auth disabled explicitly for development. API never receives SMTP credentials if it only inserts outbox rows.

- [ ] **Step 2: Run complete browser journeys**

In the containerized stack: register; inspect Mailpit; verify; sign in; create a third session and confirm `signed_in_elsewhere`; list/revoke session; request reset for existing and absent addresses and compare responses; consume once; confirm reuse/expiry fail; change password and confirm other-session revocation; update profile; request deletion; log out.

- [ ] **Step 3: Run security/failure drills**

Two API instances share identity limits. Foreign/missing Origin fails. Stop Mailpit: registration remains accepted with pending outbox and readiness reports email degradation without leaking address/token; restart and confirm delivery. Kill the email worker after SMTP acceptance but before completion: lease recovery may redeliver the same stable Message-ID, the copy warns that links are single-use, and consuming either copy invalidates both. Search logs for seeded password/token/cookie/email canaries and require no matches except intentionally hashed subjects.

- [ ] **Step 4: Run full gate and document**

```bash
npm test
npx tsc --noEmit
npm run build
npm run build-storybook
docker compose config --quiet
docker compose build api email-worker
git diff --check
```

Document SMTP variables, sender verification, admin commands, token/session lifetimes, rate limits, retry/dead policy, deletion/support procedure, recovery, and rollback.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml services/email-worker docs/operations/identity.md docs/ARCHITECTURE.md docs/production-readiness-matrix.md
git commit -m "ops: verify customer identity lifecycle"
```

## Completion gate

- Existing users survive migration and are verified without password/session changes.
- Address-sensitive endpoints are neutral; tokens are random, hashed, purpose-bound, expiring, single-use, and absent from logs.
- Registration, verification, resend, login, logout, recovery, reset, password change, profile, sessions, revocation, deletion request, and `signed_in_elsewhere` pass in the browser.
- Identity limits are shared across two APIs; cookie mutations enforce the trusted origin; production cookies/proxy settings are correct.
- Email outbox survives API/email-worker/SMTP interruption, retries safely, and uses production TLS/auth rules with Mailpit staging parity.
- API startup never rotates an administrator password or deletes sessions; explicit commands are idempotent and secret-safe.
- Direct URLs, accessibility, responsive states, complete automated tests, containers, failure drills, documentation, and `git diff --check` pass.
