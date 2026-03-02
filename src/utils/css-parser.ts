import { readFileSync } from 'fs';
import { extname } from 'path';
import postcss from 'postcss';
import { parse as parseLess } from 'postcss-less';
import { parse as parseScss } from 'postcss-scss';

/**
 * Parses a CSS/SCSS/LESS module file and returns all class names defined in it.
 */
export function extractClassNames(filePath: string): Set<string> {
  const ext = extname(filePath).toLowerCase();
  const content = readFileSync(filePath, 'utf-8');

  let root: postcss.Root;

  if (ext === '.less') {
    root = parseLess(content);
  } else if (ext === '.scss' || ext === '.sass') {
    root = parseScss(content);
  } else {
    root = postcss.parse(content);
  }

  const classNames = new Set<string>();

  root.walkRules((rule) => {
    // Match all class selectors: .className, .camelCaseName, etc.
    const matches = rule.selector.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g);
    for (const match of matches) {
      classNames.add(match[1]);
    }
  });

  return classNames;
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
