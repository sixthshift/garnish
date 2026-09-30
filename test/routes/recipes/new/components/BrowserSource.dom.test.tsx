// The Save to Garnish setup card: the link to drag carries the bookmark's
// code for the address Garnish is open at, and pressing it here only says to drag it.
import { act, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BrowserSource } from "../../../../../src/routes/recipes/new/components/BrowserSource";

test("the link is the bookmark for this Garnish, and a press here says to drag it", () => {
  render(<BrowserSource onBack={() => {}} />);
  const link = screen.getByTestId("bookmarklet");
  const href = link.getAttribute("href") ?? "";
  expect(href.startsWith("javascript:")).toBe(true);
  expect(decodeURIComponent(href)).toContain(JSON.stringify(window.location.origin));
  expect(screen.getByLabelText("The bookmark's code")).toHaveValue(href);

  act(() => link.click());
  expect(screen.getByText(/Drag it rather than pressing it here/)).toBeInTheDocument();
});
