import { useMemo, useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  Switch,
  TextArea,
  TextInput,
} from '@astryxdesign/core';
import { AstryxAlertModal, AstryxModal } from './AstryxModal.tsx';
import type { ResearchCollection } from '../../db.ts';
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

interface CollectionPickerProps {
  reference?: SaveReference;
  references?: SaveReference[];
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  plan: 'free' | 'pro';
  onUpgrade?: () => void;
  onStatus?: (message: string) => void;
  dark?: boolean;
  buttonLabel?: string;
  buttonClassName?: string;
  buttonVariant?: 'ghost' | 'primary' | 'secondary';
  suppressSavedLabel?: boolean;
}

export function CollectionPicker({
  reference,
  references: referenceList,
  collections,
  onCollectionsChange,
  plan,
  onUpgrade,
  onStatus,
  dark,
  buttonLabel = 'Save to collection',
  buttonClassName,
  buttonVariant = 'ghost',
  suppressSavedLabel = false,
}: CollectionPickerProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmUnsaveOpen, setConfirmUnsaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const references = useMemo(
    () => dedupeSaveReferences([
      ...(reference ? [reference] : []),
      ...(referenceList ?? []),
    ]),
    [reference, referenceList],
  );
  const savedCollection = collections.find(isSavedCollection);
  const customCollections = collections.filter((collection) => !isSavedCollection(collection));
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
    onStatus?.(message);
  };

  const ensureSavedCollection = async () => (
    collections.find(isSavedCollection)
    ?? await createCollection('Saved', 'Screens and references saved from Vitrine.')
  );

  const saveReferences = async (collectionId?: number) => {
    if (!references.length) return;
    setBusy(true);
    setError('');
    try {
      const allSaved = await ensureSavedCollection();
      const destinationIds = [...new Set([
        allSaved.id,
        ...(collectionId ? [collectionId] : []),
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
      await saveReferences(collection.id);
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
      setIsPrivate(false);
      report(references.length === 1 ? 'Saved' : `${references.length} screens saved`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const allowCollectionCreation = plan === 'pro' || customCollections.length === 0;
  const displayLabel = fullySaved && !suppressSavedLabel ? 'Saved' : buttonLabel;

  return (
    <div
      className="collection-picker"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu
        isMenuOpen={open}
        onOpenChange={setOpen}
        button={{
          label: displayLabel,
          size: 'sm',
          variant: buttonVariant,
          isDisabled: busy || !references.length,
          className: buttonClassName,
          style: dark && buttonVariant !== 'primary'
            ? {
                border: '1px solid var(--color-border-emphasized)',
                background: fullySaved
                  ? 'var(--color-background-muted)'
                  : 'var(--color-background-surface)',
                color: 'var(--color-text-primary)',
                borderRadius: 999,
              }
            : { borderRadius: 999 },
        }}
      >
        <DropdownMenuItem
          label="All saved"
          startContent={<Icon icon="viewColumns" size="sm" />}
          endContent={fullyInSavedCollection ? <Icon icon="check" size="sm" /> : undefined}
          onClick={() => {
            if (fullyInSavedCollection) {
              setOpen(false);
              setConfirmUnsaveOpen(true);
            } else {
              void saveReferences();
            }
          }}
          isDisabled={busy}
        />
        {customCollections.map((collection) => {
          const collectionHasEveryReference = references.length > 0
            && references.every((candidate) =>
              collection.items.some((item) =>
                referenceMatchesCollectionItem(candidate, item)));
          return (
            <DropdownMenuItem
              key={collection.id}
              label={collection.name}
              endContent={collectionHasEveryReference
                ? <Icon icon="check" size="sm" />
                : collection.items.length}
              onClick={() => {
                if (collectionHasEveryReference) {
                  void removeFromCollection(collection);
                } else {
                  void saveReferences(collection.id);
                }
              }}
              isDisabled={busy}
            />
          );
        })}
        {allowCollectionCreation ? (
          <DropdownMenuItem
            label="Create collection"
            onClick={() => {
              setOpen(false);
              setCreateOpen(true);
            }}
            isDisabled={busy}
          />
        ) : (
          <DropdownMenuItem
            label="Upgrade for more collections"
            onClick={onUpgrade}
            isDisabled={busy}
          />
        )}
      </DropdownMenu>

      <AstryxModal
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
        purpose="form"
        width={560}
        padding={0}
        className="collection-create-dialog"
        aria-label="New collection"
      >
        <form
          className="collection-create-dialog__form"
          onSubmit={(event) => {
            event.preventDefault();
            void createAndSave();
          }}
        >
          <header className="collection-create-dialog__header">
            <h2>New collection</h2>
            <Button
              label="Close"
              variant="ghost"
              size="sm"
              onClick={() => setCreateOpen(false)}
            />
          </header>
          <div className="collection-create-dialog__fields">
            <TextInput
              label="Name"
              value={name}
              onChange={setName}
              placeholder="I.e. “Dark Mode”"
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
            <Switch
              label="Private"
              description="Only you can view this collection and its comments."
              value={isPrivate}
              onChange={setIsPrivate}
              labelSpacing="spread"
              width="100%"
            />
          </div>
          <footer className="collection-create-dialog__footer">
            <Button
              label="Cancel"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
            />
            <Button
              label="Create"
              variant="primary"
              isDisabled={!name.trim()}
              isLoading={busy}
              onClick={() => void createAndSave()}
            />
          </footer>
        </form>
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
