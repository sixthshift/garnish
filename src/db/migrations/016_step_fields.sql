-- A step's label and its supporting line (stage 13, the house style).
--
-- Mealie's `RecipeStep` is `{ id, title, summary, text, ingredientReferences,
-- noteReferences }`; garnish kept only `text`, and the restyle work found both
-- of the others carrying weight the text could not.
--
-- `title` is the label: two to four words naming what the step accomplishes,
-- shown before the text. It earns its place where the step's opening verb is
-- setup -- "Heat", "Turn down", "Bring to the boil" -- and so does not say what
-- the step is for, which is why it is optional rather than required: a step
-- beginning "Shred the beef" needs no label reading "Shred". '' is no label.
--
-- `summary` is the supporting line: the sentence in a step that is not an
-- instruction. Why a time is a range ("well marbled meat will cook faster than
-- tough leaner parts"), what to do if it goes wrong ("if it gets too thick,
-- loosen with more cooking water"), what will happen that might worry you
-- ("the beef will soften slightly more during this step"). It exists because
-- the house style's chatter rule kept deleting these: written as a bracketed
-- aside at the end of a step they look like decoration, and a slot of their
-- own is what lets the rewrite move them instead of cutting them. '' is none.
--
-- Both default to '' rather than being nullable, because every other prose
-- column on a recipe row does ( `part.name`, `ingredient.note`,
-- `recipe.description` ), and "" already means "the household did not write
-- one" throughout the document.

ALTER TABLE step ADD COLUMN title TEXT NOT NULL DEFAULT '';

ALTER TABLE step ADD COLUMN summary TEXT NOT NULL DEFAULT '';
