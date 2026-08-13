/**
 * Canonical screen taxonomy used by the Screens filter and search index.
 * `label` is the parent category; `children` are the selectable screen types
 * produced by Screen Analyze (`pageType`).
 */
export interface ScreenCategory {
  id: string;
  label: string;
  children: readonly string[];
}

export const SCREEN_CATEGORIES: readonly ScreenCategory[] = [
  {
    id: 'new-user-experience',
    label: 'New User Experience',
    children: ['Account Setup', 'Guided Tour & Tutorial', 'Signup', 'Verification'],
  },
  {
    id: 'account-management',
    label: 'Account Management',
    children: [
      'Delete & Deactivate Account', 'Forgot Password', 'Login',
      'My Account & Profile', 'Settings & Preferences',
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    children: [
      'Acknowledgement & Success', 'Action Option', 'Confirmation', 'Empty State',
      'Error', 'Feature Info', 'Feedback', 'Help & Support', 'Loading', 'Permission',
      'Suggestions & Similar Items',
    ],
  },
  {
    id: 'commerce-finance',
    label: 'Commerce & Finance',
    children: [
      'Billing', 'Cart & Bag', 'Checkout', 'Order Confirmation', 'Order Detail',
      'Order History', 'Payment Method', 'Pricing', 'Promotions & Rewards',
      'Shop & Storefront', 'Subscription & Paywall', 'Wallet & Balance',
    ],
  },
  {
    id: 'social',
    label: 'Social',
    children: [
      'Achievements & Awards', 'Chat Detail', 'Comments', 'Followers & Following',
      'Invite Teammates', 'Leaderboard', 'Notifications', 'Reviews & Ratings',
      'Social Feed', 'User / Group Profile',
    ],
  },
  {
    id: 'content',
    label: 'Content',
    children: [
      'Article Detail', 'Browse & Discover', 'Class & Lesson Detail', 'Code Editor',
      'Emails & Messages', 'Event Detail', 'Goal & Task', 'Home', 'News Feed',
      'Note Detail', 'Other Content', 'Post Detail', 'Product Detail', 'Quiz',
      'Recipe Detail', 'Song & Podcast Detail', 'Stories',
      'TV Show & Movie Detail',
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    children: [
      'Add & Create', 'Ban & Block', 'Cancel', 'Delete', 'Draw & Annotate', 'Edit',
      'Favorite & Pin', 'Filter & Sort', 'Flag & Report', 'Follow & Subscribe',
      'Import & Export', 'Invite & Refer Friends', 'Like & Upvote', 'Move',
      'Other Action', 'Publish', 'Reorder', 'Save', 'Schedule', 'Search', 'Select',
      'Set', 'Share', 'Transfer & Send Money', 'Upload & Download',
    ],
  },
  {
    id: 'data',
    label: 'Data',
    children: ['Charts', 'Dashboard', 'Progress'],
  },
  {
    id: 'user-collections',
    label: 'User Collections',
    children: ['Bookmarks & Collections', 'Playlists', 'Trash & Archive'],
  },
  {
    id: 'utility',
    label: 'Utility',
    children: [
      'Audio Player', 'Audio & Video Recorder', 'Calendar', 'Call', 'Canvas', 'Chat Bot',
      'Command Palette', 'Date & Time', 'Map', 'Media Editor', 'QR Code',
      'Timeline & History', 'Timer & Clock', 'Video Player',
    ],
  },
  {
    id: 'misc',
    label: 'Misc',
    children: ['Dark Mode', 'Internal Tool', 'Misc'],
  },
  {
    id: 'layouts',
    label: 'Layouts',
    children: ['Kanban Board', 'Multi-Column Layout'],
  },
];

// Kept searchable for already-classified Vitrines screens, but intentionally
// outside the imported parent/child taxonomy until they are reviewed.
export const LEGACY_SCREEN_TYPES = ['Preview', 'Wallpaper'] as const;

export const ALL_SCREEN_TYPES = [
  ...SCREEN_CATEGORIES.flatMap(({ children }) => children),
  ...LEGACY_SCREEN_TYPES,
];

const categoryByScreenType = new Map(
  SCREEN_CATEGORIES.flatMap((category) =>
    category.children.map((type) => [type.toLocaleLowerCase(), category] as const)),
);

export function screenCategoryForType(type: string | null | undefined): ScreenCategory | undefined {
  return type ? categoryByScreenType.get(type.trim().toLocaleLowerCase()) : undefined;
}
