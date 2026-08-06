import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  EmptyState,
  Spinner,
  TextArea,
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
import type { CollectionItem, ResearchCollection } from "../../db.ts";
import {
  createCollection,
  deleteCollection,
  listCollections,
  removeCollectionItem,
  updateCollectionItemNotes,
} from "../researchApi.ts";
import { navigate } from "../router.ts";
import { useWorkspaceChrome } from "./WorkspaceChromeContext.tsx";
import { workspaceNav } from "./workspaceNav.tsx";

type CollectionFilter = "all" | "screen" | "flow";

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
  const flows = collection.items.filter(({ kind }) => kind === "flow").length;
  const parts = [];
  if (screens) parts.push(`${screens} ${screens === 1 ? "screen" : "screens"}`);
  if (flows) parts.push(`${flows} ${flows === 1 ? "flow" : "flows"}`);
  return parts.join(" · ") || "No screens or flows yet";
}

function openCollectionItem(item: CollectionItem) {
  navigate({
    name: "app",
    appId: item.app,
    section: item.kind === "flow" ? "flows" : "screens",
    ...(item.kind === "flow"
      ? { flow: item.reference_id }
      : { evidence: item.reference_id }),
  });
}

function CollectionNotes({
  collectionId,
  item,
  onSaved,
}: {
  collectionId: number;
  item: CollectionItem;
  onSaved(): Promise<void>;
}) {
  const [value, setValue] = useState(item.notes);
  return (
    <TextArea
      label={`Notes for ${item.title}`}
      isLabelHidden
      value={value}
      onChange={setValue}
      placeholder="Add a research note…"
      rows={3}
      width="100%"
      onBlur={async () => {
        if (value === item.notes) return;
        await updateCollectionItemNotes(collectionId, item.id, value);
        await onSaved();
      }}
    />
  );
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
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const visibleItems = useMemo(() => {
    if (!selected) return [];
    return filter === "all"
      ? selected.items
      : selected.items.filter(({ kind }) => kind === filter);
  }, [filter, selected]);
  const canCreate = plan === "pro" || collections.length === 0;

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
      nav: workspaceNav({ active: "collections" }),
      onBrandSelect: () => navigate({ name: "projects" }),
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
    [menuOpen, selected?.id],
  );

  return (
    <>
          <header className="projects-workspace__page-header">
            <div>
              {selected ? (
                <Button label="Back to Collections" variant="ghost" size="sm" className="collections-workspace__back" onClick={() => navigate({ name: "collections" })} />
              ) : null}
              <h1>{selected?.name ?? "Collections"}</h1>
              <p>
                {selected
                  ? selected.description || "Saved screens and flows for your research."
                  : "Keep useful screens and flows together in your personal workspace."}
              </p>
            </div>
            {!selected && visibleCollections.length > 0 ? (
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
          ) : selected ? (
            <>
              <div className="collections-workspace__detail-toolbar" role="tablist" aria-label="Collection items">
                {(["all", "screen", "flow"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    className={filter === value ? "is-active" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {value === "all" ? "All" : value === "screen" ? "Screens" : "Flows"}
                    <span>{value === "all" ? selected.items.length : selected.items.filter(({ kind }) => kind === value).length}</span>
                  </button>
                ))}
              </div>
              {visibleItems.length ? (
                <div className="collections-workspace__items">
                  {visibleItems.map((item) => (
                    <article key={item.id} className="collections-workspace__item">
                      <button type="button" className="collections-workspace__item-open" onClick={() => openCollectionItem(item)}>
                        <span className="collections-workspace__item-icon" aria-hidden="true">
                          {item.kind === "flow" ? <StackedIcon /> : <BookmarkHollowIcon />}
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.kind} · {item.app}</small>
                        </span>
                      </button>
                      <Button
                        label="Remove"
                        variant="ghost"
                        size="sm"
                        clickAction={async () => {
                          await removeCollectionItem(selected.id, item.id);
                          await refresh();
                        }}
                      />
                      <div className="collections-workspace__item-notes">
                        {plan === "pro" ? (
                          <CollectionNotes collectionId={selected.id} item={item} onSaved={refresh} />
                        ) : (
                          <button type="button" onClick={onUpgrade}>Upgrade to Pro to add notes</button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="projects-workspace__empty">
                  <EmptyState title="No saved items here" description="Save screens or flows from the Apps library and they will appear in this collection." />
                  <Button label="Browse Apps" variant="primary" onClick={() => navigate({ name: "apps" })} />
                </div>
              )}
            </>
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
