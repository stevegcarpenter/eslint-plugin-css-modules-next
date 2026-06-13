import { dirname, resolve } from 'path';

import type { JSSyntaxElement, Rule } from 'eslint';

import type { LocalsConvention } from '../types';
import { localsConventionSchema } from '../types';
import { getCachedClassNames } from '../utils/css-cache';
import { isClassUsed, resolveCssModulePath } from '../utils/css-parser';
import { applyCacheSettings } from '../utils/settings';

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
    applyCacheSettings(context);

    const options = (context.options[0] ?? {}) as {
      localsConvention?: LocalsConvention;
    };
    const localsConvention: LocalsConvention =
      options.localsConvention ?? 'asIs';

    // Map CSS module path → { importNode, usedClasses }
    // Consolidates usages from member expressions, named imports, and destructuring.
    const cssModulesByPath = new Map<
      string,
      { importNode: JSSyntaxElement; usedClasses: Set<string> }
    >();

    // Map import identifier (default/namespace) → CSS module absolute path
    const identifierToCssPath = new Map<string, string>();

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        if (typeof importPath !== 'string') return;
        const resolvedCssPath = resolveCssModulePath(importPath);
        if (!resolvedCssPath) return;

        const currentFileDir = dirname(context.filename);
        const absoluteCssPath = resolve(currentFileDir, resolvedCssPath);

        if (!cssModulesByPath.has(absoluteCssPath)) {
          cssModulesByPath.set(absoluteCssPath, {
            importNode: node,
            usedClasses: new Set(),
          });
        }
        const entry = cssModulesByPath.get(absoluteCssPath)!;

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            identifierToCssPath.set(specifier.local.name, absoluteCssPath);
          } else if (specifier.type === 'ImportSpecifier') {
            const importedName =
              specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : typeof specifier.imported.value === 'string'
                  ? specifier.imported.value
                  : null;
            if (!importedName) continue;
            entry.usedClasses.add(importedName);
          }
        }
      },

      MemberExpression(node) {
        if (node.object.type !== 'Identifier') return;

        const cssPath = identifierToCssPath.get(node.object.name);
        if (!cssPath) return;

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
          cssModulesByPath.get(cssPath)?.usedClasses.add(className);
        }
      },

      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern') return;
        if (!node.init || node.init.type !== 'Identifier') return;

        const cssPath = identifierToCssPath.get(node.init.name);
        if (!cssPath) return;

        const entry = cssModulesByPath.get(cssPath);
        if (!entry) return;

        for (const prop of node.id.properties) {
          if (prop.type !== 'Property') continue;
          if (prop.key.type === 'Identifier') {
            entry.usedClasses.add(prop.key.name);
          } else if (
            prop.key.type === 'Literal' &&
            typeof prop.key.value === 'string'
          ) {
            entry.usedClasses.add(prop.key.value);
          }
        }
      },

      'Program:exit'() {
        for (const [
          absolutePath,
          { importNode, usedClasses },
        ] of cssModulesByPath) {
          const definedClasses = getCachedClassNames(absolutePath);
          if (!definedClasses) continue;

          for (const className of definedClasses) {
            if (!isClassUsed(className, usedClasses, localsConvention)) {
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
