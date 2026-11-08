// Hands-free talk over the browser's own speech (decisions.md row 223): listen
// for one thing said, hand it over, speak the answer, listen again, until
// stopped or left quiet. A state machine over the slices of the Web Speech API
// it uses, so a test drives it with fakes; nothing here imports the app.

/** One recognition result as the browser reports it. */
export type RecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };

/** The slice of `SpeechRecognition` the loop uses. */
export type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

/** The slice of `SpeechSynthesisUtterance` the loop uses. */
export type UtteranceLike = { text: string; lang: string; voice: unknown; onend: (() => void) | null; onerror: (() => void) | null };

/** The slice of `speechSynthesis` the loop uses. */
export type SynthesisLike = {
  speak: (utterance: UtteranceLike) => void;
  cancel: () => void;
  getVoices?: () => readonly { lang: string }[];
};

/** Where the loop finds the browser. A missing `Recognition` means no voice at all; a missing synthesis means answers are not read aloud. */
export type VoiceEnv = {
  Recognition?: new () => RecognitionLike;
  synthesis?: SynthesisLike;
  Utterance?: new (text: string) => UtteranceLike;
  now: () => number;
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

/** off; listening for the cook; waiting on whoever was handed what they said; speaking an answer. */
export type VoiceState = "off" | "listening" | "waiting" | "speaking";

export type VoiceEvents = {
  onState: (state: VoiceState) => void;
  /** The words heard so far of what is being said, "" between turns. */
  onHeard: (text: string) => void;
  /** One thing said, whole. The loop waits until `say` or `resume` is called. */
  onUtterance: (text: string) => void;
  /** Why the loop stopped by itself, in words a cook can act on. */
  onMessage: (message: string) => void;
};

export type VoiceOptions = {
  lang?: string;
  /** How long the loop listens with nothing said before it stops. */
  quietMs?: number;
};

export type VoiceLoop = {
  supported: boolean;
  start: () => void;
  stop: () => void;
  /** Speak `text`, not listening meanwhile so it does not hear itself. Resolves when done, spoken or not. */
  say: (text: string) => Promise<void>;
  /** Listen again after a turn. */
  resume: () => void;
};

const FATAL: Record<string, string> = {
  "not-allowed": "Voice needs the microphone. Allow it for this site in the browser's settings.",
  "service-not-allowed": "This browser won't turn speech into text here. Type instead, or try Chrome or Safari.",
  "audio-capture": "No microphone was found.",
};

/** How many times in a row listening may fail before the loop gives up. */
const MAX_FAILURES = 4;

/**
 * Why listening kept failing, in words a cook can act on, with the browser's
 * own reason named so it can be looked up. Pure.
 */
export function failureMessage(error: string): string {
  if (error === "network")
    return "Voice couldn't reach the browser's speech service (the browser said: network). Chrome turns speech into text on Google's servers; Brave, Arc, Chromium and some other Chrome-based browsers can't, and a blocked connection to Google stops it too. Try Chrome or Safari.";
  if (error === "language-not-supported") return "This browser can't listen in Australian English (the browser said: language-not-supported).";
  return `Voice couldn't keep listening (the browser said: ${error || "nothing"}). Tap Voice to try again.`;
}

/**
 * Text as it should sound: no markdown marks, a range read "3 to 5", degrees
 * said rather than spelled. Pure.
 */
export function speakable(text: string): string {
  return text
    .replace(/[*_`#>]/g, "")
    .replace(/(\d)\s*[–-]\s*(\d)/g, "$1 to $2")
    .replace(/°C/g, " degrees")
    .replace(/\s+/g, " ")
    .trim();
}

/** The loop over `env`. Never throws. */
export function createVoiceLoop(env: VoiceEnv, events: VoiceEvents, options: VoiceOptions = {}): VoiceLoop {
  const lang = options.lang ?? "en-AU";
  const quietMs = options.quietMs ?? 5 * 60_000;
  const supported = env.Recognition !== undefined;

  let active = false;
  let state: VoiceState = "off";
  let recognition: RecognitionLike | null = null;
  let lastHeard = 0;
  let failures = 0;
  let retry: unknown = null;

  const setState = (next: VoiceState) => {
    if (next === state) return;
    state = next;
    events.onState(next);
  };

  const halt = () => {
    const current = recognition;
    recognition = null;
    if (current) {
      try {
        current.abort();
      } catch {
        // Already ended.
      }
    }
    if (retry !== null) env.clearTimeout(retry);
    retry = null;
  };

  const giveUp = (message: string) => {
    stop();
    events.onMessage(message);
  };

  const listen = () => {
    if (!active || !env.Recognition) return;
    if (env.now() - lastHeard > quietMs) return giveUp("Voice stopped after a quiet spell. Tap Voice to start again.");
    halt();
    const mine = new env.Recognition();
    recognition = mine;
    mine.lang = lang;
    // One thing said per recognition: more dependable on phones than one long session.
    mine.continuous = false;
    mine.interimResults = true;
    let said = "";
    let fatal: string | null = null;
    let failed: string | null = null;
    mine.onresult = (event) => {
      const results = Array.from(event.results);
      said = results
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(" ");
      events.onHeard(results.map((result) => result[0].transcript).join(" "));
    };
    mine.onerror = (event) => {
      fatal = FATAL[event.error] ?? null;
      failed = event.error === "no-speech" || event.error === "aborted" ? null : event.error;
    };
    mine.onend = () => {
      if (recognition !== mine) return;
      recognition = null;
      if (!active) return;
      if (fatal !== null) return giveUp(fatal);
      const words = said.trim();
      if (words !== "") {
        failures = 0;
        lastHeard = env.now();
        events.onHeard("");
        setState("waiting");
        events.onUtterance(words);
        return;
      }
      failures = failed !== null ? failures + 1 : 0;
      if (failed !== null && failures >= MAX_FAILURES) return giveUp(failureMessage(failed));
      // Nothing said before the browser stopped listening: listen again.
      retry = env.setTimeout(() => {
        retry = null;
        listen();
      }, 250);
    };
    setState("listening");
    try {
      mine.start();
    } catch {
      recognition = null;
      giveUp("Voice couldn't start listening.");
    }
  };

  const say = (text: string): Promise<void> => {
    halt();
    const spoken = speakable(text);
    if (!env.synthesis || !env.Utterance || spoken === "") return Promise.resolve();
    const synthesis = env.synthesis;
    const utterance = new env.Utterance(spoken);
    utterance.lang = lang;
    const voices = synthesis.getVoices?.() ?? [];
    utterance.voice = voices.find((voice) => voice.lang.replace("_", "-") === lang) ?? voices.find((voice) => voice.lang.startsWith("en")) ?? null;
    if (active) setState("speaking");
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        env.clearTimeout(guard);
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      // Some browsers never say they finished a long answer.
      const guard = env.setTimeout(finish, 6000 + spoken.split(" ").length * 500);
      try {
        synthesis.cancel();
        synthesis.speak(utterance);
      } catch {
        finish();
      }
    });
  };

  function stop() {
    active = false;
    halt();
    try {
      env.synthesis?.cancel();
    } catch {
      // Nothing was speaking.
    }
    events.onHeard("");
    setState("off");
  }

  return {
    supported,
    start() {
      if (active) return;
      if (!supported) return events.onMessage("This browser can't listen. Type instead, or try Chrome or Safari.");
      active = true;
      failures = 0;
      lastHeard = env.now();
      // Speaking first, from the tap itself, is what lets a phone speak later answers.
      void say("Listening.").then(listen);
    },
    stop,
    say,
    resume: listen,
  };
}
