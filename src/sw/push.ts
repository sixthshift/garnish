// What a timer push carries, shared by the server that sends it and the
// worker that shows it. Its own file for the same reason as message.ts: both
// sides import it and neither should pull the other's code in.

/** The payload of one timer push: what the notification says and where a tap goes. */
export type TimerPush = {
  type: "garnish:timer";
  /** The page's id for the chip that started the timer. Tags the notification, so a restart replaces it. */
  timerId: string;
  /** The step's text, or the duration's. */
  label: string;
  /** The same-origin path the notification opens: the recipe page or its cook mode. */
  url: string;
};

/** The payload for `alarm`. Pure. */
export function timerPush(alarm: { timerId: string; label: string; url: string }): TimerPush {
  return { type: "garnish:timer", timerId: alarm.timerId, label: alarm.label, url: alarm.url };
}

/** Whether a decoded push payload is a timer's. Pure; `data` is untrusted. */
export function isTimerPush(data: unknown): data is TimerPush {
  if (typeof data !== "object" || data === null) return false;
  const push = data as Record<string, unknown>;
  return push.type === "garnish:timer" && typeof push.timerId === "string" && typeof push.label === "string" && typeof push.url === "string";
}

/** The title every timer notification carries. */
export const TIMER_TITLE = "Timer done";

/** The notification for `push`: the label as the body, the timer as the tag so a restart replaces rather than stacks. Pure. */
export function timerNotification(push: TimerPush): { title: string; options: { body: string; tag: string; icon: string; data: { url: string } } } {
  return {
    title: TIMER_TITLE,
    options: { body: push.label, tag: `timer:${push.timerId}`, icon: "/icons/icon-192.png", data: { url: push.url } },
  };
}
