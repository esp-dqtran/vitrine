interface UsageRule {
  kind: string;
  name: string;
  description?: string;
  evidence?: readonly unknown[];
}

const ACTIONABLE_HEADING = /(?:^|\b)(?:principles?|layout|spacing(?: system)?|grid(?:\s*&\s*container)?|whitespace(?: philosophy)?|do(?:'s)?\s+and\s+don'?ts?|do|don'?t|responsive(?: behaviou?r)?|breakpoints?|mobile(?: behaviou?r|guidelines?)?|touch targets?|collapsing strategy|image behaviou?r|photography\s*&\s*iconography|iteration guide|accessibility|motion(?: guidelines?|principles?)?|interaction (?:guidelines?|patterns?|behaviou?r|states?)|content (?:guidelines?|principles?|style)|voice\s*(?:&|and)\s*tone|copy(?:writing)? guidelines?|best practices?)(?:\b|$)/i;

export function isActionableUsageRule(rule: UsageRule): boolean {
  if ((rule.evidence?.length ?? 0) > 0) return true;
  const description = rule.description?.replace(/\s+/g, " ").trim() ?? "";
  if (description.length < 24 || description.toLowerCase() === rule.name.replace(/\s+/g, " ").trim().toLowerCase()) return false;
  return ACTIONABLE_HEADING.test(rule.name);
}

export function usagePatternSummary(description: string, maxLength = 180): string {
  const lines = description.split("\n").map((line) => line.trim()).filter(Boolean);
  const dividerIndex = lines.findIndex((line) => /^\|?\s*:?-{3,}/.test(line));
  const tableLine = dividerIndex >= 0 ? lines.slice(dividerIndex + 1).find((line) => line.includes("|")) : undefined;
  const source = tableLine
    ? tableLine.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()).filter(Boolean).join(" — ")
    : lines[0] ?? "";
  const normalized = source
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/(?:\*\*|__|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) return normalized;

  const firstSentence = normalized.match(/^.*?[.!?](?=\s|$)/)?.[0];
  if (firstSentence && firstSentence.length <= maxLength) return firstSentence;

  const clipped = normalized.slice(0, maxLength + 1);
  const wordBoundary = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, wordBoundary > maxLength * 0.65 ? wordBoundary : maxLength).trimEnd()}…`;
}
