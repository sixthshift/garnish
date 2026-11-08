import { Button } from "@sixthshift/design-system/button";
import { Link } from "@tanstack/react-router";
import { addDays } from "../../plan";

/** "Plan the week": the week's empty nights, filled from the weeknight and weekend recipes (decisions.md rows 192, 219). Gone once the week is over. */
export function PlanWeekButton({ monday, today }: { monday: string; today: string }) {
  if (addDays(monday, 6) < today) return null;
  return (
    <Button asChild variant="outline" intent="neutral" size="sm">
      <Link to="/plan/fill" search={{ week: monday }}>
        Plan the week
      </Link>
    </Button>
  );
}
