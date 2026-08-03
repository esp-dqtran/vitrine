import { normalizeWebsiteDescription } from "./appWebsiteDescription.ts";

const STORE_BOILERPLATE = [
  /\b(?:bug fixes|improved stability|performance improvements|what(?:'|’)s new)\b/i,
  /\bthe developer\b.*\bprivacy practices\b/i,
  /\b(?:privacy policy|terms of (?:use|service)|subscription automatically renews)\b/i,
  /\b(?:download|install|update) (?:the|this|our) app\b/i,
  /\b(?:free for \d+ days?|cancel anytime|annual percentage yield|now available)\b/i,
  /\bI never write app reviews?\b/i,
  /\b(?:does not provide|consult a (?:tax|legal|medical) professional)\b/i,
  /\b(?:availability and terms|subject to .+ restrictions?|benefits? .+ described below)\b/i,
  /\b(?:ride responsibly|safety guidance|in-app purchases?)\b/i,
  /\d+(?:\.\d+)?%/,
  /^\s*\d+[.)]\s+/,
  /^(?:features?|about this app|description|updates?)(?::|$)/i,
];

function decodeHtml(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_match, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([\da-f]+);/gi, (_match, digits: string) => String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => namedEntities[name.toLowerCase()] ?? match);
}

function eligible(value: string): string | null {
  if (STORE_BOILERPLATE.some((pattern) => pattern.test(value))) return null;
  return normalizeWebsiteDescription(value);
}

function compactEligible(value: string): string | null {
  const direct = eligible(value);
  if (direct) return direct;
  if (STORE_BOILERPLATE.some((pattern) => pattern.test(value))) return null;
  const text = value.replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 40 && text.length <= 260) return null;
  for (const match of text.matchAll(/[,;:—–](?=\s)/g)) {
    const clause = `${text.slice(0, match.index).trim().replace(/[.!?]+$/, "")}.`;
    const normalized = eligible(clause);
    if (normalized) return normalized;
  }
  const shortened = `${words.slice(0, 32).join(" ").replace(/[,:;—–.!?]+$/, "")}.`;
  return eligible(shortened);
}

function candidateScore(description: string, appName: string, position: number): number {
  const lower = description.toLocaleLowerCase();
  const identity = appName.trim().toLocaleLowerCase();
  const words = description.split(/\s+/).length;
  const identityScore = identity && lower.includes(identity) ? 18 : 0;
  const productScore = /\b(?:app|platform|service|tool|marketplace|coach|tracker|wallet|helps|lets|provides|connects|manages|tracks|creates|supports|makes)\b/i
    .test(description) ? 24 : 0;
  const usefulLengthScore = words >= 12 && words <= 32 ? 12 : 0;
  const completeSentenceScore = /[.!?]$/.test(description) ? 4 : 0;
  const promotionalPenalty = /\b(?:welcome|ultimate|award-winning|#1|best|try|today)\b/i.test(description)
    ? 12
    : 0;
  return identityScore + productScore + usefulLengthScore + completeSentenceScore
    - promotionalPenalty - position * 10;
}

export function chooseAppStoreDescription(value: string, appName = ""): string | null {
  const decoded = decodeHtml(value).replace(/\r/g, "\n");
  const paragraphs = decoded
    .split(/\n{2,}|\n(?=[A-Z][A-Z\s&/-]{2,}:?\s*$)/m)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const candidates: Array<{ description: string; score: number }> = [];
  const seen = new Set<string>();
  const addCandidate = (raw: string, position: number) => {
    const description = compactEligible(raw);
    if (!description) return;
    const key = description.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ description, score: candidateScore(description, appName, position) });
  };

  for (const [paragraphIndex, paragraph] of paragraphs.slice(0, 8).entries()) {
    if (
      paragraph.length <= 300
      && STORE_BOILERPLATE.some((pattern) => pattern.test(paragraph))
    ) continue;
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];
    for (let index = 0; index < Math.min(sentences.length, 4); index += 1) {
      const position = paragraphIndex * 4 + index;
      addCandidate(sentences[index], position);
      addCandidate(`${sentences[index]} ${sentences[index + 1] ?? ""}`.trim(), position);
    }
    addCandidate(paragraph, paragraphIndex * 4);
  }
  addCandidate(paragraphs.slice(0, 2).join(" "), 1);
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.description ?? null;
}

export function appleStoreId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname !== "apps.apple.com" && url.hostname !== "itunes.apple.com") return null;
    return url.pathname.match(/\/id(\d{5,})(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function appleStoreCountry(value: string): string {
  try {
    const segment = new URL(value).pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    return segment && /^[a-z]{2}$/.test(segment) ? segment : "us";
  } catch {
    return "us";
  }
}

export function googlePlayId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname !== "play.google.com") return null;
    return url.searchParams.get("id")?.trim() || null;
  } catch {
    return null;
  }
}
