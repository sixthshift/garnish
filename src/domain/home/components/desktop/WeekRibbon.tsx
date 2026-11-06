import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { RecipeLink } from "../../../../components/recipe/RecipeLink";
import { recipeImageUrl } from "../../../../lib/images";
import { entryLabel, type PlanDay } from "../../../plan/plan";
import { shortDay, tonightEntry } from "../../home";
import { Photo, PLACEHOLDER } from "../Photo";

/**
 * This week as seven picture cards across the top of a desktop's Home: each
 * day's meal (the one Home calls the evening's, as Tonight does) with its
 * photo, a note in italics, or a dashed "+ Plan a meal" into the plan. Today
 * is outlined, days gone by step back. A recipe opens in the side panel
 * (RecipeLink), so the week stays in view.
 */
export function WeekRibbon({ days, today }: { days: readonly PlanDay[]; today: string }) {
  return (
    <section aria-label="This week" className="col-span-full row-span-2 min-w-0 rounded-2xl border border-border-subtle bg-bg-normal p-3">
      <ul className="grid h-full grid-cols-7 gap-2.5">
        {days.map((day) => {
          const isToday = day.date === today;
          const past = day.date < today;
          const entry = tonightEntry(day);
          const more = day.entries.length - 1;
          const label = isToday ? "Today" : shortDay(day.date);
          const card = cn(
            "relative flex h-full min-w-0 flex-col justify-end overflow-hidden rounded-xl",
            isToday && "outline-3 outline-offset-2 outline-border-brand",
            past && "opacity-70 saturate-[.6]"
          );
          const dayLine = <span className="text-xs font-semibold uppercase tracking-wider opacity-90">{label}</span>;
          const extra = more > 0 && <span className="text-xs opacity-80">and {more} more</span>;

          if (entry === null) {
            return (
              <li key={day.date} aria-current={isToday ? "date" : undefined} className="min-w-0">
                {past ? (
                  <div className={cn(card, "items-center justify-center border-[1.5px] border-dashed border-border-normal text-fg-subtle")}>
                    {dayLine}
                    <span aria-hidden="true">—</span>
                  </div>
                ) : (
                  <Link
                    to="/plan"
                    className={cn(
                      card,
                      "items-center justify-center gap-1 border-[1.5px] border-dashed border-border-normal text-center text-fg-subtle hover:border-border-brand hover:text-fg-brand"
                    )}
                  >
                    {dayLine}
                    <span className="text-sm">+ Plan a meal</span>
                  </Link>
                )}
              </li>
            );
          }

          if (entry.recipe === null) {
            return (
              <li key={day.date} aria-current={isToday ? "date" : undefined} className="min-w-0">
                <div className={cn(card, "justify-center gap-1 border-[1.5px] border-dashed border-border-normal px-3 text-center text-fg-normal")}>
                  {dayLine}
                  <span className="line-clamp-3 italic">{entry.text}</span>
                  {extra}
                </div>
              </li>
            );
          }

          const image = recipeImageUrl(entry.recipe.image);
          return (
            <li key={day.date} aria-current={isToday ? "date" : undefined} className="min-w-0">
              <RecipeLink
                slug={entry.recipe.slug}
                choices={entry.choices}
                servings={entry.servings ?? undefined}
                className={cn(card, "group", image === null ? `${PLACEHOLDER} text-fg-normal` : "text-white")}
              >
                {image !== null && (
                  <>
                    <Photo src={image} className="absolute inset-0 size-full transition-transform duration-300 group-hover:scale-105" />
                    <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-black/5 to-[rgb(20_12_8/.72)]" />
                  </>
                )}
                <span className="relative flex min-w-0 flex-col px-3 py-2.5">
                  {dayLine}
                  <span className="line-clamp-2 text-sm font-medium leading-snug">{entryLabel(entry)}</span>
                  {extra}
                </span>
              </RecipeLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
