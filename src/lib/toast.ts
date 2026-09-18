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
 * Where the stack sits, merged over the design system's bottom-centre default:
 * on a phone, a column above the bottom nav, oldest first; from `md`, the
 * bottom-right corner.
 */
export const TOAST_POSITION = "inset-x-0 bottom-24 translate-x-0 flex-col gap-2 px-4 md:inset-x-auto md:right-6 md:bottom-6 md:items-end md:px-0";
