// The plan on a phone (decisions.md row 208), pressed rather than read: the
// header's day buttons bring a day up, the page opens at today, an entry
// swipes right to the next day and left off the plan, and the add sheet stays
// open across adds until Done. The DOM window is a phone's (390 wide).
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PlanWeekView, type PlanWeekViewProps } from "../../../../../src/domain/plan/components/week/PlanWeekView";
import { groupByDay, type PlanEntry, planEntrySchema } from "../../../../../src/domain/plan/plan";
import { noFacets, type RecipeSummary } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";

const MONDAY = "2026-09-14";
const NEXT = "2026-09-21";
const TODAY = "2026-09-16";

const recipe = (over: Partial<RecipeSummary>): RecipeSummary =>
  ({
    image: null,
    totalTime: null,
    lastMade: null,
    tags: [],
    ingredientPreview: [],
    favourite: false,
    rating: null,
    facets: noFacets(),
    ...over,
  }) as RecipeSummary;
const tart = recipe({ id: "11111111-1111-4111-8111-111111111111", slug: "lemon-tart", name: "Lemon tart" });
const dal = recipe({
  id: "22222222-2222-4222-8222-222222222222",
  slug: "dal",
  name: "Red lentil dal",
  facets: { ...noFacets(), week: ["weeknight"] },
  lastMade: "2026-08-31T09:00:00.000Z",
});
const laksa = recipe({
  id: "33333333-3333-4333-8333-333333333333",
  slug: "laksa",
  name: "Laksa",
  facets: { ...noFacets(), week: ["weeknight"] },
  lastMade: "2026-07-31T09:00:00.000Z",
});

const soup: PlanEntry = planEntrySchema.parse({
  id: "99999999-9999-4999-8999-000000000001",
  date: TODAY,
  position: 0,
  recipe: { id: "44444444-4444-4444-8444-444444444444", slug: "soup", name: "Pea soup", image: null },
  text: "Pea soup",
});

let scrolled: Element[] = [];
beforeEach(() => {
  scrolled = [];
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this);
  });
});
afterEach(() => {
  vi.useRealTimers();
});

async function plan(over: Partial<PlanWeekViewProps> = {}) {
  const spies = { onAddRecipe: vi.fn(), onAddText: vi.fn(), onMove: vi.fn(), onRemove: vi.fn() };
  await renderInRouter(
    <PlanWeekView
      monday={MONDAY}
      days={groupByDay(MONDAY, [soup])}
      nextDays={groupByDay(NEXT, [])}
      today={TODAY}
      searchRecipes={async () => [tart]}
      shelfRecipes={async () => [tart, dal, laksa]}
      {...spies}
      {...over}
    />
  );
  return spies;
}

test("the page opens at today, under the header", async () => {
  await plan();
  await waitFor(() => expect(scrolled.map((el) => el.id)).toEqual([`plan-day-${TODAY}`]));
});

test("a week without today in it opens at its top", async () => {
  await plan({ monday: NEXT, days: groupByDay(NEXT, []), nextDays: groupByDay("2026-09-28", []) });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(scrolled).toEqual([]);
});

test("the header's seven day buttons bring their day up, today's marked and a planned day's said", async () => {
  const user = userEvent.setup();
  await plan();
  const strip = screen.getByRole("navigation", { name: "Days of the week" });
  expect(within(strip).getAllByRole("button")).toHaveLength(7);
  expect(within(strip).getByRole("button", { name: "Wednesday 16 September, planned" })).toHaveAttribute("aria-current", "date");
  await waitFor(() => expect(scrolled).toHaveLength(1));

  await user.click(within(strip).getByRole("button", { name: "Saturday 19 September" }));
  expect(scrolled.at(-1)?.id).toBe("plan-day-2026-09-19");
  expect(scrolled.at(-1)).toHaveAccessibleName("Saturday 19");
});

/** A finger dragged sideways across the card, as SwipeRow's own test drags it. */
function swipe(el: HTMLElement, by: number) {
  fireEvent.pointerDown(el, { pointerType: "touch", pointerId: 1, clientX: 150, clientY: 10 });
  fireEvent.pointerMove(el, { pointerType: "touch", pointerId: 1, clientX: 170, clientY: 11 });
  fireEvent.pointerMove(el, { pointerType: "touch", pointerId: 1, clientX: 150 + by, clientY: 11 });
  fireEvent.pointerUp(el, { pointerType: "touch", pointerId: 1, clientX: 150 + by, clientY: 11 });
}

test("an entry swiped right is pushed to the next day, at its end", async () => {
  const { onMove, onRemove } = await plan();
  swipe(screen.getByText("Pea soup"), 140);
  await waitFor(() => expect(onMove).toHaveBeenCalledWith(soup, "2026-09-17", 0));
  expect(onRemove).not.toHaveBeenCalled();
});

test("an entry swiped left is taken off", async () => {
  const { onMove, onRemove } = await plan();
  swipe(screen.getByText("Pea soup"), -140);
  await waitFor(() => expect(onRemove).toHaveBeenCalledWith(soup));
  expect(onMove).not.toHaveBeenCalled();
});

test("the menu does what the swipes do, and moves to next week's days too", async () => {
  const user = userEvent.setup();
  const { onMove, onRemove } = await plan();
  await user.click(screen.getByRole("button", { name: "Actions for Pea soup" }));
  expect(screen.getByRole("menuitem", { name: "Move to Mon 21 Sep" })).toBeInTheDocument();
  await user.click(screen.getByRole("menuitem", { name: "Push to Thu 17 Sep" }));
  expect(onMove).toHaveBeenCalledWith(soup, "2026-09-17", 0);
  await user.click(screen.getByRole("button", { name: "Actions for Pea soup" }));
  await user.click(screen.getByRole("menuitem", { name: "Remove" }));
  expect(onRemove).toHaveBeenCalledWith(soup);
});

test("a day gone by does not push: no swipe right and no Push in its menu", async () => {
  const user = userEvent.setup();
  const old = { ...soup, date: "2026-09-15" };
  const { onMove } = await plan({ days: groupByDay(MONDAY, [old]) });
  swipe(screen.getByText("Pea soup"), 140);
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(onMove).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Actions for Pea soup" }));
  expect(screen.queryByRole("menuitem", { name: /^Push to/ })).toBeNull();
});

test("the add sheet stays open across two adds, ticks what it added, and Done closes it back onto the day", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText } = await plan();
  const add = screen.getByRole("button", { name: "Add to Friday 18 September" });
  expect(add).toHaveTextContent("+ Add to Friday");
  await user.click(add);
  const sheet = await screen.findByRole("dialog", { name: "Adding to Friday 18 September" });

  // Weeknight first, the longest since made first, as photo tiles.
  const rotation = await within(sheet).findByRole("list", { name: "Weeknight recipes" });
  const tiles = within(rotation).getAllByRole("button");
  expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual(["Add Laksa to Friday 18 September", "Add Red lentil dal to Friday 18 September"]);

  await user.click(screen.getByRole("button", { name: "Dinner" }));
  await user.click(tiles[0] as HTMLElement);
  expect(onAddRecipe).toHaveBeenCalledWith("2026-09-18", laksa, "dinner");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(within(rotation).getByRole("button", { name: "Laksa, added to Friday 18 September" })).toBeDisabled();

  await user.click(within(rotation).getByRole("button", { name: "Add Red lentil dal to Friday 18 September" }));
  expect(onAddRecipe).toHaveBeenLastCalledWith("2026-09-18", dal, "dinner");
  expect(onAddRecipe).toHaveBeenCalledTimes(2);

  // A note from the box, and the sheet is still open after it too.
  await user.type(within(sheet).getByRole("combobox", { name: "Search recipes, or type a note" }), "Out");
  expect(within(sheet).queryByRole("list", { name: "Weeknight recipes" })).toBeNull();
  await user.click(within(sheet).getByRole("button", { name: "Add “Out” as a note" }));
  expect(onAddText).toHaveBeenCalledWith("2026-09-18", "Out", "dinner");
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  await user.click(within(sheet).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(add).toHaveFocus());
});

test("a recipe already on the day comes ticked", async () => {
  const user = userEvent.setup();
  const onDay = planEntrySchema.parse({
    ...soup,
    id: "99999999-9999-4999-8999-000000000002",
    recipe: { id: dal.id, slug: dal.slug, name: dal.name, image: null },
  });
  await plan({ days: groupByDay(MONDAY, [onDay]) });
  await user.click(screen.getByRole("button", { name: "Add to Wednesday 16 September" }));
  const sheet = await screen.findByRole("dialog");
  expect(await within(sheet).findByRole("button", { name: "Red lentil dal, added to Wednesday 16 September" })).toBeDisabled();
});

test("next week's empty nights are a pill to fill them", async () => {
  await plan({ nextDays: groupByDay(NEXT, [{ ...soup, date: NEXT }]) });
  const pill = screen.getByRole("link", { name: "Fill next week’s 6 empty nights" });
  expect(pill).toHaveAttribute("href", `/plan/fill?week=${NEXT}`);
});

test("a week long gone offers no pill, however empty the week after it was", async () => {
  await plan({ monday: "2026-08-03", days: groupByDay("2026-08-03", []), nextDays: groupByDay("2026-08-10", []) });
  expect(screen.queryByRole("link", { name: /^Fill next week/ })).toBeNull();
});
