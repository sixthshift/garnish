import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Select } from "@sixthshift/design-system/select";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { usingFood } from "../../../../../api/rpc/foods";
import type { RecipeSummary } from "../../../../../domain/recipes/recipe";
import type { Aisle, FoodPack, FoodRow, Unit } from "../../../../../domain/recipes/reference";
import { conversionsText, packsText, parseAliasList } from "./foodGrid";

/** The Select's value for "no aisle": an option's value cannot be null. */
export const NO_AISLE = "none";

/** Every aisle as the Select offers it, "No aisle" first. Pure. */
export function aisleOptions(aisles: readonly Aisle[]): { value: string; label: string }[] {
  return [{ value: NO_AISLE, label: "No aisle" }, ...aisles.map((aisle) => ({ value: aisle.id, label: aisle.name }))];
}

export type FoodDetailsProps = {
  food: FoodRow;
  aisles: readonly Aisle[];
  units: readonly Unit[];
  /** This food's sizes. */
  packs: readonly FoodPack[];
  /** Every recipe, to name the one this food is made by. */
  recipes: readonly RecipeSummary[];
  /** How many recipes use it, from the page's loader, shown before the list arrives. */
  usage: number;
  /** Save these fields of the food at once, as the grid's cells do. */
  onPatch: (patch: Partial<Pick<FoodRow, "aliases" | "aisleId" | "skipShopping">>) => void;
  onClose: () => void;
  /** Open the full editor (the sheet), for the sizes, conversions, plural and recipe. */
  onEdit: () => void;
  onMerge: () => void;
  onDelete: () => void;
};

/**
 * A desktop's food details pane, beside the foods grid (decisions.md row 207):
 * what a food is called, where it shops and what uses it, at a glance, with
 * the quick fields (aliases, aisle, on hand) changed in place. The rarer ones
 * (sizes, conversions, plural, made by a recipe) are shown here and changed in
 * the sheet, which already edits them well, rather than built twice.
 */
export function FoodDetails({ food, aisles, units, packs, recipes, usage, onPatch, onClose, onEdit, onMerge, onDelete }: FoodDetailsProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const [using, setUsing] = useState<RecipeSummary[] | null>(null);

  // The recipes that use it, asked for when the pane opens on a food: the same
  // query the delete confirm uses, so the pane and the warning agree.
  useEffect(() => {
    let live = true;
    setUsing(null);
    setAdding(null);
    usingFood({ data: { id: food.id } }).then(
      (list) => live && setUsing(list),
      () => live && setUsing([])
    );
    return () => {
      live = false;
    };
  }, [food.id]);

  const addAlias = (text: string) => {
    const next = parseAliasList([...food.aliases, text].join(","));
    if (next.length !== food.aliases.length) onPatch({ aliases: next });
    setAdding(null);
  };

  const madeBy = food.recipeId === null ? null : (recipes.find((recipe) => recipe.id === food.recipeId) ?? null);
  const sizes = packsText(packs, units);
  const conversions = conversionsText(food.conversions, units);
  const count = using?.length ?? usage;

  return (
    <Card className="flex flex-col gap-5" role="region" aria-labelledby="food-details" data-testid="food-details">
      <div className="flex items-start gap-2">
        <h2 id="food-details" className="min-w-0 flex-1 text-xl font-semibold text-fg-strong wrap-anywhere">
          {food.name}
        </h2>
        <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={onClose} aria-label="Close the details">
          ×
        </Button>
      </div>

      <Field label="Also called">
        <div className="flex flex-wrap items-center gap-1.5" data-testid="food-aliases">
          {food.aliases.map((alias) => (
            <TagChip key={alias} tag={alias} onRemove={() => onPatch({ aliases: food.aliases.filter((other) => other !== alias) })} />
          ))}
          {adding === null ? (
            <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={() => setAdding("")}>
              Add a name
            </Button>
          ) : (
            <Input
              autoFocus
              className="w-44"
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
                  setAdding(null);
                }
              }}
            />
          )}
        </div>
      </Field>

      <Field label="Aisle">
        <Select
          aria-label="Aisle"
          options={aisleOptions(aisles)}
          value={food.aisleId ?? NO_AISLE}
          onValueChange={(value) => onPatch({ aisleId: value === NO_AISLE ? null : value })}
        />
      </Field>

      <div className="flex flex-col gap-1">
        <Checkbox label="On hand" checked={food.skipShopping} onCheckedChange={(checked) => onPatch({ skipShopping: checked === true })} />
        <Muted as="p" className="ml-6 text-sm">
          Goes on the shopping list already ticked.
        </Muted>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <Fact term="Plural">{food.pluralName ?? "—"}</Fact>
        <Fact term="Sold in">{sizes === "" ? "—" : sizes}</Fact>
        <Fact term="Converts">{conversions === "" ? "—" : conversions}</Fact>
        <Fact term="Made by">
          {madeBy === null ? (
            "—"
          ) : (
            <Link to="/recipes/$slug" params={{ slug: madeBy.slug }} className="underline">
              {madeBy.name}
            </Link>
          )}
        </Fact>
      </dl>
      <div>
        <Button type="button" variant="outline" intent="neutral" size="sm" onClick={onEdit}>
          Edit all fields
        </Button>
      </div>

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
          <ul className="flex flex-col gap-1 text-sm" data-testid="food-used-in">
            {using.map((recipe) => (
              <li key={recipe.id}>
                <Link to="/recipes/$slug" params={{ slug: recipe.slug }} className="hover:underline">
                  {recipe.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
        <Button type="button" variant="outline" intent="neutral" size="sm" onClick={onMerge}>
          Merge into…
        </Button>
        {/* Neutral: it opens the confirm, which carries the red (design-language rule 5). */}
        <Button type="button" variant="outline" intent="neutral" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle as="h3">{label}</SectionTitle>
      {children}
    </div>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-subtle">{term}</dt>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </>
  );
}
