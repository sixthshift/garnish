import { cardVariants } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import type { SourceKind } from "./importSummary";

export type SourceChooserProps = {
  onChoose: (kind: SourceKind) => void;
  disabled?: boolean;
  /** Whether `claude` is installed on the server; without it the paste option is not offered. */
  aiAvailable?: boolean;
};

/**
 * The ways a recipe gets here, one option per card. `ai` marks the option that
 * only exists when `claude` is installed on the server.
 */
const OPTIONS: readonly { kind: SourceKind; title: string; blurb: string; ai?: true }[] = [
  {
    kind: "url",
    title: "A web page",
    blurb: "Paste the address. The recipe is read off the page and shown to you before anything is saved.",
  },
  {
    kind: "file",
    title: "A Mealie or Tandoor export",
    blurb: "Upload a backup or a single recipe file. Everything it holds is shown to you before anything is saved.",
  },
  {
    kind: "paste",
    title: "Pasted text",
    blurb: "A photo's text, an email, a page that gave nothing up. Claude reads it here on the server, and you check it before anything is saved.",
    ai: true,
  },
  { kind: "manual", title: "My own", blurb: "Start with a blank recipe and type it in." },
];

/** The first stage: the ways a recipe gets here. The pasted one appears only when the AI rung can run. */
export function SourceChooser({ onChoose, disabled, aiAvailable = false }: SourceChooserProps) {
  return (
    <div className="flex flex-col gap-4" data-source-stage="choose">
      <SectionTitle as="h2">Where is this recipe from?</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.filter((option) => option.ai !== true || aiAvailable).map((option) => (
          <button
            key={option.kind}
            type="button"
            disabled={disabled}
            data-source={option.kind}
            // `cardVariants` with `interactive`, so these read as the one thing
            // on the page you are meant to press: the hover and focus states
            // come from the primitive rather than a hand-written hover that
            // tinted the card to the page's own colour.
            className={cn(cardVariants({ size: "md", interactive: true }), "text-left disabled:opacity-50")}
            onClick={() => onChoose(option.kind)}
          >
            <span className="block font-medium">{option.title}</span>
            <Muted as="span" className="mt-1 block text-sm">
              {option.blurb}
            </Muted>
          </button>
        ))}
      </div>
    </div>
  );
}
