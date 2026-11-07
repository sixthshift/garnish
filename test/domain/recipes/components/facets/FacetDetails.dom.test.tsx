// The recipe page's facets (decisions.md row 209): the chips of what has been
// said, each a link to the library narrowed to it, and the sheet that sets
// every layer, written once when it closes.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { FacetDetails } from "../../../../../src/domain/recipes/components/facets/FacetDetails";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";

const rpc = vi.hoisted(() => ({ setFacets: vi.fn(async ({ data }: { data: unknown }) => data) }));
vi.mock("../../../../../src/api/rpc/recipes", async (importOriginal) => ({ ...(await importOriginal<object>()), setFacets: rpc.setFacets }));

const ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  rpc.setFacets.mockReset();
  rpc.setFacets.mockImplementation(async ({ data }: { data: unknown }) => data);
});

test("a recipe nothing has been said of offers to say it, and says nothing else", async () => {
  await renderInRouter(<FacetDetails id={ID} name="Larb" facets={noFacets()} />);
  expect(screen.queryByTestId("facet-chips")).toBeNull();
  expect(screen.getByRole("button", { name: "Add course, cuisine and more" })).toBeTruthy();
});

test("what has been said shows as chips, each a link to the library narrowed to it", async () => {
  await renderInRouter(<FacetDetails id={ID} name="Larb" facets={{ ...noFacets(), course: ["main"], cuisine: ["thai"] }} />);
  const chips = within(screen.getByTestId("facet-chips"));
  expect(chips.getByRole("link", { name: "Main" }).getAttribute("href")).toContain("course=");
  expect(decodeURIComponent(chips.getByRole("link", { name: "Thai" }).getAttribute("href")!)).toContain('cuisine=["thai"]');
  expect(screen.getByRole("button", { name: "Change course, cuisine and more" })).toBeTruthy();
});

test("the sheet sets every layer and writes them once, on Done", async () => {
  const user = userEvent.setup();
  await renderInRouter(<FacetDetails id={ID} name="Larb" facets={noFacets()} />);
  await user.click(screen.getByRole("button", { name: "Add course, cuisine and more" }));
  const sheet = within(screen.getByTestId("facet-sheet"));
  await user.click(sheet.getByRole("button", { name: "Salad" }));
  await user.click(sheet.getByRole("button", { name: "Main" }));
  await user.click(sheet.getByRole("button", { name: "Thai" }));
  await user.click(sheet.getByRole("button", { name: "Summer" }));
  expect(rpc.setFacets).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(rpc.setFacets).toHaveBeenCalledTimes(1));
  expect(rpc.setFacets.mock.calls[0]![0]).toEqual({
    data: { id: ID, facets: { ...noFacets(), course: ["main", "salad"], cuisine: ["thai"], season: ["summer"] } },
  });
  expect(within(screen.getByTestId("facet-chips")).getByRole("link", { name: "Thai" })).toBeTruthy();
});

test("closing the sheet unchanged writes nothing", async () => {
  const user = userEvent.setup();
  await renderInRouter(<FacetDetails id={ID} name="Larb" facets={{ ...noFacets(), diet: ["vegan"] }} />);
  await user.click(screen.getByRole("button", { name: "Change course, cuisine and more" }));
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(rpc.setFacets).not.toHaveBeenCalled();
});

test("a failed write puts the chips back", async () => {
  rpc.setFacets.mockRejectedValue(new Error("offline"));
  const user = userEvent.setup();
  await renderInRouter(<FacetDetails id={ID} name="Larb" facets={noFacets()} />);
  await user.click(screen.getByRole("button", { name: "Add course, cuisine and more" }));
  await user.click(within(screen.getByTestId("facet-sheet")).getByRole("button", { name: "Vegan" }));
  await user.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByTestId("facet-chips")).toBeNull());
  expect(rpc.setFacets).toHaveBeenCalledTimes(1);
});
