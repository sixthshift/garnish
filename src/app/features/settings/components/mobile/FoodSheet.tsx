import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Modal, ModalBody, ModalHeader } from "@sixthshift/design-system/modal";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { usingFood } from "../../../../../api/rpc/foods";
import type { RecipeSummary } from "../../../../../domain/recipes/recipe";
import type { Aisle, FoodRow } from "../../../../../domain/recipes/reference";
import { recipeImageUrl } from "../../../../../lib/images";

/** What a tap in the sheet saves at once. */
export type FoodSheetPatch = Partial<Pick<FoodRow, "aliases" | "aisleId">>;

export type FoodSheetProps = {
  food: FoodRow;
  aisles: readonly Aisle[];
  /** How many recipes use it, from the page's loader, shown until the list arrives. */
  usage: number;
  onPatch: (patch: FoodSheetPatch) => void;
  onClose: () => void;
  /** The full editor, for the plural, sizes, conversions, on hand and the recipe that makes it. */
  onEditAll: () => void;
  onMerge: () => void;
  onDelete: () => void;
};

/** `aliases` with `name` added, unless it is blank or one of them already, in any case. Pure. */
export function withAlias(aliases: readonly string[], name: string): string[] {
  const added = name.trim();
  if (added === "" || aliases.some((alias) => alias.toLowerCase() === added.toLowerCase())) return [...aliases];
  return [...aliases, added];
}

/**
 * A food on a phone (decisions.md row 208, the mockup's food sheet): what it
 * is also called, as chips that come off with their × and a name to add; its
 * aisle, a chip grid that saves on a tap; the recipes that use it as photos;
 * and Merge and Delete. The rarer fields stay in the full editor, one press
 * away, rather than built twice.
 */
export function FoodSheet({ food, aisles, usage, onPatch, onClose, onEditAll, onMerge, onDelete }: FoodSheetProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const [using, setUsing] = useState<RecipeSummary[] | null>(null);

  // The same query the delete confirm asks, so the sheet and the warning agree.
  useEffect(() => {
    let live = true;
    setUsing(null);
    usingFood({ data: { id: food.id } }).then(
      (list) => live && setUsing(list),
      () => live && setUsing([])
    );
    return () => {
      live = false;
    };
  }, [food.id]);

  const addAlias = (name: string) => {
    const next = withAlias(food.aliases, name);
    if (next.length !== food.aliases.length) onPatch({ aliases: next });
    setAdding(null);
  };
  const count = using?.length ?? usage;
  const aisleChoices = [{ id: null, name: "No aisle" }, ...aisles.map((aisle) => ({ id: aisle.id as string | null, name: aisle.name }))];

  return (
    <Modal size="md" closable onOpenChange={(open) => !open && onClose()}>
      <ModalHeader>{food.name}</ModalHeader>
      <ModalBody className="flex flex-col gap-5 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Field label="Also called">
          <div className="flex flex-wrap items-center gap-1.5" data-testid="food-aliases">
            {food.aliases.map((alias) => (
              <TagChip key={alias} tag={alias} size="md" onRemove={() => onPatch({ aliases: food.aliases.filter((other) => other !== alias) })} />
            ))}
            {adding === null ? (
              <Button type="button" variant="outline" intent="neutral" size="sm" className="rounded-full border-dashed" onClick={() => setAdding("")}>
                + Add a name
              </Button>
            ) : (
              <Input
                autoFocus
                className="w-48"
                aria-label="New name"
                value={adding}
                onChange={(event) => setAdding(event.target.value)}
                onBlur={() => (adding.trim() === "" ? setAdding(null) : addAlias(adding))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addAlias(adding);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setAdding(null);
                  }
                }}
              />
            )}
          </div>
        </Field>

        <Field label="Aisle">
          {/* A tap saves: the shop walk is the reason a food has an aisle, and choosing one is the sheet's commonest job. */}
          <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0" aria-label="Aisle">
            {aisleChoices.map((aisle) => {
              const on = aisle.id === food.aisleId;
              return (
                <button
                  key={aisle.id ?? "none"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => !on && onPatch({ aisleId: aisle.id })}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm",
                    on ? "border-transparent bg-bg-subtle-pressed font-medium text-fg-strong" : "border-border-normal text-fg-normal hover:bg-bg-normal-hovered"
                  )}
                >
                  {aisle.name}
                </button>
              );
            })}
          </fieldset>
        </Field>

        <Field label={count === 1 ? "Used in 1 recipe" : `Used in ${count} recipes`}>
          {using === null ? (
            <Muted as="p" className="text-sm">
              Looking…
            </Muted>
          ) : using.length === 0 ? (
            <Muted as="p" className="text-sm">
              No recipe uses it.
            </Muted>
          ) : (
            <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" data-testid="food-used-in">
              {using.map((recipe) => (
                <li key={recipe.id} className="shrink-0 snap-start">
                  <UsedInCard recipe={recipe} />
                </li>
              ))}
            </ul>
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" intent="neutral" size="lg" onClick={onEditAll}>
            Edit all fields
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" intent="neutral" size="lg" className="flex-1" onClick={onMerge}>
              Merge into…
            </Button>
            {/* Neutral: it opens the confirm, which carries the red (design-language rule 5). */}
            <Button type="button" variant="outline" intent="neutral" size="lg" className="flex-1" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

/** A recipe that uses the food: its photo with its name over it, to the recipe's page. */
function UsedInCard({ recipe }: { recipe: RecipeSummary }) {
  const photo = recipeImageUrl(recipe.image);
  return (
    <Link
      to="/recipes/$slug"
      params={{ slug: recipe.slug }}
      className="relative flex h-28 w-24 flex-col justify-end overflow-hidden rounded-xl bg-bg-subtle-pressed"
      data-testid="used-in-card"
    >
      {photo !== null && <img src={photo} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
      <span
        className={cn(
          "relative line-clamp-3 p-2 text-xs leading-tight font-semibold",
          photo !== null ? "bg-gradient-to-t from-black/70 to-transparent pt-6 text-white" : "text-fg-strong"
        )}
      >
        {recipe.name}
      </span>
    </Link>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle as="h3">{label}</SectionTitle>
      {children}
    </div>
  );
}
