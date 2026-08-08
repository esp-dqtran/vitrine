import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const story = await readFile(
  new URL('../stories/Foundations/NavigationAndWayfinding.stories.tsx', import.meta.url),
  'utf8',
);
const styles = await readFile(
  new URL('../stories/Foundations/NavigationAndWayfinding.css', import.meta.url),
  'utf8',
);
const foundation = await readFile(
  new URL('./uiFoundation.css', import.meta.url),
  'utf8',
);

test('navigation review covers the approved component-system scope', () => {
  assert.match(story, /title: 'Foundations\/Navigation and wayfinding'/);
  assert.match(story, /Navigation &amp; Wayfinding/);
  assert.match(story, /Persistent product navigation/);
  assert.match(story, /App Detail pilot/);
  assert.match(story, /Breadcrumbs/);
  assert.match(story, /SegmentedControl/);
  assert.match(story, /Pagination/);
  assert.match(story, /ProjectWorkspaceSidebar/);
  assert.doesNotMatch(story, /<SideNav/);
  assert.match(story, /Responsive behavior/);
});

test('product navigation uses the current Apps header rather than a review-only mock', () => {
  assert.match(story, /<ApplicationHeader/);
  assert.match(story, /active="apps"/);
  assert.match(story, /className="apps-top-nav"/);
  assert.match(story, /<SearchTrigger/);
  assert.match(story, /label="Search Apps…"/);
  assert.match(story, /activeFilterCount=\{1\}/);
  assert.match(story, /label="admin@gmail\.com"/);
  assert.doesNotMatch(story, /navigation-review__top-nav/);
  assert.match(styles, /\.navigation-review__production-nav \.reference-discovery-nav/);
  assert.match(styles, /\.navigation-review__production-nav[\s\S]*container-type: inline-size/);
  assert.match(styles, /@container \(max-width: 1080px\)[\s\S]*grid-template-columns: auto minmax\(220px, 1fr\) auto/);
});

test('App Detail pilot renders the real shared shell and product navigation controls', () => {
  assert.match(story, /<ReferenceDetailShell/);
  assert.match(story, /dataDetailKind="app"/);
  assert.match(story, /className="app-detail app-detail--web navigation-review__app-detail-shell"/);
  assert.match(story, /<AppsPlatformSwitcher/);
  assert.match(story, /<HeroButton primary>Export to Figma<\/HeroButton>/);
  assert.match(story, /<AstryxSingleSelectDropdown/);
  assert.match(story, /<DiscoveryFilterMenu/);
  assert.match(story, /value: 'Unclassified', section: 'Screen types'/);
  assert.match(story, /value: '1-on-1', section: 'Found in Flows'/);
  assert.doesNotMatch(story, /value: 'Dashboard', section: 'Type'/);
  assert.match(story, /className="reference-detail__section-total"/);
  assert.match(story, /onTabChange=\{setActiveTab\}/);
  assert.doesNotMatch(story, /navigation-review__detail-nav/);
  assert.doesNotMatch(styles, /\.navigation-review__tabs/);
});

test('wayfinding examples use approved primary selection states and Vitrines project navigation', () => {
  assert.match(story, /className="navigation-review__segmented-choice"/);
  assert.match(story, /value="light" label="Light"/);
  assert.match(story, /value="dark" label="Dark"/);
  assert.match(story, /value="system" label="System"/);
  assert.match(story, /layout="fill"/);
  assert.match(story, /--navigation-review-segment-shift/);
  assert.match(story, /className="navigation-review__pagination"/);
  assert.match(story, /<ProjectWorkspaceSidebar \/>/);
  assert.doesNotMatch(story, /ProjectWorkspaceNav|projectFiles\.css/);
  assert.match(story, /variant=\{active === value \? 'primary' : 'ghost'\}/);
  assert.match(styles, /\.navigation-review__workspace-sidebar[\s\S]*?background:\s*var\(--color-background-body\)/);
  assert.match(styles, /button\.navigation-review__workspace-nav-item\.primary[\s\S]*?background:\s*var\(--vitrine-color-action-primary\)\s*!important[\s\S]*?color:\s*var\(--vitrine-color-on-action-primary\)\s*!important/);
  assert.match(styles, /\.navigation-review__segmented-choice::before[\s\S]*?background:\s*var\(--vitrine-color-action-primary\)[\s\S]*?transition:\s*transform var\(--vitrine-transition-standard\)/);
  assert.match(styles, /\.navigation-review__segmented-choice[\s\S]*?button\[aria-checked='true'\][\s\S]*?color:\s*var\(--vitrine-color-on-action-primary\)\s*!important/);
  assert.match(styles, /\.navigation-review__pagination\.astryx-pagination[\s\S]*?width:\s*100%/);
  assert.match(foundation, /\.astryx-pagination\.pages[\s\S]*?background:\s*var\(--vitrine-color-on-action-primary\)/);
  assert.match(foundation, /\.astryx-pagination\.pages button\.astryx-button[\s\S]*?width:\s*var\(--vitrine-control-height\)\s*!important[\s\S]*?height:\s*var\(--vitrine-control-height\)\s*!important[\s\S]*?border-radius:\s*50%\s*!important/);
  assert.match(foundation, /\.astryx-pagination\.pages button\[aria-current='page'\][\s\S]*?background:\s*var\(--vitrine-color-action-primary\)\s*!important[\s\S]*?color:\s*var\(--vitrine-color-on-action-primary\)\s*!important/);
});

test('navigation review documents compact reflow without hiding peer sections', () => {
  assert.match(story, /Wide · ≥ 1080px/);
  assert.match(story, /Compact · ≤ 720px/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productResponsive\.css'/);
  assert.match(styles, /\.navigation-review__app-detail-results[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 620px\)/);
});
