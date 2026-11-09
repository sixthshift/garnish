// The Style space pressed: it runs on arrival, the author's words and the rewrite are on screen together, a flagged step starts on the author's words, the per-step choices change what Save writes, and a retyped step is saved as typed.
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

function setup() {
  const run = vi.fn(async (_ruleIds: string[]) => ({ parts: rewrite, check: checkRestyle(styleOriginal(parts), rewrite) }));
  const onSave = vi.fn(async (_parts: RestyledPart[] | null) => {});
  render(<StyleSpace parts={parts} run={run} onSave={onSave} saveLabel="Save recipe" loadRules={async () => rules} />);
  return { run, onSave, user: userEvent.setup() };
}

test("runs on arrival with the statements that are on, and starts the flagged step on the original", async () => {
  const { run } = setup();
  await waitFor(() => expect(screen.getByTestId("style-status")).toHaveTextContent("1 of 2 rewrites kept · 1 needs a look"));
  expect(run).toHaveBeenCalledWith(["r1"]);
  const [first, second] = screen.getAllByTestId("style-step");
  expect(first).toHaveAttribute("data-choice", "rewrite");
  expect(within(first!).getByText("Heat the wok")).toBeInTheDocument();
  expect(second).toHaveAttribute("data-choice", "original");
  expect(within(second!).getByTestId("style-step-finding")).toHaveTextContent("“until fragrant” is in the original but not in the rewrite.");
});

test("Save writes each step's chosen side, a retyped rewrite as typed, and the rewritten notes", async () => {
  const { onSave, user } = setup();
  await waitFor(() => expect(screen.getAllByTestId("style-step")[0]).toHaveAttribute("data-choice", "rewrite"));

  await user.click(screen.getByRole("button", { name: "Edit" }));
  const field = screen.getByLabelText("Step 1 text");
  await user.clear(field);
  await user.type(field, "Heat the wok until smoking.");
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getAllByTestId("style-step-status")[0]).toHaveTextContent("Edited");

  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0]![0]!;
  expect(saved[0]!.steps.map((step) => step.text)).toEqual(["Heat the wok until smoking.", "Add the garlic and cook for a minute or two until fragrant."]);
  expect(saved[0]!.notes).toEqual(["smashed and sliced"]);
});

test("keeping the flagged rewrite anyway warns before Save, and putting every step back saves nothing", async () => {
  const { onSave, user } = setup();
  await waitFor(() => expect(screen.getAllByTestId("style-step")[1]).toHaveAttribute("data-choice", "original"));

  await user.click(screen.getByRole("button", { name: "Keep the rewrite of step 2" }));
  expect(screen.getByTestId("style-save-warning")).toHaveTextContent("Saving this mix drops “until fragrant”.");

  await user.click(screen.getByRole("button", { name: "Use all original" }));
  expect(screen.queryByTestId("style-save-warning")).not.toBeInTheDocument();
  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
});

test("each step reads as the recipe will: the rewrite, the original one press away, and either side can be taken", async () => {
  const { user } = setup();
  await waitFor(() => expect(screen.getAllByTestId("style-step")[0]).toHaveAttribute("data-choice", "rewrite"));
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  const first = screen.getAllByTestId("style-step")[0]!;
  expect(within(first).getByTestId("style-step-rewrite")).toHaveTextContent("Heat 2 tbsp of the oil in the wok over high heat.");
  expect(within(first).queryByText("Heat 2 tablespoons oil in a wok over high heat.")).not.toBeInTheDocument();

  await user.click(within(first).getByRole("button", { name: "Show the original of step 1" }));
  expect(within(first).getByTestId("style-step-other")).toHaveTextContent("Heat 2 tablespoons oil in a wok over high heat.");

  await user.click(within(first).getByRole("button", { name: "Use the original of step 1" }));
  expect(first).toHaveAttribute("data-choice", "original");
  expect(within(first).getByTestId("style-step-original")).toHaveTextContent("Heat 2 tablespoons oil in a wok over high heat.");
  expect(within(first).getByRole("button", { name: "Keep the rewrite of step 1" })).toHaveAttribute("aria-pressed", "false");
});

test("a part whose rewrite merged its steps is taken whole, with the other side one press away", async () => {
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
      saveLabel="Save recipe"
      loadRules={async () => rules}
    />
  );
  await user.click(await screen.findByRole("button", { name: "Keep all" }));
  expect(screen.getByTestId("style-rewrite-column")).toHaveTextContent("then add the garlic");
  expect(screen.getAllByTestId("style-plain-step")).toHaveLength(1);

  await user.click(screen.getByRole("button", { name: "Show original" }));
  expect(screen.getAllByTestId("style-plain-step")).toHaveLength(3);
  expect(screen.getByText("Add the garlic and cook for a minute or two until fragrant.")).toBeInTheDocument();

  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]![0]![0]!.steps).toHaveLength(1);
});

test("a run that fails shows why, keeps the author's steps on screen, and can be tried again", async () => {
  const run = vi.fn().mockRejectedValueOnce(new Error("The model provider is overloaded right now."));
  run.mockResolvedValueOnce({ parts: rewrite, check: checkRestyle(styleOriginal(parts), rewrite) });
  const user = userEvent.setup();
  render(<StyleSpace parts={parts} run={run} onSave={async () => {}} saveLabel="Save recipe" loadRules={async () => rules} />);
  await waitFor(() => expect(screen.getByTestId("style-error")).toHaveTextContent("overloaded"));
  expect(screen.getByText("Add the garlic and cook for a minute or two until fragrant.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.getByTestId("style-status")).toHaveTextContent("1 of 2 rewrites kept"));
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
      saveLabel="Save recipe"
      loadRules={async () => rules}
    />
  );
  await waitFor(() => expect(screen.getAllByTestId("style-part")).toHaveLength(1));
  expect(screen.queryByText("No steps")).not.toBeInTheDocument();
});

test("a rewrite laid out in new parts is shown whole as the recipe will read, kept or put back at once, and saved with its layout", async () => {
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
      saveLabel="Save recipe"
      loadRules={async () => rules}
    />
  );
  const space = await screen.findByTestId("style-rebuilt");
  expect(space).toHaveAttribute("data-choice", "rewrite");
  expect(screen.getByTestId("style-status")).toHaveTextContent("1 of 1 rewrite kept");
  expect(screen.queryAllByTestId("style-part")).toHaveLength(0);
  expect(within(space).getByRole("heading", { name: "Stir-fry" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Show original" }));
  expect(screen.getByTestId("style-rebuilt-other")).toHaveTextContent("Heat 2 tablespoons oil in a wok over high heat.");

  await user.click(screen.getByRole("button", { name: "Edit step 1" }));
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

test("putting a laid-out rewrite back saves nothing", async () => {
  const laidOut: RestyledPart[] = [{ ...rewrite[0]!, name: "Stir-fry" }];
  const onSave = vi.fn(async (_parts: RestyledPart[] | null) => {});
  const user = userEvent.setup();
  render(
    <StyleSpace
      parts={parts}
      run={async () => ({ parts: laidOut, check: checkRestyle(styleOriginal(parts), laidOut) })}
      onSave={onSave}
      saveLabel="Save recipe"
      loadRules={async () => rules}
    />
  );
  // The rewrite loses "until fragrant", so it starts on the original, with the finding said once above it.
  const space = await screen.findByTestId("style-rebuilt");
  expect(space).toHaveAttribute("data-choice", "original");
  expect(screen.getByTestId("style-part-finding")).toHaveTextContent("“until fragrant” is in the original but not in the rewrite.");
  await user.click(screen.getByRole("button", { name: "Keep the rewrite" }));
  expect(space).toHaveAttribute("data-choice", "rewrite");
  await user.click(screen.getByRole("button", { name: "Use the original" }));
  await user.click(screen.getByTestId("style-save"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
});

test("while the run is out the pot waits over a reading line, and the answer lands step by step", async () => {
  let answer: (value: Awaited<ReturnType<Parameters<typeof StyleSpace>[0]["run"]>>) => void = () => {};
  const run = vi.fn((_ruleIds: string[]) => new Promise<Awaited<ReturnType<Parameters<typeof StyleSpace>[0]["run"]>>>((resolve) => (answer = resolve)));
  render(<StyleSpace parts={parts} run={run} onSave={async () => {}} saveLabel="Save recipe" loadRules={async () => rules} />);

  await waitFor(() => expect(screen.getByTestId("style-status")).toHaveTextContent("Rewriting in your house style…"));
  expect(screen.getByTestId("style-wait")).toBeInTheDocument();
  expect(screen.getByTestId("style-reading")).toBeInTheDocument();
  expect(screen.getByTestId("style-space")).not.toHaveClass("style-landed");

  answer({ parts: rewrite, check: checkRestyle(styleOriginal(parts), rewrite) });
  await waitFor(() => expect(screen.getByTestId("style-space")).toHaveClass("style-landed"));
  expect(screen.queryByTestId("style-wait")).not.toBeInTheDocument();
  expect(screen.queryByTestId("style-reading")).not.toBeInTheDocument();
  const [first, second] = screen.getAllByTestId("style-step");
  expect(first).toHaveClass("style-step-land");
  expect(first!.style.getPropertyValue("--i")).toBe("1");
  expect(second!.style.getPropertyValue("--i")).toBe("2");
});
