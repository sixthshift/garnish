// The Style space's state: the guide read and run once on arrival, the answer, and the household's choices over it.

import { useEffect, useMemo, useRef, useState } from "react";
import { listStyleRules } from "../../../../api/rpc/style";
import { messageFrom } from "../../../../lib/errors";
import type { StyleRule } from "../../style";
import {
  answerFindings,
  assemble,
  asWritten,
  type Choice,
  changesAnything,
  checkChoices,
  initialChoices,
  isRebuilt,
  type StyleAnswer,
  type StyleChoices,
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

export function useStyleSpace({ parts, run, loadRules }: UseStyleSpaceOptions) {
  const original = useMemo(() => styleOriginal(parts), [parts]);
  const [rules, setRules] = useState<StyleRule[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [answer, setAnswer] = useState<StyleAnswer | null>(null);
  const [choices, setChoices] = useState<StyleChoices | null>(null);
  const [running, setRunning] = useState(true);
  // Where a run has got to, for the wait: the guide being read, then the model rewriting; and when it began.
  const [stage, setStage] = useState<"rules" | "rewrite">("rules");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const live = useRef(true);

  const start = async (ruleIds: string[]) => {
    setRunning(true);
    setStage("rewrite");
    setError(null);
    setPanelOpen(false);
    setEditing(null);
    try {
      const next = await run(ruleIds);
      if (!live.current) return;
      setAnswer(next);
      setChoices(initialChoices());
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
  // The two versions side by side: the author's, and the rewrite as it would be saved, retyped steps and all.
  const author = useMemo(() => asWritten(original), [original]);
  const rewrite = answer && choices ? assemble(original, answer, { ...choices, recipe: "rewrite" }) : null;
  const saveCheck = assembled && choices?.recipe === "rewrite" ? checkChoices(original, assembled) : null;

  /** Run again from the top: the wait counts from now. */
  const again = () => {
    setStartedAt(Date.now());
    void start([...selected]);
  };

  const toggleRule = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const setRecipe = (choice: Choice) => setChoices((current) => (current ? { ...current, recipe: choice } : current));

  const editStep = (key: string, text: string) => setChoices((current) => (current ? { ...current, edits: { ...current.edits, [key]: text } } : current));

  return {
    original,
    /** Whether the rewrite laid the recipe out afresh, in new parts. */
    rebuilt: answer !== null && isRebuilt(original, answer),
    author,
    rewrite,
    /** How many times the rewrite was sent back with what the checks found and the revision taken; 0 when never. */
    revised: answer?.revisions?.filter((revision) => revision.taken).length ?? 0,
    /** What the checks found in the rewrite as it now stands. */
    findings: answer ? answerFindings(original, answer, rewrite ? checkChoices(original, rewrite) : answer.check) : [],
    /** Whether the rewrite says anything the author's recipe does not. */
    changed: rewrite !== null && changesAnything(original, rewrite),
    rules,
    selected,
    answer,
    choices,
    running,
    stage,
    startedAt,
    error,
    editing,
    panelOpen,
    assembled,
    saveCheck,
    /** What Save writes: the assembled parts, or null when nothing differs from the author's. */
    toSave: assembled && changesAnything(original, assembled) ? assembled : null,
    setEditing,
    setPanelOpen,
    toggleRule,
    setRecipe,
    editStep,
    runAgain: again,
  };
}
