import { EvidenceAnalysisError } from "./evidenceAnalysisRuntime.ts";

export type ProviderEnvironment = Partial<Record<
  "RESEARCH_LLM_BASE_URL" | "RESEARCH_LLM_API_KEY" | "RESEARCH_LLM_MODEL",
  string
>>;

export interface RasterImage {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
}

export interface MultimodalJsonProvider {
  readonly model: string;
  completeJson(input: {
    system: string;
    text: unknown;
    image?: RasterImage;
    signal: AbortSignal;
  }): Promise<unknown>;
}

type CompletionPayload = {
  choices?: Array<{ message?: { content?: string } }>;
};

function parsedContent(payload: CompletionPayload): unknown {
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new EvidenceAnalysisError("output_invalid", "Analysis provider returned no content");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new EvidenceAnalysisError("output_invalid", "Analysis provider returned invalid JSON");
  }
}

export function createMultimodalJsonProvider(
  environment: ProviderEnvironment = process.env,
  request: typeof fetch = fetch,
): MultimodalJsonProvider | undefined {
  const baseUrl = environment.RESEARCH_LLM_BASE_URL?.replace(/\/+$/, "");
  const apiKey = environment.RESEARCH_LLM_API_KEY;
  const model = environment.RESEARCH_LLM_MODEL;
  if (!baseUrl || !apiKey || !model) return undefined;

  return {
    model,
    async completeJson(input) {
      let response: Response;
      try {
        const userContent = input.image
          ? [
              { type: "text", text: JSON.stringify(input.text) },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.image.contentType};base64,${input.image.bytes.toString("base64")}`,
                  detail: "high",
                },
              },
            ]
          : JSON.stringify(input.text);
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
            messages: [
              { role: "system", content: input.system },
              { role: "user", content: userContent },
            ],
          }),
          signal: input.signal,
        });
      } catch (error) {
        if (input.signal.aborted) throw error;
        throw new EvidenceAnalysisError("provider_unavailable");
      }
      if (!response.ok) {
        const code = [400, 401, 403, 422].includes(response.status)
          ? "provider_refused"
          : "provider_unavailable";
        throw new EvidenceAnalysisError(code, `Analysis provider request failed (${response.status})`);
      }
      let payload: CompletionPayload;
      try {
        payload = await response.json() as CompletionPayload;
      } catch {
        throw new EvidenceAnalysisError("output_invalid", "Analysis provider returned invalid response");
      }
      return parsedContent(payload);
    },
  };
}
