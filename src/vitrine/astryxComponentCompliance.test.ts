import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const vitrineRoot = dirname(fileURLToPath(import.meta.url));
const nativeTags = new Set(['button', 'input', 'textarea', 'select']);

const allowedNativeControls = {} as const;

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory()
      ? productionTsxFiles(resolve(directory, entry.name))
      : [resolve(directory, entry.name)])
    .filter((file) => file.endsWith('.tsx') && !file.includes('.test.') && !file.includes('.stories.'))
    .sort();
}

function controlsIn(file: string): Record<string, number> {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const counts: Record<string, number> = {};
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (nativeTags.has(tag)) counts[tag] = (counts[tag] ?? 0) + 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return counts;
}

test('Vitrines native interactive controls match the shrinking Astryx migration baseline', () => {
  const actual = Object.fromEntries(
    productionTsxFiles(vitrineRoot)
      .map((file) => [relative(vitrineRoot, file), controlsIn(file)] as const)
      .filter(([, counts]) => Object.keys(counts).length > 0),
  );
  assert.deepEqual(actual, allowedNativeControls);
});

test('every native-control baseline entry names an existing production file', () => {
  for (const file of Object.keys(allowedNativeControls)) {
    assert.equal(existsSync(resolve(vitrineRoot, file)), true, `${file} does not exist`);
  }
});

test('primary buttons rely on their shared foreground treatment', () => {
  const offenders: string[] = [];
  for (const file of productionTsxFiles(vitrineRoot)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node): void => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && node.tagName.getText(source) === 'Button') {
        const markup = node.getText(source);
        if (/\bprimary\b/.test(markup) && /\bcolor\s*:/.test(markup)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          offenders.push(`${relative(vitrineRoot, file)}:${line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(offenders, []);
});
