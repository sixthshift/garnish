// A garnish backup with one row of every kind and every reference filled, so
// the format's tests (M40.1) can break one link at a time; and a restore
// check's answer for the confirm sheet (M40.5).
import { BACKUP_VERSION, type Backup, type BackupCounts } from "../../src/domain/backup";
import type { RestoreCheck } from "../../src/lib/backup";

const at = "2026-10-07T09:15:00.000Z";

export const IDS = {
  aisle: "a0000000-0000-4000-8000-000000000001",
  gram: "b0000000-0000-4000-8000-000000000001",
  kilogram: "b0000000-0000-4000-8000-000000000002",
  tag: "c0000000-0000-4000-8000-000000000001",
  butter: "d0000000-0000-4000-8000-000000000001",
  hollandaise: "d0000000-0000-4000-8000-000000000002",
  conversion: "e0000000-0000-4000-8000-000000000001",
  recipe: "f0000000-0000-4000-8000-000000000001",
  note: "f1000000-0000-4000-8000-000000000001",
  part: "f2000000-0000-4000-8000-000000000001",
  ingredient: "f3000000-0000-4000-8000-000000000001",
  step: "f4000000-0000-4000-8000-000000000001",
  event: "10000000-0000-4000-8000-000000000001",
  entry: "20000000-0000-4000-8000-000000000001",
  item: "30000000-0000-4000-8000-000000000001",
  source: "31000000-0000-4000-8000-000000000001",
  styleRule: "40000000-0000-4000-8000-000000000001",
  plannerRule: "50000000-0000-4000-8000-000000000001",
} as const;

/** A fresh copy each call, so a test may break it in place. */
export function sampleBackup(): Backup {
  return {
    garnish: { format: "garnish-backup", version: BACKUP_VERSION, createdAt: at, appVersion: "1.0.0" },
    aisles: [{ id: IDS.aisle, name: "Dairy", position: 0 }],
    units: [
      {
        id: IDS.gram,
        name: "gram",
        pluralName: "grams",
        abbreviation: "g",
        useAbbreviation: true,
        fraction: false,
        portion: false,
        standardQuantity: null,
        standardUnitId: null,
      },
      {
        id: IDS.kilogram,
        name: "kilogram",
        pluralName: "kilograms",
        abbreviation: "kg",
        useAbbreviation: true,
        fraction: false,
        portion: false,
        standardQuantity: 1000,
        standardUnitId: IDS.gram,
      },
    ],
    tags: [{ id: IDS.tag, name: "Sauces", slug: "sauces" }],
    foods: [
      {
        id: IDS.butter,
        name: "butter",
        pluralName: null,
        aliases: [],
        aisleId: IDS.aisle,
        recipeId: null,
        skipShopping: false,
        conversions: [{ id: IDS.conversion, unitId: IDS.kilogram, quantity: 1, toUnitId: IDS.gram, toQuantity: 1000 }],
      },
      { id: IDS.hollandaise, name: "hollandaise", pluralName: null, aliases: [], aisleId: null, recipeId: IDS.recipe, skipShopping: false, conversions: [] },
    ],
    recipes: [
      {
        id: IDS.recipe,
        slug: "hollandaise",
        name: "Hollandaise",
        description: "",
        image: `images/${IDS.recipe}.png`,
        rating: 4,
        favourite: true,
        recipeServings: 4,
        recipeYieldQuantity: 300,
        yieldUnitId: IDS.gram,
        recipeYield: "",
        prepTime: 5,
        performTime: 10,
        sourceUrl: null,
        tagIds: [IDS.tag],
        notes: [{ id: IDS.note, title: "", text: "Keep it warm, not hot." }],
        parts: [
          {
            id: IDS.part,
            name: "",
            ingredients: [
              { id: IDS.ingredient, quantity: 200, unitId: IDS.gram, foodId: IDS.butter, note: "melted", originalText: "200 g butter, melted", fixed: false },
            ],
            steps: [
              { id: IDS.step, title: "", text: "Whisk in the butter.", summary: "", ingredientIds: [IDS.ingredient], image: `images/steps/${IDS.step}.png` },
            ],
          },
        ],
        createdAt: at,
        updatedAt: at,
      },
    ],
    timeline: [
      {
        id: IDS.event,
        recipeId: IDS.recipe,
        occurredOn: "2026-10-01",
        message: "Split once.",
        image: `images/timeline/${IDS.event}.png`,
        servings: 2,
        createdAt: at,
      },
    ],
    plan: [{ id: IDS.entry, date: "2026-10-08", position: 0, meal: "dinner", recipeId: IDS.recipe, text: "", servings: 4 }],
    shopping: [
      {
        id: IDS.item,
        position: 0,
        quantity: 200,
        unitId: IDS.gram,
        foodId: IDS.butter,
        text: "",
        ticked: false,
        createdAt: at,
        updatedAt: at,
        sources: [{ id: IDS.source, recipeId: IDS.recipe, recipeName: "Hollandaise", partName: "", servings: 4, quantity: 200 }],
      },
    ],
    styleRules: [{ id: IDS.styleRule, position: 0, text: "Metric only.", enabled: true, createdAt: at, updatedAt: at }],
    plannerRules: [{ id: IDS.plannerRule, position: 0, text: "Weeknights under 45 minutes.", enabled: false, createdAt: at, updatedAt: at }],
  };
}

const counts = (over: Partial<BackupCounts> = {}): BackupCounts => ({
  recipes: 0,
  foods: 0,
  units: 0,
  aisles: 0,
  tags: 0,
  timeline: 0,
  plan: 0,
  shopping: 0,
  styleRules: 0,
  plannerRules: 0,
  images: 0,
  ...over,
});

/** What the restore check answers for a household of 142 recipes and a backup of 138, for the confirm sheet's tests. */
export const RESTORE_CHECK: RestoreCheck = {
  createdAt: "2026-10-07T09:15:00.000Z",
  current: counts({ recipes: 142, timeline: 38, plan: 7, units: 30, styleRules: 9, plannerRules: 7, images: 1 }),
  backup: counts({ recipes: 138, timeline: 35, shopping: 12, units: 30, styleRules: 9, plannerRules: 6, images: 40 }),
};
