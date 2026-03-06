import type { Rule } from 'eslint';
import { resolveCssModulePath } from '../utils/css-parser';

/**
 * Disallows dynamic (non-literal) computed property access on CSS module
 * imports, since the class name cannot be statically verified.
 *
 *   import styles from './Button.module.css';
 *   styles.container          // ✅ ok — named access
 *   styles['container']       // ✅ ok — static string literal
 *   styles[name]              // ❌ dynamic variable
 *   styles[getClass()]        // ❌ dynamic call
 *   styles[`${x}Button`]      // ❌ dynamic template literal
 *
 * Instead, map dynamic values to specific class names:
 *
 *   switch (size) {
 *     case 'small': return styles.smallButton;
 *     case 'large': return styles.largeButton;
 *   }
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow dynamic (variable) bracket notation access on CSS module class names',
      recommended: true,
    },
    messages: {
      dynamicClassAccess:
        'Dynamic CSS class access via "{{objectName}}[...] is restricted.". ' +
        'Use named access ("{{objectName}}.className") or a switch statement ' +
        'to map values to specific class names.',
    },
    schema: [],
  },

  create(context) {
    const cssModuleImports = new Set<string>();

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value as string;
        if (!resolveCssModulePath(importPath)) return;

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            cssModuleImports.add(specifier.local.name);
          }
        }
      },

      MemberExpression(node) {
        if (!node.computed) return;
        if (node.object.type !== 'Identifier') return;

        const objectName = node.object.name;
        if (!cssModuleImports.has(objectName)) return;

        // String/number literals are static — styles['container'] is fine
        if (node.property.type === 'Literal') return;

        context.report({
          node,
          messageId: 'dynamicClassAccess',
          data: { objectName },
        });
      },
    };
  },
};

export default rule;
