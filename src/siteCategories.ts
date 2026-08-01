export const SITE_CATEGORIES = [
  "Business",
  "Technology",
  "AI",
  "Shopping",
  "Finance",
  "Portfolio",
  "Crypto",
  "Health",
  "Lifestyle",
  "Entertainment",
  "Food",
  "Travel",
  "Social",
  "Education",
  "Other",
] as const;

export type SiteCategory = typeof SITE_CATEGORIES[number];

export interface PublicSiteCategoryInput {
  url: string;
  name: string;
  description: string;
  sourceCategory?: string;
  analysisCategory?: string;
}

const REVIEWED_AI_HOSTS = new Set([
  "base44.com",
  "bolt.new",
  "mintlify.com",
  "v7labs.com",
  "workers.cloudflare.com",
]);

// These are reviewed classifications for public pages in the Astryx catalog.
// Keeping them here makes the result stable when an existing site is recrawled.
export const PUBLIC_SITE_CATEGORY_OVERRIDES: Readonly<Record<string, SiteCategory>> = {
  "about.gitlab.com": "Technology",
  "amplitude.com": "Business",
  "aws.amazon.com": "Technology",
  "base44.com": "Technology",
  "basecamp.com": "Business",
  "bolt.new": "Technology",
  "buffer.com": "Business",
  "buymeacoffee.com": "Social",
  "canny.io": "Business",
  "chatbase.co": "Business",
  "churnkey.co": "Business",
  "classdojo.com": "Education",
  "clearbit.com": "Business",
  "cloaked.com": "Technology",
  "codecademy.com": "Education",
  "databricks.com": "Technology",
  "deputy.com": "Business",
  "dialpad.com": "Business",
  "dribbble.com": "Portfolio",
  "edu.google.com": "Education",
  "elicit.com": "Education",
  "elevenlabs.io": "Technology",
  "felt.com": "Technology",
  "flodesk.com": "Business",
  "foundation.app": "Crypto",
  "frame.io": "Business",
  "frame.so": "Business",
  "gainencore.ai": "Business",
  "gorgias.com": "Business",
  "heidihealth.com": "Health",
  "hellobonsai.com": "Business",
  "hootsuite.com": "Business",
  "hotjar.com": "Business",
  "hume.ai": "Technology",
  "june.so": "Business",
  "klaviyo.com": "Business",
  "krea.ai": "Technology",
  "langchain.com": "Technology",
  "langdock.com": "Business",
  "laravel.com": "Technology",
  "later.com": "Business",
  "lemni.com": "Business",
  "lightfield.app": "Business",
  "lindy.ai": "Business",
  "literal.club": "Social",
  "marketingplatform.google.com": "Business",
  "meliopayments.com": "Finance",
  "meridian.ai": "Finance",
  "mindtrip.ai": "Travel",
  "mintlify.com": "Technology",
  "mobbin.com": "Portfolio",
  "modal.com": "Technology",
  "n8n.io": "Technology",
  "resolve.ai": "Technology",
  "revolut.com": "Finance",
  "shortcut.ai": "Finance",
  "smallest.ai": "Technology",
  "tetta.space": "Food",
  "tinyfish.ai": "Technology",
  "usemotion.com": "Business",
  "workspace.google.com": "Business",
  "amazon.com": "Shopping",
  "arcade.software": "Business",
  "causal.app": "Finance",
  "cloudflare.com": "Technology",
  "github.com": "Technology",
  "harvey.ai": "Business",
  "v7labs.com": "Technology",
  "workers.cloudflare.com": "Technology",
};

const CATEGORY_ALIASES: Readonly<Record<string, SiteCategory>> = {
  business: "Business",
  businessapplication: "Business",
  communicationapplication: "Business",
  productivityapplication: "Business",
  developerapplication: "Technology",
  webapplication: "Technology",
  technology: "Technology",
  shopping: "Shopping",
  shoppingapplication: "Shopping",
  finance: "Finance",
  financeapplication: "Finance",
  portfolio: "Portfolio",
  crypto: "Crypto",
  health: "Health",
  healthapplication: "Health",
  lifestyle: "Lifestyle",
  entertainment: "Entertainment",
  entertainmentapplication: "Entertainment",
  food: "Food",
  travel: "Travel",
  travelapplication: "Travel",
  social: "Social",
  socialnetworkingapplication: "Social",
  education: "Education",
  educationalapplication: "Education",
  other: "Other",
};

function normalizedCategory(value: string | undefined): SiteCategory | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().replace(/[^a-z]/g, "");
  return CATEGORY_ALIASES[key];
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function hasAiSiteEvidence(input: PublicSiteCategoryInput): boolean {
  const host = hostname(input.url);
  if (host.endsWith(".ai") || REVIEWED_AI_HOSTS.has(host)) return true;
  const text = [
    input.name,
    input.description,
    input.sourceCategory ?? "",
    input.analysisCategory ?? "",
  ].join(" ").toLowerCase();
  return /\bai\b|artificial intelligence|machine learning|\bllms?\b|large language models?|generative|computer vision|neural network|foundation model/.test(text);
}

export function withAiSiteCategory(
  categories: readonly string[],
  input: PublicSiteCategoryInput,
): string[] {
  return hasAiSiteEvidence(input)
    ? [...new Set([...categories, "AI"])]
    : [...new Set(categories)];
}

export function categoryForPublicSite(input: PublicSiteCategoryInput): SiteCategory {
  const host = hostname(input.url);
  const reviewed = PUBLIC_SITE_CATEGORY_OVERRIDES[host];
  if (reviewed) return reviewed;

  const declared = normalizedCategory(input.sourceCategory);
  if (declared) return declared;
  const analyzed = normalizedCategory(input.analysisCategory);
  if (analyzed) return analyzed;

  const text = `${input.name} ${input.description}`.toLowerCase();
  if (/\b(school|classroom|teacher|student|course|learning|education|academic|research papers?)\b/.test(text)) return "Education";
  if (/\b(health|medical|clinical|clinic|patient|doctor|care provider)\b/.test(text)) return "Health";
  if (/\b(travel|trip|hotel|flight|destination|tourism)\b/.test(text)) return "Travel";
  if (/\b(restaurant|cafe|coffee shop|food|dining)\b/.test(text)) return "Food";
  if (/\b(payment|banking|financial|finance|accounting|accounts payable|accounts receivable|investment|insurance)\b/.test(text)) return "Finance";
  if (/\b(shop|shopping|marketplace|online store|e-?commerce|retail)\b/.test(text)) return "Shopping";
  if (/\b(crypto|blockchain|web3|nft|bitcoin|ethereum)\b/.test(text)) return "Crypto";
  if (/\b(portfolio|design inspiration|creative professionals?|showcase)\b/.test(text)) return "Portfolio";
  if (/\b(community|social network|connect with friends|book club)\b/.test(text)) return "Social";
  if (/\b(movie|music|game|streaming|entertainment|creator content)\b/.test(text)) return "Entertainment";
  if (/\b(crm|customer|marketing|sales|analytics|productivity|project management|employee|business|workflow|collaboration|subscription)\b/.test(text)) return "Business";
  if (/\b(api|developer|software|cloud|infrastructure|security|code|compute|data platform|artificial intelligence|\bai\b)\b/.test(text)) return "Technology";
  return "Other";
}

export function categoriesForPublicSite(input: PublicSiteCategoryInput): string[] {
  return withAiSiteCategory([categoryForPublicSite(input)], input);
}
