import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DesignSystemSnapshot } from './designSystem.ts';
import { buildExportArtifact, type ExportScope } from './exportEngine.ts';

const snapshot: DesignSystemSnapshot = {
  app: 'linear',
  generatedAt: '2026-07-10T00:00:00.000Z',
  tokens: [
    { id: 'color-accent', kind: 'color', name: 'Accent', value: '#5E6AD2', role: 'Primary action', evidence: [7] },
    { id: 'space-8', kind: 'spacing', name: 'Space 8', value: '8px', role: 'Control gap', evidence: [7] },
  ],
  components: [{
    id: 'button', name: 'Button', category: 'Actions', description: 'Triggers an action',
    variants: [{ id: 'primary', name: 'Primary', description: 'Filled action', evidence: [7] }],
  }],
  flows: [{ id: 'sign-in', title: 'Sign in', description: 'Authenticate', tags: ['Auth'], steps: [{ label: 'Submit', evidence: [7] }] }],
};
const images = [{ id: 7, image_url: 'linear.webp', description: 'Workspace toolbar' }];
const whole: ExportScope = { kind: 'design-system' };

test('builds an editable Figma development-plugin ZIP from observed evidence', () => {
  const artifact = buildExportArtifact(snapshot, images, 'figma', whole);
  assert.equal(artifact.filename, 'linear-figma-library.zip');
  assert.equal(artifact.mime, 'application/zip');
  assert.equal(artifact.content.subarray(0, 2).toString(), 'PK');
  const text = artifact.content.toString('utf8');
  assert.match(text, /manifest\.json/);
  assert.match(text, /createVariableCollection/);
  assert.match(text, /combineAsVariants/);
  assert.match(text, /layoutMode = "VERTICAL"/);
  assert.match(text, /Evidence screen/);
  assert.match(text, /"id":7/);
  assert.doesNotMatch(text, /Secondary/);
});

test('renders secondary formats from the same scoped snapshot', () => {
  assert.match(buildExportArtifact(snapshot, images, 'css', whole).content.toString(), /--linear-accent: #5E6AD2/);
  assert.match(buildExportArtifact(snapshot, images, 'tailwind', whole).content.toString(), /"accent": "#5E6AD2"/);
  assert.match(buildExportArtifact(snapshot, images, 'component-spec', whole).content.toString(), /"evidence": \[\s*7/);
  assert.match(buildExportArtifact(snapshot, images, 'react', whole).content.toString(), /export function Button/);
  assert.equal(JSON.parse(buildExportArtifact(snapshot, images, 'json', whole).content.toString()).tokens.length, 2);
});

test('react export renders real observed styling from reconstruction data, not an empty wrapper', () => {
  const styled: DesignSystemSnapshot = {
    ...snapshot,
    components: [{
      id: 'button', name: 'Button', category: 'Actions', description: 'Triggers an action',
      variants: [{
        id: 'primary', name: 'Primary', description: 'Filled action', evidence: [7],
        reconstruction: { layoutMode: 'HORIZONTAL', width: 120, height: 40, padding: 12, gap: 8, fill: '#5E6AD2', radius: 8, visibleText: 'Continue' },
      }],
    }],
  };
  const text = buildExportArtifact(styled, images, 'react', whole).content.toString();
  assert.match(text, /ButtonStyles/);
  assert.match(text, /background: "#5E6AD2"/);
  assert.match(text, /width: 120/);
  assert.match(text, /borderRadius: 8/);
  assert.match(text, /ButtonLabels/);
  assert.match(text, /"Continue"/);
  assert.doesNotMatch(text, /<div data-astryx-component="button" data-observed-variant={observedVariant}>{children}<\/div>/);
});

test('renders a DESIGN.md with token frontmatter and observed components', () => {
  const text = buildExportArtifact(snapshot, images, 'design-md', whole).content.toString();
  assert.match(text, /^---\n/);
  assert.match(text, /name: "linear-design-analysis"/);
  assert.match(text, /colors:\n {2}accent: "#5E6AD2" # Primary action/);
  assert.match(text, /spacing:\n {2}space-8: "8px" # Control gap/);
  assert.match(text, /### Button \(Actions\)/);
  assert.match(text, /\*\*Primary\*\* — Filled action/);
  assert.match(text, /## Agent Prompt Guide/);
  assert.match(text, /- Accent: `#5E6AD2` — Primary action/);
});

test('renders a FLOW.md PM doc with an index and evidence-cited steps', () => {
  const text = buildExportArtifact(snapshot, images, 'flow-md', whole).content.toString();
  assert.match(text, /^---\n/);
  assert.match(text, /title: "linear product flows"/);
  assert.match(text, /flows: 1/);
  assert.match(text, /## Flow index\n\n1\. \[Sign in\]\(#sign-in\) · 1 step\(s\)/);
  assert.match(text, /## Sign in/);
  assert.match(text, /_Auth_/);
  assert.match(text, /1\. \*\*Submit\*\*/);
  assert.match(text, /_Seen on: Workspace toolbar_/);
});

test('FLOW.md surfaces flow verification status when provenance is present', () => {
  const withProvenance: DesignSystemSnapshot = {
    ...snapshot,
    flows: [{
      ...snapshot.flows[0],
      provenance: { autonomousRunId: 'r1', missionId: 'm1', confidence: 0.9, sourceUrls: ['https://ex.com/x'], validationStatus: 'uncertain' },
    }],
  };
  const text = buildExportArtifact(withProvenance, images, 'flow-md', whole).content.toString();
  assert.match(text, /\*\*Status:\*\* uncertain · confidence 90% · \[source\]\(https:\/\/ex\.com\/x\)/);
});

test('FLOW.md does not repeat a tag that duplicates the flow category', () => {
  const dupe: DesignSystemSnapshot = {
    ...snapshot,
    flows: [{ id: 'f', title: 'Repair', category: 'Retention', description: '', tags: ['Retention', 'Monetization'], steps: [{ label: 'Go', evidence: [7] }] }],
  };
  const text = buildExportArtifact(dupe, images, 'flow-md', whole).content.toString();
  assert.match(text, /_Retention · Monetization_/);
  assert.doesNotMatch(text, /Retention · Monetization · Retention|Retention · Retention/);
});

test('exports only the selected observed family or foundation category', () => {
  const family = buildExportArtifact(snapshot, images, 'json', { kind: 'component-family', id: 'button' });
  const familyJson = JSON.parse(family.content.toString());
  assert.equal(familyJson.components.length, 1);
  assert.equal(familyJson.tokens.length, 0);
  assert.throws(() => buildExportArtifact(snapshot, images, 'json', { kind: 'component-family', id: 'missing' }), /not observed/);

  const colors = JSON.parse(buildExportArtifact(snapshot, images, 'json', { kind: 'foundation-category', id: 'colors' }).content.toString());
  assert.deepEqual(colors.tokens.map(({ id }: { id: string }) => id), ['color-accent']);
});
