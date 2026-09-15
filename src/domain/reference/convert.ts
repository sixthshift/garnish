// A quantity through a food's own conversions and a unit's standard link, one hop of each.

import type { Food, Unit } from "./reference";

interface Edge {
  to: string;
  /** Multiply an amount in the edge's `from` unit by this to get the `to` unit. */
  factor: number;
}

/** The known unit-id edges for this pair: the food's conversions, plus `unit`'s
 * and `toUnit`'s own `standard_*` link, each added both ways. */
function buildGraph(food: Food, unit: Unit, toUnit: Unit): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>();

  function add(from: string, to: string, factor: number) {
    if (!Number.isFinite(factor) || factor <= 0) return; // a broken or zero standard link is not a path
    const edges = graph.get(from);
    if (edges === undefined) graph.set(from, [{ to, factor }]);
    else edges.push({ to, factor });
  }

  for (const conversion of food.conversions) {
    add(conversion.unitId, conversion.toUnitId, conversion.toQuantity / conversion.quantity);
    add(conversion.toUnitId, conversion.unitId, conversion.quantity / conversion.toQuantity);
  }

  for (const candidate of [unit, toUnit]) {
    if (candidate.standardUnitId !== null && candidate.standardQuantity !== null) {
      add(candidate.id, candidate.standardUnitId, candidate.standardQuantity);
      add(candidate.standardUnitId, candidate.id, 1 / candidate.standardQuantity);
    }
  }

  return graph;
}

/** The factor to multiply an amount in `from` by to land in `to`, or null with no path. Breadth-first, so a direct or one-hop link wins over a longer one when both exist. */
function pathFactor(graph: Map<string, Edge[]>, from: string, to: string): number | null {
  const queue: Array<{ node: string; factor: number }> = [{ node: from, factor: 1 }];
  const seen = new Set([from]);

  while (queue.length > 0) {
    const { node, factor } = queue.shift()!;
    if (node === to) return factor;
    for (const edge of graph.get(node) ?? []) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push({ node: edge.to, factor: factor * edge.factor });
    }
  }
  return null;
}

/**
 * `quantity` of `unit` expressed in `toUnit`, for `food`: the food's own
 * conversions first (direct or reverse), then unit-to-unit `standard_*`
 * links, chaining one hop of each so e.g. a food conversion to grams and a
 * unit's own gram-to-kilogram link compose. Null when no path connects them.
 */
export function convert(quantity: number, unit: Unit, food: Food, toUnit: Unit): number | null {
  const factor = pathFactor(buildGraph(food, unit, toUnit), unit.id, toUnit.id);
  return factor === null ? null : quantity * factor;
}
