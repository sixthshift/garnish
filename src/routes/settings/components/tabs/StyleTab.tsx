import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Switch } from "@sixthshift/design-system/switch";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useEffect, useRef, useState } from "react";
import { ReorderList } from "../../../../components/ui/ReorderList";
import { type StyleRule, styleRuleNote } from "../../../../domain/style";
import { useMutate } from "../../../../lib/mutate";
import { notify, notifyError } from "../../../../lib/notify";
import { createStyleRule, deleteStyleRule, reorderStyleRules, updateStyleRule } from "../../../../server/fns/style";

/** Grows a textarea to fit its content instead of scrolling internally. */
function autosize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * The Style tab: the house style guide, which is
 * the list of statements the restyle pass reads out to the model. Each row is
 * the statement itself — editable in place, because a household's voice is the
 * wording and a modal to change one word would be in the way — a switch for
 * whether it is on by default, and the reorder list's own move and remove
 * controls, since the order is the order the statements are numbered in.
 *
 * The switch writes straight through on toggle: there is nothing else on the
 * row to save with it, and a Save button for one boolean would be a step with
 * no decision in it. The text saves on blur or Enter, and an empty box is
 * treated as "no change" rather than an error, so a cleared field is undone by
 * clicking away.
 *
 * One statement carries a caveat (`styleRuleNote`), printed under it; a row the
 * household has reworded has none, which is correct — the note is about the
 * seeded sentence.
 */
export function StyleTab({ rules }: { rules: readonly StyleRule[] }) {
  const mutate = useMutate();
  const [order, setOrder] = useState<StyleRule[]>(() => rules.slice());
  useEffect(() => setOrder(rules.slice()), [rules]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft only triggers the resize, it isn't read here
  useEffect(() => {
    if (draftRef.current) autosize(draftRef.current);
  }, [draft]);

  const persistOrder = async (next: StyleRule[]) => {
    const previous = order;
    setOrder(next);
    try {
      await mutate(() => reorderStyleRules({ data: { ids: next.map((rule) => rule.id) } }));
    } catch (error) {
      setOrder(previous);
      notifyError("Could not reorder the style guide", error);
    }
  };

  const toggle = async (rule: StyleRule, enabled: boolean) => {
    try {
      await mutate(() => updateStyleRule({ data: { id: rule.id, enabled } }));
    } catch (error) {
      notifyError("Could not change the statement", error);
    }
  };

  const saveText = async (rule: StyleRule, text: string) => {
    const next = text.trim();
    if (next === "" || next === rule.text) return;
    try {
      await mutate(() => updateStyleRule({ data: { id: rule.id, text: next } }));
      notify({ intent: "success", title: "Statement saved" });
    } catch (error) {
      notifyError("Could not save the statement", error);
    }
  };

  const remove = async (rule: StyleRule) => {
    try {
      await mutate(() => deleteStyleRule({ data: { id: rule.id } }));
      notify({ intent: "success", title: "Statement deleted" });
    } catch (error) {
      notifyError("Could not delete the statement", error);
    }
  };

  const add = async () => {
    const text = draft.trim();
    if (text === "") return;
    setBusy(true);
    try {
      await mutate(() => createStyleRule({ data: { text } }));
      setDraft("");
    } catch (error) {
      notifyError("Could not add the statement", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-label="House style" data-style-list>
      <SectionTitle as="h2">House style</SectionTitle>
      <Muted as="p" className="text-sm">
        Statements read to the model when a recipe's steps are restyled, in this order. The switch is the default for a run; every statement can still be ticked
        on or off for one recipe. Temperatures, times and quantities are never changed, whatever the guide says.
      </Muted>
      {order.length === 0 ? (
        <Muted as="p">No statements yet.</Muted>
      ) : (
        <ReorderList
          items={order}
          keyOf={(rule) => rule.id}
          itemName="statement"
          onReorder={(next) => void persistOrder(next)}
          onRemove={(rule) => void remove(rule)}
          renderItem={(rule) => {
            const note = styleRuleNote(rule.text);
            return (
              <div className="flex flex-col gap-1 rounded-md border border-border-normal px-3 py-2">
                <div className="flex items-start gap-3">
                  <Switch
                    checked={rule.enabled}
                    aria-label={`Use "${rule.text}" by default`}
                    className="mt-1"
                    onCheckedChange={(enabled) => void toggle(rule, enabled)}
                  />
                  <Textarea
                    defaultValue={rule.text}
                    aria-label={`Statement: ${rule.text}`}
                    rows={1}
                    ref={(el) => {
                      if (el) autosize(el);
                    }}
                    className="min-h-0 min-w-0 flex-1 resize-none overflow-hidden border-0 py-1 shadow-none"
                    onInput={(event) => autosize(event.currentTarget)}
                    onBlur={(event) => void saveText(rule, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </div>
                {note !== null && (
                  <Muted as="p" className="text-sm">
                    {note}
                  </Muted>
                )}
              </div>
            );
          }}
        />
      )}
      <div className="flex items-start gap-2">
        <Textarea
          ref={draftRef}
          value={draft}
          aria-label="New statement"
          placeholder="Add a statement"
          rows={1}
          className="min-h-0 min-w-0 flex-1 resize-none overflow-hidden py-2"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void add();
            }
          }}
        />
        <Button type="button" variant="outline" intent="neutral" className="mt-0.5" disabled={busy || draft.trim() === ""} onClick={() => void add()}>
          Add
        </Button>
      </div>
    </section>
  );
}
