import {
  BookmarkHollowIcon,
  CogIcon,
  FolderIcon,
  GraphLineIcon,
  UsersIcon,
} from '@storybook/icons';
import type { ReactNode } from 'react';
import { navigate } from '../router.ts';
import type { WorkspaceRailAction } from './WorkspaceChrome.tsx';

// One nav definition for every WorkspaceRail. Each surface used to redeclare the
// same Projects/Collections/Apps/Sites items and drift on labels and active state.
export type WorkspaceNavSection =
  | 'projects'
  | 'collections'
  | 'users'
  | 'insights'
  | 'settings';

export function workspaceNav({
  active,
  /* Accessible name for the nav group; the rail renders no visible caption. */
  label = 'Workspace',
  onProjects = () => navigate({ name: 'projects' }),
  settingsLabel = 'Settings',
  settingsIcon,
  onSettings = () => navigate({ name: 'settings-billing' }),
  admin = false,
  onUsers = () => navigate({ name: 'admin' }),
  onInsights = () => navigate({ name: 'admin' }),
}: {
  active?: WorkspaceNavSection;
  label?: string;
  onProjects?: () => void;
  settingsLabel?: string;
  /* Footer action icon; defaults to the cog, which only fits a settings action. */
  settingsIcon?: ReactNode;
  /* `null` drops the footer action entirely, leaving the rail to end at the nav. */
  onSettings?: (() => void) | null;
  admin?: boolean;
  /* Admin section handlers; the dashboard keeps its section in local state. */
  onUsers?: () => void;
  onInsights?: () => void;
} = {}): {
  primaryLabel: string;
  primaryActions: WorkspaceRailAction[];
  settings?: WorkspaceRailAction;
} {
  return {
    primaryLabel: label,
    primaryActions: admin
      ? [
          {
            label: 'Users',
            icon: <UsersIcon aria-hidden="true" />,
            active: active === 'users',
            onSelect: onUsers,
          },
          {
            label: 'Insights',
            icon: <GraphLineIcon aria-hidden="true" />,
            active: active === 'insights',
            onSelect: onInsights,
          },
        ]
      : [
          {
            label: 'Projects',
            icon: <FolderIcon aria-hidden="true" />,
            active: active === 'projects',
            onSelect: onProjects,
          },
          {
            label: 'Collections',
            icon: <BookmarkHollowIcon aria-hidden="true" />,
            active: active === 'collections',
            onSelect: () => navigate({ name: 'collections' }),
            children: [{
              label: 'All collections',
              icon: <BookmarkHollowIcon aria-hidden="true" />,
              active: active === 'collections',
              onSelect: () => navigate({ name: 'collections' }),
            }],
          },
        ],
    settings: onSettings === null ? undefined : {
      label: settingsLabel,
      icon: settingsIcon ?? <CogIcon aria-hidden="true" />,
      active: active === 'settings',
      onSelect: onSettings,
    },
  };
}
