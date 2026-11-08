import { useCallback, useEffect, useRef, useState } from "react";
import { createVoiceLoop, type VoiceEnv, type VoiceLoop, type VoiceState } from "./voice";

/** The browser's speech, or nothing on the server and where it is missing. */
function browserVoice(): VoiceEnv | null {
  if (typeof window === "undefined") return null;
  const speech = window as unknown as {
    SpeechRecognition?: VoiceEnv["Recognition"];
    webkitSpeechRecognition?: VoiceEnv["Recognition"];
    speechSynthesis?: VoiceEnv["synthesis"];
    SpeechSynthesisUtterance?: VoiceEnv["Utterance"];
  };
  return {
    Recognition: speech.SpeechRecognition ?? speech.webkitSpeechRecognition,
    synthesis: speech.speechSynthesis,
    Utterance: speech.SpeechSynthesisUtterance,
    now: () => Date.now(),
    setTimeout: (run, ms) => window.setTimeout(run, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  };
}

export type Voice = {
  /** Whether this browser can listen; false until the page is hydrated. */
  supported: boolean;
  state: VoiceState;
  /** What is being heard, as it is heard. */
  heard: string;
  /** Why voice stopped by itself, until it is started again. */
  message: string | null;
  start: () => void;
  stop: () => void;
  say: (text: string) => Promise<void>;
  resume: () => void;
};

/**
 * Hands-free talk (`createVoiceLoop` over the browser). `onUtterance` is
 * handed each thing said; it answers with `say` then `resume`, or `stop`.
 * Stops when the page goes.
 */
export function useVoice(onUtterance: (text: string) => void, env: VoiceEnv | null = null): Voice {
  const [state, setState] = useState<VoiceState>("off");
  const [heard, setHeard] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loop, setLoop] = useState<VoiceLoop | null>(null);
  const latest = useRef(onUtterance);
  latest.current = onUtterance;

  useEffect(() => {
    const found = env ?? browserVoice();
    if (found === null) return;
    const created = createVoiceLoop(found, {
      onState: setState,
      onHeard: setHeard,
      onUtterance: (text) => latest.current(text),
      onMessage: setMessage,
    });
    setLoop(created);
    return () => created.stop();
  }, [env]);

  const start = useCallback(() => {
    setMessage(null);
    loop?.start();
  }, [loop]);
  const stop = useCallback(() => loop?.stop(), [loop]);
  const say = useCallback((text: string) => loop?.say(text) ?? Promise.resolve(), [loop]);
  const resume = useCallback(() => loop?.resume(), [loop]);

  return { supported: loop?.supported ?? false, state, heard, message, start, stop, say, resume };
}
