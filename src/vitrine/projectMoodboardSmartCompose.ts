export interface ProjectMoodboardImageAnalysis {
  referenceId: string;
  colors: readonly { red: number; green: number; blue: number; count: number }[];
  luminance: number;
  saturation: number;
  lightPixelRatio: number;
  edgeDensity: number;
}

export interface ProjectMoodboardSmartComposeSignal {
  label: string;
  value: string;
  evidence: string;
}

export interface ProjectMoodboardSmartComposeSection {
  sectionId: string;
  title: string;
  summary: string;
  sources: readonly { label: string; url?: string }[];
}

export interface ProjectMoodboardSmartComposeResult {
  generatedAt: string;
  basis: { keepCount: number; sampledCount: number };
  palette: readonly string[];
  signals: readonly ProjectMoodboardSmartComposeSignal[];
  sections: readonly ProjectMoodboardSmartComposeSection[];
}

interface MoodboardComposeReference {
  elementId: string;
  sourceLabel: string;
  sourceUrl?: string;
  caption: string;
  decision: "keep" | "maybe" | "reject";
  sectionId?: string;
}

interface MoodboardComposeSection {
  id: string;
  title: string;
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((value) => clampByte(value).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function colorDistance(
  left: { red: number; green: number; blue: number },
  right: { red: number; green: number; blue: number },
): number {
  return Math.hypot(
    left.red - right.red,
    left.green - right.green,
    left.blue - right.blue,
  );
}

export function analyzeMoodboardPixels(
  referenceId: string,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): ProjectMoodboardImageAnalysis {
  const buckets = new Map<string, { red: number; green: number; blue: number; count: number }>();
  const luminances: number[] = [];
  let saturationTotal = 0;
  let lightPixels = 0;
  let opaquePixels = 0;
  let edgeCount = 0;
  let edgeComparisons = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) {
      luminances.push(0);
      continue;
    }
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    const saturation = max === 0 ? 0 : (max - min) / max;
    luminances.push(luminance);
    saturationTotal += saturation;
    lightPixels += luminance >= 0.78 ? 1 : 0;
    opaquePixels += 1;

    const bucketRed = Math.min(224, Math.floor(red / 32) * 32 + 16);
    const bucketGreen = Math.min(224, Math.floor(green / 32) * 32 + 16);
    const bucketBlue = Math.min(224, Math.floor(blue / 32) * 32 + 16);
    const key = `${bucketRed}:${bucketGreen}:${bucketBlue}`;
    const bucket = buckets.get(key) ?? {
      red: bucketRed,
      green: bucketGreen,
      blue: bucketBlue,
      count: 0,
    };
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x + 1 < width) {
        edgeComparisons += 1;
        if (Math.abs((luminances[index] ?? 0) - (luminances[index + 1] ?? 0)) > 0.18) {
          edgeCount += 1;
        }
      }
      if (y + 1 < height) {
        edgeComparisons += 1;
        if (Math.abs((luminances[index] ?? 0) - (luminances[index + width] ?? 0)) > 0.18) {
          edgeCount += 1;
        }
      }
    }
  }

  return {
    referenceId,
    colors: [...buckets.values()].sort((left, right) => right.count - left.count),
    luminance: opaquePixels === 0
      ? 0
      : luminances.reduce((total, value) => total + value, 0) / opaquePixels,
    saturation: opaquePixels === 0 ? 0 : saturationTotal / opaquePixels,
    lightPixelRatio: opaquePixels === 0 ? 0 : lightPixels / opaquePixels,
    edgeDensity: edgeComparisons === 0 ? 0 : edgeCount / edgeComparisons,
  };
}

export function dominantMoodboardPalette(
  analyses: readonly ProjectMoodboardImageAnalysis[],
  limit = 5,
): readonly string[] {
  const candidates = analyses
    .flatMap((analysis) => analysis.colors)
    .sort((left, right) => right.count - left.count);
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (selected.some((color) => colorDistance(color, candidate) < 58)) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected.map((color) => rgbToHex(color.red, color.green, color.blue));
}

function average(
  analyses: readonly ProjectMoodboardImageAnalysis[],
  key: "luminance" | "saturation" | "lightPixelRatio" | "edgeDensity",
): number {
  return analyses.reduce((total, analysis) => total + analysis[key], 0)
    / Math.max(1, analyses.length);
}

export function buildMoodboardSmartComposeResult({
  references,
  sections,
  analyses,
  generatedAt = new Date().toISOString(),
}: {
  references: readonly MoodboardComposeReference[];
  sections: readonly MoodboardComposeSection[];
  analyses: readonly ProjectMoodboardImageAnalysis[];
  generatedAt?: string;
}): ProjectMoodboardSmartComposeResult {
  const keptIds = new Set(
    references.filter((reference) => reference.decision === "keep").map((reference) => reference.elementId),
  );
  const keptAnalyses = analyses.filter((analysis) => keptIds.has(analysis.referenceId));
  const evidence = `Computed from ${keptAnalyses.length} Keep ${keptAnalyses.length === 1 ? "reference" : "references"}.`;
  const signals: ProjectMoodboardSmartComposeSignal[] = [];

  if (keptAnalyses.length > 0) {
    const luminance = average(keptAnalyses, "luminance");
    const saturation = average(keptAnalyses, "saturation");
    const lightPixelRatio = average(keptAnalyses, "lightPixelRatio");
    const edgeDensity = average(keptAnalyses, "edgeDensity");
    signals.push(
      {
        label: "Tone",
        value: luminance >= 0.66 ? "Light and airy" : luminance <= 0.38 ? "Dark and focused" : "Balanced contrast",
        evidence,
      },
      {
        label: "Color energy",
        value: saturation >= 0.42 ? "Color-forward" : saturation <= 0.18 ? "Restrained palette" : "Measured accents",
        evidence,
      },
      {
        label: "Visual density",
        value: lightPixelRatio >= 0.42 ? "Generous negative space" : edgeDensity >= 0.2 ? "Dense information rhythm" : "Moderate breathing room",
        evidence,
      },
      {
        label: "Structure",
        value: edgeDensity >= 0.16 ? "Crisp, structured surfaces" : "Soft, quiet surfaces",
        evidence,
      },
      {
        label: "Typography",
        value: "Needs designer review",
        evidence: "Image analysis cannot identify font choices reliably.",
      },
    );
  }

  return {
    generatedAt,
    basis: { keepCount: keptIds.size, sampledCount: keptAnalyses.length },
    palette: dominantMoodboardPalette(keptAnalyses),
    signals,
    sections: sections.map((section) => {
      const sectionReferences = references.filter((reference) => reference.sectionId === section.id);
      const kept = sectionReferences.filter((reference) => reference.decision === "keep").length;
      const maybe = sectionReferences.filter((reference) => reference.decision === "maybe").length;
      const rejected = sectionReferences.filter((reference) => reference.decision === "reject").length;
      const anchors = sectionReferences
        .map((reference) => reference.caption.trim())
        .filter(Boolean)
        .slice(0, 2);
      const counts = `${sectionReferences.length} ${sectionReferences.length === 1 ? "reference" : "references"} · ${kept} Keep · ${maybe} Maybe · ${rejected} Reject`;
      return {
        sectionId: section.id,
        title: section.title,
        summary: anchors.length > 0 ? `${counts}. Designer anchors: ${anchors.join("; ")}` : `${counts}. Add captions to record the design rationale.`,
        sources: sectionReferences
          .filter((reference) => reference.sourceUrl)
          .map((reference) => ({ label: reference.sourceLabel, url: reference.sourceUrl })),
      };
    }),
  };
}

export function normalizeMoodboardSmartComposeResult(
  value: unknown,
): ProjectMoodboardSmartComposeResult | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result = value as Record<string, unknown>;
  if (
    typeof result.generatedAt !== "string"
    || !result.basis
    || typeof result.basis !== "object"
    || Array.isArray(result.basis)
    || !Array.isArray(result.palette)
    || !result.palette.every((color) => typeof color === "string")
    || !Array.isArray(result.signals)
    || !Array.isArray(result.sections)
  ) return undefined;
  const basis = result.basis as Record<string, unknown>;
  if (!Number.isSafeInteger(basis.keepCount) || !Number.isSafeInteger(basis.sampledCount)) {
    return undefined;
  }
  const signals = result.signals.filter((signal): signal is ProjectMoodboardSmartComposeSignal => {
    if (!signal || typeof signal !== "object" || Array.isArray(signal)) return false;
    const item = signal as Record<string, unknown>;
    return typeof item.label === "string"
      && typeof item.value === "string"
      && typeof item.evidence === "string";
  });
  const sections = result.sections.filter((section): section is ProjectMoodboardSmartComposeSection => {
    if (!section || typeof section !== "object" || Array.isArray(section)) return false;
    const item = section as Record<string, unknown>;
    return typeof item.sectionId === "string"
      && typeof item.title === "string"
      && typeof item.summary === "string"
      && Array.isArray(item.sources)
      && item.sources.every((source) => {
        if (!source || typeof source !== "object" || Array.isArray(source)) return false;
        const link = source as Record<string, unknown>;
        return typeof link.label === "string"
          && (link.url === undefined || typeof link.url === "string");
      });
  });
  if (signals.length !== result.signals.length || sections.length !== result.sections.length) {
    return undefined;
  }
  return {
    generatedAt: result.generatedAt,
    basis: {
      keepCount: basis.keepCount as number,
      sampledCount: basis.sampledCount as number,
    },
    palette: result.palette,
    signals,
    sections,
  };
}
