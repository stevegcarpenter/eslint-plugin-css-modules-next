import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import type { Rule } from 'eslint';
import { extractClassNames, resolveCssModulePath } from '../utils/css-parser';

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
    schema: [],
  },

  create(context) {
    // Map of local import identifier → resolved CSS module file path
    const cssModuleImports = new Map<string, string>();

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value as string;
        const resolvedCssPath = resolveCssModulePath(importPath);
        if (!resolvedCssPath) return;

        const currentFileDir = dirname(context.filename);
        const absoluteCssPath = resolve(currentFileDir, resolvedCssPath);

        // Only track the default import binding (e.g. `import styles from ...`)
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier') {
            cssModuleImports.set(specifier.local.name, absoluteCssPath);
          }
        }
      },

      MemberExpression(node) {
        if (node.object.type !== 'Identifier') return;
        if (node.computed) return; // skip styles['className'] — handled separately
        if (node.property.type !== 'Identifier') return;

        const objectName = node.object.name;
        const cssFilePath = cssModuleImports.get(objectName);
        if (!cssFilePath) return;

        if (!existsSync(cssFilePath)) return;

        const definedClasses = extractClassNames(cssFilePath);
        if (!definedClasses) return; // unparsable CSS — skip to avoid false positives

        const accessedClass = node.property.name;

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
