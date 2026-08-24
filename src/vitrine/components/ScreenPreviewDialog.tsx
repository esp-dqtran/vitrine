import { Button, Icon, IconButton } from '@astryxdesign/core';
import { useState } from 'react';
import type { ResearchCollection } from '../../db.ts';
import type { Screen } from '../types.ts';
import { copyScreenImageAsPng, copyShareLink } from '../screenActions.ts';
import { CollectionPicker } from './CollectionPicker.tsx';
import { CopyButton, useCopyAction } from './CopyButton.tsx';
import { PlaceholderImage } from './PlaceholderImage.tsx';
import { AstryxModal, AstryxModalSurface } from './AstryxModal.tsx';
import { EvidenceTrustSummary } from './EvidenceTrustSummary.tsx';

interface ScreenPreviewDialogProps {
  appName: string;
  appIconUrl?: string | null;
  screen: Screen;
  index: number;
  total: number;
  canNavigateNext?: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void | Promise<void>;
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

const viewportName = (viewport: Screen['responsiveViewport']) => {
  if (!viewport || viewport === 'unknown') return 'Unknown viewport';
  return `${viewport[0].toUpperCase()}${viewport.slice(1)} viewport`;
};

export function ScreenPreviewDialog({
  appName,
  appIconUrl,
  screen,
  index,
  total,
  canNavigateNext,
  onClose,
  onNavigate,
  appId,
  collections,
  onCollectionsChange,
  plan = 'free',
  foundInFlows = [],
}: ScreenPreviewDialogProps) {
  const [savedScreens, setSavedScreens] = useState<Set<number>>(() => new Set());
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaDimensions, setMediaDimensions] = useState<Record<number, { width: number; height: number }>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const saved = savedScreens.has(screen.id);
  const context = foundInFlows[0]
    ?? usefulLabel(screen.productArea)
    ?? usefulLabel(screen.type);
  const additionalFlowCount = Math.max(0, foundInFlows.length - 1);
  const resolution = screenResolution(screen);
  const dimensions = mediaDimensions[screen.id];
  const showNext = canNavigateNext ?? index < total - 1;
  const pageTypes = [...new Set([
    usefulLabel(screen.type),
    usefulLabel(screen.embeddedPageType),
  ].filter((value): value is string => Boolean(value)))];
  const uiElementTypes = [...new Set(
    (screen.uiElements ?? []).map(({ type }) => type),
  )];
  const analysisGroups = [
    { label: 'Page Types', values: pageTypes },
    { label: 'UI Elements', values: uiElementTypes },
    { label: 'Visible states', values: screen.visibleStates },
    { label: 'Components', values: screen.componentNames ?? [] },
    { label: 'Layout patterns', values: screen.layoutPatterns ?? [] },
    { label: 'Interaction patterns', values: screen.interactionPatterns ?? [] },
    { label: 'Content patterns', values: screen.contentPatterns ?? [] },
    { label: 'Icons', values: screen.icons ?? [] },
    { label: 'Imagery', values: screen.imagery ?? [] },
    { label: 'Visible text', values: screen.visibleText ?? [] },
  ].filter(({ values }) => values.length > 0);
  const analysisPanelId = `screen-analysis-${screen.id}`;

  const registerMediaDimensions = (image: HTMLImageElement) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    setMediaDimensions((current) => ({
      ...current,
      [screen.id]: {
        width: image.naturalWidth,
        height: image.naturalHeight,
      },
    }));
  };

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
        className={`flow-preview-dialog app-screen-preview-dialog${screen.platform === 'web' ? ' flow-preview-dialog--web' : ''}`}
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
              tooltip={linkCopyState === 'copying' ? 'Copying…' : 'Copy link'}
              icon={<Icon icon="externalLink" size="sm" />}
              variant="ghost"
              onClick={() => void copyLink()}
            />
            <span className="flow-preview-dialog__divider" aria-hidden="true" />
            <IconButton
              label="Close screen preview"
              tooltip="Close screen preview"
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
              style={screen.platform === 'web' && dimensions
                ? { aspectRatio: `${dimensions.width} / ${dimensions.height}` }
                : undefined}
            >
              {mediaFailed ? (
                <PlaceholderImage
                  seed={`${appName}-${screen.id}`}
                  style={{ objectFit: 'contain', background: '#fff' }}
                />
              ) : (
                <img
                  key={screen.id}
                  src={screen.url}
                  alt=""
                  loading="eager"
                  onLoad={(event) => registerMediaDimensions(event.currentTarget)}
                  onError={() => setMediaFailed(true)}
                />
              )}
            </div>
          </div>

          {index > 0 ? (
            <IconButton
              label="Previous screen"
              tooltip="Previous screen"
              icon={<Icon icon="chevronLeft" size="md" />}
              variant="secondary"
              className="flow-preview-dialog__arrow flow-preview-dialog__arrow--left"
              onClick={() => {
                setMediaFailed(false);
                void onNavigate(index - 1);
              }}
            />
          ) : null}
          {showNext ? (
            <IconButton
              label="Next screen"
              tooltip="Next screen"
              icon={<Icon icon="chevronRight" size="md" />}
              variant="secondary"
              className="flow-preview-dialog__arrow flow-preview-dialog__arrow--right"
              onClick={() => {
                setMediaFailed(false);
                void onNavigate(index + 1);
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
                canvasItems={[{
                  appId,
                  appName,
                  screen,
                }]}
                collections={collections}
                onCollectionsChange={onCollectionsChange}
                plan={plan}
                dark
                buttonLabel="Use in project"
                buttonClassName="flow-preview-dialog__save"
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
          </div>

          <div className="flow-preview-dialog__metadata">
            <span>{platformName(screen.platform)}{resolution ? ` (${resolution})` : ''}</span>
            <Button
              label={infoOpen ? 'Hide info' : 'More info'}
              variant="ghost"
              aria-expanded={infoOpen}
              aria-controls={analysisPanelId}
              onClick={() => {
                setInfoOpen((value) => !value);
              }}
            />
          </div>

          <EvidenceTrustSummary
            evidenceId={`screen:${appId ?? appName}:${screen.id}`}
            sourceUrl={screen.sourceUrl}
            capturedAt={screen.capturedAt}
            confidence={screen.confidence}
          />

          <aside
            id={analysisPanelId}
            className="flow-preview-dialog__info app-screen-preview-dialog__analysis"
            aria-label="Screen analysis"
            hidden={!infoOpen}
          >
            <header className="app-screen-preview-dialog__analysis-header">
              <strong>{usefulLabel(screen.type) ?? `${appName} screen`}</strong>
              <span>{platformName(screen.platform)}{resolution ? ` · ${resolution}` : ''}</span>
            </header>
            {screen.purpose ? (
              <section>
                <h3>Purpose</h3>
                <p>{screen.purpose}</p>
              </section>
            ) : null}
            {screen.description ? (
              <section>
                <h3>Visual description</h3>
                <p>{screen.description}</p>
              </section>
            ) : null}
            <dl className="app-screen-preview-dialog__analysis-facts">
              {usefulLabel(screen.productArea) ? (
                <div><dt>Product area</dt><dd>{screen.productArea}</dd></div>
              ) : null}
              <div><dt>Theme</dt><dd>{screen.theme}</dd></div>
              <div><dt>Viewport</dt><dd>{viewportName(screen.responsiveViewport)}</dd></div>
            </dl>
            {analysisGroups.map(({ label, values }) => (
              <section key={label}>
                <h3>{label}</h3>
                <ul className="app-screen-preview-dialog__analysis-list">
                  {values.map((value) => <li key={value}>{value}</li>)}
                </ul>
              </section>
            ))}
            {foundInFlows.length
              ? <p>Found in {foundInFlows.join(', ')}</p>
              : context
                ? <p>Found in {context}</p>
                : null}
          </aside>
        </div>
      </AstryxModalSurface>
    </AstryxModal>
  );
}
