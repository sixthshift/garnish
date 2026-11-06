import type { FoodConversion, FoodPack, Unit } from "../../../../../domain/recipes/reference";

/** A cell of the foods grid that edits in place: the name, the aliases, the aisle. */
export type GridField = "name" | "aliases" | "aisle";

/** What a cell's edit button and its field are called, for the keyboard and a screen reader. */
export const FIELD_LABEL: Record<GridField, string> = { name: "name", aliases: "also called", aisle: "aisle" };

/**
 * Aliases as one cell types them: comma-separated, each trimmed, blanks and
 * repeats (ignoring case) dropped. A comma rather than the sheet's one per
 * line, since a cell is one line. Pure.
 */
export function parseAliasList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const alias = raw.trim();
    const key = alias.toLowerCase();
    if (alias === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
  }
  return out;
}

/** An amount as the grid prints it: no trailing zeros, at most two places. Pure. */
function amount(value: number): string {
  return String(Number(value.toFixed(2)));
}

function unitText(units: readonly Unit[], id: string | null): string {
  if (id === null) return "each";
  const unit = units.find((candidate) => candidate.id === id);
  if (unit === undefined) return "";
  return unit.abbreviation !== "" ? unit.abbreviation : unit.name;
}

/** "250 g, 500 g": the sizes a food is sold in (decisions.md row 184), smallest first, or "" for none. Pure. */
export function packsText(packs: readonly FoodPack[], units: readonly Unit[]): string {
  return [...packs]
    .sort((a, b) => a.quantity - b.quantity)
    .map((pack) => `${amount(pack.quantity)} ${unitText(units, pack.unitId)}`.trim())
    .join(", ");
}

/** "1 cup = 125 g; 1 tbsp = 8 g": a food's conversions, or "" for none. Pure. */
export function conversionsText(conversions: readonly FoodConversion[], units: readonly Unit[]): string {
  return conversions
    .map(
      (conversion) =>
        `${amount(conversion.quantity)} ${unitText(units, conversion.unitId)} = ${amount(conversion.toQuantity)} ${unitText(units, conversion.toUnitId)}`
    )
    .join("; ");
}
