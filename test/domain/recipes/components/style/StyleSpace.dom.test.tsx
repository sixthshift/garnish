// The Style space pressed: it runs on arrival, the author's recipe and the house style's are side by side, the house style is chosen even when the check flags it, Save names the version it keeps, and a retyped step is saved as typed.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { StyleSpace } from "../../../../../src/domain/recipes/components/style/StyleSpace";
import { styleOriginal } from "../../../../../src/domain/recipes/components/style/styleSession";
import { checkRestyle, type RestyledPart, type StyleRule } from "../../../../../src/domain/recipes/style";
import { restyledStep } from "../../../../helpers/restyle";

const parts = [
  {
    name: "",
    ingredients: [
      { quantity: 3, unit: null, food: { name: "garlic", pluralName: null }, note: "(smashed and sliced)", originalText: "3 cloves garlic", fixed: false },
    ],
    steps: [
      { title: "", text: "Heat 2 tablespoons oil in a wok over high heat.", summary: "" },
      { title: "", text: "Add the garlic and cook for a minute or two until fragrant.", summary: "" },
    ],
  },
];

const rewrite: RestyledPart[] = [
  {
    name: "",
    rows: [0],
    notes: ["smashed and sliced"],
    steps: [
      restyledStep("Heat 2 tbsp of the oil in the wok over high heat.", { title: "Heat the wok" }),
      restyledStep("Add the garlic and cook for 1 or 2 minutes."),
    ],
  },
];

const rules: StyleRule[] = [
  { id: "r1", position: 0, text: "Imperative, verb first.", enabled: true, createdAt: "2026-09-29T00:00:00.000Z", updatedAt: "2026-09-29T00:00:00.000Z" },
  { id: "r2", position: 1, text: "Prefer metric.", enabled: false, createdAt: "2026-09-29T00:00:00.000Z", updatedAt: "2026-09-29T00:00:00.000Z" },
];

const LABELS = { rewrite: "Save in house style", original: "Save as written" };

function setup() {
  const run = vi.fn(async (_ruleIds: string[]) => ({ parts: rewrite, check: checkRestyle(styleOriginal(parts), rewrite) }));
  const onSave = vi.fn(async (_parts: RestyledPart[] | null) => {});
  render(<StyleSpace parts={parts} run={run} onSave={onSave} saveLabels={LABELS} loadRules={async () => rules} />);
  return { run, onSave, user: userEvent.setup() };
}

test("runs on arrival with the statements that are on, and starts on the house style even with a finding, which it shows", async () => {
  const { run } = setup();
  const compare = await screen.findByTestId("style-compare");
  expect(run).toHaveBeenCalledWith(["r1"]);
  expect(compare).toHaveAttribute("data-choice", "rewrite");
  expect(screen.getByTestId("style-status")).toHaveTextContent("Choose the version to save.");
  expect(screen.getByRole("radio", { name: /In your house style/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /As written/ })).not.toBeChecked();
  const house = screen.getByTestId("style-rewrite");
  expect(within(house).getByText("Heat the wok")).toBeInTheDocument();
  expect(within(house).getByTestId("style-finding")).toHaveTextContent("“until fragrant” is in the original but not in the rewrite.");
  expect(within(house).getByText("2 steps · 1 to check")).toBeInTheDocument();
  expect(within(screen.getByTestId("style-original")).getByText("Add the garlic and cook for a minute or two until fragrant.")).toBeInTheDocument();
  expect(screen.getByTestId("style-save")).toHaveTextContent("Save in house style");
  expect(screen.getByTestId("style-save-warning")).toHaveTextContent("Saving this drops “until fragrant”.");
});

test("Save writes the house style, a retyped step as typed, and the rewritten notes", async () => {
  const { onSave, user } = setup();
  const house = await screen.findByTestId("style-rewrite");

  await user.click(within(house).getByRole("button", { name: "Edit step 1" }));
  const field = screen.getByLabelText("Step 1 text");
  await user.clear(field);
  await user.type(field, "Heat the wok until smoking.");
  await user.click(screen.getByRole("button", { name: "Done" }));

  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0]![0]!;
  expect(saved[0]!.steps.map((step) => step.text)).toEqual(["Heat the wok until smoking.", "Add the garlic and cook for 1 or 2 minutes."]);
  expect(saved[0]!.notes).toEqual(["smashed and sliced"]);
});

test("choosing As written says so on Save, only the house style can be retyped, and Save then writes nothing", async () => {
  const { onSave, user } = setup();
  await screen.findByTestId("style-compare");
  expect(within(screen.getByTestId("style-original")).queryByRole("button", { name: /Edit step/ })).not.toBeInTheDocument();

  await user.click(screen.getByRole("radio", { name: /As written/ }));
  expect(screen.getByTestId("style-compare")).toHaveAttribute("data-choice", "original");
  expect(screen.getByTestId("style-original")).toHaveAttribute("data-chosen", "true");
  expect(screen.getByTestId("style-save")).toHaveTextContent("Save as written");
  expect(screen.queryByTestId("style-save-warning")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Edit step/ })).not.toBeInTheDocument();

  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
});

test("a rewrite that merged steps is shown and saved whole", async () => {
  const merged: RestyledPart[] = [
    {
      name: "",
      rows: [0],
      notes: ["smashed and sliced"],
      steps: [restyledStep("Heat 2 tablespoons oil in a wok over high heat, then add the garlic and cook for a minute or two until fragrant.")],
    },
  ];
  const onSave = vi.fn(async (_parts: RestyledPart[] | null) => {});
  const user = userEvent.setup();
  render(
    <StyleSpace
      parts={parts}
      run={async () => ({ parts: merged, check: checkRestyle(styleOriginal(parts), merged) })}
      onSave={onSave}
      saveLabels={LABELS}
      loadRules={async () => rules}
    />
  );
  const house = await screen.findByTestId("style-rewrite");
  expect(within(house).getAllByTestId("style-step")).toHaveLength(1);
  expect(within(screen.getByTestId("style-original")).getAllByTestId("style-step")).toHaveLength(2);

  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]![0]![0]!.steps).toHaveLength(1);
});

test("a run that fails shows why, keeps the author's steps on screen with Save as written, and can be tried again", async () => {
  const run = vi.fn().mockRejectedValueOnce(new Error("The model provider is overloaded right now."));
  run.mockResolvedValueOnce({ parts: rewrite, check: checkRestyle(styleOriginal(parts), rewrite) });
  const user = userEvent.setup();
  render(<StyleSpace parts={parts} run={run} onSave={async () => {}} saveLabels={LABELS} loadRules={async () => rules} />);
  await waitFor(() => expect(screen.getByTestId("style-error")).toHaveTextContent("overloaded"));
  expect(screen.getByText("Add the garlic and cook for a minute or two until fragrant.")).toBeInTheDocument();
  expect(screen.getByTestId("style-save")).toHaveTextContent("Save as written");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.getByTestId("style-compare")).toBeInTheDocument());
});

test("a rewrite that changes nothing shows the recipe once, with Save as written", async () => {
  const same: RestyledPart[] = [{ name: "", rows: [0], notes: ["(smashed and sliced)"], steps: parts[0]!.steps.map((step) => restyledStep(step.text)) }];
  render(
    <StyleSpace
      parts={parts}
      run={async () => ({ parts: same, check: checkRestyle(styleOriginal(parts), same) })}
      onSave={async () => {}}
      saveLabels={LABELS}
      loadRules={async () => rules}
    />
  );
  await waitFor(() => expect(screen.getByTestId("style-status")).toHaveTextContent("The house style changes nothing here."));
  expect(screen.queryByTestId("style-compare")).not.toBeInTheDocument();
  expect(screen.getByTestId("style-save")).toHaveTextContent("Save as written");
});

test("a part with nothing in it, the main body once every line sat under a heading, is not shown", async () => {
  const withEmpty = [
    { name: "", ingredients: [], steps: [] },
    { ...parts[0]!, name: "Stir-fry" },
  ];
  const answer: RestyledPart[] = [
    { name: "", rows: [], notes: [], steps: [] },
    { ...rewrite[0]!, name: "Stir-fry" },
  ];
  render(
    <StyleSpace
      parts={withEmpty}
      run={async () => ({ parts: answer, check: checkRestyle(styleOriginal(withEmpty), answer) })}
      onSave={async () => {}}
      saveLabels={LABELS}
      loadRules={async () => rules}
    />
  );
  const house = await screen.findByTestId("style-rewrite");
  expect(within(house).getAllByRole("heading")).toHaveLength(1);
  expect(within(house).queryByRole("heading", { name: "Method" })).not.toBeInTheDocument();
});

test("a rewrite laid out in new parts is shown as the recipe will read, says so, and is saved with its layout", async () => {
  const laidOut: RestyledPart[] = [
    {
      name: "Stir-fry",
      rows: [0],
      notes: ["smashed and sliced"],
      steps: [
        restyledStep("Heat 2 tbsp of the oil in the wok over high heat.", { title: "Heat the wok" }),
        restyledStep("Add the garlic and cook for a minute or two until fragrant."),
      ],
    },
  ];
  const onSave = vi.fn(async (_parts: RestyledPart[] | null) => {});
  const user = userEvent.setup();
  render(
    <StyleSpace
      parts={parts}
      run={async () => ({ parts: laidOut, check: checkRestyle(styleOriginal(parts), laidOut) })}
      onSave={onSave}
      saveLabels={LABELS}
      loadRules={async () => rules}
    />
  );
  const house = await screen.findByTestId("style-rewrite");
  expect(screen.getByTestId("style-compare")).toHaveAttribute("data-choice", "rewrite");
  expect(within(house).getByText("Laid out in new parts.")).toBeInTheDocument();
  expect(within(house).getByRole("heading", { name: "Stir-fry" })).toBeInTheDocument();
  expect(within(screen.getByTestId("style-original")).getByRole("heading", { name: "Method" })).toBeInTheDocument();

  await user.click(within(house).getByRole("button", { name: "Edit step 1" }));
  const field = screen.getByLabelText("Step 1 text");
  await user.clear(field);
  await user.type(field, "Heat the wok until smoking.");
  await user.click(screen.getByRole("button", { name: "Done" }));

  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0]![0]!;
  expect(saved.map((part) => [part.name, part.rows])).toEqual([["Stir-fry", [0]]]);
  expect(saved[0]!.steps[0]!.text).toBe("Heat the wok until smoking.");
});

test("a flagged laid-out rewrite still starts on the house style, and choosing As written saves nothing", async () => {
  const laidOut: RestyledPart[] = [{ ...rewrite[0]!, name: "Stir-fry" }];
  const onSave = vi.fn(async (_parts: RestyledPart[] | null) => {});
  const user = userEvent.setup();
  render(
    <StyleSpace
      parts={parts}
      run={async () => ({ parts: laidOut, check: checkRestyle(styleOriginal(parts), laidOut) })}
      onSave={onSave}
      saveLabels={LABELS}
      loadRules={async () => rules}
    />
  );
  const compare = await screen.findByTestId("style-compare");
  expect(compare).toHaveAttribute("data-choice", "rewrite");
  expect(screen.getByTestId("style-finding")).toHaveTextContent("“until fragrant” is in the original but not in the rewrite.");
  await user.click(screen.getByRole("radio", { name: /As written/ }));
  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
});

test("while the run is out the space is a loading screen, and the recipe comes back with the answer, landing step by step", async () => {
  let answer: (value: Awaited<ReturnType<Parameters<typeof StyleSpace>[0]["run"]>>) => void = () => {};
  const run = vi.fn((_ruleIds: string[]) => new Promise<Awaited<ReturnType<Parameters<typeof StyleSpace>[0]["run"]>>>((resolve) => (answer = resolve)));
  render(<StyleSpace parts={parts} run={run} onSave={async () => {}} saveLabels={LABELS} loadRules={async () => rules} />);

  await waitFor(() => expect(screen.getByTestId("style-status")).toHaveTextContent("Rewriting in your house style…"));
  expect(screen.getByTestId("style-wait")).toBeInTheDocument();
  expect(screen.queryByTestId("style-compare")).not.toBeInTheDocument();
  expect(screen.getByTestId("style-space")).not.toHaveClass("style-landed");

  answer({ parts: rewrite, check: checkRestyle(styleOriginal(parts), rewrite) });
  await waitFor(() => expect(screen.getByTestId("style-space")).toHaveClass("style-landed"));
  expect(screen.queryByTestId("style-wait")).not.toBeInTheDocument();
  const [first, second] = within(screen.getByTestId("style-rewrite")).getAllByTestId("style-step");
  expect(first).toHaveClass("style-step-land");
  expect(first!.style.getPropertyValue("--i")).toBe("1");
  expect(second!.style.getPropertyValue("--i")).toBe("2");
});
