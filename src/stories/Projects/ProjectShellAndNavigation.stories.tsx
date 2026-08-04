import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, IconButton, TextInput } from "@astryxdesign/core";
import {
  BellIcon,
  BookmarkHollowIcon,
  CogIcon,
  FolderIcon,
  GlobeIcon,
  GridIcon,
  MenuIcon,
  PlusIcon,
  QuestionIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
} from "@storybook/icons";

import { DiscoverySortDropdown } from "../../vitrine/components/AppsFilterBar.tsx";
import {
  AstryxDropdown,
  AstryxDropdownItem,
} from "../../vitrine/components/AstryxDropdown.tsx";
import {
  WorkspaceHeader,
  WorkspaceRail,
} from "../../vitrine/components/WorkspaceChrome.tsx";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "../../vitrine/styles.css";
import "../../vitrine/referenceDiscovery.css";
import "../../vitrine/projectsWorkspace.css";
import "../../vitrine/components/AstryxDropdown.css";
import "../../vitrine/productTypography.css";
import "../../vitrine/productSpacing.css";
import "../../vitrine/productShape.css";
import "../../vitrine/productIconography.css";
import "../../vitrine/productMotion.css";
import "../../vitrine/productResponsive.css";
import "../../vitrine/productForms.css";
import "./ProjectShellAndNavigation.css";

const meta = {
  title: "Projects/Component system/01 Shell and Navigation",
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component:
          "Visual review of the production Projects shell before applying changes: header, workspace rail, Team menu, search, sort, and action menus.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function ReviewSection({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="project-shell-review__section">
      <header className="project-shell-review__section-header">
        <span>{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function HeaderSpecimen() {
  const [query, setQuery] = useState("");
  return (
    <div className="project-shell-review__header-frame projects-workspace">
      <WorkspaceHeader
        variant="projects"
        menu={{
          label: "Open workspace menu",
          expanded: false,
          icon: <MenuIcon aria-hidden="true" />,
          onSelect: () => undefined,
        }}
        onBrandSelect={() => undefined}
        actions={
          <>
            <span
              className="projects-workspace__header-divider"
              aria-hidden="true"
            />
            <IconButton
              label="Help"
              tooltip="Help"
              variant="ghost"
              icon={<QuestionIcon aria-hidden="true" />}
            />
            <IconButton
              label="Notifications"
              tooltip="Notifications"
              variant="ghost"
              icon={<BellIcon aria-hidden="true" />}
            />
            <IconButton
              label="Account settings"
              variant="ghost"
              icon={<UserIcon aria-hidden="true" />}
            />
          </>
        }
      >
        <TextInput
          className="projects-workspace__header-search"
          label="Search projects"
          isLabelHidden
          value={query}
          placeholder="Search projects"
          startIcon={<SearchIcon aria-hidden="true" />}
          hasClear={Boolean(query)}
          onChange={setQuery}
          width="min(800px, 100%)"
        />
      </WorkspaceHeader>
    </div>
  );
}

function RailSpecimen() {
  return (
    <div className="project-shell-review__rail-frame projects-workspace">
      <WorkspaceRail
        workspace={{
          label: "Switch Team",
          initial: "P",
          expanded: false,
          onSelect: () => undefined,
        }}
        quickAction={{
          label: "Create Team",
          icon: <PlusIcon aria-hidden="true" />,
        }}
        primaryLabel="Personal navigation"
        primaryActions={[
          {
            label: "Projects",
            icon: <FolderIcon aria-hidden="true" />,
            active: true,
          },
          {
            label: "Collections",
            icon: <BookmarkHollowIcon aria-hidden="true" />,
          },
        ]}
        secondaryLabel="Vitrines libraries"
        secondaryActions={[
          { label: "Apps", icon: <GridIcon aria-hidden="true" /> },
          { label: "Sites", icon: <GlobeIcon aria-hidden="true" /> },
        ]}
        settings={{
          label: "Account settings",
          icon: <CogIcon aria-hidden="true" />,
        }}
      />
    </div>
  );
}

function TeamMenuSpecimen() {
  return (
    <aside
      className="projects-team-drawer project-shell-review__team-menu"
      aria-label="Team navigation"
    >
      <section className="projects-team-switcher__current">
        <span className="projects-team-rail__avatar" aria-hidden="true">
          P
        </span>
        <strong>Personal</strong>
        <small>Personal workspace</small>
        <div className="projects-team-drawer__actions">
          <Button
            label="Create Team"
            variant="ghost"
            icon={<PlusIcon aria-hidden="true" />}
          />
          <IconButton
            label="Account settings"
            variant="ghost"
            icon={<CogIcon aria-hidden="true" />}
          />
        </div>
      </section>
      <section
        className="projects-team-switcher__spaces"
        aria-label="Switch workspace"
      >
        <span className="projects-team-switcher__label">
          Personal workspace
        </span>
        <button type="button" className="is-active">
          <UserIcon aria-hidden="true" />
          <span>
            <strong>Personal</strong>
            <small>Your private projects</small>
          </span>
        </button>
        <span className="projects-team-switcher__label">Teams</span>
        <button type="button">
          <UsersIcon aria-hidden="true" />
          <span>
            <strong>Product design</strong>
            <small>8 members</small>
          </span>
        </button>
      </section>
      <div className="projects-team-drawer__divider" />
      <nav className="projects-team-drawer__nav" aria-label="Personal sections">
        <button type="button" className="is-active">
          <FolderIcon aria-hidden="true" /> Projects
        </button>
        <button type="button">
          <BookmarkHollowIcon aria-hidden="true" /> Collections
        </button>
      </nav>
    </aside>
  );
}

function NavigationControlsSpecimen() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const [sortOpen, setSortOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <div className="project-shell-review__control-board projects-workspace">
      <div className="project-shell-review__control project-shell-review__control--search">
        <TextInput
          label="Search projects"
          isLabelHidden
          value={query}
          placeholder="Search projects"
          startIcon={<SearchIcon aria-hidden="true" />}
          hasClear={Boolean(query)}
          onChange={setQuery}
          width="100%"
        />
      </div>
      <div className="project-shell-review__control project-shell-review__dropdown-card">
        <div className="projects-workspace__toolbar project-shell-review__sort-control">
          <span className="project-shell-review__control-label">Sort by</span>
          <DiscoverySortDropdown
            value={sort}
            open={sortOpen}
            onOpenChange={setSortOpen}
            onChange={setSort}
            options={[
              { value: "updated", label: "Last updated" },
              { value: "name", label: "Name" },
            ]}
          />
        </div>
      </div>
      <div className="project-shell-review__control project-shell-review__dropdown-card">
        <AstryxDropdown
          label="More actions"
          ariaLabel="More project actions"
          open={actionsOpen}
          hasChevron={false}
          triggerVariant="primary"
          onOpenChange={setActionsOpen}
        >
          <AstryxDropdownItem label="Share" onSelect={() => undefined} />
          <AstryxDropdownItem label="Rename" onSelect={() => undefined} />
          <AstryxDropdownItem label="Duplicate" onSelect={() => undefined} />
          <AstryxDropdownItem
            label="Delete"
            tone="destructive"
            onSelect={() => undefined}
          />
        </AstryxDropdown>
      </div>
    </div>
  );
}

function ShellAndNavigationReview() {
  return (
    <main className="project-shell-review">
      <header className="project-shell-review__intro">
        <div>
          <p className="project-shell-review__eyebrow">
            Vitrines · Projects component system
          </p>
          <h1>Shell &amp; Navigation</h1>
          <p className="project-shell-review__lede">
            Review the Projects navigation components as a system before any
            production screen is changed.
          </p>
        </div>
        <span className="project-shell-review__status">
          Visual review · Awaiting approval
        </span>
      </header>

      <ReviewSection
        index="01"
        title="Product header"
        description="One horizontal navigation frame for brand, search, help, notifications, and account access."
      >
        <HeaderSpecimen />
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Workspace navigation"
        description="The rail owns persistent destinations; the Team menu expands workspace context without replacing the page."
      >
        <div className="project-shell-review__workspace-grid">
          <article aria-label="Persistent workspace rail">
            <RailSpecimen />
          </article>
          <article aria-label="Team menu specimen">
            <TeamMenuSpecimen />
          </article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Search and menus"
        description="Search, sort, and contextual actions share one input, trigger, panel, item, focus, and motion contract."
      >
        <NavigationControlsSpecimen />
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Responsive contract"
        description="The same components adapt by priority instead of introducing a second mobile navigation system."
      >
        <div className="project-shell-review__contract-grid">
          <article>
            <span>Desktop · 981+</span>
            <strong>Rail + full header</strong>
            <p>
              All persistent destinations and header actions remain visible.
            </p>
          </article>
          <article>
            <span>Tablet · 701–980</span>
            <strong>Menu trigger + search action</strong>
            <p>The rail moves into the Team menu and search opens in place.</p>
          </article>
          <article>
            <span>Mobile · 700 and below</span>
            <strong>Mobile drawer + single-column content</strong>
            <p>
              The Team menu becomes a modal rail while header actions stay
              compact.
            </p>
          </article>
        </div>
      </ReviewSection>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <ShellAndNavigationReview />,
};
