# Admin Authentication Design

**Date:** 2026-07-10

## Goal

Replace Vitrine's in-memory sign-in simulation with server-enforced authentication for one seeded administrator. The session must survive page refreshes, protect all application data and pipeline operations, and retain a clean path to a future normal-user role without adding normal-user provisioning in this milestone.

## Scope

### Included

- One administrator seeded from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Password hashing with Node's native `scrypt` and a unique random salt.
- Opaque server-side sessions stored in Postgres.
- Login, current-session, and logout API endpoints.
- HttpOnly, `SameSite=Strict` session cookie.
- Server-side authenticated and admin-only middleware.
- Protection for gallery data, screenshots, Markdown, progress, and jobs.
- Real Vitrine login, refresh persistence, admin identity display, and logout.
- Removal of the Vite database middleware that bypasses API authentication.
- A `role` column supporting `admin | user`, with only `admin` provisioned now.

### Excluded

- Normal-user creation or management.
- Public signup.
- Password reset, email verification, social login, or multi-factor authentication.
- Multiple administrators.
- Login throttling before public exposure.
- OAuth, SSO, JWT access tokens, refresh tokens, or external identity providers.

## Security Model

Postgres is authoritative for users and sessions. The browser receives an opaque random session token, while Postgres stores only its SHA-256 hash. Authentication state is never stored in `localStorage` or exposed to frontend JavaScript.

Passwords use `scrypt` with a random 16-byte salt and parameters meeting current OWASP guidance for scrypt when Argon2id is unavailable: `N=2^17`, `r=8`, `p=1`, with sufficient `maxmem`. Hashes are stored as a versioned string containing the algorithm, parameters, salt, and derived key so parameters can be upgraded later.

Session tokens use at least 32 cryptographically random bytes. Sessions expire 12 hours after creation. The cookie is non-persistent, so closing the browser removes the client token even if the database expiry is later.

Cookie attributes:

- `HttpOnly`
- `SameSite=Strict`
- `Path=/`
- `Secure` when `NODE_ENV=production`

All private and authentication responses set `Cache-Control: no-store`.

## Database Schema

Add schema creation to the existing Postgres initialization path:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
```

The admin seed is idempotent and treats environment credentials as the source of truth for this testing milestone: API startup upserts the configured email as an active administrator and replaces its password hash. Restarting with a changed `ADMIN_PASSWORD` rotates the password deliberately. Existing sessions are deleted during the seed so password rotation logs out prior sessions.

API startup fails before listening if either required environment variable is absent, the email is malformed, or the password is shorter than 16 characters.

## Backend Components

### Authentication domain

Create a focused authentication module responsible for:

- normalizing email addresses to trimmed lowercase;
- hashing and verifying passwords;
- generating and hashing session tokens;
- seeding the configured admin;
- creating, resolving, and deleting sessions;
- removing expired sessions opportunistically.

The module returns safe user objects containing `id`, `email`, and `role`. It never returns password hashes or stored token hashes to route handlers.

### API middleware

The Express app resolves the session cookie once per protected request.

- `requireAuth` returns `401` when the cookie is missing, invalid, expired, belongs to an inactive user, or resolves to no session.
- `requireAdmin` runs after authentication and returns `403` unless `role === 'admin'`.
- Authorization is enforced on the server; frontend visibility does not grant access.

Cookie parsing uses a small local parser because only one cookie is required; no cookie/session dependency is added.

### API routes

Public:

- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`

Authenticated:

- `GET /auth/me`
- `GET /apps`
- `GET /images`
- `GET /progress`
- `GET /jobs`
- `GET /design-systems/:app`
- `GET /media/:app/:hash`

Admin-only:

- `POST /jobs`
- `POST /jobs/:id/cancel`
- `POST /progress/cancel`

`POST /auth/login` accepts JSON `{ email, password }`. Invalid input, unknown email, wrong password, and inactive users all return `401` with `{ error: "Invalid email or password" }`.

Successful login deletes expired sessions, creates a new 12-hour session, sets the cookie, and returns the safe admin object. `GET /auth/me` returns that same object. Logout accepts an optional session cookie, deletes the matching server session when present, always expires the cookie, and returns `204`. Keeping logout callable with a stale or expired cookie makes it idempotent without granting access to private data.

## Gallery API Consolidation

The current Vite plugin reads Postgres directly and serves `/api/apps`, bypassing Express. Remove that middleware and proxy all `/api/*` traffic to the API.

Move gallery transformation into a shared pure module:

- app label, category, and accent selection;
- grouping database images by app;
- the 120-screen cap;
- conversion of `mobbin-bulk:<hash>` to the authenticated media URL.

The API `GET /apps` returns the rich Vitrine `App[]` contract currently produced by Vite. Vitrine's existing `useApps` contract remains unchanged.

Add `POST /progress/cancel` to the API before removing the Vite implementation so `ProgressBanner` continues to work under admin authorization.

## Frontend Authentication Flow

Create `useAuth` or an equivalent focused provider that owns:

- the current safe user;
- initial `/api/auth/me` lookup;
- `login(email, password)`;
- `logout()`;
- loading and authentication errors.

At application startup:

1. show the design-system `Spinner` while `/auth/me` resolves;
2. render `SignIn` for `401`;
3. render `App` for an authenticated admin.

The existing `SignIn` screen remains visually intact and continues using `@astryxdesign/core`. Its submit action calls the real login endpoint. The fake delay, fake success path, and Google action are removed. Google UI is omitted rather than left as a nonfunctional control.

On login failure, the password field shows the generic server error. On success, the authenticated application renders immediately after the existing short success transition, without storing credentials or tokens in JavaScript.

The application header shows the admin email and a design-system logout button. Logout calls the API, clears frontend user state, and returns to `SignIn`.

## Error Handling

- Missing seed credentials stop API startup with a clear variable-name error and no secret value.
- Database or hashing failures return `500` without leaking credential material.
- Login failures use the same `401` response regardless of cause.
- Expired sessions are removed and return `401`.
- Inactive users cannot create or retain sessions.
- Normal-user sessions receive `403` from admin-only routes.
- Logout is idempotent: a missing or invalid session still clears the cookie and returns `204`; other unauthenticated private requests remain `401`.
- Passwords, raw session tokens, password hashes, and token hashes are never logged.
- Existing job retry and cancellation behavior is unchanged after authorization succeeds.

## Testing

### Authentication unit tests

- password hashes do not contain plaintext;
- correct password verifies;
- wrong password fails;
- equal passwords receive different salted hashes;
- session tokens are random;
- stored token hashes do not equal raw tokens.

### Database tests

- admin seeding creates an active admin;
- reseeding updates the password and invalidates sessions;
- session lookup returns the safe user;
- expired sessions fail and are removed;
- inactive users fail session resolution;
- logout deletes the session.

### API tests

- missing credentials return generic `401`;
- valid credentials set the expected cookie flags;
- `/auth/me` resolves the cookie;
- logout invalidates the cookie and database session;
- unauthenticated private reads and writes return `401`;
- a synthetic normal-user session gets `403` from admin actions;
- an admin session can create and cancel jobs;
- gallery, media, Markdown, and progress are protected;
- `GET /health` remains public.

### Frontend tests

- startup renders a loading state;
- unauthenticated state renders `SignIn`;
- SignIn sends real credentials and renders the generic failure;
- authenticated state renders `App` and the admin identity;
- logout returns to `SignIn`;
- the existing design-system components remain the UI primitives.

### Verification

```sh
npm test
npx tsc --noEmit
npm run build
npm run build-storybook
docker compose config --quiet
```

Manual browser acceptance:

1. start the API with explicit admin environment variables;
2. confirm invalid credentials fail generically;
3. log in with the seeded admin;
4. refresh and confirm the session persists;
5. browse gallery/media/Markdown and view jobs;
6. verify an admin pipeline submission reaches queued state;
7. logout and confirm private API calls return `401`.

## Operational Configuration

Add `.env.example` containing variable names and non-secret instructions:

```dotenv
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
```

Real credentials remain outside the repository. Docker Compose passes the two variables into the API container from the operator environment. The import worker does not receive them because it authenticates to RabbitMQ/Postgres internally rather than through the HTTP API.

## Deferred Scale Path

When normal users are required:

1. add admin-only user creation, disable, and password-rotation routes;
2. decide whether normal users are read-only or own pipeline jobs;
3. add `owner_user_id` to jobs only if per-user job ownership is selected;
4. add shared login throttling at the ingress or a distributed rate-limit store before public exposure;
5. add password reset, email verification, and MFA only when the product requires them.

No current API contract or session representation must be replaced for those additions.

## Success Criteria

- The fake frontend sign-in no longer grants access.
- Only the seeded active admin can authenticate.
- Refresh preserves the session without browser storage.
- All private data and pipeline actions are enforced by the API.
- Admin-only actions reject authenticated `user` roles with `403`.
- Logout invalidates the server session.
- Vite cannot bypass authentication through direct database middleware.
- No credentials or raw session tokens are persisted or logged.
- Existing pipeline, frontend, Storybook, TypeScript, and Compose checks pass.
