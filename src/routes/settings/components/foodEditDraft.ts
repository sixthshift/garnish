import type { FoodConversion, FoodConversionInput } from "../../../domain/reference";

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
