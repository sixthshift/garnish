// A tiny seeded PRNG so the dev dataset is byte-identical on every run.
// Not cryptographic and not meant to be: the only requirement is that the same
// seed yields the same sequence on every machine, so two developers comparing
// screenshots are looking at the same fifteen recipes.
//
// mulberry32: 32-bit state, one multiply-xorshift round per draw.

export type Random = {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** One element. Throws on an empty list, which is always a bug in the vocabulary. */
  pick<T>(items: readonly T[]): T;
  /** `count` distinct elements, in the list's own order. Fewer when the list is shorter. */
  sample<T>(items: readonly T[], count: number): T[];
  /** A shuffled copy. */
  shuffle<T>(items: readonly T[]): T[];
};

/** Turn a string into a 32-bit seed, so seeds can be named rather than numbered. */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function random(seed: number | string): Random {
  let state = (typeof seed === "string" ? seedFrom(seed) : seed) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };

  return {
    next,
    int,
    chance: (p) => next() < p,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("random.pick: empty list");
      return items[int(0, items.length - 1)]!;
    },
    sample<T>(items: readonly T[], count: number): T[] {
      const wanted = Math.min(count, items.length);
      const chosen = new Set<number>();
      while (chosen.size < wanted) chosen.add(int(0, items.length - 1));
      return items.filter((_, i) => chosen.has(i));
    },
    shuffle,
  };
}
