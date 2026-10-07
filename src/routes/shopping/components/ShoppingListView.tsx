import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { useState } from "react";
import { Page, PageHeader } from "../../../components/shell/Page";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import type { Aisle } from "../../../domain/reference";
import { groupByAisle, type ShoppingItem } from "../../../domain/shopping";
import { pendingLabel } from "../../../lib/outbox";
import { AddItemForm } from "./AddItemForm";
import { ShoppingRow } from "./ShoppingRow";
import { toBuyLabel } from "./shoppingListActions";

/** The list itself, writes injected. Rendered by the route and by the tests. */
export function ShoppingListView({
  items,
  aisles = [],
  onAdd,
  onTick,
  onRemove,
  onClearTicked,
  onSetAisle = () => {},
  busy = false,
  pending = 0,
  offline = false,
}: ShoppingListViewProps) {
  const groups = groupByAisle(items);
  // Clearing deletes every ticked line at once and nothing brings them back, so it asks first;
  // the button that opens the question is neutral and the dialog's is the red one (rule 5).
  const [confirming, setConfirming] = useState(false);
  const tickedCount = items.filter((item) => item.ticked).length;

  return (
    <Page width="focus">
      <PageHeader
        title="Shopping"
        actions={
          <>
            {pending > 0 && (
              <Badge intent="warning" data-testid="shopping-pending">
                {pendingLabel(pending)}
              </Badge>
            )}
            {items.length > 0 && <Muted as="p">{toBuyLabel(items)}</Muted>}
          </>
        }
      />

      <AddItemForm onAdd={onAdd} busy={busy} />

      <EmptyBoundary
        isEmpty={items.length === 0}
        fallback={
          <div className="flex flex-col gap-1 py-8 text-center" data-testid="shopping-empty">
            <p className="font-medium">Nothing on the list.</p>
            <Muted as="p">Type a line above, or add a recipe's ingredients from its page.</Muted>
          </div>
        }
      >
        <div className="flex flex-col gap-6" data-testid="shopping-groups">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-1" aria-label={group.name} data-testid="shopping-group">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle as="h2">{group.name}</SectionTitle>
                {group.ticked && (
                  <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={busy || offline} onClick={() => setConfirming(true)}>
                    Clear ticked
                  </Button>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {group.items.map((item) => (
                  <ShoppingRow key={item.id} item={item} aisles={aisles} onTick={onTick} onRemove={onRemove} onSetAisle={onSetAisle} busy={busy} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </EmptyBoundary>
      {confirming && (
        <ConfirmDialog
          title={`Clear ${tickedCount} ticked ${tickedCount === 1 ? "item" : "items"}?`}
          aria-label="Clear ticked items"
          confirmLabel="Clear"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onClearTicked();
          }}
        >
          They come off the list for good.
        </ConfirmDialog>
      )}
    </Page>
  );
}

export type ShoppingListViewProps = {
  items: readonly ShoppingItem[];
  /** Every aisle, in `position` order, for the "Set aisle" Select. Empty hides the control. */
  aisles?: readonly Aisle[];
  /** A line typed into the box at the top, already trimmed and never empty. */
  onAdd: (text: string) => void;
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onClearTicked: () => void;
  /** A row's food has no aisle and one was picked from the Select. */
  onSetAisle?: (foodId: string, aisleId: string) => void;
  /** A write is in flight: every control is disabled, as the editor's SaveBar does. */
  busy?: boolean;
  /** How many ticks are queued for the server. Shown in the header; 0 shows nothing. */
  pending?: number;
  /**
   * No network: clearing the ticked is refused (it destroys rows the page
   * cannot name one by one), while ticking, removing and adding a line
   * queue. The one exception to the editor's "writes are never attempted
   * offline".
   */
  offline?: boolean;
};
