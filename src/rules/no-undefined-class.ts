import { dirname, relative, resolve } from 'path';

import type { Rule } from 'eslint';

import type { LocalsConvention } from '../types';
import { localsConventionSchema } from '../types';
import { getCachedClassNames } from '../utils/css-cache';
import { expandClassNames, resolveCssModulePath } from '../utils/css-parser';
import {
  applyCacheSettings,
  resolveAbsolutePaths,
  resolveLocalsConvention,
} from '../utils/settings';

/**
 * Reports when a CSS class is accessed from a CSS module import but the class
 * is not defined in the corresponding CSS module file.
 *
 * Example — given `styles.module.css` that only defines `.container`:
 *
 *   import styles from './styles.module.css';
 *   <div className={styles.container} />   // ✅ ok
 *   <div className={styles.missing} />     // ❌ 'missing' not defined
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow usage of CSS classes not defined in the corresponding CSS module file',
      recommended: true,
    },
    messages: {
      undefinedClass:
        'Class "{{className}}" is not defined in CSS module {{moduleFile}}',
    },
    schema: localsConventionSchema,
  },

  create(context) {
    applyCacheSettings(context);

    const localsConvention: LocalsConvention = resolveLocalsConvention(context);
    const absolutePaths = resolveAbsolutePaths(context);

    // Format a CSS module path for display: absolute, or a `./`-prefixed
    // project-relative path (default).
    const formatModulePath = (absoluteCssPath: string): string =>
      absolutePaths
        ? absoluteCssPath
        : `./${relative(context.cwd, absoluteCssPath)}`;

    // Map of local import identifier → resolved CSS module file path
    const cssModuleImports = new Map<string, string>();

    // Per-file memo of the *expanded* class set (localsConvention is fixed for
    // this invocation), backed by the cross-file mtime-validated cache.
    const expandedByPath = new Map<string, Set<string> | null>();
    function getExpanded(absoluteCssPath: string): Set<string> | null {
      if (expandedByPath.has(absoluteCssPath)) {
        return expandedByPath.get(absoluteCssPath)!;
      }
      const raw = getCachedClassNames(absoluteCssPath);
      const expanded = raw ? expandClassNames(raw, localsConvention) : null;
      expandedByPath.set(absoluteCssPath, expanded);
      return expanded;
    }

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        if (typeof importPath !== 'string') return;
        const resolvedCssPath = resolveCssModulePath(importPath);
        if (!resolvedCssPath) return;

        const currentFileDir = dirname(context.filename);
        const absoluteCssPath = resolve(currentFileDir, resolvedCssPath);

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            cssModuleImports.set(specifier.local.name, absoluteCssPath);
          } else if (specifier.type === 'ImportSpecifier') {
            const definedClasses = getExpanded(absoluteCssPath);
            if (!definedClasses) continue;
            const importedName =
              specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : typeof specifier.imported.value === 'string'
                  ? specifier.imported.value
                  : null;
            if (!importedName) continue;
            if (!definedClasses.has(importedName)) {
              context.report({
                node: specifier.imported,
                messageId: 'undefinedClass',
                data: {
                  className: importedName,
                  moduleFile: formatModulePath(absoluteCssPath),
                },
              });
            }
          }
        }
      },

      MemberExpression(node) {
        if (node.object.type !== 'Identifier') return;

        const objectName = node.object.name;
        const cssFilePath = cssModuleImports.get(objectName);
        if (!cssFilePath) return;

        let accessedClass: string | null = null;
        if (!node.computed && node.property.type === 'Identifier') {
          accessedClass = node.property.name;
        } else if (
          node.computed &&
          node.property.type === 'Literal' &&
          typeof node.property.value === 'string'
        ) {
          accessedClass = node.property.value;
        }
        if (!accessedClass) return;

        const definedClasses = getExpanded(cssFilePath);
        if (!definedClasses) return;

        if (!definedClasses.has(accessedClass)) {
          context.report({
            node: node.property,
            messageId: 'undefinedClass',
            data: {
              className: accessedClass,
              moduleFile: formatModulePath(cssFilePath),
            },
          });
        }
      },
    };
  },
};

export default rule;
