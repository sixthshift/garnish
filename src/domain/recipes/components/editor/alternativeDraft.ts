// A line's alternatives as they are typed (decisions.md row 199): foods by
// name, amounts as text, until Done checks them and the sheet resolves the
// names to foods.

/** The Select value for "no unit". */
export const NO_UNIT = "none";

/** One thing that goes in, as it is typed. `unitId` is `NO_UNIT` for none. */
export type AlternativeItemDraft = { key: string; quantity: string; unitId: string; food: string };

/** One alternative as it is typed: a blank basis amount is a straight swap. */
export type AlternativeDraft = {
  key: string;
  basisQuantity: string;
  basisUnitId: string;
  note: string;
  planPicks: boolean;
  items: AlternativeItemDraft[];
};

/** An alternative as typed, checked: numbers and nulls, the food still a name. */
export type ParsedAlternative = {
  basisQuantity: number | null;
  basisUnitId: string | null;
  note: string;
  planPicks: boolean;
  items: { quantity: number | null; unitId: string | null; food: string }[];
};

const key = () => crypto.randomUUID();

/** A blank item row on `unitId` (the line's own unit, so "400" means 400 of what the line is in). Not pure: it mints a key. */
export function blankItem(unitId: string = NO_UNIT): AlternativeItemDraft {
  return { key: key(), quantity: "", unitId, food: "" };
}

/** A blank alternative with one blank item. Not pure: it mints keys. */
export function blankAlternative(unitId: string = NO_UNIT): AlternativeDraft {
  return { key: key(), basisQuantity: "", basisUnitId: NO_UNIT, note: "", planPicks: false, items: [blankItem(unitId)] };
}

/** A stored alternative as the editor holds it. Not pure: it mints keys. */
export function alternativeDraft(source: ParsedAlternative): AlternativeDraft {
  return {
    key: key(),
    basisQuantity: source.basisQuantity === null ? "" : String(source.basisQuantity),
    basisUnitId: source.basisUnitId ?? NO_UNIT,
    note: source.note,
    planPicks: source.planPicks,
    items: source.items.map((item) => ({
      key: key(),
      quantity: item.quantity === null ? "" : String(item.quantity),
      unitId: item.unitId ?? NO_UNIT,
      food: item.food,
    })),
  };
}

/** A typed amount: blank is none, else a number not below zero (above it when `positive`), or undefined when it is not one. */
function amount(text: string, positive: boolean): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || (positive && value === 0)) return undefined;
  return value;
}

/**
 * Draft alternatives as they are written, or the first thing wrong with them.
 * An item with no food is dropped, and an alternative left with none is
 * dropped with it: a blank row is no alternative. An amount that is not a
 * number, a basis unit with no basis amount, or one the plan picks that is
 * more than one food, is refused. Pure.
 */
export function parseAlternatives(drafts: readonly AlternativeDraft[]): { alternatives: ParsedAlternative[]; error: string | null } {
  const alternatives: ParsedAlternative[] = [];
  for (const draft of drafts) {
    const items: ParsedAlternative["items"] = [];
    for (const item of draft.items) {
      const food = item.food.trim();
      if (food === "") continue;
      const quantity = amount(item.quantity, false);
      if (quantity === undefined) return { alternatives: [], error: `The amount of ${food} must be a number.` };
      items.push({ quantity, unitId: item.unitId === NO_UNIT ? null : item.unitId, food });
    }
    if (items.length === 0) continue;
    const basisQuantity = amount(draft.basisQuantity, true);
    if (basisQuantity === undefined) return { alternatives: [], error: "“Per” must be a number above zero." };
    const basisUnitId = draft.basisUnitId === NO_UNIT ? null : draft.basisUnitId;
    if (basisQuantity === null && basisUnitId !== null) return { alternatives: [], error: "“Per” needs an amount, or no unit." };
    if (draft.planPicks && items.length > 1) return { alternatives: [], error: "The plan can only pick an alternative that is one food." };
    alternatives.push({ basisQuantity, basisUnitId, note: draft.note.trim(), planPicks: draft.planPicks, items });
  }
  return { alternatives, error: null };
}
