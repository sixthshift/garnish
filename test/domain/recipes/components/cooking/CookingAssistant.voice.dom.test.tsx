// Voice in the cooking assistant (decisions.md row 223), pressed: Voice starts it, what is said is asked as typed
// text is and the answer read aloud, Stop ends it, and a browser that cannot listen shows no Voice at all.
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CookingAssistant } from "../../../../../src/domain/recipes/components/cooking/CookingAssistant";
import type { CookSession } from "../../../../../src/domain/recipes/cooking";
import { renderInRouter } from "../../../../helpers/dom";

const AT = "2026-11-08T10:00:00.000Z";
const RECIPE = "00000000-0000-4000-8000-000000000001";
const session: CookSession = {
  id: "00000000-0000-4000-8000-000000000002",
  recipeId: RECIPE,
  servings: null,
  choices: null,
  adjustments: [],
  notes: [],
  messages: [],
  startedAt: AT,
  updatedAt: AT,
};
const answered: CookSession = {
  ...session,
  messages: [
    { id: "00000000-0000-4000-8000-000000000003", role: "cook", text: "what's next", offers: [], at: AT },
    { id: "00000000-0000-4000-8000-000000000004", role: "assistant", text: "Sear the beef, 3–5 minutes.", offers: [], at: AT },
  ],
};

const askCooking = vi.hoisted(() => vi.fn());
vi.mock("../../../../../src/api/rpc/cookingAssistant", () => ({ askCooking }));
vi.mock("../../../../../src/api/rpc/cooking", () => ({ adjustCooking: vi.fn(), unadjustCooking: vi.fn() }));
vi.mock("../../../../../src/api/rpc/push", () => ({ setTimerAlarm: vi.fn(), clearTimerAlarm: vi.fn() }));

type Listener = { onresult: ((event: unknown) => void) | null; onend: (() => void) | null; onerror: ((event: unknown) => void) | null };
const listening: Listener[] = [];
const spoken: { text: string; onend: (() => void) | null }[] = [];

function giveTheBrowserSpeech() {
  Object.assign(window, {
    webkitSpeechRecognition: class {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult = null;
      onend = null;
      onerror = null;
      start() {
        listening.push(this as unknown as Listener);
      }
      abort() {}
    },
    speechSynthesis: { speak: (utterance: { text: string; onend: (() => void) | null }) => spoken.push(utterance), cancel: () => {}, getVoices: () => [] },
    SpeechSynthesisUtterance: class {
      lang = "";
      voice = null;
      onend = null;
      onerror = null;
      constructor(public text: string) {}
    },
  });
}

afterEach(() => {
  for (const key of ["webkitSpeechRecognition", "speechSynthesis", "SpeechSynthesisUtterance"]) delete (window as unknown as Record<string, unknown>)[key];
  listening.length = 0;
  spoken.length = 0;
});

async function finishSpeaking() {
  await act(async () => {
    spoken.at(-1)!.onend?.();
    await Promise.resolve();
  });
}

test("Voice listens, asks what was said, reads the answer aloud and listens again; Stop ends it", async () => {
  giveTheBrowserSpeech();
  askCooking.mockResolvedValue(answered);
  const user = userEvent.setup();
  await renderInRouter(<CookingAssistant recipeId={RECIPE} session={session} servings={null} nowStepId={null} />);

  await user.click(screen.getByRole("button", { name: /Start voice/ }));
  expect(spoken.map((utterance) => utterance.text)).toEqual(["Listening."]);
  await finishSpeaking();
  expect(listening).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toBe("Listening…");

  await act(async () => {
    listening[0]!.onresult?.({ results: [{ isFinal: true, 0: { transcript: "what's next" } }] });
    listening[0]!.onend?.();
  });
  await waitFor(() => expect(spoken.at(-1)!.text).toBe("Sear the beef, 3 to 5 minutes."));
  expect(askCooking).toHaveBeenCalledWith({ data: expect.objectContaining({ recipeId: RECIPE, message: "what's next" }) });
  expect(screen.getByRole("status").textContent).toBe("Speaking…");

  await finishSpeaking();
  expect(listening).toHaveLength(2);

  await user.click(screen.getByRole("button", { name: "Stop voice" }));
  expect(screen.queryByTestId("voice-status")).toBeNull();
  expect(screen.getByRole("button", { name: /Start voice/ })).toBeTruthy();
});

test("“stop” said aloud ends voice without asking the assistant", async () => {
  giveTheBrowserSpeech();
  askCooking.mockClear();
  const user = userEvent.setup();
  await renderInRouter(<CookingAssistant recipeId={RECIPE} session={session} servings={null} nowStepId={null} />);
  await user.click(screen.getByRole("button", { name: /Start voice/ }));
  await finishSpeaking();
  await act(async () => {
    listening[0]!.onresult?.({ results: [{ isFinal: true, 0: { transcript: "stop listening" } }] });
    listening[0]!.onend?.();
  });
  expect(spoken.at(-1)!.text).toBe("Okay.");
  await finishSpeaking();
  expect(askCooking).not.toHaveBeenCalled();
  expect(screen.queryByTestId("voice-status")).toBeNull();
});

test("a browser that cannot listen shows no Voice", async () => {
  await renderInRouter(<CookingAssistant recipeId={RECIPE} session={session} servings={null} nowStepId={null} />);
  expect(screen.queryByRole("button", { name: /Start voice/ })).toBeNull();
});
