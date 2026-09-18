# Design system patches

Commits for `sixthshift/design-system` that garnish's `ds-toasts` branch depends on (decisions row 109). They were authored in a throwaway clone with no GitHub access, so they travel here until they are on that repo's `main`.

Apply in a checkout of the design system, on top of `7d04832` (`feat(textarea): add an opt-in autosize prop`):

```
git am /path/to/garnish/patches/sixthshift-design-system/*.patch
```

Then push `main`; CI tags and publishes 0.6.0. Back in garnish, `bun install` pins it and `ds-toasts` can merge. Delete this folder once that has happened.
