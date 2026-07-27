import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  ClickableCard,
  Dialog,
  Spinner,
  TextInput,
} from '@astryxdesign/core';
import {
  attachCategoryApp,
  createCategory,
  deleteCategory,
  detachCategoryApp,
  listCategories,
  listCategoryApps,
  updateCategory,
  type CategoryApp,
  type CategorySummary,
} from '../categoriesApi.ts';

export type CategoryDraft = { name: string; slug: string };

interface CategoriesPageViewProps {
  categories: CategorySummary[] | null;
  selectedId: number | null;
  apps: CategoryApp[];
  draft: CategoryDraft;
  editing: CategorySummary | null;
  deleting: CategorySummary | null;
  appSlug: string;
  busy: boolean;
  error: string;
  onSelect: (id: number) => void;
  onDraftChange: (draft: CategoryDraft) => void;
  onCreate: () => void;
  onEdit: (category: CategorySummary) => void;
  onEditingChange: (category: CategorySummary | null) => void;
  onSave: () => void;
  onDelete: (category: CategorySummary | null) => void;
  onConfirmDelete: () => void;
  onAppSlugChange: (value: string) => void;
  onAttach: () => void;
  onDetach: (app: CategoryApp) => void;
}

export function CategoriesPageView(props: CategoriesPageViewProps) {
  const selected = props.categories?.find(({ id }) => id === props.selectedId);
  const canCreate = Boolean(props.draft.name.trim() && props.draft.slug.trim());
  const canSave = Boolean(props.editing?.name.trim() && props.editing?.slug.trim());

  return (
    <main className="vitrine-page admin-categories-page">
      <header className="admin-categories-header">
        <div>
          <h1>Categories</h1>
          <p>Organize Apps with simple many-to-many Category assignments.</p>
        </div>
      </header>

      {props.error && <p className="admin-categories-error" role="alert">{props.error}</p>}

      <Card padding={4} className="admin-categories-create">
        <div>
          <h2>Create Category</h2>
          <p>Both the display name and URL slug are required.</p>
        </div>
        <TextInput
          label="Category name"
          value={props.draft.name}
          onChange={(name) => props.onDraftChange({ ...props.draft, name })}
          placeholder="Productivity"
          width="100%"
        />
        <TextInput
          label="Category slug"
          value={props.draft.slug}
          onChange={(slug) => props.onDraftChange({ ...props.draft, slug })}
          placeholder="productivity"
          width="100%"
        />
        <Button
          label="Create Category"
          variant="primary"
          isDisabled={!canCreate || props.busy}
          isLoading={props.busy}
          clickAction={props.onCreate}
        />
      </Card>

      {props.categories === null ? (
        <div className="admin-categories-state" role="status" aria-label="Loading Categories">
          <Spinner size="lg" />
        </div>
      ) : props.categories.length === 0 ? (
        <div className="admin-categories-state">
          <h2>No Categories yet</h2>
          <p>Create the first Category above.</p>
        </div>
      ) : (
        <div className="admin-categories-layout">
          <section className="admin-categories-list" aria-label="Category list">
            {props.categories.map((category) => (
              <article
                key={category.id}
                className={`admin-categories-row${category.id === props.selectedId ? ' is-selected' : ''}`}
              >
                <ClickableCard
                  className="admin-categories-select"
                  label={`Manage ${category.name}`}
                  onClick={() => props.onSelect(category.id)}
                  padding={4}
                >
                  <span>
                    <strong>{category.name}</strong>
                    <code>{category.slug}</code>
                  </span>
                  <Badge
                    variant="neutral"
                    label={`${category.appCount} ${category.appCount === 1 ? 'app' : 'apps'}`}
                  />
                </ClickableCard>
                <div className="admin-categories-row-actions">
                  <Button label={`Edit ${category.name}`} size="sm" variant="ghost" clickAction={() => props.onEdit(category)} />
                  <Button label={`Delete ${category.name}`} size="sm" variant="ghost" clickAction={() => props.onDelete(category)} />
                </div>
              </article>
            ))}
          </section>

          <Card padding={4} className="admin-categories-detail">
            {selected ? (
              <>
                <div className="admin-categories-detail-heading">
                  <div>
                    <h2>{selected.name}</h2>
                    <code>{selected.slug}</code>
                  </div>
                  <Badge
                    variant="neutral"
                    label={`${selected.appCount} ${selected.appCount === 1 ? 'app' : 'apps'}`}
                  />
                </div>
                <div className="admin-categories-attach">
                  <TextInput
                    label="App slug"
                    value={props.appSlug}
                    onChange={props.onAppSlugChange}
                    placeholder="linear"
                    width="100%"
                  />
                  <Button
                    label="Attach App"
                    isDisabled={!props.appSlug.trim() || props.busy}
                    isLoading={props.busy}
                    clickAction={props.onAttach}
                  />
                </div>
                <div className="admin-categories-apps">
                  <h3>Assigned Apps</h3>
                  {props.apps.length === 0 ? (
                    <p>No Apps are assigned to this Category.</p>
                  ) : (
                    <ul>
                      {props.apps.map((app) => (
                        <li key={app.id}>
                          <span><strong>{app.name}</strong><code>{app.slug}</code></span>
                          <Button
                            label={`Remove ${app.name}`}
                            size="sm"
                            variant="ghost"
                            isDisabled={props.busy}
                            clickAction={() => props.onDetach(app)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="admin-categories-state">
                <h2>Select a Category</h2>
                <p>Choose a Category to manage its assigned Apps.</p>
              </div>
            )}
          </Card>
        </div>
      )}

      <Dialog
        isOpen={Boolean(props.editing)}
        onOpenChange={(open) => { if (!open) props.onEditingChange(null); }}
        purpose="form"
        width={460}
      >
        {props.editing && (
          <div className="admin-categories-dialog">
            <h2>Edit Category</h2>
            <TextInput
              label="Category name"
              value={props.editing.name}
              onChange={(name) => props.onEditingChange({ ...props.editing!, name })}
              width="100%"
            />
            <TextInput
              label="Category slug"
              value={props.editing.slug}
              onChange={(slug) => props.onEditingChange({ ...props.editing!, slug })}
              width="100%"
            />
            <p>Changing this slug may break saved Category URLs.</p>
            <div>
              <Button label="Cancel" variant="ghost" clickAction={() => props.onEditingChange(null)} />
              <Button
                label="Save Category"
                variant="primary"
                isDisabled={!canSave || props.busy}
                isLoading={props.busy}
                clickAction={props.onSave}
              />
            </div>
          </div>
        )}
      </Dialog>

      <AlertDialog
        isOpen={Boolean(props.deleting)}
        onOpenChange={(open) => { if (!open) props.onDelete(null); }}
        title={props.deleting ? `Delete ${props.deleting.name}?` : 'Delete Category?'}
        description={props.deleting
          ? `This removes the Category from ${props.deleting.appCount} assigned Apps. The Apps themselves are not deleted.`
          : ''}
        actionLabel="Delete Category"
        isActionLoading={props.busy}
        onAction={props.onConfirmDelete}
      />
    </main>
  );
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategorySummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [apps, setApps] = useState<CategoryApp[]>([]);
  const [draft, setDraft] = useState<CategoryDraft>({ name: '', slug: '' });
  const [editing, setEditing] = useState<CategorySummary | null>(null);
  const [deleting, setDeleting] = useState<CategorySummary | null>(null);
  const [appSlug, setAppSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const next = await listCategories();
    setCategories(next);
    setSelectedId((current) =>
      current && next.some(({ id }) => id === current)
        ? current
        : next[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void refresh().catch((cause: Error) => setError(cause.message));
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setApps([]);
      return;
    }
    void listCategoryApps(selectedId)
      .then(setApps)
      .catch((cause: Error) => setError(cause.message));
  }, [selectedId]);

  const perform = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = () => perform(async () => {
    await createCategory({ name: draft.name.trim(), slug: draft.slug.trim() });
    setDraft({ name: '', slug: '' });
    await refresh();
  });

  const save = () => perform(async () => {
    if (!editing) return;
    await updateCategory(editing.id, {
      name: editing.name.trim(),
      slug: editing.slug.trim(),
    });
    setEditing(null);
    await refresh();
  });

  const remove = () => perform(async () => {
    if (!deleting) return;
    await deleteCategory(deleting.id);
    setDeleting(null);
    await refresh();
  });

  const attach = () => perform(async () => {
    if (!selectedId || !appSlug.trim()) return;
    await attachCategoryApp(selectedId, appSlug.trim());
    setApps(await listCategoryApps(selectedId));
    setAppSlug('');
    await refresh();
  });

  const detach = (app: CategoryApp) => perform(async () => {
    if (!selectedId) return;
    await detachCategoryApp(selectedId, app.slug);
    setApps(await listCategoryApps(selectedId));
    await refresh();
  });

  return (
    <CategoriesPageView
      categories={categories}
      selectedId={selectedId}
      apps={apps}
      draft={draft}
      editing={editing}
      deleting={deleting}
      appSlug={appSlug}
      busy={busy}
      error={error}
      onSelect={setSelectedId}
      onDraftChange={setDraft}
      onCreate={() => void create()}
      onEdit={setEditing}
      onEditingChange={setEditing}
      onSave={() => void save()}
      onDelete={setDeleting}
      onConfirmDelete={() => void remove()}
      onAppSlugChange={setAppSlug}
      onAttach={() => void attach()}
      onDetach={(app) => void detach(app)}
    />
  );
}
