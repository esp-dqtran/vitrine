import type { FeatureStepPrompt, FeatureSynthesisPrompt } from "./featureDocument.ts";

export type ProviderEnvironment = Partial<Record<
  "RESEARCH_LLM_BASE_URL" | "RESEARCH_LLM_API_KEY" | "RESEARCH_LLM_MODEL",
  string
>>;

export interface FeatureDocumentProvider {
  readonly model: string;
  analyzeImage(
    prompt: FeatureStepPrompt,
    image: { bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" },
    signal: AbortSignal,
  ): Promise<unknown>;
  synthesize(prompt: FeatureSynthesisPrompt, signal: AbortSignal): Promise<unknown>;
}

type CompletionPayload = {
  choices?: Array<{ message?: { content?: string } }>;
};

const STEP_SYSTEM_PROMPT = [
  "Return JSON only.",
  "Analyze only what is visible in the supplied image and the supplied Flow context.",
  "Keep observations separate from likely intent and uncertainty.",
  "Use exactly the supplied evidenceId.",
].join(" ");

const SYNTHESIS_SYSTEM_PROMPT = [
  "Return JSON only using this exact top-level structure: executiveSummary, observedFlow, flowAnalysis, proposedFeature, requirements, edgeCases, successMetrics, guardrailMetrics, analyticsEvents, dependencies, openQuestions.",
  "Each claim has id, kind, text, evidenceIds, and optional confidence.",
  "Each requirement is a claim plus userStory, priority, preconditions, and acceptanceCriteria; every criterion has id, given, when, then, and evidenceIds.",
  "Classify every claim as observed, inferred, proposed, or unknown.",
  "Every observed or inferred claim must cite one or more supplied evidence IDs.",
  "Never invent an evidence ID.",
].join(" ");

function providerContent(payload: CompletionPayload): unknown {
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Feature analysis provider returned no content");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Feature analysis provider returned invalid JSON");
  }
}

export function createFeatureDocumentProvider(
  environment: ProviderEnvironment = process.env,
  request: typeof fetch = fetch,
): FeatureDocumentProvider | undefined {
  const baseUrl = environment.RESEARCH_LLM_BASE_URL?.replace(/\/+$/, "");
  const apiKey = environment.RESEARCH_LLM_API_KEY;
  const model = environment.RESEARCH_LLM_MODEL;
  if (!baseUrl || !apiKey || !model) return undefined;

  async function complete(messages: unknown[], signal: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await request(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages,
        }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error("Feature analysis provider request failed");
    }
    if (!response.ok) throw new Error(`Feature analysis provider request failed (${response.status})`);
    let payload: CompletionPayload;
    try {
      payload = await response.json() as CompletionPayload;
    } catch {
      throw new Error("Feature analysis provider returned invalid response");
    }
    return providerContent(payload);
  }

  return {
    model,
    analyzeImage(prompt, image, signal) {
      if (image.bytes.byteLength < 1) throw new Error("Feature analysis image is empty");
      return complete([
        { role: "system", content: STEP_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: JSON.stringify(prompt) },
            {
              type: "image_url",
              image_url: {
                url: `data:${image.contentType};base64,${image.bytes.toString("base64")}`,
                detail: "high",
              },
            },
          ],
        },
      ], signal);
    },
    synthesize(prompt, signal) {
      return complete([
        { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(prompt) },
      ], signal);
    },
  };
}
