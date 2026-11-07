import { Badge } from "@sixthshift/design-system/badge";
import { Muted } from "@sixthshift/design-system/muted";
import type { AdjustmentMark } from "../../cooking";

/**
 * A row tonight has changed (decisions.md row 214): "tonight" beside it, and
 * under it what it read before, struck through. A left-out line says so.
 */
export function TonightMark({ mark, was }: { mark: AdjustmentMark; was?: string }) {
  return (
    <>
      <Badge variant="soft" intent="warning" className="ml-1.5 align-middle text-[0.6875rem]" data-testid="tonight-mark">
        {mark.leftOut ? "left out tonight" : "tonight"}
      </Badge>
      {was !== undefined && !mark.leftOut && (
        <Muted as="span" className="block text-xs line-through" data-testid="tonight-was">
          {was}
        </Muted>
      )}
    </>
  );
}
