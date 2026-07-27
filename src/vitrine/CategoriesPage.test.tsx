import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CategoriesPageView } from './components/CategoriesPage.tsx';

const categories = [
  { id: 2, name: 'Business', slug: 'business', appCount: 127 },
  { id: 7, name: 'Productivity', slug: 'productivity', appCount: 101 },
];

const props = {
  categories,
  selectedId: 7,
  apps: [{ id: 42, slug: 'linear', name: 'Linear' }],
  draft: { name: '', slug: '' },
  editing: null,
  deleting: null,
  appSlug: '',
  busy: false,
  error: '',
  onSelect: () => undefined,
  onDraftChange: () => undefined,
  onCreate: () => undefined,
  onEdit: () => undefined,
  onEditingChange: () => undefined,
  onSave: () => undefined,
  onDelete: () => undefined,
  onConfirmDelete: () => undefined,
  onAppSlugChange: () => undefined,
  onAttach: () => undefined,
  onDetach: () => undefined,
};

test('shows Category identity, distinct App count, and assigned Apps', () => {
  const html = renderToStaticMarkup(<CategoriesPageView {...props} />);

  assert.match(html, /Categories/);
  assert.match(html, /Business/);
  assert.match(html, /business/);
  assert.match(html, /127 apps/);
  assert.match(html, /Productivity/);
  assert.match(html, /101 apps/);
  assert.match(html, /Assigned Apps/);
  assert.match(html, /Linear/);
  assert.match(html, /linear/);
});

test('requires both create fields and warns before editing a slug', () => {
  const blank = renderToStaticMarkup(<CategoriesPageView {...props} />);
  assert.match(blank, /Create Category/);
  assert.match(blank, /disabled=""/);

  const editing = renderToStaticMarkup(<CategoriesPageView
    {...props}
    editing={categories[1]}
  />);
  assert.match(editing, /Edit Category/);
  assert.match(editing, /Changing this slug may break saved Category URLs\./);
});

test('shows the affected App count before deleting a Category', () => {
  const html = renderToStaticMarkup(<CategoriesPageView
    {...props}
    deleting={categories[1]}
  />);

  assert.match(html, /Delete Productivity\?/);
  assert.match(html, /101 assigned Apps/);
});
