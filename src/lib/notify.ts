// Transient feedback for something that already happened: a save, a delete, a
// failed upload. `notify()` is callable from anywhere — a submit handler, a
// catch block, a non-React helper — and the single `<Toaster />` mounted in
// `__root.tsx` renders whatever is in the store.
//
// Same shape as the other lib/ modules: a pure controller (here a store over a
// plain array, with no DOM and no timers of its own) plus a thin hook. The
// module-level `notices` store is the app's one instance; tests build their own
// with `createNoticeStore()`.
import { useSyncExternalStore } from "react";
import { randomUuid } from "./ids";

/** Maps straight onto the design system's Message/Toast intents. */
export type NoticeIntent = "neutral" | "success" | "warning" | "danger";

export type Notice = {
  id: string;
  intent: NoticeIntent;
  /** Bold line. Optional: a one-line notice can be all message. */
  title?: string;
  message?: string;
  /** Milliseconds until it dismisses itself. 0 keeps it until dismissed by hand. */
  duration: number;
  /**
   * One optional link-style button inside the notice: "3 items added" with a
   * "View list" beside it (M31.3). A callback rather than an href because the
   * Toaster is not the router's business — the caller, which is already inside
   * a route, navigates.
   */
  action?: NoticeAction;
};

/** The notice's one button: its label and what it does. */
export type NoticeAction = { label: string; onSelect: () => void };

/** What a caller passes to `notify()`. Everything but the text has a default. */
export type NoticeInput = {
  intent?: NoticeIntent;
  title?: string;
  message?: string;
  duration?: number;
  action?: NoticeAction;
};

/** How many notices are shown at once; the oldest falls off the bottom. Mealie shows one, a small stack reads better on a phone. */
export const MAX_NOTICES = 3;

const DEFAULT_DURATION = 5000;
/** Failures stay put: they usually carry a message worth reading, and often a retry. */
const DANGER_DURATION = 0;

/** The default lifetime for an intent. Pure. */
export function defaultDuration(intent: NoticeIntent): number {
  return intent === "danger" ? DANGER_DURATION : DEFAULT_DURATION;
}

/** A thrown value as a line a person can read. Pure. */
export function messageFrom(error: unknown): string {
  if (error instanceof Error) return error.message;
  const text = String(error);
  return text === "" ? "Something went wrong." : text;
}

/** A notice from an input, with the intent, id and duration filled in. `newId` is injected so tests get stable ids. */
export function toNotice(input: NoticeInput, newId: () => string): Notice {
  const intent = input.intent ?? "neutral";
  return {
    id: newId(),
    intent,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.message === undefined ? {} : { message: input.message }),
    ...(input.action === undefined ? {} : { action: input.action }),
    duration: input.duration ?? defaultDuration(intent),
  };
}

/** Append `notice`, dropping the oldest once the stack is full. Pure. */
export function withNotice(notices: readonly Notice[], notice: Notice): Notice[] {
  return [...notices, notice].slice(-MAX_NOTICES);
}

export type NoticeStore = {
  /** Register a listener; returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** The current stack. Reference-stable until it changes, as useSyncExternalStore needs. */
  snapshot: () => Notice[];
  /** Add a notice; returns its id. */
  push: (input: NoticeInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const EMPTY: Notice[] = [];

/** A notice stack with subscribers. No DOM, no timers: the Toaster owns dismissal timing. */
export function createNoticeStore(newId: () => string = randomUuid): NoticeStore {
  let notices: Notice[] = EMPTY;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    snapshot: () => notices,
    push(input) {
      const notice = toNotice(input, newId);
      notices = withNotice(notices, notice);
      emit();
      return notice.id;
    },
    dismiss(id) {
      const next = notices.filter((notice) => notice.id !== id);
      if (next.length === notices.length) return; // unknown id: no change, no re-render
      notices = next.length === 0 ? EMPTY : next;
      emit();
    },
    clear() {
      if (notices.length === 0) return;
      notices = EMPTY;
      emit();
    },
  };
}

/** The app's one stack. */
export const notices = createNoticeStore();

/** Show a notice. Returns its id, so a caller can dismiss it early. */
export function notify(input: NoticeInput): string {
  return notices.push(input);
}

/** `notify` for a caught error: danger intent, the error's own message. */
export function notifyError(title: string, error: unknown): string {
  return notify({ intent: "danger", title, message: messageFrom(error) });
}

export function dismissNotice(id: string): void {
  notices.dismiss(id);
}

/** The current stack, re-rendering the caller as it changes. Empty during SSR. */
export function useNotices(store: NoticeStore = notices): Notice[] {
  return useSyncExternalStore(store.subscribe, store.snapshot, () => EMPTY);
}
