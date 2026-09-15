// plan: a module. This index is its whole surface; nothing outside the folder
// imports anything else in it (test/modules.test.ts).
//
// The one meal plan: a week of days, the arithmetic on dates, and what a week
// adds to the shopping list.

export type { ParsedPlanEntryInput, PlanDay, PlanEntry, PlanEntryInput, PlanEntryPatch, PlanRecipe } from "./plan";
export {
  addDays,
  dayLabel,
  entryLabel,
  groupByDay,
  isoDate,
  isToday,
  planDaySchema,
  planEntryInputSchema,
  planEntryPatchSchema,
  planEntrySchema,
  planWeekAdditions,
  reorderMove,
  servingsLabel,
  todayIso,
  weekDates,
  weekLabel,
  weekMonday,
} from "./plan";
