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
const HOUR = `(?:hours|hour|hrs|hr|h)`;
// No bare "m": after a number it is as likely metres as minutes.
const MINUTE = `(?:minutes|minute|mins|min)`;
const SECOND = `(?:seconds|second|secs|sec|s)`;
const ANY_UNIT = `(?:${HOUR}|${MINUTE}|${SECOND})`;
const NOT_LETTER = `(?![A-Za-z])`;
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
