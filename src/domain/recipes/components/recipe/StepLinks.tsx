import { createContext, type FocusEvent, type ReactNode, useContext, useMemo, useState } from "react";
import type { Recipe } from "../../recipe";

// A step and the ingredients it uses, lit together (decisions.md row 207):
// pointing at a step lights the rows it links in the ingredients list, and
// pointing at a row lights the steps that use it and dims the rest. Focus does
// the same as the pointer, so a keyboard gets it too. Nothing is said only
// here: a step card lists its own rows (StepCard), so the link is on the page
// whether or not anything is lit.

/** How a lit row or step looks: the highlighter's yellow, with a mark down its edge so it reads without the colour. */
export const LIT = "bg-bg-warning-subtle shadow-[inset_3px_0_0_var(--color-bg-warning)]";

type Pointed = { kind: "step" | "ingredient"; id: string } | null;

type StepLinksValue = {
  /** Ingredient id to the ids of the steps that link it. */
  stepsOf: ReadonlyMap<string, ReadonlySet<string>>;
  /** Step id to the ids of the ingredients it links. */
  ingredientsOf: ReadonlyMap<string, ReadonlySet<string>>;
  pointed: Pointed;
  point: (next: Pointed) => void;
};

const StepLinksContext = createContext<StepLinksValue | null>(null);

/** Both directions of the recipe's step-ingredient links; a step may link a row of any part (decisions.md row 228). Pure. */
export function stepLinkMaps(recipe: Pick<Recipe, "parts">): Pick<StepLinksValue, "stepsOf" | "ingredientsOf"> {
  const stepsOf = new Map<string, Set<string>>();
  const ingredientsOf = new Map<string, Set<string>>();
  const rows = new Set(recipe.parts.flatMap((part) => part.ingredients.map((ingredient) => ingredient.id)));
  for (const part of recipe.parts) {
    for (const step of part.steps) {
      const linked = new Set(step.ingredientIds.filter((id) => rows.has(id)));
      if (linked.size === 0) continue;
      ingredientsOf.set(step.id, linked);
      for (const id of linked) {
        const steps = stepsOf.get(id) ?? new Set<string>();
        steps.add(step.id);
        stepsOf.set(id, steps);
      }
    }
  }
  return { stepsOf, ingredientsOf };
}

/** Lights a recipe's steps and ingredients together inside it. Without it, the rows and steps below light nothing. */
export function StepLinksProvider({ recipe, children }: { recipe: Pick<Recipe, "parts">; children: ReactNode }) {
  const maps = useMemo(() => stepLinkMaps(recipe), [recipe]);
  const [pointed, point] = useState<Pointed>(null);
  const value = useMemo(() => ({ ...maps, pointed, point }), [maps, pointed]);
  return <StepLinksContext value={value}>{children}</StepLinksContext>;
}

/** What a row or a step spreads on itself: the pointer and focus, in and out. */
type PointProps = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
};

function pointProps(links: StepLinksValue, kind: "step" | "ingredient", id: string): PointProps {
  const enter = () => links.point({ kind, id });
  const leave = () => links.point(null);
  return {
    onMouseEnter: enter,
    onMouseLeave: leave,
    onFocus: enter,
    // Focus moving between the row's own controls (its tick and its text) is not leaving it.
    onBlur: (event) => {
      if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) leave();
    },
  };
}

/**
 * An ingredient row's part in the lighting: lit when a step that uses it is
 * pointed at, or when it is pointed at itself and some step uses it. `id`
 * undefined (a merged summary row, or a row repeated inside a step card) takes
 * no part.
 */
export function useIngredientLink(id: string | undefined): { linking: boolean; lit: boolean; props: PointProps | Record<string, never> } {
  const links = useContext(StepLinksContext);
  if (links === null || id === undefined) return { linking: false, lit: false, props: {} };
  const { pointed } = links;
  const lit =
    pointed !== null &&
    ((pointed.kind === "ingredient" && pointed.id === id && links.stepsOf.has(id)) ||
      (pointed.kind === "step" && (links.ingredientsOf.get(pointed.id)?.has(id) ?? false)));
  return { linking: true, lit, props: pointProps(links, "ingredient", id) };
}

/**
 * A step's part in the lighting: while an ingredient some step uses is
 * pointed at, `lit` if this step uses it and `dim` if not; otherwise neither.
 */
export function useStepLink(id: string): { linking: boolean; state: "lit" | "dim" | null; props: PointProps | Record<string, never> } {
  const links = useContext(StepLinksContext);
  if (links === null) return { linking: false, state: null, props: {} };
  const { pointed } = links;
  const using = pointed?.kind === "ingredient" ? links.stepsOf.get(pointed.id) : undefined;
  const state = using === undefined ? null : using.has(id) ? "lit" : "dim";
  return { linking: true, state, props: pointProps(links, "step", id) };
}
