// Hands-free talk (decisions.md row 223): the loop over a fake microphone and a fake voice.
import { describe, expect, test } from "vitest";
import { createVoiceLoop, type RecognitionLike, speakable, type UtteranceLike, type VoiceEnv, type VoiceState } from "../../src/lib/voice";

/** A world the loop can run in: a recognition the test speaks into, a synthesis the test finishes, a clock and timers it moves. */
function world(options: { recognition?: boolean; synthesis?: boolean } = {}) {
  const heard: RecognitionLike[] = [];
  const spoken: UtteranceLike[] = [];
  let clock = 0;
  let timers: { at: number; run: () => void; id: number }[] = [];
  let nextId = 1;

  class FakeRecognition implements RecognitionLike {
    lang = "";
    continuous = true;
    interimResults = false;
    onresult: RecognitionLike["onresult"] = null;
    onerror: RecognitionLike["onerror"] = null;
    onend: RecognitionLike["onend"] = null;
    started = false;
    aborted = false;
    start() {
      this.started = true;
      heard.push(this);
    }
    abort() {
      this.aborted = true;
      this.onend?.();
    }
  }
  class FakeUtterance implements UtteranceLike {
    lang = "";
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }

  const env: VoiceEnv = {
    Recognition: options.recognition === false ? undefined : FakeRecognition,
    synthesis:
      options.synthesis === false
        ? undefined
        : { speak: (utterance) => spoken.push(utterance), cancel: () => {}, getVoices: () => [{ lang: "en-US" }, { lang: "en-AU" }] },
    Utterance: FakeUtterance,
    now: () => clock,
    setTimeout: (run, ms) => {
      const id = nextId++;
      timers.push({ at: clock + ms, run, id });
      return id;
    },
    clearTimeout: (handle) => {
      timers = timers.filter((timer) => timer.id !== handle);
    },
  };

  const states: VoiceState[] = [];
  const utterances: string[] = [];
  const messages: string[] = [];
  const live: string[] = [];
  const loop = createVoiceLoop(env, {
    onState: (state) => states.push(state),
    onHeard: (text) => live.push(text),
    onUtterance: (text) => utterances.push(text),
    onMessage: (message) => messages.push(message),
  });

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    loop,
    states,
    utterances,
    messages,
    live,
    heard,
    spoken,
    /** The recognition listening now. */
    current: () => heard.at(-1)!,
    /** Finish the voice that is speaking. */
    async finishSpeaking() {
      spoken.at(-1)!.onend?.();
      await flush();
    },
    /** The cook says `words`, then the browser stops listening as it does after a pause. */
    say(words: string) {
      const recognition = heard.at(-1)!;
      recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: words.split(" ")[0]! } }] });
      recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: words } }] });
      recognition.onend?.();
    },
    /** The browser stops listening with `error`, or with nothing said. */
    end(error?: string) {
      const recognition = heard.at(-1)!;
      if (error) recognition.onerror?.({ error });
      recognition.onend?.();
    },
    advance(ms: number) {
      clock += ms;
      const due = timers.filter((timer) => timer.at <= clock);
      timers = timers.filter((timer) => timer.at > clock);
      for (const timer of due) timer.run();
    },
  };
}

describe("speakable", () => {
  test("reads a range, degrees and no markdown", () => {
    expect(speakable("Bake at **180°C**, 3–5 minutes")).toBe("Bake at 180 degrees, 3 to 5 minutes");
  });
});

describe("the voice loop", () => {
  test("a start speaks first, from the tap, then listens in Australian English, one thing said at a time", async () => {
    const w = world();
    w.loop.start();
    expect(w.spoken.map((utterance) => utterance.text)).toEqual(["Listening."]);
    expect(w.spoken[0]!.voice).toEqual({ lang: "en-AU" });
    expect(w.heard).toHaveLength(0);
    await w.finishSpeaking();
    expect(w.current()).toMatchObject({ started: true, lang: "en-AU", continuous: false, interimResults: true });
    expect(w.states.at(-1)).toBe("listening");
  });

  test("what is said is shown as it is heard, then handed over whole, and the loop waits", async () => {
    const w = world();
    w.loop.start();
    await w.finishSpeaking();
    w.say("how long left on the rice");
    expect(w.live).toContain("how");
    expect(w.utterances).toEqual(["how long left on the rice"]);
    expect(w.states.at(-1)).toBe("waiting");
    expect(w.heard).toHaveLength(1);
  });

  test("an answer is spoken without listening, then resume listens again", async () => {
    const w = world();
    w.loop.start();
    await w.finishSpeaking();
    w.say("what's next");
    const done = w.loop.say("Sear the beef until very browned, 3–5 minutes.");
    expect(w.states.at(-1)).toBe("speaking");
    expect(w.spoken.at(-1)!.text).toBe("Sear the beef until very browned, 3 to 5 minutes.");
    w.spoken.at(-1)!.onend?.();
    await done;
    w.loop.resume();
    expect(w.heard).toHaveLength(2);
    expect(w.states.at(-1)).toBe("listening");
  });

  test("a pause with nothing said listens again by itself", async () => {
    const w = world();
    w.loop.start();
    await w.finishSpeaking();
    w.end("no-speech");
    expect(w.heard).toHaveLength(1);
    w.advance(250);
    expect(w.heard).toHaveLength(2);
    expect(w.utterances).toEqual([]);
  });

  test("a quiet spell stops it, with a message", async () => {
    const w = world();
    w.loop.start();
    await w.finishSpeaking();
    w.advance(5 * 60_000 + 1);
    w.end();
    w.advance(250);
    expect(w.states.at(-1)).toBe("off");
    expect(w.messages[0]).toMatch(/quiet/);
  });

  test("a refused microphone stops it and says how to allow it", async () => {
    const w = world();
    w.loop.start();
    await w.finishSpeaking();
    w.end("not-allowed");
    expect(w.states.at(-1)).toBe("off");
    expect(w.messages[0]).toMatch(/microphone/);
  });

  test("repeated failures give up rather than spin", async () => {
    const w = world();
    w.loop.start();
    await w.finishSpeaking();
    for (let i = 0; i < 4; i += 1) {
      w.end("network");
      w.advance(250);
    }
    expect(w.states.at(-1)).toBe("off");
    expect(w.messages[0]).toMatch(/couldn't keep listening/);
  });

  test("stop stops listening and speaking, and a late end does not start it again", async () => {
    const w = world();
    w.loop.start();
    await w.finishSpeaking();
    const listening = w.current() as RecognitionLike & { aborted: boolean };
    w.loop.stop();
    expect(listening.aborted).toBe(true);
    w.advance(1000);
    w.loop.resume();
    expect(w.heard).toHaveLength(1);
    expect(w.states.at(-1)).toBe("off");
  });

  test("with no way to listen it is not supported and a start says so", () => {
    const w = world({ recognition: false });
    expect(w.loop.supported).toBe(false);
    w.loop.start();
    expect(w.messages[0]).toMatch(/can't listen/);
    expect(w.states).toEqual([]);
  });

  test("with no voice, answers resolve at once and listening goes on", async () => {
    const w = world({ synthesis: false });
    w.loop.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(w.heard).toHaveLength(1);
    await w.loop.say("Anything");
    expect(w.spoken).toEqual([]);
  });
});
