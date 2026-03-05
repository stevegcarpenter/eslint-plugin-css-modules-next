import { basename, dirname, extname, resolve } from 'path';
import type { Rule } from 'eslint';
import { resolveCssModulePath } from '../utils/css-parser';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const CSS_MODULE_SUFFIX = /\.module\.(css|scss|sass|less)$/;

/**
 * Enforces that a CSS module import is co-located with (same directory as) its
 * importing file and shares the same base name.
 *
 *   // In Button.tsx:
 *   import styles from './Button.module.css';    // ✅ ok
 *   import styles from './Card.module.css';      // ❌ wrong base name
 *   import styles from '../styles/Button.module.css'; // ❌ not co-located
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that CSS module files are co-located with and named after their importing file',
      recommended: true,
    },
    messages: {
      notColocated:
        'CSS module "{{importPath}}" must be in the same directory as "{{sourceFile}}" and have the same base name.',
      wrongBaseName:
        'CSS module "{{actualFile}}" should be named "{{expectedFile}}" to match "{{sourceFile}}".',
    },
    schema: [],
  },

  create(context) {
    const sourceFile = context.filename;
    if (!SOURCE_EXTENSIONS.has(extname(sourceFile))) return {};

    const sourceDir = dirname(sourceFile);
    const sourceBaseName = basename(sourceFile, extname(sourceFile));

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value as string;
        if (!resolveCssModulePath(importPath)) return;

        const absoluteCssPath = resolve(sourceDir, importPath);
        const cssDir = dirname(absoluteCssPath);
        const cssFileName = basename(absoluteCssPath);

        if (cssDir !== sourceDir) {
          context.report({
            node: node.source,
            messageId: 'notColocated',
            data: { importPath, sourceFile: basename(sourceFile) },
          });
          return;
        }

        const cssBaseName = cssFileName.replace(CSS_MODULE_SUFFIX, '');
        if (cssBaseName !== sourceBaseName) {
          const suffixMatch = cssFileName.match(CSS_MODULE_SUFFIX);
          const suffix = suffixMatch ? suffixMatch[0] : '.module.css';
          context.report({
            node: node.source,
            messageId: 'wrongBaseName',
            data: {
              actualFile: cssFileName,
              expectedFile: `${sourceBaseName}${suffix}`,
              sourceFile: basename(sourceFile),
            },
          });
        }
      },
    };
  },
};

export default rule;
