// style: a module. This index is its whole surface; nothing outside the folder
// imports anything else in it (test/modules.test.ts).
//
// The house style guide — a list of short statements — and the check that a
// rewrite kept every fact.

export { checkRestyle } from "./restyleCheck";
export type { PartRestyleCheck, RestyleCheck, RestyledPart } from "./restyleCheck";
export { StyleRuleCreate, StyleRuleId, StyleRuleReorder, StyleRuleUpdate, styleRuleNote } from "./style";
export type { StyleRule } from "./style";
