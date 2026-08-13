import { useMemo, useState } from 'react';
import {
  Button,
  Icon,
  TextArea,
  TextInput,
} from '@astryxdesign/core';
import { AstryxAlertModal, AstryxModal } from './AstryxModal.tsx';
import type { ResearchCollection } from '../../db.ts';
import type { DesignerCanvasFileSummary } from '../../designerCanvas.ts';
import type { ResearchProjectSummary } from '../../researchProject.ts';
import {
  storeCanvasScreenInsertBatch,
  storeCanvasScreenInsertIntent,
  type CanvasScreenInsertItem,
} from '../canvasInsertIntent.ts';
import {
  storeProjectDocumentFlowInsertIntent,
  type ProjectDocumentFlowInsertItem,
} from '../projectDocumentFlowInsertIntent.ts';
import { listDesignerCanvases } from '../designerCanvasApi.ts';
import {
  createCollection,
  listCollections,
  removeCollectionItem,
  saveCollectionItem,
  type SaveReference,
} from '../researchApi.ts';
import {
  areReferencesSaved,
  dedupeSaveReferences,
  isSavedCollection,
  matchingCollectionItems,
  referenceMatchesCollectionItem,
} from '../screenActions.ts';
import { listResearchProjects } from '../researchProjectsApi.ts';
import { navigate } from '../router.ts';
import { useApplicationToast } from './ApplicationToast.tsx';

interface CollectionPickerProps {
  reference?: SaveReference;
  references?: SaveReference[];
  canvasItems?: CanvasScreenInsertItem[];
  documentFlow?: ProjectDocumentFlowInsertItem;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  plan: 'free' | 'pro';
  onUpgrade?: () => void;
  dark?: boolean;
  buttonLabel?: string;
  buttonClassName?: string;
  buttonVariant?: 'ghost' | 'primary' | 'secondary';
  suppressSavedLabel?: boolean;
}

interface CanvasDestination {
  project: ResearchProjectSummary;
  canvas: DesignerCanvasFileSummary;
}

export function CollectionPicker({
  reference,
  references: referenceList,
  canvasItems: canvasItemList = [],
  documentFlow,
  collections,
  onCollectionsChange,
  plan,
  onUpgrade,
  dark,
  buttonLabel = 'Use in project',
  buttonClassName,
  buttonVariant = 'ghost',
  suppressSavedLabel = false,
}: CollectionPickerProps) {
  const showApplicationToast = useApplicationToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmUnsaveOpen, setConfirmUnsaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<Set<number | 'saved'>>(() => new Set());
  const [destinationType, setDestinationType] = useState<'collections' | 'canvas' | 'document'>('collections');
  const [canvasDestinations, setCanvasDestinations] = useState<CanvasDestination[]>([]);
  const [canvasDestinationsLoaded, setCanvasDestinationsLoaded] = useState(false);
  const [selectedCanvasKeys, setSelectedCanvasKeys] = useState<Set<string>>(() => new Set());
  const [documentProjects, setDocumentProjects] = useState<ResearchProjectSummary[]>([]);
  const [documentProjectsLoaded, setDocumentProjectsLoaded] = useState(false);
  const [selectedDocumentProjectId, setSelectedDocumentProjectId] = useState("");

  const references = useMemo(
    () => dedupeSaveReferences([
      ...(reference ? [reference] : []),
      ...(referenceList ?? []),
    ]),
    [reference, referenceList],
  );
  const savedCollection = collections.find(isSavedCollection);
  const customCollections = collections.filter((collection) => collection.id !== savedCollection?.id);
  const fullySaved = areReferencesSaved(collections, references);
  const fullyInSavedCollection = Boolean(
    savedCollection
    && references.length
    && references.every((candidate) =>
      savedCollection.items.some((item) =>
        referenceMatchesCollectionItem(candidate, item))),
  );

  const refresh = async () => {
    const next = await listCollections();
    onCollectionsChange(next);
    return next;
  };

  const report = (message: string) => {
    setError('');
    showApplicationToast(message);
  };

  const ensureSavedCollection = async () => {
    const existing = collections.find(isSavedCollection);
    if (existing) return existing;

    // The picker can be opened while its route-level collection hydration is
    // still in flight. Recheck the server before creating the reserved Saved
    // collection so a fast click cannot create a duplicate.
    const current = await listCollections();
    const hydrated = current.find(isSavedCollection);
    if (hydrated) {
      onCollectionsChange(current);
      return hydrated;
    }
    return createCollection('Saved', 'Screens and references saved from Vitrines.');
  };

  const saveReferences = async (collectionIds: readonly number[] = []) => {
    if (!references.length) return;
    setBusy(true);
    setError('');
    try {
      const allSaved = await ensureSavedCollection();
      const destinationIds = [...new Set([
        allSaved.id,
        ...collectionIds,
      ])];
      await Promise.all(
        destinationIds.flatMap((destinationId) =>
          references.map((candidate) =>
            saveCollectionItem(destinationId, candidate))),
      );
      await refresh();
      setOpen(false);
      report(references.length === 1 ? 'Saved' : `${references.length} screens saved`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeFromCollection = async (collection: ResearchCollection) => {
    const items = collection.items.filter((item) =>
      references.some((candidate) =>
        referenceMatchesCollectionItem(candidate, item)));
    if (!items.length) {
      await saveReferences([collection.id]);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await Promise.all(items.map((item) =>
        removeCollectionItem(collection.id, item.id)));
      await refresh();
      setOpen(false);
      report(`Removed from ${collection.name}`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unsaveEverywhere = async () => {
    setBusy(true);
    setError('');
    try {
      const matches = references.flatMap((candidate) =>
        matchingCollectionItems(collections, candidate));
      await Promise.all(matches.map(({ collection, item }) =>
        removeCollectionItem(collection.id, item.id)));
      await refresh();
      setConfirmUnsaveOpen(false);
      setOpen(false);
      report(references.length === 1 ? 'Unsaved' : `${references.length} screens unsaved`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createAndSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !references.length) return;
    setBusy(true);
    setError('');
    try {
      const collection = await createCollection(trimmedName, description.trim());
      const allSaved = await ensureSavedCollection();
      const destinationIds = [...new Set([allSaved.id, collection.id])];
      await Promise.all(
        destinationIds.flatMap((destinationId) =>
          references.map((candidate) =>
            saveCollectionItem(destinationId, candidate))),
      );
      await refresh();
      setCreateOpen(false);
      setOpen(false);
      setName('');
      setDescription('');
      report(references.length === 1 ? 'Saved' : `${references.length} screens saved`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const allowCollectionCreation = plan === 'pro' || customCollections.length === 0;
  const displayLabel = fullySaved && !suppressSavedLabel ? 'Saved' : buttonLabel;
  const selectedCollections = customCollections.filter((collection) => selectedDestinationIds.has(collection.id));
  const selectedDestinationNames = [
    ...(selectedDestinationIds.has('saved') ? ['Saved'] : []),
    ...selectedCollections.map((collection) => collection.name),
  ];
  const selectedDestinationContainsEveryReference = selectedDestinationIds.size === 1
    && (selectedDestinationIds.has('saved')
      ? fullyInSavedCollection
      : selectedCollections.length === 1
        && references.length > 0
        && references.every((candidate) =>
          selectedCollections[0].items.some((item) =>
            referenceMatchesCollectionItem(candidate, item))));

  const saveToSelectedDestination = () => {
    if (selectedDestinationIds.size === 1 && selectedDestinationIds.has('saved')) {
      if (fullyInSavedCollection) {
        setOpen(false);
        setConfirmUnsaveOpen(true);
      } else {
        void saveReferences();
      }
      return;
    }
    if (!selectedCollections.length) return;
    if (selectedDestinationContainsEveryReference) {
      void removeFromCollection(selectedCollections[0]);
    } else {
      void saveReferences(selectedCollections.map((collection) => collection.id));
    }
  };

  const toggleCollectionDestination = (destinationId: number | 'saved') => {
    setSelectedDestinationIds((current) => {
      const next = new Set(current);
      if (next.has(destinationId)) next.delete(destinationId);
      else next.add(destinationId);
      return next;
    });
  };

  const openCanvasDestinations = async () => {
    setDestinationType('canvas');
    if (canvasDestinationsLoaded) return;
    setError('');
    setBusy(true);
    try {
      const projects = (await listResearchProjects())
        .filter((project) => project.access?.role !== 'viewer');
      const grouped = await Promise.all(projects.map(async (project) => ({
        project,
        canvases: await listDesignerCanvases(project.id),
      })));
      setCanvasDestinations(grouped.flatMap(({ project, canvases }) =>
        canvases.map((canvas) => ({ project, canvas }))));
      setCanvasDestinationsLoaded(true);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addToCanvas = () => {
    const selectedCanvasDestinations = canvasDestinations.filter(({ project, canvas }) =>
      selectedCanvasKeys.has(`${project.id}:${canvas.id}`));
    if (!selectedCanvasDestinations.length || !canvasItemList.length) return;
    setError('');
    try {
      const uniqueItems = [...new Map(
        canvasItemList.map((item) => [`${item.appId}:${item.screen.id}`, item]),
      ).values()];
      const insert = selectedCanvasDestinations.length === 1
        ? storeCanvasScreenInsertIntent(uniqueItems)
        : storeCanvasScreenInsertBatch(uniqueItems, selectedCanvasDestinations.map(({ project, canvas }) => ({
          projectId: project.id,
          canvasId: canvas.id,
        })));
      setOpen(false);
      navigate({
        name: 'project-canvas',
        projectId: selectedCanvasDestinations[0].project.id,
        canvasId: selectedCanvasDestinations[0].canvas.id,
        insert,
      });
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  const openDocumentDestinations = async () => {
    setDestinationType('document');
    if (documentProjectsLoaded) return;
    setError('');
    setBusy(true);
    try {
      setDocumentProjects((await listResearchProjects())
        .filter((project) => project.access?.role !== 'viewer'));
      setDocumentProjectsLoaded(true);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addToProjectDocument = () => {
    if (!documentFlow || !selectedDocumentProjectId) return;
    setError('');
    try {
      storeProjectDocumentFlowInsertIntent(selectedDocumentProjectId, documentFlow);
      setOpen(false);
      navigate({ name: 'project-document', projectId: selectedDocumentProjectId });
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  const selectedCanvasDestinations = canvasDestinations.filter(({ project, canvas }) =>
    selectedCanvasKeys.has(`${project.id}:${canvas.id}`));

  return (
    <div
      className="collection-picker"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button
        label={displayLabel}
        size="sm"
        variant={buttonVariant}
        isDisabled={busy || !references.length}
        className={buttonClassName}
        onClick={() => {
          setError('');
          setSelectedDestinationIds(new Set());
          setCreateOpen(false);
          setDestinationType('collections');
          setSelectedCanvasKeys(new Set());
          setCanvasDestinations([]);
          setCanvasDestinationsLoaded(false);
          setDocumentProjects([]);
          setDocumentProjectsLoaded(false);
          setSelectedDocumentProjectId("");
          setOpen(true);
        }}
        style={dark && buttonVariant !== 'primary'
          ? {
              border: '1px solid var(--color-border-emphasized)',
              background: fullySaved
                ? 'var(--color-background-muted)'
                : 'var(--color-background-surface)',
              color: 'var(--color-text-primary)',
              borderRadius: 999,
            }
          : { borderRadius: 999 }}
      />

      <AstryxModal
        isOpen={open || createOpen}
        onOpenChange={(isModalOpen) => {
          if (!isModalOpen) {
            setOpen(false);
            setCreateOpen(false);
            setDestinationType('collections');
          }
        }}
        purpose="form"
        width={560}
        padding={0}
        className="collection-create-dialog collection-picker__dialog"
        aria-label={createOpen ? 'Create collection' : 'Use in project'}
      >
        {createOpen ? (
          <form
            className="collection-create-dialog__form"
            onSubmit={(event) => {
              event.preventDefault();
              void createAndSave();
            }}
          >
            <header className="collection-create-dialog__header">
              <div>
                <h2>Create a collection</h2>
                <p>Keep this screen with the references you want to revisit.</p>
              </div>
              <Button
                label="Close"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreateOpen(false);
                  setOpen(false);
                }}
              />
            </header>
            <div className="collection-create-dialog__fields">
              <TextInput
                label="Name"
                value={name}
                onChange={setName}
                placeholder="E.g. Dark mode"
                hasAutoFocus
                width="100%"
              />
              <TextArea
                label="Description"
                value={description}
                onChange={setDescription}
                placeholder="How would you describe this collection?"
                rows={3}
                width="100%"
              />
            </div>
            <footer className="collection-create-dialog__footer">
              <Button
                label="Back"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              />
              <Button
                label="Create and save"
                variant="primary"
                isDisabled={!name.trim()}
                isLoading={busy}
                onClick={() => void createAndSave()}
              />
            </footer>
          </form>
        ) : (
          <section className="collection-picker__dialog-surface">
            <header className="collection-picker__dialog-header">
              <div>
                <h2>Use in project</h2>
                <p>{references.length === 1 ? 'Send this reference to a collection, Canvas, or project brief.' : `Send ${references.length} references to a collection or Canvas.`}</p>
              </div>
              <Button
                label="Close"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              />
            </header>
            <div className="collection-picker__destination-tabs" role="tablist" aria-label="Save destination">
              <button
                type="button"
                role="tab"
                aria-selected={destinationType === 'collections'}
                className={destinationType === 'collections' ? 'is-selected' : ''}
                onClick={() => setDestinationType('collections')}
              >
                Collections
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={destinationType === 'canvas'}
                className={destinationType === 'canvas' ? 'is-selected' : ''}
                onClick={() => void openCanvasDestinations()}
                disabled={!canvasItemList.length}
              >
                Canvas
              </button>
              <Button
                label="Project brief"
                variant="ghost"
                role="tab"
                aria-selected={destinationType === 'document'}
                className={destinationType === 'document' ? 'is-selected' : ''}
                onClick={() => void openDocumentDestinations()}
                isDisabled={!documentFlow}
              />
            </div>
            <div className="collection-picker__dialog-body">
              {destinationType === 'collections' ? <>
                <div className="collection-picker__destination-list" role="listbox" aria-label="Choose collections" aria-multiselectable="true">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedDestinationIds.has('saved')}
                    className={`collection-picker__destination${fullyInSavedCollection ? ' is-saved' : ''}${selectedDestinationIds.has('saved') ? ' is-selected' : ''}`}
                    onClick={() => toggleCollectionDestination('saved')}
                    disabled={busy}
                  >
                    <span className="collection-picker__destination-icon" aria-hidden="true">
                      <Icon icon="viewColumns" size="sm" />
                    </span>
                    <span>
                      <strong>Saved</strong>
                      {!fullyInSavedCollection ? <small>Your saved screens</small> : null}
                    </span>
                    <span className="collection-picker__destination-status" aria-hidden="true">
                      {fullyInSavedCollection || selectedDestinationIds.has('saved') ? <Icon icon="check" size="sm" /> : null}
                    </span>
                  </button>
                  {customCollections.map((collection) => {
                    const collectionHasEveryReference = references.length > 0
                      && references.every((candidate) =>
                        collection.items.some((item) =>
                          referenceMatchesCollectionItem(candidate, item)));
                    return (
                      <button
                        key={collection.id}
                        type="button"
                        role="option"
                        aria-selected={selectedDestinationIds.has(collection.id)}
                        className={`collection-picker__destination${collectionHasEveryReference ? ' is-saved' : ''}${selectedDestinationIds.has(collection.id) ? ' is-selected' : ''}`}
                        onClick={() => toggleCollectionDestination(collection.id)}
                        disabled={busy}
                      >
                        <span className="collection-picker__destination-icon" aria-hidden="true">
                          <Icon icon="folder" size="sm" />
                        </span>
                        <span>
                          <strong>{collection.name}</strong>
                          {!collectionHasEveryReference ? <small>{`${collection.items.length} saved screens`}</small> : null}
                        </span>
                        <span className="collection-picker__destination-status" aria-hidden="true">
                          {collectionHasEveryReference || selectedDestinationIds.has(collection.id) ? <Icon icon="check" size="sm" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {allowCollectionCreation ? (
                  <Button
                    label="Create new collection"
                    variant="ghost"
                    className="collection-picker__create-action"
                    onClick={() => setCreateOpen(true)}
                    isDisabled={busy}
                  />
                ) : (
                  <Button
                    label="Upgrade for more collections"
                    variant="secondary"
                    className="collection-picker__create-action"
                    onClick={onUpgrade}
                    isDisabled={busy}
                  />
                )}
              </> : destinationType === 'canvas' ? (
                <div className="collection-picker__destination-list" role="listbox" aria-label="Choose canvases" aria-multiselectable="true">
                  {busy && !canvasDestinationsLoaded ? (
                    <p className="collection-picker__empty">Loading canvases…</p>
                  ) : canvasDestinations.length ? canvasDestinations.map(({ project, canvas }) => (
                    <button
                      key={`${project.id}:${canvas.id}`}
                      type="button"
                      role="option"
                      aria-selected={selectedCanvasKeys.has(`${project.id}:${canvas.id}`)}
                      className={`collection-picker__destination${selectedCanvasKeys.has(`${project.id}:${canvas.id}`) ? ' is-selected' : ''}`}
                      onClick={() => {
                        const key = `${project.id}:${canvas.id}`;
                        setSelectedCanvasKeys((current) => {
                          const next = new Set(current);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      }}
                      disabled={busy}
                    >
                      <span className="collection-picker__destination-icon" aria-hidden="true">
                        <Icon icon="viewColumns" size="sm" />
                      </span>
                      <span>
                        <strong>{canvas.title}</strong>
                        <small>{project.title}{project.organization?.name ? ` · ${project.organization.name}` : ''}</small>
                      </span>
                      <span className="collection-picker__destination-status" aria-hidden="true">
                        {selectedCanvasKeys.has(`${project.id}:${canvas.id}`)
                          ? <Icon icon="check" size="sm" />
                          : null}
                      </span>
                    </button>
                  )) : (
                    <p className="collection-picker__empty">No editable canvases yet.</p>
                  )}
                </div>
              ) : (
                <div className="collection-picker__destination-list" role="listbox" aria-label="Choose a project brief">
                  {busy && !documentProjectsLoaded ? (
                    <p className="collection-picker__empty">Loading project briefs…</p>
                  ) : documentProjects.length ? documentProjects.map((project) => (
                    <Button
                      key={project.id}
                      label={`Use ${project.title} project brief`}
                      variant="ghost"
                      role="option"
                      aria-selected={selectedDocumentProjectId === project.id}
                      className={`collection-picker__destination${selectedDocumentProjectId === project.id ? ' is-selected' : ''}`}
                      onClick={() => setSelectedDocumentProjectId(project.id)}
                      isDisabled={busy}
                    >
                      <span className="collection-picker__destination-icon" aria-hidden="true">
                        <Icon icon="viewColumns" size="sm" />
                      </span>
                      <span>
                        <strong>{project.title}</strong>
                        <small>Insert this Flow into the collaborative project document</small>
                      </span>
                      <span className="collection-picker__destination-status" aria-hidden="true">
                        {selectedDocumentProjectId === project.id ? <Icon icon="check" size="sm" /> : null}
                      </span>
                    </Button>
                  )) : (
                    <p className="collection-picker__empty">No editable projects yet.</p>
                  )}
                </div>
              )}
            </div>
            <footer className="collection-picker__dialog-footer">
              {destinationType === 'collections' ? <>
                <span>{selectedDestinationNames.length
                  ? selectedDestinationContainsEveryReference
                    ? `Already saved in ${selectedDestinationNames[0]}`
                    : `Save to ${selectedDestinationNames.length} ${selectedDestinationNames.length === 1 ? 'collection' : 'collections'}`
                  : 'Choose a collection'}</span>
                <Button
                  label={selectedDestinationContainsEveryReference
                    ? selectedDestinationIds.has('saved') ? 'Unsave' : 'Remove'
                    : `Save${selectedDestinationNames.length > 1 ? ` to ${selectedDestinationNames.length}` : ''}`}
                  variant="primary"
                  isDisabled={!selectedDestinationIds.size}
                  isLoading={busy}
                  onClick={saveToSelectedDestination}
                />
              </> : destinationType === 'canvas' ? <>
                <span>{selectedCanvasDestinations.length
                  ? `Add to ${selectedCanvasDestinations.length} ${selectedCanvasDestinations.length === 1 ? 'canvas' : 'canvases'}`
                  : 'Choose a canvas'}</span>
                <Button
                  label="Add to canvas"
                  variant="primary"
                  onClick={addToCanvas}
                  isDisabled={!selectedCanvasDestinations.length || busy}
                />
              </> : <>
                <span>{selectedDocumentProjectId
                  ? 'Insert this Flow into the selected project brief'
                  : 'Choose a project brief'}</span>
                <Button
                  label="Add to project brief"
                  variant="primary"
                  onClick={addToProjectDocument}
                  isDisabled={!selectedDocumentProjectId || busy}
                />
              </>}
            </footer>
          </section>
        )}
      </AstryxModal>

      <AstryxAlertModal
        isOpen={confirmUnsaveOpen}
        onOpenChange={setConfirmUnsaveOpen}
        title="Are you sure?"
        description={`This will unsave ${references.length === 1 ? 'the screen' : `${references.length} screens`} from Saved and all of your collections.`}
        actionLabel="Unsave"
        isActionLoading={busy}
        onAction={() => void unsaveEverywhere()}
      />

      {error ? (
        <span role="alert" className="collection-picker__error">{error}</span>
      ) : null}
    </div>
  );
}
