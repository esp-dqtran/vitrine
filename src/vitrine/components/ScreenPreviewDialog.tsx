import { Button, Icon, IconButton } from '@astryxdesign/core';
import { useState } from 'react';
import type { ResearchCollection } from '../../db.ts';
import type { Screen } from '../types.ts';
import { copyScreenImageAsPng, copyShareLink } from '../screenActions.ts';
import { CollectionPicker } from './CollectionPicker.tsx';
import { CopyButton, useCopyAction } from './CopyButton.tsx';
import { PlaceholderImage } from './PlaceholderImage.tsx';
import { AstryxModal, AstryxModalSurface } from './AstryxModal.tsx';

interface ScreenPreviewDialogProps {
  appName: string;
  appIconUrl?: string | null;
  screen: Screen;
  index: number;
  total: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  appId?: string;
  collections?: ResearchCollection[];
  onCollectionsChange?: (collections: ResearchCollection[]) => void;
  plan?: 'free' | 'pro';
  foundInFlows?: string[];
}

const platformName = (platform: string) => {
  if (platform === 'ios') return 'iOS';
  if (platform === 'android') return 'Android';
  return 'Web';
};

const screenResolution = (screen: Screen) => {
  if (screen.platform === 'ios') return '393×852';
  if (screen.platform === 'android') return '412×915';
  return null;
};

const usefulLabel = (value: string | null | undefined) => (
  value && value !== 'Unclassified' ? value : null
);

export function ScreenPreviewDialog({
  appName,
  appIconUrl,
  screen,
  index,
  total,
  onClose,
  onNavigate,
  appId,
  collections,
  onCollectionsChange,
  plan = 'free',
  foundInFlows = [],
}: ScreenPreviewDialogProps) {
  const [savedScreens, setSavedScreens] = useState<Set<number>>(() => new Set());
  const [status, setStatus] = useState('');
  const [mediaFailed, setMediaFailed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const saved = savedScreens.has(screen.id);
  const context = foundInFlows[0]
    ?? usefulLabel(screen.productArea)
    ?? usefulLabel(screen.type);
  const additionalFlowCount = Math.max(0, foundInFlows.length - 1);
  const resolution = screenResolution(screen);

  const copyLinkAction = async () => {
    const value = typeof window === 'undefined'
      ? screen.url
      : (() => {
          const url = new URL(window.location.href);
          url.searchParams.set('utm_source', 'copy_link');
          url.searchParams.set('utm_medium', 'link');
          url.searchParams.set('utm_campaign', 'screen_sharing');
          return url.toString();
        })();
    await copyShareLink(value);
  };

  const {
    copy: copyLink,
    state: linkCopyState,
  } = useCopyAction({
    action: copyLinkAction,
    successMessage: 'Screen link copied',
  });

  const toggleSaved = () => {
    setSavedScreens((current) => {
      const next = new Set(current);
      if (next.has(screen.id)) next.delete(screen.id);
      else next.add(screen.id);
      return next;
    });
  };

  return (
    <AstryxModal
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      variant="fullscreen"
      purpose="info"
      padding={0}
      className="flow-preview-dialog-shell"
      aria-label={`${appName} screen ${index + 1} of ${total}`}
    >
      <AstryxModalSurface
        className="flow-preview-dialog app-screen-preview-dialog"
        data-app-screen-preview={screen.id}
      >
        <header className="flow-preview-dialog__header">
          <div className="flow-preview-dialog__identity">
            <span className="flow-preview-dialog__app flow-preview-dialog__app--static">
              {appIconUrl ? <img src={appIconUrl} alt="" /> : null}
              <strong>{appName}</strong>
            </span>
          </div>

          <div className="flow-preview-dialog__header-actions">
            <IconButton
              label={linkCopyState === 'copying' ? 'Copying…' : 'Copy link'}
              icon={<Icon icon="externalLink" size="sm" />}
              variant="ghost"
              onClick={() => void copyLink()}
            />
            <span className="flow-preview-dialog__divider" aria-hidden="true" />
            <IconButton
              label="Close screen preview"
              icon={<Icon icon="close" size="sm" />}
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
            />
          </div>
        </header>

        <div
          className="flow-preview-dialog__body app-screen-preview-dialog__body"
          role="group"
          aria-label={`${appName} screen viewer`}
        >
          <div className="flow-preview-dialog__prototype app-screen-preview-dialog__stage">
            <div
              className="flow-preview-dialog__screen flow-preview-dialog__prototype-screen app-screen-preview-dialog__screen"
              role="img"
              aria-label={screen.description ?? usefulLabel(screen.type) ?? `${appName} screen ${index + 1}`}
            >
              {mediaFailed ? (
                <PlaceholderImage
                  seed={`${appName}-${screen.id}`}
                  style={{ objectFit: 'cover', background: '#fff' }}
                />
              ) : (
                <img
                  key={screen.id}
                  src={screen.url}
                  alt=""
                  loading="eager"
                  onError={() => setMediaFailed(true)}
                />
              )}
            </div>
          </div>

          {index > 0 ? (
            <IconButton
              label="Previous screen"
              icon={<Icon icon="chevronLeft" size="md" />}
              variant="secondary"
              className="flow-preview-dialog__arrow flow-preview-dialog__arrow--left"
              onClick={() => {
                setMediaFailed(false);
                onNavigate(index - 1);
              }}
            />
          ) : null}
          {index < total - 1 ? (
            <IconButton
              label="Next screen"
              icon={<Icon icon="chevronRight" size="md" />}
              variant="secondary"
              className="flow-preview-dialog__arrow flow-preview-dialog__arrow--right"
              onClick={() => {
                setMediaFailed(false);
                onNavigate(index + 1);
              }}
            />
          ) : null}

          {context ? (
            <div className="app-screen-preview-dialog__context">
              <span>Found in</span>
              <strong>
                {context}
                {additionalFlowCount ? ` +${additionalFlowCount}` : ''}
              </strong>
            </div>
          ) : null}

          <div className="flow-preview-dialog__footer-actions">
            {appId && collections && onCollectionsChange ? (
              <CollectionPicker
                reference={{
                  kind: 'screen',
                  app: appId,
                  referenceId: String(screen.id),
                  title: context ?? `${appName} screen ${index + 1}`,
                }}
                collections={collections}
                onCollectionsChange={onCollectionsChange}
                plan={plan}
                dark
                buttonLabel="Save"
                buttonClassName="flow-preview-dialog__save"
                onStatus={setStatus}
              />
            ) : (
              <Button
                label={saved ? 'Saved' : 'Save'}
                variant="primary"
                size="lg"
                className="flow-preview-dialog__save"
                onClick={toggleSaved}
              />
            )}
            <CopyButton
              label="Copy image"
              successMessage="Image copied as PNG"
              action={() => copyScreenImageAsPng(screen.url)}
              variant="secondary"
              size="lg"
              className="flow-preview-dialog__copy"
            />
            <IconButton
              label="More screen actions"
              icon={<Icon icon="moreHorizontal" size="md" />}
              variant="secondary"
              className="flow-preview-dialog__more"
              onClick={() => {
                setMoreOpen((value) => !value);
                setInfoOpen(false);
              }}
            />
          </div>

          <div className="flow-preview-dialog__metadata">
            <span>{platformName(screen.platform)}{resolution ? ` (${resolution})` : ''}</span>
            <Button
              label="More info"
              variant="ghost"
              aria-expanded={infoOpen}
              onClick={() => {
                setInfoOpen((value) => !value);
                setMoreOpen(false);
              }}
            />
          </div>

          {moreOpen ? (
            <div className="flow-preview-dialog__menu">
              <a href={screen.url} target="_blank" rel="noreferrer">Open original image</a>
            </div>
          ) : null}

          {infoOpen ? (
            <aside className="flow-preview-dialog__info">
              <strong>{usefulLabel(screen.type) ?? `${appName} screen`}</strong>
              <span>{platformName(screen.platform)}{resolution ? ` · ${resolution}` : ''}</span>
              {screen.description ? <p>{screen.description}</p> : null}
              {foundInFlows.length
                ? <p>Found in {foundInFlows.join(', ')}</p>
                : context
                  ? <p>Found in {context}</p>
                  : null}
            </aside>
          ) : null}

          <span className="flow-preview-dialog__status" aria-live="polite">
            {status}
          </span>
        </div>
      </AstryxModalSurface>
    </AstryxModal>
  );
}
