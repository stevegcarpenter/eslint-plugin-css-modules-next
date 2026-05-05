import type { Rule } from 'eslint';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

import type { LocalsConvention } from '../types';
import { localsConventionSchema } from '../types';
import {
  extractClassNames,
  isClassUsed,
  resolveCssModulePath,
} from '../utils/css-parser';

/**
 * Reports when a CSS module file contains class definitions that are never
 * referenced in the importing TypeScript/JavaScript file.
 *
 * Example — given `styles.module.css` that defines `.container` and `.unused`:
 *
 *   import styles from './styles.module.css';
 *   <div className={styles.container} />   // ✅ used
 *   // .unused is never referenced           // ❌ reported
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow CSS classes in a CSS module file that are never used in the importing file',
      recommended: true,
    },
    messages: {
      unusedClass:
        'Class "{{className}}" in CSS module "{{moduleFile}}" is never used in this file.',
    },
    schema: localsConventionSchema,
  },

  create(context) {
    const options = (context.options[0] ?? {}) as {
      localsConvention?: LocalsConvention;
    };
    const localsConvention: LocalsConvention =
      options.localsConvention ?? 'asIs';

    // Map of local identifier → { absolutePath, importNode }
    const cssModuleImports = new Map<
      string,
      { absolutePath: string; importNode: Rule.Node }
    >();

    // Track all member expressions: identifier → Set of accessed property names
    const accessedClasses = new Map<string, Set<string>>();

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value as string;
        const resolvedCssPath = resolveCssModulePath(importPath);
        if (!resolvedCssPath) return;

        const currentFileDir = dirname(context.filename);
        const absoluteCssPath = resolve(currentFileDir, resolvedCssPath);

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            cssModuleImports.set(specifier.local.name, {
              absolutePath: absoluteCssPath,
              importNode: node as unknown as Rule.Node,
            });
            accessedClasses.set(specifier.local.name, new Set());
          }
        }
      },

      MemberExpression(node) {
        if (node.object.type !== 'Identifier') return;

        const objectName = node.object.name;
        if (!cssModuleImports.has(objectName)) return;

        let className: string | null = null;
        if (!node.computed && node.property.type === 'Identifier') {
          className = node.property.name;
        } else if (
          node.computed &&
          node.property.type === 'Literal' &&
          typeof node.property.value === 'string'
        ) {
          className = node.property.value;
        }
        if (className) {
          accessedClasses.get(objectName)?.add(className);
        }
      },

      'Program:exit'() {
        for (const [
          identifier,
          { absolutePath, importNode },
        ] of cssModuleImports) {
          if (!existsSync(absolutePath)) continue;

          const definedClasses = extractClassNames(absolutePath);
          if (!definedClasses) continue;
          const used = accessedClasses.get(identifier) ?? new Set<string>();

          for (const className of definedClasses) {
            if (!isClassUsed(className, used, localsConvention)) {
              context.report({
                node: importNode,
                messageId: 'unusedClass',
                data: {
                  className,
                  moduleFile: absolutePath,
                },
              });
            }
          }
        }
      },
    };
  },
};

export default rule;
