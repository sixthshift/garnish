// Every duration named in a step's text, with its offset in that text and its
// length in seconds. Pure: no IO, importable by the client, run over the raw
// step text before it goes anywhere near markdown (src/domain/markdown.ts) so
// a bold "**20 minutes**" still gets a timer.
//
// Recognised shapes: "20 minutes", "20 min", "1 hour", "1½ hours",
// "1 hr 30 min" (one match, summed), "30 seconds", "10-12 minutes" and
// "10 to 12 minutes" (one match, both bounds kept — the chip that reads them
// offers the lower). Units accepted beyond the full words, only where a
// number in front of them is unambiguous: "mins", "min", "hrs", "hr", "h",
// "secs", "sec", "s" — not "m", which is as likely to be metres. Anything
// without one of these units right after a number is not a duration:
// "2 eggs", "step 3", "350 degrees", "350°C" and "gas mark 4" all fail to
// match anything.
//
// Matches are non-overlapping and returned in the order they appear.

export type Duration = {
  /** Offset of the match's first character in `text`. */
  start: number;
  /** Offset just past the match's last character. */
  end: number;
  /** The matched substring, verbatim — what a chip shows. */
  text: string;
  /** The duration in seconds; a range's lower bound. */
  seconds: number;
  /** A range's upper bound, present only for "10-12 minutes" / "10 to 12 minutes". */
  upperSeconds?: number;
};

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };

const NUMBER = String.raw`(?:\d+(?:[½¼¾])?|[½¼¾])`;
const HOUR = String.raw`(?:hours|hour|hrs|hr|h)`;
const MINUTE = String.raw`(?:minutes|minute|mins|min)`;
const SECOND = String.raw`(?:seconds|second|secs|sec|s)`;
const ANY_UNIT = `(?:${HOUR}|${MINUTE}|${SECOND})`;
const NOT_LETTER = String.raw`(?![A-Za-z])`;
const GAP = String.raw`[ \t]*`;

// Sticky ('y'): each regex is retried at an exact offset, never scans ahead on
// its own, so the caller controls exactly where a match may start.
const COMPOUND = new RegExp(`(${NUMBER})${GAP}(${HOUR})${NOT_LETTER}${GAP}(${NUMBER})${GAP}(${MINUTE})${NOT_LETTER}`, "iy");
const RANGE_DASH = new RegExp(`(${NUMBER})${GAP}[-–—]${GAP}(${NUMBER})${GAP}(${ANY_UNIT})${NOT_LETTER}`, "iy");
const RANGE_TO = new RegExp(`(${NUMBER})[ \t]+to[ \t]+(${NUMBER})${GAP}(${ANY_UNIT})${NOT_LETTER}`, "iy");
const SIMPLE = new RegExp(`(${NUMBER})${GAP}(${ANY_UNIT})${NOT_LETTER}`, "iy");

/** "1", "½" or "1½" to its numeric value. Pure. */
function amount(raw: string): number {
  const whole = /^\d+/.exec(raw);
  const fraction = /[½¼¾]$/.exec(raw);
  return (whole ? Number(whole[0]) : 0) + (fraction ? FRACTIONS[fraction[0]]! : 0);
}

/** The seconds one unit of `token` is worth, from its first letter alone — the three families never share one. */
function unitSeconds(token: string): number {
  const first = token[0]?.toLowerCase();
  if (first === "h") return 3600;
  if (first === "m") return 60;
  return 1;
}

function match(re: RegExp, text: string, at: number): RegExpExecArray | undefined {
  re.lastIndex = at;
  return re.exec(text) ?? undefined;
}

/** Every duration in `text`, offset and length in seconds, non-overlapping and in order. Pure. */
export function durationsIn(text: string): Duration[] {
  const results: Duration[] = [];
  let i = 0;

  while (i < text.length) {
    const compound = match(COMPOUND, text, i);
    if (compound) {
      const seconds = Math.round(amount(compound[1]!) * 3600 + amount(compound[3]!) * 60);
      results.push({ start: i, end: COMPOUND.lastIndex, text: compound[0], seconds });
      i = COMPOUND.lastIndex;
      continue;
    }

    const dash = match(RANGE_DASH, text, i);
    const to = dash ? undefined : match(RANGE_TO, text, i);
    const range = dash ?? to;
    if (range) {
      const re = dash ? RANGE_DASH : RANGE_TO;
      const unit = unitSeconds(range[3]!);
      const seconds = Math.round(amount(range[1]!) * unit);
      const upperSeconds = Math.round(amount(range[2]!) * unit);
      results.push({ start: i, end: re.lastIndex, text: range[0], seconds, upperSeconds });
      i = re.lastIndex;
      continue;
    }

    const simple = match(SIMPLE, text, i);
    if (simple) {
      const seconds = Math.round(amount(simple[1]!) * unitSeconds(simple[2]!));
      results.push({ start: i, end: SIMPLE.lastIndex, text: simple[0], seconds });
      i = SIMPLE.lastIndex;
      continue;
    }

    i += 1;
  }

  return results;
}

/**
 * Seconds left as a running timer prints them: "m:ss", the minutes not padded
 * and running past 59 for anything over an hour ("90:00"), the seconds always
 * two digits. Negative and fractional inputs clamp and round up, so a timer
 * reads "0:01" right up to the moment it is done. Pure.
 */
export function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
