import type { Rule } from 'eslint';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

import type { LocalsConvention } from '../types';
import { localsConventionSchema } from '../types';
import {
  expandClassNames,
  extractClassNames,
  resolveCssModulePath,
} from '../utils/css-parser';

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
        'Class "{{className}}" is not defined in CSS module "{{moduleFile}}".',
    },
    schema: localsConventionSchema,
  },

  create(context) {
    const options = (context.options[0] ?? {}) as {
      localsConvention?: LocalsConvention;
    };
    const localsConvention: LocalsConvention =
      options.localsConvention ?? 'asIs';

    // Map of local import identifier → resolved CSS module file path
    const cssModuleImports = new Map<string, string>();

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
            cssModuleImports.set(specifier.local.name, absoluteCssPath);
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

        if (!existsSync(cssFilePath)) return;

        const rawClasses = extractClassNames(cssFilePath);
        if (!rawClasses) return;

        const definedClasses = expandClassNames(rawClasses, localsConvention);

        if (!definedClasses.has(accessedClass)) {
          context.report({
            node: node.property,
            messageId: 'undefinedClass',
            data: {
              className: accessedClass,
              moduleFile: cssFilePath,
            },
          });
        }
      },
    };
  },
};

export default rule;
