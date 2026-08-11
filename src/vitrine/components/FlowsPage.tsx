import {
  useMemo,
  type ReactNode,
} from 'react';
import { Button } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl.ts';
import type { FlowCatalogItem } from '../flowCatalogApi.ts';
import {
  createFlowsDiscoveryAdapter,
  type FlowsDiscoveryControllerState,
  type FlowsDiscoverySort,
} from '../flowsDiscoveryAdapter.ts';
import { updateLocation, useLocationKey } from '../router.ts';
import {
  useDiscoveryController,
  type DiscoveryController,
  type DiscoveryObserverFactory,
} from '../useDiscoveryController.ts';
import {
  DiscoveryFilterBar,
  type DiscoveryFilterGroup,
} from './AppsFilterBar.tsx';
import { DiscoveryPageLayout } from './DiscoveryPageLayout.tsx';
import { FlowGallery } from './FlowGallery.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';
import type { FlowTreeGroup } from '../flowTree.ts';
import { PUBLIC_CATALOG_GUEST_LIMIT } from '../../publicCatalogAccess.ts';

function catalogFlowTitle(item: FlowCatalogItem): string {
  if (
    item.category === 'Other Flows'
    || item.category.trim().toLowerCase() === item.title.trim().toLowerCase()
  ) {
    return item.title;
  }
  return `${item.title} from ${item.category}`;
}

const FLOW_GROUPS_TAXONOMY = ['Settings', 'Home', 'Account settings', 'Onboarding', 'Logging in'];

// Full Flow values (from `/api/flows/facets`), used to seed the toolbar filter
// dropdown so it doesn't need a live facet query. FLOW_GROUPS_TAXONOMY above stays a
// short curated list for the taxonomy quick-links panel.
const ALL_FLOW_GROUPS = [
  'Account', 'Account settings', 'Accounts', 'Activity', 'Adding a card', 'Adding a comment',
  'Adding a description', 'Adding a note', 'Adding a page', 'Adding a product',
  'Adding a table', 'Adding a task', 'Adding a text', 'Adding an image', 'Admin',
  'Admin console', 'Agent details', 'Agents', 'Analytics', 'App detail', 'Application detail',
  'Apps', 'Article detail', 'Asset detail', 'Audience', 'Billing', 'Boards', 'Calendar',
  'Calls', 'Campaigns', 'Candidate detail', 'Catalog', 'Channel detail', 'Chat',
  'Chatting with AI', 'Classroom', 'Collection detail', 'Community', 'Companies', 'Company',
  'Company settings', 'Contacts', 'Content', 'Conversation detail', 'Courses',
  'Creating a blank doc', 'Creating a board', 'Creating a business', 'Creating a campaign',
  'Creating a canvas', 'Creating a chat', 'Creating a client', 'Creating a collection',
  'Creating a community', 'Creating a contract', 'Creating a course', 'Creating a dashboard',
  'Creating a database', 'Creating a design file', 'Creating a doc', 'Creating a document',
  'Creating a file', 'Creating a folder', 'Creating a form', 'Creating a goal',
  'Creating a group', 'Creating a job', 'Creating a list', 'Creating a map',
  'Creating a message', 'Creating a mural', 'Creating a new message', 'Creating a new page',
  'Creating a new post', 'Creating a new project', 'Creating a new story',
  'Creating a new workbook', 'Creating a note', 'Creating a notebook', 'Creating a page',
  'Creating a playlist', 'Creating a post', 'Creating a presentation', 'Creating a product',
  'Creating a project', 'Creating a project (from artifact)', 'Creating a prompt',
  'Creating a report', 'Creating a report (insight)', 'Creating a sheets', 'Creating a site',
  'Creating a space', 'Creating a spreadsheet', 'Creating a study', 'Creating a table',
  'Creating a task', 'Creating a team', 'Creating a template', 'Creating a video',
  'Creating a website with AI', 'Creating a whiteboard', 'Creating a workflow',
  'Creating a workspace', 'Creating an agent', 'Creating an app', 'Creating an app with AI',
  'Creating an article', 'Creating an email', 'Creating an event',
  'Creating an interactive demo', 'Creating an invoice', 'Dashboard', 'Data', 'Discover',
  'Documents', 'Editing a page', 'Editing a site', 'Editing profile', 'Event detail', 'Events',
  'Explore', 'Feedback', 'Files', 'Generating a Gamma (generate)', 'Generating an image',
  'Help center', 'Home', 'Inbox', 'Insights', 'Integrations', 'Invoices', 'Item detail',
  'Jobs', 'Layout', 'Library', 'Links', 'Location detail', 'Logging in', 'Manage account',
  'Marketing', 'Meeting details', 'Meetings', 'Members', 'Message', 'Messages', 'Mods tools',
  'My account', 'My profile', 'New project', 'Notifications', 'Onboarding', 'Order detail',
  'Organization settings', 'Other Flows', 'Overview', 'Payments', 'People', 'Playground',
  'Playing a song', 'Post detail', 'Preferences', 'Product detail', 'Products', 'Profile',
  'Profile settings', 'Project', 'Project detail', 'Project details', 'Project main table',
  'Project settings', 'Projects', 'Recordings', 'Reports', 'Resources', 'Schedule', 'Search',
  'Searching flights', 'Sending a message', 'Settings', 'Site settings', 'Space dashboard',
  'Starting a call', 'Starting a chat', 'Starting a conversation', 'Starting a meeting',
  'Task detail', 'Tasks', 'Team', 'Team settings', 'Templates', 'Transactions', 'User profile',
  'User settings', 'Users', 'Wallet', 'Watching a video', 'Workflows', 'Workspace',
  'Workspace settings', 'Writing a story',
];

interface FlowsPageViewProps {
  controller: DiscoveryController<
    FlowCatalogItem,
    FlowsDiscoverySort,
    FlowsDiscoveryControllerState
  >;
  onSelectFlow: (title: string, platform: Platform) => void;
  onSelectApp: (appId: string) => void;
  accountControls?: ReactNode;
  userRole?: 'admin' | 'user';
  isGuest?: boolean;
  onGuestLimitReached?: () => void;
}

export function FlowsPageView({
  controller,
  onSelectFlow,
  onSelectApp,
  userRole = 'user',
  isGuest = false,
  onGuestLimitReached,
}: FlowsPageViewProps) {
  const flowGroups = useMemo<DiscoveryFilterGroup>(() => ({
    id: 'flowGroups',
    label: 'Flow groups',
    selected: controller.state.filters
      .filter(({ group }) => group === 'flowGroups')
      .map(({ value }) => value),
    options: ALL_FLOW_GROUPS.map((value) => ({
      value,
      section: 'Flow groups',
    })),
  }), [controller.state.filters]);
  const catalogItemsByFlowId = useMemo(
    () => new Map(controller.items.map((item) => [item.preview.flow.id, item])),
    [controller.items],
  );
  const catalogGroups = useMemo<FlowTreeGroup[]>(() => [{
    id: 'flow-catalog',
    label: 'Flow catalog',
    standalone: true,
    flows: controller.items.map((item) => ({
      ...item.preview.flow,
      title: catalogFlowTitle(item),
    })),
  }], [controller.items]);

  return (
    <DiscoveryPageLayout
      kind="flows"
      header={null}
      taxonomyLabel="Flow discovery filters"
      taxonomy={(
        <ReferenceDiscoveryFacetGroup
          label="Flow groups"
          className="flows-discovery__facet"
        >
          {FLOW_GROUPS_TAXONOMY.map((value) => (
            <Button
              key={value}
              label={value}
              data-flow-taxonomy-option="true"
              variant="ghost"
              size="sm"
              aria-pressed={flowGroups.selected.includes(value)}
              onClick={() => controller.toggleFilter({
                group: flowGroups.id,
                value,
              })}
            />
          ))}
        </ReferenceDiscoveryFacetGroup>
      )}
      preview={null}
      toolbar={(
        <DiscoveryFilterBar
          kind="flows"
          ariaLabel="Flow discovery controls"
          platform={{
            value: controller.state.platform,
            ariaLabel: 'Flow platform',
            onChange: controller.setPlatform,
          }}
          filters={[flowGroups]}
          resultCount={controller.items.length}
          resultLabels={['flow', 'flows']}
          showResultCount={false}
          showSort={false}
          sort={controller.state.sort}
          sortOptions={[]}
          onSortChange={() => undefined}
          onToggleFilter={(group, value) => controller.toggleFilter({ group, value })}
          onClearFilter={controller.clearFilterGroup}
        />
      )}
      resultLabel="flows"
      singularResultLabel="flow"
      totalCount={controller.totalCount}
      renderedCount={controller.items.length}
      loading={controller.loading}
      loadingMore={controller.loadingMore}
      error={controller.error}
      loadMoreError={controller.loadMoreError}
      onRetry={controller.retry}
      onRetryLoadMore={controller.retryLoadMore}
      onReset={() => controller.setState({ ...controller.state, filters: [] })}
      guestLimitReached={isGuest && controller.items.length >= PUBLIC_CATALOG_GUEST_LIMIT}
      onGuestLimitReached={onGuestLimitReached}
      sentinelRef={controller.sentinelRef}
    >
      <FlowGallery
        groups={catalogGroups}
        ariaLabel="Flow catalog"
        paginate={false}
        platform={controller.state.platform}
        userRole={userRole}
        cardPropsForFlow={(flow) => {
          const item = catalogItemsByFlowId.get(flow.id);
          if (!item) return undefined;
          return {
            screenCount: item.preview.screenCount,
            metaLabel: `${item.preview.screenCount} ${item.preview.screenCount === 1 ? 'screen' : 'screens'}`,
            sourceAppName: item.preview.appName,
            sourceAppIconUrl: item.preview.appIconUrl,
            documentSource: {
              app: item.preview.appId,
              platform: controller.state.platform,
              version: item.preview.version,
              flowId: item.preview.sourceFlowId,
            },
            onOpenSourceApp: () => onSelectApp(item.preview.appId),
          };
        }}
        onSelectFlow={(flowId) => {
          const item = catalogItemsByFlowId.get(flowId);
          if (item) onSelectFlow(item.title, controller.state.platform);
        }}
      />
    </DiscoveryPageLayout>
  );
}

interface FlowsPageProps {
  onSelectFlow: (title: string, platform: Platform) => void;
  onSelectApp: (appId: string) => void;
  accountControls?: ReactNode;
  userRole?: 'admin' | 'user';
  isGuest?: boolean;
  onGuestLimitReached?: () => void;
}

export function FlowsPage({
  onSelectFlow,
  onSelectApp,
  accountControls,
  userRole = 'user',
  isGuest = false,
  onGuestLimitReached,
}: FlowsPageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?') ? locationKey.slice(locationKey.indexOf('?')) : '';
  const controller = useFlowsDiscoveryPageController({
    locationSearch: search,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/flows${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
    isGuest,
  });

  return (
    <FlowsPageView
      controller={controller}
      onSelectFlow={onSelectFlow}
      onSelectApp={onSelectApp}
      accountControls={accountControls}
      userRole={userRole}
      isGuest={isGuest}
      onGuestLimitReached={onGuestLimitReached}
    />
  );
}

interface UseFlowsDiscoveryPageControllerOptions {
  locationSearch: string;
  onNavigate(search: string, mode: 'push' | 'replace'): void;
  observerFactory?: DiscoveryObserverFactory;
  isGuest: boolean;
}

export function useFlowsDiscoveryPageController({
  locationSearch,
  onNavigate,
  observerFactory,
  isGuest,
}: UseFlowsDiscoveryPageControllerOptions) {
  const adapter = useMemo(() => createFlowsDiscoveryAdapter({ isGuest }), [isGuest]);
  return useDiscoveryController({
    adapter,
    locationSearch,
    onNavigate,
    observerFactory,
  });
}
