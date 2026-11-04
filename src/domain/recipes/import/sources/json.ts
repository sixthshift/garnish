export type Node = Record<string, unknown>;

export const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

/** The first of `names` present and not null. */
export function pick(node: Node, ...names: string[]): unknown {
  for (const name of names) {
    const value = node[name];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/** A finite number, or null. A Mealie 0 means "not set" for every number this import reads. Pure. */
export function number(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value !== 0 ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

export const nodes = (value: unknown): Node[] => (Array.isArray(value) ? value.filter(isNode) : []);
