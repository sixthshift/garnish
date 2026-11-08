// A step and the ingredients it uses, lit together on a desktop's recipe
// (decisions.md row 207): pointing at a step lights the rows it links in the
// list, pointing at a row lights the steps that use it and dims the rest, and
// focus does what the pointer does. Outside the provider (a phone's page)
// nothing lights.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { PartIngredients } from "../../../../../src/domain/recipes/components/recipe/IngredientList";
import { PartSteps } from "../../../../../src/domain/recipes/components/recipe/PartSteps";
import { StepLinksProvider, stepLinkMaps } from "../../../../../src/domain/recipes/components/recipe/StepLinks";
import type { Ingredient, Part } from "../../../../../src/domain/recipes/recipe";

const row = (id: string, name: string): Ingredient => ({
  id,
  quantity: 1,
  quantityMax: null,
  unit: null,
  food: { id: `food-${id}`, name, pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] },
  note: "",
  originalText: "",
  fixed: false,
  alternatives: [],
});

const part: Part = {
  id: "part",
  name: "",
  ingredients: [row("rice", "rice"), row("egg", "egg"), row("peas", "peas")],
  steps: [
    { id: "s1", title: "", text: "Scramble the egg.", summary: "", ingredientIds: ["egg"], image: null },
    { id: "s2", title: "", text: "Fry the rice with the egg.", summary: "", ingredientIds: ["rice", "egg"], image: null },
    { id: "s3", title: "", text: "Serve.", summary: "", ingredientIds: [], image: null },
  ],
};

function Page({ linked = true }: { linked?: boolean }) {
  const body = (
    <>
      <PartIngredients part={part} recipeId="recipe" />
      <PartSteps part={part} recipeId="recipe" ingredients={part.ingredients} />
    </>
  );
  return linked ? <StepLinksProvider recipe={{ parts: [part] }}>{body}</StepLinksProvider> : body;
}

/** The ingredients list's row for `food`, not the copy a step card repeats. */
const listRow = (food: string) => {
  const list = screen.getAllByRole("list", { name: "Ingredients" })[0]!;
  const tick = [...list.querySelectorAll<HTMLElement>('[data-testid="ingredient-row"]')].find((item) => item.textContent?.includes(food));
  if (tick === undefined) throw new Error(`no row for ${food}`);
  return tick;
};
const steps = () => screen.getAllByTestId("step-card");
const lit = (element: HTMLElement) => element.getAttribute("data-lit");

describe("lighting a step's ingredients and an ingredient's steps", () => {
  test("pointing at a step lights the rows it uses, and only those", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.hover(steps()[1]!);
    expect(lit(listRow("rice"))).toBe("true");
    expect(lit(listRow("egg"))).toBe("true");
    expect(lit(listRow("peas"))).toBeNull();
    await user.unhover(steps()[1]!);
    expect(lit(listRow("rice"))).toBeNull();
  });

  test("pointing at a row lights the steps that use it and dims the others", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.hover(listRow("egg"));
    expect(steps().map(lit)).toEqual(["lit", "lit", "dim"]);
    expect(lit(listRow("egg"))).toBe("true");
    await user.hover(listRow("rice"));
    expect(steps().map(lit)).toEqual(["dim", "lit", "dim"]);
  });

  test("a row no step uses lights nothing and dims nothing", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.hover(listRow("peas"));
    expect(steps().map(lit)).toEqual([null, null, null]);
    expect(lit(listRow("peas"))).toBeNull();
  });

  test("focus lights as the pointer does, so a keyboard gets it too", async () => {
    const user = userEvent.setup();
    render(<Page />);
    // Tab to the first row's tick box: rice, used by the second step.
    await user.tab();
    expect(listRow("rice")).toContainElement(document.activeElement as HTMLElement);
    expect(steps().map(lit)).toEqual(["dim", "lit", "dim"]);
    // On to its own text: still the same row, still lit.
    await user.tab();
    expect(steps().map(lit)).toEqual(["dim", "lit", "dim"]);
  });

  test("the link is on the page without pointing at anything: a step card lists its own rows", () => {
    render(<Page />);
    const [, second] = steps();
    expect(second).toHaveTextContent("rice");
    expect(second).toHaveTextContent("egg");
  });

  test("outside the provider, a phone's page, nothing lights", async () => {
    const user = userEvent.setup();
    render(<Page linked={false} />);
    await user.hover(listRow("egg"));
    expect(steps().map(lit)).toEqual([null, null, null]);
    expect(lit(listRow("egg"))).toBeNull();
  });
});

test("stepLinkMaps reads both ways across parts (decisions.md row 228), and skips a link to a row the recipe lacks", () => {
  const other: Part = {
    ...part,
    id: "other",
    ingredients: [row("salt", "salt")],
    steps: [{ ...part.steps[0]!, id: "s9", ingredientIds: ["salt", "egg", "gone"] }],
  };
  const { stepsOf, ingredientsOf } = stepLinkMaps({ parts: [part, other] });
  expect([...(stepsOf.get("egg") ?? [])]).toEqual(["s1", "s2", "s9"]);
  expect([...(ingredientsOf.get("s2") ?? [])]).toEqual(["rice", "egg"]);
  expect([...(ingredientsOf.get("s9") ?? [])]).toEqual(["salt", "egg"]);
  expect(ingredientsOf.has("s3")).toBe(false);
});
