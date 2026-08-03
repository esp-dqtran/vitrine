export const SPACING_SCALE = [
  { token: '--spacing-1', value: '4px', use: 'Icon offsets and metadata grouping' },
  { token: '--spacing-2', value: '8px', use: 'Related actions and compact control gaps' },
  { token: '--spacing-3', value: '12px', use: 'Control insets and compact card rhythm' },
  { token: '--spacing-4', value: '16px', use: 'Component padding and ordinary stacks' },
  { token: '--spacing-6', value: '24px', use: 'Page gutters and content groups' },
  { token: '--spacing-8', value: '32px', use: 'Section rhythm and spacious panels' },
  { token: '--spacing-12', value: '48px', use: 'Major region separation' },
] as const;

export const CONTROL_SIZE_SCALE = [
  {
    token: '--vitrine-control-height',
    value: '40px',
    use: 'Buttons and dropdown selectors across product screens',
  },
] as const;

export const ICON_SIZE_SCALE = [
  {
    token: '--vitrine-icon-size-inline',
    value: '16px',
    use: 'Icons beside labels, checks, close actions, and dropdown chevrons',
  },
  {
    token: '--vitrine-icon-size-control',
    value: '20px',
    use: 'Default icon-only controls and gallery navigation',
  },
  {
    token: '--vitrine-icon-size-emphasis',
    value: '24px',
    use: 'Navigation landmarks and deliberate visual emphasis',
  },
] as const;

export const MOTION_SCALE = [
  {
    token: '--vitrine-motion-fast',
    value: '120ms',
    use: 'Direct hover, press, focus, and selection feedback',
  },
  {
    token: '--vitrine-motion-medium',
    value: '180ms',
    use: 'Dropdowns, tooltips, and local state transitions',
  },
  {
    token: '--vitrine-motion-slow',
    value: '240ms',
    use: 'Dialogs, sheets, and deliberate context changes',
  },
] as const;

export const RESPONSIVE_RANGES = [
  {
    id: 'compact',
    range: '0–720px',
    columns: 1,
    gutter: '20px',
    use: 'Phones and narrow split views',
  },
  {
    id: 'medium',
    range: '721–1100px',
    columns: 2,
    gutter: '24px',
    use: 'Tablets and medium desktop windows',
  },
  {
    id: 'wide',
    range: '1101px and above',
    columns: 3,
    gutter: '32px',
    use: 'Wide desktop workspaces',
  },
] as const;

export const FORM_CONTROL_SCALE = [
  {
    token: '--vitrine-form-input-height',
    value: '48px',
    use: 'Editable single-line fields on wide and medium screens',
  },
  {
    token: '--vitrine-form-input-height-compact',
    value: '44px',
    use: 'Editable single-line fields on compact screens',
  },
  {
    token: '--vitrine-form-input-radius',
    value: '999px',
    use: 'The approved Apps Search shell for editable single-line fields',
  },
  {
    token: '--vitrine-form-input-padding-inline',
    value: '22px',
    use: 'Horizontal inset for editable single-line fields',
  },
  {
    token: '--vitrine-form-choice-size',
    value: '18px',
    use: 'Shared checkbox and radio control size',
  },
  {
    token: '--vitrine-form-switch-width',
    value: '40px',
    use: 'Shared switch track width',
  },
  {
    token: '--vitrine-form-switch-height',
    value: '24px',
    use: 'Shared switch track height',
  },
] as const;

export const UI_COMPONENT_STANDARD = {
  forms: {
    source: 'Vitrines Apps header Search',
    tokens: FORM_CONTROL_SCALE,
    policy:
      'Use the Apps header Search shell for editable single-line fields, share checkbox, radio, switch, validation, focus, and disabled states across product screens, preserve native input behavior, and keep editor or canvas geometry domain-owned.',
  },
} as const;

export const FOUNDATION_TOKEN_CONTRACT = {
  color: [
    '--vitrine-color-page',
    '--vitrine-color-surface',
    '--vitrine-color-surface-muted',
    '--vitrine-color-border',
    '--vitrine-color-border-emphasized',
    '--vitrine-color-text-primary',
    '--vitrine-color-text-secondary',
    '--vitrine-color-text-disabled',
    '--vitrine-color-action-primary',
    '--vitrine-color-on-action-primary',
    '--vitrine-color-status-success',
    '--vitrine-color-status-warning',
    '--vitrine-color-status-error',
  ],
  typography: [
    '--vitrine-font-family-sans',
    '--vitrine-font-family-code',
    '--vitrine-type-title',
    '--vitrine-type-action',
    '--vitrine-type-heading',
    '--vitrine-type-body',
    '--vitrine-type-label',
    '--vitrine-type-detail',
    '--vitrine-type-supporting',
    '--vitrine-type-micro',
    '--vitrine-type-code',
  ],
  spacing: SPACING_SCALE.map(({ token }) => token),
  size: CONTROL_SIZE_SCALE.map(({ token }) => token),
  iconography: [
    ...ICON_SIZE_SCALE.map(({ token }) => token),
    '--vitrine-icon-stroke-width',
    '--vitrine-icon-label-gap',
    '--vitrine-icon-button-size',
  ],
  shape: [
    '--radius-inner',
    '--radius-element',
    '--radius-container',
    '--radius-page',
    '--radius-full',
  ],
  elevation: ['--shadow-low', '--shadow-med', '--shadow-high'],
  motion: [
    ...MOTION_SCALE.map(({ token }) => token),
    '--vitrine-motion-ease',
    '--vitrine-transition-fast',
    '--vitrine-transition-standard',
    '--vitrine-transition-slow',
  ],
  responsive: [
    '--vitrine-breakpoint-compact-max',
    '--vitrine-breakpoint-medium-max',
    '--vitrine-page-gutter-compact',
    '--vitrine-page-gutter-medium',
    '--vitrine-page-gutter-wide',
  ],
} as const;

export const UI_FOUNDATION_AREAS = [
  {
    id: 'color',
    name: 'Semantic color',
    intent: 'Keep Vitrines neutral-first and readable in light and dark modes.',
    rules: [
      'Use semantic --color-* tokens in product UI; do not choose literal colors in a screen.',
      'Use black, white, and neutral surfaces for hierarchy. Success and warning use neutral text hierarchy; error is the chromatic exception.',
      'Pair foreground and background roles, then verify contrast in both themes.',
    ],
  },
  {
    id: 'typography',
    name: 'Typography',
    intent: 'Make hierarchy predictable across dense research and handoff workflows.',
    rules: [
      'Use Heading and Text roles before selecting a raw font size or weight.',
      'Use the body family for product copy and the code family only for technical values.',
      'Keep line length readable and use supporting text for metadata, never as low-contrast decoration.',
    ],
  },
  {
    id: 'spacing',
    name: 'Spacing and size',
    intent: 'Build rhythm from the shared scale instead of page-specific measurements.',
    rules: [
      'Use --spacing-* for gaps, padding, and margins. Choose the nearest scale value before adding a new token.',
      'Use --vitrine-control-height for standard buttons and dropdown selectors so adjacent actions align.',
      'Tabs and specialized editor or canvas controls keep their domain-owned geometry.',
    ],
  },
  {
    id: 'shape',
    name: 'Shape and elevation',
    intent: 'Communicate containment and layering without decorative noise.',
    rules: [
      'Nest radius roles: inner content inside elements, elements inside containers, containers inside pages.',
      'Use borders for ordinary separation and shadows only when an element is visually above another layer.',
      'Use --radius-full only for pills, avatars, and intentionally circular controls.',
    ],
  },
  {
    id: 'iconography',
    name: 'Iconography',
    intent: 'Make actions recognizable without introducing a second visual language.',
    rules: [
      'Use the shared outline icon registry with rounded caps and joins; do not mix icon families or substitute emoji.',
      'Use 16px beside text, 20px for ordinary icon-only controls, and 24px only for navigation or deliberate emphasis.',
      'Icon-only controls use the standard 40px control size and require both an accessible label and a tooltip.',
    ],
  },
  {
    id: 'motion',
    name: 'Motion',
    intent: 'Explain state changes without slowing down the work.',
    rules: [
      'Use fast motion for direct feedback, medium motion for local transitions, and slow motion only for major context changes.',
      'Prefer opacity and transform; avoid animating layout when a simpler transition communicates the change.',
      'Respect prefers-reduced-motion and keep the final state fully usable without animation.',
    ],
  },
  {
    id: 'responsive',
    name: 'Responsive behavior',
    intent: 'Preserve task priority from compact windows through wide workspaces.',
    rules: [
      'Reflow before hiding. Keep the primary task, context, and recovery action available at every width.',
      'Let content and containers drive wrapping; do not create a second visual language for mobile.',
      'Test narrow, medium, and wide states with real content, including long labels and empty results.',
    ],
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    intent: 'Make the system operable and understandable without relying on vision or pointer input.',
    rules: [
      'Every interactive element needs a visible focus state, an accessible name, and a semantic role.',
      'Use text or icon plus text for meaning; color alone never communicates status or selection.',
      'Preserve keyboard order, announce asynchronous feedback, and restore focus after overlays close.',
    ],
  },
] as const;

export const UI_FOUNDATION_STANDARD = {
  productName: 'Vitrines',
  theme: 'neutral',
  modes: ['light', 'dark'] as const,
  sourcePackage: '@astryxdesign/core',
  colorSource: 'Vitrines App detail',
  typographySource: 'Vitrines App Screen detail',
  spacingSource: 'Vitrines Apps, App detail, and Workspace',
  typographyPolicy:
    'Use Figtree across product UI with the compact App Screen detail roles for hierarchy. Large editorial display type is a presentation layer; imported reference typography and data-canvas labels remain domain evidence.',
  spacingPolicy:
    'Use the seven-step product scale for gaps, padding, and margins, choosing the nearest token before adding a measurement. The full internal scale remains available to shared component internals, not as a product design choice.',
  iconographySource: 'Vitrines App detail',
  iconographyPolicy:
    'Use one outline family with 16px inline, 20px control, and 24px emphasis sizes, a 2px rounded stroke, an 8px label gap, and accessible 40px icon-only controls. Brand marks and captured product evidence are not system icons.',
  motionSource: 'Vitrines product screens',
  motionPolicy:
    'Use 120ms for direct feedback, 180ms for local overlays and state changes, and 240ms for deliberate context changes. Use the shared expressive easing, animate opacity and transform where possible, and preserve a fully usable reduced-motion state.',
  responsiveSource: 'Vitrines Apps discovery',
  responsivePolicy:
    'Use compact through 720px, medium from 721px through 1100px, and wide above 1100px. Reflow before hiding, keep primary controls reachable, and verify real content without horizontal page overflow.',
  specializedColorPolicy:
    'Data visualization, syntax highlighting, and imported-reference palettes are domain implementation details, not product foundation choices.',
  areas: UI_FOUNDATION_AREAS,
  tokens: FOUNDATION_TOKEN_CONTRACT,
} as const;
