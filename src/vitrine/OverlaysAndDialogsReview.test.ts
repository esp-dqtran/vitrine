import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const story = readFileSync('src/stories/Components/OverlaysAndDialogs.stories.tsx', 'utf8');
const css = readFileSync('src/stories/Components/OverlaysAndDialogs.css', 'utf8');
const dropdownCss = readFileSync('src/vitrine/components/AstryxDropdown.css', 'utf8');
const modalCss = readFileSync('src/vitrine/components/AstryxModal.css', 'utf8');
const productSpacingCss = readFileSync('src/vitrine/productSpacing.css', 'utf8');
const previewCss = readFileSync('src/vitrine/flowPreviewDialog.css', 'utf8');
const previewDialog = readFileSync('src/vitrine/components/ScreenPreviewDialog.tsx', 'utf8');
const flowDialog = readFileSync('src/vitrine/components/FlowPreviewDialog.tsx', 'utf8');
const projectsCss = readFileSync('src/vitrine/projectsWorkspace.css', 'utf8');
const previewModalCloseButton = readFileSync('src/vitrine/components/PreviewModalCloseButton.tsx', 'utf8');
const previewModalConsumers = [
  'src/vitrine/components/PublicAppPreviewPage.tsx',
  'src/vitrine/components/PublicSitePreviewModal.tsx',
].map((path) => readFileSync(path, 'utf8'));
const overlayIconActions = [
  'src/vitrine/components/AdvancedSearchFilterDrawer.tsx',
  'src/vitrine/components/AdvancedSearchPreview.tsx',
  'src/vitrine/components/CommandPalette.tsx',
  'src/vitrine/components/Lightbox.tsx',
  'src/vitrine/components/SiteSectionInspector.tsx',
].map((path) => readFileSync(path, 'utf8'));

test('builds the Overlays and Dialogs visual review from production components', () => {
  assert.match(story, /title: 'Components\/Overlays and Dialogs\/Visual review'/);
  assert.match(story, /<ScreenPreviewDialog/);
  assert.match(story, /const \[previewOpen, setPreviewOpen\] = useState\(true\)/);
  assert.match(story, /<AstryxModal/);
  assert.match(story, /<AstryxAlertModal/);
  assert.match(story, /<AstryxModalSurface/);
  assert.match(story, /<Popover/);
  assert.match(story, /<Tooltip/);
  assert.match(story, /<AstryxDropdownItem/);
});

test('uses the App Detail screen preview as the production reference', () => {
  assert.match(story, /title="Production preview dialog"/);
  assert.match(story, /Aboard onboarding dashboard/);
  assert.match(story, /\/landing\/astryx-public-preview-real-flows\.png/);
  assert.match(story, /Open production dialog/);
  assert.match(previewDialog, /Found in/);
  assert.match(previewDialog, /Save/);
  assert.match(previewDialog, /Copy image/);
  assert.doesNotMatch(previewDialog, /More screen actions/);
  assert.match(previewCss, /\.app-screen-preview-dialog__context strong \{[\s\S]*background: var\(--vitrine-color-action-primary\);[\s\S]*color: var\(--vitrine-color-on-action-primary\);/);
  assert.match(previewCss, /\.flow-preview-dialog__header-actions > button \{[\s\S]*background: var\(--vitrine-color-on-action-primary\) !important;[\s\S]*color: var\(--vitrine-color-action-primary\) !important;/);
  assert.match(previewCss, /\.flow-preview-dialog__metadata button \{[\s\S]*font-weight: 700;/);
});

test('covers dialog popover tooltip backdrop elevation and responsive behavior', () => {
  assert.match(story, /title="Focused decisions"/);
  assert.match(story, /title="Contextual overlays"/);
  assert.match(story, /className=\{`astryx-dropdown overlay-review__dropdown-menu/);
  assert.doesNotMatch(story, /overlay-review__panel-specimen/);
  assert.doesNotMatch(story, /overlay-review__popover-content/);
  assert.match(story, /title="Responsive and elevation contract"/);
  assert.doesNotMatch(story, /overlay-review__production-dialog/);
  assert.match(story, /same component used by App Detail/);
  assert.match(css, /box-shadow:/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('retains the production modal geometry and mobile preview behavior', () => {
  assert.match(modalCss, /border-radius: 24px !important/);
  assert.match(modalCss, /dialog\.astryx-modal::backdrop/);
  assert.match(modalCss, /@media \(max-width: 680px\)/);
  assert.match(previewCss, /\.flow-preview-dialog \{[\s\S]*inset: 24px 32px 32px[\s\S]*border-radius: 24px/);
  assert.match(previewCss, /@media \(max-width: 680px\)[\s\S]*\.flow-preview-dialog \{[\s\S]*inset: 0;[\s\S]*border-radius: 0;/);
});

test('applies the approved preview actions and modal geometry across production overlays', () => {
  assert.doesNotMatch(flowDialog, /More screen actions/);
  assert.doesNotMatch(flowDialog, /More prototype actions/);
  assert.doesNotMatch(flowDialog, /flow-preview-dialog__menu/);
  assert.match(modalCss, /\.astryx-modal__icon-action \{[\s\S]*border-radius: 50% !important;[\s\S]*background: var\(--vitrine-color-on-action-primary\) !important;[\s\S]*color: var\(--vitrine-color-action-primary\) !important;/);
  assert.match(productSpacingCss, /:not\([\s\S]*\.astryx-modal__icon-action,[\s\S]*\) \{[\s\S]*height: var\(--vitrine-control-height\) !important;/);
  assert.match(previewModalCloseButton, /style=\{\{ position: 'absolute', top: 16, right: 16, zIndex: 5 \}\}/);
  assert.match(previewModalCloseButton, /<IconButton/);
  previewModalConsumers.forEach((source) => assert.match(source, /<PreviewModalCloseButton onClose=\{onClose\} \/>/));
  overlayIconActions.forEach((source) => assert.match(source, /<IconButton/));
  assert.doesNotMatch(projectsCss, /--astryx-modal-surface:/);
  assert.doesNotMatch(projectsCss, /border-radius: 16px !important/);
  assert.doesNotMatch(projectsCss, /projects-workspace-modal-in/);
  assert.doesNotMatch(projectsCss, /projects-workspace-backdrop-in/);
});

test('uses foundation tokens rather than a new overlay palette', () => {
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
  assert.match(css, /var\(--color-background-body\)/);
  assert.match(dropdownCss, /var\(--color-background-popover\)/);
  assert.match(css, /var\(--vitrine-type-action\)/);
  assert.match(css, /var\(--radius-container\)/);
});
