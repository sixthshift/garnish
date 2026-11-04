import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Link } from "@tanstack/react-router";

/** "9 left to buy" and the way into the list. `toBuy` null: the list could not be read, so only the way in. */
export function ShoppingGlance({ toBuy }: { toBuy: number | null }) {
  const line = toBuy === null ? "Shopping list" : toBuy === 0 ? "Nothing left to buy" : toBuy === 1 ? "1 thing left to buy" : `${toBuy} things left to buy`;
  return (
    <section aria-labelledby="to-buy">
      <Card size="sm" className="flex flex-wrap items-center gap-3">
        <h2 id="to-buy" className="min-w-0 flex-1 font-medium">
          {line}
        </h2>
        <Button asChild variant="outline" intent="neutral" size="sm">
          <Link to="/shopping">Open the list</Link>
        </Button>
      </Card>
    </section>
  );
}
