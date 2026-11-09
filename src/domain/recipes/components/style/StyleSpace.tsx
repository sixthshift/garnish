import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import { type ReactNode, useState } from "react";
import { messageFrom } from "../../../../lib/errors";
import { scrollClearance } from "../../../../lib/ui/scrollClearance";
import type { RestyledPart, StyleRule } from "../../style";
import { RecipeVersion, StyleCompare } from "./StyleCompare";
import { StyleWait } from "./StyleWait";
import { allRows, type Choice, type StyleAnswer } from "./styleSession";
import { type StyleSourcePart, useStyleSpace } from "./useStyleSpace";

export type StyleSpaceProps = {
  /** The author's parts: a saved recipe's, or an import's before it is saved. */
  parts: readonly StyleSourcePart[];
  /** One restyle over those parts with the ticked statements. */
  run: (ruleIds: string[]) => Promise<StyleAnswer>;
  /**
   * Write the result: the parts as chosen, or null when every choice is the
   * author's and there is nothing to restyle. A throw is shown under the
   * buttons and the space stays as it was.
   */
  onSave: (parts: RestyledPart[] | null) => Promise<void>;
  /** The primary button for each version, so it says which one Save keeps: "Save in house style", "Save as written". */
  saveLabels: Record<Choice, string>;
  /** The buttons before Save: Back, Cancel. */
  secondary?: ReactNode;
  /** While the rewrite runs, a way past it: an import's "Skip, save as written" (decisions.md row 203). */
  skipLabel?: string;
  /** The guide; the server's by default. */
  loadRules?: () => Promise<StyleRule[]>;
};

/** "Saving this drops “if the sauce is sour” and adds “until fragrant”." — what the check over what is saved found, as one sentence. Pure. */
export function saveWarning(check: {
  missingConditions: readonly string[];
  missingFacts: readonly string[];
  missingFoods: readonly string[];
  addedConditions?: readonly string[];
}): string | null {
  const quote = (items: readonly string[]) => items.map((item) => `“${item}”`).join(", ");
  const lost = [...check.missingConditions, ...check.missingFacts, ...check.missingFoods];
  const added = check.addedConditions ?? [];
  const clauses = [lost.length > 0 ? `drops ${quote(lost)}` : "", added.length > 0 ? `adds ${quote(added)}` : ""].filter((clause) => clause !== "");
  if (clauses.length === 0) return null;
  return `Saving this ${clauses.join(" and ")}.`;
}

/**
 * The Style space: the author's recipe and the house style's side by side,
 * one of them chosen whole to save, starting on the house style, with Save
 * naming the one it keeps (decisions.md row 229). Shared by the import, where
 * it comes before Save, and a saved recipe's Style page.
 */
export function StyleSpace({ parts, run, onSave, saveLabels, secondary, skipLabel, loadRules }: StyleSpaceProps) {
  const style = useStyleSpace({ parts, run, loadRules });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { original, answer, choices, saveCheck, running } = style;
  // Save keeps the house style only when there is one that says something new and it is the one chosen.
  const comparing = answer !== null && choices !== null && style.rewrite !== null && style.changed;
  const choice: Choice = running ? "rewrite" : comparing ? choices.recipe : "original";
  const warning = saveCheck && !saveCheck.ok ? saveWarning(saveCheck) : null;

  const save = async (asWritten = false) => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(asWritten ? null : style.toSave);
    } catch (cause) {
      setSaveError(messageFrom(cause));
      setSaving(false);
    }
  };

  const houseStyle = (
    <Button
      type="button"
      variant="outline"
      intent="neutral"
      size="sm"
      aria-expanded={style.panelOpen}
      disabled={running}
      onClick={() => style.setPanelOpen(!style.panelOpen)}
    >
      House style · {style.selected.size} of {style.rules.length} on
    </Button>
  );

  return (
    // While a run is out the space is its loading screen, the recipe coming back with the answer;
    // `style-landed` then, so the rewritten steps land in turn (styles.css).
    <div className={cn("flex flex-col gap-6", !running && answer !== null && "style-landed")} data-testid="style-space">
      {running ? (
        <StyleWait
          stage={style.stage}
          startedAt={style.startedAt}
          steps={original.reduce((total, part) => total + part.steps.length, 0)}
          actions={
            skipLabel !== undefined && (
              <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={saving} onClick={() => void save(true)}>
                {skipLabel}
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 grow items-center gap-2 text-sm" aria-live="polite">
              <span data-testid="style-status">
                {comparing ? "Choose the version to save." : answer !== null && !style.changed ? "The house style changes nothing here." : ""}
              </span>
            </div>
            {houseStyle}
          </div>

          {style.error !== null && (
            <Message intent="warning" title="Couldn't rewrite this in your house style" data-testid="style-error">
              {style.error} The steps are shown as written{answer ? "" : ", and Save keeps them that way"}.
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" intent="neutral" onClick={style.runAgain}>
                  Try again
                </Button>
              </div>
            </Message>
          )}

          {style.panelOpen && (
            <Card size="sm" className="flex flex-col gap-3" aria-label="House style for this run">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <SectionTitle as="h2">House style</SectionTitle>
                <Muted as="span" className="text-sm">
                  For this run only. The defaults are under Settings, Style.
                </Muted>
              </div>
              {style.rules.length === 0 ? (
                <Muted as="p" className="text-sm">
                  No statements yet. Add some under Settings, Style.
                </Muted>
              ) : (
                <ul className="grid gap-2 desktop:grid-cols-2">
                  {style.rules.map((rule) => (
                    <li key={rule.id} className="flex items-start gap-2.5">
                      <Checkbox
                        checked={style.selected.has(rule.id)}
                        className="mt-0.5"
                        aria-label={rule.text}
                        onCheckedChange={() => style.toggleRule(rule.id)}
                      />
                      <button type="button" className="line-clamp-2 flex-1 text-left text-sm" onClick={() => style.toggleRule(rule.id)}>
                        {rule.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" intent="neutral" onClick={() => style.setPanelOpen(false)}>
                  Close
                </Button>
                <Button type="button" variant="solid" intent="brand" onClick={style.runAgain}>
                  Run again
                </Button>
              </div>
            </Card>
          )}

          {comparing ? (
            <StyleCompare
              author={style.author}
              rewrite={style.rewrite!}
              rows={allRows(original)}
              choice={choices.recipe}
              findings={style.findings}
              rebuilt={style.rebuilt}
              editing={style.editing}
              onChoose={style.setRecipe}
              onEdit={style.setEditing}
              onDraft={style.editStep}
            />
          ) : (
            <Card size="sm" className="mx-auto w-full max-w-2xl" data-testid="style-original">
              <RecipeVersion parts={style.author} rows={allRows(original)} />
            </Card>
          )}
        </>
      )}

      <div
        ref={scrollClearance}
        className="sticky bottom-(--app-bar) z-content-sticky -mx-4 -mb-4 flex flex-col gap-2 border-t border-border-normal bg-bg-normal px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] desktop:mb-0 desktop:mx-0 desktop:rounded-t-lg desktop:px-4"
        data-testid="style-footer"
      >
        {warning !== null && (
          <Message intent="warning" size="sm" data-testid="style-save-warning">
            {warning}
          </Message>
        )}
        {saveError !== null && (
          <Message intent="danger" size="sm">
            {saveError}
          </Message>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Muted as="span" className="grow text-sm">
            Quantities are never changed. The author’s recipe is kept, so Restore can bring it back.
          </Muted>
          {secondary}
          <Button type="button" variant="solid" intent="brand" disabled={running || saving} onClick={() => void save()} data-testid="style-save">
            {saving ? "Saving…" : saveLabels[choice]}
          </Button>
        </div>
      </div>
    </div>
  );
}
