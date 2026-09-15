import { createServerFn } from "@tanstack/react-start";
import styleRules from "../../db/models/style/repo";
import { StyleRuleCreate, StyleRuleId, StyleRuleReorder, StyleRuleUpdate } from "../../domain/style";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

/** The whole guide in reading order. No query: fourteen-odd statements are always read together. */
export const listStyleRules = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(async () => styleRules.list());

/** A new statement, at the foot of the guide and on unless told otherwise. */
export const createStyleRule = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(StyleRuleCreate)
  .handler(async ({ data }) => styleRules.create(data));

/** Edit in place: the text, the switch, or both. */
export const updateStyleRule = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(StyleRuleUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(styleRules.update(id, patch), "style rule", id));

/** Deletes and returns the row, as the other reference deletes do. */
export const deleteStyleRule = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(StyleRuleId)
  .handler(async ({ data }) => {
    const rule = required(styleRules.get(data.id), "style rule", data.id);
    styleRules.remove(data.id);
    return rule;
  });

/** Set every statement's position from its index in `ids` (the full order); returns the guide in the new order. */
export const reorderStyleRules = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(StyleRuleReorder)
  .handler(async ({ data }) => styleRules.reorder(data.ids));
