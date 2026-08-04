import type { ReactNode, Ref } from 'react';

export interface WorkspaceRailAction {
  label: string;
  icon: ReactNode;
  active?: boolean;
  href?: string;
  onSelect?: () => void;
}

export function WorkspaceRail({
  workspace,
  quickAction,
  primaryLabel,
  primaryActions,
  secondaryLabel,
  secondaryActions = [],
  settings,
}: {
  workspace: {
    label: string;
    initial: string;
    expanded?: boolean;
    buttonRef?: Ref<HTMLButtonElement>;
    onSelect: () => void;
  };
  quickAction?: WorkspaceRailAction;
  primaryLabel: string;
  primaryActions: WorkspaceRailAction[];
  secondaryLabel?: string;
  secondaryActions?: WorkspaceRailAction[];
  settings: WorkspaceRailAction;
}) {
  const renderAction = (action: WorkspaceRailAction, destination = false) => {
    const content = <>{action.icon}<span>{action.label}</span></>;
    if (action.href) {
      return (
        <a
          key={action.label}
          href={action.href}
          className={destination ? 'projects-workspace__desktop-destination' : action.active ? 'is-active' : undefined}
          aria-current={action.active ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            action.onSelect?.();
          }}
        >
          {content}
        </a>
      );
    }
    return (
      <button
        key={action.label}
        type="button"
        className={action.active ? 'is-active' : undefined}
        aria-current={action.active ? 'page' : undefined}
        onClick={action.onSelect}
      >
        {content}
      </button>
    );
  };

  return (
    <aside className="projects-workspace__desktop-rail" aria-label="Workspace navigation">
      <button
        ref={workspace.buttonRef}
        type="button"
        className="projects-workspace__desktop-workspace"
        aria-label={workspace.label}
        aria-expanded={workspace.expanded}
        onClick={workspace.onSelect}
      >
        <span className="projects-team-rail__avatar" aria-hidden="true">{workspace.initial}</span>
      </button>
      {quickAction ? (
        <button
          type="button"
          className="projects-workspace__desktop-quick-action"
          aria-label={quickAction.label}
          title={quickAction.label}
          onClick={quickAction.onSelect}
        >
          {quickAction.icon}
        </button>
      ) : null}
      <nav className="projects-workspace__desktop-nav projects-workspace__desktop-nav--primary" aria-label={primaryLabel}>
        {primaryActions.map((action) => renderAction(action))}
      </nav>
      {secondaryActions.length > 0 ? (
        <>
          <span className="projects-workspace__desktop-divider" aria-hidden="true" />
          <nav className="projects-workspace__desktop-nav projects-workspace__desktop-nav--secondary" aria-label={secondaryLabel}>
            {secondaryActions.map((action) => renderAction(action, true))}
          </nav>
        </>
      ) : null}
      <div className="projects-workspace__desktop-footer">
        <span className="projects-workspace__desktop-divider" aria-hidden="true" />
        <button
          type="button"
          className={`projects-workspace__desktop-settings${settings.active ? ' is-active' : ''}`}
          aria-label={settings.label}
          aria-current={settings.active ? 'page' : undefined}
          onClick={settings.onSelect}
        >
          {settings.icon}<span>Settings</span>
        </button>
      </div>
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
  menu: {
    label: string;
    expanded: boolean;
    icon: ReactNode;
    buttonRef?: Ref<HTMLButtonElement>;
    onSelect: () => void;
  };
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
