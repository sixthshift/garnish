// What garnish adds over the design system's toast: the failure shape and
// the stack's place on its screens. The stack itself is the design system's.
import { TOAST_STACK_CLASS, toastStore } from "@sixthshift/design-system/overlay";
import { cn } from "@sixthshift/design-system/utils";
import { afterEach, expect, test } from "vitest";
import { TOAST_POSITION, toastError } from "../../src/lib/toast";

afterEach(() => {
  for (const record of toastStore.snapshot()) toastStore.remove(record.id);
});

test("toastError is a danger toast, so it stays until read, carrying the error's message", () => {
  const handle = toastError("Could not save", new Error("disk full"));
  const [record] = toastStore.snapshot();
  expect(record?.id).toBe(handle.id);
  expect(record?.options).toEqual({ intent: "danger", title: "Could not save", children: "disk full" });
  expect(record?.duration).toBe(0);
});

test("the position merges over the design system's bottom-centre default rather than fighting it", () => {
  const classes = cn(TOAST_STACK_CLASS, TOAST_POSITION).split(" ");
  expect(classes).not.toContain("left-1/2");
  expect(classes).not.toContain("-translate-x-1/2");
  expect(classes).not.toContain("flex-col-reverse");
  expect(classes).toEqual(
    expect.arrayContaining(["fixed", "z-toast", "pointer-events-none", "inset-x-0", "bottom-24", "flex-col", "md:right-6", "md:bottom-6"])
  );
});
