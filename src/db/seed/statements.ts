/**
 * Seeding a guide of statements — the house style guide and the planner guide
 * are the same object with different sentences, so they are seeded by the same
 * function rather than by two copies of this argument.
 */

/**
 * A seeded statement. `was` lists the sentences it absorbed: on the next seed
 * the first of them still in the guide is reworded to this text in place,
 * keeping its switch and position, and any other is removed, since what it
 * said is now said here. A row the household has edited matches none of them
 * and is left alone.
 */
export type SeededStatement = { text: string; enabled?: boolean; position?: number; was?: readonly string[] };

/** A row a guide repository stores: everything this seed needs to know about one. */
export type Statement = { id: string; text: string };

/** The part of a guide repository this seed uses. Both `styleRuleRepository` and `plannerRepository.rules` fit. */
export type StatementRepository<T extends Statement> = {
  list(): T[];
  create(input: { text: string; enabled?: boolean; position?: number }): T;
  update(id: string, patch: { text?: string }): T | null;
  remove(id: string): boolean;
};

/** What one guide's seed did: the rows created, the rows reworded in place, and the rows retired into another. */
export type SeededGuide<T extends Statement> = { made: T[]; reworded: T[]; retired: T[] };

const fold = (text: string) => text.trim().toLowerCase();

/**
 * Insert any statement whose text is not already in the guide, comparing whole
 * sentences case-insensitively.
 *
 * A statement the household has edited no longer matches its seeded text and
 * so comes back as a new row on the next start; that is the trade the text
 * match makes. A statement that was deleted outright returns for the same
 * reason, at the foot of the guide, where it can be switched off. The one
 * exception is a sentence this project has itself reworded or folded into
 * another: a row still carrying an old sentence (listed in the statement's
 * `was`) is given the new one in place, keeping the household's switch and
 * order, and any further old sentence the same statement absorbed is removed,
 * since what it said is now said there. A rewording here is a fix rather than
 * a new statement.
 *
 * The caller owns the transaction: `seed()` runs both guides and the units in
 * one.
 */
export function seedStatements<T extends Statement>(repo: StatementRepository<T>, defaults: readonly SeededStatement[]): SeededGuide<T> {
  const existing = new Map(repo.list().map((row) => [fold(row.text), row]));
  const made: T[] = [];
  const reworded: T[] = [];
  const retired: T[] = [];

  for (const input of defaults) {
    const olds = (input.was ?? []).flatMap((text) => existing.get(fold(text)) ?? []);
    if (!existing.has(fold(input.text))) {
      const first = olds.shift();
      if (first === undefined) {
        made.push(repo.create({ text: input.text, enabled: input.enabled, position: input.position }));
      } else {
        const changed = repo.update(first.id, { text: input.text });
        if (changed !== null) reworded.push(changed);
      }
    }
    for (const old of olds) if (repo.remove(old.id)) retired.push(old);
  }

  return { made, reworded, retired };
}
