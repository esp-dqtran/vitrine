import { useState, type ReactNode, type Ref } from 'react';

export interface WorkspaceRailAction {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onSelect?: () => void;
  /* Nested destinations, indented under the row while `expanded` is true —
     Projects → a project → its areas. Renders recursively, but the rail is
     200px wide, so keep real trees shallow. */
  children?: WorkspaceRailAction[];
  expanded?: boolean;
  /* Right-aligned control on the row itself (the project settings cog). Kept
     outside the row button — a button cannot nest inside a button. */
  trailing?: ReactNode;
}

export interface WorkspaceRailProps {
  /* Omit entirely on surfaces that have neither a switcher to open nor a name
     worth repeating — Admin says "Admin" in the page title already. */
  workspace?: {
    label: string;
    initial: string;
    /* Display name for the switcher row; `label` stays the action description. */
    name?: string;
    expanded?: boolean;
    buttonRef?: Ref<HTMLButtonElement>;
    onSelect: () => void;
  };
  /* The nav group's accessible name only — the rail shows no visible caption. */
  primaryLabel: string;
  primaryActions: WorkspaceRailAction[];
  /* Footer action. Omit it and the rail ends after the nav — Admin does, and
     reaches the rest of the app through the brand link instead. */
  settings?: WorkspaceRailAction;
  /* Extra rail footer content, rendered under the footer action. */
  footer?: ReactNode;
  /* The Vitrines mark lives at the top of the rail; the header only shows it at
     compact widths, where the rail is replaced by the drawer. */
  onBrandSelect?: () => void;
}

/* What workspaceNav() hands to the rail. */
export type WorkspaceNavSlots = Pick<
  WorkspaceRailProps,
  'primaryLabel' | 'primaryActions' | 'settings'
>;

export interface WorkspaceHeaderMenu {
  label: string;
  expanded: boolean;
  icon: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
  onSelect: () => void;
}

export function WorkspaceRail({
  workspace,
  primaryLabel,
  primaryActions,
  settings,
  footer,
  onBrandSelect,
}: WorkspaceRailProps) {
  /*
   * Open/closed lives here, not in the pages. The config's `expanded` is only
   * the default — the route says which branch is worth opening — and a reader's
   * own toggle overrides it. Keeping it in the rail means the folding survives
   * a page republishing its chrome, and no page has to own navigation-chrome
   * state it never reads.
   */
  const [folds, setFolds] = useState<Record<string, boolean>>({});
  const isExpanded = (action: WorkspaceRailAction) =>
    folds[action.label] ?? Boolean(action.expanded);

  const renderRow = (action: WorkspaceRailAction) => {
    const expanded = isExpanded(action);
    return (
      <>
        {/* A separate control, because it does a different thing to the row —
            and because a button cannot nest inside a button. */}
        {action.children?.length ? (
          <button
            type="button"
            className="projects-workspace__desktop-row-caret"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${action.label}`}
            aria-expanded={expanded}
            onClick={() => setFolds((open) => ({ ...open, [action.label]: !expanded }))}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2.5 4.5L6 8l3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          className={[
            'projects-workspace__desktop-row-link',
            action.active ? 'is-active' : null,
          ].filter(Boolean).join(' ')}
          aria-current={action.active ? 'page' : undefined}
          onClick={action.onSelect}
        >
          {action.icon}<span>{action.label}</span>
        </button>
      </>
    );
  };

  const renderAction = (action: WorkspaceRailAction) => (
    <div
      key={action.label}
      /* `has-children` / `is-open` are what the compact bar keys off to flatten
         the tree down to the path you are on — see projectsWorkspace.css. */
      className={[
        'projects-workspace__desktop-row',
        action.children?.length ? 'has-children' : null,
        isExpanded(action) ? 'is-open' : null,
      ].filter(Boolean).join(' ')}
    >
      <div className="projects-workspace__desktop-row-line">
        {renderRow(action)}
        {action.trailing}
      </div>
      {action.children?.length && isExpanded(action) ? (
        <div className="projects-workspace__desktop-subnav">
          {action.children.map(renderAction)}
        </div>
      ) : null}
    </div>
  );

  return (
    <aside className="projects-workspace__desktop-rail" aria-label="Workspace navigation">
      {onBrandSelect ? (
        <a
          href="/projects"
          className="projects-workspace__rail-brand"
          aria-label="Vitrines Projects"
          onClick={(event) => {
            event.preventDefault();
            onBrandSelect();
          }}
        >
          <img src="/favicon.svg" alt="" aria-hidden="true" />
          <strong>Vitrines</strong>
        </a>
      ) : null}
      {/*
        * Only a surface that owns a menu (it passes `expanded`) gets a button and
        * a caret. Everywhere else this is a plain identity row: a caret with no
        * menu behind it read as a dropdown and, on Admin, navigated away instead.
        */}
      {!workspace ? null : workspace.expanded === undefined ? (
        <div className="projects-workspace__desktop-workspace projects-workspace__desktop-workspace--static">
          <span className="projects-team-rail__avatar" aria-hidden="true">{workspace.initial}</span>
          {workspace.name ? (
            <span className="projects-workspace__desktop-workspace-name">{workspace.name}</span>
          ) : null}
        </div>
      ) : (
        <button
          ref={workspace.buttonRef}
          type="button"
          className="projects-workspace__desktop-workspace"
          aria-label={workspace.label}
          aria-expanded={workspace.expanded}
          onClick={workspace.onSelect}
        >
          <span className="projects-team-rail__avatar" aria-hidden="true">{workspace.initial}</span>
          {workspace.name ? (
            <span className="projects-workspace__desktop-workspace-name">{workspace.name}</span>
          ) : null}
          <svg
            className="projects-workspace__desktop-workspace-caret"
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 4.5L6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <nav className="projects-workspace__desktop-nav projects-workspace__desktop-nav--primary" aria-label={primaryLabel}>
        {primaryActions.map(renderAction)}
      </nav>
      {settings || footer ? (
        <div className="projects-workspace__desktop-footer">
          <span className="projects-workspace__desktop-divider" aria-hidden="true" />
          {settings ? (
            <button
              type="button"
              className={`projects-workspace__desktop-settings${settings.active ? ' is-active' : ''}`}
              aria-label={settings.label}
              aria-current={settings.active ? 'page' : undefined}
              onClick={settings.onSelect}
            >
              {settings.icon}<span>{settings.label}</span>
            </button>
          ) : null}
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

export function WorkspaceHeader({
  variant,
  searching = false,
  menu,
  onBrandSelect,
  children,
  actions,
}: {
  variant: 'projects' | 'settings';
  searching?: boolean;
  menu: WorkspaceHeaderMenu;
  onBrandSelect: () => void;
  children?: ReactNode;
  actions: ReactNode;
}) {
  const headerClassName = variant === 'projects'
    ? `projects-workspace__context-bar${searching ? ' is-searching' : ''}`
    : 'settings-workspace__header';
  const menuClassName = variant === 'projects'
    ? 'projects-workspace__drawer-trigger'
    : 'settings-workspace__menu-trigger';
  const brandClassName = variant === 'projects'
    ? 'projects-workspace__brand'
    : 'settings-workspace__brand';
  const actionsClassName = variant === 'projects'
    ? 'projects-workspace__header-actions'
    : 'settings-workspace__header-actions';
  const content = (
    <>
      <button
        ref={menu.buttonRef}
        type="button"
        className={menuClassName}
        aria-label={menu.label}
        aria-expanded={menu.expanded}
        onClick={menu.onSelect}
      >
        {menu.icon}
      </button>
      <a
        href="/projects"
        className={brandClassName}
        aria-label="Vitrines Projects"
        onClick={(event) => {
          event.preventDefault();
          onBrandSelect();
        }}
      >
        <img src="/favicon.svg" alt="" aria-hidden="true" />
        <strong>Vitrines</strong>
      </a>
      {children}
      <div className={actionsClassName}>{actions}</div>
    </>
  );

  return variant === 'projects'
    ? <div className={headerClassName}>{content}</div>
    : <header className={headerClassName}>{content}</header>;
}

/*
 * One page skeleton for every workspace surface: left rail + content panel.
 * Pages own their content and their rail config; the DOM structure, class names,
 * and drawer plumbing live here so they stop being copied.
 */
export function WorkspaceShell({
  variant = 'projects',
  className,
  workspace,
  nav,
  railFooter,
  onBrandSelect,
  menu,
  headerContent,
  headerActions,
  searching,
  drawer,
  sideNav,
  dataset,
  children,
}: {
  variant?: 'projects' | 'settings';
  className?: string;
  workspace?: WorkspaceRailProps['workspace'];
  nav: WorkspaceNavSlots;
  railFooter?: ReactNode;
  onBrandSelect: () => void;
  /* Settings-variant header only; the projects surfaces have no header bar. */
  menu?: WorkspaceHeaderMenu;
  headerContent?: ReactNode;
  headerActions?: ReactNode;
  searching?: boolean;
  /* Compact-width drawer layer, rendered as a sibling of the rail. */
  drawer?: ReactNode;
  /* Settings keeps a second, section-level nav beside its content. */
  sideNav?: ReactNode;
  /* Surface markers some tests and styles hook onto (e.g. data-admin-dashboard). */
  dataset?: Record<`data-${string}`, string>;
  children: ReactNode;
}) {
  const rail = (
    <WorkspaceRail
      workspace={workspace}
      {...nav}
      footer={railFooter}
      onBrandSelect={onBrandSelect}
    />
  );

  if (variant === 'settings') {
    return (
      <main className={['settings-workspace', className].filter(Boolean).join(' ')} {...dataset}>
        {rail}
        <WorkspaceHeader
          variant="settings"
          searching={searching}
          menu={menu as WorkspaceHeaderMenu}
          onBrandSelect={onBrandSelect}
          actions={headerActions}
        >
          {headerContent}
        </WorkspaceHeader>
        {drawer}
        <div className="settings-workspace__body">
          {sideNav}
          {children}
        </div>
      </main>
    );
  }

  return (
    <main
      className={['vitrine-page', 'projects-workspace', className].filter(Boolean).join(' ')}
      {...dataset}
    >
      {rail}
      {drawer}
      <div className="projects-workspace__shell">
        <section className="projects-workspace__main">
          {children}
        </section>
      </div>
    </main>
  );
}
