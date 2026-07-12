-- Synthetic, data-only snapshot of the schema that existed immediately before
-- versioned migrations. IDs and timestamps are fixed so preservation hashes are
-- reproducible and contain no customer or production secrets.
INSERT INTO apps (id, name, icon_url, category)
VALUES (101, 'fixture-app', 'https://fixture.example/icon.png', 'Productivity');

INSERT INTO platforms (id, app_id, name)
VALUES (201, 101, 'web');

INSERT INTO images (id, platform_id, image_url, description, created_at, analysis, kind)
VALUES
  (301, 201, 'mobbin-bulk:1111111111111111', 'Published screen',
   '2025-01-01T00:00:00Z', '{"source":"fixture","state":"published"}', 'screen'),
  (302, 201, 'capture:2222222222222222', 'Draft capture',
   '2025-01-02T00:00:00Z', '{"source":"fixture","state":"draft"}', 'screen');

INSERT INTO jobs (id, parent_id, type, payload, status, message, created_at, updated_at)
VALUES
  (601, NULL, 'import', '{"app":"fixture-app"}', 'complete', 'fixture import',
   '2025-01-03T00:00:00Z', '2025-01-03T01:00:00Z'),
  (602, 601, 'intelligent-crawl', '{"app":"fixture-app","versionId":502}', 'complete',
   'fixture crawl', '2025-01-04T00:00:00Z', '2025-01-04T01:00:00Z');

INSERT INTO users (id, email, password_hash, role, active, created_at, updated_at)
VALUES
  (401, 'fixture-user@example.invalid', 'synthetic-password-hash', 'user', true,
   '2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z'),
  (402, 'fixture-admin@example.invalid', 'synthetic-admin-hash', 'admin', true,
   '2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

INSERT INTO sessions
  (id, user_id, token_hash, expires_at, created_at, revoked_at, revoked_reason)
VALUES
  (701, 401, 'synthetic-session-token-hash', '2030-01-01T00:00:00Z',
   '2025-01-05T00:00:00Z', NULL, NULL);

INSERT INTO subscriptions
  (user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
   billing_interval, status, current_period_start, current_period_end,
   cancel_at_period_end, grace_expires_at, updated_at)
VALUES
  (401, 'cus_fixture', 'sub_fixture', 'price_fixture_month', 'month', 'active',
   '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z', false, NULL,
   '2025-01-01T00:00:00Z');

INSERT INTO free_app_unlocks (user_id, app_id, unlocked_at)
VALUES (401, 101, '2025-01-06T00:00:00Z');

INSERT INTO stripe_events (event_id, processed_at)
VALUES ('evt_fixture', '2025-01-07T00:00:00Z');

INSERT INTO export_usage (user_id, window_start, operation_count)
VALUES (401, '2025-01-01T00:00:00Z', 2);

INSERT INTO access_events
  (id, user_id, session_hash, ip_prefix, app_slug, action, volume, outcome, created_at)
VALUES
  (801, 401, 'synthetic-session-hash', '192.0.2.0/24', 'fixture-app',
   'catalog.read', 1, 'allowed', '2025-01-08T00:00:00Z');

INSERT INTO design_systems (app_id, snapshot, updated_at)
VALUES
  (101, '{"colors":{"primary":"#123456"},"source":"fixture"}',
   '2025-01-09T00:00:00Z');

INSERT INTO app_flows (app_id, flows, updated_at)
VALUES
  (101, '[{"id":"fixture-flow","title":"Fixture flow","steps":[]}]',
   '2025-01-09T00:00:00Z');

INSERT INTO app_versions
  (id, app_id, version_number, label, source_url, status, notes, captured_at,
   submitted_at, published_at, created_by, reviewed_by)
VALUES
  (501, 101, 1, 'v1', 'https://fixture.example/published', 'published',
   'Published fixture', '2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z',
   '2025-01-03T00:00:00Z', 402, 402),
  (502, 101, 2, 'v2', 'https://fixture.example/draft', 'draft',
   'Draft fixture', '2025-01-04T00:00:00Z', NULL, NULL, 402, NULL);

INSERT INTO version_images
  (version_id, image_id, captured_at, source_url, viewport_width, viewport_height, state_context)
VALUES
  (501, 301, '2025-01-01T00:00:00Z', 'https://fixture.example/published', 1440, 900, 'published'),
  (502, 301, '2025-01-04T00:00:00Z', 'https://fixture.example/published', 1440, 900, 'draft-reference'),
  (502, 302, '2025-01-04T00:01:00Z', 'https://fixture.example/draft', 1280, 800, 'draft-only');

INSERT INTO design_system_versions (version_id, snapshot, created_at)
VALUES
  (501, '{"version":1,"colors":{"primary":"#123456"}}', '2025-01-03T00:00:00Z'),
  (502, '{"version":2,"colors":{"primary":"#654321"}}', '2025-01-04T00:00:00Z');

INSERT INTO app_flow_versions (version_id, flows, created_at)
VALUES
  (501, '[{"id":"fixture-flow","version":1}]', '2025-01-03T00:00:00Z'),
  (502, '[{"id":"fixture-flow","version":2}]', '2025-01-04T00:00:00Z');

INSERT INTO review_issues
  (id, version_id, entity_kind, entity_id, severity, message, resolved, created_at, resolved_at)
VALUES
  (901, 502, 'screen', '302', 'warning', 'Synthetic review issue', false,
   '2025-01-10T00:00:00Z', NULL);

INSERT INTO exports
  (id, user_id, app_id, version_id, scope, format, status, output_filename,
   error, created_at, completed_at)
VALUES
  (1001, 401, 101, 501, '{"kind":"app","app":"fixture-app"}', 'json',
   'complete', 'fixture-export.json', NULL, '2025-01-11T00:00:00Z',
   '2025-01-11T00:01:00Z');

INSERT INTO crawl_plans
  (id, app_id, revision, plan, content_hash, status, research_metadata,
   created_by, approved_by, approved_at, created_at, updated_at)
VALUES
  (1101, 101, 1,
   '{"app":"fixture-app","revision":1,"flows":[{"id":"fixture-flow","steps":[{"id":"fixture-step"}]}]}',
   repeat('a', 64), 'approved', '{"source":"fixture"}', 402, 402,
   '2025-01-12T00:00:00Z', '2025-01-12T00:00:00Z', '2025-01-12T00:00:00Z');

INSERT INTO crawl_runs
  (id, app_id, version_id, plan_id, job_id, status, current_flow_id,
   current_step_id, completed_count, failed_count, skipped_count,
   cancel_requested_at, retry_of_run_id, retry_mode, environment, worker_id,
   heartbeat_at, created_at, started_at, finished_at, updated_at)
VALUES
  (1201, 101, 502, 1101, 602, 'succeeded', 'fixture-flow', 'fixture-step',
   1, 0, 0, NULL, NULL, 'all', '{"browser":"fixture"}', 'fixture-worker',
   '2025-01-13T00:01:00Z', '2025-01-13T00:00:00Z', '2025-01-13T00:00:10Z',
   '2025-01-13T00:01:00Z', '2025-01-13T00:01:00Z');

INSERT INTO crawl_evidence
  (id, version_id, plan_id, image_id, flow_id, step_id, source_url, final_url,
   state_label, screenshot_hash, viewport_width, viewport_height, captured_at)
VALUES
  (1301, 502, 1101, 302, 'fixture-flow', 'fixture-step',
   'https://fixture.example/start', 'https://fixture.example/final', 'Complete',
   repeat('b', 64), 1280, 800, '2025-01-13T00:00:30Z');

INSERT INTO crawl_run_steps
  (run_id, flow_id, step_id, flow_order, step_order, status, attempts,
   source_url, final_url, expected, actual, observed_screenshot_hash,
   evidence_id, error_class, error_message, failure_screenshot, created_at,
   started_at, finished_at, updated_at)
VALUES
  (1201, 'fixture-flow', 'fixture-step', 0, 0, 'completed', 1,
   'https://fixture.example/start', 'https://fixture.example/final',
   '{"url":"https://fixture.example/final"}', '{"url":"https://fixture.example/final"}',
   repeat('b', 64), 1301, NULL, NULL, NULL, '2025-01-13T00:00:00Z',
   '2025-01-13T00:00:10Z', '2025-01-13T00:00:30Z', '2025-01-13T00:00:30Z');

INSERT INTO crawl_repairs
  (id, plan_id, run_id, flow_id, step_id, proposed_step, failure, provider,
   status, reviewed_by, reviewed_at, applied_plan_id, created_at)
VALUES
  (1401, 1101, 1201, 'fixture-flow', 'fixture-step',
   '{"id":"fixture-step","action":"click"}', '{"class":"fixture"}',
   'fixture-provider', 'proposed', NULL, NULL, NULL, '2025-01-14T00:00:00Z');

INSERT INTO collections (id, user_id, name, description, created_at, updated_at)
VALUES
  (1501, 401, 'Fixture collection', 'Synthetic collection',
   '2025-01-15T00:00:00Z', '2025-01-15T00:00:00Z');

INSERT INTO collection_items
  (id, collection_id, kind, app, reference_id, title, notes, created_at, updated_at)
VALUES
  (1601, 1501, 'screen', 'fixture-app', '301', 'Published fixture screen',
   'Synthetic note', '2025-01-15T00:00:00Z', '2025-01-15T00:00:00Z');

SELECT setval(pg_get_serial_sequence('apps', 'id'), 101, true);
SELECT setval(pg_get_serial_sequence('platforms', 'id'), 201, true);
SELECT setval(pg_get_serial_sequence('images', 'id'), 302, true);
SELECT setval(pg_get_serial_sequence('jobs', 'id'), 602, true);
SELECT setval(pg_get_serial_sequence('users', 'id'), 402, true);
SELECT setval(pg_get_serial_sequence('sessions', 'id'), 701, true);
SELECT setval(pg_get_serial_sequence('access_events', 'id'), 801, true);
SELECT setval(pg_get_serial_sequence('app_versions', 'id'), 502, true);
SELECT setval(pg_get_serial_sequence('review_issues', 'id'), 901, true);
SELECT setval(pg_get_serial_sequence('exports', 'id'), 1001, true);
SELECT setval(pg_get_serial_sequence('crawl_plans', 'id'), 1101, true);
SELECT setval(pg_get_serial_sequence('crawl_runs', 'id'), 1201, true);
SELECT setval(pg_get_serial_sequence('crawl_evidence', 'id'), 1301, true);
SELECT setval(pg_get_serial_sequence('crawl_repairs', 'id'), 1401, true);
SELECT setval(pg_get_serial_sequence('collections', 'id'), 1501, true);
SELECT setval(pg_get_serial_sequence('collection_items', 'id'), 1601, true);
