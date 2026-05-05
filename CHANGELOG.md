# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
