import { EvidenceAnalysisError } from "./evidenceAnalysisRuntime.ts";
import type { ChatAttachment, ChatSession } from "./llmChat.ts";
import {
  APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS,
  APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS,
  appKnowledgeBrowserPrompt,
  type AppKnowledgeProvider,
} from "./appKnowledgeProvider.ts";

export const CHATGPT_BROWSER_MODEL = "chatgpt-browser";

export function parseBrowserJsonObject(reply: string): Record<string, unknown> {
  const trimmed = reply.trim();
  const fenced = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(trimmed);
  const source = fenced?.[1].trim() ?? trimmed;
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

export function createChatGptBrowserAppKnowledgeProvider(
  sessions: readonly ChatSession[],
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
    model: CHATGPT_BROWSER_MODEL,
    analyzeEvidence(prompt, image, signal) {
      return useSession(signal, async (session) => parseBrowserJsonObject(
        await session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS, prompt),
          attachment(image),
          { signal },
        ),
      ));
    },
    synthesize(prompt, signal) {
      return useSession(signal, async (session) => parseBrowserJsonObject(
        await session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS, prompt),
          undefined,
          { signal },
        ),
      ));
    },
  };
}
