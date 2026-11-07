# UX review: the second pass

Plans to refine before building. Stage 16 (decisions.md rows 190–195) reorganised garnish around the four times it is opened: Home, Plan, Shopping, Cook. A walk-through of every page at 390px on 2026-11-03 found that each mode works when the week is planned and the list is current, and gives little help when the week is empty or half-done, which is when the household most needs it.

Each plan below has the problem as seen, a direction, the questions to settle, and what it touches. Nothing here is decided. When a plan is settled it becomes a decisions.md row and a milestone in plan.md, and its section here is reduced to a link.

Order is by value: 1 and 2 share the rotation-pick logic in `plan/fill` and are the state the household meets most; 3 and 4 make Shopping usable in the shop; 5 closes the loop the planner already depends on; 6 is a set of small frictions. 7 came after the walk-through and ranks with 1 and 2: it is how a recipe gets better at all (rewritten 2026-11-07, when cook mode was found unused). 8 waits on other work: it polishes importing once Chromium and the model are further into it.

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

## 7. Cooking from the recipe page, with an assistant and a review

**The premise.** A recipe is amended while it is being cooked: the amount that was too much, the swap that worked, the step that took longer are known at the stove and forgotten by the time anyone opens an editor. The 2026-11-03 version of this plan put that in cook mode. In use (Jason, 2026-11-07) cook mode is not where cooking happens: the recipe page is left open and cooked from (row 213 keeps its screen on). So cook mode goes, and its job moves to the recipe page in three pieces: a light **Cooking** state of the page itself, an **assistant** to ask while cooking, and a **review** at the end that turns what happened into suggested changes.

**Seen.**
- Cook mode (`/recipes/$slug/cook`, the phone's deck and the desktop's filmstrip) is a different screen from the page Jason reads, so it is skipped; its pending changes (row 193) are never made.
- Row 193's changes are narrow anyway: an amount as a number only, a step as a full rewrite in a textarea, and no words for "used shallots", "left out the chilli", "took 10 minutes longer", "a tip for next time".
- What the page already has is most of what cooking needs: ticking ingredients, step timers (with push alarms), quick edit's pencils, Made this, and now the screen kept on.

**Direction.**

*Cooking, a state of the recipe page.* Start cooking (the phone's wide button in the bar; a button in the desktop header's actions) does not leave the page. It puts the page in a Cooking state, `?cooking` in the address so a reload or an alarm's link keeps it:
- The page looks the same: same columns, same cards, same type. What changes is what is in the way. The tab bar and the top bar step aside (as the editor's do, row 143); the photo, rating, facets and the history fold away to a one-line header (the name, servings, Done); notes stay, below the method.
- The step being cooked is marked, a quiet brand edge on its card, moved on by tapping a step or ticking it done; nothing else about the cards changes. Done steps dim like ticked ingredients.
- The phone's bar becomes **Ask** (the assistant) and **Finish**; the shopping and plan buttons leave it while cooking.
- Leaving with the back button or the header's ✕ keeps the session (it is resumable from Home's Tonight and the recipe page, "Cooking · resume"); **Finish** goes to the review.

*The assistant.* A chat about this recipe, as it is being cooked. On a phone a sheet from the bottom over the lower half, so the step stays visible above it; on a desktop a column at the right of the spread, open while cooking.
- It is given the recipe at the page's servings and choices, its alternatives, the step marked, the ticks, the running timers and the conversation so far. It answers questions ("out of shallots?", "can I do this in the oven instead?", "I only have 400 g of mince") in a sentence or two, metric and en-AU.
- When an answer changes what to do, it comes with an **adjustment** as a chip under the message: *Use red onion for shallots*, *Mince 400 g (was 500 g); scale the rest?*, *Simmer 30 min (was 20)*. Tapping it applies it to the page **for this cook**: the line or step shows the change, marked, as row 193 marked amounts. Nothing is written to the recipe yet.
- The cook can also just say what happened ("too salty", "the sauce took ages to thicken"). Those are kept as notes for the review, not answered at length.
- The vocabulary of an adjustment is fixed and small, so it maps onto the recipe document: an ingredient's amount, unit, food or note; an ingredient added or left out; a step's time, temperature, or text; a tip on a step (the house style's supporting line). The model returns these as structured output, the same shapes the editor saves.
- Without a model (`aiAvailable` false) there is no chat: the Ask button is **Note**, a one-line box whose notes go to the review, and the pencils stay as quick edit's.

*The review.* Finish opens a page of its own, `/recipes/$slug/review`, the end of the cooking session:
- At the top, Made this as it is: rating, the comment, a photo, the date.
- Below, **Suggested changes**, each as before and after on the line or step it touches, with **Keep in recipe** and **Just this time** (the default for an adjustment made for a missing ingredient; Keep for a time or amount that was corrected). The model writes them from the whole session: the adjustments taken, the notes, the chat, and the timers (a step whose timer was extended, or left running well past its time, is evidence its time is wrong).
- Kept changes are written through the editor's validation in one save; a changed step's text goes through the house style's restyle and its conservation check, so the method keeps the household's voice. What is just for this time, and the notes, become the opening words of the Made this comment.
- Without a model, the review lists the adjustments taken and the notes, with the same Keep and Just this time.
- Skipping the review (✕) logs nothing and keeps the session for later, until the next Start cooking of the recipe replaces it.

*The session.* One cooking session per recipe at a time, held on the server (a `cook_session` table: the recipe, servings and choices, when it began, the marked step, the adjustments, the notes, the conversation), so a reload, a second device and Home's resume all see it, and the review can be opened on the desktop after cooking on the phone. Finishing or discarding deletes it; one older than two days is offered as "Finish or discard" rather than resumed.

*What goes.* The cook route, the deck and the filmstrip, `src/domain/recipes/components/cook/`, `recipe/cook.ts`, the `cook` sizes on `StepCard`, `IngredientRow`, `TimerStrip`, `NumberStepper` and `MadeThisButton`, the `fullscreen` shell mode, the top toast placement, and row 193's session-storage changes. Home's and the desktop panel's **Cook** open the recipe page in Cooking at the plan's servings and choices. A sub-recipe line's link opens the child's page at the derived servings.

**To settle.**
- Is the Cooking state right as described: the same page with its chrome folded away, or should it also enlarge the text a step?
- The marked step: moved on by tapping, or also offered by the assistant ("Done with this? Next is…") and by a finished timer?
- Does a tapped adjustment change the page at once (the line reads "red onion"), or only show as a pending mark until the review?
- The review's defaults: Keep for corrections and Just this time for substitutions, or Just this time for everything so nothing is written by a quick tap-through?
- Server session or device-local: the server lets the review move to the desktop and Home show "resume", at the cost of a table.
- A new model use, `cook` (`AI_COOK_MODEL`), since a chat wants a fast model and the review a careful one: one use or two?
- Should the MCP connector see the session (an assistant on the phone's own app asking "what am I cooking?")? Later, probably.

**Order of building.** (1) Cooking state and the review without a model, and cook mode removed; it stands alone and is useful the same day. (2) The assistant's chat and adjustments. (3) The model's suggested changes on the review, with the timer evidence.

**Touches.** `RecipePage` and `PhoneRecipe`/`RecipeSpread` (the Cooking state), `CookBar`, `src/domain/recipes/routes/` (`recipeIndex`'s search, a `review.ts`, `cook.ts` removed), a new `src/domain/recipes/cooking/` module (session, adjustments and their application to a document), `src/server/ai/` (the assistant's and the review's prompts, a `cook` use), a migration for `cook_session`, `src/api/rpc/` (a `cooking.ts`), `MadeThisSheet`, Home's Tonight, `RecipeInset`.

---

## 8. Importing, polished

Settled with Jason on 2026-11-06 after the 2026-11-05 walk: decisions.md row 203, plan.md M44.

---

## Method

Pages screenshotted at a Pixel 7's viewport against a copy of the development database, which holds sample data (placeholder images, odd amounts), so the review is of structure and flow, not content. Re-run on the household's real data before settling plans 3 and 4, whose problems depend on what the real list and library hold.
