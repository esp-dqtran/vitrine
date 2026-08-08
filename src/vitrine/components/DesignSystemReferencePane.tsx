import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import type { DesignSystemSnapshot, TokenKind } from '../../designSystem';
import { useSegmentedIndicator } from './useSegmentedIndicator.ts';

type Snapshot = DesignSystemSnapshot<unknown>;
type Format = 'design-md' | 'tailwind' | 'css' | 'tokens';
export type DesignSystemReferenceSection = 'overview' | 'color' | 'typography' | 'spacing' | 'effect' | 'components' | 'usage-rules';

const REFERENCE_SECTION_LABELS: Record<DesignSystemReferenceSection, string> = {
  overview: 'Overview',
  color: 'Color palette',
  typography: 'Typography',
  spacing: 'Spacing & Borders',
  effect: 'Visual effects',
  components: 'Component gallery',
  'usage-rules': 'Usage patterns',
};

const FORMAT_LABELS: Record<Format, string> = {
  'design-md': 'DESIGN.md',
  tailwind: 'Tailwind v4',
  css: 'CSS Variables',
  tokens: 'Design Tokens',
};

function slug(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'token';
}

function variableName(kind: TokenKind, name: string): string {
  return `--${kind}-${slug(name)}`;
}

function customPropertyValue(value: string): string {
  return /[;\n\r]/.test(value) ? JSON.stringify(value) : value;
}

function compactMarkdown(snapshot: Snapshot): string {
  const lines = [`# ${snapshot.app} — Style Reference`, ''];
  if (snapshot.provenance?.northStar) lines.push(`> ${snapshot.provenance.northStar}`, '');
  if (snapshot.provenance?.theme) lines.push(`**Theme:** ${snapshot.provenance.theme}`, '');
  if (snapshot.summary) lines.push(snapshot.summary.trim(), '');
  for (const kind of ['color', 'typography', 'spacing', 'radius', 'border', 'effect'] as TokenKind[]) {
    const tokens = snapshot.tokens.filter((token) => token.kind === kind);
    if (!tokens.length) continue;
    lines.push(`## ${kind[0].toUpperCase()}${kind.slice(1)}`, '');
    for (const token of tokens) lines.push(`- **${token.name}**: \`${token.value}\` — ${token.role}`);
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

function cssVariables(snapshot: Snapshot): string {
  const lines = [':root {'];
  for (const token of snapshot.tokens) lines.push(`  ${variableName(token.kind, token.name)}: ${customPropertyValue(token.value)};`);
  lines.push('}', '');
  return lines.join('\n');
}

function tailwindTheme(snapshot: Snapshot): string {
  const lines = ['@theme {'];
  for (const token of snapshot.tokens) lines.push(`  ${variableName(token.kind, token.name)}: ${customPropertyValue(token.value)};`);
  lines.push('}', '');
  return lines.join('\n');
}

function designTokens(snapshot: Snapshot): string {
  const grouped: Record<string, Record<string, { value: string; description: string }>> = {};
  for (const token of snapshot.tokens) {
    grouped[token.kind] ??= {};
    grouped[token.kind][slug(token.name)] = { value: token.value, description: token.role };
  }
  return `${JSON.stringify({
    $schema: 'https://design-tokens.org/schema.json',
    name: snapshot.app,
    source: snapshot.provenance ?? { provider: 'vitrines' },
    tokens: grouped,
  }, null, 2)}\n`;
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sectionForMarkdownHeading(heading: string): DesignSystemReferenceSection | undefined {
  const normalized = heading.toLowerCase();
  if (normalized === 'color') return 'color';
  if (normalized === 'typography') return 'typography';
  if (['spacing', 'radius', 'border'].includes(normalized)) return 'spacing';
  if (normalized === 'effect') return 'effect';
  if (normalized === 'components') return 'components';
  if (normalized === 'usage rules') return 'usage-rules';
  return undefined;
}

export function referenceBlocks(content: string, format: Format): Array<{ section: DesignSystemReferenceSection; content: string }> {
  if (format !== 'design-md') return [{ section: 'overview', content }];
  const headings = [...content.matchAll(/^## (.+)$/gm)];
  if (!headings.length) return [{ section: 'overview', content }];
  const blocks: Array<{ section: DesignSystemReferenceSection; content: string }> = [];
  const firstHeading = headings[0]!;
  if (firstHeading.index > 0) blocks.push({ section: 'overview', content: content.slice(0, firstHeading.index) });
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]!;
    const nextHeading = headings[index + 1];
    blocks.push({
      section: sectionForMarkdownHeading(heading[1]!) ?? 'overview',
      content: content.slice(heading.index, nextHeading?.index),
    });
  }
  return blocks;
}

export function DesignSystemReferencePane({
  snapshot,
  markdown,
  tokenKinds,
  summary,
  activeSection = 'overview',
}: {
  snapshot: Snapshot;
  markdown: string;
  tokenKinds?: TokenKind[];
  summary?: string;
  activeSection?: DesignSystemReferenceSection;
}) {
  const [format, setFormat] = useState<Format>('design-md');
  const [density, setDensity] = useState<'compact' | 'extended'>('extended');
  const densityRef = useSegmentedIndicator(density);
  const [copied, setCopied] = useState(false);
  const referenceSnapshot = useMemo(() => tokenKinds
    ? { ...snapshot, summary: summary ?? snapshot.summary, tokens: snapshot.tokens.filter((token) => tokenKinds.includes(token.kind)) }
    : { ...snapshot, summary: summary ?? snapshot.summary }, [snapshot, summary, tokenKinds]);
  const content = useMemo(() => {
    if (format === 'design-md') return density === 'compact' ? compactMarkdown(referenceSnapshot) : markdown;
    if (format === 'tailwind') return tailwindTheme(referenceSnapshot);
    if (format === 'css') return cssVariables(referenceSnapshot);
    return designTokens(referenceSnapshot);
  }, [density, format, markdown, referenceSnapshot]);
  const extension = format === 'design-md' ? 'md' : format === 'tokens' ? 'json' : 'css';
  const blocks = useMemo(() => referenceBlocks(content, format), [content, format]);
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (format !== 'design-md') return;
    const container = codeRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-design-system-reference-section="${activeSection}"]`);
    if (!container || !target) return;
    container.scrollTo({ top: Math.max(0, target.offsetTop - container.offsetTop - 12), behavior: 'smooth' });
  }, [activeSection, format]);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <aside className="ds-reference-pane" aria-label="Agent-ready design system reference" data-active-section={activeSection}>
      <div className="ds-reference-pane__header">
        <div className="ds-reference-pane__tabs" role="tablist" aria-label="Design system output format">
          {(Object.keys(FORMAT_LABELS) as Format[]).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={format === item}
              className={format === item ? 'is-active' : undefined}
              onClick={() => setFormat(item)}
              key={item}
            >
              {FORMAT_LABELS[item]}
            </button>
          ))}
        </div>
        {format === 'design-md' ? (
          <SegmentedControl ref={densityRef} className="ds-reference-pane__density" value={density} onChange={(value) => setDensity(value as 'compact' | 'extended')} label="Reference detail">
            <SegmentedControlItem value="compact" label="Compact" />
            <SegmentedControlItem value="extended" label="Extended" />
          </SegmentedControl>
        ) : null}
      </div>
      <div className="ds-reference-pane__toolbar">
        <div>
          <Button className="ds-reference-pane__copy" label={copied ? 'Copied' : 'Copy'} size="sm" clickAction={copy} />
          <Button label={`.${extension}`} size="sm" clickAction={() => download(`${slug(snapshot.app)}.${extension}`, content, format === 'tokens' ? 'application/json' : 'text/plain')} />
        </div>
      </div>
      <div className="ds-reference-pane__context" aria-live="polite">Viewing: {REFERENCE_SECTION_LABELS[activeSection]}</div>
      <pre className="ds-reference-pane__code" key={`${format}-${density}`} ref={codeRef}><code>{blocks.map((block, index) => (
        <span
          key={`${block.section}-${index}`}
          data-design-system-reference-section={block.section}
          data-active={block.section === activeSection ? 'true' : undefined}
        >
          {block.content}
        </span>
      ))}</code></pre>
      {snapshot.provenance?.sourceUrl ? (
        <footer>
          <span>{snapshot.provenance.attribution ?? 'External style reference'}</span>
          <a href={snapshot.provenance.sourceUrl} target="_blank" rel="noreferrer">View source</a>
        </footer>
      ) : null}
    </aside>
  );
}
