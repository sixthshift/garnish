// The design system owns the toast stack (`toast()`, `ToastStack`); this is
// what garnish adds on top: the failure shape every catch block uses, and
// where the stack sits on garnish's screens.

import { type ToastHandle, toast } from "@sixthshift/design-system/overlay";
import { messageFrom } from "./errors";

/** `toast` for a caught error: danger intent, so it stays until read, with the error's own message. */
export function toastError(title: string, error: unknown): ToastHandle {
  return toast({ intent: "danger", title, children: messageFrom(error) });
}

/**
 * The height of the recipe page's fixed timer strip, set on the document while
 * it shows (`TimerStrip`), unset otherwise. The stack adds it to its own
 * bottom offset so a toast lands above the strip's rows, not on them.
 */
export const TIMER_STRIP_VAR = "--timer-strip";

/**
 * Where the stack sits, merged over the design system's bottom-centre default:
 * on a phone, a column above the bottom nav, oldest first; on a desktop, the
 * bottom-right corner. Either way raised by the timer strip's height while it
 * shows.
 */
export const TOAST_POSITION = `inset-x-0 bottom-[calc(6rem+var(--timer-strip,0px))] translate-x-0 flex-col gap-2 px-4 desktop:inset-x-auto desktop:right-6 desktop:bottom-[calc(1.5rem+var(--timer-strip,0px))] desktop:items-end desktop:px-0`;
