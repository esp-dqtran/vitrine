import { Button, Icon, IconButton } from '@astryxdesign/core';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import {
  copyScreenImageAsPng,
  copyShareLink,
  flowShareUrl,
} from '../screenActions.ts';
import { useSlidingIndicator } from '../useSlidingIndicator.ts';
import { CopyButton, useCopyAction } from './CopyButton.tsx';
import { DocumentFlowPanel } from './DocumentFlowPanel.tsx';
import { PlaceholderImage } from './PlaceholderImage.tsx';
import { AstryxModal, AstryxModalSurface } from './AstryxModal.tsx';

export interface FlowPreviewScreen {
  evidence: EvidenceView;
  label: string;
  stepNumber: number;
}

export type FlowPreviewMode = 'screens' | 'prototype' | 'document';

export interface FlowPreviewDocumentSource {
  app: string;
  platform: Platform;
  version: number;
  flowId: string;
}

interface FlowPreviewDialogProps {
  flowId: string;
  flowTitle: string;
  flow: DesignFlow<EvidenceView>;
  screens: FlowPreviewScreen[];
  activeIndex: number;
  activeMode: FlowPreviewMode;
  platform?: Platform;
  sourceAppName?: string;
  sourceAppIconUrl?: string | null;
  documentSource?: FlowPreviewDocumentSource;
  userRole?: 'admin' | 'user';
  onActiveIndexChange: (index: number) => void;
  onModeChange: (mode: FlowPreviewMode, index?: number) => void;
  onClose: () => void;
  onOpenSourceApp?: () => void;
}

type ScreenResolution = { width: number; height: number };

const platformName = (platform: Platform | undefined) => {
  if (platform === 'ios') return 'iOS';
  if (platform === 'android') return 'Android';
  return 'Web';
};

function viewportResolution(value: string | undefined): ScreenResolution | null {
  if (!value) return null;
  const match = value.match(/(\d{2,5})\D+(\d{2,5})/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

export function FlowPreviewDialog({
  flowId,
  flowTitle,
  flow,
  screens,
  activeIndex,
  activeMode,
  platform = 'web',
  sourceAppName,
  sourceAppIconUrl,
  documentSource,
  userRole = 'user',
  onActiveIndexChange,
  onModeChange,
  onClose,
  onOpenSourceApp,
}: FlowPreviewDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const {
    indicatorRef: modeIndicatorRef,
    registerItem: registerMode,
  } = useSlidingIndicator<FlowPreviewMode>(activeMode);
  const scrollFrameRef = useRef<number | null>(null);
  const scrollEndTimerRef = useRef<number | null>(null);
  const hasPositionedInitialScreenRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);
  const [savedScreens, setSavedScreens] = useState<Set<number>>(() => new Set());
  const [failedScreens, setFailedScreens] = useState<Set<number>>(() => new Set());
  const [resolutions, setResolutions] = useState<Record<number, ScreenResolution>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const activeScreen = screens[activeIndex];
  const activeResolution = activeScreen
    ? resolutions[activeScreen.stepNumber]
      ?? viewportResolution(activeScreen.evidence.responsiveViewport)
    : null;

  const scrollToScreen = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const track = trackRef.current;
    const item = track?.querySelector<HTMLElement>(`[data-flow-dialog-index="${index}"]`);
    if (!track || !item) return;
    const trackPadding = Number.parseFloat(window.getComputedStyle(track).paddingLeft) || 0;
    track.scrollTo({
      left: Math.max(0, item.offsetLeft - track.offsetLeft - trackPadding),
      behavior,
    });
  }, []);

  const selectScreen = useCallback((index: number) => {
    const boundedIndex = Math.min(Math.max(index, 0), screens.length - 1);
    activeIndexRef.current = boundedIndex;
    onActiveIndexChange(boundedIndex);
    scrollToScreen(boundedIndex);
    setMoreOpen(false);
    setInfoOpen(false);
  }, [onActiveIndexChange, screens.length, scrollToScreen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (activeMode !== 'screens') {
      hasPositionedInitialScreenRef.current = false;
    }
  }, [activeMode]);

  useEffect(() => {
    if (activeMode !== 'screens' || hasPositionedInitialScreenRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      hasPositionedInitialScreenRef.current = true;
      scrollToScreen(activeIndex, 'auto');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, activeMode, scrollToScreen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (activeMode === 'document') return;
      if (event.key === 'ArrowLeft' && activeIndex > 0) {
        event.preventDefault();
        selectScreen(activeIndex - 1);
      } else if (event.key === 'ArrowRight' && activeIndex < screens.length - 1) {
        event.preventDefault();
        selectScreen(activeIndex + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, activeMode, screens.length, selectScreen]);

  const syncActiveScreen = () => {
    const track = trackRef.current;
    if (!track) return;
    if (scrollEndTimerRef.current !== null) window.clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = window.setTimeout(() => {
      scrollEndTimerRef.current = null;
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        const items = Array.from(
          track.querySelectorAll<HTMLElement>('[data-flow-dialog-index]'),
        );
        if (!items.length) return;
        const trackPadding = Number.parseFloat(window.getComputedStyle(track).paddingLeft) || 0;
        const targetLeft = (item: HTMLElement) => (
          item.offsetLeft - track.offsetLeft - trackPadding
        );
        const nearest = items.reduce((best, item, index) => (
          Math.abs(targetLeft(item) - track.scrollLeft)
            < Math.abs(targetLeft(items[best]) - track.scrollLeft)
            ? index
            : best
        ), 0);
        if (nearest === activeIndexRef.current) return;
        activeIndexRef.current = nearest;
        onActiveIndexChange(nearest);
      });
    }, 120);
  };

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    if (scrollEndTimerRef.current !== null) window.clearTimeout(scrollEndTimerRef.current);
  }, []);

  const copyLinkAction = async () => {
    if (typeof window === 'undefined') throw new Error('Clipboard is unavailable');
    const value = flowShareUrl(window.location.href, flowId, activeIndex);
    await copyShareLink(value);
  };

  const {
    copy: copyLink,
    state: linkCopyState,
  } = useCopyAction({
    action: copyLinkAction,
    successMessage: 'Flow link copied',
  });

  const copyScreen = async () => {
    if (!activeScreen) throw new Error('No screen is selected');
    await copyScreenImageAsPng(activeScreen.evidence.imageUrl);
  };

  const toggleSaved = () => {
    if (!activeScreen) return;
    setSavedScreens((current) => {
      const next = new Set(current);
      if (next.has(activeScreen.stepNumber)) next.delete(activeScreen.stepNumber);
      else next.add(activeScreen.stepNumber);
      return next;
    });
  };

  const registerResolution = (stepNumber: number, image: HTMLImageElement) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    setResolutions((current) => ({
      ...current,
      [stepNumber]: {
        width: image.naturalWidth,
        height: image.naturalHeight,
      },
    }));
  };

  const markFailed = (stepNumber: number) => {
    setFailedScreens((current) => new Set(current).add(stepNumber));
  };

  const handleOpenSourceApp = () => {
    onOpenSourceApp?.();
  };

  const dialogLabel = sourceAppName
    ? `${flowTitle} in ${sourceAppName}`
    : flowTitle;
  const saved = activeScreen ? savedScreens.has(activeScreen.stepNumber) : false;
  const screenMeta = [
    platformName(platform),
    activeResolution ? `${activeResolution.width}×${activeResolution.height}` : null,
  ].filter(Boolean).join(' ');
  const renderScreenMedia = (screen: FlowPreviewScreen, index: number) => (
    failedScreens.has(screen.stepNumber) ? (
      <PlaceholderImage
        seed={`${flowId}-${screen.stepNumber}`}
        style={{ objectFit: platform === 'web' ? 'contain' : 'cover', background: '#fff' }}
      />
    ) : (
      <img
        src={screen.evidence.imageUrl ?? screen.evidence.thumbnailUrl}
        alt={`${flowTitle}, screen ${index + 1}: ${screen.label}`}
        loading={index === activeIndex ? 'eager' : 'lazy'}
        onLoad={(event) => registerResolution(screen.stepNumber, event.currentTarget)}
        onError={() => markFailed(screen.stepNumber)}
      />
    )
  );

  return (
    <AstryxModal
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      variant="fullscreen"
      purpose="info"
      padding={0}
      className="flow-preview-dialog-shell"
      aria-label={dialogLabel}
    >
      <AstryxModalSurface
        ref={dialogRef}
        className={`flow-preview-dialog flow-preview-dialog--${platform}`}
        data-flow-preview-dialog={flowId}
        data-flow-preview-platform={platform}
        tabIndex={-1}
      >
        <header className="flow-preview-dialog__header">
          <div className="flow-preview-dialog__identity">
            <h2>{flowTitle}</h2>
            {sourceAppName ? <span className="flow-preview-dialog__connector">in</span> : null}
            {sourceAppName ? (
              onOpenSourceApp ? (
                <Button
                  label={`Open ${sourceAppName} app`}
                  variant="ghost"
                  className="flow-preview-dialog__app"
                  onClick={handleOpenSourceApp}
                >
                  {sourceAppIconUrl ? <img src={sourceAppIconUrl} alt="" /> : null}
                  <strong>{sourceAppName}</strong>
                </Button>
              ) : (
                <span className="flow-preview-dialog__app flow-preview-dialog__app--static">
                  {sourceAppIconUrl ? <img src={sourceAppIconUrl} alt="" /> : null}
                  <strong>{sourceAppName}</strong>
                </span>
              )
            ) : null}
          </div>

          <div
            className="flow-preview-dialog__modes"
            role="tablist"
            aria-label="Flow preview mode"
            data-active-mode={activeMode}
          >
            <span
              ref={modeIndicatorRef}
              className="flow-preview-dialog__mode-indicator"
              aria-hidden="true"
            />
            <Button
              ref={registerMode('screens')}
              label="Screens"
              variant="ghost"
              role="tab"
              aria-label="Screens"
              aria-selected={activeMode === 'screens'}
              onClick={() => onModeChange('screens', activeIndex)}
            />
            <Button
              ref={registerMode('prototype')}
              label="Prototype"
              variant="ghost"
              role="tab"
              aria-label="Prototype"
              aria-selected={activeMode === 'prototype'}
              onClick={() => onModeChange('prototype', activeIndex)}
            />
            <Button
              ref={registerMode('document')}
              label="Document"
              variant="ghost"
              role="tab"
              aria-label="Document"
              aria-selected={activeMode === 'document'}
              onClick={() => onModeChange('document')}
            />
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
              label="Close Flow preview"
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
          className={`flow-preview-dialog__body flow-preview-dialog__body--${activeMode}`}
          role="tabpanel"
          aria-label={activeMode === 'document'
            ? 'Feature Document'
            : activeMode === 'prototype'
              ? 'Flow prototype'
              : 'Flow screens'}
        >
          {activeMode === 'document' ? (
            <div className="flow-preview-dialog__document">
              <DocumentFlowPanel
                flow={{
                  ...flow,
                  id: documentSource?.flowId ?? flow.id,
                }}
                app={documentSource?.app}
                platform={documentSource?.platform}
                version={documentSource?.version}
                userRole={userRole}
                selectedStep={activeIndex + 1}
                onOpenVisualStep={(step) => onModeChange('screens', Math.max(0, step - 1))}
              />
            </div>
          ) : activeMode === 'prototype' && activeScreen ? (
            <div className="flow-preview-dialog__prototype">
              <Button
                label={`Prototype screen ${activeIndex + 1}: ${activeScreen.label}`}
                variant="ghost"
                className="flow-preview-dialog__screen flow-preview-dialog__prototype-screen"
                onClick={() => undefined}
              >
                {renderScreenMedia(activeScreen, activeIndex)}
              </Button>
            </div>
          ) : (
            <ol
              ref={trackRef}
              className="flow-preview-dialog__track"
              aria-label={`${flowTitle} screens`}
              onScroll={syncActiveScreen}
            >
              {screens.map((screen, index) => (
                <li
                  key={`${screen.stepNumber}-${screen.evidence.imageId}`}
                  className="flow-preview-dialog__slide"
                  data-flow-dialog-index={index}
                  aria-current={index === activeIndex ? 'step' : undefined}
                >
                  <Button
                    label={`View screen ${index + 1}: ${screen.label}`}
                    variant="ghost"
                    className="flow-preview-dialog__screen"
                    onClick={() => selectScreen(index)}
                  >
                    {renderScreenMedia(screen, index)}
                  </Button>
                </li>
              ))}
            </ol>
          )}

          {(activeMode === 'prototype' || (activeMode === 'screens' && platform === 'web'))
            && activeIndex > 0 ? (
            <IconButton
              label="Previous Flow screen"
              icon={<Icon icon="chevronLeft" size="md" />}
              variant="secondary"
              className="flow-preview-dialog__arrow flow-preview-dialog__arrow--left"
              onClick={() => selectScreen(activeIndex - 1)}
            />
          ) : null}
          {(activeMode === 'prototype' || (activeMode === 'screens' && platform === 'web'))
            && activeIndex < screens.length - 1 ? (
            <IconButton
              label="Next Flow screen"
              icon={<Icon icon="chevronRight" size="md" />}
              variant="secondary"
              className="flow-preview-dialog__arrow flow-preview-dialog__arrow--right"
              onClick={() => selectScreen(activeIndex + 1)}
            />
          ) : null}

          {activeMode === 'screens' ? <div className="flow-preview-dialog__footer-actions">
            <Button
              label={saved ? 'Saved' : 'Save'}
              variant="primary"
              size="lg"
              className="flow-preview-dialog__save"
              onClick={toggleSaved}
            />
            <CopyButton
              label="Copy image"
              successMessage="Image copied as PNG"
              action={copyScreen}
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
          </div> : null}
          {activeMode === 'prototype' ? (
            <div className="flow-preview-dialog__footer-actions flow-preview-dialog__footer-actions--prototype">
              <Button
                label="Restart prototype"
                variant="secondary"
                size="lg"
                className="flow-preview-dialog__restart"
                isDisabled={activeIndex === 0}
                onClick={() => selectScreen(0)}
              />
              <IconButton
                label="More prototype actions"
                icon={<Icon icon="moreHorizontal" size="md" />}
                variant="secondary"
                className="flow-preview-dialog__more"
                onClick={() => {
                  setMoreOpen((value) => !value);
                  setInfoOpen(false);
                }}
              />
            </div>
          ) : null}

          {activeMode !== 'document' && moreOpen && activeScreen ? (
            <div className="flow-preview-dialog__menu" role="menu" aria-label="Screen actions">
              <a
                href={activeScreen.evidence.imageUrl}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
              >
                Open full image
              </a>
            </div>
          ) : null}

          {activeMode !== 'document' ? <div className="flow-preview-dialog__metadata">
            <span>{screenMeta}</span>
            <Button
              label="More info"
              variant="ghost"
              aria-expanded={infoOpen}
              onClick={() => {
                setInfoOpen((value) => !value);
                setMoreOpen(false);
              }}
            />
          </div> : null}

          {activeMode !== 'document' && infoOpen && activeScreen ? (
            <aside className="flow-preview-dialog__info" aria-label="Screen information">
              <strong>{activeScreen.label}</strong>
              <span>Screen {activeIndex + 1} of {screens.length}</span>
              {activeScreen.evidence.description ? <p>{activeScreen.evidence.description}</p> : null}
              {activeScreen.evidence.capturedAt ? (
                <span>Captured {new Date(activeScreen.evidence.capturedAt).toLocaleDateString()}</span>
              ) : null}
            </aside>
          ) : null}

          {activeMode === 'screens' ? <span className="flow-preview-dialog__status" aria-live="polite">
            Screen {activeIndex + 1} of {screens.length}: {activeScreen?.label}
          </span> : null}
          {activeMode === 'prototype' ? (
            <span className="flow-preview-dialog__progress" aria-live="polite">
              {activeIndex + 1} of {screens.length}
            </span>
          ) : null}
        </div>
      </AstryxModalSurface>
    </AstryxModal>
  );
}
