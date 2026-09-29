// The Style space's state: the guide read and run once on arrival, the answer, and the household's choices over it.

import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleRule } from "../../../../domain/style";
import { messageFrom } from "../../../../lib/errors";
import { listStyleRules } from "../../../../server/fns/style";
import {
  assemble,
  type Choice,
  changesAnything,
  checkChoices,
  choiceCounts,
  choosePart,
  initialChoices,
  type StyleAnswer,
  type StyleChoices,
  stepKey,
  styleOriginal,
} from "./styleSession";

export type StyleSourcePart = Parameters<typeof styleOriginal>[0][number];

export type UseStyleSpaceOptions = {
  /** The author's parts: a saved recipe's, or an import's before it is saved. */
  parts: readonly StyleSourcePart[];
  /** One restyle over those parts with the ticked statements. */
  run: (ruleIds: string[]) => Promise<StyleAnswer>;
  /** The guide; the server's by default, a fixture in a test. */
  loadRules?: () => Promise<StyleRule[]>;
};

export type StyleView = "styled" | "original";

export function useStyleSpace({ parts, run, loadRules }: UseStyleSpaceOptions) {
  const original = useMemo(() => styleOriginal(parts), [parts]);
  const [rules, setRules] = useState<StyleRule[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [answer, setAnswer] = useState<StyleAnswer | null>(null);
  const [choices, setChoices] = useState<StyleChoices | null>(null);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<StyleView>("styled");
  const [comparing, setComparing] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const live = useRef(true);

  const start = async (ruleIds: string[]) => {
    setRunning(true);
    setError(null);
    setPanelOpen(false);
    setEditing(null);
    setComparing(new Set());
    try {
      const next = await run(ruleIds);
      if (!live.current) return;
      setAnswer(next);
      setChoices(initialChoices(original, next));
    } catch (cause) {
      if (live.current) setError(messageFrom(cause));
    } finally {
      if (live.current) setRunning(false);
    }
  };

  // The run starts on arrival with the statements that are on: the space is
  // where the rewrite is looked at, so there is nothing to press first.
  // biome-ignore lint/correctness/useExhaustiveDependencies: arriving is the trigger; the loaders are fixed for the life of the space.
  useEffect(() => {
    live.current = true;
    (loadRules ?? (() => listStyleRules()))()
      .then((loaded) => {
        if (!live.current) return;
        const on = loaded.filter((rule) => rule.enabled).map((rule) => rule.id);
        setRules(loaded);
        setSelected(new Set(on));
        void start(on);
      })
      .catch((cause: unknown) => {
        if (!live.current) return;
        setError(messageFrom(cause));
        setRunning(false);
      });
    return () => {
      live.current = false;
    };
  }, []);

  const assembled = answer && choices ? assemble(original, answer, choices) : null;
  const counts = answer && choices ? choiceCounts(original, answer, choices) : null;
  const saveCheck = assembled ? checkChoices(original, assembled) : null;

  const toggleRule = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const setStep = (p: number, s: number, choice: Choice) =>
    setChoices((current) => (current ? { ...current, steps: { ...current.steps, [stepKey(p, s)]: choice } } : current));

  const setPart = (p: number, choice: Choice) => setChoices((current) => (current && answer ? choosePart(current, original, answer, p, choice) : current));

  const editStep = (key: string, text: string) => setChoices((current) => (current ? { ...current, edits: { ...current.edits, [key]: text } } : current));

  const toggleCompare = (key: string) =>
    setComparing((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return {
    original,
    rules,
    selected,
    answer,
    choices,
    running,
    error,
    view,
    comparing,
    editing,
    panelOpen,
    assembled,
    counts,
    saveCheck,
    /** What Save writes: the assembled parts, or null when nothing differs from the author's. */
    toSave: assembled && changesAnything(original, assembled) ? assembled : null,
    setView,
    setEditing,
    setPanelOpen,
    toggleRule,
    setStep,
    setPart,
    editStep,
    toggleCompare,
    runAgain: () => void start([...selected]),
  };
}
