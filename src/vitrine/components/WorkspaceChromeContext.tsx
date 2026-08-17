import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Button, Heading, Text, TextInput } from '@astryxdesign/core';
import {
  CheckIcon,
  PlusIcon,
  SwitchAltIcon,
  UserIcon,
  UsersIcon,
} from '@storybook/icons';
import {
  WorkspaceShell,
  type WorkspaceHeaderMenu,
  type WorkspaceNavSlots,
  type WorkspaceRailProps,
} from './WorkspaceChrome.tsx';
import {
  createTeam,
  listTeams,
  type TeamSummary,
} from '../organizationsApi.ts';
import { navigate } from '../router.ts';
import { AstryxModal } from './AstryxModal.tsx';

/*
 * The workspace shell mounts ONCE, above the router outlet, so moving between
 * Projects / Collections / Settings swaps only the panel content — the rail keeps
 * its DOM node instead of unmounting with the page it used to live inside.
 *
 * Pages no longer render a shell: each publishes its chrome through
 * `useWorkspaceChrome`, and the provider renders it around the current page.
 */
export interface WorkspaceChromeConfig {
  variant?: 'projects' | 'settings';
  className?: string;
  workspace?: WorkspaceRailProps['workspace'];
  nav: WorkspaceNavSlots;
  onBrandSelect: () => void;
  railFooter?: ReactNode;
  drawer?: ReactNode;
  sideNav?: ReactNode;
  menu?: WorkspaceHeaderMenu;
  headerContent?: ReactNode;
  headerActions?: ReactNode;
  searching?: boolean;
  dataset?: Record<`data-${string}`, string>;
}

/* A render function keeps page-owned ReactNodes out of provider state. */
type ChromeRenderer = () => WorkspaceChromeConfig;

interface ProjectsWorkspaceState {
  teams: TeamSummary[];
  selectedTeamId?: number;
  selectedTeam?: TeamSummary;
  setTeams: Dispatch<SetStateAction<TeamSummary[]>>;
  setSelectedTeamId: Dispatch<SetStateAction<number | undefined>>;
  openCreateTeam: () => void;
  workspace: NonNullable<WorkspaceRailProps['workspace']>;
  drawer: ReactNode;
}

const ProjectsWorkspace = createContext<ProjectsWorkspaceState | null>(null);

export function useProjectsWorkspace() {
  return useContext(ProjectsWorkspace);
}

export function ProjectsWorkspaceProvider({
  enabled = true,
  initialTeams = [],
  children,
}: {
  enabled?: boolean;
  initialTeams?: TeamSummary[];
  children: ReactNode;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [teamsLoaded, setTeamsLoaded] = useState(initialTeams.length > 0);
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || teamsLoaded) return;
    const controller = new AbortController();
    void listTeams()
      .then((nextTeams) => {
        if (!controller.signal.aborted) setTeams(nextTeams);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setTeamsLoaded(true);
      });
    return () => controller.abort();
  }, [enabled, teamsLoaded]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    requestAnimationFrame(() => menuRef.current?.querySelector('button')?.focus());
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const selectedTeam = teams.find(({ id }) => id === selectedTeamId);
  const selectWorkspace = (teamId?: number) => {
    setSelectedTeamId(teamId);
    setMenuOpen(false);
    navigate({ name: 'projects' });
  };
  const submitTeam = async () => {
    const name = newTeamName.trim();
    if (!name || creatingTeam) return;
    setCreatingTeam(true);
    setTeamError('');
    try {
      const created = await createTeam(name);
      setTeams((current) => [
        ...current.filter(({ id }) => id !== created.id),
        created,
      ]);
      setSelectedTeamId(created.id);
      setNewTeamName('');
      setCreateOpen(false);
      navigate({ name: 'projects' });
    } catch (cause) {
      setTeamError((cause as Error).message);
    } finally {
      setCreatingTeam(false);
    }
  };

  const workspaceName = selectedTeam?.name ?? 'Personal';
  const workspace: NonNullable<WorkspaceRailProps['workspace']> = {
    label: 'Switch Team',
    name: workspaceName,
    initial: workspaceName.charAt(0).toUpperCase(),
    icon: <SwitchAltIcon aria-hidden="true" />,
    expanded: menuOpen,
    buttonRef: triggerRef,
    onSelect: () => setMenuOpen((open) => !open),
  };
  const drawer = (
    <div
      className={`projects-workspace__drawer-layer${menuOpen ? ' is-open' : ''}`}
      aria-hidden={!menuOpen}
    >
      <button
        type="button"
        className="projects-workspace__drawer-backdrop"
        aria-label="Close Team menu"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        ref={menuRef}
        className="projects-team-drawer"
        role="menu"
        aria-label="Switch workspace"
      >
        <header className="projects-team-drawer__header">
          <strong>Workspaces</strong>
          <small>Choose where projects live</small>
        </header>
        <section
          className="projects-team-switcher__spaces"
          aria-label="Switch workspace"
        >
          <button
            type="button"
            className={!selectedTeamId ? 'is-active' : ''}
            aria-current={!selectedTeamId ? 'true' : undefined}
            role="menuitemradio"
            aria-checked={!selectedTeamId}
            onClick={() => selectWorkspace()}
          >
            <UserIcon aria-hidden="true" />
            <span>Personal</span>
            {!selectedTeamId ? (
              <CheckIcon
                className="projects-team-switcher__check"
                aria-hidden="true"
              />
            ) : null}
          </button>
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              className={selectedTeamId === team.id ? 'is-active' : ''}
              aria-current={selectedTeamId === team.id ? 'true' : undefined}
              role="menuitemradio"
              aria-checked={selectedTeamId === team.id}
              onClick={() => selectWorkspace(team.id)}
            >
              <UsersIcon aria-hidden="true" />
              <span>{team.name}</span>
              {selectedTeamId === team.id ? (
                <CheckIcon
                  className="projects-team-switcher__check"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ))}
        </section>
        <div className="projects-team-drawer__divider" />
        <button
          type="button"
          className="projects-team-switcher__create"
          role="menuitem"
          onClick={() => {
            setMenuOpen(false);
            setTeamError('');
            setCreateOpen(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          <span>Create Team</span>
        </button>
      </aside>
    </div>
  );

  const value = useMemo<ProjectsWorkspaceState>(
    () => ({
      teams,
      selectedTeamId,
      selectedTeam,
      setTeams,
      setSelectedTeamId,
      openCreateTeam: () => setCreateOpen(true),
      workspace,
      drawer,
    }),
    [drawer, selectedTeam, selectedTeamId, teams, workspace],
  );

  return (
    <ProjectsWorkspace.Provider value={value}>
      {children}
      <AstryxModal
        className="projects-workspace__modal"
        isOpen={createOpen}
        onOpenChange={(open) => {
          if (!open && !creatingTeam) setCreateOpen(false);
        }}
        purpose="form"
        width={440}
      >
        <form
          className="projects-workspace__dialog"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTeam();
          }}
        >
          <div>
            <Heading level={3}>Create Team</Heading>
            <Text color="secondary">
              Bring people and shared Projects into one Team.
            </Text>
          </div>
          <TextInput
            label="Team name"
            placeholder="e.g. Product design"
            value={newTeamName}
            onChange={setNewTeamName}
            autoFocus
            width="100%"
            isDisabled={creatingTeam}
          />
          {teamError ? <p role="alert">{teamError}</p> : null}
          <div className="projects-workspace__dialog-actions">
            <Button
              label="Cancel"
              variant="ghost"
              isDisabled={creatingTeam}
              clickAction={() => setCreateOpen(false)}
            />
            <Button
              label="Create Team"
              variant="primary"
              isDisabled={!newTeamName.trim()}
              isLoading={creatingTeam}
              clickAction={submitTeam}
            />
          </div>
        </form>
      </AstryxModal>
    </ProjectsWorkspace.Provider>
  );
}

const PublishChrome = createContext<(renderer: ChromeRenderer | null) => void>(
  () => undefined,
);

export function WorkspaceChromeProvider({
  enabled = true,
  headerActions,
  children,
}: {
  /*
   * Whether the current route is a workspace surface. The last published chrome
   * is retained while `enabled` stays true, so a lazy page that suspends between
   * unmount and mount cannot blank the rail; routes outside the workspace pass
   * false and get their children rendered bare.
   */
  enabled?: boolean;
  /* App-level controls (search, help, notifications, account) stay stable while
     project routes swap the content inside the shared shell. */
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const projectsWorkspace = useProjectsWorkspace();
  const [renderer, setRenderer] = useState<ChromeRenderer | null>(null);
  // Wrapped in a thunk so React stores the function instead of calling it as an updater.
  const publish = useCallback(
    (next: ChromeRenderer | null) => setRenderer(next ? () => next : null),
    [],
  );
  const publishedConfig = enabled ? renderer?.() : undefined;
  const config = publishedConfig
    ? {
        ...publishedConfig,
        ...(projectsWorkspace
          ? {
              workspace: projectsWorkspace.workspace,
              drawer: projectsWorkspace.drawer,
            }
          : {}),
        headerActions: publishedConfig.headerActions ?? headerActions,
      }
    : undefined;

  return (
    <PublishChrome.Provider value={publish}>
      {config ? (
        <WorkspaceShell {...config}>{children}</WorkspaceShell>
      ) : (
        children
      )}
    </PublishChrome.Provider>
  );
}

/**
 * Publish this page's chrome to the hoisted shell.
 *
 * `renderer` runs during the provider's render, so keep it cheap and pure.
 * `deps` are the primitives the chrome varies on — keep ReactNodes out of them
 * or the effect republishes on every render.
 */
export function useWorkspaceChrome(
  renderer: ChromeRenderer,
  deps: readonly unknown[],
) {
  const publish = useContext(PublishChrome);
  useEffect(() => {
    publish(renderer);
    // Deliberately no cleanup: a lazy sibling page can suspend between this
    // page unmounting and the next one publishing, and clearing here would
    // unmount the rail in that gap. The provider's `enabled` flag is what
    // takes the chrome down when the route leaves the workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publish, ...deps]);
}
