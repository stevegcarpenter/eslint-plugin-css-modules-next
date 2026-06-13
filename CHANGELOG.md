# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-06-13

### Added
- Configurable parse cache via the plugin-wide `settings['css-modules-next'].cacheSize` setting. Parsed CSS module class sets are now cached across both rules and across files, keyed on file `mtime` so edits are picked up correctly in long-running editor/LSP sessions. The cache is a bounded LRU (default 15 entries); setting `cacheSize` to `0` disables caching entirely. Benchmarked at ~17–19× faster on a 150-class / 150-access component (#20).
- `@value` declarations are now recognised as module exports and validated as class names in both rules. Both the inline form (`@value foo: ...`) and the import form (`@value foo, bar from '...'`) are supported (#19).
- `:export { ... }` blocks are now recognised, exposing their declared property names as module exports (#19).
- `:local(...)` selectors now correctly re-enable local scope inside a `:global { }` block, so locally-scoped classes nested under a global block are no longer dropped (#19).

### Fixed
- Parser now aligns with PostCSS for the space form of `:global` (e.g. `:global .foo`) and for attribute selectors (e.g. `.foo[data-x]`), preventing class names from being mis-extracted from these selectors (#19).

## [1.3.1] - 2026-06-04

### Changed
- Lowered minimum Node.js requirement from `>=22.18` to `>=20.19.0` to match the ESLint 10 peer dependency floor. Internal dev-tool configs (oxlint, oxfmt) migrated from TypeScript config files to JSON, which removes the Node version constraint that those TS configs imposed (#17).

## [1.3.0] - 2026-05-16

### Added
- Named import support in both rules. `import { foo, bar } from './styles.module.css'` is now validated: `no-undefined-class` reports any imported name that does not exist in the CSS file, and `no-unused-class` counts each named import specifier as a class usage.
- Destructuring support in `no-unused-class`. Destructured keys in `const { foo, bar } = styles` are now tracked as class usages, so they no longer trigger false-positive "unused class" reports.

## [1.2.0] - 2026-05-11

### Fixed
- False positives for classes nested inside `:global { }` blocks (the block form of `:global`). Previously, classes such as `.foo` in `:global { .foo { } }` were incorrectly treated as local CSS module classes and could trigger `no-undefined-class` or `no-unused-class` violations. They are now correctly recognised as global-scoped and excluded from the local interface (#12).

## [1.1.1] - 2026-05-10

### Changed
- Migrated git hooks management from custom scripts to [lefthook](https://github.com/evilmartians/lefthook) (#9).
- Replaced ESLint + Prettier with [oxlint](https://oxc.rs/docs/guide/usage/linter) + [oxfmt](https://github.com/nicolo-ribaudo/oxfmt) for internal linting and formatting (#10). No impact on plugin behavior or consumer configuration.
- Bumped minimum Node.js requirement to 22.18 and updated CI to Node 26 (#10).

## [1.1.0] - 2026-05-04

### Added
- `localsConvention` option (`asIs` | `camelCase` | `camelCaseOnly`) for both `no-undefined-class` and `no-unused-class` rules. Aligns the plugin with bundler configurations (webpack css-loader, Vite, postcss-modules) that transform kebab-case class names to camelCase at build time.
- Bracket notation with string literals (e.g. `styles["my-button"]`) is now handled correctly in both rules — previously these references were silently skipped.
- New shared `LocalsConvention` type and `localsConventionSchema` in `src/types.ts`.
- `kebabToCamelCase()`, `expandClassNames()`, and `isClassUsed()` utilities in `src/utils/css-parser.ts`.

### Fixed
- False positive in `no-undefined-class`: `styles.myButton` no longer reported as undefined when `localsConvention: "camelCase"` is configured and `.my-button` exists in the CSS file.
- False positive in `no-unused-class`: `.my-button` no longer reported as unused when accessed via `styles.myButton` under `localsConvention: "camelCase"`.

## [1.0.2] - 2024-01-01

### Fixed
- Minor fixes and build tag corrections.

## [1.0.0] - 2024-01-01

### Added
- Initial release with `no-undefined-class` and `no-unused-class` rules.
- PostCSS-based CSS parser with support for `.css`, `.scss`, and `.less` files.
- `recommended` config preset.
