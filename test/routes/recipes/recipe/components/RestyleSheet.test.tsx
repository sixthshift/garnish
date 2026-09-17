// The restyle sheet (M37.6): its pure payload builders, and what
// RestyleSheetContent renders in each of its two stages. Static render only
// (no jsdom in this project's vitest config), so the sheet's content is
// rendered directly with `renderToString` and its callbacks are called by
// hand, the way the other sheet tests do it.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Part, Recipe, Step } from "../../../../../src/domain/recipe";
import { checkRestyle, type StyleRule } from "../../../../../src/domain/style";
import { RestyleSheetContent } from "../../../../../src/routes/recipes/recipe/components/RestyleSheetContent";
import {
  type ApplyPart,
  applyPayload,
  enabledRuleIds,
  initialTicked,
  missingLine,
  partHeading,
  type RestyleAnswer,
} from "../../../../../src/routes/recipes/recipe/components/restylePayload";

let n = 0;
function step(text: string): Step {
  n += 1;
  return { id: `step-${n}`, text, ingredientIds: [], image: null };
}

function part(name: string, steps: string[]): Part {
  return { id: `part-${name || "main"}`, name, ingredients: [], steps: steps.map(step) };
}

function recipeWith(parts: Part[], restyledAt: string | null = null): Recipe {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "ragu",
    name: "Ragu",
    description: "",
    image: null,
    rating: null,
    lastMade: null,
    favourite: false,
    recipeServings: 4,
    recipeYieldQuantity: 0,
    yieldUnit: null,
    recipeYield: "",
    prepTime: null,
    performTime: null,
    sourceUrl: null,
    notes: [],
    tags: [],
    parts,
    restyledAt,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function rule(id: string, text: string, enabled: boolean, position: number): StyleRule {
  return {
    id,
    position,
    text,
    enabled,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const rules: StyleRule[] = [
  rule("rule-1", "One action per step.", true, 0),
  rule("rule-2", "Imperative voice, starting with the verb.", true, 1),
  rule("rule-3", "Prefer metric.", false, 2),
];

/** The content with everything defaulted, so a test only says what it cares about. */
function content(overrides: Partial<Parameters<typeof RestyleSheetContent>[0]> = {}) {
  const props = {
    recipe: recipeWith([part("", ["Heat the oven to 180°C.", "Bake for 30 minutes."])]),
    rules,
    selected: new Set(enabledRuleIds(rules)),
    onToggleRule: () => {},
    answer: null,
    ticked: new Set<number>(),
    onTogglePart: () => {},
    onRestyle: () => {},
    onApply: () => {},
    onRestore: () => {},
    onBack: () => {},
    onCancel: () => {},
    ...overrides,
  };
  return { props, html: renderToString(<RestyleSheetContent {...props} />) };
}

describe("enabledRuleIds", () => {
  test("is the statements the guide has on, in the guide's order", () => {
    expect(enabledRuleIds(rules)).toEqual(["rule-1", "rule-2"]);
  });

  test("is empty when nothing is on", () => {
    expect(enabledRuleIds(rules.map((r) => ({ ...r, enabled: false })))).toEqual([]);
  });
});

describe("initialTicked", () => {
  test("ticks the parts whose facts check passed and leaves the failures off", () => {
    const check = {
      ok: false,
      missingFacts: ["180c"],
      missingFoods: [],
      addedNumbers: [],
      parts: [
        { name: "", ok: true, missingFacts: [], missingFoods: [], addedNumbers: [] },
        { name: "Sauce", ok: false, missingFacts: ["180c"], missingFoods: [], addedNumbers: [] },
        { name: "To serve", ok: true, missingFacts: [], missingFoods: [], addedNumbers: [] },
      ],
    };
    expect([...initialTicked(check)].sort()).toEqual([0, 2]);
  });
});

describe("applyPayload", () => {
  const original = [part("", ["Heat the oven to 180°C.", "Bake for 30 minutes."]), part("Sauce", ["Fry the onion.", "Simmer."])];
  const restyled = [
    { name: "", steps: ["Heat the oven to 180°C, then bake for 30 minutes."] },
    { name: "Sauce", steps: ["Fry the onion, then simmer."] },
  ];

  test("a ticked part takes the rewrite whole, even where the step counts differ", () => {
    expect(applyPayload(original, restyled, new Set([0, 1]))).toEqual<ApplyPart[]>([
      { name: "", steps: ["Heat the oven to 180°C, then bake for 30 minutes."] },
      { name: "Sauce", steps: ["Fry the onion, then simmer."] },
    ]);
  });

  test("an unticked part keeps its own steps, and is still sent", () => {
    expect(applyPayload(original, restyled, new Set([1]))).toEqual<ApplyPart[]>([
      { name: "", steps: ["Heat the oven to 180°C.", "Bake for 30 minutes."] },
      { name: "Sauce", steps: ["Fry the onion, then simmer."] },
    ]);
  });

  test("nothing ticked sends the recipe back unchanged", () => {
    expect(applyPayload(original, restyled, new Set())).toEqual<ApplyPart[]>([
      { name: "", steps: ["Heat the oven to 180°C.", "Bake for 30 minutes."] },
      { name: "Sauce", steps: ["Fry the onion.", "Simmer."] },
    ]);
  });

  test("a part the answer has no rewrite for keeps its own steps", () => {
    expect(applyPayload(original, restyled.slice(0, 1), new Set([0, 1]))[1]).toEqual({ name: "Sauce", steps: ["Fry the onion.", "Simmer."] });
  });

  test("the part's name is always the recipe's own, never the answer's", () => {
    const renamed = [
      { name: "MAIN", steps: ["One."] },
      { name: "sauce", steps: ["Two."] },
    ];
    expect(applyPayload(original, renamed, new Set([0, 1])).map((p) => p.name)).toEqual(["", "Sauce"]);
  });
});

describe("partHeading and missingLine", () => {
  test("the unnamed part is the method", () => {
    expect(partHeading("")).toBe("Method");
    expect(partHeading(" Sauce ")).toBe("Sauce");
  });

  test("names the dropped numbers and the dropped foods", () => {
    const line = missingLine({ name: "", ok: false, missingFacts: ["180c", "30min"], missingFoods: ["onion"], addedNumbers: [] });
    expect(line).toContain("180c");
    expect(line).toContain("30min");
    expect(line).toContain("onion");
  });
});

describe("the rules stage", () => {
  test("lists every statement, ticked from the guide's own switches", () => {
    const { html } = content();
    expect(html).toContain('data-testid="restyle-rules"');
    expect(html).toContain("One action per step.");
    expect(html).toContain("Prefer metric.");
    expect((html.match(/data-testid="restyle-rule"/g) ?? []).length).toBe(3);
    expect((html.match(/data-on="true"/g) ?? []).length).toBe(2);
    expect((html.match(/data-on="false"/g) ?? []).length).toBe(1);
  });

  test("Restyle asks for the ticked statements, and toggling one reports it", () => {
    const toggled: string[] = [];
    let ran = 0;
    const { props, html } = content({ onToggleRule: (id: string) => toggled.push(id), onRestyle: () => (ran += 1) });
    expect(html).toContain('data-testid="restyle-run"');
    props.onToggleRule("rule-3");
    props.onRestyle();
    expect(toggled).toEqual(["rule-3"]);
    expect(ran).toBe(1);
  });

  test("busy says so and there is no diff yet", () => {
    const { html } = content({ busy: true });
    expect(html).toContain("Restyling…");
    expect(html).not.toContain('data-testid="restyle-diff"');
  });

  test("an error shows inline", () => {
    const { html } = content({ error: "The model could not be reached." });
    expect(html).toContain("The model could not be reached.");
    expect(html).toContain('role="alert"');
  });

  test("Restore original steps only appears once the recipe has been restyled", () => {
    expect(content().html).not.toContain('data-testid="restyle-restore"');
    const restyled = content({ recipe: recipeWith([part("", ["Bake."])], "2026-09-14T02:00:00.000Z") });
    expect(restyled.html).toContain("Restore original steps");
    expect(restyled.html).toContain('data-testid="restyle-restore-button"');
  });
});

describe("the diff stage", () => {
  const recipe = recipeWith([part("", ["Heat the oven to 180°C.", "Bake for 30 minutes."]), part("Sauce", ["Fry the onion for 5 minutes."])]);
  // The second part's rewrite drops the 5 minutes, so M37.3 fails it.
  const restyled = [
    { name: "", steps: ["Heat the oven to 180°C, then bake for 30 minutes."] },
    { name: "Sauce", steps: ["Fry the onion until soft."] },
  ];
  const answer: RestyleAnswer = { parts: restyled, check: checkRestyle(recipe.parts, restyled) };

  test("shows every part's original beside its rewrite", () => {
    const { html } = content({ recipe, answer, ticked: initialTicked(answer.check) });
    expect(html).toContain('data-testid="restyle-diff"');
    expect((html.match(/data-testid="restyle-part"/g) ?? []).length).toBe(2);
    expect(html).toContain("Method");
    expect(html).toContain("Sauce");
    expect(html).toContain("Heat the oven to 180°C.");
    expect(html).toContain("Heat the oven to 180°C, then bake for 30 minutes.");
    expect(html).toContain("Fry the onion until soft.");
  });

  test("the failed part names what the rewrite dropped and starts unticked", () => {
    const ticked = initialTicked(answer.check);
    expect([...ticked]).toEqual([0]);
    const { html } = content({ recipe, answer, ticked });
    expect(html).toContain('data-testid="restyle-part-warning"');
    expect(html).toContain("5min");
    expect(html).toContain('data-ticked="true"');
    expect(html).toContain('data-ticked="false"');
  });

  test("Apply sends the ticked part's rewrite and the unticked part's own steps", () => {
    const sent: ApplyPart[][] = [];
    const { props } = content({ recipe, answer, ticked: initialTicked(answer.check), onApply: (parts: ApplyPart[]) => sent.push(parts) });
    props.onApply(applyPayload(recipe.parts, answer.parts, initialTicked(answer.check)));
    expect(sent).toEqual([
      [
        { name: "", steps: ["Heat the oven to 180°C, then bake for 30 minutes."] },
        { name: "Sauce", steps: ["Fry the onion for 5 minutes."] },
      ],
    ]);
  });

  test("Back returns to the statements and Restore is not offered mid-diff", () => {
    let back = 0;
    const { props, html } = content({ recipe, answer, ticked: new Set([0]), onBack: () => (back += 1) });
    expect(html).toContain("Back");
    expect(html).not.toContain('data-testid="restyle-restore"');
    props.onBack();
    expect(back).toBe(1);
  });
});
