# UX review: the second pass

Plans to refine before building. Stage 16 (decisions.md rows 190–195) reorganised garnish around the four times it is opened: Home, Plan, Shopping, Cook. A walk-through of every page at 390px on 2026-11-03 found that each mode works when the week is planned and the list is current, and gives little help when the week is empty or half-done, which is when the household most needs it.

Each plan below has the problem as seen, a direction, the questions to settle, and what it touches. Nothing here is decided. When a plan is settled it becomes a decisions.md row and a milestone in plan.md, and its section here is reduced to a link.

Order is by value: 1 and 2 share the rotation-pick logic in `plan/fill` and are the state the household meets most; 3 and 4 make Shopping usable in the shop; 5 closes the loop the planner already depends on; 6 is a set of small frictions. 7 came after the walk-through and ranks with 1 and 2: it is how a recipe gets better at all. 8 waits on other work: it polishes importing once Chromium and the model are further into it.

---

## 1. Tonight, when nothing is planned

**Seen.** A Tuesday with an empty week. Home says "Nothing planned for tonight" and offers "Open the plan", which opens a page of seven dashes. Below it, This week is seven rows of "—", half the phone's height saying nothing. To try offers never-made recipes, which are rarely what a weeknight wants. The question at 5pm is "what's for dinner?", and Home has no answer.

**Direction.**
- Tonight, unplanned, offers three picks from the rotation that have not been cooked lately, using `rotationPool` from `plan/fill` (it already excludes what is planned). Each pick has **Cook tonight**, which writes it as today's dinner and opens cook mode, and the card has **Show others** to draw three more.
- With no rotation marked, the picks come from the recipes made most often (the weeknight-able pool `swapPool` uses), with a line saying marking the rotation makes them better.
- An empty This week collapses to one line ("Nothing planned this week") with the plan-the-rest action from plan 2. A part-planned week keeps its rows.
- With tonight planned, nothing changes.

**To settle.**
- Three picks, or one with a Swap? One reads faster; three let the household choose.
- Does Cook tonight need a step between choosing and cooking (servings, or "Add what's missing to the list")? A recipe chosen at 5pm may need a shop.
- Should To try leave Home and live only as the Recipes shelf, since it does not answer a Home question?
- Is "lately" the last-made date (recency), the cook count (familiarity), or both?

**Touches.** `src/domain/home/` (`Tonight`, `WeekGlance`, `home/today.ts`), the pool functions in `src/domain/plan/components/fill/fill.ts` (to move to the `planner` or `plan` domain module if Home uses them), `addPlanEntry`.

---

## 2. Planning a week already under way

**Seen.** Home's plan nudge only appears at the weekend, and only for next week. On a Tuesday with an empty week nothing asks you to plan it. On Plan, "Plan the week" is a quiet outline button below the seven days, under the fold on a phone, and the page has no primary action at all. `openDays` in `plan/fill` already handles a week in progress (it plans from today onwards), so the flow works; nothing leads to it.

**Direction.**
- Home: when the current week has open nights from today on, and fewer than some number are planned, the nudge reads **Plan the rest of this week** and goes to `/plan/fill` for this week. At the weekend with next week empty, it stays as it is.
- Plan: while the shown week has open nights, **Plan the week** (or **Plan the rest of the week** mid-week) is the brand button at the top, beside the week label, not at the bottom.
- Plan: "Add this week to the shopping list" stays, but as a secondary action. Plan the week already adds the week at its end.

**To settle.**
- The threshold for "under-planned": any open night, or more than two?
- Should Plan the week, mid-week, offer only the days left, or also "tonight" first as plan 1 does?
- Does a week with every night filled show no brand action on Plan, or does Add to the list take it?

**Touches.** `src/domain/home/pages/HomePage.tsx`, `src/domain/plan/components/week/PlanWeekView.tsx`, `src/domain/plan/components/fill/` (copy for a part week).

---

## 3. A list that knows its week

**Seen.** The list held 31 items from five dishes while the plan was empty: the meals they were bought for are past or gone, and the list cannot tell. It only grows: Clear ticked removes what was bought, and nothing removes what will not be. A shop has no end; the list is never "done".

Each source already carries `planDate` and `recipeId` (rows 182 and 187), so staleness is detectable without a schema change: a source whose `planDate` is past, or whose recipe is no longer on that day.

**Direction.**
- At the top of the list, when any dish's sources are all stale: "3 dishes aren't planned any more · Review", which opens a sheet listing those dishes and their lines, each removable, with Remove all.
- **Done shopping** at the end of the list: clears what was ticked, and asks about what was not ("Keep 4 items for next time?").
- Home's shopping card names what the list is for ("31 to buy for Mon–Thu") rather than a bare count, or goes (see plan 6).

**To settle.**
- What counts as stale: past `planDate`, the entry removed from the plan, or both? A line added from a recipe page has no `planDate`. Is it ever stale?
- Should removing a meal from the plan offer to remove its items at that moment instead (a toast with Remove its items)? That prevents the problem rather than cleaning up after it, and may make the banner unnecessary.
- Does Done shopping replace Clear ticked or sit beside it?

**Touches.** `src/domain/shopping/shopping/` (a pure `staleDishes(items, planDays, today)`), `src/domain/shopping/components/`, `src/domain/plan/components/week/` (the remove-entry toast), the shopping loader (needs plan days).

---

## 4. Lines the list cannot read

**Seen.** An imported recipe whose ingredients were not parsed reaches the list as raw page text in "Other": "1.25kg / 2.5 lb chuck beef (or other slow cooking beef cut, cut into equal 4 pieces (Note 1))". In the shop, Other becomes the longest aisle and the hardest to read, and the lines do not merge with the same food from another dish. The fix belongs before the shop, not in it.

**Direction.**
- When a recipe with unparsed lines is added to the list (from the recipe, the plan or Plan the week), the add sheet or toast says "Ragu has 12 lines garnish can't read · Fix them", opening the editor's Parse all for that recipe.
- On the list, an unparsed line shows a quiet mark and a **Tidy** action that parses the line in place. It changes the list line, not the recipe.
- On the recipe page, a recipe with unparsed lines says so once, near the ingredients.

**To settle.**
- Which of the three is enough? The warning at add time may be the only one that matters.
- Should Tidy on the list also offer to write the parse back to the recipe?
- Is "unparsed" `food === null`, or also a food with no aisle (which lands in Other too)?

Parser rules stay out of this: the threshold for a new rule is unchanged.

**Touches.** `src/domain/shopping/shopping/additions.ts`, the add sheet (`AddToShoppingButton`), `src/domain/shopping/components/ShoppingRow.tsx`, `ParseAllSheet`.

---

## 5. The week remembers what was cooked

**Seen.** Finishing cook mode offers Made this, and the cook log feeds `lastMade`. Plan the week reads it to carry missed meals forward (`missedRecipes`). But neither Home's week nor Plan shows which nights happened, so the household cannot see what the planner sees, and a meal cooked without pressing Made this reads as missed with no way to say otherwise from the plan.

**Direction.**
- A past entry whose recipe was made on or after its day shows a tick on Home's week and on Plan. One that was not shows as not made, quietly.
- On Plan, a past entry not made has **Made it** (logs a cook on that day) and **Move to…** (carries it to an open day), so the plan can be corrected where it is read.
- Finishing cook mode for a recipe that is on today's plan logs against that entry without asking "Made this?" separately. (Check how the finish card already words this.)

**To settle.**
- Is the tick worth the visual weight on Home, or only on Plan?
- Should a missed meal move itself to the next open night, or only offer to?
- Does a plain text entry ("Leftovers", "Out") need a made state at all?

**Touches.** `src/domain/plan/` (a pure `madeState(entry, recipe)`), `src/domain/home/components/WeekGlance.tsx`, `src/domain/plan/components/week/PlanEntryRow.tsx`, `src/domain/recipes/components/cook/FinishedCard.tsx`.

---

## 6. Smaller frictions

Each is small enough to settle in a line.

- **Recipes: too much chrome before the first card.** Search, then the shelves, then Mark Rotation & Weekend, then count, Filters, Sort and the view toggles: three rows of controls. Marking is an occasional chore. Move it into the Sort menu (or a ⋯ beside it) and keep the shelves and search.
- **Recipe page: Add to plan is behind ⋯** (`PlanPopover` in `RecipeActions`), while Add to shopping list has a full button. Under the four modes, putting a recipe on a day matters more than buying for it outside a plan. Swap their prominence, or give both buttons.
- **Recipe page: the Rotation | Weekend toggle has no label** and reads as two unexplained buttons in the header. A small label ("Kind"), or wording that explains itself ("In the rotation", "A weekend one").
- **Settings takes a fifth slot in the phone nav**, squeezing the four modes for a page opened rarely. Move it to a corner of Home's header or the Recipes header; keep it in the side nav from `md`.
- **Home's shopping card is a count.** Either it says what the list is for (plan 3), shows the first aisle or two, or it goes and the nav carries a badge.
- **Recipe page: Made this sits below the method**, after Notes. With plan 5 most cooks are logged from cook mode, so it may belong in ⋯.

**To settle.** Which of these to take as-is, and which need a pair session.

---

## 7. Cooking is where a recipe is edited

**The premise.** A recipe is amended while it is being cooked, not before and not after. The amount that was too much, the step that took longer, the swap that worked are known at the stove and forgotten by the time anyone sits at an editor. So cook mode is the recipe's main editor in practice, and the full editor is for setting a recipe up (import, parts, parsing). Cook mode should make an adjustment as easy as ticking an ingredient.

**Seen.** Row 193 gave cook mode two kinds of change: an amount (the pencil on the ingredients card, or "Change an amount" under a step) and a step's text ("Change this step"), held until the finish card asks Keep in recipe or Just this time. In use:
- **An amount is a number only.** The unit and the food cannot change, so "1 pinch green prawns" can become "2 pinch", not "200 g", and "used shallots instead" has nowhere to go.
- **A step change is a full rewrite.** "How you did it" opens the whole step in a textarea; to say "took 10 minutes longer" or "use the big pan" the cook retypes or edits the step's prose on a phone keyboard with wet hands, the keyboard covering the card.
- **What happens at the stove has no vocabulary.** There is no add (a squeeze of lemon), skip (left out the chilli), swap, more/less, longer/shorter, hotter/cooler, or "a tip for next time". The house style has a home for tips, the step's supporting line, but cook mode cannot write to it.
- **Two quiet text links per card** ("Change an amount", "Change this step") are the only way in, and the ingredients card has a pencil per row; three entry points that each do one narrow thing.
- **Timers know things nobody records.** A step whose timer ran out and was dismissed late, or a step the cook stayed on far longer than its time, is evidence the time is wrong; nothing notices.
- **Anything too big for the stove is lost.** "This step is confusing" or "split this into two" cannot be done with one hand, and there is nowhere to leave it for later.

**Direction.**
- **One Adjust per card**, a large target, opening a sheet of what can happen at the stove, tap first and type last:
  - on an ingredient: *More / Less* (a stepper in the ingredient's own unit, not a keypad), *Different amount* (amount and unit), *Swapped for…* (a food picker), *Left out*;
  - on a step: *Took longer / shorter* (a minutes stepper, written into the step's time and timer), *Hotter / cooler* (the oven line), *A tip for next time* (one line, written to the step's supporting line), *Add something* (an ingredient to this step), *Rewrite* (today's textarea, last, not first);
  - anywhere: *Fix this later*, a flag with an optional word, for what cannot be done at the stove.
- **Changes show where they were made**, marked on the deck (as row 193 already does for amounts), so the cook sees the recipe as they are cooking it.
- **Timers as evidence.** When a step's timer is extended or the cook stays well past it, the finish card offers "Step 4 took about 8 minutes longer · Update the time", without being asked during the step.
- **The finish card stays the one place a change is decided**, Keep in recipe or Just this time, now over the richer set. A kept swap or tip goes through the editor's validation as a kept amount does today. *Fix this later* flags land on the recipe page (and the editor) as a short list, until done.
- **Words, when there is a model.** One free "What changed?" box on the finish card (or by dictation through the phone's keyboard) that the model turns into the same structured changes, each shown for Keep or Just this time; a kept rewrite of a step goes through the house style's restyle and its conservation check so the method keeps the household's voice. With no model, the words become the Made this comment, as Just this time changes do now.

**To settle.**
- Is the change vocabulary above the right one? It should come from what the household actually changes; a few real cooks' worth of "what I'd have changed" would settle it better than guessing.
- One Adjust button per card, or Adjust on each ingredient row and each step separately? A long-press on a row is quicker but undiscoverable.
- Does a swap change the recipe's food, or add the alternative as the ingredient's note ("or shallots")? Mealie and Tandoor would do the note; a household that always swaps wants the food.
- Should *More / Less* be a nudge without a number ("a bit more salt"), kept as a tip, or always a number?
- Timer evidence: what counts as "well past", and is it worth asking at all for a step the cook simply left running?
- Where *Fix this later* lives: on the recipe page, Home's glance, or only in the editor.
- With the model: the finish-card box, per-step dictation, or both? Does a kept rewrite always go through restyle, or only when the household asks?
- Does this change the editor's role, so that the recipe page's Edit becomes the setup tool, and the quick edit on the recipe page (`useQuickEdit`) is replaced by the same Adjust sheet outside cook mode?

**Touches.** `src/domain/recipes/components/cook/` (`cookChanges.ts` grows new change kinds, `ChangesReview`, `FinishedCard`, `AmountForm`), `CookCardView` and `StepCard`, the timers (`TimerStrip` and its state), `saveQuickEdit`, the style domain for a kept rewrite, a new flag store for *Fix this later* (a migration), the recipe page and editor to show flags.

---

## 8. Importing, polished

**When.** After the import's two pieces of plumbing land: a headless Chromium as the fetch's fallback (decisions.md row 202, plan.md M43) and the model brought further into the import. Both change what the flow has to show, so this plan is for the screens once they settle, not before. Re-walk the import at 390px then; what is below is read from the code as it stands on 2026-11-04, not from a walk-through.

**Seen.**
- **A read has no shape.** A web page is fetched (up to 15 s), read by the rules, then sorted by the model in the background. The wait before the review is a button reading "Reading the page…"; the wait after it is a muted "Sorting into parts…" line above the recipe. A Chromium render adds seconds to the first wait, and nothing says which of the steps is under way.
- **The review changes under the reviewer.** The rules' reading is shown first and is editable; when the model's answer lands, the rows are rebuilt from it (`useRecipeSource`, `onAnswer`), so a food matched or a row fixed while it was sorting is replaced.
- **Notices stack.** Above the recipe there can be, at once, the no-recipe-data warning, the sorting line, "The model could not read this page", "The model changed more than the parts" (with a list of changed lines and "Use the model's version anyway") and "You already have this one". Each is a full message box, and their words are the pipeline's (model, parts, rules), not the household's.
- **The steps marker shows a stage that never comes.** `ImportSteps` always lists Source, Review, Style, Save; without a model the import goes Review then the editor, and Style is never reached.
- **Ways in are several, and the fallback is the household's job.** Web page, paste (with a model), file, and the Save to Garnish bookmark, which a blocked page sends you off to set up. Chromium is meant to make most blocks the server's problem.

**Direction.**
- **One read, told as it goes.** From the address to the review, one progress card naming the step it is on (fetching the page, opening it in a browser when the fetch is refused, reading the recipe, sorting it into parts), each ticking off. How the page was fetched is not shown unless every way failed.
- **Show the review once it will hold.** Either the review waits for the model's sort (one reveal, a longer wait with the progress card), or the rules' reading shows at once but stays read-only until the sort lands. Not editable rows that are then replaced.
- **One status line, not five boxes.** A single line under the recipe's header says what happened in the household's words ("Read from the page, sorted into 3 parts", "Already in your recipes: Lemon tart · Open it"), with a ⋯ for the detail (what the model changed, a retry). Only a stop is a warning: no recipe on the page, or nothing could fetch it.
- **When every way fails, one place says what next**: paste the page's text, or send it with the bookmark, in that order, inside the error rather than as separate sources.
- **The steps marker follows the path taken**: three stages without a model, four with.
- **The review at 390px**: the header card, the tags and the ingredient rows read top to bottom without the footer covering the last row; the side-by-side layout stays from `lg`.

**Settled** (with Jason, 2026-11-04; becomes a decisions row with the milestone, once M43 has landed and the import is re-walked):
- **The review waits for the model's sort.** With a model, the progress card stays up until the sorted recipe is ready, and the review appears once and does not change under the reviewer. Without a model, the rules' reading is final and shows at once.
- **Style stays its own stage**, after the review. Folding it into the review would bring back the review changing under the reviewer. The steps marker shows it only when there is a model.
- **A duplicate is a note on the status line** ("Already in your recipes: Lemon tart · Open it"), not a stop.
- **Paste stays a way in of its own.** The three ways to make a recipe are a web page, pasted text and an empty recipe (plus a file); paste is not only the fallback for a blocked page.
- **Save to Garnish stays as the last resort** inside the one error when both the fetch and Chromium fail, after paste (row 202, M43.3), since taste.com.au, delicious.com.au and Smitten Kitchen wall off Chromium too (row 202's trial).

**Touches.** `src/domain/recipes/components/new/` (`useRecipeSource` and `useModelPass` for the order of the read, `ImportReview` and `importSummary` for the status line, `ImportSteps`, `SourceChooser`, `UrlSource`, `PageSource`, `BrowserSource`), `ImportStyle` and `src/domain/recipes/pages/NewRecipePage.tsx` if Style folds in, and `src/server/import/fetch.ts` only for the progress it reports.

---

## Method

Pages screenshotted at a Pixel 7's viewport against a copy of the development database, which holds sample data (placeholder images, odd amounts), so the review is of structure and flow, not content. Re-run on the household's real data before settling plans 3 and 4, whose problems depend on what the real list and library hold.
