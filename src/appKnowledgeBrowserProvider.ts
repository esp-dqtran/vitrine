import { EvidenceAnalysisError } from "./evidenceAnalysisRuntime.ts";
import {
  ChatRateLimitError,
  type ChatAttachment,
  type ChatSession,
} from "./llmChat.ts";
import {
  APP_KNOWLEDGE_DESIGN_SYSTEM_INSTRUCTIONS,
  APP_KNOWLEDGE_DESIGN_SYSTEM_MERGE_INSTRUCTIONS,
  APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS,
  APP_KNOWLEDGE_FLOW_INSTRUCTIONS,
  APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS,
  appKnowledgeBrowserPrompt,
  type AppKnowledgeProvider,
} from "./appKnowledgeProvider.ts";

export const CHATGPT_BROWSER_MODEL = "chatgpt-browser";
export const ANTIGRAVITY_BROWSER_MODEL = "gemini-3.6-flash-high";
export const ANTIGRAVITY_BROWSER_MODEL_LABEL = "Gemini 3.6 Flash (High)";

export function parseBrowserJsonObject(reply: string): Record<string, unknown> {
  const trimmed = reply.trim();
  if (
    /you(?:'|’)re making requests too quickly/i.test(trimmed)
    || /temporarily limited access to your conversations/i.test(trimmed)
  ) {
    throw new EvidenceAnalysisError("provider_rate_limited");
  }
  const fenced = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(trimmed);
  const renderedFence = /^json[ \t]*\r?\n([\s\S]+)$/i.exec(trimmed);
  const source = fenced?.[1].trim() ?? renderedFence?.[1].trim() ?? trimmed;
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error();
    }
    return value as Record<string, unknown>;
  } catch {
    throw new EvidenceAnalysisError(
      "output_invalid",
      "Analysis provider returned invalid JSON output",
    );
  }
}

function attachment(image: {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
}): ChatAttachment {
  const extension = image.contentType === "image/jpeg"
    ? "jpg"
    : image.contentType.split("/")[1];
  return {
    name: `app-knowledge.${extension}`,
    mimeType: image.contentType,
    buffer: image.bytes,
  };
}

async function requestBrowserJson(request: () => Promise<string>): Promise<Record<string, unknown>> {
  try {
    return parseBrowserJsonObject(await request());
  } catch (error) {
    if (error instanceof ChatRateLimitError) {
      throw new EvidenceAnalysisError("provider_rate_limited");
    }
    throw error;
  }
}

function createBrowserAppKnowledgeProvider(
  sessions: readonly ChatSession[],
  model: string,
): AppKnowledgeProvider {
  if (sessions.length < 1 || sessions.length > 2) {
    throw new Error("App Knowledge browser provider requires one or two sessions");
  }
  const tails = sessions.map(() => Promise.resolve());
  let cursor = 0;

  const useSession = async <T>(
    signal: AbortSignal,
    operation: (session: ChatSession) => Promise<T>,
  ): Promise<T> => {
    signal.throwIfAborted();
    const lane = cursor % sessions.length;
    cursor += 1;
    const result = tails[lane].then(() => {
      signal.throwIfAborted();
      return operation(sessions[lane]);
    });
    tails[lane] = result.then(() => undefined, () => undefined);
    return result;
  };

  return {
    model,
    analyzeEvidence(prompt, image, signal) {
      return useSession(signal, async (session) => requestBrowserJson(
        () => session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS, prompt),
          attachment(image),
          { signal },
        ),
      ));
    },
    synthesize(prompt, signal) {
      return useSession(signal, async (session) => requestBrowserJson(
        () => session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS, prompt),
          undefined,
          { signal },
        ),
      ));
    },
    synthesizeFlows(prompt, signal) {
      return useSession(signal, async (session) => requestBrowserJson(
        () => session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_FLOW_INSTRUCTIONS, prompt),
          undefined,
          { signal },
        ),
      ));
    },
    synthesizeDesignSystemChunk(prompt, signal) {
      return useSession(signal, async (session) => requestBrowserJson(
        () => session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_DESIGN_SYSTEM_INSTRUCTIONS, prompt),
          undefined,
          { signal },
        ),
      ));
    },
    mergeDesignSystem(prompt, signal) {
      return useSession(signal, async (session) => requestBrowserJson(
        () => session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_DESIGN_SYSTEM_MERGE_INSTRUCTIONS, prompt),
          undefined,
          { signal },
        ),
      ));
    },
  };
}

export function createChatGptBrowserAppKnowledgeProvider(
  sessions: readonly ChatSession[],
): AppKnowledgeProvider {
  return createBrowserAppKnowledgeProvider(sessions, CHATGPT_BROWSER_MODEL);
}

export function createAntigravityBrowserAppKnowledgeProvider(
  session: ChatSession,
): AppKnowledgeProvider {
  return createBrowserAppKnowledgeProvider([session], ANTIGRAVITY_BROWSER_MODEL);
}
