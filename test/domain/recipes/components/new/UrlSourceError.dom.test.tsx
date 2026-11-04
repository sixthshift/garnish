// A page that could not be read (M43.3, decisions.md row 202): one error, and
// inside it the two ways on — paste first, then the bookmark — each pressed.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RecipeSource } from "../../../../../src/domain/recipes/components/new/RecipeSource";
import { ImportError, type ImportedRecipe } from "../../../../../src/domain/recipes/import";
import { renderInRouter } from "../../../../helpers/dom";

const SOURCE = "https://www.taste.com.au/recipes/lemon-tart";

const walled = async (): Promise<ImportedRecipe> => {
  throw new ImportError("blocked", "Couldn't get this recipe from www.taste.com.au.");
};

async function failedRead(aiAvailable: boolean) {
  const onChoose = vi.fn();
  const user = userEvent.setup();
  await renderInRouter(
    <RecipeSource units={[]} source="url" onChoose={onChoose} onDraft={() => {}} loadFoods={async () => []} load={walled} aiAvailable={aiAvailable} />
  );
  await user.type(screen.getByLabelText("Recipe address"), SOURCE);
  await user.click(screen.getByRole("button", { name: "Read the page" }));
  await waitFor(() => expect(screen.getByTestId("import-error")).toHaveTextContent("Couldn't get this recipe from www.taste.com.au."));
  return { onChoose, user };
}

test("the error offers paste, then the bookmark, in that order", async () => {
  await failedRead(true);
  const error = screen.getByTestId("import-error");
  const labels = Array.from(error.querySelectorAll("button")).map((button) => button.textContent?.trim());
  expect(labels).toEqual(["Paste it instead", "🌿 Send it from your browser"]);
});

test("Paste it instead opens the paste", async () => {
  const { onChoose, user } = await failedRead(true);
  await user.click(screen.getByRole("button", { name: "Paste it instead" }));
  expect(onChoose).toHaveBeenCalledWith("paste");
});

test("Send it from your browser opens the bookmark's card", async () => {
  const { onChoose, user } = await failedRead(true);
  await user.click(screen.getByRole("button", { name: /Send it from your browser/ }));
  expect(onChoose).toHaveBeenCalledWith("browser");
});

test("with no model, the paste offer asks for the page's HTML, which is all a paste reads then", async () => {
  const { onChoose, user } = await failedRead(false);
  expect(screen.queryByRole("button", { name: "Paste it instead" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Paste the page's HTML instead" }));
  expect(onChoose).toHaveBeenCalledWith("paste");
});
