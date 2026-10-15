-- Tag names in the house style (decisions.md row 170): the first letter
-- capital, the rest as given. Every way a tag is made now applies it
-- (src/domain/reference/tagName.ts); this brings the names made before it
-- into line, so "chinese" from one site sits as "Chinese" beside the
-- household's own. Slugs are lower case already and do not change, and
-- uniqueness is NOCASE, so no two names can collide by this.
--
-- SQLite's upper() folds ASCII only; a name starting with another letter is
-- left as it was, and the app's rule capitalises it the next time it is saved.

UPDATE tag SET name = upper(substr(name, 1, 1)) || substr(name, 2) WHERE substr(name, 1, 1) <> upper(substr(name, 1, 1));
