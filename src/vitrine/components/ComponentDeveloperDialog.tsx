import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core';
import type { ComponentBundle } from '../componentBundles.ts';
import type { ComponentRecord } from '../componentLibraryCatalog.ts';
import { ComponentLibraryPreview } from './ComponentLibraryPreview.tsx';

type DeveloperTab = 'preview' | 'code' | 'usage' | 'evidence';

export function ComponentDeveloperDialog({
  bundle,
  item,
  onClose,
  sourceIconUrl,
}: {
  bundle: ComponentBundle;
  item: ComponentRecord;
  onClose: () => void;
  sourceIconUrl: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<DeveloperTab>('preview');
  const [selectedPath, setSelectedPath] = useState(bundle.files[0]?.path ?? '');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const selectedFile = useMemo(
    () => bundle.files.find((file) => file.path === selectedPath) ?? bundle.files[0],
    [bundle.files, selectedPath],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleClose = () => onClose();
    const handleCancel = (event: Event) => {
      event.preventDefault();
      dialog.close();
    };
    document.body.style.overflow = 'hidden';
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  const copyFile = async () => {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.source);
    setCopiedPath(selectedFile.path);
    window.setTimeout(() => setCopiedPath(null), 1400);
  };

  return (
    <dialog aria-label={`${bundle.name} developer library`} className="component-developer-dialog" ref={dialogRef}>
      <header className="component-developer-dialog__header">
        <div>
          <span>Generated React component</span>
          <h2>{bundle.name}</h2>
        </div>
        <form method="dialog">
          <Button aria-label="Close developer library" label="×" ref={closeRef} type="submit" variant="ghost" />
        </form>
      </header>

      <div aria-label="Component bundle sections" className="component-developer-dialog__tabs" role="tablist">
        {(['preview', 'code', 'usage', 'evidence'] as const).map((option) => (
          <Button
            aria-selected={tab === option}
            key={option}
            label={option[0].toUpperCase() + option.slice(1)}
            onClick={() => setTab(option)}
            role="tab"
            variant="ghost"
          />
        ))}
      </div>

      <main className="component-developer-dialog__body">
        {tab === 'preview' ? (
          <section className="component-developer-dialog__preview" role="tabpanel">
            <ComponentLibraryPreview item={item} sourceIconUrl={sourceIconUrl} surface="full" />
          </section>
        ) : null}

        {tab === 'code' && selectedFile ? (
          <section className="component-developer-dialog__code" role="tabpanel">
            <aside aria-label="Bundle files">
              {bundle.files.map((file) => (
                <Button
                  aria-pressed={file.path === selectedFile.path}
                  key={file.path}
                  label={file.path}
                  onClick={() => setSelectedPath(file.path)}
                  variant="ghost"
                />
              ))}
            </aside>
            <div>
              <header>
                <span>{selectedFile.path}</span>
                <Button
                  label={copiedPath === selectedFile.path ? 'Copied' : 'Copy file'}
                  onClick={copyFile}
                  variant="secondary"
                />
              </header>
              <pre><code>{selectedFile.source}</code></pre>
            </div>
          </section>
        ) : null}

        {tab === 'usage' ? (
          <section className="component-developer-dialog__usage" role="tabpanel">
            <div>
              <span>Dependencies</span>
              <p>{bundle.dependencies.join(' · ')}</p>
            </div>
            <div>
              <span>Assets</span>
              <p>{bundle.assets.length ? bundle.assets.join(' · ') : 'No external assets'}</p>
            </div>
            <pre><code>{bundle.usage}</code></pre>
          </section>
        ) : null}

        {tab === 'evidence' ? (
          <section className="component-developer-dialog__evidence" role="tabpanel">
            <div className="component-developer-dialog__confidence">
              <span>Reconstruction confidence</span>
              <strong>{Math.round(bundle.confidence * 100)}%</strong>
            </div>
            <ul>
              {bundle.evidence.map((entry) => (
                <li key={`${entry.kind}:${entry.detail}`}>
                  <span data-evidence-kind={entry.kind}>{entry.kind}</span>
                  <p>{entry.detail}</p>
                </li>
              ))}
            </ul>
            <h3>Known unknowns</h3>
            <ul>
              {bundle.unknowns.map((unknown) => <li key={unknown}><p>{unknown}</p></li>)}
            </ul>
            <a href={bundle.sourceUrl} rel="noreferrer" target="_blank">Open source evidence ↗</a>
          </section>
        ) : null}
      </main>
    </dialog>
  );
}
