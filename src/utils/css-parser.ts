import { readFileSync } from 'fs';
import { extname } from 'path';

import postcss from 'postcss';
import { parse as parseLess } from 'postcss-less';
import { parse as parseScss } from 'postcss-scss';

import type { ClassLocation, LocalsConvention } from '../types';

/**
 * Check whether a PostCSS rule node is nested inside a `:global { }` block.
 *
 * Walks up the parent chain looking for an ancestor rule whose selector
 * contains `:global` in block form (i.e. NOT the `:global(...)` function form).
 * Returns false when the rule itself re-enables local scope via `:local(...)`.
 */
function isInsideGlobalBlock(rule: postcss.Rule): boolean {
  if (/:local\(/.test(rule.selector)) return false;

  let parent = rule.parent;
  while (parent && parent.type !== 'root') {
    if (
      parent.type === 'rule' &&
      /:global(?!\()/.test((parent as postcss.Rule).selector)
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * Read the 1-based source position of a PostCSS node. Parsed nodes always carry
 * a `source.start`; the fallback to `{ line: 0, column: 0 }` only guards against
 * synthesized nodes, and callers treat `line === 0` as "position unknown".
 */
function nodeLocation(node: postcss.Node): ClassLocation {
  const start = node.source?.start;
  return start
    ? { line: start.line, column: start.column }
    : { line: 0, column: 0 };
}

/**
 * Parses a CSS/SCSS/LESS string and returns a map of every *local* class name to
 * the source position where it is first defined. The first definition wins, so
 * a class repeated across selectors points at its earliest occurrence.
 *
 * Returns `null` when the content cannot be parsed (e.g. corrupt content), so
 * callers can skip reporting rather than producing false positives.
 *
 * Scoping behaviors (`:global`, `:local`, `@value`, `:export`, pseudo-class
 * functions, `@keyframes`, attribute selectors) match {@link parseClassNames} —
 * see that function's documentation for the full set of rules.
 */
export function parseClassLocations(
  css: string,
  syntax: 'css' | 'scss' | 'less' = 'css'
): Map<string, ClassLocation> | null {
  let root: postcss.Root;
  try {
    if (syntax === 'less') {
      root = parseLess(css);
    } else if (syntax === 'scss') {
      root = parseScss(css);
    } else {
      root = postcss.parse(css);
    }
  } catch {
    return null;
  }

  const locations = new Map<string, ClassLocation>();
  const record = (name: string, node: postcss.Node): void => {
    if (!locations.has(name)) locations.set(name, nodeLocation(node));
  };

  // @value names are valid module exports accessible as styles.name in JS.
  root.walkAtRules('value', (atRule) => {
    const params = atRule.params.trim();
    const fromIdx = params.search(/\bfrom\b/);
    if (fromIdx !== -1) {
      // import form: "name1, name2 from '...'" — extract names before 'from'
      for (const segment of params.slice(0, fromIdx).split(',')) {
        const name = segment.trim();
        if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) record(name, atRule);
      }
    } else {
      // inline form: "name: value" — extract name before the colon
      const name = params.split(':')[0].trim();
      if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) record(name, atRule);
    }
  });

  root.walkRules((rule) => {
    // :export { prop: value } blocks expose named values as module exports.
    if (rule.selector === ':export') {
      rule.walkDecls((decl) => {
        record(decl.prop, decl);
      });
      return;
    }

    if (isInsideGlobalBlock(rule)) return;

    const localSelector = rule.selector
      .replace(/:global\([^)]*\)/g, '') // strip :global(...) function form
      .replace(/:global(?!\()[^,]*/g, '') // strip :global space form up to next comma
      .replace(/\[[^\]]*\]/g, ''); // strip attribute selectors [attr=...]

    const matches = localSelector.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g);
    for (const match of matches) {
      record(match[1], rule);
    }
  });

  return locations;
}

/**
 * Parses a CSS/SCSS/LESS string and returns all *local* class names.
 *
 * Returns `null` when the content cannot be parsed (e.g. corrupt content), so
 * callers can skip reporting rather than producing false positives.
 *
 * Key behaviors:
 * - `:global(.Foo)` selectors are stripped before matching — those names belong
 *   to the global scope and are not part of the CSS module's local interface.
 * - `:global { }` block syntax causes all nested rules to be skipped — classes
 *   inside a `:global` block belong to the global scope.
 * - `:local(.foo)` is treated as a regular local class (it is one).
 * - Classes referenced inside pseudo-class functions such as `:not(.disabled)`,
 *   `:where(.active)`, `:is(.primary)`, `:has(.icon)` are extracted, because
 *   they are valid local class names in CSS Modules.
 * - `@keyframes` block names are never extracted (they are not class selectors).
 * - `:export { }` blocks contain no class selectors so nothing is extracted.
 *
 * This is a thin projection of {@link parseClassLocations} that discards the
 * source positions.
 */
export function parseClassNames(
  css: string,
  syntax: 'css' | 'scss' | 'less' = 'css'
): Set<string> | null {
  const locations = parseClassLocations(css, syntax);
  return locations && new Set(locations.keys());
}

function detectSyntax(filePath: string): 'css' | 'scss' | 'less' {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.less') return 'less';
  if (ext === '.scss') return 'scss';
  return 'css';
}

/**
 * Reads a CSS/SCSS/LESS module file from disk and returns a map of each local
 * class name to its source position. Returns `null` when the file cannot be
 * parsed.
 */
export function extractClassLocations(
  filePath: string
): Map<string, ClassLocation> | null {
  const content = readFileSync(filePath, 'utf-8');
  return parseClassLocations(content, detectSyntax(filePath));
}

/**
 * Reads a CSS/SCSS/LESS module file from disk and returns all local class names.
 * Returns `null` when the file cannot be parsed.
 */
export function extractClassNames(filePath: string): Set<string> | null {
  const locations = extractClassLocations(filePath);
  return locations && new Set(locations.keys());
}

/**
 * Resolves the CSS module file path that corresponds to a given import path.
 * Returns null if the import is not a CSS module.
 */
export function resolveCssModulePath(importPath: string): string | null {
  if (/\.module\.(css|scss|less)$/.test(importPath)) {
    return importPath;
  }
  return null;
}

/**
 * Convert a kebab-case identifier to camelCase.
 *
 *   "my-button"          → "myButton"
 *   "my-button--primary" → "myButtonPrimary"
 *   "already"            → "already"   (no-op when there are no hyphens)
 */
export function kebabToCamelCase(str: string): string {
  return str.replace(/-+([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Expand a set of raw CSS class names according to the `localsConvention`.
 *
 * - `"asIs"`:          return unchanged
 * - `"camelCase"`:     add camelCase variants (originals kept)
 * - `"camelCaseOnly"`: replace originals with camelCase variants
 */
export function expandClassNames(
  classNames: Set<string>,
  localsConvention: LocalsConvention
): Set<string> {
  if (localsConvention === 'asIs') return classNames;

  const expanded = new Set<string>();
  for (const name of classNames) {
    const camel = kebabToCamelCase(name);
    if (localsConvention === 'camelCase') {
      expanded.add(name);
      expanded.add(camel);
    } else {
      // camelCaseOnly
      expanded.add(camel);
    }
  }
  return expanded;
}

/**
 * Check whether a raw CSS class name counts as "used" given the set of
 * property names accessed in JS and the active `localsConvention`.
 */
export function isClassUsed(
  className: string,
  usedClasses: Set<string>,
  localsConvention: LocalsConvention
): boolean {
  if (localsConvention === 'asIs') return usedClasses.has(className);

  const camel = kebabToCamelCase(className);
  if (localsConvention === 'camelCase') {
    return usedClasses.has(className) || usedClasses.has(camel);
  }
  // camelCaseOnly
  return usedClasses.has(camel);
}
