import type {
  ResearchSynthesisPrompt,
  ResearchSynthesisProvider,
} from "./researchSynthesis.ts";

type ProviderEnvironment = Partial<Record<
  "RESEARCH_LLM_BASE_URL" | "RESEARCH_LLM_API_KEY" | "RESEARCH_LLM_MODEL",
  string
>>;

export function createResearchSynthesisProvider(
  environment: ProviderEnvironment = process.env,
  request: typeof fetch = fetch,
): ResearchSynthesisProvider | undefined {
  const baseUrl = environment.RESEARCH_LLM_BASE_URL?.replace(/\/+$/, "");
  const apiKey = environment.RESEARCH_LLM_API_KEY;
  const model = environment.RESEARCH_LLM_MODEL;
  if (!baseUrl || !apiKey || !model) return undefined;

  return {
    model,
    async generate(input: ResearchSynthesisPrompt, signal: AbortSignal): Promise<unknown> {
      const response = await request(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Return JSON only. Every observation, difference, alternative, recommendation, and requirement must cite one or more supplied evidence IDs.",
            },
            { role: "user", content: JSON.stringify(input) },
          ],
        }),
        signal,
      });
      if (!response.ok) throw new Error(`Research synthesis provider request failed (${response.status})`);
      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Research synthesis provider returned no content");
      try {
        return JSON.parse(content);
      } catch {
        throw new Error("Research synthesis provider returned invalid JSON");
      }
    },
  };
}
