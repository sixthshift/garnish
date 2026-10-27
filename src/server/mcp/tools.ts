// What an MCP client can do in garnish: one MCP server per request, holding only the tools its token's scopes allow.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import foods from "../../db/models/food/repo";
import plan from "../../db/models/plan/repo";
import recipes from "../../db/models/recipe/repo";
import shopping from "../../db/models/shopping/repo";
import tags from "../../db/models/tag/repo";
import units from "../../db/models/unit/repo";
import { isoDate, MEALS, planEntryInputSchema, weekMonday } from "../../domain/plan";
import { type RecipeSummary, scaleRecipe } from "../../domain/recipe";
import { mergeIntoList, recipeAdditions, shoppingItemInputSchema, shoppingItemLabel } from "../../domain/shopping";
import { VERSION } from "../../lib/version";
import { INSTRUCTIONS } from "./instructions";
import type { Caller } from "./oauth/server";
import type { Scope } from "./oauth/tokens";
import { createRecipeSchema, documentFromMcp, parseDocument, recipeForMcp, updateRecipeSchema, type Vocabulary } from "./recipeDocument";
import { backupBeforeDelete } from "./safety";

/** A tool's answer: JSON text, which every MCP client shows and every model reads. */
const ok = (value: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
/** A tool's refusal: a sentence the model can act on. */
const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: "text", text: message }] });

const vocabulary = (): Vocabulary => ({ units: units.list(), foods: foods.list(), tags: tags.list() });

/** A recipe by id or slug, whichever the model has. */
const findRecipe = (key: string) => recipes.getById(key) ?? recipes.get(key);

const summary = (row: RecipeSummary) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  tags: row.tags.map((tag) => tag.name),
  totalMinutes: row.totalTime,
  rating: row.rating,
  favourite: row.favourite,
  lastMade: row.lastMade,
});

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DESTROY = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

/** Errors a write can raise, as a sentence: zod's, the repository's, anything. */
const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * garnish's MCP server for one caller: the instructions, and the tools the
 * caller's scopes allow. Built per request: the endpoint is stateless, so
 * nothing outlives the request but the database.
 */
export function buildMcpServer(caller: Pick<Caller, "scopes">): McpServer {
  const server = new McpServer({ name: "garnish", version: VERSION }, { instructions: INSTRUCTIONS });
  const can = (scope: Scope) => caller.scopes.includes(scope);

  if (can("read")) {
    server.registerTool(
      "search_recipes",
      {
        title: "Search recipes",
        description: "Find recipes by name, tag or favourite. With nothing given, every recipe, newest first. Answers summaries; read one with get_recipe.",
        inputSchema: {
          query: z.string().optional().describe("Part of the recipe's name"),
          tags: z.array(z.string()).optional().describe("Tag names; a recipe needs any of them"),
          favourite: z.boolean().optional().describe("Only favourites"),
          sort: z.enum(["name", "updated", "lastMade", "rating", "created"]).optional(),
        },
        annotations: READ,
      },
      async ({ query, tags: tagNames, favourite, sort }) => {
        const known = tags.list();
        const slugs = (tagNames ?? []).flatMap((name) => known.filter((tag) => tag.name.toLowerCase() === name.trim().toLowerCase()).map((tag) => tag.slug));
        if (tagNames && tagNames.length > 0 && slugs.length === 0)
          return ok({ recipes: [], note: "No tag has that name. list_tags gives the household's tags." });
        const rows = recipes.query({ by: "filter", q: query, tags: slugs.length > 0 ? slugs : undefined, favourite, sort });
        return ok({ recipes: rows.map(summary) });
      }
    );

    server.registerTool(
      "get_recipe",
      {
        title: "Read a recipe",
        description:
          "One recipe whole: its parts, each ingredient as a line with the food it was matched to, its steps with the ingredient ids they use, and its notes.",
        inputSchema: { recipe: z.string().describe("The recipe's id or slug, from search_recipes") },
        annotations: READ,
      },
      async ({ recipe }) => {
        const doc = findRecipe(recipe);
        return doc ? ok(recipeForMcp(doc)) : fail(`No recipe has the id or slug "${recipe}". Use search_recipes to find it.`);
      }
    );

    server.registerTool(
      "list_foods",
      {
        title: "List foods",
        description:
          "The household's foods, with their plurals and other names. Check here before writing a recipe, so its lines use names garnish already knows.",
        inputSchema: { query: z.string().optional().describe("Part of the food's name; leave out for every food") },
        annotations: READ,
      },
      async ({ query }) => {
        const needle = query?.trim().toLowerCase() ?? "";
        const rows = foods
          .list()
          .filter((food) => needle === "" || [food.name, food.pluralName ?? "", ...food.aliases].some((name) => name.toLowerCase().includes(needle)));
        return ok({ foods: rows.map((food) => ({ name: food.name, plural: food.pluralName, otherNames: food.aliases })) });
      }
    );

    server.registerTool(
      "list_units",
      { title: "List units", description: "The household's units of measure, with abbreviations.", inputSchema: {}, annotations: READ },
      async () => ok({ units: units.list().map((unit) => ({ name: unit.name, plural: unit.pluralName, abbreviation: unit.abbreviation })) })
    );

    server.registerTool("list_tags", { title: "List tags", description: "The household's recipe tags.", inputSchema: {}, annotations: READ }, async () =>
      ok({ tags: tags.list().map((tag) => tag.name) })
    );

    server.registerTool(
      "get_shopping_list",
      { title: "Read the shopping list", description: "Every line on the shopping list, ticked or not.", inputSchema: {}, annotations: READ },
      async () => ok({ items: shopping.list().map((item) => ({ id: item.id, text: shoppingItemLabel(item), ticked: item.ticked })) })
    );

    server.registerTool(
      "get_meal_plan",
      {
        title: "Read the meal plan",
        description: "The seven days of a week, Monday first, with each day's entries.",
        inputSchema: { week: isoDate.optional().describe("Any date in the week, YYYY-MM-DD; this week when left out") },
        annotations: READ,
      },
      async ({ week }) => {
        const days = plan.week(weekMonday(week));
        return ok({
          days: days.map((day) => ({
            date: day.date,
            entries: day.entries.map((entry) => ({
              id: entry.id,
              recipe: entry.recipe?.name ?? null,
              recipeId: entry.recipe?.id ?? null,
              text: entry.text,
              meal: entry.meal,
              servings: entry.servings,
            })),
          })),
        });
      }
    );
  }

  if (can("write")) {
    server.registerTool(
      "create_recipe",
      {
        title: "Create a recipe",
        description:
          "Add a new recipe. Ingredients are lines as a person types them; garnish parses them against its foods and units. Answers the stored recipe and any foods it had to create.",
        inputSchema: createRecipeSchema.shape,
        annotations: WRITE,
      },
      async (input) => {
        try {
          const { doc, report } = documentFromMcp(input, vocabulary(), null);
          const stored = recipes.create(parseDocument(doc));
          return ok({ recipe: recipeForMcp(stored), ...report });
        } catch (error) {
          return fail(`The recipe was not saved: ${reason(error)}`);
        }
      }
    );

    server.registerTool(
      "update_recipe",
      {
        title: "Change a recipe",
        description:
          "Change an existing recipe. Only the fields sent change. Sending parts replaces every part, so read the recipe with get_recipe first and send the whole list back, keeping the ids of ingredients and steps that stay.",
        inputSchema: { id: z.string().describe("The recipe's id or slug"), ...updateRecipeSchema.shape },
        annotations: { ...WRITE, idempotentHint: true },
      },
      async ({ id, ...input }) => {
        const current = findRecipe(id);
        if (!current) return fail(`No recipe has the id or slug "${id}". Use search_recipes to find it.`);
        try {
          const { doc, report } = documentFromMcp(input, vocabulary(), current);
          const stored = recipes.ref(current.id).replace(parseDocument(doc));
          if (!stored) return fail("The recipe was deleted while it was being changed.");
          return ok({ recipe: recipeForMcp(stored), ...report });
        } catch (error) {
          return fail(`The recipe was not changed: ${reason(error)}`);
        }
      }
    );

    server.registerTool(
      "add_to_shopping_list",
      {
        title: "Add to the shopping list",
        description:
          "Add a recipe's ingredients at a number of servings (merged with lines already on the list, as the app's own button does), plain lines, or both.",
        inputSchema: {
          recipe: z.string().optional().describe("A recipe's id or slug"),
          servings: z.number().positive().optional().describe("Servings to shop for; the recipe's own when left out"),
          lines: z.array(z.string().trim().min(1)).optional().describe('Plain lines: "dishwasher tablets"'),
        },
        annotations: WRITE,
      },
      async ({ recipe, servings, lines }) => {
        let added = 0;
        if (recipe !== undefined) {
          const doc = findRecipe(recipe);
          if (!doc) return fail(`No recipe has the id or slug "${recipe}".`);
          const scaled = servings === undefined || doc.recipeServings <= 0 ? doc : scaleRecipe(doc, servings);
          const shopFor = servings ?? (doc.recipeServings > 0 ? doc.recipeServings : null);
          const merge = mergeIntoList(
            shopping.list(),
            recipeAdditions(scaled, (partName) => ({ recipeId: doc.id, recipeName: doc.name, partName, servings: shopFor }))
          );
          if (merge.additions.length > 0) shopping.addMany(merge.additions.map((item) => shoppingItemInputSchema.parse(item)));
          for (const line of merge.merges) shopping.mergeInto(line.id, line.quantity, line.sources);
          added += merge.additions.length + merge.merges.length;
        }
        if (lines && lines.length > 0) {
          shopping.addMany(lines.map((text) => shoppingItemInputSchema.parse({ text })));
          added += lines.length;
        }
        if (recipe === undefined && !lines?.length) return fail("Send a recipe, some lines, or both.");
        return ok({ added });
      }
    );

    server.registerTool(
      "tick_shopping_item",
      {
        title: "Tick a shopping line",
        description: "Tick a line off the shopping list, or untick it.",
        inputSchema: { id: z.string().describe("The line's id, from get_shopping_list"), ticked: z.boolean().default(true) },
        annotations: { ...WRITE, idempotentHint: true },
      },
      async ({ id, ticked }) => {
        const item = shopping.tick(id, ticked);
        return item ? ok({ id: item.id, text: shoppingItemLabel(item), ticked: item.ticked }) : fail(`No shopping line has the id "${id}".`);
      }
    );

    server.registerTool(
      "add_to_meal_plan",
      {
        title: "Add to the meal plan",
        description: "Put a recipe, or a line of text such as 'Leftovers', on a day of the meal plan.",
        inputSchema: {
          date: isoDate.describe("YYYY-MM-DD"),
          recipe: z.string().optional().describe("A recipe's id or slug"),
          text: z.string().optional().describe("The entry's text when there is no recipe"),
          meal: z.enum(MEALS).optional(),
          servings: z.number().positive().optional().describe("Servings to cook; the recipe's own when left out"),
        },
        annotations: WRITE,
      },
      async ({ date, recipe, text, meal, servings }) => {
        const doc = recipe === undefined ? null : findRecipe(recipe);
        if (recipe !== undefined && !doc) return fail(`No recipe has the id or slug "${recipe}".`);
        const parsed = planEntryInputSchema.safeParse({
          date,
          recipeId: doc?.id ?? null,
          text: doc ? doc.name : (text ?? ""),
          meal: meal ?? null,
          servings: servings ?? null,
        });
        if (!parsed.success) return fail("Send a recipe or some text for the entry.");
        const entry = plan.add(parsed.data);
        return ok({ id: entry.id, date: entry.date, recipe: entry.recipe?.name ?? null, text: entry.text, meal: entry.meal });
      }
    );
  }

  if (can("delete")) {
    server.registerTool(
      "delete_recipe",
      {
        title: "Delete a recipe",
        description:
          "Delete a recipe for good. Confirm with the person first. garnish takes a backup of the household just before, which Settings › Backup can restore.",
        inputSchema: { id: z.string().describe("The recipe's id or slug") },
        annotations: DESTROY,
      },
      async ({ id }) => {
        const doc = findRecipe(id);
        if (!doc) return fail(`No recipe has the id or slug "${id}".`);
        const backup = await backupBeforeDelete();
        recipes.remove(doc.id);
        return ok({ deleted: doc.name, backup: backup ?? "covered by the backup taken in the last ten minutes" });
      }
    );

    server.registerTool(
      "remove_shopping_item",
      {
        title: "Remove a shopping line",
        description: "Take a line off the shopping list.",
        inputSchema: { id: z.string().describe("The line's id, from get_shopping_list") },
        annotations: DESTROY,
      },
      async ({ id }) => (shopping.remove(id) ? ok({ removed: id }) : fail(`No shopping line has the id "${id}".`))
    );

    server.registerTool(
      "remove_from_meal_plan",
      {
        title: "Remove a meal plan entry",
        description: "Take an entry off the meal plan.",
        inputSchema: { id: z.string().describe("The entry's id, from get_meal_plan") },
        annotations: DESTROY,
      },
      async ({ id }) => (plan.remove(id) ? ok({ removed: id }) : fail(`No meal plan entry has the id "${id}".`))
    );
  }

  return server;
}
