// The house style document (M37.2): the statements' schemas, the one caveat the
// Settings tab prints, and what a run would use.
import { describe, expect, test } from "vitest";
import { DEFAULT_STYLE_RULES } from "../../../src/db/seed/style";
import {
  enabledRules,
  type StyleRule,
  StyleRuleCreate,
  StyleRuleReorder,
  StyleRuleUpdate,
  styleRuleNote,
  styleRuleSchema,
} from "../../../src/domain/style/style";

function rule(text: string, enabled: boolean, position = 0): StyleRule {
  return {
    id: "00000000-0000-4000-8000-00000000000" + position,
    position,
    text,
    enabled,
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  };
}

describe("styleRuleSchema", () => {
  test("accepts a full row and defaults `enabled` to on", () => {
    const row = rule("One action per step.", true);
    expect(styleRuleSchema.parse(row)).toEqual(row);
    const { enabled: _enabled, ...without } = row;
    expect(styleRuleSchema.parse(without).enabled).toBe(true);
  });

  test("rejects an empty statement and a non-uuid id", () => {
    expect(styleRuleSchema.safeParse({ ...rule("", true) }).success).toBe(false);
    expect(styleRuleSchema.safeParse({ ...rule("x", true), id: "nope" }).success).toBe(false);
  });
});

describe("input schemas", () => {
  test("create trims the text and rejects a blank one", () => {
    expect(StyleRuleCreate.parse({ text: "  No chatter.  " })).toEqual({ text: "No chatter." });
    expect(StyleRuleCreate.safeParse({ text: "   " }).success).toBe(false);
  });

  test("update takes any one field beside the id", () => {
    expect(StyleRuleUpdate.parse({ id: "r1", enabled: false })).toEqual({ id: "r1", enabled: false });
    expect(StyleRuleUpdate.safeParse({ enabled: false }).success).toBe(false);
    expect(StyleRuleUpdate.safeParse({ id: "r1", position: 1.5 }).success).toBe(false);
  });

  test("reorder is a list of ids, possibly empty", () => {
    expect(StyleRuleReorder.parse({ ids: ["a", "b"] })).toEqual({ ids: ["a", "b"] });
    expect(StyleRuleReorder.parse({ ids: [] })).toEqual({ ids: [] });
  });
});

describe("styleRuleNote", () => {
  test("the metric statement carries the facts-check caveat, matched case- and space-insensitively", () => {
    const metric = DEFAULT_STYLE_RULES.find((r) => r.text.startsWith("Prefer metric"))!.text;
    expect(styleRuleNote(metric)).toMatch(/imperial/);
    expect(styleRuleNote(`  ${metric.toUpperCase()}  `)).toBe(styleRuleNote(metric));
  });

  test("every other seeded statement, and anything reworded, has none", () => {
    const noted = DEFAULT_STYLE_RULES.filter((r) => styleRuleNote(r.text) !== null);
    expect(noted).toHaveLength(1);
    expect(styleRuleNote("Prefer metric, mostly.")).toBeNull();
    expect(styleRuleNote("")).toBeNull();
  });
});

describe("enabledRules", () => {
  test("keeps the switched-on statements in order", () => {
    const rules = [rule("a", true, 0), rule("b", false, 1), rule("c", true, 2)];
    expect(enabledRules(rules).map((r) => r.text)).toEqual(["a", "c"]);
    expect(enabledRules([])).toEqual([]);
  });
});

describe("the seeded guide", () => {
  test("is fourteen statements, the first ten on and the last four off, all distinct", () => {
    expect(DEFAULT_STYLE_RULES).toHaveLength(14);
    expect(DEFAULT_STYLE_RULES.map((r) => r.enabled)).toEqual([...Array(10).fill(true), ...Array(4).fill(false)]);
    const texts = DEFAULT_STYLE_RULES.map((r) => r.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
    for (const r of DEFAULT_STYLE_RULES) expect(r.text).toBe(r.text.trim());
  });
});
