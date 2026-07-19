import { Button } from "@astryxdesign/core";
import { INSPIRATION_PROMPTS } from "../inspirationSearch";

export function InspirationPrompts({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <section aria-labelledby="inspiration-prompts-title" className="inspiration-prompts">
      <h2 id="inspiration-prompts-title">What are you designing?</h2>
      <p>Start with an intent and explore observed product references.</p>
      <div className="inspiration-prompt-list">
        {INSPIRATION_PROMPTS.map((prompt) => (
          <Button key={prompt.query} label={prompt.label} size="sm" onClick={() => onSelect(prompt.query)} />
        ))}
      </div>
    </section>
  );
}
