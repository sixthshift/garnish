import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { Popover } from "@sixthshift/design-system/popover";
import { type FormEvent, useState } from "react";
import { nextServings } from "../../../../domain/recipe";
import { Route } from "../route";

/**
 * Current servings as a chip, with minus and plus either side. Each press
 * navigates with a new `servings` search param, so the loader refetches the
 * scaled document. Hidden when the recipe has no servings recorded: there is
 * nothing to scale by.
 *
 * Tapping the chip opens a `popover` with a single form in it: a number input
 * for typing an exact servings count directly, rather than stepping one at a
 * time. Reset (outside the popover, so it stays visible without opening
 * it) clears a requested scale back to the recipe's own servings.
 */
export function ScaleControl({ servings }: { servings: number }) {
  const navigate = Route.useNavigate();
  const { servings: requested } = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => String(Number(servings.toFixed(2))));
  if (servings <= 0) return <Muted as="p">Servings not set</Muted>;

  const go = (value: number | undefined) => void navigate({ search: (prev) => ({ ...prev, servings: value }), replace: true });
  const label = `Serves ${Number(servings.toFixed(2))}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(draft);
    if (Number.isFinite(value) && value > 0) go(value);
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Scale servings">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          intent="neutral"
          size="sm"
          iconOnly
          aria-label="Fewer servings"
          disabled={servings <= 1}
          onClick={() => go(nextServings(servings, -1))}
        >
          −
        </Button>
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (next) setDraft(String(Number(servings.toFixed(2))));
            setOpen(next);
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              data-testid="servings-chip"
              aria-live="polite"
              className="min-w-20 rounded-full border border-border-subtle bg-bg-subtle px-3 py-1 text-center font-medium text-fg-strong"
            >
              {label}
            </button>
          </Popover.Trigger>
          <Popover.Body className="flex flex-col gap-3 p-3" aria-label="Set servings">
            <form className="flex items-center gap-2" onSubmit={submit}>
              <label htmlFor="servings-target" className="text-sm text-fg-subtle">
                Servings
              </label>
              <Input
                id="servings-target"
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Servings"
                className="w-20"
              />
              <Button type="submit" variant="solid" intent="brand" size="sm">
                Set
              </Button>
            </form>
          </Popover.Body>
        </Popover>
        <Button variant="outline" intent="neutral" size="sm" iconOnly aria-label="More servings" onClick={() => go(nextServings(servings, 1))}>
          +
        </Button>
      </div>
      {requested !== undefined && (
        <Button variant="link" intent="neutral" size="sm" onClick={() => go(undefined)}>
          Reset
        </Button>
      )}
    </div>
  );
}
