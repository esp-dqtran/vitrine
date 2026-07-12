import type { DesignComponent, DesignSystemSnapshot } from './designSystem.ts';

export type CuratorAction =
  | { type: 'rename'; kind: 'token' | 'component' | 'variant' | 'rule' | 'flow'; id: string; name: string; componentId?: string }
  | { type: 'reject'; kind: 'token' | 'component' | 'variant' | 'rule' | 'flow'; id: string; componentId?: string }
  | { type: 'merge-components'; ids: string[]; targetId: string; name: string }
  | { type: 'split-component'; id: string; variantIds: string[]; newId: string; name: string };

function required(value: string, label: string): string {
  const result = value.trim(); if (!result) throw new Error(`${label} is required`); return result;
}

export function applyCuratorAction(snapshot: DesignSystemSnapshot, action: CuratorAction): DesignSystemSnapshot {
  const next = structuredClone(snapshot);
  if (action.type === 'rename') {
    const name = required(action.name, 'name');
    if (action.kind === 'token') { const item = next.tokens.find(({ id }) => id === action.id); if (!item) throw new Error('token not found'); item.name = name; item.reviewStatus = 'reviewed'; }
    else if (action.kind === 'component') { const item = next.components.find(({ id }) => id === action.id); if (!item) throw new Error('component not found'); item.name = name; }
    else if (action.kind === 'variant') { const item = next.components.find(({ id }) => id === action.componentId)?.variants.find(({ id }) => id === action.id); if (!item) throw new Error('variant not found'); item.name = name; item.reviewStatus = 'reviewed'; }
    else if (action.kind === 'rule') { const item = next.rules?.find(({ id }) => id === action.id); if (!item) throw new Error('rule not found'); item.name = name; item.reviewStatus = 'reviewed'; }
    else { const item = next.flows.find(({ id }) => id === action.id); if (!item) throw new Error('flow not found'); item.title = name; }
    return next;
  }
  if (action.type === 'reject') {
    if (action.kind === 'token') next.tokens = next.tokens.filter(({ id }) => id !== action.id);
    else if (action.kind === 'component') next.components = next.components.filter(({ id }) => id !== action.id);
    else if (action.kind === 'variant') next.components = next.components.flatMap((component) => {
      if (component.id !== action.componentId) return [component]; const variants = component.variants.filter(({ id }) => id !== action.id); return variants.length ? [{ ...component, variants }] : [];
    });
    else if (action.kind === 'rule') next.rules = next.rules?.filter(({ id }) => id !== action.id);
    else next.flows = next.flows.filter(({ id }) => id !== action.id);
    return next;
  }
  if (action.type === 'merge-components') {
    const ids = [...new Set(action.ids)]; if (ids.length < 2) throw new Error('merge requires at least two components');
    const sources = next.components.filter(({ id }) => ids.includes(id)); if (sources.length !== ids.length) throw new Error('component not found');
    const variants: DesignComponent['variants'] = [];
    for (const variant of sources.flatMap(({ variants: values }) => values)) {
      const existing = variants.find(({ id }) => id === variant.id);
      if (existing) existing.evidence = [...new Set([...existing.evidence, ...variant.evidence])]; else variants.push(variant);
    }
    const merged: DesignComponent = { ...sources[0], id: required(action.targetId, 'targetId'), name: required(action.name, 'name'), description: sources.map(({ description }) => description).join(' '), variants };
    const index = next.components.findIndex(({ id }) => ids.includes(id)); next.components = next.components.filter(({ id }) => !ids.includes(id)); next.components.splice(index, 0, merged); return next;
  }
  const component = next.components.find(({ id }) => id === action.id); if (!component) throw new Error('component not found');
  const selected = new Set(action.variantIds); const moving = component.variants.filter(({ id }) => selected.has(id)); const remaining = component.variants.filter(({ id }) => !selected.has(id));
  if (!moving.length || !remaining.length || moving.length !== selected.size) throw new Error('split must move observed variants and leave at least one behind');
  component.variants = remaining; const split: DesignComponent = { ...component, id: required(action.newId, 'newId'), name: required(action.name, 'name'), variants: moving };
  next.components.splice(next.components.indexOf(component) + 1, 0, split); return next;
}
