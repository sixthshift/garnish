import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { Switch } from "@sixthshift/design-system/switch";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useEffect, useRef, useState } from "react";
import { ReorderList } from "../../../components/ui/ReorderList";
import { useMutate } from "../../../lib/mutate";
import { toastError } from "../../../lib/toast";

/** The shape both guides' rows share: the house style statement and the planner statement are the same object. */
export type Statement = { id: string; text: string; enabled: boolean };

/** The four writes a guide supports. Each tab hands over its own server functions. */
export type StatementOps = {
  create: (text: string) => Promise<unknown>;
  update: (id: string, patch: { text?: string; enabled?: boolean }) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  reorder: (ids: string[]) => Promise<unknown>;
};

export type StatementListProps = {
  statements: readonly Statement[];
  ops: StatementOps;
  /** Names the guide in the one error that is about the list rather than a row ("Could not reorder the style guide"). */
  guideName: string;
  /** A caveat printed under a statement, where one has one. */
  noteFor?: (text: string) => string | null;
};

/** Grows a textarea to fit its content instead of scrolling internally. */
function autosize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * An ordered guide of statements: the rows, and the box that adds one. Both
 * Settings guides render this — the house style read to the restyle, and the
 * planner guide read to the proposal — because they are the same list with
 * different sentences, and a second copy would drift.
 *
 * Each row is the statement itself, editable in place, because a household's
 * voice is the wording and a modal to change one word would be in the way; a
 * switch for whether it is on; and the reorder list's own move and remove
 * controls, since the order is the order the statements are numbered in.
 *
 * The switch writes straight through on toggle: there is nothing else on the
 * row to save with it, and a Save button for one boolean would be a step with
 * no decision in it. The text saves on blur or Enter, and an empty box is
 * treated as "no change" rather than an error, so a cleared field is undone by
 * clicking away.
 */
export function StatementList({ statements, ops, guideName, noteFor }: StatementListProps) {
  const mutate = useMutate();
  const [order, setOrder] = useState<Statement[]>(() => statements.slice());
  useEffect(() => setOrder(statements.slice()), [statements]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft only triggers the resize, it isn't read here
  useEffect(() => {
    if (draftRef.current) autosize(draftRef.current);
  }, [draft]);

  const persistOrder = async (next: Statement[]) => {
    const previous = order;
    setOrder(next);
    try {
      await mutate(() => ops.reorder(next.map((rule) => rule.id)));
    } catch (error) {
      setOrder(previous);
      toastError(`Could not reorder the ${guideName}`, error);
    }
  };

  const toggle = async (rule: Statement, enabled: boolean) => {
    try {
      await mutate(() => ops.update(rule.id, { enabled }));
    } catch (error) {
      toastError("Could not change the statement", error);
    }
  };

  const saveText = async (rule: Statement, text: string) => {
    const next = text.trim();
    if (next === "" || next === rule.text) return;
    try {
      await mutate(() => ops.update(rule.id, { text: next }));
      toast({ intent: "success", title: "Statement saved" });
    } catch (error) {
      toastError("Could not save the statement", error);
    }
  };

  const remove = async (rule: Statement) => {
    try {
      await mutate(() => ops.remove(rule.id));
      toast({ intent: "success", title: "Statement deleted" });
    } catch (error) {
      toastError("Could not delete the statement", error);
    }
  };

  const add = async () => {
    const text = draft.trim();
    if (text === "") return;
    setBusy(true);
    try {
      await mutate(() => ops.create(text));
      setDraft("");
    } catch (error) {
      toastError("Could not add the statement", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {order.length === 0 ? (
        <Muted as="p">No statements yet.</Muted>
      ) : (
        <Card size="sm">
          <ReorderList
            items={order}
            keyOf={(rule) => rule.id}
            itemName="statement"
            onReorder={(next) => void persistOrder(next)}
            onRemove={(rule) => void remove(rule)}
            renderItem={(rule) => {
              const note = noteFor?.(rule.text) ?? null;
              return (
                <div className="flex flex-col gap-1 rounded-md px-3 py-2">
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
        </Card>
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
    </>
  );
}
