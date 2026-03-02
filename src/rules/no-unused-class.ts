import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import type { Rule } from 'eslint';
import { extractClassNames, resolveCssModulePath } from '../utils/css-parser';

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
    schema: [],
  },

  create(context) {
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
          if (specifier.type === 'ImportDefaultSpecifier') {
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
        if (node.computed) return;
        if (node.property.type !== 'Identifier') return;

        const objectName = node.object.name;
        if (!cssModuleImports.has(objectName)) return;

        accessedClasses.get(objectName)?.add(node.property.name);
      },

      'Program:exit'() {
        for (const [
          identifier,
          { absolutePath, importNode },
        ] of cssModuleImports) {
          if (!existsSync(absolutePath)) continue;

          const definedClasses = extractClassNames(absolutePath);
          const used = accessedClasses.get(identifier) ?? new Set<string>();

          for (const className of definedClasses) {
            if (!used.has(className)) {
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
