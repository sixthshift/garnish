import { Button } from "@sixthshift/design-system/button";
import { FormField } from "@sixthshift/design-system/form-field";
import { Heading } from "@sixthshift/design-system/heading";
import { Input } from "@sixthshift/design-system/input";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";
import { cn } from "@sixthshift/design-system/utils";
import { getRouteApi, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { discardCooking, finishCooking } from "../../../api/rpc/cooking";
import { suggestCooking } from "../../../api/rpc/cookingAssistant";
import { setRating } from "../../../api/rpc/recipes";
import { createTimelineEvent } from "../../../api/rpc/timeline";
import { ImageUpload } from "../../../components/ui/ImageUpload";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import { Rating } from "../../../components/ui/Rating";
import { formatDateStamp, isValidDate } from "../../../lib/dates";
import { uploadTimelineImage } from "../../../lib/images";
import { toastError } from "../../../lib/toast";
import { todayIso } from "../../plan/plan";
import { SuggestionCard } from "../components/cooking/SuggestionCard";
import { saveCookAndClearTicks } from "../components/recipe/saveCook";
import { type Decision, onceNote, type Suggestion, viewSuggestion } from "../cooking";

const route = getRouteApi("/recipes/$slug/review");

/** The comment the review starts with: what was only tonight's, then what was noted while cooking. Pure. */
export function startingComment(once: string, notes: readonly { text: string; origin: string }[]): string {
  const said = notes.filter((note) => note.origin === "cook").map((note) => note.text.replace(/[.\s]+$/, ""));
  return [once, said.length === 0 ? "" : `Noted: ${said.join("; ")}.`].filter((line) => line !== "").join("\n");
}

/**
 * How did it go? (decisions.md row 214): Made this — the rating, the date,
 * the servings, a comment and a photo — beside tonight's changes as suggested
 * changes, each kept in the recipe or left as tonight's. Save logs the cook,
 * writes what was kept and ends the session; Not now goes back to cooking.
 */
export function ReviewPage() {
  const { recipe, session, suggestions: taken, aiAvailable } = route.useLoaderData();
  // Tonight's changes until the model's suggestions arrive, then those (which include every change taken).
  const [suggestions, setSuggestions] = useState<Suggestion[]>(taken);
  const [reading, setReading] = useState(session !== null && aiAvailable);
  const [readProblem, setReadProblem] = useState<string | null>(null);
  const navigate = useNavigate();
  const router = useRouter();
  const servingsAt = session?.servings ?? (recipe.recipeServings > 0 ? recipe.recipeServings : null);

  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => Object.fromEntries(taken.map((s) => [s.adjustment.id, s.decision])));
  // Choices made before the suggestions arrived are kept; the rest start where the model says.
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());

  const sessionId = session?.id ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once per session; `touched` is read as it stands when the answer lands.
  useEffect(() => {
    if (sessionId === null || !aiAvailable) return;
    let current = true;
    suggestCooking({ data: { recipeId: recipe.id } })
      .then((result) => {
        if (!current) return;
        setSuggestions(result.suggestions);
        setReadProblem(result.problem);
        setDecisions((was) => {
          const next: Record<string, Decision> = {};
          for (const suggestion of result.suggestions) {
            const id = suggestion.adjustment.id;
            next[id] = touched.has(id) && was[id] !== undefined ? was[id] : suggestion.decision;
          }
          return next;
        });
      })
      .catch((cause) => current && setReadProblem(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => current && setReading(false));
    return () => {
      current = false;
    };
  }, [sessionId, aiAvailable, recipe.id]);
  const chosen = suggestions.map((suggestion) => ({ adjustment: suggestion.adjustment, decision: decisions[suggestion.adjustment.id] ?? suggestion.decision }));
  const autoComment = startingComment(onceNote(chosen), session?.notes ?? []);
  const [comment, setComment] = useState<string | null>(null);
  const [rating, setRatingValue] = useState<number | null>(recipe.rating);
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [servings, setServings] = useState(servingsAt === null ? 1 : Number(servingsAt.toFixed(2)));
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keeping = chosen.filter((choice) => choice.decision !== "once").length;
  const tonightOnly = chosen.length - keeping;

  const save = async () => {
    if (!isValidDate(occurredOn)) {
      setError("Pick a date.");
      return;
    }
    setBusy(true);
    try {
      // Logged once: a retry after a failed keep does not log the cook again.
      if (!logged) {
        await saveCookAndClearTicks(
          { recipeId: recipe.id, event: { occurredOn, message: (comment ?? autoComment).trim(), image: null, servings }, photo },
          { createEvent: (recipeId, event) => createTimelineEvent({ data: { recipeId, event } }), uploadPhoto: uploadTimelineImage }
        );
        setLogged(true);
      }
      if (rating !== recipe.rating && rating !== null) await setRating({ data: { id: recipe.id, rating } });
      if (session !== null) await finishCooking({ data: { recipeId: recipe.id, kept: chosen } });
      await router.invalidate();
      toast({
        intent: "success",
        title: "Cook logged",
        children: keeping > 0 ? `${keeping} ${keeping === 1 ? "change" : "changes"} kept in the recipe` : formatDateStamp(occurredOn),
      });
      await navigate({ to: "/recipes/$slug", params: { slug: recipe.slug } });
    } catch (cause) {
      toastError(logged ? "The cook is logged, but the changes could not be saved" : "Could not log this cook", cause);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await discardCooking({ data: { recipeId: recipe.id } });
      await router.invalidate();
      await navigate({ to: "/recipes/$slug", params: { slug: recipe.slug } });
    } catch (cause) {
      toastError("Could not discard this cook", cause);
      setBusy(false);
    }
  };

  const madeThis = (
    <section className="flex flex-col gap-4" aria-labelledby="made-this-heading">
      <SectionTitle as="h2" id="made-this-heading">
        Made this
      </SectionTitle>
      <Rating value={rating ?? 0} onChange={(value) => setRatingValue(value === 0 ? null : value)} disabled={busy} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date" required feedback={error ? { message: error, intent: "danger" } : undefined}>
          <Input type="date" value={occurredOn} disabled={busy} aria-label="Date" onChange={(event) => setOccurredOn(event.target.value)} />
        </FormField>
        <NumberStepper label="Servings" value={servings} min={1} disabled={busy} onChange={setServings} />
      </div>
      <FormField label="Comment" description="How did it go?">
        <Textarea value={comment ?? autoComment} rows={4} disabled={busy} aria-label="Comment" onChange={(event) => setComment(event.target.value)} />
      </FormField>
      <FormField label="Photo">
        <ImageUpload disabled={busy} onSelect={setPhoto} onRemove={() => setPhoto(null)} />
      </FormField>
    </section>
  );

  const changes = (
    // On a phone the changes come first when there are any: they are the decisions; Made this is the log.
    <section className={cn("flex flex-col gap-3", suggestions.length > 0 && "mobile:order-first")} aria-labelledby="suggested-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Heading as="h2" id="suggested-heading" className="text-xl">
          Suggested changes
        </Heading>
        {!reading && suggestions.length > 0 && (
          <Muted className="text-sm">{aiAvailable && readProblem === null ? "from tonight's cooking" : "from tonight's changes"}</Muted>
        )}
      </div>
      {reading && (
        <Muted as="p" className="text-sm" data-testid="reading-tonight" aria-live="polite">
          Reading tonight's cooking for what to change…
        </Muted>
      )}
      {readProblem !== null && (
        <Message intent="warning" size="sm">
          The assistant could not suggest changes, so these are tonight's changes as they were. {readProblem}
        </Message>
      )}
      {suggestions.length === 0 && !reading ? (
        <Muted as="p" className="text-sm" data-testid="no-suggestions">
          Nothing was changed tonight, so the recipe stays as it is.
        </Muted>
      ) : (
        suggestions.map((suggestion) => {
          const view = viewSuggestion(recipe, suggestion.adjustment, session?.servings ?? null);
          if (view === null) return null;
          return (
            <SuggestionCard
              key={suggestion.adjustment.id}
              suggestion={suggestion}
              view={view}
              decision={decisions[suggestion.adjustment.id] ?? suggestion.decision}
              onDecide={(decision) => {
                setTouched((was) => new Set(was).add(suggestion.adjustment.id));
                setDecisions((was) => ({ ...was, [suggestion.adjustment.id]: decision }));
              }}
            />
          );
        })
      )}
    </section>
  );

  const summary =
    keeping > 0
      ? `${keeping} ${keeping === 1 ? "change goes" : "changes go"} into the recipe${tonightOnly > 0 ? `; ${tonightOnly} ${tonightOnly === 1 ? "is" : "are"} for tonight` : ""}`
      : chosen.length > 0
        ? "Nothing goes into the recipe unless you choose Keep"
        : "";

  return (
    <div className="flex min-h-dvh flex-col" data-testid="review-page">
      <header className="sticky top-0 z-app-bar flex items-center gap-3 border-b border-border-normal bg-bg-normal px-4 py-2 desktop:top-(--top-bar) desktop:h-14 desktop:px-6">
        <Button asChild variant="ghost" intent="neutral" iconOnly aria-label="Back to cooking">
          <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={session === null ? undefined : { cooking: true }}>
            <span aria-hidden="true" className="text-2xl leading-none">
              ‹
            </span>
          </Link>
        </Button>
        {/* The name beside the question on a desktop, under it on a phone. */}
        <div className="flex min-w-0 flex-col desktop:flex-row desktop:items-baseline desktop:gap-3">
          <Heading as="h1" className="min-w-0 truncate text-lg desktop:text-xl">
            How did it go?
          </Heading>
          <Muted className="min-w-0 truncate text-sm desktop:text-base">{recipe.name}</Muted>
        </div>
        <span className="flex-1" />
        {session !== null && (
          <Button variant="ghost" intent="neutral" size="sm" disabled={busy} onClick={() => void discard()}>
            Discard
          </Button>
        )}
      </header>

      {session === null && (
        <Message intent="info" className="m-4 desktop:mx-6">
          This recipe is not being cooked, so there is nothing to review. You can still log a cook.
        </Message>
      )}

      <div
        className={cn(
          "flex flex-1 flex-col gap-6 p-4 pb-28",
          "desktop:grid desktop:grid-cols-[minmax(22rem,26rem)_minmax(0,56rem)] desktop:items-start desktop:gap-8 desktop:p-6 desktop:pb-24"
        )}
      >
        <div className="flex flex-col gap-4 rounded-xl bg-bg-normal p-4 desktop:sticky desktop:top-[calc(var(--top-bar)+4.5rem)] desktop:p-6">{madeThis}</div>
        {changes}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-content-sticky flex items-center gap-3 border-t border-border-normal bg-bg-normal px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] desktop:px-6"
        data-testid="review-save-bar"
      >
        <span className="min-w-0 flex-1 text-sm text-fg-normal">{summary}</span>
        <Button variant="solid" intent="brand" disabled={busy || reading} onClick={() => void save()} className="mobile:h-12 mobile:flex-1 mobile:max-w-48">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
