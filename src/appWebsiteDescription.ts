export type WebsiteDescriptionSource = "hero" | "body" | "metadata";

export interface WebsiteDescriptionCandidate {
  text: string;
  source: WebsiteDescriptionSource;
  position: number;
}

export interface AppWebsiteDescription {
  description: string;
  source: WebsiteDescriptionSource;
}

const BLOCKED_COPY = [
  /\b(?:accept|reject|manage) (?:all )?cookies?\b/i,
  /\bprivacy policy\b/i,
  /\bterms (?:of use|and conditions|of service)\b/i,
  /\b(?:sign in|log in|book a demo|start (?:for )?free|join (?:the )?waitlist)\b/i,
  /\b(?:subscribe|newsletter|copyright|all rights reserved)\b/i,
  /\b(?:page not found|access denied|enable javascript|checking your browser)\b/i,
  /\bpage you are looking for (?:doesn't|does not|doesn’t) exist\b/i,
  /\bhas been moved\b/i,
  /\bplease go to the .+ home page\b/i,
  /\b(?:use code|coupon|limited[- ]time|grand finale|joined|acquired by)\b/i,
  /\b(?:initializing|rest api detected|cms connected)\b/i,
  /\b(?:sign[- ]ups?|registrations?) (?:are|is) closed\b/i,
  /\bthe work continues\b/i,
  /\b(?:thanks so much for your (?:great )?review|we(?:'|’)re so happy that you love)\b/i,
  /^(?:you are|i am) (?:a|an) .*assistant\b/i,
  /\buse the available tools to\b/i,
  /\bstands with (?:ukraine|its people)\b/i,
  /\bsign up today\b/i,
  /\b(?:is not|isn't|isn’t|not) available in your country\b/i,
  /\bplease email support\b/i,
  /\b(?:security service|protect itself from online attacks|triggered the security solution|cloudflare ray id)\b/i,
  /\b(?:anubis|proof[- ]of[- ]work|hashcash)\b/i,
  /^I\s+(?:always|really|absolutely|used|love|loved|hate|tried)\b/i,
  /\bI(?:'|’)ve used (?:it|this)\b/i,
  /\bI have used (?:it|this)\b/i,
  /\bgenerally a great (?:platform|app|product)\b/i,
  /\bthis app is (?:just )?(?:a )?(?:nightmare|terrible|awful|great|amazing)\b/i,
  /(?:\d+%\s*off|[$€£]\d)/i,
  /^(?:get started|start now)\b/i,
  /^(?:home|menu|learn more|get started|contact us|about us)[.!]?$/i,
  /^(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i,
];

export function normalizeWebsiteDescription(value: string): string | null {
  let text = value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s*["“]|["”]\s*$/g, "")
    .trim();
  const sentenceEnds = [...text.matchAll(/[.!?](?=\s|$)/g)];
  if (sentenceEnds.length > 2) {
    text = text.slice(0, (sentenceEnds[1].index ?? text.length) + 1).trim();
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (text.length < 40 || text.length > 260) return null;
  if (words.length < 8 || words.length > 40) return null;
  if (BLOCKED_COPY.some((pattern) => pattern.test(text))) return null;
  if (/^(?:what|why|how|ready|looking)\b.*\?$/i.test(text)) return null;
  return text;
}

function scoreCandidate(
  candidate: WebsiteDescriptionCandidate,
  description: string,
  appName: string,
): number {
  const sourceScore = candidate.source === "hero"
    ? 100
    : candidate.source === "body"
    ? 60
    : 82;
  const lengthScore = description.length >= 60 && description.length <= 190 ? 10 : 0;
  const sentenceScore = /[.!?]$/.test(description) ? 3 : 0;
  const identityScore = description.toLocaleLowerCase().includes(appName.toLocaleLowerCase())
    ? 4
    : 0;
  const promotionalPenalty = /\b(?:best|leading|ultimate|revolutionary|record speed|world[- ]class)\b/i
    .test(description)
    ? 6
    : 0;
  return sourceScore + lengthScore + sentenceScore + identityScore
    - promotionalPenalty - Math.min(candidate.position, 20);
}

export function chooseAppWebsiteDescription(
  candidates: readonly WebsiteDescriptionCandidate[],
  appName: string,
): AppWebsiteDescription | null {
  const seen = new Set<string>();
  const eligible = candidates.flatMap((candidate) => {
    const description = normalizeWebsiteDescription(candidate.text);
    if (!description) return [];
    if (candidate.source === "body") {
      const lower = description.toLocaleLowerCase();
      const appIdentity = appName.trim().toLocaleLowerCase();
      const describesProduct = /\b(?:app|platform|software|service|tool|marketplace|workspace|website|product|helps|enables|provides|lets|builds?|manages?|tracks?|connects?)\b/i
        .test(description);
      if (appIdentity.length < 3 || !lower.includes(appIdentity) || !describesProduct) {
        return [];
      }
    }
    const key = description.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      description,
      source: candidate.source,
      score: scoreCandidate(candidate, description, appName),
    }];
  });
  eligible.sort((left, right) => right.score - left.score);
  const selected = eligible[0];
  return selected
    ? { description: selected.description, source: selected.source }
    : null;
}
