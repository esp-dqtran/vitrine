import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("hosts a project-scoped Excalidraw canvas inside the Astryx playground", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /\bExcalidraw\b[\s\S]*from ["']@excalidraw\/excalidraw["']/);
  assert.match(source, /import ["']@excalidraw\/excalidraw\/index\.css["']/);
  assert.match(source, /astryx:project:\$\{projectId\}:canvas:\$\{canvasId \?\? "legacy"\}:excalidraw:v1/);
  assert.match(source, /serializeAsJSON\(elements, appState, files, "database"\)/);
  assert.match(source, /hashElementsVersion/);
  assert.match(source, /files: snapshot\.files \?\? files \?\? \{\}/);
  assert.match(source, /const canvasSaveKey = \(snapshot: ExcalidrawProjectSnapshot\)/);
  assert.match(source, /lastQueuedSnapshotKeyRef/);
  assert.match(source, /if \(snapshotKey === lastQueuedSnapshotKeyRef\.current\) return;/);
  assert.match(source, /getDesignerCanvas/);
  assert.match(source, /saveDesignerCanvas/);
  assert.match(source, /DesignerCanvasApiError/);
  assert.match(source, /openDesignerCanvasCollaboration/);
  assert.match(source, /collaborationRef\.current\?\.publishScene\(snapshot\)/);
  assert.match(source, /onPointerUpdate=\{handleCanvasPointerUpdate\}/);
  assert.match(source, /collaborationRef\.current\?\.publishCursor/);
  assert.match(source, /onPresence\(collaborators\)/);
  assert.match(source, /onCursor\(cursor\)/);
  assert.match(source, /editorRef\.current\?\.updateScene\(\{ collaborators \}\)/);
  assert.match(source, /className="project-canvas-collaborators"/);
  assert.match(source, /isCollaborating=\{collaborationStatus === "live"\}/);
  assert.match(source, /const selectedElementIds = editor\.getAppState\(\)\.selectedElementIds/);
  assert.match(source, /editor\.updateScene\(\{[\s\S]*elements: value\.elements,[\s\S]*appState: \{ selectedElementIds \}/);
  assert.match(source, /remoteElementsVersionRef/);
  assert.match(source, /remoteBroadcastSuppressedUntilRef/);
  assert.match(source, /collaboration\.close\(\)/);
  assert.match(source, /uploadProjectCanvasAsset/);
  assert.match(source, /persistEmbeddedFiles/);
  assert.match(source, /Offline — changes saved in this browser/);
  assert.match(source, /window\.addEventListener\("pagehide", saveBeforeExit\)/);
  assert.match(source, /pendingSnapshotRef\.current \?\?= snapshot/);
  assert.match(source, /label=\{saveStatusLabel\}/);
  assert.match(source, /Project canvas unavailable/);
  assert.match(source, /<Button/);
  assert.doesNotMatch(source, /label=\{referencesOpen \? "Close references" : "References"\}/);
  assert.match(source, /getResearchProject\(projectId\)/);
  assert.match(source, /<h1>\{references\?\.title \?\? "Designer project"\}<\/h1>/);
  assert.match(source, /const saveStateIcons: Record<CanvasSaveState, IconName>/);
  assert.match(source, /className="project-canvas-header__identity-title"/);
  assert.match(source, /className="project-playground__identity-status"/);
  assert.match(source, /aria-label=\{saveStatusLabel\}/);
  assert.match(source, /convertToExcalidrawElements/);
  assert.match(source, /editor\.addFiles\(\[file\]\)/);
  assert.match(source, /<ProjectReferencePanel/);
  assert.match(source, /<ProjectScreenLibrary/);
  assert.match(source, /<ProjectTemplateLibrary/);
  assert.match(source, /<ProjectStickyNotePicker/);
  assert.match(source, /<ProjectCanvasDocumentEditor/);
  assert.match(source, /canvasDocuments\.map\(\(document\) =>/);
  assert.match(source, /isSelected=\{selectedCanvasDocument\?\.elementId === document\.elementId\}/);
  assert.match(source, /<ProjectCanvasDataLibrary/);
  assert.match(source, /<ProjectResearchFramePicker/);
  assert.match(source, /createPortal\(/);
  assert.match(source, /className="project-playground__astryx-tools"/);
  assert.match(source, /role="group"[\s\S]*?aria-label="Astryx canvas tools"/);
  assert.match(source, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(source, /function ProjectCanvasToolGlyph/);
  assert.match(source, /tool="moodboard"/);
  assert.match(source, /tool="document"/);
  assert.match(source, /className="project-playground__sticky-trigger"/);
  assert.match(source, /className="project-playground__document-trigger"/);
  assert.match(source, /className="project-playground__more-tools-trigger"/);
  assert.match(source, /className="project-canvas-tools-catalog"/);
  assert.match(source, /placeholder="Search tools…"/);
  assert.match(source, /const projectCanvasToolCatalogItems/);
  assert.match(source, /tool: "research-frames"/);
  assert.match(source, /tool: "data"/);
  assert.match(source, /tool: "templates"/);
  assert.match(source, /activateCanvasTool\("moodboard"\)/);
  assert.match(source, /activateCanvasTool\("sticky"\)/);
  assert.match(source, /activateCanvasTool\("document"\)/);
  assert.match(source, /activateCanvasTool\("more"\)/);
  assert.match(source, /aria-label=\{stickyPickerOpen \? "Close sticky notes" : "Sticky notes"\}/);
  assert.match(source, /customType: "astryx-sticky-note"/);
  assert.match(source, /function stickyNotePlacementCursor\(/);
  assert.match(source, /mode === "stack"/);
  assert.match(source, /encodeURIComponent\(svg\)/);
  assert.match(source, /editor\?\.setCursor\(stickyNotePlacementCursor\(color, mode\)\)/);
  assert.match(source, /--project-sticky-note-cursor/);
  assert.match(source, /project-playground__canvas--sticky-placement/);
  assert.match(source, /const stopStickyPlacement[\s\S]*setStickyPickerOpen\(false\)[\s\S]*editor\?\.resetCursor\(\)/);
  assert.match(source, /setStickyPickerOpen\(keepPickerOpen\)/);
  assert.match(source, /const toggleStickyNoteTool[\s\S]*armStickyPlacement\(projectStickyNoteColors\[0\], "single", true\)/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "n"[\s\S]*toggleStickyNoteTool\(\)/);
  assert.match(source, /customType: "astryx-document"/);
  assert.match(source, /if \(documentPlacement\) \{[\s\S]*insertCanvasDocumentAt\(x, y\);[\s\S]*stopDocumentPlacement\(\);/);
  assert.match(source, /const canvasDocumentViewportTopSafeArea = 72/);
  assert.match(source, /const viewportTop = -appState\.scrollY \+ appState\.offsetTop \/ zoom/);
  assert.match(source, /const minimumCenterY = viewportTop[\s\S]*canvasDocumentViewportTopSafeArea \/ zoom[\s\S]*canvasDocumentHeight \/ 2/);
  assert.match(source, /y: Math\.max\(y, minimumCenterY\)/);
  assert.match(source, /selectedElementIds: container \? \{ \[container\.id\]: true \} : \{\},[\s\S]*scrollX: appState\.scrollX,[\s\S]*scrollY: appState\.scrollY/);
  assert.doesNotMatch(source, /activeTool\.customType === "astryx-document"[\s\S]{0,120}documentPlacement/);
  assert.match(source, /editor\.setActiveTool\(\{ type: "frame" \}\)/);
  assert.match(source, /kind: "research-frame"/);
  assert.match(source, /frameType: preset\.id/);
  assert.match(source, /editor\.scrollToContent\(frame, \{ animate: true, fitToViewport: true \}\)/);
  assert.match(source, /const handleCanvasPointerUp = useCallback/);
  assert.match(source, /onPointerUp=\{handleCanvasPointerUp\}/);
  assert.doesNotMatch(source, /onPointerDown=\{handleCanvasPointerDown\}/);
  assert.match(source, /kind: "sticky-note"/);
  assert.match(source, /format = defaultProjectStickyNoteFormat/);
  assert.match(source, /fontFamily: projectStickyNoteFontFamilies\[format\.font\]/);
  assert.match(source, /fontSize: format\.fontSize/);
  assert.match(source, /textAlign: format\.textAlign/);
  assert.match(source, /link: format\.link \|\| null/);
  assert.match(source, /locked: format\.locked/);
  assert.doesNotMatch(source, /<ProjectStickyNoteToolbar/);
  assert.match(source, /selectedStickyNote/);
  assert.doesNotMatch(source, /updateSelectedStickyNote/);
  assert.match(source, /kind: "document"/);
  assert.match(source, /kind: "app"/);
  assert.match(source, /kind: "flow"/);
  assert.match(source, /armStickyPlacement\(color, "stack"\)/);
  assert.match(source, /className="project-sticky-note-composer"/);
  assert.match(source, /className="project-sticky-note-composer__surface"/);
  assert.match(source, /"--sticky-theme-filter": resolvedTheme === "dark"\s*\? "invert\(93%\) hue-rotate\(180deg\)"\s*:\s*"none"/s);
  assert.match(source, /autoFocus/);
  assert.match(source, /contentEditable/);
  assert.match(source, /role="textbox"/);
  assert.match(source, /aria-multiline="true"/);
  assert.match(source, /stickyInputRef\.current/);
  assert.match(source, /input\.focus\(\)/);
  assert.match(source, /window\.getSelection\(\)/);
  assert.match(source, /commitStickyDraft\(event\.currentTarget\.textContent \?\? ""\)/);
  assert.match(source, /const text = value\.trim\(\);[\s\S]*insertStickyNotesAt\([\s\S]*\[text\]/);
  assert.doesNotMatch(source, /const text = value\.trim\(\);[\s\S]{0,240}if \(!text\)/);
  assert.match(source, /aria-placeholder="Type your note"/);
  assert.match(source, /event\.key === "Escape"[\s\S]*cancelStickyDraft\(\)/);
  assert.match(source, /window\.addEventListener\("keydown", handleStickyShortcut, true\)/);
  assert.match(source, /const canvasTextEditingRef = useRef\(false\)/);
  assert.match(source, /const \[canvasTextEditing, setCanvasTextEditing\] = useState\(false\)/);
  assert.match(source, /canvasTextEditingRef\.current = nextCanvasTextEditing/);
  assert.match(source, /setCanvasTextEditing\(\(current\) => current === nextCanvasTextEditing \? current : nextCanvasTextEditing\)/);
  assert.match(source, /\|\| canvasTextEditingRef\.current/);
  assert.match(source, /handleKeyboardGlobally=\{!stickyDraft && !canvasTextEditing && !commentDraftAnchor && !selectedComment\}/);
  assert.match(source, /tool="comments"/);
  assert.match(source, /customType: "astryx-comment"/);
  assert.match(source, /<ProjectCanvasCommentPin/);
  assert.match(source, /<ProjectCanvasCommentPanel/);
  assert.match(source, /const deleteSelectedComment = useCallback/);
  assert.match(source, /canvasCommentsRef\.current\.filter\(\(thread\) => thread\.id !== selectedCommentId\)/);
  assert.match(source, /onDelete=\{deleteSelectedComment\}/);
  assert.match(source, /comments: readonly DesignerCanvasCommentThread\[\]/);
  assert.match(source, /normalizeDesignerCanvasComments/);
  assert.match(source, /onKeyDown=\{\(event\) => \{\s*event\.stopPropagation\(\)/);
  assert.match(source, /className="project-sticky-note-placement-hint"/);
  assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*selectedElementIds: \{ \[selectedElementId\]: true \}/);
  assert.match(source, /querySelector<HTMLElement>\("\.excalidraw__canvas"\)[\s\S]*focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /editor\?\.refresh\(\)/);
  assert.doesNotMatch(source, /label="Add note"/);
  assert.doesNotMatch(source, /placeholder="Type your note…"/);
  assert.match(source, /aria-label=\{moodboardOpen \? "Close moodboard" : "Moodboard"\}/);
  assert.match(source, /className="project-playground__moodboard-trigger"/);
  assert.match(source, /<ProjectMoodboardPanel/);
  assert.match(source, /kind: "moodboard-section"/);
  assert.match(source, /sourceKind: "project-reference"/);
  assert.match(source, /sourceKind: "screen"/);
  assert.match(source, /sourceKind: "upload"/);
  assert.match(source, /frameId: placement\.frameId \?\? null/);
  assert.match(source, /moodboardDecisionOpacity\(moodboard\.decision\)/);
  assert.match(source, /updateSelectedMoodboardReference/);
  assert.match(source, /moveSelectedMoodboardReference/);
  assert.match(source, /onSectionChange={moveSelectedMoodboardReference}/);
  assert.match(source, /className="project-moodboard-decision-badge"/);
  assert.match(source, /moodboardDecisionBadgeStyle/);
  assert.match(source, /readOnly={canvasReadOnly}/);
  assert.match(source, /if \(canvasReadOnly\) return/);
  assert.match(source, /onDecisionChange=\{\(decision\)/);
  assert.match(source, /setScreensOpen\(!screensOpen\)/);
  assert.match(source, /setTemplatesOpen\(!templatesOpen\)/);
  assert.match(source, /const \[saveErrorMessage, setSaveErrorMessage\] = useState\(""\)/);
  assert.match(source, /`\$\{saveLabels\[saveState\]\}: \$\{saveErrorMessage\}`/);
  assert.match(source, /icon="viewColumns"/);
  assert.match(source, /searchParams\.set\("inline", "1"\)/);
  assert.match(source, /fetch\(canvasMediaFetchUrl\(screen\.url\)/);
  assert.match(source, /astryxReference:\s*\{[\s\S]*kind: "screen"/);
  assert.doesNotMatch(source, /link: `\/apps\/\$\{encodeURIComponent\(app\.id\)\}/);
  assert.match(source, /screenReferenceForElement/);
  assert.match(source, /selectedScreenReference/);
  assert.match(source, /project-playground__canvas--screen-selected/);
  assert.match(source, /className="project-screen-inspector"/);
  assert.match(source, /label="Open screen details"/);
  assert.match(source, /label=\{selectedDataReference\.kind === "app" \? "Open app details" : "Open flow details"\}/);
  assert.match(source, /lastDataCard\.x \+ lastDataCard\.width \+ 40 \+ cardWidth \/ 2/);
  assert.match(source, /evidence: `SCREEN-\$\{selectedScreenReference\.screenId\}`/);
  assert.match(source, /Added \$\{template\.title\} to the canvas/);
  assert.match(source, /className="project-canvas-header"/);
  assert.match(source, /data-canvas-toolbar-region="top-left"/);
  assert.match(source, /data-canvas-toolbar-region="top-right"/);
  assert.match(source, /data-canvas-toolbar-region="left"/);
  assert.match(source, /className=\{`project-playground__canvas\$\{/);
  assert.doesNotMatch(source, /project-playground__canvas--native-ui/);
  assert.doesNotMatch(source, /project-playground__mobile-viewport-controls/);
  assert.doesNotMatch(source, /mobileHelpOpen/);
  assert.doesNotMatch(source, /adjustCanvasZoom/);
  assert.match(source, /<ProjectAccessButton[\s\S]*?emphasized/);
  assert.match(source, /label="Project menu"/);
  assert.match(source, /icon=\{<Icon icon="menu" size="sm" \/>\}/);
  assert.match(source, /querySelector<HTMLButtonElement>\("button\.main-menu-trigger"\)/);
  assert.match(source, /onPointerDown=\{rememberProjectMenuState\}/);
  assert.match(source, /ref=\{projectMenuRef\}/);
  assert.match(source, /--project-menu-top/);
  assert.match(source, /Math\.max\(rect\.bottom, headerBottom\) \+ 8/);
  assert.match(source, /--project-menu-right/);
  assert.match(source, /querySelector\("\.App-menu_top__left \.dropdown-menu"\)/);
  assert.doesNotMatch(source, /project-canvas-header__group--right/);
  assert.match(source, /theme=\{resolvedTheme\}/);
  assert.match(source, /useResolvedThemeMode/);
  assert.match(source, /viewBackgroundColor: canvasSceneBackground/);
  assert.match(source, /updateScene\(\{[\s\S]*theme: resolvedTheme/);
  assert.match(source, /gridModeEnabled/);
  assert.match(source, /gridModeEnabled:\s*true/);
  assert.match(source, /<Excalidraw/);
  assert.match(source, /excalidrawAPI=/);
  assert.match(source, /onChange=\{handleCanvasChange\}/);
  assert.doesNotMatch(source, /ProjectWorkspaceNav|SegmentedControl|Overview|BlockSuite|OctoBase|tldraw/i);
});

test("gives the infinite canvas the full available viewport", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(css, /\.research-project-page--playground\s*\{[^}]*height:\s*100dvh;[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.project-canvas-header\s*\{[^}]*position:\s*absolute;[^}]*top:\s*8px;[^}]*justify-content:\s*space-between;[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.project-playground\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1;[^}]*overflow:\s*clip;/s);
  assert.match(css, /\.project-playground--canvas-first\s*\{[^}]*margin:\s*0;/s);
  assert.match(css, /\.project-playground__canvas\s*\{[^}]*position:\s*relative;[^}]*height:\s*100%;/s);
  assert.match(css, /\.project-playground__unavailable\s*\{[^}]*position:\s*absolute;[^}]*backdrop-filter:\s*blur\(12px\)/s);
  assert.match(css, /\.project-playground__references\s*\{[^}]*position:\s*absolute;[^}]*z-index:/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw\s*\{[^}]*--color-primary:[^}]*background:\s*var\(--project-canvas-bg/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-menu_top\s*\{[^}]*display:\s*block;[^}]*transform:\s*none;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-toolbar > \.Stack_horizontal\s*\{[^}]*width:\s*40px;[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.project-playground__astryx-tools\s*\{[^}]*width:\s*40px;[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.project-playground__screens-trigger,[\s\S]*?\.project-playground__more-tools-trigger\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/s);
  assert.match(css, /\.project-canvas-tools-catalog\s*\{[^}]*position:\s*absolute;[^}]*top:\s*136px;[^}]*left:\s*64px;[^}]*width:\s*min\(420px,/s);
  assert.match(css, /\.project-playground__canvas--tool-panel-open \.excalidraw \.selected-shape-actions\s*\{[^}]*display:\s*none !important;/s);
  assert.match(css, /\.project-research-frames\s*\{[^}]*position:\s*absolute;[^}]*top:\s*136px;[^}]*left:\s*64px;[^}]*width:\s*min\(372px,/s);
  assert.match(css, /\.project-research-frames__presets\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.project-research-frames__navigation-actions\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.project-sticky-note-picker\s*\{[^}]*position:\s*absolute;[^}]*top:\s*136px;[^}]*left:\s*64px;[^}]*grid-template-columns:\s*repeat\(4, 38px\);/s);
  assert.match(css, /\.project-sticky-note-placement-hint\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.project-playground__canvas--sticky-placement \.excalidraw__canvas\.interactive\s*\{[^}]*cursor:\s*var\(--project-sticky-note-cursor\) !important;/s);
  assert.match(css, /\.project-sticky-note-composer\s*\{[^}]*position:\s*absolute;[^}]*width:\s*240px;[^}]*height:\s*240px;/s);
  assert.match(css, /\.project-sticky-note-composer__surface\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*filter:\s*var\(--sticky-theme-filter, none\);/s);
  assert.match(css, /\.project-sticky-note-composer \[role="textbox"\]\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*min-height:\s*1\.3em;[^}]*max-height:\s*calc\(100% - 48px\);[^}]*transform:\s*translateY\(-50%\);/s);
  assert.doesNotMatch(css, /\.project-sticky-note-composer \[role="textbox"\]\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.project-canvas-document-editor\s*\{[^}]*position:\s*absolute;[^}]*width:\s*760px;/s);
  assert.match(css, /\.project-canvas-document-editor--preview\s*\{[^}]*pointer-events:\s*none;[^}]*box-shadow:\s*none;/s);
  assert.match(css, /\.project-screen-library\s*\{[^}]*position:\s*absolute;[^}]*top:\s*136px;[^}]*left:\s*64px;[^}]*width:\s*min\(420px,/s);
  assert.match(css, /\.project-screen-library__grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css, /\.project-screen-library__preview\s*\{[^}]*position:\s*relative;[^}]*height:\s*122px;/s);
  assert.match(css, /\.project-canvas-data-library\s*\{[^}]*position:\s*absolute;[^}]*top:\s*136px;[^}]*left:\s*64px;[^}]*width:\s*min\(460px,/s);
  assert.match(css, /\.project-canvas-data-library__tabs\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.project-playground__canvas--screen-selected \.excalidraw \.excalidraw-hyperlinkContainer,[\s\S]*?\.selected-shape-actions\s*\{[^}]*display:\s*none !important;/s);
  assert.match(css, /\.project-screen-inspector\s*\{[^}]*position:\s*absolute;[^}]*right:\s*16px;[^}]*width:\s*280px;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.zoom-actions\s*\{[^}]*position:\s*fixed;[^}]*right:\s*56px;[^}]*bottom:\s*8px;[^}]*height:\s*48px;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.undo-redo-buttons\s*\{[^}]*position:\s*fixed;[^}]*right:\s*236px;[^}]*width:\s*96px;[^}]*grid-template-columns:\s*repeat\(2, 48px\);/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.undo-redo-buttons button:disabled\s*\{[^}]*opacity:\s*\.62;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-menu_top__left\s*\{[^}]*position:\s*fixed;[^}]*width:\s*0;[^}]*height:\s*0;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-menu_top__left \.main-menu-trigger\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-menu_top__left \.App-menu__left\s*\{[^}]*top:\s*72px !important;[^}]*left:\s*12px !important;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.selected-shape-actions > \.App-menu__left\s*\{[^}]*position:\s*fixed !important;[^}]*top:\s*104px !important;[^}]*left:\s*72px !important;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-menu_top__left \.dropdown-menu\s*\{[^}]*top:\s*var\(--project-menu-top, 72px\) !important;[^}]*right:\s*var\(--project-menu-right, 12px\) !important;[^}]*left:\s*auto !important;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-toolbar__extra-tools-dropdown\s*\{[^}]*bottom:\s*0 !important;[^}]*left:\s*56px !important;/s);
  assert.match(css, /\.project-playground__canvas\s+\.excalidraw\s+\.layer-ui__wrapper__footer-right\s+\.help-icon\s*\{[^}]*width:\s*47px;[^}]*height:\s*46px;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.layer-ui__wrapper__top-right\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.project-template-library\s*\{[^}]*grid-template-columns:\s*276px minmax\(0, 1fr\);[^}]*border-radius:\s*16px;/s);
  assert.match(css, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.project-canvas-header__group--left\s*\{[^}]*max-width:\s*calc\(100% - 80px\);/s);
  assert.match(css, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.project-sticky-note-placement-hint\s*\{[^}]*top:\s*auto;[^}]*bottom:\s*72px;/s);
  assert.match(css, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.project-playground__canvas \.excalidraw--mobile \.App-bottom-bar\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*8px;[^}]*width:\s*96px;/s);
});

test("matches the compact Miro-style board header proportions", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.project-canvas-header__group\s*\{[^}]*height:\s*48px;[^}]*gap:\s*4px;[^}]*pointer-events:\s*all;[^}]*border:\s*\.5px solid[^}]*border-radius:\s*8px;[^}]*box-shadow:\s*0 2px 4px rgb\(34 36 40 \/ 8%\);/s);
  assert.match(css, /\.project-canvas-collaborators\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s);
  assert.match(css, /\.project-canvas-collaborators__avatars > span\s*\{[^}]*border-radius:\s*50%;/s);
  assert.match(source, /label="Astryx projects home"/);
  assert.match(source, /className="project-canvas-header__brand-mark" src="\/favicon\.svg"/);
  assert.match(css, /\.project-canvas-header__group--left \.project-canvas-header__brand-mark\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*10px;/s);
  assert.match(css, /\.project-canvas-header__menu button\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;[^}]*border-radius:\s*4px;/s);
  assert.match(css, /\.project-canvas-header__identity-title\s*\{[^}]*display:\s*flex;[^}]*gap:\s*6px;/s);
  assert.match(css, /\.project-canvas-header__identity\s*\{[^}]*height:\s*40px;[^}]*display:\s*flex;[^}]*align-items:\s*center;/s);
  assert.match(css, /\.project-canvas-header__identity > span\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.project-canvas-header__identity h1\s*\{[^}]*font-size:\s*14px;[^}]*font-weight:\s*500;[^}]*line-height:\s*21px;/s);
});

test("offers a canvas-native structured document editor", () => {
  const source = readFileSync(
    new URL("./components/ProjectCanvasDocumentEditor.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Retrospective Summary/);
  assert.match(source, /Product Brief/);
  assert.match(source, /Research Synthesis/);
  assert.match(source, /Meeting Notes/);
  assert.match(source, /label="Document title"/);
  assert.match(source, /label="Document content"/);
  assert.match(source, /ReactMarkdown/);
  assert.match(source, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.match(source, /isSourceEditing \? "Preview Markdown" : "Edit Markdown"/);
  assert.match(source, /const isEditing = isSelected && isSourceEditing/);
  assert.match(source, /project-canvas-document-editor--selected/);
  assert.match(source, /aria-label=\{isEditing \? "Canvas document editor" : "Canvas document preview"\}/);
  assert.match(source, /inert=\{isSelected \? undefined : true\}/);
  assert.match(source, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(source, /label=\{draft\.expanded \? "Collapse document" : "Expand document"\}/);
  assert.match(source, /label="Done"/);
});

test("offers a Miro-style sticky note color picker and stack action", () => {
  const source = readFileSync(
    new URL("./components/ProjectStickyNotePicker.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /export const projectStickyNoteColors/);
  assert.equal((source.match(/fill:\s*"#[0-9a-f]{6}"/gi) ?? []).length, 16);
  assert.match(source, /role="dialog" aria-label="Sticky notes"/);
  assert.match(source, /aria-label=\{`Place \$\{color\.name\} sticky note`\}/);
  assert.doesNotMatch(source, /label="Generate"/);
  assert.match(source, /Choose a color, then click the canvas\./);
  assert.match(source, /label="Place a stack"/);
  assert.match(source, /onCreateStack/);
});

test("offers native research frames for organizing and navigating designer work", () => {
  const source = readFileSync(
    new URL("./components/ProjectResearchFramePicker.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Research question/);
  assert.match(source, /Evidence/);
  assert.match(source, /Insights/);
  assert.match(source, /Concepts/);
  assert.match(source, /Decision/);
  assert.match(source, /Developer handoff/);
  assert.match(source, /role="dialog" aria-label="Research frames"/);
  assert.match(source, /label="Draw custom frame"/);
  assert.match(source, /aria-label="Frame navigator"/);
  assert.match(source, /label="Previous"/);
  assert.match(source, /label="Next"/);
  assert.match(source, /onFocus\(frames\[nextIndex\]\.elementId\)/);
});

test("keeps sticky note collaboration metadata without mounting a formatting toolbar", () => {
  const playgroundSource = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(playgroundSource, /<ProjectStickyNoteToolbar/);
  assert.doesNotMatch(playgroundSource, /updateSelectedStickyNote/);
  assert.match(playgroundSource, /collaboration = defaultProjectStickyNoteCollaboration\(\)/);
  assert.match(playgroundSource, /collaboration: normalizeProjectStickyNoteCollaboration\(reference\.collaboration\)/);
  assert.match(playgroundSource, /<ProjectStickyNoteMetadata/);
  assert.match(playgroundSource, /astryxReference:[\s\S]*collaboration/);
});

test("offers an internal searchable template library for designer workflows", () => {
  const source = readFileSync(
    new URL("./components/ProjectTemplateLibrary.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ Button, Card, TextInput \} from "@astryxdesign\/core"/);
  assert.match(source, /Search templates…/);
  assert.match(source, /Moodboard starter/);
  assert.match(source, /Design critique/);
  assert.match(source, /User flow/);
  assert.match(source, /Journey map/);
  assert.match(source, /Wireframe review/);
  assert.match(source, /Competitive comparison/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.doesNotMatch(source, /Browse libraries|target="_blank"/);
});

test("keeps Excalidraw project data durable and editor-agnostic", () => {
  const apiSource = readFileSync(new URL("./designerCanvasApi.ts", import.meta.url), "utf8");
  const assetSource = readFileSync(new URL("./projectCanvasAssets.ts", import.meta.url), "utf8");

  assert.match(apiSource, /application\/vnd\.astryx\.excalidraw\+json/);
  assert.match(apiSource, /\/api\/designer-canvases\/\$\{projectId\}/);
  assert.match(assetSource, /export async function uploadProjectCanvasAsset/);
  assert.match(assetSource, /encodeURIComponent\(assetId\)/);
  assert.doesNotMatch(apiSource + assetSource, /tldraw/i);
});

test("uses Astryx controls for the project reference picker", () => {
  const source = readFileSync(
    new URL("./components/ProjectReferencePanel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ Button, Card, TextInput \} from "@astryxdesign\/core"/);
  assert.match(source, /<TextInput/);
  assert.match(source, /<Card/);
  assert.match(source, /Add to canvas/);
  assert.match(source, /item\.mediaUrl/);
});

test("offers a data-aware Screens tool for the designer canvas", () => {
  const source = readFileSync(
    new URL("./components/ProjectScreenLibrary.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ Button, Card, TextInput \} from "@astryxdesign\/core"/);
  assert.match(source, /fetchCatalogPage\(endpoint, controller\.signal\)/);
  assert.match(source, /filterAppsDiscoveryScreens/);
  assert.match(source, /Search apps or screen types…/);
  assert.match(source, /Screen platform/);
  assert.match(source, /<PlaceholderImage/);
  assert.match(source, /Add to canvas/);
  assert.match(source, /No screens match this search yet/);
});

test("offers a Miro-style Astryx data catalog for apps and flows", () => {
  const source = readFileSync(
    new URL("./components/ProjectCanvasDataLibrary.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ Button, Card, TextInput \} from "@astryxdesign\/core"/);
  assert.match(source, /fetchCatalogPage\(endpoint, controller\.signal\)/);
  assert.match(source, /loadFlowCatalogPage\(/);
  assert.match(source, /role="dialog" aria-label="Astryx data tools"/);
  assert.match(source, /role="tablist" aria-label="Data type"/);
  assert.match(source, /Search apps…/);
  assert.match(source, /Search flows…/);
  assert.match(source, /Add app to canvas/);
  assert.match(source, /Add flow to canvas/);
  assert.match(source, /No apps match this search yet/);
  assert.match(source, /No flows match this search yet/);
});
