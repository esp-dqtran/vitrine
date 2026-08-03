import { useMemo, useState } from 'react';
import { Button, SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import type { DesignSystemSnapshot, TokenKind } from '../../designSystem';

type Snapshot = DesignSystemSnapshot<unknown>;
type Format = 'design-md' | 'tailwind' | 'css' | 'tokens';

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

export function DesignSystemReferencePane({ snapshot, markdown }: { snapshot: Snapshot; markdown: string }) {
  const [format, setFormat] = useState<Format>('design-md');
  const [density, setDensity] = useState<'compact' | 'extended'>('extended');
  const [copied, setCopied] = useState(false);
  const content = useMemo(() => {
    if (format === 'design-md') return density === 'compact' ? compactMarkdown(snapshot) : markdown;
    if (format === 'tailwind') return tailwindTheme(snapshot);
    if (format === 'css') return cssVariables(snapshot);
    return designTokens(snapshot);
  }, [density, format, markdown, snapshot]);
  const extension = format === 'design-md' ? 'md' : format === 'tokens' ? 'json' : 'css';

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <aside className="ds-reference-pane" aria-label="Agent-ready design system reference">
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
      <div className="ds-reference-pane__toolbar">
        {format === 'design-md' ? (
          <SegmentedControl value={density} onChange={(value) => setDensity(value as 'compact' | 'extended')} label="Reference detail">
            <SegmentedControlItem value="compact" label="Compact" />
            <SegmentedControlItem value="extended" label="Extended" />
          </SegmentedControl>
        ) : <span />}
        <div>
          <Button label={copied ? 'Copied' : 'Copy'} size="sm" clickAction={copy} />
          <Button label={`.${extension}`} size="sm" clickAction={() => download(`${slug(snapshot.app)}.${extension}`, content, format === 'tokens' ? 'application/json' : 'text/plain')} />
        </div>
      </div>
      <pre className="ds-reference-pane__code"><code>{content}</code></pre>
      {snapshot.provenance?.sourceUrl ? (
        <footer>
          <span>{snapshot.provenance.attribution ?? 'External style reference'}</span>
          <a href={snapshot.provenance.sourceUrl} target="_blank" rel="noreferrer">View source</a>
        </footer>
      ) : null}
    </aside>
  );
}
