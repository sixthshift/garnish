import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import type { ShoppingItem } from "../../../shopping/shopping";
import { listProgress } from "../../home";
import { ProgressRing } from "../ProgressRing";

/**
 * The shopping list on a phone's Home: a ring of how much is in the trolley,
 * what is left to buy, and Start into the list. Ticking happens on the list,
 * in the shop. `items` null: the list could not be read, so only the way in.
 */
export function ShoppingCard({ items }: { items: readonly ShoppingItem[] | null }) {
  const progress = items === null ? null : listProgress(items);
  const left = progress === null ? 0 : progress.total - progress.ticked;
  const title = progress === null ? "Shopping" : progress.total === 0 ? "Nothing on the list" : left === 0 ? "All in the trolley" : `${left} to buy`;
  const line =
    progress === null
      ? "The list couldn't be read just now."
      : progress.total === 0
        ? "Add to it from a recipe or the week."
        : progress.ticked === 1
          ? "1 already in the trolley"
          : `${progress.ticked} already in the trolley`;

  return (
    <section aria-labelledby="to-buy">
      <Card className="flex items-center gap-3.5">
        {progress !== null && progress.total > 0 && <ProgressRing ticked={progress.ticked} total={progress.total} className="size-16" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="to-buy" className="font-display text-lg font-semibold text-fg-strong">
            {title}
          </h2>
          <Muted as="p" className="text-sm">
            {line}
          </Muted>
        </div>
        <Button asChild variant="outline" intent="neutral">
          <Link to="/shopping">{progress !== null && left > 0 ? "Start" : "Open the list"}</Link>
        </Button>
      </Card>
    </section>
  );
}
