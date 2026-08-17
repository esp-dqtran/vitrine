import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "@astryxdesign/core";
import {
  BellIcon,
  BookmarkHollowIcon,
  CheckIcon,
  CogIcon,
  FilesIcon,
  MenuIcon,
  PlusIcon,
  QuestionIcon,
  SwitchAltIcon,
  UserIcon,
  UsersIcon,
} from "@storybook/icons";

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
    <section id={`review-${index}`} className="project-shell-review__section">
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
  const [searching, setSearching] = useState(false);
  return (
    <div className="project-shell-review__header-frame projects-workspace">
      <WorkspaceHeader
        variant="projects"
        searching={searching}
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
            <button
              type="button"
              className="projects-workspace__search-toggle"
              aria-label={
                searching ? "Close project search" : "Open project search"
              }
              onClick={() => setSearching((open) => !open)}
            >
              <SearchIcon aria-hidden="true" />
            </button>
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
          icon: <SwitchAltIcon aria-hidden="true" />,
          expanded: false,
          onSelect: () => undefined,
        }}
        onBrandSelect={() => undefined}
        primaryLabel="Workspace"
        primaryActions={[
          {
            label: "Projects",
            icon: <FilesIcon aria-hidden="true" />,
            active: true,
          },
          {
            label: "Collections",
            icon: <BookmarkHollowIcon aria-hidden="true" />,
          },
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
      <header className="projects-team-drawer__header">
        <strong>Workspaces</strong>
        <small>Choose where projects live</small>
      </header>
      <section
        className="projects-team-switcher__spaces"
        aria-label="Switch workspace"
      >
        <button type="button" className="is-active">
          <UserIcon aria-hidden="true" />
          <span>Personal</span>
          <CheckIcon
            className="projects-team-switcher__check"
            aria-hidden="true"
          />
        </button>
        <button type="button">
          <UsersIcon aria-hidden="true" />
          <span>Product design</span>
        </button>
      </section>
      <div className="projects-team-drawer__divider" />
      <button type="button" className="projects-team-switcher__create">
        <PlusIcon aria-hidden="true" />
        <span>Create Team</span>
      </button>
    </aside>
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
