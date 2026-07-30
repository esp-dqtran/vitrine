CREATE TABLE screen_pattern_sections (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  position INTEGER NOT NULL UNIQUE CHECK (position > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE screen_patterns (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL
    REFERENCES screen_pattern_sections(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 160),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 1000),
  aliases TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL CHECK (position > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, position)
);

CREATE TABLE screen_pattern_assignments (
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  screen_pattern_id BIGINT NOT NULL
    REFERENCES screen_patterns(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('analysis', 'imported', 'manual')),
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5
    CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (image_id, screen_pattern_id)
);

CREATE INDEX screen_patterns_section_idx
  ON screen_patterns (section_id, position, id);
CREATE INDEX screen_pattern_assignments_pattern_idx
  ON screen_pattern_assignments (screen_pattern_id, image_id);
CREATE INDEX screen_pattern_assignments_source_idx
  ON screen_pattern_assignments (source, image_id);

INSERT INTO screen_pattern_sections (slug, name, position)
VALUES
  ('new-user-experience', 'New User Experience', 1),
  ('account-management', 'Account Management', 2),
  ('communication', 'Communication', 3),
  ('commerce-finance', 'Commerce & Finance', 4),
  ('social', 'Social', 5),
  ('content', 'Content', 6),
  ('actions', 'Actions', 7),
  ('data', 'Data', 8),
  ('user-collections', 'User Collections', 9),
  ('utility', 'Utility', 10),
  ('misc', 'Misc', 11),
  ('layouts', 'Layouts', 12);

WITH seed(section_slug, position, slug, name, aliases) AS (
  VALUES
    ('new-user-experience', 1, 'account-setup', 'Account Setup', ARRAY['onboarding', 'initial setup', 'workspace setup']),
    ('new-user-experience', 2, 'guided-tour-tutorial', 'Guided Tour & Tutorial', ARRAY['guided tour', 'product tour', 'tutorial']),
    ('new-user-experience', 3, 'signup', 'Signup', ARRAY['sign up', 'register', 'registration']),
    ('new-user-experience', 4, 'verification', 'Verification', ARRAY['verify account', 'email verification', 'otp']),

    ('account-management', 1, 'delete-deactivate-account', 'Delete & Deactivate Account', ARRAY['delete account', 'deactivate account']),
    ('account-management', 2, 'forgot-password', 'Forgot Password', ARRAY['password recovery', 'reset password']),
    ('account-management', 3, 'login', 'Login', ARRAY['sign in', 'log in']),
    ('account-management', 4, 'my-account-profile', 'My Account & Profile', ARRAY['account overview', 'my account', 'profile']),
    ('account-management', 5, 'settings-preferences', 'Settings & Preferences', ARRAY['account settings', 'preferences', 'settings']),

    ('communication', 1, 'acknowledgement-success', 'Acknowledgement & Success', ARRAY['success message', 'completed']),
    ('communication', 2, 'action-option', 'Action Option', ARRAY['action choices', 'options']),
    ('communication', 3, 'confirmation', 'Confirmation', ARRAY['confirm action']),
    ('communication', 4, 'empty-state', 'Empty State', ARRAY['no results', 'no data']),
    ('communication', 5, 'error', 'Error', ARRAY['failure', 'failed']),
    ('communication', 6, 'feature-info', 'Feature Info', ARRAY['feature information']),
    ('communication', 7, 'feedback', 'Feedback', ARRAY['send feedback']),
    ('communication', 8, 'help-support', 'Help & Support', ARRAY['help center', 'customer support']),
    ('communication', 9, 'loading', 'Loading', ARRAY['loading state', 'skeleton']),
    ('communication', 10, 'permission', 'Permission', ARRAY['permissions', 'access request']),
    ('communication', 11, 'suggestions-similar-items', 'Suggestions & Similar Items', ARRAY['recommendations', 'related items']),

    ('commerce-finance', 1, 'billing', 'Billing', ARRAY['invoice', 'invoices']),
    ('commerce-finance', 2, 'cart-bag', 'Cart & Bag', ARRAY['shopping cart', 'shopping bag']),
    ('commerce-finance', 3, 'checkout', 'Checkout', ARRAY['place order']),
    ('commerce-finance', 4, 'order-confirmation', 'Order Confirmation', ARRAY['purchase confirmation']),
    ('commerce-finance', 5, 'order-detail', 'Order Detail', ARRAY['order details']),
    ('commerce-finance', 6, 'order-history', 'Order History', ARRAY['past orders']),
    ('commerce-finance', 7, 'payment-method', 'Payment Method', ARRAY['credit card', 'payment details']),
    ('commerce-finance', 8, 'pricing', 'Pricing', ARRAY['plans', 'price']),
    ('commerce-finance', 9, 'promotions-rewards', 'Promotions & Rewards', ARRAY['promotion', 'rewards', 'coupon']),
    ('commerce-finance', 10, 'shop-storefront', 'Shop & Storefront', ARRAY['store', 'storefront', 'shop']),
    ('commerce-finance', 11, 'subscription-paywall', 'Subscription & Paywall', ARRAY['subscribe', 'paywall']),
    ('commerce-finance', 12, 'wallet-balance', 'Wallet & Balance', ARRAY['wallet', 'account balance']),

    ('social', 1, 'achievements-awards', 'Achievements & Awards', ARRAY['achievement', 'award', 'badge']),
    ('social', 2, 'chat-detail', 'Chat Detail', ARRAY['chat conversation', 'conversation']),
    ('social', 3, 'comments', 'Comments', ARRAY['comment thread']),
    ('social', 4, 'followers-following', 'Followers & Following', ARRAY['followers', 'following']),
    ('social', 5, 'invite-teammates', 'Invite Teammates', ARRAY['invite team', 'team invitation']),
    ('social', 6, 'leaderboard', 'Leaderboard', ARRAY['ranking']),
    ('social', 7, 'notifications', 'Notifications', ARRAY['notification center']),
    ('social', 8, 'reviews-ratings', 'Reviews & Ratings', ARRAY['review', 'rating']),
    ('social', 9, 'social-feed', 'Social Feed', ARRAY['activity feed']),
    ('social', 10, 'user-group-profile', 'User / Group Profile', ARRAY['user profile', 'group profile']),

    ('content', 1, 'article-detail', 'Article Detail', ARRAY['article']),
    ('content', 2, 'browse-discover', 'Browse & Discover', ARRAY['discovery', 'explore']),
    ('content', 3, 'class-lesson-detail', 'Class & Lesson Detail', ARRAY['class detail', 'lesson detail']),
    ('content', 4, 'code-editor', 'Code Editor', ARRAY['source editor']),
    ('content', 5, 'emails-messages', 'Emails & Messages', ARRAY['email', 'messages', 'inbox']),
    ('content', 6, 'event-detail', 'Event Detail', ARRAY['event details']),
    ('content', 7, 'goal-task', 'Goal & Task', ARRAY['goal', 'task detail']),
    ('content', 8, 'home', 'Home', ARRAY['dashboard', 'landing']),
    ('content', 9, 'news-feed', 'News Feed', ARRAY['news']),
    ('content', 10, 'note-detail', 'Note Detail', ARRAY['note']),
    ('content', 11, 'other-content', 'Other Content', ARRAY[]::TEXT[]),
    ('content', 12, 'post-detail', 'Post Detail', ARRAY['post']),
    ('content', 13, 'product-detail', 'Product Detail', ARRAY['product page']),
    ('content', 14, 'quiz', 'Quiz', ARRAY['assessment']),
    ('content', 15, 'recipe-detail', 'Recipe Detail', ARRAY['recipe']),
    ('content', 16, 'song-podcast-detail', 'Song & Podcast Detail', ARRAY['song detail', 'podcast detail']),
    ('content', 17, 'stories', 'Stories', ARRAY['story']),
    ('content', 18, 'tv-show-movie-detail', 'TV Show & Movie Detail', ARRAY['movie detail', 'show detail']),

    ('actions', 1, 'add-create', 'Add & Create', ARRAY['add', 'create']),
    ('actions', 2, 'ban-block', 'Ban & Block', ARRAY['ban', 'block user']),
    ('actions', 3, 'cancel', 'Cancel', ARRAY['cancellation']),
    ('actions', 4, 'delete', 'Delete', ARRAY['remove']),
    ('actions', 5, 'draw-annotate', 'Draw & Annotate', ARRAY['draw', 'annotate']),
    ('actions', 6, 'edit', 'Edit', ARRAY['update']),
    ('actions', 7, 'favorite-pin', 'Favorite & Pin', ARRAY['favorite', 'favourite', 'pin']),
    ('actions', 8, 'filter-sort', 'Filter & Sort', ARRAY['filter', 'sort']),
    ('actions', 9, 'flag-report', 'Flag & Report', ARRAY['flag', 'report']),
    ('actions', 10, 'follow-subscribe', 'Follow & Subscribe', ARRAY['follow', 'subscribe']),
    ('actions', 11, 'import-export', 'Import & Export', ARRAY['import', 'export']),
    ('actions', 12, 'invite-refer-friends', 'Invite & Refer Friends', ARRAY['invite friends', 'referral']),
    ('actions', 13, 'like-upvote', 'Like & Upvote', ARRAY['like', 'upvote']),
    ('actions', 14, 'move', 'Move', ARRAY['relocate']),
    ('actions', 15, 'other-action', 'Other Action', ARRAY[]::TEXT[]),
    ('actions', 16, 'publish', 'Publish', ARRAY['publishing']),
    ('actions', 17, 'reorder', 'Reorder', ARRAY['rearrange']),
    ('actions', 18, 'save', 'Save', ARRAY['saving']),
    ('actions', 19, 'schedule', 'Schedule', ARRAY['scheduling']),
    ('actions', 20, 'search', 'Search', ARRAY['find']),
    ('actions', 21, 'select', 'Select', ARRAY['selection']),
    ('actions', 22, 'set', 'Set', ARRAY[]::TEXT[]),
    ('actions', 23, 'share', 'Share', ARRAY['sharing']),
    ('actions', 24, 'transfer-send-money', 'Transfer & Send Money', ARRAY['money transfer', 'send money']),
    ('actions', 25, 'upload-download', 'Upload & Download', ARRAY['upload', 'download']),

    ('data', 1, 'charts', 'Charts', ARRAY['chart', 'graph']),
    ('data', 2, 'dashboard', 'Dashboard', ARRAY['overview', 'home']),
    ('data', 3, 'progress', 'Progress', ARRAY['progress tracking']),

    ('user-collections', 1, 'bookmarks-collections', 'Bookmarks & Collections', ARRAY['bookmarks', 'collection']),
    ('user-collections', 2, 'playlists', 'Playlists', ARRAY['playlist']),
    ('user-collections', 3, 'trash-archive', 'Trash & Archive', ARRAY['trash', 'archive']),

    ('utility', 1, 'audio-player', 'Audio Player', ARRAY['music player']),
    ('utility', 2, 'audio-video-recorder', 'Audio & Video Recorder', ARRAY['audio recorder', 'video recorder']),
    ('utility', 3, 'calendar', 'Calendar', ARRAY['date calendar']),
    ('utility', 4, 'call', 'Call', ARRAY['phone call', 'video call']),
    ('utility', 5, 'canvas', 'Canvas', ARRAY['whiteboard']),
    ('utility', 6, 'chat-bot', 'Chat Bot', ARRAY['chatbot', 'ai assistant']),
    ('utility', 7, 'command-palette', 'Command Palette', ARRAY['command menu']),
    ('utility', 8, 'date-time', 'Date & Time', ARRAY['date', 'time']),
    ('utility', 9, 'map', 'Map', ARRAY['location map']),
    ('utility', 10, 'media-editor', 'Media Editor', ARRAY['image editor', 'video editor']),
    ('utility', 11, 'qr-code', 'QR Code', ARRAY['qr']),
    ('utility', 12, 'timeline-history', 'Timeline & History', ARRAY['timeline', 'history']),
    ('utility', 13, 'timer-clock', 'Timer & Clock', ARRAY['timer', 'clock']),
    ('utility', 14, 'video-player', 'Video Player', ARRAY['media player']),

    ('misc', 1, 'dark-mode', 'Dark Mode', ARRAY['dark theme']),
    ('misc', 2, 'internal-tool', 'Internal Tool', ARRAY['admin tool', 'back office']),
    ('misc', 3, 'misc', 'Misc', ARRAY['miscellaneous']),

    ('layouts', 1, 'kanban-board', 'Kanban Board', ARRAY['kanban']),
    ('layouts', 2, 'multi-column-layout', 'Multi-Column Layout', ARRAY['multi column', 'split pane'])
)
INSERT INTO screen_patterns (
  section_id, slug, name, description, aliases, position
)
SELECT section.id, seed.slug, seed.name,
  CASE seed.slug
    WHEN 'my-account-profile'
      THEN 'Screens that present an overview of the user account or profile.'
    WHEN 'account-setup'
      THEN 'Screens that guide initial configuration of a profile or workspace.'
    WHEN 'guided-tour-tutorial'
      THEN 'Screens that introduce product features through guided instruction.'
    WHEN 'home'
      THEN 'Screens that present primary content or key product destinations.'
    WHEN 'dashboard'
      THEN 'Screens that summarize important data, status, and actions.'
    ELSE 'Screens centered on ' || lower(seed.name) || '.'
  END,
  seed.aliases, seed.position
FROM seed
JOIN screen_pattern_sections section ON section.slug = seed.section_slug;

CREATE OR REPLACE FUNCTION normalize_screen_pattern_text(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(regexp_replace(lower(COALESCE(value, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION screen_pattern_matches_analysis(
  pattern_name TEXT,
  pattern_aliases TEXT[],
  analysis JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH evidence AS (
    SELECT
      normalize_screen_pattern_text(analysis->>'pageType') AS page_type,
      normalize_screen_pattern_text(analysis->>'productArea') AS product_area,
      normalize_screen_pattern_text(concat_ws(' ',
        analysis->>'pageType',
        analysis->>'productArea',
        analysis->>'purpose',
        analysis->>'description'
      )) AS all_text,
      normalize_screen_pattern_text(pattern_name) AS normalized_name
  ),
  terms AS (
    SELECT normalize_screen_pattern_text(term) AS value
    FROM unnest(array_append(COALESCE(pattern_aliases, '{}'), pattern_name)) term
  )
  SELECT evidence.page_type = evidence.normalized_name
    OR evidence.product_area = evidence.normalized_name
    OR EXISTS (
      SELECT 1
      FROM terms
      WHERE length(terms.value) >= 3
        AND (' ' || evidence.all_text || ' ')
          LIKE ('% ' || terms.value || ' %')
    )
  FROM evidence;
$$;

INSERT INTO screen_pattern_assignments (
  image_id, screen_pattern_id, source, confidence
)
SELECT image.id, pattern.id, 'analysis',
  LEAST(GREATEST(COALESCE(
    CASE
      WHEN jsonb_typeof(image.analysis->'confidence') = 'number'
        THEN (image.analysis->>'confidence')::double precision
    END,
    0.5
  ), 0), 1)
FROM images image
CROSS JOIN screen_patterns pattern
WHERE image.kind = 'screen'
  AND image.analysis IS NOT NULL
  AND screen_pattern_matches_analysis(
    pattern.name,
    pattern.aliases,
    image.analysis
  )
ON CONFLICT (image_id, screen_pattern_id) DO NOTHING;

CREATE OR REPLACE FUNCTION refresh_screen_pattern_previews(
  target_version_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public_facet_previews
  WHERE version_id = target_version_id
    AND facet_group = 'screens';

  WITH ranked AS (
    SELECT vi.version_id, pattern.name AS facet_value,
      assignment.image_id,
      ROW_NUMBER() OVER (
        PARTITION BY pattern.id
        ORDER BY assignment.confidence DESC,
          vi.captured_at DESC NULLS LAST,
          assignment.image_id DESC
      ) AS rank
    FROM version_images vi
    JOIN screen_pattern_assignments assignment
      ON assignment.image_id = vi.image_id
    JOIN screen_patterns pattern
      ON pattern.id = assignment.screen_pattern_id
    JOIN images image
      ON image.id = assignment.image_id
     AND image.kind = 'screen'
    WHERE vi.version_id = target_version_id
      AND EXISTS (
        SELECT 1
        FROM stored_objects object
        WHERE object.object_key = COALESCE(
          image.thumbnail_object_key,
          image.object_key
        )
          AND object.access_class IN ('protected', 'public-preview')
      )
  )
  INSERT INTO public_facet_previews (
    version_id, facet_group, facet_value, rank, image_id
  )
  SELECT version_id, 'screens', facet_value, rank::integer, image_id
  FROM ranked
  WHERE rank <= 3;
END;
$$;

DELETE FROM public_facet_previews WHERE facet_group = 'screens';

WITH ranked AS (
  SELECT vi.version_id, pattern.name AS facet_value,
    assignment.image_id,
    ROW_NUMBER() OVER (
      PARTITION BY vi.version_id, pattern.id
      ORDER BY assignment.confidence DESC,
        vi.captured_at DESC NULLS LAST,
        assignment.image_id DESC
    ) AS rank
  FROM version_images vi
  JOIN screen_pattern_assignments assignment
    ON assignment.image_id = vi.image_id
  JOIN screen_patterns pattern
    ON pattern.id = assignment.screen_pattern_id
  JOIN images image
    ON image.id = assignment.image_id
   AND image.kind = 'screen'
  WHERE EXISTS (
    SELECT 1
    FROM stored_objects object
    WHERE object.object_key = COALESCE(
      image.thumbnail_object_key,
      image.object_key
    )
      AND object.access_class IN ('protected', 'public-preview')
  )
)
INSERT INTO public_facet_previews (
  version_id, facet_group, facet_value, rank, image_id
)
SELECT version_id, 'screens', facet_value, rank::integer, image_id
FROM ranked
WHERE rank <= 3;

CREATE OR REPLACE FUNCTION sync_screen_pattern_assignments_from_analysis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_version RECORD;
BEGIN
  DELETE FROM screen_pattern_assignments
  WHERE image_id = NEW.id
    AND source = 'analysis';

  IF NEW.kind = 'screen' AND NEW.analysis IS NOT NULL THEN
    INSERT INTO screen_pattern_assignments (
      image_id, screen_pattern_id, source, confidence
    )
    SELECT NEW.id, pattern.id, 'analysis',
      LEAST(GREATEST(COALESCE(
        CASE
          WHEN jsonb_typeof(NEW.analysis->'confidence') = 'number'
            THEN (NEW.analysis->>'confidence')::double precision
        END,
        0.5
      ), 0), 1)
    FROM screen_patterns pattern
    WHERE screen_pattern_matches_analysis(
      pattern.name,
      pattern.aliases,
      NEW.analysis
    )
    ON CONFLICT (image_id, screen_pattern_id) DO UPDATE SET
      source = CASE
        WHEN screen_pattern_assignments.source = 'manual'
          THEN screen_pattern_assignments.source
        ELSE EXCLUDED.source
      END,
      confidence = CASE
        WHEN screen_pattern_assignments.source = 'manual'
          THEN screen_pattern_assignments.confidence
        ELSE EXCLUDED.confidence
      END,
      updated_at = now();
  END IF;

  FOR target_version IN
    SELECT DISTINCT version_id
    FROM version_images
    WHERE image_id = NEW.id
  LOOP
    PERFORM refresh_screen_pattern_previews(target_version.version_id);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_screen_patterns_after_analysis
AFTER INSERT OR UPDATE OF analysis, kind ON images
FOR EACH ROW
EXECUTE FUNCTION sync_screen_pattern_assignments_from_analysis();

CREATE OR REPLACE FUNCTION refresh_screen_patterns_after_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NOT NULL THEN
    PERFORM refresh_screen_pattern_previews(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_refresh_screen_patterns_on_publish
AFTER UPDATE OF status, published_at ON app_versions
FOR EACH ROW
WHEN (NEW.status = 'published' AND NEW.published_at IS NOT NULL)
EXECUTE FUNCTION refresh_screen_patterns_after_publication();
