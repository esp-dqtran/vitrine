import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  WorkspaceShell,
  type WorkspaceHeaderMenu,
  type WorkspaceNavSlots,
  type WorkspaceRailProps,
} from './WorkspaceChrome.tsx';

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
  workspace: WorkspaceRailProps['workspace'];
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

const PublishChrome = createContext<(renderer: ChromeRenderer | null) => void>(
  () => undefined,
);

export function WorkspaceChromeProvider({
  enabled = true,
  children,
}: {
  /*
   * Whether the current route is a workspace surface. The last published chrome
   * is retained while `enabled` stays true, so a lazy page that suspends between
   * unmount and mount cannot blank the rail; routes outside the workspace pass
   * false and get their children rendered bare.
   */
  enabled?: boolean;
  children: ReactNode;
}) {
  const [renderer, setRenderer] = useState<ChromeRenderer | null>(null);
  // Wrapped in a thunk so React stores the function instead of calling it as an updater.
  const publish = useCallback(
    (next: ChromeRenderer | null) => setRenderer(next ? () => next : null),
    [],
  );
  const config = enabled ? renderer?.() : undefined;

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
