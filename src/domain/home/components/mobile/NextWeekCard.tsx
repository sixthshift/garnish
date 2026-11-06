import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import { weekLabel } from "../../../plan/plan";

/**
 * The weekend's call to plan next week, as a brand card: shown only when the
 * page asks (the weekend, next week empty), and then the page's one brand
 * fill (rule 5), its button white on it as the mockup draws it.
 */
export function PlanNextWeekCard({ monday }: { monday: string }) {
  return (
    <section aria-labelledby="plan-now" className="flex flex-col items-start gap-3 rounded-xl bg-bg-brand p-4.5 text-fg-on-brand">
      <div className="flex flex-col gap-1">
        <h2 id="plan-now" className="font-display text-lg font-semibold">
          Next week isn't planned yet
        </h2>
        <p className="text-sm opacity-85">Weeknights from the rotation, then something for the weekend.</p>
      </div>
      <Link
        to="/plan/fill"
        search={{ week: monday }}
        className="inline-flex min-h-11 items-center rounded-xl bg-bg-normal px-4 text-sm font-medium text-fg-brand hover:bg-bg-normal-hovered"
      >
        Plan next week
      </Link>
    </section>
  );
}

/**
 * Whether next week is planned, through the week. Quiet on purpose: at the
 * weekend an empty next week becomes the brand card instead, and this line
 * stands down.
 */
export function NextWeekLine({ monday, count }: { monday: string; count: number }) {
  const line = count === 0 ? "Not planned yet. The weekend is the usual time." : count === 1 ? "1 meal planned" : `${count} meals planned`;
  return (
    <section aria-labelledby="next-week" className="flex items-center gap-3 rounded-xl border border-dashed border-border-normal px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 id="next-week" className="font-medium">
          Next week <span className="font-normal text-fg-subtle">· {weekLabel(monday)}</span>
        </h2>
        <Muted as="p" className="text-sm">
          {line}
        </Muted>
      </div>
      <Link
        to={count === 0 ? "/plan/fill" : "/plan"}
        search={{ week: monday }}
        className="py-2 text-sm font-semibold text-fg-brand hover:text-fg-brand-hovered"
      >
        {count === 0 ? "Plan it" : "Open"}
      </Link>
    </section>
  );
}
