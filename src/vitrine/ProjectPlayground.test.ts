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
  const commentsSource = readFileSync(
    new URL("./components/ProjectCanvasComments.tsx", import.meta.url),
    "utf8",
  );
  const css = readCss("./styles.css");

  assert.match(
    source,
    /\bExcalidraw\b[\s\S]*from ["']@excalidraw\/excalidraw["']/,
  );
  assert.match(source, /import ["']@excalidraw\/excalidraw\/index\.css["']/);
  assert.match(
    source,
    /astryx:project:\$\{projectId\}:canvas:\$\{canvasId \?\? "legacy"\}:excalidraw:v1/,
  );
  assert.match(
    source,
    /serializeAsJSON\(elements, appState, files, "database"\)/,
  );
  assert.match(source, /hashElementsVersion/);
  assert.match(source, /files: snapshot\.files \?\? files \?\? \{\}/);
  assert.match(
    source,
    /const canvasSaveKey = \(snapshot: ExcalidrawProjectSnapshot\)/,
  );
  assert.match(source, /lastQueuedSnapshotKeyRef/);
  assert.match(
    source,
    /if \(snapshotKey === lastQueuedSnapshotKeyRef\.current\) return;/,
  );
  assert.match(source, /getDesignerCanvas/);
  assert.match(source, /saveDesignerCanvas/);
  assert.match(source, /DesignerCanvasApiError/);
  assert.match(source, /openDesignerCanvasCollaboration/);
  assert.match(source, /collaborationRef\.current\?\.publishScene\(snapshot\)/);
  assert.match(source, /onPointerUpdate=\{handleCanvasPointerUpdate\}/);
  assert.match(source, /collaborationRef\.current\?\.publishCursor/);
  assert.match(source, /onPresence\(collaborators\)/);
  assert.match(source, /onCursor\(cursor\)/);
  assert.match(
    source,
    /editorRef\.current\?\.updateScene\(\{ collaborators \}\)/,
  );
  assert.match(source, /className="project-canvas-collaborators"/);
  assert.match(source, /isCollaborating=\{collaborationStatus === "live"\}/);
  assert.match(
    source,
    /const selectedElementIds = editor\.getAppState\(\)\.selectedElementIds/,
  );
  assert.match(
    source,
    /editor\.updateScene\(\{[\s\S]*elements: value\.elements,[\s\S]*appState: \{ selectedElementIds \}/,
  );
  assert.match(source, /remoteElementsVersionRef/);
  assert.match(source, /remoteBroadcastSuppressedUntilRef/);
  assert.match(source, /collaboration\.close\(\)/);
  assert.match(source, /uploadProjectCanvasAsset/);
  assert.match(source, /persistEmbeddedFiles/);
  assert.match(source, /Offline — changes saved in this browser/);
  assert.match(
    source,
    /window\.addEventListener\("pagehide", saveBeforeExit\)/,
  );
  assert.match(source, /pendingSnapshotRef\.current \?\?= snapshot/);
  assert.match(source, /label=\{saveStatusLabel\}/);
  assert.match(source, /Project canvas unavailable/);
  assert.match(source, /<Button/);
  assert.doesNotMatch(
    source,
    /label=\{referencesOpen \? "Close references" : "References"\}/,
  );
  assert.match(source, /getResearchProject\(projectId\)/);
  assert.match(
    source,
    /<h1>\{references\?\.title \?\? "Designer project"\}<\/h1>/,
  );
  assert.match(
    source,
    /const saveStateIcons: Record<CanvasSaveState, IconName>/,
  );
  assert.match(source, /className="project-canvas-header__identity-title"/);
  assert.match(source, /className="project-playground__identity-status"/);
  assert.match(source, /aria-label=\{saveStatusLabel\}/);
  assert.match(source, /convertToExcalidrawElements/);
  assert.match(source, /editor\.addFiles\(\[file\]\)/);
  assert.match(source, /<ProjectReferencePanel/);
  assert.match(source, /<ProjectScreenLibrary/);
  assert.match(source, /function canvasObjectFocusBounds/);
  assert.match(
    source,
    /function canvasObjectFocusBounds[\s\S]*?canvasFreeLineReferenceForElement\(element\)/,
  );
  assert.match(source, /className="project-canvas-focus-container"/);
  assert.match(
    css,
    /\.project-canvas-focus-container \{[^}]*border:\s*2px dashed rgb\(31 31 31 \/ 58%\);/,
  );
  assert.match(
    css,
    /--color-selection: #0d99ff00;/,
  );
  assert.match(source, /<ProjectTemplateLibrary/);
  assert.match(source, /<ProjectStickyNotePicker/);
  assert.match(source, /<ProjectCanvasDocumentEditor/);
  assert.match(source, /canvasDocuments\.map\(\(document\) =>/);
  assert.match(
    source,
    /isSelected=\{\s*selectedCanvasDocument\?\.elementId === document\.elementId\s*\}/,
  );
  assert.doesNotMatch(source, /ProjectCanvasDataLibrary/);
  assert.match(source, /<ProjectResearchFramePicker/);
  assert.match(source, /createPortal\(/);
  assert.match(source, /className="project-playground__astryx-tools"/);
  assert.match(
    source,
    /role="group"[\s\S]*?aria-label="Vitrines canvas tools"/,
  );
  assert.match(
    source,
    /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/,
  );
  assert.match(source, /function ProjectCanvasToolGlyph/);
  assert.match(source, /stickyColor\?: ProjectStickyNoteColor/);
  assert.match(source, /tool="document"/);
  assert.match(source, /className="project-playground__sticky-trigger"/);
  assert.match(source, /className="project-playground__shapes-trigger"/);
  assert.match(
    source,
    /className="project-playground__screens-trigger project-playground__screens-trigger--apps"/,
  );
  assert.match(source, /<CanvasCatalogAppsCollageGlyph \/>/);
  assert.match(source, /function CanvasCatalogAppsCollageGlyph/);
  assert.match(source, /id: "snapchat"[\s\S]*?app: "Snapchat"/);
  assert.match(source, /id: "messenger"[\s\S]*?app: "Messenger"/);
  assert.match(source, /id: "claude"[\s\S]*?app: "Claude"/);
  assert.match(
    source,
    /className="project-playground__sticky-tools"[\s\S]*?className="project-playground__screens-trigger project-playground__screens-trigger--apps"[\s\S]*?className="project-playground__sticky-trigger"[\s\S]*?className="project-playground__shapes-trigger"[\s\S]*?project-playground__sticky-tools-divider/,
  );
  assert.match(
    source,
    /aria-label=\{\s*shapePickerOpen\s*\? "Close shapes and connectors"\s*: "Shapes and connectors"\s*\}/,
  );
  assert.match(source, /const canvasShapeOptions/);
  assert.match(source, /useState\(defaultSectionFill\)/);
  assert.match(source, /const canvasShapeColors = canvasSectionColors/);
  assert.match(source, /aria-label="Custom shape color"/);
  assert.match(source, /selectCanvasShapeColor\(event\.currentTarget\.value\)/);
  assert.match(source, /<CanvasShapesCollageGlyph color=\{shapeColor\} \/>/);
  assert.match(
    css,
    /\.project-playground__screens-trigger--apps\s*\{[\s\S]*?width:\s*64px;[\s\S]*?overflow:\s*visible;/,
  );
  assert.match(
    css,
    /\.project-canvas-catalog-apps-collage__snapchat\s*\{[\s\S]*?translate\(8px, 27px\)/,
  );
  assert.match(
    css,
    /\.project-canvas-catalog-apps-collage__claude\s*\{[\s\S]*?translate\(30px, 39px\)/,
  );
  assert.match(
    css,
    /label:has\(input\[data-testid="toolbar-text"\]\)\s*\{[\s\S]*?order:\s*0;/,
  );
  assert.match(
    css,
    /\.project-playground__sticky-tools-divider\s*\{[\s\S]*?height:\s*40px;/,
  );
  assert.match(source, /function CanvasShapesCollageGlyph/);
  const shapesCollageSource =
    /function CanvasShapesCollageGlyph[\s\S]*?\n}\n\nfunction/.exec(
      source,
    )?.[0] ?? "";
  assert.match(
    shapesCollageSource,
    /<ShapeLibraryGlyph[\s\S]*?shape=\{canvasShapePreviewOptions\.rectangle\}[\s\S]*?color=\{color\}/,
  );
  assert.match(
    shapesCollageSource,
    /<ShapeLibraryGlyph[\s\S]*?shape=\{canvasShapePreviewOptions\.ellipse\}[\s\S]*?color=\{color\}/,
  );
  assert.match(
    source,
    /glyphFill\?: "rectangle" \| "rounded-rectangle" \| "ellipse"/,
  );
  assert.match(source, /project-canvas-shape-glyph--filled/);
  assert.doesNotMatch(
    css,
    /label:has\(input\[data-testid="toolbar-text"\]\)::before/,
  );
  assert.match(
    css,
    /label:has\(input\[data-testid="toolbar-text"\]\)[\s\S]*?\.ToolIcon__icon\s*\{[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;/,
  );
  assert.match(
    css,
    /label:has\(input\[data-testid="toolbar-text"\]\)[\s\S]*?\.ToolIcon__icon\s+svg\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/,
  );
  assert.doesNotMatch(css, /\.project-playground__section-tool-divider\s*\{/);
  assert.match(
    source,
    /const \[textToolActive, setTextToolActive\] = useState\(false\)/,
  );
  assert.match(
    source,
    /const \[textSelectionActive, setTextSelectionActive\] = useState\(false\)/,
  );
  assert.match(
    source,
    /nextCanvasTextEditing \|\| appState\.activeTool\.type === "text"/,
  );
  assert.match(css, /figjam-text-tool\.svg/);
  assert.match(
    css,
    /project-playground__canvas--text-tool[\s\S]*?toolbar-text[\s\S]*?background:\s*#9747ff/s,
  );
  assert.match(
    css,
    /project-playground__canvas--text-selection[\s\S]*selected-shape-actions[\s\S]*display:\s*none !important/s,
  );
  assert.match(source, /selectedCanvasText/);
  assert.match(source, /<ProjectObjectToolbar/);
  assert.match(source, /const deactivateStickyTool = useCallback/);
  assert.match(
    source,
    /stickyToolIsActive[\s\S]*appState\.activeTool\.customType === "astryx-sticky-note"[\s\S]*if \(!stickyToolIsActive && !stickyPlacementRef\.current\) \{[\s\S]*deactivateStickyTool\(\);/,
  );
  assert.match(
    source,
    /import figjamBentConnectorIcon from "\.\.\/assets\/figjam-bent-connector\.svg"/,
  );
  assert.match(
    source,
    /import figjamSquareIcon from "\.\.\/assets\/figjam-square\.svg"/,
  );
  assert.match(
    source,
    /import figjamRoundedRectangleIcon from "\.\.\/assets\/figjam-rounded-rectangle\.svg"/,
  );
  assert.match(
    source,
    /--project-canvas-shape-icon-color": color \?\? "#1e1e1e"/,
  );
  assert.match(source, /editor\?\.setActiveTool\(\{ type: shape\.tool \}\)/);
  assert.match(
    source,
    /currentItemStrokeColor: isFilledShape \? "#757575" : shapeColor/,
  );
  assert.match(
    source,
    /currentItemBackgroundColor: isFilledShape[\s\S]*?\? shapeColor[\s\S]*?: "transparent"/,
  );
  assert.match(source, /currentItemArrowType: shape\.arrowType \?\? "sharp"/);
  assert.match(source, /currentItemRoundness: shape\.roundness \?\? "sharp"/);
  assert.match(source, /label: "Bent connector"/);
  assert.match(source, /label: "Arrow"/);
  assert.match(source, /label: "Rectangle"/);
  assert.match(source, /label: "Circle"/);
  assert.match(
    source,
    /function ShapeLibraryGlyph\([\s\S]*?--project-canvas-shape-source-color": color[\s\S]*?<img src=\{shape\.icon\}/,
  );
  assert.match(source, /<CanvasShapesCollageGlyph color=\{shapeColor\} \/>/);
  assert.match(
    source,
    /<ShapeLibraryGlyph shape=\{shape\} color=\{shapeColor\} \/>/,
  );
  assert.match(
    source,
    /label: "Triangle"[\s\S]*?label: "Down triangle"[\s\S]*?label: "Rounded rectangle"/,
  );
  assert.match(
    css,
    /\.project-canvas-shape-source-icon--colored\s*\{[^}]*mask:\s*var\(--project-canvas-shape-source\)/s,
  );
  assert.match(
    css,
    /\.project-canvas-shape-library__custom-color\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-shape-source-icon\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;/s,
  );
  assert.match(
    readFileSync(
      new URL("./assets/figjam-square.svg", import.meta.url),
      "utf8",
    ),
    /viewBox="0 0 144 144"/,
  );
  assert.match(
    readFileSync(
      new URL("./assets/figjam-connector.svg", import.meta.url),
      "utf8",
    ),
    /viewBox="0 0 17 12"/,
  );
  assert.match(
    readFileSync(
      new URL("./assets/figjam-ellipse.svg", import.meta.url),
      "utf8",
    ),
    /viewBox="0 0 144 144"/,
  );
  assert.match(source, /label: "Rounded rectangle"/);
  assert.doesNotMatch(source, /canvasMoreShapeShortcuts/);
  assert.match(source, /customShape: "triangle"/);
  assert.match(source, /customShape: "down-triangle"/);
  assert.match(source, /customShape: "cylinder"/);
  assert.match(source, /customShape: "mind-map"/);
  assert.match(source, /function createCanvasCustomShapeElements/);
  assert.match(source, /customType: `astryx-shape:\$\{shape\.id\}`/);
  assert.match(
    source,
    /const hasDragBounds = Math\.abs\(deltaX\) > 8 \|\| Math\.abs\(deltaY\) > 8/,
  );
  assert.match(source, /width: Math\.abs\(deltaX\), height: Math\.abs\(deltaY\)/);
  assert.match(source, /className="project-canvas-shape-library__more"/);
  assert.match(source, /aria-label="More shapes"/);
  assert.match(source, /className="project-canvas-more-shapes"/);
  assert.match(source, /aria-label="Search shapes"/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-label=\{`Shape color, \$\{canvasShapeColors/);
  assert.match(source, /aria-label="Shape colors"/);
  assert.match(
    source,
    /setStickyPickerOpen\(false\);[\s\S]*setStickyPlacement\(undefined\);/,
  );
  assert.match(source, /className="project-canvas-shape-library"/);
  assert.match(source, /function CanvasShapeGlyph/);
  assert.match(
    source,
    /role="toolbar"[\s\S]*aria-label="Shapes and connectors"/,
  );
  assert.match(source, /className="project-playground__document-trigger"/);
  assert.match(source, /className="project-playground__stamp-trigger"/);
  assert.match(source, /className="project-playground__actions-trigger"/);
  assert.match(source, /className="project-playground__widgets-trigger"/);
  assert.match(
    source,
    /import figjamSectionToolIcon from "\.\.\/assets\/figjam-section-tool\.svg"/,
  );
  assert.match(source, /className="project-playground__section-trigger"/);
  assert.match(
    source,
    /className="project-playground__section-tool"[\s\S]*?className="project-playground__section-trigger"/,
  );
  assert.doesNotMatch(source, /project-playground__section-tool-divider/);
  assert.match(
    source,
    /aria-label="Section"[\s\S]*?aria-pressed=\{researchFrameDrawing\}[\s\S]*?onClick=\{drawResearchFrame\}/,
  );
  assert.match(
    source,
    /import figjamTableToolIcon from "\.\.\/assets\/figjam-table-tool\.svg"/,
  );
  assert.match(source, /className="project-playground__creation-tools"/);
  assert.match(
    source,
    /aria-label="Table"[\s\S]*?aria-pressed=\{tablePlacement\}[\s\S]*?onClick=\{toggleTableTool\}/,
  );
  assert.match(source, /function createCanvasTableElements\(/);
  assert.match(source, /customType: "astryx-table"/);
  assert.match(
    source,
    /const handleCanvasPlacementPointerUp = useCallback\([\s\S]*?tablePlacementRef\.current[\s\S]*?insertCanvasTableAt\([\s\S]*?stopTablePlacement\(\);/,
  );
  assert.match(
    source,
    /stampPlacementRef\.current[\s\S]*?insertCanvasStampAt\([\s\S]*?currentStamp/,
  );
  assert.match(source, /onPointerUpCapture=\{handleCanvasPlacementPointerUp\}/);
  assert.match(source, /rows = 2/);
  assert.match(source, /columns = 2/);
  assert.match(source, /const cellHeight = 54/);
  assert.match(source, /canvasTableReferenceForSelection/);
  assert.match(source, /canvasTableWithSelectedCells/);
  assert.match(source, /function canvasTableCellAtScenePoint\(/);
  assert.match(source, /canvasTableCellSelectionRef/);
  assert.match(
    source,
    /const handleCanvasToolPointerDownCapture = useCallback\([\s\S]*?const sceneX =[\s\S]*?const sceneY =[\s\S]*?canvasTableCellAtScenePoint\([\s\S]*?event\.detail <= 1[\s\S]*?event\.stopPropagation\(\)[\s\S]*?canvasTableCellSelectionRef\.current = \{[\s\S]*?setSelectedCanvasTable\(nextTable\)/,
  );
  assert.match(
    source,
    /const handleCanvasPlacementPointerUp = useCallback\([\s\S]*?canvasTableCellSelectionRef\.current[\s\S]*?event\.detail <= 1[\s\S]*?event\.stopPropagation\(\)[\s\S]*?selectedElementIds: \{\},[\s\S]*?selectedGroupIds: \{\}/,
  );
  assert.match(
    source,
    /savedCellSelection &&[\s\S]*?Object\.keys\(appState\.selectedElementIds\)\.length > 0[\s\S]*?window\.requestAnimationFrame\([\s\S]*?selectedElementIds: \{\},[\s\S]*?selectedGroupIds: \{\}/,
  );
  assert.match(
    source,
    /const selectCanvasTableCells = useCallback\([\s\S]*?canvasTableCellSelectionRef\.current = \{[\s\S]*?setSelectedCanvasTable\(nextTable\);[\s\S]*?selectedElementIds: \{\},[\s\S]*?selectedGroupIds: \{\},[\s\S]*?editingGroupId: null/,
  );
  assert.match(source, /className="project-canvas-table-controls"/);
  assert.match(
    source,
    /className="project-canvas-table-controls__cell-selections"/,
  );
  assert.match(
    source,
    /const canvasTableControlsStyle = useMemo\([\s\S]*?top: `\$\{\(selectedCanvasTable\.y \+ scrollY\) \* zoom\}px`/,
  );
  assert.match(source, /aria-label="Add column"/);
  assert.match(source, /aria-label="Add row"/);
  assert.match(
    source,
    /if \(nativeTool\) \{[\s\S]*?deactivateStickyTool\(\);[\s\S]*?deactivateTableTool\(\);[\s\S]*?deactivateStampTool\(\);/,
  );
  assert.match(
    source,
    /const drawResearchFrame = useCallback\([\s\S]*?deactivateStickyTool\(\);[\s\S]*?editor\.setActiveTool\(\{ type: "frame" \}\)/,
  );
  assert.match(
    source,
    /const toggleStickyNoteTool = useCallback\([\s\S]*?selectedElementIds: \{\},[\s\S]*?selectedGroupIds: \{\},[\s\S]*?editingGroupId: null,[\s\S]*?setSelectedCanvasTable\(undefined\);[\s\S]*?setSelectedCanvasText\(undefined\);[\s\S]*?setSelectedCanvasShape\(undefined\);[\s\S]*?setSelectedResearchFrame\(undefined\);/,
  );
  assert.match(
    source,
    /event\.shiftKey && event\.key\.toLowerCase\(\) === "s"[\s\S]*?drawResearchFrame\(\)/,
  );
  assert.match(
    source,
    /event\.key\.toLowerCase\(\) === "e"[\s\S]*?toggleStampTool\(\)/,
  );
  assert.match(
    css,
    /project-playground__section-trigger\[aria-pressed="true"\][\s\S]*?background:\s*#9747ff/s,
  );
  assert.match(
    css,
    /project-playground__section-trigger\[aria-pressed="true"\]\s+img[\s\S]*?filter:\s*invert\(1\)/s,
  );
  assert.match(
    css,
    /project-playground__canvas--frame-drawing[\s\S]*?selected-shape-actions[\s\S]*?display:\s*none !important/s,
  );
  assert.match(
    css,
    /\.project-canvas-table-controls__columns button::before[\s\S]*?background: #a0caf3/,
  );
  assert.match(
    css,
    /\.project-canvas-table-controls__cell-selections span[\s\S]*?border: 2px solid #0d99ff/,
  );
  assert.match(
    css,
    /\.project-canvas-table-controls__add-column,[\s\S]*?\.project-canvas-table-controls__add-row[\s\S]*?opacity: 0;[\s\S]*?transition: opacity 120ms ease/,
  );
  assert.match(
    css,
    /\.project-canvas-table-controls__add-column:hover,[\s\S]*?\.project-canvas-table-controls__add-row:focus-visible[\s\S]*?opacity: 1/,
  );
  assert.match(source, /className="project-canvas-tools-catalog"/);
  assert.match(source, /placeholder="Search"/);
  assert.match(source, /placeholder="Search for the missing piece"/);
  assert.match(
    source,
    /const canvasStampOptions:[\s\S]*?Thumbs up[\s\S]*?\+1[\s\S]*?Star[\s\S]*?Question[\s\S]*?Thumbs down[\s\S]*?Dot[\s\S]*?Profile[\s\S]*?Heart/,
  );
  assert.match(
    source,
    /import figjamStampWheel from .*figjam-stamp-wheel\.svg/,
  );
  assert.match(
    source,
    /className="project-canvas-stamp-menu__surface"[\s\S]*?src=\{figjamStampWheel\}/,
  );
  assert.match(
    source,
    /className="project-canvas-stamp-menu__emoji"[\s\S]*?figjamStampThumbsUp[\s\S]*?figjamStampStar[\s\S]*?figjamStampHeart/,
  );
  const emojiStampSource =
    /className="project-canvas-stamp-menu__emoji"[\s\S]*?<\/button>/.exec(
      source,
    )?.[0] ?? "";
  assert.match(
    emojiStampSource,
    /onClick=\{\(\) =>[\s\S]*?selectCanvasStamp\([\s\S]*?activeStampId/,
  );
  assert.doesNotMatch(emojiStampSource, /toggleWidgetsLauncher/);
  assert.doesNotMatch(source, /FaceHappyIcon/);
  assert.match(source, /className="project-canvas-stamp-preview"/);
  assert.match(source, /const canvasStampAssetCache = new Map/);
  assert.match(source, /async function cachedCanvasStampAsset/);
  assert.match(source, /const asset = await cachedCanvasStampAsset\(stamp\.asset\)/);
  assert.match(
    source,
    /stamp\.id === "profile"[\s\S]*?createCanvasProfileStampElements/,
  );
  assert.match(
    source,
    /className="project-canvas-stamp-menu__profile"[\s\S]*?canvasCollaboratorInitials\(userName\)/,
  );
  assert.match(
    css,
    /\.project-canvas-stamp-preview\s*\{[\s\S]*?width: 40px;[\s\S]*?pointer-events: none;/,
  );
  assert.match(
    css,
    /\.project-playground__canvas--stamp-placement[\s\S]*?toolbar-selection[\s\S]*?background: transparent !important/,
  );
  assert.match(
    css,
    /\.layer-ui__wrapper:has\(\.project-canvas-stamp-menu\)[\s\S]*?z-index: 700 !important/,
  );
  assert.match(
    commentsSource,
    /import figjamCommentToolIcon from .*figjam-comment-tool\.svg/,
  );
  assert.match(
    commentsSource,
    /just leave a note of appreciation\. Click anywhere in the file to leave a comment\./,
  );
  assert.match(
    css,
    /\.project-canvas-comment-inbox,[\s\S]*?\.project-canvas-comments--thread\s*\{[\s\S]*?width: min\(320px, calc\(100% - 40px\)\);/,
  );
  assert.match(
    commentsSource,
    /className="project-canvas-comments project-canvas-comments--composer"/,
  );
  assert.match(commentsSource, /aria-label="Add a comment"/);
  assert.match(
    css,
    /\.project-canvas-comments--composer\s*\{[\s\S]*?width: 300px;[\s\S]*?height: 44px;/,
  );
  assert.match(
    source,
    /const canvasWidgetsTabs:[\s\S]*?All[\s\S]*?Stickers[\s\S]*?Templates[\s\S]*?Widgets[\s\S]*?Plugins[\s\S]*?More/,
  );
  assert.match(source, /const canvasActionSections = \[/);
  assert.match(
    source,
    /title: "Suggestions"[\s\S]*?title: "Find and replace…"[\s\S]*?title: "Select all"[\s\S]*?title: "Undo"/,
  );
  assert.match(
    source,
    /title: "Common settings"[\s\S]*?title: "Minimize UI"[\s\S]*?title: "Show\/Hide UI"[\s\S]*?title: "Multiplayer cursors"[\s\S]*?title: "Keyboard shortcuts"[\s\S]*?title: "Account settings"/,
  );
  assert.match(source, /onClick: openCanvasFind/);
  assert.match(source, /onClick: selectAllCanvasElements/);
  assert.match(source, /onClick: undoCanvasAction/);
  assert.match(source, /onClick: openCanvasKeyboardShortcuts/);
  assert.match(source, /aria-label="Find and replace"/);
  assert.match(source, /onClick={replaceAllCanvasTextMatches}/);
  assert.match(source, /editor\.scrollToContent\(match,/);
  assert.match(source, /captureUpdate: CaptureUpdateAction\.IMMEDIATELY/);
  assert.match(source, /captureUpdate: CaptureUpdateAction\.NEVER/);
  assert.match(source, /activateCanvasTool\("sticky"\)/);
  assert.match(source, /activateCanvasTool\("document"\)/);
  assert.match(source, /activateCanvasTool\("more"\)/);
  assert.match(
    source,
    /aria-label=\{\s*stickyPickerOpen\s*\? "Close sticky notes"\s*: "Sticky notes"\s*\}/,
  );
  assert.match(source, /customType: "astryx-sticky-note"/);
  assert.match(source, /function stickyNotePlacementCursor\(/);
  assert.match(source, /mode === "stack"/);
  assert.match(source, /encodeURIComponent\(svg\)/);
  assert.match(
    source,
    /editor\?\.setCursor\(stickyNotePlacementCursor\(color, mode\)\)/,
  );
  assert.match(source, /--project-sticky-note-cursor/);
  assert.match(source, /project-playground__canvas--sticky-placement/);
  assert.match(
    source,
    /const stopStickyPlacement[\s\S]*setStickyPickerOpen\(false\)[\s\S]*editor\?\.resetCursor\(\)/,
  );
  assert.match(source, /setStickyPickerOpen\(keepPickerOpen\)/);
  assert.match(
    source,
    /const armStickyPlacement[\s\S]*closeCommentsPanel\(\);[\s\S]*setStickyPickerOpen\(keepPickerOpen\)/,
  );
  assert.match(
    source,
    /const armStickyPlacement[\s\S]*setShapePickerOpen\(false\);[\s\S]*setShapeLibraryOpen\(false\);[\s\S]*setMarkerDrawing\(false\);[\s\S]*setResearchFrameDrawing\(false\);[\s\S]*setDocumentPlacement\(false\);[\s\S]*customType: "astryx-sticky-note"/,
  );
  assert.match(
    source,
    /const \[stickyToolColor, setStickyToolColor\] = useState\(\s*defaultProjectStickyNoteColor,?\s*\)/,
  );
  assert.match(
    source,
    /const toggleStickyNoteTool[\s\S]*armStickyPlacement\(stickyToolColor, "single", true\)/,
  );
  assert.match(source, /setStickyToolColor\(color\)/);
  assert.match(
    source,
    /<ProjectCanvasToolGlyph\s+tool="sticky"\s+stickyColor=\{stickyToolColor\}\s*\/>/,
  );
  assert.match(source, /className="project-sticky-note-placement-status"/);
  assert.match(
    source,
    /event\.key\.toLowerCase\(\) === "n"[\s\S]*toggleStickyNoteTool\(\)/,
  );
  assert.match(source, /customType: "astryx-document"/);
  assert.match(
    source,
    /const documentPlacementRef = useRef\(false\)/,
  );
  assert.match(
    source,
    /const handleCanvasPlacementPointerUp[\s\S]*documentPlacementRef\.current[\s\S]*window\.requestAnimationFrame\(\(\) => \{[\s\S]*insertCanvasDocumentAt\(placement\.x, placement\.y\);[\s\S]*stopDocumentPlacement\(\);/,
  );
  assert.match(source, /const canvasDocumentViewportTopSafeArea = 124/);
  assert.match(
    source,
    /const viewportTop = -appState\.scrollY \+ appState\.offsetTop \/ zoom/,
  );
  assert.match(
    source,
    /const minimumCenterY =\s*viewportTop[\s\S]*canvasDocumentViewportTopSafeArea \/ zoom[\s\S]*canvasDocumentHeight \/ 2/,
  );
  assert.match(
    source,
    /const maximumCenterX =\s*viewportLeft[\s\S]*viewportWidth[\s\S]*canvasDocumentViewportSideSafeArea \/ zoom[\s\S]*canvasDocumentWidth \/ 2/,
  );
  assert.match(
    source,
    /const documentCenterX =\s*maximumCenterX >= minimumCenterX[\s\S]*Math\.min\(Math\.max\(x, minimumCenterX\), maximumCenterX\)[\s\S]*viewportLeft \+ viewportWidth \/ 2/,
  );
  assert.match(source, /x: documentCenterX/);
  assert.match(source, /y: Math\.max\(y, minimumCenterY\)/);
  assert.match(
    source,
    /selectedElementIds: container \? \{ \[container\.id\]: true \} : \{\},[\s\S]*scrollX: appState\.scrollX,[\s\S]*scrollY: appState\.scrollY/,
  );
  assert.doesNotMatch(
    source,
    /activeTool\.customType === "astryx-document"[\s\S]{0,120}documentPlacement/,
  );
  assert.match(source, /editor\.setActiveTool\(\{ type: "frame" \}\)/);
  assert.match(source, /kind: "research-frame"/);
  assert.match(source, /frameType: preset\.id/);
  assert.match(
    source,
    /editor\.scrollToContent\(frame, \{ animate: true, fitToViewport: true \}\)/,
  );
  assert.match(source, /const handleCanvasPointerUp = useCallback/);
  assert.match(source, /onPointerUp=\{handleCanvasPointerUp\}/);
  assert.doesNotMatch(source, /onPointerDown=\{handleCanvasPointerDown\}/);
  assert.match(source, /kind: "sticky-note"/);
  assert.match(source, /format = defaultProjectStickyNoteFormat/);
  assert.match(
    source,
    /fontFamily: projectStickyNoteFontFamilies\[format\.font\]/,
  );
  assert.match(source, /fontSize: format\.fontSize/);
  assert.match(source, /textAlign: format\.textAlign/);
  assert.match(source, /link: format\.link \|\| null/);
  assert.match(source, /locked: format\.locked/);
  /* The formatting toolbar is mounted now — see the sticky-selection test. */
  assert.match(source, /<ProjectObjectToolbar/);
  assert.match(source, /selectedStickyNote/);
  assert.match(source, /updateSelectedStickyNote/);
  assert.match(source, /kind: "document"/);
  assert.match(source, /kind: "app"/);
  assert.match(source, /kind: "flow"/);
  assert.match(source, /stickyPlacement\.mode === "stack"/);
  assert.match(source, /className="project-sticky-note-composer"/);
  assert.match(source, /className="project-sticky-note-composer__surface"/);
  assert.match(source, /"--sticky-theme-filter": "none"/);
  assert.match(
    source,
    /fill: element\.backgroundColor \|\| paletteColor\.fill/,
  );
  assert.match(
    source,
    /stroke: element\.strokeColor \|\| paletteColor\.stroke/,
  );
  assert.match(source, /autoFocus/);
  assert.match(source, /contentEditable/);
  assert.match(source, /role="textbox"/);
  assert.match(source, /aria-multiline="true"/);
  assert.match(source, /stickyInputRef\.current/);
  assert.match(source, /input\.focus\(\)/);
  assert.match(source, /window\.getSelection\(\)/);
  assert.match(
    source,
    /commitStickyDraft\(event\.currentTarget\.textContent \?\? ""\)/,
  );
  assert.match(
    source,
    /const text = value\.trim\(\);[\s\S]*insertStickyNotesAt\([\s\S]*\[text\]/,
  );
  assert.doesNotMatch(
    source,
    /const text = value\.trim\(\);[\s\S]{0,240}if \(!text\)/,
  );
  assert.match(source, /aria-placeholder="Type anything, @mention anyone"/);
  assert.match(source, /event\.key === "Escape"[\s\S]*cancelStickyDraft\(\)/);
  assert.match(
    source,
    /window\.addEventListener\("keydown", handleStickyShortcut, true\)/,
  );
  assert.match(source, /const canvasTextEditingRef = useRef\(false\)/);
  assert.match(
    source,
    /const \[canvasTextEditing, setCanvasTextEditing\] = useState\(false\)/,
  );
  assert.match(source, /canvasTextEditingRef\.current = nextCanvasTextEditing/);
  assert.match(
    source,
    /setCanvasTextEditing\(\(current\) =>\s*current === nextCanvasTextEditing \? current : nextCanvasTextEditing,?\s*\)/,
  );
  assert.match(source, /canvasTextEditingRef\.current\s*\|\|/);
  assert.match(
    source,
    /handleKeyboardGlobally=\{\s*!stickyDraft\s*&&\s*!canvasTextEditing\s*&&\s*!commentDraftAnchor\s*&&\s*!selectedComment\s*\}/,
  );
  assert.match(source, /tool="comments"/);
  assert.match(source, /customType: "astryx-comment"/);
  assert.match(
    source,
    /const \[commentsPanelOpen, setCommentsPanelOpen\] = useState\(false\)/,
  );
  assert.match(source, /const closeCommentsPanel = useCallback/);
  assert.match(source, /<ProjectCanvasCommentPin/);
  assert.match(source, /<ProjectCanvasCommentInbox/);
  assert.match(
    source,
    /commentsPanelOpen && !selectedComment/,
  );
  assert.match(source, /onSelectThread=\{\(threadId\) =>/);
  assert.match(source, /onClose=\{closeCommentsPanel\}/);
  assert.match(source, /<ProjectCanvasCommentPanel/);
  assert.match(source, /onBack=\{/);
  assert.match(source, /const deleteSelectedComment = useCallback/);
  assert.match(
    source,
    /canvasCommentsRef\.current\.filter\(\s*\(thread\) => thread\.id !== selectedCommentId,?\s*\)/,
  );
  assert.match(source, /onDelete=\{deleteSelectedComment\}/);
  assert.match(source, /comments: readonly DesignerCanvasCommentThread\[\]/);
  assert.match(source, /normalizeDesignerCanvasComments/);
  assert.match(
    source,
    /onKeyDown=\{\(event\) => \{\s*event\.stopPropagation\(\)/,
  );
  assert.match(source, /className="project-sticky-note-placement-status"/);
  assert.match(
    source,
    /window\.setTimeout\(\(\) => \{[\s\S]*selectedElementIds: \{ \[selectedElementId\]: true \}/,
  );
  assert.match(
    source,
    /querySelector<HTMLElement>\("\.excalidraw__canvas"\)[\s\S]*focus\(\{ preventScroll: true \}\)/,
  );
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
  assert.match(
    source,
    /const \[saveErrorMessage, setSaveErrorMessage\] = useState\(""\)/,
  );
  assert.match(
    source,
    /`\$\{saveLabels\[saveState\]\}: \$\{saveErrorMessage\}`/,
  );
  assert.match(source, /<CanvasShapesCollageGlyph color=\{shapeColor\} \/>/);
  assert.match(source, /searchParams\.set\("inline", "1"\)/);
  /* Screen bytes still come through the media proxy — the fetch just moved
     into the shared card-image loader. */
  assert.match(source, /apiFetch\(canvasMediaFetchUrl\(url\)/);
  assert.match(source, /loadCatalogCardImage\(screen\.url, projectId\)/);
  assert.match(source, /astryxReference:\s*\{[\s\S]*kind: "screen"/);
  assert.doesNotMatch(
    source,
    /link: `\/apps\/\$\{encodeURIComponent\(app\.id\)\}/,
  );
  assert.match(source, /screenReferenceForElement/);
  assert.match(source, /selectedScreenReference/);
  assert.match(source, /project-playground__canvas--screen-selected/);
  assert.match(source, /className="project-screen-inspector"/);
  assert.match(source, /label="Open screen details"/);
  assert.match(
    source,
    /label=\{\s*selectedDataReference\.kind === "app"\s*\? "Open app details"\s*: "Open flow details"\s*\}/,
  );
  assert.match(
    source,
    /lastDataCard\.x \+ lastDataCard\.width \+ 40 \+ cardWidth \/ 2/,
  );
  assert.match(
    source,
    /evidence: `SCREEN-\$\{selectedScreenReference\.screenId\}`/,
  );
  assert.match(source, /Added \$\{template\.title\} to the canvas/);
  assert.match(source, /className="project-canvas-header"/);
  assert.match(source, /data-canvas-toolbar-region="top-left"/);
  assert.match(source, /data-canvas-toolbar-region="top-right"/);
  assert.match(source, /data-canvas-toolbar-region="bottom"/);
  assert.match(source, /className=\{`project-playground__canvas\$\{/);
  assert.doesNotMatch(source, /project-playground__canvas--native-ui/);
  assert.doesNotMatch(source, /project-playground__mobile-viewport-controls/);
  assert.doesNotMatch(source, /mobileHelpOpen/);
  assert.doesNotMatch(source, /adjustCanvasZoom/);
  assert.match(source, /<ProjectAccessButton[\s\S]*?emphasized/);
  assert.doesNotMatch(
    source,
    /project-canvas-header__project-files|Open project files/,
  );
  assert.doesNotMatch(source, /project-canvas-header__collaboration-status/);
  assert.match(source, /onClick=\{syncCanvasCollaborators\}/);
  assert.doesNotMatch(source, /Canvas pages and menu/);
  assert.match(
    source,
    /const \[canvasPagesOpen, setCanvasPagesOpen\] = useState\(false\)/,
  );
  assert.match(source, /aria-label="Canvas pages"/);
  assert.match(source, /role="menuitem"[\s\S]*Project home/);
  assert.match(source, /navigate\(\{ name: "project", projectId \}\)/);
  assert.doesNotMatch(source, /project-canvas-header__group--right/);
  assert.match(source, /theme=\{canvasTheme\}/);
  assert.doesNotMatch(source, /useResolvedThemeMode/);
  assert.match(source, /viewBackgroundColor: canvasSceneBackground/);
  assert.match(source, /const canvasSceneBackground = "#f7f8fa"/);
  assert.match(source, /const canvasTheme: "light" = "light"/);
  assert.match(source, /updateScene\(\{[\s\S]*theme: canvasTheme/);
  assert.match(source, /gridModeEnabled/);
  assert.match(source, /<Excalidraw/);
  assert.match(source, /excalidrawAPI=/);
  assert.match(source, /onChange=\{handleCanvasChange\}/);
  assert.doesNotMatch(
    source,
    /ProjectWorkspaceNav|SegmentedControl|Overview|BlockSuite|OctoBase|tldraw/i,
  );
});

test("gives the infinite canvas the full available viewport", () => {
  const css = readCss("./styles.css");

  assert.match(
    css,
    /\.research-project-page--playground\s*\{[^}]*height:\s*100dvh;[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header\s*\{[^}]*position:\s*absolute;[^}]*top:\s*12px;[^}]*justify-content:\s*space-between;[^}]*pointer-events:\s*none;/s,
  );
  assert.match(
    css,
    /\.project-playground\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1;[^}]*overflow:\s*clip;/s,
  );
  assert.match(
    css,
    /\.project-playground--canvas-first\s*\{[^}]*margin:\s*0;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas\s*\{[^}]*position:\s*relative;[^}]*height:\s*100%;/s,
  );
  assert.match(
    css,
    /\.project-playground__unavailable\s*\{[^}]*position:\s*absolute;[^}]*backdrop-filter:\s*blur\(12px\)/s,
  );
  assert.match(
    css,
    /\.project-playground__references\s*\{[^}]*position:\s*absolute;[^}]*z-index:/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw\s*\{[^}]*--color-primary:[^}]*background:\s*var\(--project-canvas-bg, #f7f8fa\)/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.App-menu_top\s*\{[^}]*display:\s*block;[^}]*transform:\s*none;/s,
  );
  /* Native and Vitrines tools share one horizontal, centered toolbelt. */
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.App-toolbar > \.Stack_horizontal\s*\{[^}]*max-width:\s*min\(760px,[^}]*flex-direction:\s*row;/s,
  );
  assert.match(
    css,
    /\.project-playground__astryx-tools\s*\{[^}]*width:\s*auto;[^}]*flex-direction:\s*row;/s,
  );
  assert.match(
    css,
    /\.project-playground__screens-trigger,[\s\S]*?\.project-playground__widgets-trigger,[\s\S]*?\.project-playground__more-tools-trigger\s*\{[^}]*width:\s*var\(--project-canvas-tool-size[^}]*height:\s*var\(--project-canvas-tool-size/s,
  );
  assert.match(css, /\.project-playground__section-tool\s*\{[^}]*order:\s*1;/s);
  assert.match(
    css,
    /\.project-playground__creation-tools\s*\{[^}]*order:\s*2;/s,
  );
  assert.match(css, /toolbar-image"\]\)\s*\{[^}]*order:\s*6;/s);
  assert.match(
    css,
    /\.project-playground__section-trigger\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-tools-catalog\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*calc\(var\(--project-canvas-toolbelt-bottom, 64px\) \+ 60px\);[^}]*left:\s*50%;[^}]*width:\s*min\(588px,/s,
  );
  // \s+ between the compounds, not a literal space: the formatter wraps long
  // selectors across lines, which is not a change to what they select.
  assert.match(
    css,
    /\.project-playground__canvas--tool-panel-open\s+\.excalidraw\s+\.selected-shape-actions\s*\{[^}]*display:\s*none !important;/s,
  );
  assert.match(
    css,
    /\.project-research-frames\s*\{[^}]*position:\s*absolute;[^}]*top:\s*136px;[^}]*left:\s*64px;[^}]*width:\s*min\(372px,/s,
  );
  assert.match(
    css,
    /\.project-research-frames__presets\s*\{[^}]*display:\s*grid;/s,
  );
  assert.match(
    css,
    /\.project-research-frames__navigation-actions\s*\{[^}]*display:\s*flex;/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-picker\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*calc\(var\(--project-canvas-toolbelt-bottom, 64px\) \+ 60px\);[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-picker__swatch::before\s*\{[^}]*border-radius:\s*999px;[^}]*background:\s*var\(--sticky-fill\)/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-picker__swatch\[aria-checked="true"\]\s*\{[^}]*box-shadow:\s*0 0 0 2px #fff,[^}]*0 0 0 4px var\(--color-primary, #4262ff\);/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-placement-status\s*\{[^}]*position:\s*absolute;[^}]*clip:\s*rect\(0 0 0 0\);/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas--sticky-placement \.excalidraw__canvas\.interactive\s*\{[^}]*cursor:\s*var\(--project-sticky-note-cursor\) !important;/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-composer\s*\{[^}]*position:\s*absolute;[^}]*width:\s*240px;[^}]*height:\s*240px;/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-composer__surface\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*filter:\s*var\(--sticky-theme-filter, none\);/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-composer \[role="textbox"\]\s*\{[^}]*position:\s*absolute;[^}]*top:\s*0;/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-composer \[role="textbox"\]\s*\{[^}]*padding:\s*var\(--sticky-padding-top, 5px\) var\(--sticky-padding-horizontal, 5px\) 42px;/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-composer \[role="textbox"\]\s*\{[^}]*height:\s*100%;[^}]*max-height:\s*none;[^}]*overflow:\s*auto;/s,
  );
  assert.match(
    css,
    /\.project-sticky-note-composer \[role="textbox"\]\s*\{[^}]*cursor:\s*text;[^}]*text-align:\s*left;/s,
  );
  assert.doesNotMatch(
    css,
    /\.project-sticky-note-composer \[role="textbox"\]\s*\{[^}]*display:\s*flex;/s,
  );
  assert.match(
    css,
    /\.project-canvas-document-editor\s*\{[^}]*position:\s*absolute;[^}]*width:\s*760px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-document-editor--preview\s*\{[^}]*pointer-events:\s*none;[^}]*box-shadow:\s*none;/s,
  );
  assert.match(
    css,
    /\.project-screen-library\s*\{[^}]*position:\s*absolute;[^}]*top:\s*76px;[^}]*bottom:\s*128px;[^}]*left:\s*64px;[^}]*width:\s*min\(640px,/s,
  );
  assert.match(
    css,
    /\.project-screen-library__grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s,
  );
  assert.match(
    css,
    /\.project-screen-library__grid--inspiration\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s,
  );
  assert.match(
    css,
    /\.project-screen-library \.astryx-segmented-control\s*\{[^}]*background:\s*transparent !important;[^}]*border-color:\s*transparent !important;/s,
  );
  assert.match(
    css,
    /\.project-screen-library \.astryx-segmented-control::before\s*\{[^}]*background:\s*var\(--project-canvas-muted-surface,[^)]*\) !important;[^}]*border-radius:\s*6px;/s,
  );
  assert.match(
    css,
    /\.project-screen-library[\s\S]*?\.astryx-segmented-control-item\[aria-checked="false"\][\s\S]*?color:\s*var\(--project-canvas-muted-text,[^)]*\) !important;/,
  );
  assert.match(
    css,
    /\.project-screen-library__preview\s*\{[^}]*position:\s*relative;[^}]*height:\s*122px;/s,
  );
  assert.doesNotMatch(css, /\.project-canvas-data-library/);
  assert.match(
    css,
    /\.project-playground__canvas--screen-selected\s+\.excalidraw\s+\.excalidraw-hyperlinkContainer,[\s\S]*?\.selected-shape-actions\s*\{[^}]*display:\s*none !important;/s,
  );
  assert.match(
    css,
    /\.project-screen-inspector\s*\{[^}]*position:\s*absolute;[^}]*right:\s*16px;[^}]*width:\s*280px;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.zoom-actions\s*\{[^}]*position:\s*fixed;[^}]*right:\s*52px;[^}]*bottom:\s*var\(--project-canvas-toolbelt-bottom, 64px\);[^}]*width:\s*65px;[^}]*height:\s*32px;[^}]*border-radius:\s*17px;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.layer-ui__wrapper__footer-right\s*\{[^}]*right:\s*12px;[^}]*bottom:\s*var\(--project-canvas-toolbelt-bottom, 64px\);[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*50%;/s,
  );
  assert.match(
    css,
    /\.zoom-actions > \.Stack_horizontal\s*\{[^}]*grid-template-columns:\s*repeat\(2, 32px\);/s,
  );
  assert.match(
    css,
    /\.zoom-actions \.zoom-button:hover:not\([\s\S]*?\)\s*\{[^}]*background:\s*#f5f5f5 !important;/s,
  );
  assert.match(
    css,
    /\.zoom-actions \.zoom-button:active:not\([\s\S]*?\)\s*\{[^}]*color:\s*#fff !important;[^}]*background:\s*#9747ff !important;/s,
  );
  assert.match(
    css,
    /\.zoom-button:focus-visible\s*\{[^}]*outline:\s*2px solid #9747ff !important;/s,
  );
  assert.match(
    css,
    /\.layer-ui__wrapper__footer-right[\s\S]*?\.help-icon:focus-visible,[\s\S]*?\.help-icon:focus\s*\{[^}]*border:\s*1px solid #9747ff !important;[^}]*outline:\s*1px solid #9747ff;/s,
  );
  assert.match(
    css,
    /\.zoom-actions \.reset-zoom-button\s*\{[^}]*display:\s*none !important;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.undo-redo-buttons\s*\{[^}]*display:\s*none !important;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.App-menu_top__left\s*\{[^}]*position:\s*fixed;[^}]*width:\s*0;[^}]*height:\s*0;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.App-menu_top__left \.main-menu-trigger\s*\{[^}]*display:\s*none;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.App-menu_top__left \.App-menu__left\s*\{[^}]*top:\s*72px !important;[^}]*left:\s*12px !important;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.selected-shape-actions > \.App-menu__left\s*\{[^}]*position:\s*fixed !important;[^}]*top:\s*104px !important;[^}]*left:\s*72px !important;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.App-menu_top__left \.dropdown-menu\s*\{[^}]*top:\s*var\(--project-menu-top, 72px\) !important;[^}]*right:\s*var\(--project-menu-right, 12px\) !important;[^}]*left:\s*auto !important;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.App-toolbar__extra-tools-dropdown\s*\{[^}]*bottom:\s*calc\(var\(--project-canvas-toolbelt-bottom[^}]*left:\s*50%[^}]*transform:\s*translateX\(-50%\)/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas\s+\.excalidraw\s+\.layer-ui__wrapper__footer-right\s+\.help-icon\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*50%;/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.layer-ui__wrapper__top-right\s*\{[^}]*display:\s*none;/s,
  );
  assert.match(
    css,
    /\.project-template-library\s*\{[^}]*grid-template-columns:\s*276px minmax\(0, 1fr\);[^}]*border-radius:\s*16px;/s,
  );
  assert.match(
    css,
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.project-canvas-header__group--left\s*\{[^}]*max-width:\s*calc\(100% - 80px\);/s,
  );
  assert.doesNotMatch(css, /project-sticky-note-placement-hint/);
  assert.match(
    css,
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.project-playground__canvas \.excalidraw--mobile \.App-bottom-bar\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*8px;[^}]*width:\s*96px;/s,
  );
});

test("matches the compact Miro-style board header proportions", () => {
  const css = readCss("./styles.css");
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  // `0?\.5px`: the formatter writes the leading zero, which is the same length.
  assert.match(
    css,
    /\.project-canvas-header__group\s*\{[^}]*height:\s*48px;[^}]*gap:\s*4px;[^}]*pointer-events:\s*all;[^}]*border:\s*0?\.5px solid[^}]*border-radius:\s*8px;[^}]*box-shadow:\s*0 2px 4px rgb\(34 36 40 \/ 8%\);/s,
  );
  assert.match(
    css,
    /\.project-canvas-collaborators\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s,
  );
  assert.match(
    css,
    /\.project-canvas-collaborators__avatars > span\s*\{[^}]*border-radius:\s*50%;/s,
  );
  assert.match(source, /aria-label="Projects home"/);
  assert.match(
    source,
    /className="project-canvas-header__brand-mark"\s*src="\/favicon\.svg"/,
  );
  assert.match(source, /className="project-canvas-header__workspace-button"/);
  assert.doesNotMatch(
    source,
    /project-canvas-header__workspace-button[\s\S]{0,280}<Icon icon="chevronDown"/,
  );
  assert.match(
    source,
    /className="project-canvas-header__file-kind"[^>]*>\s*Canvas\s*<\/span>/,
  );
  assert.match(
    css,
    /\.project-canvas-header__group--left\s*\{[^}]*height:\s*48px;[^}]*background:\s*rgb\(255 255 255 \/ 98%\);[^}]*border-radius:\s*14px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__page-menu\s*\{[^}]*position:\s*absolute;[^}]*top:\s*56px;[^}]*width:\s*220px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__workspace-button\s*\{[^}]*width:\s*52px;[^}]*height:\s*48px;[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*flex:\s*0 0 52px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__group--left \.project-canvas-header__brand-mark\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;[^}]*border-radius:\s*7px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__menu button\s*\{[^}]*width:\s*48px;[^}]*height:\s*48px;[^}]*border-radius:\s*0;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__identity-title\s*\{[^}]*display:\s*flex;[^}]*gap:\s*8px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__identity\s*\{[^}]*height:\s*48px;[^}]*width:\s*auto;[^}]*max-width:\s*200px;[^}]*flex:\s*0 1 auto;[^}]*display:\s*flex;[^}]*align-items:\s*center;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__identity > span:first-child\s*\{[^}]*display:\s*none;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__identity h1\s*\{[^}]*font-size:\s*14px;[^}]*font-weight:\s*600;[^}]*line-height:\s*20px;/s,
  );
  assert.match(
    css,
    /\.project-playground__identity-status\[data-state="saved"\]\s*\{[^}]*color:\s*#fff;[^}]*background:\s*#18a957;/s,
  );
  assert.match(
    css,
    /\.project-canvas-header__actions\s*\{[^}]*height:\s*48px;[^}]*padding:\s*0 6px 0 0;[^}]*background:\s*rgb\(255 255 255 \/ 98%\);[^}]*border-radius:\s*14px;/s,
  );
  assert.match(
    css,
    /\.project-canvas-collaborators__avatars > span\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;/s,
  );
  assert.doesNotMatch(css, /project-canvas-header__project-files/);
  assert.doesNotMatch(css, /project-canvas-header__collaboration-status/);
  assert.match(
    css,
    /\.project-canvas-header__actions \.astryx-button\.primary\s*\{[^}]*width:\s*72px;[^}]*min-width:\s*72px;[^}]*height:\s*36px;[^}]*background:\s*#9747ff !important;/s,
  );
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
  assert.match(
    source,
    /isSourceEditing \? "Preview Markdown" : "Edit Markdown"/,
  );
  assert.match(source, /const isEditing = isSelected && isSourceEditing/);
  assert.match(source, /project-canvas-document-editor--selected/);
  assert.match(
    source,
    /aria-label=\{isEditing \? "Canvas document editor" : "Canvas document preview"\}/,
  );
  assert.match(source, /inert=\{isSelected \? undefined : true\}/);
  assert.match(
    source,
    /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/,
  );
  assert.match(
    source,
    /label=\{draft\.expanded \? "Collapse document" : "Expand document"\}/,
  );
  assert.match(source, /label="Done"/);
});

test("offers a FigJam-style sticky note color palette", () => {
  const source = readFileSync(
    new URL("./components/ProjectStickyNotePicker.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /export const projectStickyNoteColors/);
  assert.equal((source.match(/fill:\s*"#[0-9a-f]{6}"/gi) ?? []).length, 10);
  // These are the actual FigJam Sticky color values, not an approximation.
  assert.match(source, /fill: "#ffe299", stroke: "#ffe299"/);
  assert.match(source, /fill: "#b3efbd", stroke: "#b3efbd"/);
  assert.match(source, /fill: "#d3bdff", stroke: "#d3bdff"/);
  assert.match(
    source,
    /export const defaultProjectStickyNoteColor = projectStickyNoteColors\[4\]/,
  );
  assert.match(source, /role="toolbar" aria-label="Sticky options"/);
  assert.match(source, /role="radiogroup" aria-label="Sticky color"/);
  assert.match(source, /role="radio"/);
  assert.match(source, /aria-checked=\{selectedColor\.id === color\.id\}/);
  assert.doesNotMatch(source, /Place a stack|onCreateStack|Choose a color/);
});

test("offers native research frames for organizing and navigating designer work", () => {
  const source = readFileSync(
    new URL("./components/ProjectResearchFramePicker.tsx", import.meta.url),
    "utf8",
  );
  const playgroundSource = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

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
  assert.match(playgroundSource, /const defaultSectionSize = 420/);
  assert.match(playgroundSource, /const finalizeResearchFrame = useCallback/);
  assert.match(playgroundSource, /const title = `Section \$\{sectionNumber\}`/);
  assert.match(playgroundSource, /createSectionBackdrop\(normalizedFrame\)/);
  assert.match(playgroundSource, /groupIds: \[frame\.id\]/);
  assert.match(playgroundSource, /className="project-section-object-toolbar"/);
  assert.match(playgroundSource, /aria-label="Rename section"/);
  assert.match(playgroundSource, /aria-label="Section templates"/);
  assert.match(playgroundSource, /hasOrphanSectionBackdrop/);
  assert.match(playgroundSource, /const deleteSelectedSection =/);
  assert.match(
    css,
    /project-playground__canvas--frame-selected[\s\S]*?selected-shape-actions[\s\S]*?display:\s*none !important/s,
  );
  assert.match(css, /\.project-section-object-toolbar__panel\s*\{/);
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
  assert.match(playgroundSource, /<ProjectObjectToolbar/);
  assert.match(
    playgroundSource,
    /onColorChange=\{\(color\) => updateSelectedStickyNote\(\{ color \}\)\}/,
  );
  assert.match(
    playgroundSource,
    /onFormatChange=\{\(format\) => updateSelectedStickyNote\(\{ format \}\)\}/,
  );
  assert.match(playgroundSource, /onCollaborationChange=/);
  // Read-only boards get the metadata, not the controls.
  assert.match(
    playgroundSource,
    /selectedStickyNote && !selectedCanvasTable && !canvasReadOnly/,
  );
  // Colour lives on the container, ink and type on the bound text element.
  assert.match(
    playgroundSource,
    /element\.id === note\.elementId[\s\S]{0,400}backgroundColor: color\.fill/,
  );
  assert.match(
    playgroundSource,
    /note\.textElementId && element\.id === note\.textElementId[\s\S]{0,700}strokeColor: color\.text/,
  );

  /*
   * Clicking into a note's text selects the bound text element, not the
   * rectangle: it is not type "rectangle" and carries no astryxReference, so
   * matching containers alone dropped the note and handed the panel back to
   * Excalidraw's generic shape actions in the middle of editing.
   */
  assert.match(
    playgroundSource,
    /const containerId = \(element as \{ containerId\?: string \| null \}\)\s*\.containerId;/,
  );
  assert.match(
    playgroundSource,
    /const container = elements\.find\(\s*\(candidate\) => candidate\.id === containerId,?\s*\);/,
  );
  // Container plus its text is still one note, not two.
  assert.match(playgroundSource, /uniqueSelectedStickyNotes/);
  assert.match(
    playgroundSource,
    /collaboration = defaultProjectStickyNoteCollaboration\(\)/,
  );
  assert.match(
    playgroundSource,
    /collaboration:\s*normalizeProjectStickyNoteCollaboration\(\s*reference\.collaboration,?\s*\)/,
  );
  assert.match(playgroundSource, /<ProjectStickyNoteMetadata/);
  assert.match(playgroundSource, /astryxReference:[\s\S]*collaboration/);

  /* Text shares this shell without inheriting sticky-note collaboration. */
  assert.match(
    playgroundSource,
    /selectedCanvasText &&[\s\S]*?!selectedCanvasTable &&[\s\S]*?!selectedStickyNote &&[\s\S]*?!canvasReadOnly/,
  );
  assert.match(playgroundSource, /colorOptions=\{canvasTextColors\}/);
  assert.match(playgroundSource, /objectLabel="Sticky note"/);
  assert.match(playgroundSource, /colorAriaLabel="Change color"/);
  assert.match(playgroundSource, /objectLabel="Text"/);
  assert.match(
    playgroundSource,
    /objectLabel="Text"[\s\S]*?showTextStyling/,
  );
  assert.match(playgroundSource, /project-canvas-text-rich-text/);

  const toolbarSource = readFileSync(
    new URL("./components/ProjectStickyNoteToolbar.tsx", import.meta.url),
    "utf8",
  );
  const css = readCss("./styles.css");

  // Match FigJam's selected sticky toolbar, including its exact group order.
  assert.match(toolbarSource, /ariaLabel = "Selection Properties Menu"/);
  const controlOrder = [
    "project-object-toolbar__color-control",
    "ariaLabel={`Typeface, ${typefaceLabel}`}",
    "ariaLabel={`Font size, ${sizeLabel.toLowerCase()}`}",
    'aria-label="Bold"',
    'aria-label="Strikethrough"',
    'aria-label={format.link ? "Edit link" : "Create link"}',
    'aria-label="Bulleted list"',
    'aria-label="Show/hide author"',
  ].map((needle) => toolbarSource.indexOf(needle));
  assert.ok(controlOrder.every((index) => index >= 0));
  assert.deepEqual(
    controlOrder,
    [...controlOrder].sort((a, b) => a - b),
  );
  assert.doesNotMatch(toolbarSource, /More sticky note options/);
  assert.match(toolbarSource, /aria-pressed=\{format\.bold\}/);
  assert.match(toolbarSource, /aria-pressed=\{format\.strikethrough\}/);
  assert.match(toolbarSource, /aria-pressed=\{format\.bulletedList\}/);
  assert.match(toolbarSource, /projectObjectFontSizeLabel/);
  assert.match(toolbarSource, /fontSize: 16/);
  assert.match(toolbarSource, /textAlign: "left"/);
  assert.match(
    css,
    /\.project-object-toolbar\s*\{[\s\S]*height:\s*40px;[\s\S]*border-radius:\s*13px;[\s\S]*background:\s*#1e1e1e;/,
  );
  assert.match(
    css,
    /\.project-object-toolbar__color-trigger\s*\{[\s\S]*width:\s*54px;/,
  );
  assert.match(
    css,
    /\.project-object-toolbar__typeface-trigger\s*\{[\s\S]*width:\s*56px/,
  );
  assert.match(
    css,
    /\.project-object-toolbar__size-trigger\s*\{[\s\S]*width:\s*144px/,
  );
  assert.match(
    css,
    /\.project-object-toolbar__action\s*\{[\s\S]*width:\s*32px/,
  );
  assert.match(playgroundSource, /canvasTextWithBulletedList/);
  assert.match(playgroundSource, /astryxTextFormat: format/);
  assert.match(playgroundSource, /showTextAlignment=\{false\}/);
  assert.match(playgroundSource, /verticalAlign: "top"/);
  assert.match(playgroundSource, /textAlign: "left"/);
  assert.match(
    playgroundSource,
    /stickyPlacementRef\.current = \{ color, mode \}/,
  );
  assert.match(
    playgroundSource,
    /stopStickyPlacement\(\);\s*setStickyDraft\(draft\);/,
  );
});

test("deactivates Sticky Notes when another canvas tool becomes active", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  const css = readCss("./styles.css");

  assert.match(source, /const deactivateStickyTool = useCallback/);
  assert.match(source, /stickyPlacementRef\.current = undefined;/);
  assert.match(source, /setStickyPickerOpen\(false\);/);
  assert.match(source, /setStickyPlacement\(undefined\);/);
  assert.match(
    source,
    /stickyToolIsActive[\s\S]*appState\.activeTool\.customType === "astryx-sticky-note"[\s\S]*if \(!stickyToolIsActive && !stickyPlacementRef\.current\) \{[\s\S]*deactivateStickyTool\(\);/,
  );
  assert.match(
    source,
    /handleCanvasToolPointerDownCapture[\s\S]*deactivateStickyTool\(\);[\s\S]*setStickyDraft\(undefined\);[\s\S]*setShapePickerOpen\(false\);[\s\S]*setShapeLibraryOpen\(false\);[\s\S]*setShapeColorPickerOpen\(false\);[\s\S]*setShapePlacement\(undefined\);[\s\S]*setMarkerDrawing\(false\);[\s\S]*setResearchFrameDrawing\(false\);[\s\S]*documentPlacementRef\.current = false;[\s\S]*setDocumentPlacement\(false\);[\s\S]*setCommentPlacement\(false\);[\s\S]*setToolsCatalogOpen\(false\);[\s\S]*setWidgetsLauncherOpen\(false\);/,
  );
  assert.match(
    source,
    /const selectMarkerMode = useCallback[\s\S]*?deactivateStickyTool\(\);/,
  );
  assert.match(
    source,
    /const selectCanvasShape = useCallback[\s\S]*?deactivateStickyTool\(\);/,
  );
  assert.match(
    css,
    /\.project-canvas-tools-catalog\s*\{[\s\S]*?bottom:\s*calc\(var\(--project-canvas-toolbelt-bottom, 64px\) \+ 60px\)/,
  );
  assert.match(
    css,
    /\.project-canvas-widgets-launcher\s*\{[\s\S]*?bottom:\s*calc\(var\(--project-canvas-toolbelt-bottom, 64px\) \+ 60px\)/,
  );
});

test("shares the compact selection toolbar with basic shapes", () => {
  const playgroundSource = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  const toolbarSource = readFileSync(
    new URL("./components/ProjectStickyNoteToolbar.tsx", import.meta.url),
    "utf8",
  );
  const css = readCss("./styles.css");

  assert.match(toolbarSource, /export function ProjectSelectionToolbar/);
  assert.match(toolbarSource, /<ProjectSelectionToolbar style=\{style\}/);
  assert.match(
    playgroundSource,
    /const \[selectedCanvasShape, setSelectedCanvasShape\]/,
  );
  assert.match(playgroundSource, /canvasShapeReferenceForElement/);
  assert.match(
    playgroundSource,
    /<ProjectSelectionToolbar[\s\S]*project-shape-object-toolbar/,
  );
  assert.match(
    playgroundSource,
    /aria-label=\{`Shape, \$\{selectedShapeOption\.label\.toLowerCase\(\)\}`\}/,
  );
  assert.match(playgroundSource, /aria-label="Change color"/);
  assert.match(playgroundSource, /aria-label="Line style"/);
  assert.match(playgroundSource, /Fill[\s\S]*Transparent[\s\S]*No fill/);
  assert.match(playgroundSource, /Solid[\s\S]*Dashed[\s\S]*None/);
  assert.match(playgroundSource, /updateSelectedCanvasShape/);
  assert.match(playgroundSource, /project-playground__canvas--shape-selected/);
  assert.match(
    css,
    /\.project-shape-object-toolbar__shape-trigger[\s\S]*width:\s*56px/,
  );
  assert.match(
    css,
    /\.project-playground__canvas--shape-selected[\s\S]*\.selected-shape-actions[\s\S]*display:\s*none !important/,
  );
});

test("uses one contextual toolbar when a free line is selected", () => {
  const playgroundSource = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  const css = readCss("./styles.css");

  assert.match(
    playgroundSource,
    /selectedCanvasFreeLine\s*\?\s*" project-playground__canvas--free-line-selected"/,
  );
  assert.match(
    css,
    /\.project-playground__canvas--free-line-selected[\s\S]*\.selected-shape-actions\s*\{[\s\S]*display:\s*none !important;/,
  );
});

test("offers an internal searchable template library for designer workflows", () => {
  const source = readFileSync(
    new URL("./components/ProjectTemplateLibrary.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /import \{ Button, Card, TextInput \} from "@astryxdesign\/core"/,
  );
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
  const apiSource = readFileSync(
    new URL("./designerCanvasApi.ts", import.meta.url),
    "utf8",
  );
  const assetSource = readFileSync(
    new URL("./projectCanvasAssets.ts", import.meta.url),
    "utf8",
  );

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

  assert.match(
    source,
    /import \{ Button, Card, TextInput \} from "@astryxdesign\/core"/,
  );
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
  assert.match(source, /import \{ AppsPlatformSwitcher \} from "\.\/AppsPlatformSwitcher\.tsx"/);
  assert.match(source, /Search screens, features, or UI text…/);
  assert.match(source, /"app-store-listing"/);
  assert.match(source, /Screen platform/);
  assert.match(source, /<PlaceholderImage/);
  assert.match(source, /projectScreenFacetOptions/);
  assert.match(source, /rankProjectScreenResults/);
  assert.doesNotMatch(source, /"Add to canvas"/);
  assert.match(source, /onClick=\{\(\) => addToCanvas\(key,/);
  assert.match(source, /project-screen-library__card--screen/);
  assert.match(source, /project-screen-library__app-icon--overlay/);
  assert.match(source, /<h2>Inspiration<\/h2>/);
  assert.match(source, /Explore references/);
  assert.match(source, /project-screen-library__grid--inspiration/);
  assert.match(source, /<AppsPlatformSwitcher[\s\S]*ariaLabel="Screen platform"/);
  assert.match(source, /project-screen-library__card--flow/);
  assert.match(source, /project-screen-library__flow-steps/);
  assert.match(source, /Place \$\{projectScreenCardTitle\(result\)\}/);
  const screenCards =
    source.match(
      /state === "ready" && mode === "screens"([\s\S]*?)\{!visibleScreenResults\.length/,
    )?.[1] ?? "";
  assert.match(screenCards, /project-screen-library__preview--screen/);
  assert.doesNotMatch(screenCards, /project-screen-library__screen-title/);
  assert.match(screenCards, /Drag to canvas/);
  assert.doesNotMatch(screenCards, /project-screen-library__identity/);
  assert.doesNotMatch(screenCards, /project-screen-library__drag-hint/);
  assert.doesNotMatch(screenCards, /Add to canvas/);
  assert.doesNotMatch(source, /or drag to place/);
  assert.match(source, /onAddItem/);
  assert.match(source, /draggable: true/);
  assert.match(source, /No screens match this search yet/);
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
  const rules =
    css.match(/\.project-canvas-tools-catalog[^{]*\{[^}]*\}/g) ?? [];
  assert.ok(
    rules.length > 8,
    `expected the catalog's rules, found ${rules.length}`,
  );

  const hardcoded = rules.filter((rule) =>
    /(?:^|[;{ ])(?:color|background|background-color|border-color):\s*#[0-9a-f]{3,8}/i.test(
      rule,
    ),
  );
  assert.deepEqual(
    hardcoded,
    [],
    "catalog ink must read from --project-canvas-*",
  );

  assert.match(
    css,
    /\.project-canvas-tools-catalog\s*\{[^}]*color:\s*var\(--project-canvas-text/s,
  );
  assert.match(
    css,
    /\.project-canvas-tools-catalog__header h2\s*\{[^}]*color:\s*var\(--project-canvas-text/s,
  );
  assert.match(
    css,
    /\.project-canvas-tools-catalog__item\s*\{[^}]*color:\s*var\(--project-canvas-text/s,
  );
});

test("keeps Vitrines actions inside the FigJam-style canvas toolbelt", () => {
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
    /\.project-playground__actions-trigger\[aria-pressed="true"\],[\s\S]*?\.project-playground__widgets-trigger\[aria-pressed="true"\]\s*\{([^}]*)\}/.exec(
      css,
    )?.[1] ?? "";
  assert.match(pressed, /background:\s*#9747ff/);
  assert.match(pressed, /color:\s*#fff/);

  // The native override that sits above it must use the same pair, or the two
  // halves of one toolbar drift apart again.
  const native =
    /\.ToolIcon_type_checkbox:checked \+ \.ToolIcon__icon\s*\{([^}]*)\}/.exec(
      css,
    )?.[1] ?? "";
  assert.match(native, /background:\s*#9747ff/);
  assert.match(native, /color:\s*#fff/);

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
  assert.match(css, /--project-canvas-toolbelt-bottom:\s*\d+px;/);
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.shapes-section\s*\{[^}]*bottom:\s*var\(--project-canvas-toolbelt-bottom[^}]*left:\s*50%[^}]*transform:\s*translateX\(-50%\)/s,
  );
  assert.match(
    css,
    /\.project-canvas-more-shapes\s*\{[^}]*bottom:\s*calc\(var\(--project-canvas-toolbelt-bottom, 64px\) \+ 116px\);[^}]*left:\s*50%;[^}]*width:\s*min\(560px, calc\(100vw - 24px\)\);/s,
  );
  assert.match(
    css,
    /\.project-playground__canvas \.excalidraw \.App-toolbar > \.Stack_horizontal\s*\{[^}]*flex-direction:\s*row[^}]*overflow-x:\s*auto/s,
  );
  const railHover =
    /\.project-playground__stamp-trigger:hover,[\s\S]*?\.project-playground__widgets-trigger:hover\s*\{([^}]*)\}/.exec(
      css,
    )?.[1] ?? "";
  const nativeHover =
    /\.excalidraw \.App-toolbar__extra-tools-trigger:hover\s*\{([^}]*)\}/.exec(
      css,
    )?.[1] ??
    /\.App-toolbar \.ToolIcon__icon:hover[^{]*\{([^}]*)\}/.exec(css)?.[1] ??
    "";
  assert.match(railHover, /#f2f4f7/);
  assert.match(nativeHover, /#f2f4f7/);
  const triggerSize =
    /\.project-playground__comments-trigger,[\s\S]*?\.project-playground__actions-trigger,[\s\S]*?\.project-playground__widgets-trigger\s*\{([^}]*)\}/.exec(
      css,
    )?.[1] ?? "";
  assert.match(triggerSize, /width:\s*32px/);
  assert.doesNotMatch(triggerSize, /--default-button-size/);
  assert.match(
    css,
    /\.project-playground__stamp-trigger:focus-visible,[\s\S]*?\.project-playground__widgets-trigger:focus-visible\s*\{[^}]*outline:\s*2px solid #0d99ff/s,
  );
  const playground = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(playground, /aria-label="Vitrines canvas tools"/);
  assert.match(playground, /data-canvas-toolbar-region="bottom"/);
  assert.match(css, /toolbar-selection[\s\S]*figjam-select-tool\.svg/s);
  assert.match(
    css,
    /project-playground__canvas \.excalidraw\s*\{[^}]*background:\s*var\(--project-canvas-bg, #f7f8fa\)/s,
  );
  assert.match(css, /toolbar-hand[\s\S]*figjam-hand-tool\.svg/s);
  assert.match(css, /toolbar-freedraw[\s\S]*figjam-marker-tool\.svg/s);
  assert.match(
    css,
    /project-playground__canvas--highlighter-drawing[\s\S]*toolbar-freedraw[\s\S]*figjam-highlighter-tool\.svg/s,
  );
  assert.match(
    css,
    /project-playground__canvas--eraser-drawing[\s\S]*toolbar-freedraw[\s\S]*figjam-eraser-tool\.svg/s,
  );
  assert.match(
    css,
    /label:has\(input\[data-testid="toolbar-eraser"\]\)\s*\{\s*display:\s*none/s,
  );
  assert.match(
    playground,
    /data-marker-mode=\{markerDrawing \? markerMode : undefined\}/,
  );
  assert.match(
    css,
    /project-canvas-highlighter-preview-in 140ms ease-out both/,
  );
  assert.match(css, /project-canvas-eraser-preview-in 140ms ease-out both/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(playground, /aria-label="Marker controls"/);
  assert.match(playground, /aria-label="Freehand tools"/);
  assert.match(playground, /const canvasHighlighterColors/);
  assert.match(playground, /const canvasFigJamYellow = "#ffee00"/);
  assert.match(playground, /label: "Yellow", value: canvasFigJamYellow/);
  assert.match(playground, /const \[markerColor, setMarkerColor\]/);
  assert.match(playground, /const \[highlighterColor, setHighlighterColor\]/);
  assert.match(
    playground,
    /markerMode === "highlighter" \? highlighterColor : markerColor/,
  );
  assert.match(playground, /Stroke weight unavailable for Eraser/);
  assert.match(playground, /Color unavailable for Eraser/);
  assert.match(
    playground,
    /\$\{color\.label\} \$\{markerMode === "highlighter" \? "highlighter" : "marker"\}/,
  );
  assert.match(playground, /disabled=\{markerOptionsDisabled\}/);
  assert.match(playground, /function coloredFigJamFreehandToolIcon/);
  assert.match(
    playground,
    /highlighterToolIconSource\.replaceAll\("rgba\(255, 238, 0, 1\)", color\)/,
  );
  assert.match(
    playground,
    /markerToolIconSource\.replace\("rgba\(30, 30, 30, 1\)", color\)/,
  );
  assert.match(
    playground,
    /standaloneSource = source\.includes\('xmlns="http:\/\/www\.w3\.org\/2000\/svg"'\)/,
  );
  assert.match(playground, /"--canvas-marker-tool-icon"/);
  assert.match(playground, /"--canvas-highlighter-tool-icon"/);
  assert.match(playground, /querySelector<HTMLElement>\("\.excalidraw"\)/);
  assert.match(
    playground,
    /data-marker-color-transition=\{markerColorTransition \? "b" : "a"\}/,
  );
  assert.doesNotMatch(playground, /label: "Washi tape"/);
  assert.match(playground, /label: "Eraser"/);
  assert.match(
    playground,
    /aria-label=\{\s*markerOptionsDisabled\s*\? "Stroke weight unavailable for Eraser"\s*: "Stroke weight"\s*\}/,
  );
  assert.match(
    playground,
    /Custom \$\{markerMode === "highlighter" \? "highlighter" : "marker"\} color/,
  );
  assert.match(playground, /currentItemOpacity: canvasMarkerOpacity\(mode\)/);
  assert.match(playground, /if \(mode === "highlighter"\) return 100;/);
  assert.match(playground, /currentItemStrokeColor: color/);
  assert.match(css, /project-canvas-marker-controls__weight-button:disabled/);
  assert.match(css, /project-canvas-marker-controls__swatch:disabled/);
  assert.match(css, /--canvas-marker-tool-icon/);
  assert.match(css, /--canvas-highlighter-tool-icon/);
  assert.match(
    css,
    /project-canvas-tool-color-preview-in-a 180ms ease-out both/,
  );
  assert.match(
    css,
    /project-canvas-tool-color-preview-in-b 180ms ease-out both/,
  );
  assert.match(
    css,
    /project-playground__canvas--marker-drawing[\s\S]*selected-shape-actions[\s\S]*display:\s*none !important/s,
  );
  assert.match(css, /toolbar-freedraw[\s\S]*order:\s*-1/s);
  const stickyPicker = readFileSync(
    new URL("./components/ProjectStickyNotePicker.tsx", import.meta.url),
    "utf8",
  );
  assert.match(stickyPicker, /figjam-sticky-note-tool\.svg/);
  assert.match(stickyPicker, /figjam-sticky-note-tool\.svg\?raw/);
  assert.match(stickyPicker, /replaceAll\("rgb\(255 175 163\)", color\.fill\)/);
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
    "project-screen-library",
  ];
  for (const panel of panels) {
    const rules =
      css.match(new RegExp(`\\.${panel}[^{]*\\{[^}]*\\}`, "g")) ?? [];
    assert.ok(
      rules.length > 4,
      `expected ${panel} rules, found ${rules.length}`,
    );
    const hardcoded = rules.filter(
      (rule) =>
        /(?:^|[;{ ])(?:color|border-color):\s*#[0-9a-f]{3,8}/i.test(rule) ||
        /(?:^|[;{ ])background:\s*#[0-9a-f]{3,8}/i.test(rule),
    );
    assert.deepEqual(
      hardcoded,
      [],
      `${panel} must read ink from --project-canvas-*`,
    );
  }

  assert.match(
    css,
    /\.project-sticky-note-picker\s*\{[^}]*background:\s*rgb\(255 255 255 \/ 98%\)/s,
  );
  assert.match(
    css,
    /\.project-playground--canvas-first\s*\{[^}]*--project-canvas-text:\s*#1e1e1e;[^}]*--project-canvas-surface:\s*#fff;[^}]*--project-canvas-surface-translucent-strong:\s*rgb\(255 255 255 \/ 98%\);/s,
  );
  assert.match(
    css,
    /\.project-canvas-document-editor__toolbar\s*\{[^}]*color:\s*#fff;[^}]*background:\s*#1e1e1e;/s,
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
  const memo =
    /const stickyComposerStyle = useMemo\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/.exec(
      source,
    );
  assert.ok(memo, "sticky composer style memo not found");
  assert.doesNotMatch(memo[1], /if \(!editor \|\| !root\) return undefined;/);
  assert.doesNotMatch(memo[1], /editorRef\.current/);
  assert.match(memo[1], /canvasViewport/);
  assert.match(memo[2], /canvasViewport/);

  // Only the absent draft withholds the composer now.
  assert.equal((memo[1].match(/return undefined;/g) ?? []).length, 1);
  assert.match(memo[1], /if \(!stickyDraft\) return undefined;/);

  // The sibling overlay already positioned itself this way; both now agree.
  assert.match(
    source,
    /stickyNoteMetadataStyle[\s\S]{0,400}canvasViewport\.scrollX/,
  );
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
  const memo =
    /const stickyComposerStyle = useMemo\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/.exec(
      source,
    );
  assert.ok(memo, "sticky composer style memo not found");
  // Editing an existing note uses that note's actual bounds; a new note uses
  // the default size. Both paths still scale by the live board zoom.
  assert.match(memo[1], /const noteWidth = stickyDraft\.width \?\? stickyNoteSize;/);
  assert.match(memo[1], /const noteHeight = stickyDraft\.height \?\? stickyNoteSize;/);
  assert.match(memo[1], /const width = noteWidth \* zoom;/);
  assert.match(memo[1], /const height = noteHeight \* zoom;/);
  assert.match(memo[1], /stickyDraft\.x - noteWidth \/ 2/);
  assert.match(memo[1], /stickyDraft\.y - noteHeight \/ 2/);
  assert.match(
    memo[1],
    /"--sticky-font-size": `\$\{stickyDraft\.format\.fontSize \* zoom\}px`/,
  );
  assert.match(
    memo[1],
    /"--sticky-padding-horizontal": `\$\{stickyNoteTextHorizontalInset \* zoom\}px`/,
  );
  assert.match(
    memo[1],
    /"--sticky-padding-top": `\$\{stickyNoteTextVerticalInset \* zoom\}px`/,
  );
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
  assert.match(
    source,
    /\{ selectNote = true \}: \{ selectNote\?: boolean \} = \{\}/,
  );
  assert.match(source, /if \(selectedElementId && selectNote\)/);
  assert.match(
    source,
    /onBlur=\{\(event\) => \{[\s\S]*?commitStickyDraft\(event\.currentTarget\.textContent \?\? "", \{\s*selectNote: false,?\s*\}\);/,
  );
  // ⌘↵ keeps the old behaviour — it is a finish, not a departure.
  assert.match(
    source,
    /event\.key === "Enter"\s*&&\s*\(event\.metaKey \|\| event\.ctrlKey\)[\s\S]{0,320}commitStickyDraft\(event\.currentTarget\.textContent \?\? ""\);/,
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
  const allowlist =
    /const workspaceChromeRoutes = new Set\(\[([\s\S]*?)\]\);/.exec(appSource);
  assert.ok(allowlist, "workspace chrome allowlist not found");
  assert.doesNotMatch(allowlist[1], /"project-canvas"/);
  assert.doesNotMatch(allowlist[1], /"project-playground"/);
  // The surfaces that do belong in the shell stay there.
  assert.match(allowlist[1], /"projects"/);
  assert.match(allowlist[1], /"project"/);
  assert.match(allowlist[1], /"collections"/);

  // Nothing to publish to a shell it no longer renders in, and its own way out.
  assert.doesNotMatch(playgroundSource, /useWorkspaceChrome/);
  assert.match(playgroundSource, /aria-label="Projects home"/);
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
  assert.match(
    screens,
    /<IconButton[\s\S]{0,200}icon=\{<Icon icon="close" size="sm" \/>\}/,
  );
  assert.doesNotMatch(screens, /<Button label="Close"/);
  assert.match(playground, /icon=\{<Icon icon="close" size="sm" \/>\}/);
});

test("limits the catalog to screens and flows", () => {
  const source = readFileSync(
    new URL("./components/ProjectScreenLibrary.tsx", import.meta.url),
    "utf8",
  );
  const playground = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /kind: "app"/);
  assert.doesNotMatch(source, /\{ value: "apps", label: "Apps" \}/);
  assert.match(source, /\{ value: "screens", label: "Screens" \}/);
  assert.match(source, /state === "ready" && mode === "screens"/);
  assert.match(
    playground,
    /onDragItem=\{\(payload\) => \{\s*catalogDragRef\.current = payload;\s*\}\}/,
  );
  assert.match(playground, /onAddItem=\{\(payload\) => \{/);

  /*
   * Screens come from the catalog response; flows use their own endpoint, so
   * the fetch branches on mode rather than always hitting both.
   */
  assert.match(source, /\{ value: "flows", label: "Flows" \}/);
  assert.match(source, /mode === "flows"\s*\?\s*loadFlowCatalogPage/);
  assert.match(source, /state === "ready" && mode === "flows"/);
  assert.match(source, /dragProps\(\{ kind: "flow", item, platform \}/);
});

test("promotes the catalog to the canvas toolbelt and names it for what it holds", () => {
  const playground = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  const panel = readFileSync(
    new URL("./components/ProjectScreenLibrary.tsx", import.meta.url),
    "utf8",
  );

  /*
   * The panel is the way onto the canvas for screens and flows, so it is
   * a rail tool rather than something to find inside the "more tools" catalog.
   * Its own styling already existed — only the button was missing.
   */
  assert.match(
    playground,
    /className="project-playground__screens-trigger project-playground__screens-trigger--apps"/,
  );
  assert.match(
    playground,
    /className="project-playground__sticky-tools"[\s\S]*?className="project-playground__screens-trigger project-playground__screens-trigger--apps"[\s\S]*?className="project-playground__sticky-trigger"/,
  );
  assert.match(
    playground,
    /onClick=\{\(\) => activateCanvasTool\("screens"\)\}/,
  );
  assert.doesNotMatch(
    playground,
    /title: "Catalog"[\s\S]{0,260}title: "Sticky notes"/,
  );

  // The rail tool stays named Catalog while the panel speaks to the designer's
  // actual job: finding a useful visual reference.
  assert.match(panel, /<h2>Inspiration<\/h2>/);
  assert.match(panel, /Reference library/);
  assert.doesNotMatch(panel, /<span>Astryx data<\/span>/);
  const css = readCss("./styles.css");
  assert.doesNotMatch(css, /\.project-screen-library__header span/);
  assert.match(
    panel,
    /Browse visual references, then drag the ones worth exploring onto your canvas\./,
  );
  assert.doesNotMatch(panel, /Search captured product screens and place them/);
  // The search field names whichever grain is showing.
  assert.match(panel, /const searchLabel = mode === "flows"/);
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
  assert.match(
    playground,
    /const catalogDragRef = useRef<CatalogDragPayload \| undefined>\(undefined\)/,
  );

  /*
   * Native listeners on document, capture phase. React attaches its synthetic
   * handlers at the app root and Excalidraw runs its own drag/drop on the
   * canvas, so capturing at document is the only place guaranteed to run before
   * both — and stopping it there keeps both out of a catalog drag.
   */
  assert.match(
    playground,
    /document\.addEventListener\("dragover", onDragOver, true\)/,
  );
  assert.match(
    playground,
    /document\.addEventListener\("drop", onDrop, true\)/,
  );
  assert.match(
    playground,
    /document\.removeEventListener\("drop", onDrop, true\)/,
  );
  assert.match(
    playground,
    /const onDragOver = \(event: DragEvent\)[\s\S]{0,300}event\.stopPropagation\(\)/,
  );
  // Scoped to the board, so drags elsewhere in the app are untouched.
  assert.match(playground, /root\.contains\(target\)/);

  /* The record is read back from dataTransfer, so a drop works even when the
     ref was never set — which is what happens if something other than the card
     ends up owning the gesture. */
  assert.match(playground, /JSON\.parse\(raw\) as CatalogDragPayload/);
  assert.match(
    panel,
    /setData\(catalogDragMimeType, JSON\.stringify\(payload\)\)/,
  );

  // The ghost is the whole card, held where it was grabbed.
  assert.match(panel, /setDragImage\(\s*card,/);
  /* A marker type on the drag, so a target can recognise it from the event
     rather than from state it must have been told about. */
  /* Array.from first — `types` is a DOMStringList in some engines, where
     `.includes` throws and takes the listener with it. */
  assert.match(
    playground,
    /Array\.from\(event\.dataTransfer\?\.types \?\? \[\]\)\.includes\(\s*catalogDragMimeType,?\s*\)/,
  );
  assert.match(playground, /addEventListener\("dragenter", onDragOver, true\)/);
  /* An <img> is natively draggable; left alone it starts a browser image-drag
     with the image URL and the card's dragstart never owns the gesture. */
  const css = readCss("./styles.css");
  assert.match(
    css,
    /\.project-screen-library__card img \{[^}]*-webkit-user-drag: none;/s,
  );
  assert.match(panel, /card\.dataset\.dragging = "true"/);

  /* Screen point to scene point is the inverse of how overlays are placed:
     screen = (scene + scroll) * zoom. */
  assert.match(
    playground,
    /x: \(event\.clientX - rect\.left\) \/ zoom - appState\.scrollX/,
  );
  assert.match(
    playground,
    /y: \(event\.clientY - rect\.top\) \/ zoom - appState\.scrollY/,
  );
  // A drop names its spot; a click keeps the cascade-from-last-card default.
  assert.match(playground, /placement\?\.x \?\?\s*\(lastDataCard/);
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
  const createCatalogCardSource =
    /function createCatalogCardElements\([\s\S]*?\n}\n\nfunction/.exec(
      source,
    )?.[0] ?? "";
  assert.equal(
    (createCatalogCardSource.match(/groupIds: \[groupId\]/g) ?? []).length,
    5,
  );
  // The container keeps the reference, so selection and "open source" still work.
  assert.match(source, /customData: \{ astryxReference: reference \}/);

  /* Thumbnails are contained, not stretched: these are screenshots, and a
     squashed screenshot is unreadable. */
  assert.match(
    source,
    /Math\.min\(\s*\(width - padding \* 2\) \/ image\.width/,
  );
  // A dead media URL must not stop a card being placed.
  assert.match(
    source,
    /async function loadCatalogCardImage[\s\S]{0,900}return undefined;/,
  );
  assert.match(source, /image: loaded\?\.image/);

  // Screens are evidence, so they land on the board as the original image
  // rather than a metadata-heavy box.
  const insertScreen =
    /const insertCatalogScreen = useCallback\(([\s\S]*?)(?=\n  const insertCanvasDataReference)/.exec(
      source,
    )?.[1] ?? "";
  assert.match(insertScreen, /type: "image"/);
  assert.match(insertScreen, /fileId: image\.fileId/);
  assert.match(insertScreen, /customData: \{[\s\S]*kind: "screen"/);
  assert.doesNotMatch(insertScreen, /createCatalogCardElements/);
  assert.doesNotMatch(insertScreen, /eyebrow: "Screen"/);
  // A screen image dropped into a frame still belongs to it.
  assert.match(insertScreen, /frameId: placement\.frameId \?\? null/);
});

test("places a catalog flow as a storyboard of real step images", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );
  const insertFlow =
    /const insertCatalogFlow = useCallback\(([\s\S]*?)(?=\n  const insertTemplate)/.exec(
      source,
    )?.[1] ?? "";

  assert.ok(insertFlow, "expected to find insertCatalogFlow");
  assert.match(insertFlow, /item\.preview\.flow\.steps/);
  // The canvas keeps the full captures, not the lightweight library thumbnails.
  assert.match(insertFlow, /imageUrl/);
  assert.doesNotMatch(insertFlow, /thumbnailUrl/);
  assert.match(source, /url\.pathname\.startsWith\("\/api\/catalog\/flow-media\/"\)/);
  assert.match(insertFlow, /type: "image"/);
  assert.match(insertFlow, /kind: "flow"/);
  assert.match(insertFlow, /stepIndex/);
  assert.match(insertFlow, /editor\.addFiles\(/);
  assert.match(insertFlow, /Added .*screens from/);
  assert.doesNotMatch(insertFlow, /insertCanvasDataReference/);
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
  assert.match(
    source,
    /canvasImagePlacement\(\s*dimensions\.width,\s*dimensions\.height,?\s*\)/,
  );
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

  const insertScreen =
    /const insertCatalogScreen = useCallback\(([\s\S]*?)(?=\n  const insertCanvasDataReference)/.exec(
      source,
    )?.[1] ?? "";
  assert.ok(insertScreen, "expected to find insertCatalogScreen");
  assert.match(insertScreen, /loadCatalogCardImage\(screen\.url, projectId\)/);
  assert.doesNotMatch(insertScreen, /thumbnailUrl/);
  assert.match(
    insertScreen,
    /const lastScreenImage = dropPoint\s*\? undefined/,
  );
  assert.match(
    insertScreen,
    /lastScreenImage\.x \+ lastScreenImage\.width \+ 40/,
  );
  assert.match(insertScreen, /This screen image could not be loaded/);
  assert.doesNotMatch(insertScreen, /=\s*screen\.url;/);
  assert.doesNotMatch(insertScreen, /uploadProjectCanvasAsset/);

  // The loader keeps decoded bytes inline rather than reaching for the origin.
  const loader =
    /async function loadCatalogCardImage\(([\s\S]*?)\n\}/.exec(source)?.[1] ??
    "";
  assert.match(source, /function blobDataUrl[\s\S]*readAsDataURL/);
  assert.match(loader, /const dataURL = await blobDataUrl\(blob\)/);
  assert.match(loader, /dataURL,/);
  assert.doesNotMatch(loader, /src = url/);
});

/*
 * Placing a reference is a transient success, so it belongs in the app toast rather
 * than as a line of text left sitting inside a catalog panel. The panels keep
 * their message channel only where it still reports a failure.
 */
test("confirms a placed reference with the app toast", () => {
  const source = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /import \{ useApplicationToast \} from "\.\/ApplicationToast\.tsx"/,
  );
  assert.match(source, /const showToast = useApplicationToast\(\);/);
  assert.match(source, /showToast\(\s*loaded\.stored/);
  assert.match(source, /showToast\(message\);/);

  // The Catalog panel no longer narrates success; failures remain visible.
  assert.doesNotMatch(source, /setScreenMessage\(\s*storedInProject/);
  assert.match(source, /setScreenMessage\(\(error as Error\)\.message\)/);
});
