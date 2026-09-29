import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Spinner } from "@sixthshift/design-system/spinner";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { type ReactNode, useState } from "react";
import type { RestyledPart, StyleRule } from "../../../../domain/style";
import { messageFrom } from "../../../../lib/errors";
import { StylePart } from "./StylePart";
import type { StyleAnswer } from "./styleSession";
import { type StyleSourcePart, type StyleView, useStyleSpace } from "./useStyleSpace";

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
  /** The primary button, e.g. "Save recipe". */
  saveLabel: string;
  /** The buttons before Save: Back, Edit details. */
  secondary?: ReactNode;
  /** The guide; the server's by default. */
  loadRules?: () => Promise<StyleRule[]>;
};

/** "3 of 7 rewrites kept · 1 needs a look". Pure. */
export function statusLine(counts: { total: number; kept: number; flagged: number }): string {
  if (counts.total === 0) return "The rewrite changed nothing.";
  const kept = `${counts.kept} of ${counts.total} ${counts.total === 1 ? "rewrite" : "rewrites"} kept`;
  return counts.flagged === 0 ? kept : `${kept} · ${counts.flagged} ${counts.flagged === 1 ? "needs" : "need"} a look`;
}

/** "Saving this mix drops “until fragrant”." — what the check over the choices lost, as one sentence. Pure. */
export function saveWarning(check: { missingConditions: readonly string[]; missingFacts: readonly string[]; missingFoods: readonly string[] }): string | null {
  const lost = [...check.missingConditions, ...check.missingFacts, ...check.missingFoods];
  if (lost.length === 0) return null;
  return `Saving this mix drops ${lost.map((item) => `“${item}”`).join(", ")}.`;
}

/**
 * The Style space: the recipe as it will read in the house style, step by
 * step, with the author's words one press away. Shared by the import, where
 * it comes before Save, and a saved recipe's Style page.
 */
export function StyleSpace({ parts, run, onSave, saveLabel, secondary, loadRules }: StyleSpaceProps) {
  const style = useStyleSpace({ parts, run, loadRules });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { original, answer, choices, assembled, counts, saveCheck, view, running } = style;
  const warning = saveCheck && !saveCheck.ok ? saveWarning(saveCheck) : null;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(style.toSave);
    } catch (cause) {
      setSaveError(messageFrom(cause));
      setSaving(false);
    }
  };

  // Steps are numbered through the recipe as shown, and a part chosen whole may show a different count.
  let next = 1;
  const firstSteps = original.map((part, p) => {
    const first = next;
    next += view === "styled" && assembled ? assembled[p]!.steps.length : part.steps.length;
    return first;
  });

  return (
    <div className="flex flex-col gap-6" data-testid="style-space">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 grow items-center gap-2 text-sm" aria-live="polite">
          {running && <Spinner size="sm" />}
          <span data-testid="style-status">{running ? "Restyling in the house style…" : counts ? statusLine(counts) : ""}</span>
        </div>
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
        <ToggleGroup
          type="single"
          appearance="segmented"
          size="sm"
          aria-label="View"
          options={[
            { value: "styled", label: "Styled" },
            { value: "original", label: "Original" },
          ]}
          value={view}
          onValueChange={(value: string) => {
            if (value === "styled" || value === "original") {
              style.setView(value as StyleView);
              style.setEditing(null);
            }
          }}
        />
      </div>

      {style.error !== null && (
        <Message intent="danger" title="The restyle did not run" data-testid="style-error">
          {style.error} The recipe is shown as the author wrote it{answer ? "" : "; Save keeps it that way"}.
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
            <ul className="grid gap-2 md:grid-cols-2">
              {style.rules.map((rule) => (
                <li key={rule.id} className="flex items-start gap-2.5">
                  <Checkbox checked={style.selected.has(rule.id)} className="mt-0.5" aria-label={rule.text} onCheckedChange={() => style.toggleRule(rule.id)} />
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

      {original.map((_, p) => (
        <StylePart
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional: the restyle pairs them by index and never reorders them.
          key={p}
          p={p}
          original={original}
          firstStep={firstSteps[p]!}
          answer={answer}
          choices={choices}
          assembled={assembled?.[p] ?? null}
          view={view}
          running={running}
          comparing={style.comparing}
          editing={style.editing}
          onStep={(s, choice) => style.setStep(p, s, choice)}
          onPart={(choice) => style.setPart(p, choice)}
          onCompare={style.toggleCompare}
          onEdit={style.setEditing}
          onDraft={style.editStep}
        />
      ))}

      <div
        className="sticky bottom-20 z-10 -mx-4 flex flex-col gap-2 border-t border-border-normal bg-bg-normal px-4 py-3 md:bottom-0 md:mx-0 md:rounded-t-lg md:px-4"
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
            Quantities are never changed. The author’s words are kept, so Restore can bring them back.
          </Muted>
          {secondary}
          <Button type="button" variant="solid" intent="brand" disabled={running || saving} onClick={() => void save()} data-testid="style-save">
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
