import { readFileSync } from 'fs';
import { extname } from 'path';
import postcss from 'postcss';
import { parse as parseLess } from 'postcss-less';
import { parse as parseScss } from 'postcss-scss';

/**
 * Parses a CSS/SCSS/LESS string and returns all *local* class names.
 *
 * Returns `null` when the content cannot be parsed (e.g. corrupt content), so
 * callers can skip reporting rather than producing false positives.
 *
 * Key behaviours:
 * - `:global(.Foo)` selectors are stripped before matching — those names belong
 *   to the global scope and are not part of the CSS module's local interface.
 * - `:local(.foo)` is treated as a regular local class (it is one).
 * - Classes referenced inside pseudo-class functions such as `:not(.disabled)`,
 *   `:where(.active)`, `:is(.primary)`, `:has(.icon)` are extracted, because
 *   they are valid local class names in CSS Modules.
 * - `@keyframes` block names are never extracted (they are not class selectors).
 * - `:export { }` blocks contain no class selectors so nothing is extracted.
 */
export function parseClassNames(
  css: string,
  syntax: 'css' | 'scss' | 'less' = 'css'
): Set<string> | null {
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

  const classNames = new Set<string>();

  root.walkRules((rule) => {
    // Strip :global(...) pseudo-class blocks from the selector before matching.
    // Classes inside :global() belong to the external/global scope — they are
    // not part of this CSS module's local class interface.
    // Note: [^)]* handles selectors like :global(.foo .bar) and
    // :global(.foo, .bar) which contain no nested parentheses.
    const localSelector = rule.selector.replace(/:global\([^)]*\)/g, '');

    const matches = localSelector.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g);
    for (const match of matches) {
      classNames.add(match[1]);
    }
  });

  return classNames;
}

/**
 * Reads a CSS/SCSS/LESS module file from disk and returns all local class names.
 * Returns `null` when the file cannot be parsed.
 */
export function extractClassNames(filePath: string): Set<string> | null {
  const ext = extname(filePath).toLowerCase();
  const content = readFileSync(filePath, 'utf-8');

  let syntax: 'css' | 'scss' | 'less' = 'css';
  if (ext === '.less') syntax = 'less';
  else if (ext === '.scss' || ext === '.sass') syntax = 'scss';

  return parseClassNames(content, syntax);
}

/**
 * Resolves the CSS module file path that corresponds to a given import path.
 * Returns null if the import is not a CSS module.
 */
export function resolveCssModulePath(importPath: string): string | null {
  if (/\.module\.(css|scss|sass|less)$/.test(importPath)) {
    return importPath;
  }
  return null;
}
