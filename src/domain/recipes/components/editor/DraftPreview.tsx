import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useMemo, useState } from "react";
import { Markdown } from "../../../../components/ui/Markdown";
import { recipeImageUrl, stepImageUrl } from "../../../../lib/images";
import { previewRecipe, type RecipeDraft } from "../../draft";
import { formatIngredient, inflectIngredient, yieldLine } from "../../ingredient";
import { alternativeText, type Ingredient, type Part, type Step } from "../../recipe";
import { StatIcon } from "../recipe/StatIcon";
import { timeStats } from "../recipe/timeStats";

export type DraftPreviewProps = {
  draft: RecipeDraft;
  /** The picture as the form has it: a picked or fetched file's object URL, the stored one, or the import's. */
  image: string | null;
};

/** The picture as the form has it, as an address an `<img>` can show; a picked file's is let go when it changes. */
export function usePictureUrl(file: File | null, stored: string | null, imported: string | null | undefined): string | null {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  useEffect(() => {
    if (file === null || typeof URL.createObjectURL !== "function") {
      setFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return fileUrl ?? recipeImageUrl(stored) ?? (imported || null);
}

/**
 * The recipe as it will be saved, drawn beside the editor on a desktop
 * (decisions.md row 207) and behind the phone's Preview (row 208), redrawn
 * as the draft changes: the picture, the
 * name, the times and servings, then the ingredients beside the method, as
 * the recipe page lays them out, with its formatting (`inflectIngredient`,
 * `timeStats`, `Markdown`). It is a picture of the recipe and nothing in it
 * does anything: the page's own rows tick and start timers, which would
 * write to this device and the server for a recipe that does not exist yet,
 * so the preview draws its lines rather than borrowing those.
 */
export function DraftPreview({ draft, image }: DraftPreviewProps) {
  const recipe = useMemo(() => previewRecipe(draft), [draft]);
  const stats = timeStats(recipe);
  const yielded = yieldLine(recipe.recipeYieldQuantity, recipe.yieldUnit, recipe.recipeYield);
  // The page keeps the servings in its scale control; a preview has none, so it says them beside the times, as the mockup's facts do.
  const serves = recipe.recipeServings > 0 && !(yielded.label === "Serves" && yielded.value !== "") ? String(recipe.recipeServings) : "";
  const name = recipe.name.trim();
  const hasIngredients = recipe.parts.some((part) => part.ingredients.length > 0);
  const hasSteps = recipe.parts.some((part) => part.steps.length > 0);

  return (
    <article
      className="@container overflow-hidden rounded-xl border border-border-normal bg-bg-normal shadow-sm"
      aria-label="Preview"
      data-testid="draft-preview"
    >
      {image !== null && <img src={image} alt="" className="aspect-[21/9] w-full object-cover" data-testid="preview-image" />}
      <div className="flex flex-col gap-5 p-6 @min-[34rem]:p-8">
        <header className="flex flex-col gap-3">
          <h2 className={cn("font-display text-3xl font-semibold leading-tight", name === "" ? "text-fg-subtle" : "text-fg-strong")} data-testid="preview-name">
            {name === "" ? "Untitled recipe" : name}
          </h2>
          {(stats.length > 0 || serves !== "" || yielded.value !== "") && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm" data-testid="preview-stats">
              {stats.map((stat) => (
                <div key={stat.key} className="flex items-center gap-1.5">
                  <StatIcon stat={stat.key} />
                  <dt className="text-fg-subtle">{stat.label}</dt>
                  <dd className="font-medium text-fg-strong">{stat.value}</dd>
                </div>
              ))}
              {serves !== "" && (
                <div className="flex items-center gap-1.5" data-stat="serves">
                  <dt className="text-fg-subtle">Serves</dt>
                  <dd className="font-medium text-fg-strong">{serves}</dd>
                </div>
              )}
              {yielded.value !== "" && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-fg-subtle">{yielded.label}</dt>
                  <dd className="font-medium text-fg-strong">{yielded.value}</dd>
                </div>
              )}
            </dl>
          )}
          {recipe.description.trim() !== "" && <p className="max-w-[65ch] whitespace-pre-line text-fg-normal">{recipe.description}</p>}
          {recipe.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Tags">
              {recipe.tags.map((tag) => (
                <li key={tag.id ?? tag.name}>
                  <TagChip tag={tag.name} size="md" />
                </li>
              ))}
            </ul>
          )}
        </header>

        {!hasIngredients && !hasSteps ? (
          <Muted as="p" className="text-sm">
            The ingredients and the method show here as they are added.
          </Muted>
        ) : (
          // The recipe page's order: the ingredients beside the method once there is room, stacked under it.
          <div className="flex flex-col gap-6 @min-[34rem]:grid @min-[34rem]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)] @min-[34rem]:items-start @min-[34rem]:gap-8">
            <section className="flex flex-col gap-4" aria-label="Ingredients">
              <SectionTitle as="h3">Ingredients</SectionTitle>
              {recipe.parts.map((part) => (
                <PreviewIngredients key={part.id} part={part} />
              ))}
            </section>
            <section className="flex flex-col gap-4" aria-label="Method">
              <SectionTitle as="h3">Method</SectionTitle>
              {recipe.parts.map((part) => (
                <PreviewSteps key={part.id} part={part} ingredients={recipe.parts.flatMap((each) => each.ingredients)} />
              ))}
            </section>
          </div>
        )}

        {recipe.notes.length > 0 && (
          <section className="flex flex-col gap-3" aria-label="Notes">
            <SectionTitle as="h3">Notes</SectionTitle>
            {recipe.notes.map((note) => (
              <div key={note.id} className="flex flex-col gap-1">
                {note.title.trim() !== "" && <p className="font-medium text-fg-strong">{note.title}</p>}
                <p className="max-w-[65ch] whitespace-pre-line text-fg-normal">{note.text}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </article>
  );
}

/** A part's name over its list, as the page's `PartIngredients` has it; the unnamed part has none. */
function PartName({ part }: { part: Part }) {
  const name = part.name.trim();
  return name === "" ? null : <p className="text-sm font-semibold text-fg-strong">{name}</p>;
}

function PreviewIngredients({ part }: { part: Part }) {
  if (part.ingredients.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <PartName part={part} />
      <ul className="flex flex-col gap-1.5">
        {part.ingredients.map((ingredient) => (
          <PreviewIngredient key={ingredient.id} ingredient={ingredient} />
        ))}
      </ul>
    </div>
  );
}

/** One line as the page's `IngredientRow` words it: the amount, the food in bold, the note, the alternatives. */
function PreviewIngredient({ ingredient }: { ingredient: Ingredient }) {
  const tokens = inflectIngredient(ingredient);
  const amount = tokens.raw ? "" : [tokens.quantity, tokens.unit].filter((part) => part !== "").join(" ");
  const note = ingredient.note.trim();
  if (formatIngredient(ingredient).trim() === "") return null;
  return (
    <li className="flex flex-col gap-0.5" data-testid="preview-ingredient">
      <span>
        {amount !== "" && <span className="tabular-nums">{amount} </span>}
        {tokens.raw ? tokens.text : <strong className="font-semibold">{tokens.food}</strong>}
        {ingredient.fixed && (
          <Muted as="span" className="ml-1.5 text-xs">
            fixed
          </Muted>
        )}
      </span>
      {note !== "" && (
        <Muted as="span" className="text-sm">
          {note}
        </Muted>
      )}
      {ingredient.alternatives.map((alt, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: read-only, in the draft's order
        <Muted as="span" key={index} className="text-sm">
          or {alternativeText(ingredient, alt)}
        </Muted>
      ))}
    </li>
  );
}

/** One part's steps; `ingredients` is the whole recipe's rows, since a step may link another part's (decisions.md row 228). */
function PreviewSteps({ part, ingredients }: { part: Part; ingredients: Ingredient[] }) {
  if (part.steps.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <PartName part={part} />
      <ol className="flex flex-col gap-4">
        {part.steps.map((step, index) => (
          <PreviewStep key={step.id} step={step} position={index + 1} ingredients={ingredients} />
        ))}
      </ol>
    </div>
  );
}

/** One step as the page's `StepCard` reads: its number, its label, the ingredients it links, its text and its aside. */
function PreviewStep({ step, position, ingredients }: { step: Step; position: number; ingredients: Ingredient[] }) {
  const linked = step.ingredientIds.flatMap((id) => ingredients.filter((row) => row.id === id));
  const photo = stepImageUrl(step.image);
  return (
    <li className="flex gap-3" data-testid="preview-step">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-xs font-semibold text-fg-subtle tabular-nums">
        {position}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {step.title.trim() !== "" && <p className="font-semibold text-fg-strong">{step.title}</p>}
        {linked.length > 0 && (
          <Muted as="p" className="text-sm">
            {linked.map((row) => formatIngredient(row)).join(" · ")}
          </Muted>
        )}
        {photo !== null && <img src={photo} alt="" className="max-h-48 w-full rounded-md object-cover" />}
        {step.text.trim() !== "" && <Markdown source={step.text} className="max-w-[65ch]" />}
        {step.summary.trim() !== "" && (
          <Muted as="p" className="text-sm">
            {step.summary}
          </Muted>
        )}
      </div>
    </li>
  );
}
