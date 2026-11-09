import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { cn } from "@sixthshift/design-system/utils";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { addPlanWeekToShopping } from "../../api/rpc/plan";
import { weekMonday } from "../../domain/plan/plan";
import { addedMessage } from "../../lib/shopping";
import { toastError } from "../../lib/toast";

/** An empty basket with a sprig in it: what the list looks like with nothing on it. Still, as an empty state is. */
function EmptyBasket({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden="true">
      <ellipse cx="60" cy="90" rx="40" ry="4" className="fill-fg-subtle opacity-15" />
      {/* The sprig, leaning out of the basket. */}
      <path d="M66 52c2-12 6-22 14-30" className="fill-none stroke-fg-brand" strokeWidth="3" strokeLinecap="round" />
      <path d="M72 38c-8-1-12-6-12-12 7 0 12 5 12 12zM77 29c4-7 11-9 17-7-2 7-9 9-17 7z" className="fill-fg-brand" />
      {/* The handle, then the basket over it. */}
      <path d="M30 46c0-22 60-22 60 0" className="fill-none stroke-fg-subtle" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 46h84l-9 36a6 6 0 0 1-6 4.5H33a6 6 0 0 1-6-4.5z" className="fill-bg-normal stroke-fg-subtle" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M42 56l3 22M60 56v22M78 56l-3 22" className="stroke-border-normal" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 46h92" className="stroke-fg-subtle" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The shopping list with nothing on it, wherever it is shown (the list's own
 * page, a phone's and a desktop's, and a desktop's Home): the empty basket,
 * what to do, and the likeliest thing to do, putting this week's plan on the
 * list. `primary` makes that the page's brand action, as on the list's own
 * page; on Home it is a quiet one beside the Cook button.
 */
export function ShoppingEmpty({ primary = false, compact = false, className }: { primary?: boolean; compact?: boolean; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const addWeek = async () => {
    setBusy(true);
    try {
      const { added } = await addPlanWeekToShopping({ data: { monday: weekMonday(undefined) } });
      toast(added === 0 ? { intent: "info", title: "Nothing planned this week needs buying" } : { intent: "success", title: addedMessage(added) });
      await router.invalidate();
    } catch (error) {
      toastError("Couldn't add this week's plan", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", compact ? "py-2" : "py-10", className)} data-testid="shopping-empty">
      <EmptyBasket className={compact ? "w-24" : "w-32"} />
      <div className="flex flex-col gap-1">
        <p className="font-medium">Nothing on the list.</p>
        <Muted as="p" className="max-w-[34ch] text-sm">
          Add this week's plan, type a line, or add a recipe's ingredients from its page.
        </Muted>
      </div>
      <Button
        type="button"
        variant={primary ? "solid" : "outline"}
        intent={primary ? "brand" : "neutral"}
        size="sm"
        disabled={busy}
        onClick={() => void addWeek()}
      >
        {busy ? "Adding…" : "Add this week's plan"}
      </Button>
    </div>
  );
}
