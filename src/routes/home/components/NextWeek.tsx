import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import { weekLabel } from "../../../domain/plan";
import { glanceLinkClass } from "./GlanceHeader";

/**
 * Whether next week is planned, through the week. Quiet on purpose: at the
 * weekend an empty next week becomes the page's call to action instead, and
 * this line stands down.
 */
export function NextWeek({ monday, count }: { monday: string; count: number }) {
  const line = count === 0 ? "Not planned yet. The weekend is the usual time." : count === 1 ? "1 meal planned" : `${count} meals planned`;
  return (
    <section aria-labelledby="next-week" className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-normal px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 id="next-week" className="font-medium">
          Next week <span className="font-normal text-fg-subtle">· {weekLabel(monday)}</span>
        </h2>
        <Muted as="p">{line}</Muted>
      </div>
      {count === 0 ? (
        <Link to="/plan/fill" search={{ week: monday }} className={glanceLinkClass}>
          Plan it
        </Link>
      ) : (
        <Link to="/plan" search={{ week: monday }} className={glanceLinkClass}>
          Open
        </Link>
      )}
    </section>
  );
}
