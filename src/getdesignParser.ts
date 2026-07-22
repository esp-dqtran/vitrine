import { parseDocument } from "yaml";
import type {
  DesignComponent,
  DesignSystemSnapshot,
  DesignToken,
  TokenKind,
} from "./designSystem.ts";

type JsonObject = Record<string, unknown>;

const tokenKinds = new Set<TokenKind>(["color", "typography", "spacing", "radius", "border", "effect"]);
const stateSuffix = /-(hover|pressed|focus|focused|active|selected|disabled|default|inverse|featured)$/i;

const slug = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "") || "item";

const title = (value: string) => value
  .replace(/[-_]+/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const object = (value: unknown): JsonObject | undefined => (
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined
);

const scalar = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
};

function normalizeFrontmatter(source: string): string {
  return source.split("\n").map((line) => {
    if (/^description:\s+[^|>"']/.test(line)) {
      return `description: ${JSON.stringify(line.slice(line.indexOf(":") + 1).trim())}`;
    }
    if (/^属于:/.test(line)) return "";
    return line;
  }).join("\n");
}

export function splitGetDesignDocument(markdown: string): { frontmatter?: JsonObject; body: string } {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!match) return { body: normalized };
  const document = parseDocument(normalizeFrontmatter(match[1]), { maxAliasCount: 0, schema: "core" });
  if (document.errors.length) throw new Error(`Invalid GetDesign frontmatter: ${document.errors[0].message}`);
  const frontmatter = document.toJS({ maxAliasCount: 0 });
  if (!object(frontmatter)) throw new Error("GetDesign frontmatter must be an object");
  return { frontmatter, body: match[2] };
}

function flatten(value: unknown, prefix = ""): Array<{ path: string; value: string }> {
  const direct = scalar(value);
  if (direct !== undefined) return [{ path: prefix, value: direct }];
  const record = object(value);
  if (!record) return [];
  return Object.entries(record).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}

function typographyValue(value: unknown): string {
  const record = object(value);
  if (!record) return scalar(value) ?? "";
  const cssNames: Record<string, string> = {
    fontFamily: "font-family", fontSize: "font-size", fontWeight: "font-weight",
    lineHeight: "line-height", letterSpacing: "letter-spacing", textTransform: "text-transform",
  };
  return Object.entries(record).map(([key, item]) => {
    const rendered = scalar(item);
    return rendered === undefined ? "" : `${cssNames[key] ?? key}: ${rendered}`;
  }).filter(Boolean).join("; ");
}

function structuredTokens(frontmatter: JsonObject): { tokens: DesignToken[]; references: Map<string, string>; tokenIds: Map<string, string> } {
  const sections: Array<[string, TokenKind]> = [
    ["colors", "color"], ["typography", "typography"], ["rounded", "radius"],
    ["spacing", "spacing"], ["borders", "border"], ["effects", "effect"],
  ];
  const tokens: DesignToken[] = [];
  const references = new Map<string, string>();
  const tokenIds = new Map<string, string>();
  for (const [section, kind] of sections) {
    const record = object(frontmatter[section]);
    if (!record) continue;
    for (const [name, raw] of Object.entries(record)) {
      const value = kind === "typography" ? typographyValue(raw) : scalar(raw) ?? flatten(raw).map(({ value: part }) => part).join(" ");
      if (!value) continue;
      const path = `${section}.${name}`;
      const id = `${kind}-${slug(name)}`;
      references.set(path, value);
      tokenIds.set(path, id);
      tokens.push({ id, kind, name: title(name), value, role: title(name), evidence: [] });
    }
  }
  return { tokens, references, tokenIds };
}

function resolve(value: unknown, references: Map<string, string>): string | undefined {
  const rendered = scalar(value);
  if (!rendered) return undefined;
  return rendered.replace(/\{([^}]+)\}/g, (_match, path: string) => references.get(path) ?? `{${path}}`);
}

function px(value: string | undefined): number | undefined {
  const match = value?.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function structuredComponents(
  raw: unknown,
  references: Map<string, string>,
  tokenIds: Map<string, string>,
): DesignComponent[] {
  const record = object(raw);
  if (!record) return [];
  const groups = new Map<string, Array<{ state: string; properties: JsonObject }>>();
  for (const [name, value] of Object.entries(record)) {
    const properties = object(value);
    if (!properties) continue;
    const match = name.match(stateSuffix);
    const base = match ? name.slice(0, -match[0].length) : name;
    const state = match ? match[1].toLowerCase().replace("focused", "focus") : "default";
    groups.set(base, [...(groups.get(base) ?? []), { state, properties }]);
  }
  return [...groups.entries()].map(([id, entries]) => ({
    id: slug(id),
    name: title(id),
    category: "Components",
    description: `${title(id)} styling imported from the GetDesign system.`,
    associatedTokenIds: [...new Set(entries.flatMap(({ properties }) =>
      Object.values(properties).flatMap((value) => [...(scalar(value)?.matchAll(/\{([^}]+)\}/g) ?? [])]
        .map((match) => tokenIds.get(match[1])).filter((item): item is string => Boolean(item))),
    ))],
    variants: entries
      .sort((left, right) => (left.state === "default" ? -1 : right.state === "default" ? 1 : 0))
      .map(({ state, properties }) => {
        const fill = resolve(properties.backgroundColor ?? properties.background ?? properties.fill, references);
        const stroke = resolve(properties.borderColor ?? properties.border, references);
        const radius = px(resolve(properties.rounded ?? properties.borderRadius ?? properties.radius, references));
        const padding = px(resolve(properties.padding, references));
        const gap = px(resolve(properties.gap, references));
        return {
          id: `${slug(id)}-${slug(state)}`,
          name: title(state),
          description: Object.entries(properties).map(([key, value]) => `${title(key)}: ${resolve(value, references) ?? JSON.stringify(value)}`).join("; "),
          evidence: [],
          reconstruction: { fill, stroke, radius, padding, gap },
        };
      }),
  }));
}

function ruleKind(heading: string): NonNullable<DesignSystemSnapshot["rules"]>[number]["kind"] {
  const value = heading.toLowerCase();
  if (/responsive|breakpoint|mobile/.test(value)) return "responsive";
  if (/icon/.test(value)) return "icon";
  if (/image|photo|media|illustration/.test(value)) return "imagery";
  if (/content|voice|copy|tone/.test(value)) return "content";
  if (/interaction|motion|state|accessib/.test(value)) return "interaction";
  return "layout";
}

function markdownRules(markdown: string): NonNullable<DesignSystemSnapshot["rules"]> {
  const headings = [...markdown.matchAll(/^(#{2,3})\s+(.+)$/gm)];
  return headings.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    const description = markdown.slice(start, end)
      .replace(/^\s+|\s+$/g, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/\n{2,}/g, "\n")
      .slice(0, 1600);
    return {
      id: `rule-${slug(match[2])}-${index + 1}`,
      kind: ruleKind(match[2]),
      name: match[2].replace(/^\d+\.\s*/, "").trim(),
      description: description || match[2],
      evidence: [],
    };
  });
}

function legacySummary(markdown: string): string | undefined {
  const theme = /##\s+\d*\.?\s*Visual Theme[^\n]*\n+([\s\S]*?)(?=\n#{2,3}\s)/i.exec(markdown);
  const paragraph = theme?.[1].trim().split(/\n\s*\n/)[0];
  return paragraph?.replace(/\s+/g, " ");
}

function legacyTokens(markdown: string): DesignToken[] {
  const tokens: DesignToken[] = [];
  const seen = new Set<string>();
  let heading = "Foundations";
  for (const line of markdown.split("\n")) {
    const headingMatch = /^#{2,4}\s+(.+)$/.exec(line);
    if (headingMatch) heading = headingMatch[1];
    const label = /\*\*([^*]+)\*\*/.exec(line)?.[1] ?? heading;
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const value = match[1].trim();
      if (!/(?:#[0-9a-f]{3,8}\b|rgba?\(|\b\d+(?:\.\d+)?(?:px|rem|em|%)\b|font|shadow|gradient)/i.test(value)) continue;
      const context = `${heading} ${label}`.toLowerCase();
      const kind: TokenKind = /shadow|gradient/.test(context) ? "effect"
        : /border/.test(context) ? "border"
        : /radius|round|pill/.test(context) ? "radius"
        : /typograph|font|heading|body|label/.test(context) ? "typography"
        : /spacing|space|gap|padding|margin/.test(context) ? "spacing"
        : /#|rgb/.test(value) ? "color" : "spacing";
      const key = `${kind}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const name = `${label} ${tokens.filter((token) => token.kind === kind).length + 1}`;
      tokens.push({ id: `${kind}-${slug(label)}-${tokens.length + 1}`, kind, name, value, role: label, evidence: [] });
    }
  }
  return tokens;
}

function legacyComponents(markdown: string): DesignComponent[] {
  const candidates = [...markdown.matchAll(/^#{3,4}\s+(?:\d+\.?\s*)?(.+)$/gm)]
    .map((match) => match[1].trim())
    .filter((name) => /button|card|nav|input|field|modal|badge|tab|control|carousel|header|footer|menu|toast|chip|avatar|component/i.test(name));
  const names = [...new Set(candidates)];
  if (!names.length && /button/i.test(markdown)) names.push("Buttons");
  return names.slice(0, 30).map((name) => ({
    id: slug(name), name, category: "Components",
    description: `${name} guidance extracted from the GetDesign document.`,
    variants: [{ id: `${slug(name)}-default`, name: "Default", description: `Default ${name} guidance.`, evidence: [] }],
  }));
}

export function parseGetDesignMarkdown(
  markdown: string,
  app: string,
  generatedAt = new Date().toISOString(),
): DesignSystemSnapshot {
  const { frontmatter, body } = splitGetDesignDocument(markdown);
  const structured = frontmatter ? structuredTokens(frontmatter) : undefined;
  const snapshot: DesignSystemSnapshot = {
    app,
    generatedAt,
    summary: scalar(frontmatter?.description) ?? legacySummary(body),
    tokens: structured?.tokens ?? legacyTokens(body),
    components: frontmatter
      ? structuredComponents(frontmatter.components, structured!.references, structured!.tokenIds)
      : legacyComponents(body),
    flows: [],
    rules: markdownRules(body),
  };
  validateImportedSnapshot(snapshot);
  return snapshot;
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Imported snapshot has duplicate ${label} id`);
}

export function validateImportedSnapshot(snapshot: DesignSystemSnapshot): void {
  if (!snapshot.app.trim()) throw new Error("Imported snapshot app is required");
  if (!Number.isFinite(Date.parse(snapshot.generatedAt))) throw new Error("Imported snapshot generatedAt is invalid");
  if (!snapshot.tokens.length) throw new Error("Imported snapshot requires at least one design token");
  unique(snapshot.tokens.map(({ id }) => id), "token");
  unique(snapshot.components.map(({ id }) => id), "component");
  unique((snapshot.rules ?? []).map(({ id }) => id), "rule");
  for (const token of snapshot.tokens) {
    if (!tokenKinds.has(token.kind)) throw new Error(`Unsupported token kind: ${token.kind}`);
    if (token.evidence.length) throw new Error(`Imported token ${token.id} must not claim screenshot evidence`);
  }
  for (const component of snapshot.components) {
    if (!component.variants.length) throw new Error(`Imported component ${component.id} requires a variant`);
    unique(component.variants.map(({ id }) => id), `variant in ${component.id}`);
    if (component.variants.some(({ evidence }) => evidence.length)) {
      throw new Error(`Imported component ${component.id} must not claim screenshot evidence`);
    }
  }
  if ((snapshot.rules ?? []).some(({ evidence }) => evidence.length)) {
    throw new Error("Imported rules must not claim screenshot evidence");
  }
}
