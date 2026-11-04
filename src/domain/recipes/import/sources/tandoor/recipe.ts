import { text } from "../../scraped/text";
import { type Node, nodes, number, pick } from "../json";
import { tagNames } from "../mealie/recipe";
import { partsFromTandoor } from "./ingredient";
import type { TandoorRecipe } from "./types";

/** One Tandoor recipe node as this app's fields. Pure. */
export function tandoorRecipe(node: Node, known: ReadonlySet<string> = new Set()): TandoorRecipe {
  const parts = partsFromTandoor(nodes(pick(node, "steps")), known);
  const servings = number(pick(node, "servings")) ?? 0;
  return {
    source: "tandoor",
    name: text(pick(node, "name")).trim(),
    description: text(pick(node, "description")).trim(),
    image: null,
    servings: servings > 0 ? servings : 0,
    // Tandoor's `servings_text` is the noun beside the number ("pieces"),
    // which is this document's yield text. A bare "servings" says nothing the
    // count does not, so it is dropped.
    yieldText: yieldTextOf(text(pick(node, "servings_text", "servingsText"))),
    // Two fields for two: Tandoor's working time is time at the bench, its
    // waiting time is time it takes care of itself, which is what this
    // document's perform time holds (the document adds them for a
    // total either way).
    prepMinutes: number(pick(node, "working_time", "workingTime")),
    cookMinutes: number(pick(node, "waiting_time", "waitingTime")),
    tags: tagNames(pick(node, "keywords")),
    parts,
    notes: [],
    rating: null,
    sourceUrl: text(pick(node, "source_url", "sourceUrl")).trim(),
    sourceId: text(pick(node, "id")).trim(),
  };
}

/** Tandoor's `servings_text`, minus the words that only repeat the count. Pure. */
function yieldTextOf(raw: string): string {
  const trimmed = raw.trim();
  return /^servings?$/i.test(trimmed) ? "" : trimmed;
}
