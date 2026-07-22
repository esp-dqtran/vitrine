import type { CrawledImage } from './db.ts';
import type { ComponentVariant, DesignComponent, DesignSystemSnapshot, DesignToken, TokenKind } from './designSystem.ts';

export type ExportFormat = 'figma' | 'json' | 'css' | 'tailwind' | 'component-spec' | 'react' | 'design-md' | 'flow-md';
export type ExportScope =
  | { kind: 'design-system' }
  | { kind: 'foundation-category'; id: string }
  | { kind: 'component-family'; id: string }
  | { kind: 'screens'; ids: number[] }
  | { kind: 'selected'; componentIds: string[]; screenIds: number[] };

export interface ExportArtifact {
  filename: string;
  mime: string;
  content: Buffer;
}

type ExportImage = Pick<CrawledImage, 'id' | 'image_url' | 'description'> & { imageData?: string };

const foundationKinds: Record<string, TokenKind> = {
  colors: 'color', typography: 'typography', spacing: 'spacing', radii: 'radius', borders: 'border', effects: 'effect',
};
const evidenceForComponent = (component: DesignComponent): number[] => [...new Set(component.variants.flatMap(({ evidence }) => evidence))];
const hasEvidence = (snapshot: DesignSystemSnapshot): boolean => [
  ...snapshot.tokens.flatMap(({ evidence }) => evidence),
  ...snapshot.components.flatMap(evidenceForComponent),
  ...snapshot.flows.flatMap(({ steps }) => steps.flatMap(({ evidence }) => evidence)),
  ...(snapshot.rules ?? []).flatMap(({ evidence }) => evidence),
].length > 0;

function evidenceNeutral(content: string, snapshot: DesignSystemSnapshot): string {
  return content
    .replace(`Astryx observed design tokens for ${snapshot.app}. Evidence is retained in the JSON/component-spec exports.`, `Astryx design tokens for ${snapshot.app}.`)
    .replace(/Design system observed by Astryx across \d+ evidence screen\(s\) of [^.]+\./g, snapshot.summary || `Astryx design system for ${snapshot.app}.`)
    .replace(/Observed across \d+ evidence screen\(s\) of \*\*[^*]+\*\*, generated ([^.]+\.)/g, `${snapshot.summary || `Astryx design system for **${snapshot.app}**.`} Generated $1`)
    .replace(/ observed /gi, ' ')
    .replace(/ observed\b/gi, '')
    .replace(/Evidence: \*\//g, '*/')
    .replace(/ Evidence: \s*\*\//g, ' */')
    .replace(/observedVariant/g, 'variant')
    .replace(/data-observed-variant/g, 'data-variant')
    .replace(/ · Evidence screens: ' \+ token\.evidence\.join\(', '\)/g, '')
    .replace(/ \+ ' · Evidence screens: ' \+ variant\.evidence\.join\(', '\)/g, '')
    .replace(/node\.appendChild\(await label\('Evidence screens: ' \+ variant\.evidence\.join\(', '\)\)\);/g, '')
    .replace(/row\.appendChild\(await label\('Evidence screens: ' \+ rule\.evidence\.join\(', '\)\)\);/g, '')
    .replace(/Evidence screens:/g, 'Source references:')
    .replace(/evidence IDs stored in this export/gi, 'design-system data stored in this export')
    .replace(/from evidence\./gi, 'from design-system data.');
}

function scopeSnapshot(snapshot: DesignSystemSnapshot, images: ExportImage[], scope: ExportScope) {
  let tokens = snapshot.tokens;
  let components = snapshot.components;
  const allEvidence = new Set([
    ...snapshot.tokens.flatMap(({ evidence }) => evidence),
    ...snapshot.components.flatMap(evidenceForComponent),
    ...snapshot.flows.flatMap(({ steps }) => steps.flatMap(({ evidence }) => evidence)),
  ]);
  let selectedImages = images.filter(({ id }) => allEvidence.has(id));
  if (scope.kind === 'foundation-category') {
    const kind = foundationKinds[scope.id];
    if (!kind) throw new Error('Foundation category is not observed');
    tokens = tokens.filter((token) => token.kind === kind);
    components = [];
    selectedImages = images.filter(({ id }) => tokens.some(({ evidence }) => evidence.includes(id)));
  } else if (scope.kind === 'component-family') {
    components = components.filter(({ id }) => id === scope.id);
    if (!components.length) throw new Error('Component family is not observed');
    tokens = [];
    selectedImages = images.filter(({ id }) => components.some((component) => evidenceForComponent(component).includes(id)));
  } else if (scope.kind === 'screens') {
    const ids = new Set(scope.ids);
    selectedImages = images.filter(({ id }) => ids.has(id));
    if (selectedImages.length !== ids.size) throw new Error('Selected screen is not observed');
    tokens = tokens.filter(({ evidence }) => evidence.some((id) => ids.has(id)));
    components = components.flatMap((component) => {
      const variants = component.variants.filter(({ evidence }) => evidence.some((id) => ids.has(id)));
      return variants.length ? [{ ...component, variants }] : [];
    });
  } else if (scope.kind === 'selected') {
    const componentIds = new Set(scope.componentIds);
    const screenIds = new Set(scope.screenIds);
    components = components.filter(({ id }) => componentIds.has(id));
    if (components.length !== componentIds.size) throw new Error('Selected component is not observed');
    selectedImages = images.filter(({ id }) => screenIds.has(id) || components.some((component) => evidenceForComponent(component).includes(id)));
    tokens = tokens.filter(({ evidence }) => evidence.some((id) => screenIds.has(id)));
  }
  if ((scope.kind === 'foundation-category' && !tokens.length) || (scope.kind === 'screens' && !selectedImages.length)) {
    throw new Error('Selected export scope is not observed');
  }
  return { ...snapshot, tokens, components, images: selectedImages };
}

const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'token';
const pascal = (value: string) => value.replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, character: string) => character.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '') || 'ObservedComponent';

function css(snapshot: ReturnType<typeof scopeSnapshot>): string {
  return `/* Astryx observed design tokens for ${snapshot.app}. Evidence is retained in the JSON/component-spec exports. */\n:root {\n${snapshot.tokens.map((token) => `  --${slug(snapshot.app)}-${slug(token.name)}: ${token.value};`).join('\n')}\n}\n`;
}

function tailwind(snapshot: ReturnType<typeof scopeSnapshot>): string {
  const buckets: Record<string, Record<string, string>> = {};
  const names: Record<TokenKind, string> = { color: 'colors', typography: 'fontFamily', spacing: 'spacing', radius: 'borderRadius', border: 'borderWidth', effect: 'boxShadow' };
  for (const token of snapshot.tokens) (buckets[names[token.kind]] ??= {})[slug(token.name)] = token.value;
  return `export default ${JSON.stringify({ theme: { extend: buckets } }, null, 2)};\n`;
}

function componentSpecs(snapshot: ReturnType<typeof scopeSnapshot>): string {
  return JSON.stringify({
    app: snapshot.app,
    generatedAt: snapshot.generatedAt,
    components: snapshot.components,
    rules: snapshot.rules || [],
    sourceScreens: snapshot.images.map(({ id, description }) => ({ id, description })),
  }, null, 2);
}

// Mirrors what figmaCode() already does with the same reconstruction spec, just as a
// React inline-style object literal instead of Figma node properties.
function reconstructionStyleLiteral(r: ComponentVariant['reconstruction']): string {
  if (!r) return '{}';
  const entries: string[] = [];
  if (r.layoutMode) {
    entries.push(`display: 'flex'`, `flexDirection: ${JSON.stringify(r.layoutMode === 'HORIZONTAL' ? 'row' : 'column')}`);
  }
  if (Number.isFinite(r.gap)) entries.push(`gap: ${r.gap}`);
  if (Number.isFinite(r.padding)) entries.push(`padding: ${r.padding}`);
  if (Number.isFinite(r.width) && r.width! > 0) entries.push(`width: ${r.width}`);
  if (Number.isFinite(r.height) && r.height! > 0) entries.push(`height: ${r.height}`);
  if (r.fill) entries.push(`background: ${JSON.stringify(r.fill)}`);
  if (r.stroke) entries.push(`border: ${JSON.stringify(`1px solid ${r.stroke}`)}`);
  if (Number.isFinite(r.radius)) entries.push(`borderRadius: ${r.radius}`);
  return entries.length ? `{ ${entries.join(', ')} }` : '{}';
}

function react(snapshot: ReturnType<typeof scopeSnapshot>): string {
  const bodies = snapshot.components.map((component) => {
    const name = pascal(component.name);
    const states = component.variants.map(({ name: variant }) => JSON.stringify(variant)).join(' | ') || 'never';
    const styles = component.variants
      .map((variant) => `  ${JSON.stringify(variant.name)}: ${reconstructionStyleLiteral(variant.reconstruction)}`)
      .join(',\n');
    const labelled = component.variants.filter((variant) => variant.reconstruction?.visibleText);
    const labels = labelled
      .map((variant) => `  ${JSON.stringify(variant.name)}: ${JSON.stringify(variant.reconstruction!.visibleText)}`)
      .join(',\n');
    const fallback = labelled.length ? `${name}Labels[observedVariant]` : 'null';
    return `const ${name}Styles: Record<${states || 'string'}, CSSProperties> = {\n${styles}\n};\n${
      labelled.length ? `const ${name}Labels: Partial<Record<${states || 'string'}, string>> = {\n${labels}\n};\n` : ''
    }\n/** ${component.description.replace(/\*\//g, '* /')} Evidence: ${evidenceForComponent(component).join(', ')} */\nexport interface ${name}Props {\n  observedVariant: ${states};\n  children?: ReactNode;\n}\n\nexport function ${name}({ observedVariant, children }: ${name}Props) {\n  return (\n    <div data-astryx-component=${JSON.stringify(component.id)} data-observed-variant={observedVariant} style={${name}Styles[observedVariant]}>\n      {children ?? ${fallback}}\n    </div>\n  );\n}`;
  });
  return `import type { CSSProperties, ReactNode } from 'react';\nimport './${slug(snapshot.app)}-tokens.css';\n\n${bodies.join('\n\n')}\n`;
}

function designMd(snapshot: ReturnType<typeof scopeSnapshot>): string {
  const byKind = (kind: TokenKind): DesignToken[] => snapshot.tokens.filter((token) => token.kind === kind);
  const yamlBlock = (label: string, tokens: DesignToken[]) => tokens.length
    ? `${label}:\n${tokens.map((token) => `  ${slug(token.name)}: ${JSON.stringify(token.value)} # ${token.role}`).join('\n')}\n`
    : '';
  const frontmatter = [
    `version: alpha`,
    `name: ${JSON.stringify(`${slug(snapshot.app)}-design-analysis`)}`,
    `description: ${JSON.stringify(`Design system observed by Astryx across ${snapshot.images.length} evidence screen(s) of ${snapshot.app}.`)}`,
    '',
    yamlBlock('colors', byKind('color')),
    yamlBlock('typography', byKind('typography')),
    yamlBlock('spacing', byKind('spacing')),
    yamlBlock('rounded', byKind('radius')),
    yamlBlock('borders', byKind('border')),
    yamlBlock('effects', byKind('effect')),
  ].filter(Boolean).join('\n');

  const components = snapshot.components.map((component) => {
    const variants = component.variants.map((variant) => {
      const r = variant.reconstruction;
      const props = r ? Object.entries({ layout: r.layoutMode, width: r.width, height: r.height, padding: r.padding, gap: r.gap, fill: r.fill, stroke: r.stroke, radius: r.radius })
        .filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`).join(', ') : '';
      return `- **${variant.name}** — ${variant.description}${props ? ` (${props})` : ''}`;
    }).join('\n');
    const anatomy = component.anatomy?.length ? `\nAnatomy: ${component.anatomy.join(', ')}\n` : '';
    return `### ${component.name} (${component.category})\n${component.description}\n${anatomy}\n${variants}`;
  }).join('\n\n');

  const rulesByKind = new Map<string, string[]>();
  for (const rule of snapshot.rules || []) {
    const items = rulesByKind.get(rule.kind) ?? [];
    items.push(`- **${rule.name}**: ${rule.description}`);
    rulesByKind.set(rule.kind, items);
  }
  const patterns = [...rulesByKind.entries()]
    .map(([kind, items]) => `### ${kind[0].toUpperCase()}${kind.slice(1)}\n${items.join('\n')}`)
    .join('\n\n');

  const promptGuide = byKind('color').map((token) => `- ${token.name}: \`${token.value}\` — ${token.role}`).join('\n');

  return `---\n${frontmatter}---\n\n` +
    `## Overview\n\nObserved across ${snapshot.images.length} evidence screen(s) of **${snapshot.app}**, generated ${snapshot.generatedAt}.\n\n` +
    `## Components\n\n${components || '_No components observed in this scope._'}\n\n` +
    `## Patterns\n\n${patterns || '_No rules observed in this scope._'}\n\n` +
    `## Agent Prompt Guide\n\nWhen building UI for ${snapshot.app}, reference these observed colors:\n\n${promptGuide || '_No color tokens observed in this scope._'}\n`;
}

// PM-facing product flow documentation. Renders the app's observed flows as an
// ordered, evidence-cited journey doc (a "PRD reference") from the same snapshot
// the design exports use — no new data, just a reader-first view of snapshot.flows.
function flowMd(snapshot: ReturnType<typeof scopeSnapshot>): string {
  const screenName = new Map(snapshot.images.map(({ id, description }) => [id, description]));
  const evidence = (ids: number[]): string =>
    ids.map((id) => screenName.get(id) || `screen #${id}`).join('; ');
  const flows = snapshot.flows;

  const frontmatter = [
    `title: ${JSON.stringify(`${snapshot.app} product flows`)}`,
    `description: ${JSON.stringify(`${flows.length} observed user flow(s) across ${snapshot.app}, documented by Astryx from ${snapshot.images.length} evidence screen(s).`)}`,
    `app: ${JSON.stringify(snapshot.app)}`,
    `flows: ${flows.length}`,
    `generated: ${JSON.stringify(snapshot.generatedAt)}`,
  ].join('\n');

  const index = flows.length
    ? flows.map((flow, i) => `${i + 1}. [${flow.title}](#${slug(flow.title)})${flow.category ? ` — _${flow.category}_` : ''} · ${flow.steps.length} step(s)`).join('\n')
    : '_No flows observed in this scope._';

  const sections = flows.map((flow) => {
    const meta = [...new Map([flow.category, ...(flow.tags || [])].filter(Boolean).map((v) => [v!.toLowerCase(), v!])).values()].join(' · ');
    const p = flow.provenance;
    const status = p
      ? `> **Status:** ${p.validationStatus} · confidence ${Math.round(p.confidence * 100)}%${p.sourceUrls[0] ? ` · [source](${p.sourceUrls[0]})` : ''}\n\n`
      : '';
    const steps = flow.steps.length
      ? flow.steps.map((step, i) => {
          const interaction = step.interaction ? ` — ${step.interaction}` : '';
          const seen = evidence(step.evidence);
          return `${i + 1}. **${step.label}**${interaction}${seen ? `  \n   _Seen on: ${seen}_` : ''}`;
        }).join('\n')
      : '_No steps recorded._';
    return `## ${flow.title}\n${meta ? `_${meta}_\n\n` : ''}${status}${flow.description || ''}\n\n**User journey**\n\n${steps}`;
  }).join('\n\n');

  return `---\n${frontmatter}\n---\n\n` +
    `# ${snapshot.app} — Product Flows\n\n` +
    `> ${flows.length} user journey(s) reconstructed by Astryx from observed evidence. Every step cites the screen(s) it was seen on.\n\n` +
    `## Flow index\n\n${index}\n\n${sections}\n`;
}

function figmaCode(snapshot: ReturnType<typeof scopeSnapshot>): string {
  const data = JSON.stringify({
    app: snapshot.app,
    tokens: snapshot.tokens,
    components: snapshot.components,
    images: snapshot.images.map(({ id, image_url, description, imageData }) => ({ id, imageUrl: image_url, description, imageData })),
  });
  return `const data = ${data};
const safe = value => value.replace(/[^a-zA-Z0-9 _/-]/g, '').trim() || 'Observed item';
const rgba = value => { const hex = value.replace('#', ''); if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return null; return { r: parseInt(hex.slice(0,2),16)/255, g: parseInt(hex.slice(2,4),16)/255, b: parseInt(hex.slice(4,6),16)/255, a: hex.length === 8 ? parseInt(hex.slice(6,8),16)/255 : 1 }; };
async function label(text, size = 12) { const node = figma.createText(); node.fontName = { family: 'Inter', style: 'Regular' }; node.fontSize = size; node.characters = text; return node; }
async function main() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  const page = figma.createPage(); page.name = safe(data.app) + ' · Astryx observed library'; await figma.setCurrentPageAsync(page);
  const foundations = figma.createFrame(); foundations.name = 'Foundations'; foundations.layoutMode = "VERTICAL"; foundations.itemSpacing = 16; foundations.paddingTop = foundations.paddingRight = foundations.paddingBottom = foundations.paddingLeft = 24; foundations.primaryAxisSizingMode = 'AUTO'; foundations.counterAxisSizingMode = 'AUTO'; page.appendChild(foundations);
  const collections = new Map();
  for (const token of data.tokens) {
    let collection = collections.get(token.kind); if (!collection) { collection = figma.variables.createVariableCollection(safe(token.kind)); collections.set(token.kind, collection); }
    const color = token.kind === 'color' ? rgba(token.value) : null; const numeric = /^(spacing|radius)$/.test(token.kind) && /^-?\\d+(\\.\\d+)?px$/.test(token.value);
    const type = color ? 'COLOR' : numeric ? 'FLOAT' : 'STRING'; const variable = figma.variables.createVariable(safe(token.name), collection, type);
    variable.description = token.role + ' · Evidence screens: ' + token.evidence.join(', '); variable.setValueForMode(collection.defaultModeId, color || (numeric ? Number.parseFloat(token.value) : token.value));
    if (token.kind === 'typography') { const style = figma.createTextStyle(); style.name = safe(token.name); style.description = token.value + ' · ' + variable.description; }
    if (token.kind === 'effect') { const style = figma.createEffectStyle(); style.name = safe(token.name); style.description = token.value + ' · ' + variable.description; }
    foundations.appendChild(await label(token.name + ': ' + token.value + ' — ' + token.role));
  }
  const library = figma.createFrame(); library.name = 'Observed components'; library.layoutMode = "VERTICAL"; library.itemSpacing = 32; library.paddingTop = library.paddingRight = library.paddingBottom = library.paddingLeft = 24; library.primaryAxisSizingMode = 'AUTO'; library.counterAxisSizingMode = 'AUTO'; page.appendChild(library); library.x = foundations.width + 80;
  for (const component of data.components) {
    const variants = [];
    for (const variant of component.variants) {
      const node = figma.createComponent(); node.name = 'Variant=' + safe(variant.name); node.description = variant.description + ' · Evidence screens: ' + variant.evidence.join(', '); node.layoutMode = "VERTICAL"; node.itemSpacing = 8; node.paddingTop = node.paddingRight = node.paddingBottom = node.paddingLeft = 16; node.primaryAxisSizingMode = 'AUTO'; node.counterAxisSizingMode = 'AUTO';
      const spec = variant.reconstruction; if (spec) { if (spec.layoutMode) node.layoutMode = spec.layoutMode; if (Number.isFinite(spec.gap)) node.itemSpacing = spec.gap; if (Number.isFinite(spec.padding)) node.paddingTop = node.paddingRight = node.paddingBottom = node.paddingLeft = spec.padding; if (spec.width > 0 && spec.height > 0) node.resize(spec.width, spec.height); if (Number.isFinite(spec.radius)) node.cornerRadius = spec.radius; const fill = spec.fill ? rgba(spec.fill) : null; if (fill) node.fills = [{ type: 'SOLID', color: { r: fill.r, g: fill.g, b: fill.b }, opacity: fill.a }]; const stroke = spec.stroke ? rgba(spec.stroke) : null; if (stroke) node.strokes = [{ type: 'SOLID', color: { r: stroke.r, g: stroke.g, b: stroke.b }, opacity: stroke.a }]; }
      node.appendChild(await label((spec && spec.visibleText) || component.name, 16)); node.appendChild(await label(variant.name + ' — observed variant')); node.appendChild(await label(variant.description)); if (component.anatomy && component.anatomy.length) node.appendChild(await label('Anatomy: ' + component.anatomy.join(', '))); if (component.associatedTokenIds && component.associatedTokenIds.length) node.appendChild(await label('Tokens: ' + component.associatedTokenIds.join(', '))); node.appendChild(await label('Evidence screens: ' + variant.evidence.join(', '))); variants.push(node);
    }
    const published = variants.length > 1 ? figma.combineAsVariants(variants, library) : variants[0]; if (published) { published.name = safe(component.name); library.appendChild(published); }
  }
  const patterns = figma.createFrame(); patterns.name = 'Observed layout, responsive, content and interaction patterns'; patterns.layoutMode = "VERTICAL"; patterns.itemSpacing = 10; patterns.paddingTop = patterns.paddingRight = patterns.paddingBottom = patterns.paddingLeft = 24; patterns.primaryAxisSizingMode = 'AUTO'; patterns.counterAxisSizingMode = 'AUTO'; page.appendChild(patterns); patterns.y = foundations.height + 80;
  for (const rule of data.rules) { const row = figma.createFrame(); row.name = safe(rule.kind + ' · ' + rule.name); row.layoutMode = "VERTICAL"; row.itemSpacing = 5; row.paddingTop = row.paddingRight = row.paddingBottom = row.paddingLeft = 12; row.primaryAxisSizingMode = 'AUTO'; row.counterAxisSizingMode = 'AUTO'; row.appendChild(await label(rule.name + ' · ' + rule.kind, 14)); row.appendChild(await label(rule.description)); row.appendChild(await label('Evidence screens: ' + rule.evidence.join(', '))); patterns.appendChild(row); }
  const references = figma.createFrame(); references.name = 'Source references'; references.layoutMode = "VERTICAL"; references.itemSpacing = 12; references.paddingTop = references.paddingRight = references.paddingBottom = references.paddingLeft = 24; references.primaryAxisSizingMode = 'AUTO'; references.counterAxisSizingMode = 'AUTO'; page.appendChild(references); references.x = library.x + library.width + 80;
  for (const ref of data.images) { const frame = figma.createFrame(); frame.name = 'Evidence screen ' + ref.id; frame.layoutMode = "VERTICAL"; frame.itemSpacing = 6; frame.paddingTop = frame.paddingRight = frame.paddingBottom = frame.paddingLeft = 12; frame.primaryAxisSizingMode = 'AUTO'; frame.counterAxisSizingMode = 'AUTO'; frame.appendChild(await label('Evidence screen ' + ref.id, 14)); frame.appendChild(await label(ref.description || 'Captured source screen')); if (ref.imageData) { try { const bytes = Uint8Array.from(atob(ref.imageData), char => char.charCodeAt(0)); const image = figma.createImage(bytes); const preview = figma.createRectangle(); preview.name = 'Captured source'; preview.resize(960, 600); preview.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FIT' }]; frame.appendChild(preview); } catch (_) { frame.appendChild(await label('Image could not be embedded')); } } frame.appendChild(await label(ref.imageUrl)); references.appendChild(frame); }
  figma.viewport.scrollAndZoomIntoView([foundations, library, patterns, references]); figma.closePlugin('Astryx editable library created from observed evidence.');
}
main().catch(error => figma.closePlugin('Export failed: ' + error.message));
`;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ name: string; content: string | Buffer }>): Buffer {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name); const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content); const crc = crc32(content);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(content.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(name.length, 26);
    locals.push(local, name, content);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(content.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, name); offset += local.length + name.length + content.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function buildExportArtifact(
  snapshot: DesignSystemSnapshot,
  images: ExportImage[],
  format: ExportFormat,
  scope: ExportScope,
): ExportArtifact {
  const scoped = scopeSnapshot(snapshot, images, scope); const app = slug(snapshot.app);
  const evidenceBacked = hasEvidence(scoped);
  if (format === 'figma') {
    const manifest = JSON.stringify({ name: `${snapshot.app} · Astryx ${evidenceBacked ? 'observed library' : 'design system'}`, id: 'REPLACE_WITH_FIGMA_ASSIGNED_PLUGIN_ID', api: '1.0.0', main: 'code.js', documentAccess: 'dynamic-page', editorType: ['figma'], networkAccess: { allowedDomains: ['none'] } }, null, 2);
    const readme = evidenceBacked
      ? `Figma assigns every development plugin its ID. In Figma, create a new development plugin, keep the generated manifest (and its assigned id), replace its code.js with this bundle's code.js, then run the plugin in a blank design file. The included manifest.json is a template if you prefer to copy the assigned id into it and import it.\n\nEvery generated variable, style, component variant, and reference is backed by the evidence IDs stored in this export. No missing states are generated.\n`
      : `Figma assigns every development plugin its ID. In Figma, create a new development plugin, keep the generated manifest (and its assigned id), replace its code.js with this bundle's code.js, then run the plugin in a blank design file. The included manifest.json is a template if you prefer to copy the assigned id into it and import it.\n\nThis bundle creates the imported Astryx design system as editable variables, styles, components, and rules.\n`;
    const code = evidenceBacked ? figmaCode(scoped) : evidenceNeutral(figmaCode(scoped), scoped);
    return { filename: `${app}-figma-library.zip`, mime: 'application/zip', content: zip([{ name: 'manifest.json', content: manifest }, { name: 'code.js', content: code }, { name: 'README.md', content: readme }]) };
  }
  const json = { ...scoped, images: scoped.images.map(({ id, description }) => ({ id, description })) };
  const outputs: Record<Exclude<ExportFormat, 'figma'>, { suffix: string; mime: string; content: string }> = {
    json: { suffix: 'tokens.json', mime: 'application/json', content: JSON.stringify(json, null, 2) },
    css: { suffix: 'tokens.css', mime: 'text/css', content: css(scoped) },
    tailwind: { suffix: 'tailwind.config.js', mime: 'text/javascript', content: tailwind(scoped) },
    'component-spec': { suffix: 'component-spec.json', mime: 'application/json', content: componentSpecs(scoped) },
    react: { suffix: 'components.tsx', mime: 'text/typescript', content: react(scoped) },
    'design-md': { suffix: 'DESIGN.md', mime: 'text/markdown', content: designMd(scoped) },
    'flow-md': { suffix: 'FLOW.md', mime: 'text/markdown', content: flowMd(scoped) },
  };
  const output = outputs[format];
  const content = evidenceBacked ? output.content : evidenceNeutral(output.content, scoped);
  return { filename: `${app}-${output.suffix}`, mime: output.mime, content: Buffer.from(content) };
}
