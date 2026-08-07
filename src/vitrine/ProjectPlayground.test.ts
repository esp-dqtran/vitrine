import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/*
 * The CSS assertions below describe selectors and declarations, not line breaks.
 * The formatter wraps long selectors across lines and writes leading zeros on
 * decimals, neither of which changes what the CSS does — but both broke these
 * regexes, and the suite sat red long enough to stop guarding anything. Matching
 * against a whitespace-normalised copy keeps them about the CSS.
 */
const readCss = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8").replace(/\s+/g, " ");

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
  /* The formatting toolbar is mounted now — see the sticky-selection test. */
  assert.match(source, /<ProjectStickyNoteToolbar/);
  assert.match(source, /selectedStickyNote/);
  assert.match(source, /updateSelectedStickyNote/);
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
  assert.match(source, /frameId: placement\.frameId \?\? null/);
  /* Every `if (canvasReadOnly) return` guard belonged to a moodboard callback.
     viewModeEnabled is what actually holds a read-only canvas shut. */
  assert.match(source, /viewModeEnabled=\{canvasReadOnly\}/);
  assert.match(source, /version: element\.version \+ 1/);
  assert.match(source, /setScreensOpen\(!screensOpen\)/);
  assert.match(source, /setTemplatesOpen\(!templatesOpen\)/);
  assert.match(source, /const \[saveErrorMessage, setSaveErrorMessage\] = useState\(""\)/);
  assert.match(source, /`\$\{saveLabels\[saveState\]\}: \$\{saveErrorMessage\}`/);
  assert.match(source, /icon="viewColumns"/);
  assert.match(source, /searchParams\.set\("inline", "1"\)/);
  /* Screen bytes still come through the media proxy — the fetch just moved
     into the shared card-image loader. */
  assert.match(source, /apiFetch\(canvasMediaFetchUrl\(url\)/);
  assert.match(source, /loadCatalogCardImage\(screen\.url, projectId\)/);
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
  const css = readCss("./styles.css");

  assert.match(css, /\.research-project-page--playground\s*\{[^}]*height:\s*100dvh;[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.project-canvas-header\s*\{[^}]*position:\s*absolute;[^}]*top:\s*8px;[^}]*justify-content:\s*space-between;[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.project-playground\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1;[^}]*overflow:\s*clip;/s);
  assert.match(css, /\.project-playground--canvas-first\s*\{[^}]*margin:\s*0;/s);
  assert.match(css, /\.project-playground__canvas\s*\{[^}]*position:\s*relative;[^}]*height:\s*100%;/s);
  assert.match(css, /\.project-playground__unavailable\s*\{[^}]*position:\s*absolute;[^}]*backdrop-filter:\s*blur\(12px\)/s);
  assert.match(css, /\.project-playground__references\s*\{[^}]*position:\s*absolute;[^}]*z-index:/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw\s*\{[^}]*--color-primary:[^}]*background:\s*var\(--project-canvas-bg/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-menu_top\s*\{[^}]*display:\s*block;[^}]*transform:\s*none;/s);
  /*
   * Rail widths derive from --project-canvas-tool-size rather than repeating a
   * literal in four places: the column, the Astryx group and the triggers all
   * have to move together, and they did not when the size was written out.
   */
  assert.match(css, /\.project-playground__canvas \.excalidraw \.App-toolbar > \.Stack_horizontal\s*\{[^}]*width:\s*var\(--project-canvas-tool-size[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.project-playground__astryx-tools\s*\{[^}]*width:\s*var\(--project-canvas-tool-size[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.project-playground__screens-trigger,[\s\S]*?\.project-playground__more-tools-trigger\s*\{[^}]*width:\s*var\(--project-canvas-tool-size[^}]*height:\s*var\(--project-canvas-tool-size/s);
  assert.match(css, /\.project-canvas-tools-catalog\s*\{[^}]*position:\s*absolute;[^}]*top:\s*136px;[^}]*left:\s*64px;[^}]*width:\s*min\(420px,/s);
  // \s+ between the compounds, not a literal space: the formatter wraps long
  // selectors across lines, which is not a change to what they select.
  assert.match(css, /\.project-playground__canvas--tool-panel-open\s+\.excalidraw\s+\.selected-shape-actions\s*\{[^}]*display:\s*none !important;/s);
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
  assert.match(css, /\.project-playground__canvas--screen-selected\s+\.excalidraw\s+\.excalidraw-hyperlinkContainer,[\s\S]*?\.selected-shape-actions\s*\{[^}]*display:\s*none !important;/s);
  assert.match(css, /\.project-screen-inspector\s*\{[^}]*position:\s*absolute;[^}]*right:\s*16px;[^}]*width:\s*280px;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.zoom-actions\s*\{[^}]*position:\s*fixed;[^}]*right:\s*56px;[^}]*bottom:\s*8px;[^}]*height:\s*48px;/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.undo-redo-buttons\s*\{[^}]*position:\s*fixed;[^}]*right:\s*236px;[^}]*width:\s*96px;[^}]*grid-template-columns:\s*repeat\(2, 48px\);/s);
  assert.match(css, /\.project-playground__canvas \.excalidraw \.undo-redo-buttons button:disabled\s*\{[^}]*opacity:\s*0?\.62;/s);
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
  const css = readCss("./styles.css");
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  // `0?\.5px`: the formatter writes the leading zero, which is the same length.
  assert.match(css, /\.project-canvas-header__group\s*\{[^}]*height:\s*48px;[^}]*gap:\s*4px;[^}]*pointer-events:\s*all;[^}]*border:\s*0?\.5px solid[^}]*border-radius:\s*8px;[^}]*box-shadow:\s*0 2px 4px rgb\(34 36 40 \/ 8%\);/s);
  assert.match(css, /\.project-canvas-collaborators\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s);
  assert.match(css, /\.project-canvas-collaborators__avatars > span\s*\{[^}]*border-radius:\s*50%;/s);
  assert.match(source, /label="Astryx projects home"/);
  assert.match(source, /className="project-canvas-header__brand-mark" src="\/favicon\.svg"/);
  /*
   * 32px is held by width + flex-basis, and the height is deliberately `auto`
   * so the wordmark keeps its aspect ratio instead of being squashed into a
   * square — a square asset renders identically either way.
   */
  assert.match(css, /\.project-canvas-header__group--left \.project-canvas-header__brand-mark\s*\{[^}]*width:\s*32px;[^}]*height:\s*auto;[^}]*flex:\s*0 0 32px;[^}]*border-radius:\s*10px;/s);
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

test("gives a selected sticky note its own formatting toolbar", () => {
  const playgroundSource = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  /*
   * This test previously asserted the opposite — that no formatting toolbar was
   * mounted. The panel existed, fully built and styled, but nothing rendered it,
   * while the stylesheet hid Excalidraw's own panel on --sticky-selected. A
   * selected note therefore had no properties UI at all, and collaboration was
   * display-only: ProjectStickyNoteMetadata shows tags, reactions and comments,
   * and only this toolbar can add them.
   */
  assert.match(playgroundSource, /<ProjectStickyNoteToolbar/);
  assert.match(playgroundSource, /onColorChange=\{\(color\) => updateSelectedStickyNote\(\{ color \}\)\}/);
  assert.match(playgroundSource, /onFormatChange=\{\(format\) => updateSelectedStickyNote\(\{ format \}\)\}/);
  assert.match(playgroundSource, /onCollaborationChange=/);
  // Read-only boards get the metadata, not the controls.
  assert.match(playgroundSource, /selectedStickyNote && !canvasReadOnly &&/);
  // Colour lives on the container, ink and type on the bound text element.
  assert.match(playgroundSource, /element\.id === note\.elementId[\s\S]{0,400}backgroundColor: color\.fill/);
  assert.match(playgroundSource, /note\.textElementId && element\.id === note\.textElementId[\s\S]{0,300}strokeColor: color\.text/);

  /*
   * Clicking into a note's text selects the bound text element, not the
   * rectangle: it is not type "rectangle" and carries no astryxReference, so
   * matching containers alone dropped the note and handed the panel back to
   * Excalidraw's generic shape actions in the middle of editing.
   */
  assert.match(playgroundSource, /const containerId = \(element as \{ containerId\?: string \| null \}\)\.containerId;/);
  assert.match(playgroundSource, /const container = elements\.find\(\(candidate\) => candidate\.id === containerId\);/);
  // Container plus its text is still one note, not two.
  assert.match(playgroundSource, /uniqueSelectedStickyNotes/);
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

  // IconButton joined the import when the text "Close" became the shared icon.
  // Imports the shared segmented control now, so the switcher is the
  // product's own rather than ghost buttons wearing role="tab".
  assert.match(source, /SegmentedControl/);
  assert.match(source, /IconButton/);
  assert.match(source, /fetchCatalogPage\(endpoint, controller\.signal\)/);
  assert.match(source, /filterAppsDiscoveryScreens/);
  assert.match(source, /Search apps or screen types…/);
  assert.match(source, /Screen platform/);
  assert.match(source, /<PlaceholderImage/);
  /* Cards are dragged onto the board now; the per-card button is gone. */
  assert.doesNotMatch(source, /Add to canvas/);
  assert.match(source, /draggable: true/);
  assert.match(source, /No screens match this search yet/);
});

test("offers a Miro-style Astryx data catalog for apps and flows", () => {
  const source = readFileSync(
    new URL("./components/ProjectCanvasDataLibrary.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /SegmentedControl/);
  assert.match(source, /fetchCatalogPage\(endpoint, controller\.signal\)/);
  assert.match(source, /loadFlowCatalogPage\(/);
  assert.match(source, /role="dialog" aria-label="Astryx data tools"/);
  /* SegmentedControl owns the roles now — it renders a radiogroup, which is the
     correct semantic for a single-choice switcher and is what the rest of the
     product uses. A row of ghost buttons carrying role="tab" was neither. */
  assert.match(source, /<SegmentedControl[\s\S]{0,200}label="Data type"/);
  assert.match(source, /<SegmentedControl[\s\S]{0,200}label="Data platform"/);
  assert.doesNotMatch(source, /role="tab"/);
  assert.match(source, /Search apps…/);
  assert.match(source, /Search flows…/);
  assert.match(source, /Add app to canvas/);
  assert.match(source, /Add flow to canvas/);
  assert.match(source, /No apps match this search yet/);
  assert.match(source, /No flows match this search yet/);
});

test("themes the canvas tools catalog instead of hardcoding light-mode ink", () => {
  const css = readCss("./styles.css");

  /*
   * The catalog painted itself in literal light-theme hexes while its surface
   * came from --project-canvas-surface, which follows the theme. On a dark
   * canvas that put #172033 text on a near-black panel: the "Tools" heading and
   * every tool name were invisible, and only the muted descriptions survived.
   * Every ink here has to come from the canvas variables, which already resolve
   * per theme, so the panel cannot drift away from its own background again.
   */
  const rules = css.match(/\.project-canvas-tools-catalog[^{]*\{[^}]*\}/g) ?? [];
  assert.ok(rules.length > 8, `expected the catalog's rules, found ${rules.length}`);

  const hardcoded = rules.filter((rule) =>
    /(?:^|[;{ ])(?:color|background|background-color|border-color):\s*#[0-9a-f]{3,8}/i.test(rule),
  );
  assert.deepEqual(hardcoded, [], "catalog ink must read from --project-canvas-*");

  assert.match(css, /\.project-canvas-tools-catalog\s*\{[^}]*color:\s*var\(--project-canvas-text/s);
  assert.match(css, /\.project-canvas-tools-catalog__header h2\s*\{[^}]*color:\s*var\(--project-canvas-text/s);
  assert.match(css, /\.project-canvas-tools-catalog__item\s*\{[^}]*color:\s*var\(--project-canvas-text/s);
});

test("lights an Astryx canvas tool the same way Excalidraw lights its own", () => {
  const css = readCss("./styles.css");

  /*
   * The Astryx triggers are portaled into Excalidraw's toolbar Island, so they
   * sit beside the native tools and inherit the editor's own custom properties.
   * Hardcoding #1f2a7c on #e6e7ff made them a light-mode pair that neither
   * matched the tool next to them on a dark canvas nor followed the theme.
   * --color-surface-primary-container / --color-on-primary-container are the
   * exact pair Excalidraw uses for a checked ToolIcon, and both ship a dark
   * value, so an Astryx tool and a native tool now light up identically.
   */
  const pressed =
    /\.project-playground__more-tools-trigger\[aria-pressed="true"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(pressed, /background:\s*var\(--color-surface-primary-container/);
  assert.match(pressed, /color:\s*var\(--color-on-primary-container/);

  // The native override that sits above it must use the same pair, or the two
  // halves of one toolbar drift apart again.
  const native =
    /\.ToolIcon_type_checkbox:checked \+ \.ToolIcon__icon\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(native, /background:\s*var\(--color-surface-primary-container/);
  assert.match(native, /color:\s*var\(--color-on-primary-container/);

  /*
   * Size, radius and hover come from one rail geometry rather than each half
   * naming its own value: the native icons are overridden to 40px here, so
   * pointing the Astryx triggers at Excalidraw's un-overridden 32px default
   * made them visibly smaller than the tools they sit between.
   */
  assert.match(css, /--project-canvas-tool-size:\s*\d+px;/);
  assert.match(css, /--project-canvas-tool-gap:\s*\d+px;/);
  /*
   * The rail's vertical constants are named once and re-pointed for phones,
   * rather than the geometry they drive being restated per breakpoint — 222px
   * and 310px are "header + zoom cluster", which nothing said out loud.
   */
  assert.match(css, /--project-canvas-rail-reserved:\s*\d+px;/);
  assert.match(css, /max-height:\s*calc\(100dvh - var\(--project-canvas-rail-reserved/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?--project-canvas-rail-reserved:\s*\d+px;/s);
  assert.doesNotMatch(css, /max-height:\s*calc\(100dvh - 310px\)/);
  const railHover = /\.project-playground__more-tools-trigger:hover\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const nativeHover =
    /\.excalidraw \.App-toolbar__extra-tools-trigger:hover\s*\{([^}]*)\}/.exec(css)?.[1] ??
    /\.App-toolbar \.ToolIcon__icon:hover[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(railHover, /var\(--project-canvas-tool-hover\)/);
  assert.match(nativeHover, /var\(--project-canvas-tool-hover\)/);
  const triggerSize =
    /\.project-playground__more-tools-trigger\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(triggerSize, /width:\s*var\(--project-canvas-tool-size/);
  assert.doesNotMatch(triggerSize, /--default-button-size/);
  assert.match(css, /\.project-playground__more-tools-trigger:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-primary/s);
});

test("keeps every canvas panel's ink on the theme, not on light-mode hexes", () => {
  const css = readCss("./styles.css");

  /*
   * A panel taking its surface from --project-canvas-surface* while writing its
   * text in a literal hex is the recurring canvas bug: on a dark board the
   * heading lands on a near-black panel and disappears. Swatch fills stay
   * literal on purpose — a sticky note is yellow in either theme — so this
   * checks the chrome (headings, body ink, borders), not the content colours.
   */
  const panels = [
    "project-canvas-tools-catalog",
    "project-sticky-note-picker",
    "project-sticky-note-toolbar",
    "project-screen-library",
  ];
  for (const panel of panels) {
    const rules = css.match(new RegExp(`\\.${panel}[^{]*\\{[^}]*\\}`, "g")) ?? [];
    assert.ok(rules.length > 4, `expected ${panel} rules, found ${rules.length}`);
    const hardcoded = rules.filter(
      (rule) =>
        /(?:^|[;{ ])(?:color|border-color):\s*#[0-9a-f]{3,8}/i.test(rule) ||
        /(?:^|[;{ ])background:\s*#[0-9a-f]{3,8}/i.test(rule),
    );
    assert.deepEqual(hardcoded, [], `${panel} must read ink from --project-canvas-*`);
  }

  assert.match(
    css,
    /\.project-sticky-note-picker__header\s*\{[^}]*color:\s*var\(--project-canvas-text/s,
  );
});

test("keeps the sticky composer reachable and glued to the board", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  /*
   * The composer renders only when its style memo returns a value, and that memo
   * used to read editorRef/canvasRootRef and bail to undefined when either was
   * null. That left `stickyDraft` set with nothing on screen to type into — and
   * because `stickyDraft` also switches off handleKeyboardGlobally, the board
   * went unresponsive with no way back. It never recomputed on pan or zoom
   * either, since refs do not re-render.
   */
  const memo = /const stickyComposerStyle = useMemo\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/.exec(source);
  assert.ok(memo, "sticky composer style memo not found");
  assert.doesNotMatch(memo[1], /if \(!editor \|\| !root\) return undefined;/);
  assert.doesNotMatch(memo[1], /editorRef\.current/);
  assert.match(memo[1], /canvasViewport/);
  assert.match(memo[2], /canvasViewport/);

  // Only the absent draft withholds the composer now.
  assert.equal((memo[1].match(/return undefined;/g) ?? []).length, 1);
  assert.match(memo[1], /if \(!stickyDraft\) return undefined;/);

  // The sibling overlay already positioned itself this way; both now agree.
  assert.match(source, /stickyNoteMetadataStyle[\s\S]{0,400}canvasViewport\.scrollX/);
});

test("scales the sticky composer with the board it stands in for", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  /*
   * The composer is a screen-space stand-in for a canvas element. Its position
   * was multiplied by zoom but its size was a flat 240px, so at 50% zoom it
   * covered twice the note it represented and at 200% half of it. Size, text and
   * padding all have to move with the board.
   */
  const memo = /const stickyComposerStyle = useMemo\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/.exec(source);
  assert.ok(memo, "sticky composer style memo not found");
  assert.match(memo[1], /const width = stickyNoteSize \* zoom;/);
  assert.match(memo[1], /const height = stickyNoteSize \* zoom;/);
  assert.match(memo[1], /"--sticky-font-size": `\$\{stickyDraft\.format\.fontSize \* zoom\}px`/);
  assert.match(memo[1], /"--sticky-padding": `\$\{24 \* zoom\}px`/);
  // The narrow-screen guard the stylesheet gave us must survive the inline size.
  assert.match(memo[1], /width: `min\(\$\{width\}px, calc\(100vw - 24px\)\)`/);
  assert.doesNotMatch(memo[1], /const width = stickyNoteSize;/);
});

test("leaves focus where the reader clicked when a sticky draft ends", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  /*
   * Committing used to focus the canvas and re-select the new note on an 80ms
   * timeout, whatever ended the draft. Clicking away therefore bounced: the
   * click deselected and moved focus, then the timer pulled both back to the
   * note. A deliberate finish still selects it; a blur no longer does.
   */
  assert.match(source, /\{ selectNote = true \}: \{ selectNote\?: boolean \} = \{\}/);
  assert.match(source, /if \(selectedElementId && selectNote\)/);
  assert.match(
    source,
    /onBlur=\{\(event\) => \{[\s\S]*?commitStickyDraft\(event\.currentTarget\.textContent \?\? "", \{ selectNote: false \}\);/,
  );
  // ⌘↵ keeps the old behaviour — it is a finish, not a departure.
  assert.match(
    source,
    /event\.key === "Enter" && \(event\.metaKey \|\| event\.ctrlKey\)[\s\S]{0,160}commitStickyDraft\(event\.currentTarget\.textContent \?\? ""\);/,
  );
});

test("gives the board the whole viewport, outside the workspace shell", () => {
  const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  const playgroundSource = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  /*
   * The canvas routes used to sit in the workspace-chrome allowlist, so the
   * board rendered inside the rail and the inset panel: two headers, a 200px
   * gutter it did not ask for, and a 100dvh child inside a panel that could not
   * contain it. The board is its own shell — own brand mark, own identity, own
   * tool rail — so it renders bare.
   */
  const allowlist = /const workspaceChromeRoutes = new Set\(\[([\s\S]*?)\]\);/.exec(appSource);
  assert.ok(allowlist, "workspace chrome allowlist not found");
  assert.doesNotMatch(allowlist[1], /"project-canvas"/);
  assert.doesNotMatch(allowlist[1], /"project-playground"/);
  // The surfaces that do belong in the shell stay there.
  assert.match(allowlist[1], /"projects"/);
  assert.match(allowlist[1], /"project"/);
  assert.match(allowlist[1], /"collections"/);

  // Nothing to publish to a shell it no longer renders in, and its own way out.
  assert.doesNotMatch(playgroundSource, /useWorkspaceChrome/);
  assert.match(playgroundSource, /label="Astryx projects home"/);
});

test("closes every canvas panel with the same control", () => {
  const screens = readFileSync(
    new URL("./components/ProjectScreenLibrary.tsx", import.meta.url),
    "utf8",
  );
  const playground = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  // A labelled Button rendered as a stray uppercase "CLOSE" beside the heading;
  // every other panel dismisses with the same icon.
  assert.match(screens, /<IconButton[\s\S]{0,200}icon=\{<Icon icon="close" size="sm" \/>\}/);
  assert.doesNotMatch(screens, /<Button label="Close"/);
  assert.match(playground, /icon=\{<Icon icon="close" size="sm" \/>\}/);
});

test("browses the catalog by app before by screen", () => {
  const source = readFileSync(
    new URL("./components/ProjectScreenLibrary.tsx", import.meta.url),
    "utf8",
  );
  const playground = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  /*
   * The panel fetched whole apps and then flattened them into screens, so four
   * cards from one app came before you reached a second — the wrong grain for
   * finding anything. Apps are kept from the same response, no extra request.
   */
  assert.match(source, /setApps\(page\.apps\.slice\(0, 24\)\);/);
  assert.match(source, /useState<ScreenLibraryMode>\("apps"\)/);
  assert.match(source, /\{ value: "apps", label: "Apps" \}/);
  assert.match(source, /\{ value: "screens", label: "Screens" \}/);
  assert.match(source, /state === "ready" && mode === "apps"/);
  assert.match(source, /state === "ready" && mode === "screens"/);
  // Placing an app reuses the existing catalog-reference path.
  assert.match(source, /dragProps\(\{ kind: "app", app, platform \}/);
  assert.match(playground, /onDragItem=\{\(payload\) => \{ catalogDragRef\.current = payload; \}\}/);

  /*
   * Flows are a third grain in the same panel. Only they need a request of their
   * own — apps and screens are one catalog response, screens being that response
   * flattened — so the fetch branches on mode rather than always hitting both.
   */
  assert.match(source, /\{ value: "flows", label: "Flows" \}/);
  assert.match(source, /mode === "flows"\s*\?\s*loadFlowCatalogPage/);
  assert.match(source, /state === "ready" && mode === "flows"/);
  assert.match(source, /dragProps\(\{ kind: "flow", item, platform \}/);
});

test("promotes the catalog to the rail and names it for what it holds", () => {
  const playground = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  const panel = readFileSync(
    new URL("./components/ProjectScreenLibrary.tsx", import.meta.url),
    "utf8",
  );

  /*
   * The panel is the way onto the canvas for apps, screens and flows, so it is
   * a rail tool rather than something to find inside the "more tools" catalog.
   * Its own styling already existed — only the button was missing.
   */
  assert.match(playground, /className="project-playground__screens-trigger"/);
  assert.match(playground, /onClick=\{\(\) => activateCanvasTool\("screens"\)\}/);
  assert.match(playground, /tool: "screens",[\s\S]{0,260}pinned: true/);

  // "Screens" undersold a panel that browses three grains.
  assert.match(panel, /<h2>Catalog<\/h2>/);
  /*
   * No eyebrow. Removing the markup alone would have been worse than leaving
   * it: `.project-screen-library__header span` would then have caught the close
   * button's icon wrapper and sized the glyph to the eyebrow's 10px.
   */
  assert.doesNotMatch(panel, /<span>Astryx data<\/span>/);
  const css = readCss("./styles.css");
  assert.doesNotMatch(css, /\.project-screen-library__header span/);
  assert.match(panel, /Search apps, screens and flows, then place them on this canvas\./);
  assert.doesNotMatch(panel, /Search captured product screens and place them/);
  // The search field names whichever grain is showing.
  assert.match(panel, /const searchLabel = mode === "apps"/);
  assert.match(panel, /label=\{searchLabel\}/);
  assert.match(panel, /placeholder=\{searchPlaceholder\}/);
});

test("drops catalog records where the reader releases them", () => {
  const panel = readFileSync(
    new URL("./components/ProjectScreenLibrary.tsx", import.meta.url),
    "utf8",
  );
  const playground = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  /*
   * The record travels in a ref, not dataTransfer — these are whole catalog
   * objects and a ref skips serialising and reparsing them. dataTransfer still
   * carries a label so the drag is valid to the OS.
   */
  assert.match(panel, /event\.dataTransfer\.effectAllowed = "copy";/);
  assert.match(panel, /onDragEnd:[\s\S]{0,200}onDragItem\(undefined\)/);
  assert.match(playground, /const catalogDragRef = useRef<CatalogDragPayload \| undefined>\(undefined\)/);

  /*
   * Native listeners on document, capture phase. React attaches its synthetic
   * handlers at the app root and Excalidraw runs its own drag/drop on the
   * canvas, so capturing at document is the only place guaranteed to run before
   * both — and stopping it there keeps both out of a catalog drag.
   */
  assert.match(playground, /document\.addEventListener\("dragover", onDragOver, true\)/);
  assert.match(playground, /document\.addEventListener\("drop", onDrop, true\)/);
  assert.match(playground, /document\.removeEventListener\("drop", onDrop, true\)/);
  assert.match(playground, /const onDragOver = \(event: DragEvent\)[\s\S]{0,300}event\.stopPropagation\(\)/);
  // Scoped to the board, so drags elsewhere in the app are untouched.
  assert.match(playground, /root\.contains\(target\)/);

  /* The record is read back from dataTransfer, so a drop works even when the
     ref was never set — which is what happens if something other than the card
     ends up owning the gesture. */
  assert.match(playground, /JSON\.parse\(raw\) as CatalogDragPayload/);
  assert.match(panel, /setData\(catalogDragMimeType, JSON\.stringify\(payload\)\)/);

  // The ghost is the whole card, held where it was grabbed.
  assert.match(panel, /setDragImage\(\s*card,/);
  /* A marker type on the drag, so a target can recognise it from the event
     rather than from state it must have been told about. */
  /* Array.from first — `types` is a DOMStringList in some engines, where
     `.includes` throws and takes the listener with it. */
  assert.match(playground, /Array\.from\(event\.dataTransfer\?\.types \?\? \[\]\)\.includes\(catalogDragMimeType\)/);
  assert.match(playground, /addEventListener\("dragenter", onDragOver, true\)/);
  /* An <img> is natively draggable; left alone it starts a browser image-drag
     with the image URL and the card's dragstart never owns the gesture. */
  const css = readCss("./styles.css");
  assert.match(css, /\.project-screen-library__card img \{[^}]*-webkit-user-drag: none;/s);
  assert.match(panel, /card\.dataset\.dragging = "true"/);

  /* Screen point to scene point is the inverse of how overlays are placed:
     screen = (scene + scroll) * zoom. */
  assert.match(playground, /x: \(event\.clientX - rect\.left\) \/ zoom - appState\.scrollX/);
  assert.match(playground, /y: \(event\.clientY - rect\.top\) \/ zoom - appState\.scrollY/);
  // A drop names its spot; a click keeps the cascade-from-last-card default.
  assert.match(playground, /placement\?\.x \?\? \(lastDataCard/);
});

test("places catalog records as composed cards, not a labelled rectangle", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  /*
   * A card is a group of real elements — container, thumbnail, eyebrow, title,
   * meta — rather than one rectangle carrying a multi-line label. The label
   * form centred everything and left no room for a thumbnail, so an app and a
   * flow were indistinguishable on the board.
   */
  assert.match(source, /function createCatalogCardElements\(/);
  assert.match(source, /const groupId = `astryx-card-/);
  // Every part shares the group, so the card moves and deletes as one object.
  assert.equal((source.match(/groupIds: \[groupId\]/g) ?? []).length, 5);
  // The container keeps the reference, so selection and "open source" still work.
  assert.match(source, /customData: \{ astryxReference: reference \}/);

  /* Thumbnails are contained, not stretched: these are screenshots, and a
     squashed screenshot is unreadable. */
  assert.match(source, /Math\.min\(\s*\(width - padding \* 2\) \/ image\.width/);
  // A dead media URL must not stop a card being placed.
  assert.match(source, /async function loadCatalogCardImage[\s\S]{0,900}return undefined;/);
  assert.match(source, /image: loaded\?\.image/);

  /*
   * All three grains are cards: an app, a flow and a screen each carry an
   * eyebrow, a title and their metadata rather than one being a bare image.
   */
  assert.match(source, /eyebrow: isApp \? "App" : "Flow"/);
  assert.match(source, /eyebrow: "Screen"/);
  // A screen card dropped into a frame still belongs to it.
  assert.match(source, /frameId: placement\.frameId \?\? null/);
});

/*
 * The moodboard is gone: its panel, its smart-compose pass, its section frames
 * and the per-reference keep/maybe/reject record that rode along in every
 * inserted element's customData. Screens, references and uploads now land on
 * the canvas directly. This guards the removal — the feature spanned two
 * modules, ~30 symbols and 75 CSS rules, so a partial revival is easy to miss.
 */
test("keeps the moodboard out of the canvas", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /moodboard/i);
  assert.doesNotMatch(readCss("./styles.css"), /moodboard/i);

  // Placement survived the removal: the frame-relative branch went with the
  // section frames, the viewport-centred one is what every insert uses now.
  assert.match(source, /const canvasImagePlacement = useCallback/);
  assert.match(source, /canvasImagePlacement\(dimensions\.width, dimensions\.height\)/);
});

/*
 * The screen card used to fall back to `screen.url` when the project upload
 * failed. The bytes only ever arrived through the media proxy, so handing that
 * raw catalog URL to an <img> placed the card with a broken image. Every card
 * grain now goes through one loader whose fallback is an inline data URL.
 */
test("never points a catalog card at an image URL the page cannot load", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  const insertScreen = /const insertCatalogScreen = useCallback\(([\s\S]*?)\n  \}, \[/.exec(source)?.[1] ?? "";
  assert.ok(insertScreen, "expected to find insertCatalogScreen");
  assert.match(insertScreen, /loadCatalogCardImage\(screen\.url, projectId\)/);
  assert.doesNotMatch(insertScreen, /=\s*screen\.url;/);
  assert.doesNotMatch(insertScreen, /uploadProjectCanvasAsset/);

  // The one loader keeps the bytes inline rather than reaching for the origin.
  const loader = /async function loadCatalogCardImage\(([\s\S]*?)\n\}/.exec(source)?.[1] ?? "";
  assert.match(loader, /readAsDataURL/);
  assert.doesNotMatch(loader, /src = url/);
});

/*
 * Placing a card is a transient success, so it belongs in the app toast rather
 * than as a line of text left sitting inside a catalog panel. The panels keep
 * their message channel only where it still reports a failure.
 */
test("confirms a placed card with the app toast", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ useApplicationToast \} from "\.\/ApplicationToast\.tsx"/);
  assert.match(source, /const showToast = useApplicationToast\(\);/);
  assert.match(source, /showToast\(storedInProject/);
  assert.match(source, /showToast\(message\);/);

  // The screen panel no longer narrates success, and the data library lost a
  // message channel that nothing wrote to once the toast took over.
  assert.doesNotMatch(source, /setScreenMessage\(\s*storedInProject/);
  assert.doesNotMatch(source, /dataToolsMessage/);
  assert.match(source, /setScreenMessage\(\(error as Error\)\.message\)/);

  const library = readFileSync(
    new URL("./components/ProjectCanvasDataLibrary.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(library, /project-canvas-data-library__message/);
});
