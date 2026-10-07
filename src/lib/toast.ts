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
 * The stack's top placement, taken while a page marked `data-toasts="top"` is
 * on screen: one whose foot is its own controls. Cook mode's footer holds the
 * timer strip and Next and grows with each timer, so "Timer done" landed on
 * the strip (critique #15b). The stack portals to the body, outside the page,
 * so it asks the document rather than an ancestor. Spelled out whole:
 * Tailwind finds classes by scanning the source as text.
 */
const TOAST_TOP =
  "[:root:has([data-toasts=top])_&]:bottom-auto [:root:has([data-toasts=top])_&]:top-[max(1rem,env(safe-area-inset-top))] md:[:root:has([data-toasts=top])_&]:top-6";

/**
 * The height of the recipe page's fixed timer strip, set on the document while
 * it shows (`TimerStrip`), unset otherwise. The stack adds it to its own
 * bottom offset so a toast lands above the strip's rows, not on them.
 */
export const TIMER_STRIP_VAR = "--timer-strip";

/**
 * Where the stack sits, merged over the design system's bottom-centre default:
 * on a phone, a column above the bottom nav, oldest first; from `md`, the
 * bottom-right corner. Either way raised by the timer strip's height while it
 * shows. On a `data-toasts="top"` page, the top instead.
 */
export const TOAST_POSITION = `inset-x-0 bottom-[calc(6rem+var(--timer-strip,0px))] translate-x-0 flex-col gap-2 px-4 md:inset-x-auto md:right-6 md:bottom-[calc(1.5rem+var(--timer-strip,0px))] md:items-end md:px-0 ${TOAST_TOP}`;
