import { recipeCookRoute, recipeJsonRoute } from "./export";
import { getImageRoute, uploadImageRoute } from "./images";
import { importFileRoute } from "./importFile";
import { getStepImageRoute, uploadStepImageRoute } from "./stepImages";
import { getTimelineImageRoute, uploadTimelineImageRoute } from "./timelineImages";

/** The recipes' server routes: a recipe's export, its images, a step's and a cook's, and reading an uploaded recipe file. Server only. */
export const recipesApiRoutes = [
  recipeJsonRoute,
  recipeCookRoute,
  getImageRoute,
  uploadImageRoute,
  getStepImageRoute,
  uploadStepImageRoute,
  getTimelineImageRoute,
  uploadTimelineImageRoute,
  importFileRoute,
] as const;
