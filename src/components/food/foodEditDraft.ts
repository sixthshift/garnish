import type { FoodConversion, FoodConversionInput, FoodPack, FoodPackInput } from "../../domain/reference";

/** Aliases as they are edited: one per line, blank lines dropped, each trimmed. Pure. */
export function parseAliases(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** Aliases as the textarea shows them. Pure. */
export function aliasesText(aliases: readonly string[]): string {
  return aliases.join("\n");
}

/** One conversion as it is being typed: every field a string, including the amounts. */
export type ConversionDraft = { key: string; quantity: string; unitId: string; toQuantity: string; toUnitId: string };

/** A stored conversion as the editor holds it. Pure. */
export function conversionDraft(conversion: FoodConversion): ConversionDraft {
  return {
    key: conversion.id,
    quantity: String(conversion.quantity),
    unitId: conversion.unitId,
    toQuantity: String(conversion.toQuantity),
    toUnitId: conversion.toUnitId,
  };
}

/** A blank row, ready to type into. Not pure — it mints a key. */
export function blankConversion(): ConversionDraft {
  return { key: crypto.randomUUID(), quantity: "", unitId: "", toQuantity: "", toUnitId: "" };
}

/** True when nothing has been typed into the row yet: it is dropped on save rather than rejected. Pure. */
export function isBlankConversion(row: ConversionDraft): boolean {
  return row.quantity.trim() === "" && row.unitId === "" && row.toQuantity.trim() === "" && row.toUnitId === "";
}

/**
 * Draft rows as they are written, or the first thing wrong with them. Blank
 * rows are dropped; a half-filled row, a non-positive amount, a row converting
 * a unit to itself and a repeated pair of units are all refused, the last
 * because the table's UNIQUE would refuse it anyway. Pure.
 */
export function parseConversions(rows: readonly ConversionDraft[]): { conversions: FoodConversionInput[]; error: string | null } {
  const conversions: FoodConversionInput[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (isBlankConversion(row)) continue;
    const quantity = Number(row.quantity.trim());
    const toQuantity = Number(row.toQuantity.trim());
    if (row.quantity.trim() === "" || row.toQuantity.trim() === "" || row.unitId === "" || row.toUnitId === "") {
      return { conversions: [], error: "Every conversion needs two amounts and two units." };
    }
    if (!Number.isFinite(quantity) || !Number.isFinite(toQuantity) || quantity <= 0 || toQuantity <= 0) {
      return { conversions: [], error: "Conversion amounts must be numbers above zero." };
    }
    if (row.unitId === row.toUnitId) return { conversions: [], error: "A conversion needs two different units." };
    const pair = `${row.unitId}>${row.toUnitId}`;
    if (seen.has(pair)) return { conversions: [], error: "There is more than one conversion between the same two units." };
    seen.add(pair);
    conversions.push({ unitId: row.unitId, quantity, toUnitId: row.toUnitId, toQuantity });
  }
  return { conversions, error: null };
}

// --- Sold in ----------------------------------------------------------------
// The sizes a food is sold in (decisions.md row 184), edited as rows of an
// amount and a unit, where the unit may be "each": the food itself.

/** The unit Select's value for a size counted in the food itself. */
export const EACH = "each";

/** One size as it is being typed. `unitId` is "" until chosen, `EACH` for the food itself. */
export type PackDraft = { key: string; quantity: string; unitId: string };

/** A stored size as the editor holds it. Pure. */
export function packDraft(pack: FoodPack): PackDraft {
  return { key: pack.id, quantity: String(pack.quantity), unitId: pack.unitId ?? EACH };
}

/** A blank row, ready to type into. Not pure — it mints a key. */
export function blankPack(): PackDraft {
  return { key: crypto.randomUUID(), quantity: "", unitId: "" };
}

/**
 * Draft rows as they are written, or the first thing wrong with them. A
 * blank row is dropped; a half-filled row, an amount that is not above zero
 * and the same size twice are refused. Pure.
 */
export function parsePacks(rows: readonly PackDraft[]): { packs: FoodPackInput[]; error: string | null } {
  const packs: FoodPackInput[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const text = row.quantity.trim();
    if (text === "" && row.unitId === "") continue;
    if (text === "" || row.unitId === "") return { packs: [], error: "Every size needs an amount and a unit." };
    const quantity = Number(text);
    if (!Number.isFinite(quantity) || quantity <= 0) return { packs: [], error: "Sizes must be numbers above zero." };
    const key = `${quantity} ${row.unitId}`;
    if (seen.has(key)) return { packs: [], error: "The same size is listed twice." };
    seen.add(key);
    packs.push({ quantity, unitId: row.unitId === EACH ? null : row.unitId });
  }
  return { packs, error: null };
}
