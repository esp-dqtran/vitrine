import { Spinner } from './Spinner.tsx';
import { useEffect, useRef, useState } from "react";
import {
  Button,
  EmptyState,
  TextInput,
} from "@astryxdesign/core";
import {
  BookmarkHollowIcon,
  CogIcon,
  FolderIcon,
  GlobeIcon,
  GridIcon,
  StackedIcon,
} from "@storybook/icons";
import type { ResearchCollection } from "../../db.ts";
import {
  createCollection,
  deleteCollection,
  listCollectionScreens,
  listCollections,
  removeCollectionItem,
  type CollectionScreenView,
} from "../researchApi.ts";
import { navigate } from "../router.ts";
import { ReferenceGalleryGrid, ReferenceGallerySection } from "./ReferenceGallerySection.tsx";
import { ReferenceDetailShell } from "./ReferenceDetailShell.tsx";
import { ScreenGridCard } from "./ScreenGridCard.tsx";
import { ScreenPreviewDialog } from "./ScreenPreviewDialog.tsx";
import { useWorkspaceChrome } from "./WorkspaceChromeContext.tsx";
import { projectRailNav } from "./projectRailNav.tsx";

function updatedLabel(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Updated recently";
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year:
      new Date(timestamp).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }).format(timestamp)}`;
}

function itemCountLabel(collection: ResearchCollection): string {
  const screens = collection.items.filter(({ kind }) => kind === "screen").length;
  return screens ? `${screens} ${screens === 1 ? "screen" : "screens"}` : "No screens saved yet";
}

/*
 * Empty-state illustration: stacked saved screens with a bookmark, drawn from
 * theme tokens so it reads in both themes. Original artwork, not traced.
 */
function CollectionsEmptyIllustration() {
  return (
    <svg
      className="collections-workspace__empty-illustration"
      width="88"
      height="88"
      viewBox="0 0 88 88"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="18.5"
        y="14.5"
        width="51"
        height="34"
        rx="6"
        fill="var(--color-background-muted)"
        stroke="var(--color-border-emphasized)"
      />
      <rect
        x="12.5"
        y="24.5"
        width="63"
        height="40"
        rx="7"
        fill="var(--color-background-surface)"
        stroke="var(--color-border-emphasized)"
      />
      <rect
        x="21"
        y="34"
        width="26"
        height="4"
        rx="2"
        fill="var(--color-border-emphasized)"
      />
      <rect
        x="21"
        y="44"
        width="40"
        height="4"
        rx="2"
        fill="var(--color-border)"
      />
      <rect
        x="21"
        y="52"
        width="17"
        height="4"
        rx="2"
        fill="var(--color-border)"
      />
      <path
        d="M56 58h10a2 2 0 0 1 2 2v14l-7-4.5L54 74V60a2 2 0 0 1 2-2Z"
        fill="var(--color-background-surface)"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CollectionsWorkspacePage({
  collections,
  loaded,
  plan,
  collectionId,
  onLoad,
  onChange,
  onUpgrade,
}: {
  collections: ResearchCollection[];
  loaded: boolean;
  plan: "free" | "pro";
  collectionId?: number;
  onLoad(): Promise<ResearchCollection[]>;
  onChange(collections: ResearchCollection[]): void;
  onUpgrade(): void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedScreens, setSelectedScreens] = useState<CollectionScreenView[] | null>(null);
  const [screensError, setScreensError] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (loaded) return;
    void onLoad().catch((cause) => setError((cause as Error).message));
  }, [loaded, onLoad]);

  const refresh = async () => {
    const next = await listCollections();
    onChange(next);
  };
  const selected = collectionId
    ? collections.find(({ id }) => id === collectionId)
    : undefined;
  const visibleCollections = collections;
  const canCreate = plan === "pro" || collections.length === 0;

  useEffect(() => {
    let active = true;
    if (!selected) {
      setSelectedScreens(null);
      setScreensError("");
      return () => { active = false; };
    }
    setSelectedScreens(null);
    setScreensError("");
    setPreviewIndex(null);
    void listCollectionScreens(selected.id)
      .then(({ screens }) => { if (active) setSelectedScreens(screens); })
      .catch((cause) => { if (active) setScreensError((cause as Error).message); });
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => {
    if (previewIndex === null || !selectedScreens) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewIndex(null);
      else if (event.key === "ArrowLeft" && previewIndex > 0) setPreviewIndex(previewIndex - 1);
      else if (event.key === "ArrowRight" && previewIndex < selectedScreens.length - 1) setPreviewIndex(previewIndex + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewIndex, selectedScreens]);

  const removeSavedScreen = async (itemId: number) => {
    if (!selected || busy) return;
    setBusy(true);
    setScreensError("");
    try {
      await removeCollectionItem(selected.id, itemId);
      setSelectedScreens((screens) => screens?.filter((screen) => screen.itemId !== itemId) ?? null);
      await refresh();
    } catch (cause) {
      setScreensError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const collection = await createCollection(name);
      setNewName("");
      setCreating(false);
      await refresh();
      navigate({ name: "collections", collectionId: collection.id });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
  };

  useWorkspaceChrome(
    () => ({
      className: "collections-workspace",
      workspace: {
        label: "Personal workspace",
        name: "Personal",
        initial: "P",
        onSelect: () => navigate({ name: "projects" }),
      },
      nav: {
        primaryLabel: "Workspace",
        primaryHeading: "Workspace",
        globalActions: [{
          label: "Apps",
          icon: <GridIcon aria-hidden="true" />,
          onSelect: () => navigate({ name: "apps" }),
        }],
        primaryActions: projectRailNav({
          collectionsActive: true,
          onOpenProjects: () => navigate({ name: "projects" }),
        }),
        settings: {
          label: "Settings",
          icon: <CogIcon aria-hidden="true" />,
          onSelect: () => navigate({ name: "settings-billing" }),
        },
      },
      onBrandSelect: () => navigate({ name: "apps" }),
      drawer: (
      <div
        className={`projects-workspace__drawer-layer${menuOpen ? " is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="projects-workspace__drawer-backdrop"
          aria-label="Close Personal menu"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMenu}
        />
        <aside className="projects-team-drawer" aria-label="Personal navigation">
          <section className="projects-team-switcher__current">
            <span className="projects-team-rail__avatar" aria-hidden="true">P</span>
            <strong>Personal</strong>
            <small>Personal workspace</small>
          </section>
          <div className="projects-team-drawer__divider" />
          <nav className="projects-team-drawer__nav" aria-label="Personal sections">
            <button type="button" onClick={() => navigate({ name: "projects" })}>
              <FolderIcon aria-hidden="true" /> Projects
            </button>
            <button type="button" className="is-active" onClick={closeMenu}>
              <BookmarkHollowIcon aria-hidden="true" /> Collections
            </button>
            <button type="button" onClick={() => navigate({ name: "apps" })}>
              <GridIcon aria-hidden="true" /> Apps
            </button>
            <button type="button" onClick={() => navigate({ name: "sites" })}>
              <GlobeIcon aria-hidden="true" /> Sites
            </button>
            <button type="button" onClick={() => navigate({ name: "settings-billing" })}>
              <CogIcon aria-hidden="true" /> Settings
            </button>
          </nav>
        </aside>
        </div>
      ),
    }),
    [collections, menuOpen, selected?.id],
  );

  if (collectionId) {
    const previewScreen = previewIndex === null ? undefined : selectedScreens?.[previewIndex];
    const galleryLayout: "web-screens" | "mobile-screens" | undefined = selectedScreens?.every(({ screen }) => screen.platform === "web")
      ? "web-screens"
      : selectedScreens?.every(({ screen }) => screen.platform === "ios" || screen.platform === "android")
        ? "mobile-screens"
        : undefined;

    return (
      <>
      <ReferenceDetailShell
        dataDetailKind="app"
        className="app-detail collection-detail"
        title={selected?.name ?? "Collection"}
        identityKey={`collection-${collectionId}`}
        identityLabel={selected?.name?.[0]?.toUpperCase() ?? "C"}
        accent="var(--color-background-muted)"
        metadata={[]}
        tabs={[]}
        activeTab="screens"
        onTabChange={() => undefined}
        bodyPadding="32px 40px 72px"
        loading={!loaded || Boolean(selected && selectedScreens === null && !screensError)}
      >
        {!loaded ? (
          <div className="projects-workspace__loading"><Spinner size="lg" /></div>
        ) : !selected ? (
          <EmptyState
            title="Collection not found"
            description="This collection may have been removed or is no longer available."
            actions={<Button label="Back to Collections" variant="primary" onClick={() => navigate({ name: "collections" })} />}
          />
        ) : screensError ? (
          <div role="alert"><EmptyState title="Could not load saved screens" description={screensError} /></div>
        ) : selectedScreens === null ? (
          <div className="projects-workspace__loading"><Spinner size="lg" /></div>
        ) : selectedScreens.length ? (
          <section className="collections-workspace__screens" aria-label="Saved screens">
            <ReferenceGallerySection>
              <ReferenceGalleryGrid minCardWidth={240} layout={galleryLayout}>
                {selectedScreens.map((savedScreen, index) => (
                  <div key={savedScreen.itemId} className={`app-detail--${savedScreen.screen.platform}`}>
                    <ScreenGridCard
                      screen={savedScreen.screen}
                      appName={savedScreen.app}
                      accent={savedScreen.accent}
                      delay={Math.min(index * 0.04, 0.32)}
                      onOpen={() => setPreviewIndex(index)}
                      onRemove={() => void removeSavedScreen(savedScreen.itemId)}
                      isRemoveDisabled={busy}
                    />
                  </div>
                ))}
              </ReferenceGalleryGrid>
            </ReferenceGallerySection>
          </section>
        ) : (
          <EmptyState
            title="No screens saved yet"
            description="Save screens from any App detail page and they will appear here."
            actions={<Button label="Browse Apps" variant="primary" onClick={() => navigate({ name: "apps" })} />}
          />
        )}
      </ReferenceDetailShell>
      {previewScreen ? (
        <ScreenPreviewDialog
          key={previewScreen.itemId}
          appName={previewScreen.app}
          screen={previewScreen.screen}
          index={previewIndex ?? 0}
          total={selectedScreens?.length ?? 0}
          canNavigateNext={Boolean(selectedScreens && previewIndex !== null && previewIndex < selectedScreens.length - 1)}
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
          appId={previewScreen.app}
          collections={collections}
          onCollectionsChange={onChange}
          plan={plan}
        />
      ) : null}
      </>
    );
  }

  return (
    <>
          <header className="projects-workspace__page-header">
            <div>
              <h1>Collections</h1>
              <p>Keep useful screens and flows together in your personal workspace.</p>
            </div>
            {visibleCollections.length > 0 ? (
              <Button
                variant="primary"
                label="New collection"
                clickAction={canCreate ? () => setCreating(true) : onUpgrade}
              />
            ) : null}
          </header>

          {error ? <p role="alert" className="projects-workspace__error collections-workspace__error">{error}</p> : null}

          {creating ? (
            <section className="collections-workspace__composer" aria-label="Create collection">
              <TextInput
                label="Collection name"
                isLabelHidden
                value={newName}
                onChange={setNewName}
                onEnter={() => void create()}
                placeholder="Collection name"
                width="100%"
              />
              <Button label="Create" variant="primary" isLoading={busy} clickAction={create} />
              <Button label="Cancel" variant="ghost" isDisabled={busy} clickAction={() => { setCreating(false); setNewName(""); }} />
            </section>
          ) : null}

          {!loaded ? (
            <div className="projects-workspace__loading"><Spinner size="lg" /></div>
          ) : visibleCollections.length ? (
            <section className="projects-workspace__section collections-workspace__section">
              <div className="projects-workspace__section-heading">
                <h2>Your collections</h2>
                <span>{visibleCollections.length}</span>
              </div>
              <div className="projects-workspace__grid collections-workspace__grid">
                {visibleCollections.map((collection) => (
                  <article key={collection.id} className="collections-workspace__card">
                    <button type="button" className="collections-workspace__card-open" onClick={() => navigate({ name: "collections", collectionId: collection.id })}>
                      <span className="collections-workspace__cover" aria-hidden="true"><StackedIcon /></span>
                      <span className="collections-workspace__card-copy">
                        <strong>{collection.name}</strong>
                        <small>{itemCountLabel(collection)}</small>
                        <small>{updatedLabel(collection.updated_at)}</small>
                      </span>
                    </button>
                    <Button
                      label="Delete"
                      variant="ghost"
                      size="sm"
                      className="collections-workspace__delete"
                      clickAction={async () => {
                        await deleteCollection(collection.id);
                        await refresh();
                      }}
                    />
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <div className="projects-workspace__empty collections-workspace__empty">
              <EmptyState
                icon={<CollectionsEmptyIllustration />}
                title="Create your first collection"
                description="Save screens and flows you want to revisit, compare, or use in a project."
                actions={(
                  <Button
                    label="New collection"
                    variant="primary"
                    onClick={canCreate ? () => setCreating(true) : onUpgrade}
                  />
                )}
              />
            </div>
          )}
    </>
  );
}
