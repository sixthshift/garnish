import type { TimelineEvent, TimelineEventInput } from "../../../../domain/recipe";
import { clearTicksNow } from "../../../../lib/useTicks";

/** What one logged cook writes: the event and an optional photo. */
export type CookSave = { recipeId: string; event: TimelineEventInput; photo: File | null };

/** The writes a logged cook makes, injected so the order is testable without a server. */
export type CookWrites = {
  createEvent: (recipeId: string, event: TimelineEventInput) => Promise<TimelineEvent>;
  uploadPhoto: (eventId: string, photo: File) => Promise<unknown>;
};

/**
 * Log a cook: create the event, then upload the photo under its id if there
 * is one. Returns the event. Rating is not this path's job any more:
 * it lives in the header, written straight through `setRating` from the
 * recipe route. Pure apart from the injected writes.
 */
export async function saveCook({ recipeId, event, photo }: CookSave, writes: CookWrites): Promise<TimelineEvent> {
  const created = await writes.createEvent(recipeId, event);
  if (photo) await writes.uploadPhoto(created.id, photo);
  return created;
}

/**
 * `saveCook`, then clear the recipe's ticks: a logged cook is a fresh
 * start next time, so the ingredient and step ticks from this session are
 * wiped once the event is safely saved — not before, so a failed save leaves
 * them for another attempt.
 */
export async function saveCookAndClearTicks(save: CookSave, writes: CookWrites): Promise<TimelineEvent> {
  const created = await saveCook(save, writes);
  clearTicksNow(save.recipeId);
  return created;
}
