import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";

/**
 * What the AI rung needs to exist.
 * The paste option on the new-recipe screen appears only when the server has a
 * model configured, which is one environment variable — so the one place that
 * can explain a missing option says so here, beside the other import and
 * export plumbing, along with the one thing worth knowing about the free tier.
 */
export function AiImportNote() {
  return (
    <div className="flex flex-col gap-2" data-testid="ai-import-note">
      <SectionTitle as="h3">Importing with a model</SectionTitle>
      <Muted as="p" className="text-sm">
        A new recipe can be read out of pasted text by a hosted model, over one OpenAI-compatible request from the server. The option only appears when{" "}
        <code>AI_API_KEY</code> is set there; <code>AI_BASE_URL</code> and <code>AI_MODEL</code> pick a provider and a model, and default to Google's Gemini
        free tier. Without a key, the other import paths still work and this one stays hidden.
      </Muted>
      <Muted as="p" className="text-sm">
        The Gemini free tier may train on what is sent to it. What is sent is the text you pasted, which for a public recipe page costs nothing; set the other
        two variables to use a paid provider or a model on the LAN instead.
      </Muted>
    </div>
  );
}
