import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { RuleTester } from 'eslint';
import { describe } from 'vitest';

import rule from '../../src/rules/no-undefined-class';

// Resolve the fixtures directory so that relative CSS imports in test code
// (e.g. './button.module.css') resolve to real files on disk when the rule
// calls resolve(dirname(context.filename), importPath).
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures'
);
// Represents a hypothetical component file co-located with the fixtures.
const fixtureFile = join(fixturesDir, 'Button.tsx');

// RuleTester.run() creates its own describe/it blocks internally, so it must
// be called at the top level of a describe, not inside an it().
describe('no-undefined-class', () => {
  const ruleTester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  });

  ruleTester.run('non-module imports are ignored', rule, {
    valid: [
      // Plain .css import (not *.module.*) — rule should not flag anything
      {
        code: `import styles from './styles.css'; const el = styles.someClass;`,
      },
      // Side-effect import — nothing to check
      { code: `import './global.css';` },
    ],
    invalid: [],
  });

  ruleTester.run('class exists in CSS module', rule, {
    valid: [
      // .container and .button both exist in button.module.css
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const a = styles.container;
          const b = styles.button;
        `,
      },
      // namespace import (import * as styles) — same behaviour
      {
        filename: fixtureFile,
        code: `
          import * as styles from './button.module.css';
          const a = styles.container;
          const b = styles.button;
        `,
      },
    ],
    invalid: [],
  });

  ruleTester.run('class is missing from CSS module', rule, {
    valid: [],
    invalid: [
      // .ghost is not defined in button.module.css
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const el = styles.ghost;
        `,
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'button.module.css'),
            },
          },
        ],
      },
      // same check via namespace import
      {
        filename: fixtureFile,
        code: `
          import * as styles from './button.module.css';
          const el = styles.ghost;
        `,
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'button.module.css'),
            },
          },
        ],
      },
    ],
  });

  // ── :global block handling ──────────────────────────────────────────────────

  const globalBlockFile = join(fixturesDir, 'GlobalBlock.tsx');
  const globalBlockNestedFile = join(fixturesDir, 'GlobalBlockNested.tsx');
  const globalParensFile = join(fixturesDir, 'GlobalParens.tsx');

  ruleTester.run('no-undefined-class (:global block)', rule, {
    valid: [
      {
        filename: globalBlockFile,
        code: `import styles from './global-block.module.css'; styles.localClass;`,
      },
      {
        filename: globalBlockNestedFile,
        code: `import styles from './global-block-nested.module.css'; styles.localClass; styles.wrapper;`,
      },
      {
        filename: globalParensFile,
        code: `import styles from './global-parens.module.css'; styles.localClass;`,
      },
    ],
    invalid: [
      {
        filename: globalBlockFile,
        code: `import styles from './global-block.module.css'; styles.globalClass;`,
        errors: [{ messageId: 'undefinedClass' }],
      },
      {
        filename: globalBlockNestedFile,
        code: `import styles from './global-block-nested.module.css'; styles.nestedGlobalClass;`,
        errors: [{ messageId: 'undefinedClass' }],
      },
    ],
  });

  // ── Bracket notation ────────────────────────────────────────────────────────

  ruleTester.run('bracket notation with string literal', rule, {
    valid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles["my-button"];
        `,
      },
    ],
    invalid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles["ghost"];
        `,
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'kebab.module.css'),
            },
          },
        ],
      },
    ],
  });

  // ── localsConvention: asIs (default) ────────────────────────────────────────

  ruleTester.run(
    'asIs — kebab-case class accessed via bracket notation',
    rule,
    {
      valid: [
        {
          filename: fixtureFile,
          code: `
          import styles from './kebab.module.css';
          const a = styles["my-button"];
          const b = styles["my-button--primary"];
          const c = styles.label;
        `,
          options: [{ localsConvention: 'asIs' }],
        },
      ],
      invalid: [
        {
          filename: fixtureFile,
          code: `
          import styles from './kebab.module.css';
          const a = styles.myButton;
        `,
          options: [{ localsConvention: 'asIs' }],
          errors: [
            {
              messageId: 'undefinedClass',
              data: {
                className: 'myButton',
                moduleFile: join(fixturesDir, 'kebab.module.css'),
              },
            },
          ],
        },
      ],
    }
  );

  // ── localsConvention: camelCase ─────────────────────────────────────────────

  ruleTester.run('camelCase — both original and camelCase are valid', rule, {
    valid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles.myButton;
          const b = styles["my-button"];
          const c = styles.myButtonPrimary;
          const d = styles["my-button--primary"];
          const e = styles.label;
        `,
        options: [{ localsConvention: 'camelCase' }],
      },
    ],
    invalid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles.ghost;
        `,
        options: [{ localsConvention: 'camelCase' }],
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'kebab.module.css'),
            },
          },
        ],
      },
    ],
  });

  // ── shared settings['css-modules-next'].localsConvention ────────────────────

  ruleTester.run('localsConvention via shared settings', rule, {
    valid: [
      // Shared settings alone apply camelCase to the rule.
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles.myButton;
        `,
        settings: { 'css-modules-next': { localsConvention: 'camelCase' } },
      },
      // Per-rule option overrides shared settings: rule says camelCaseOnly, so
      // the camelCase alias is valid (and the kebab key would not be).
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles.myButton;
        `,
        settings: { 'css-modules-next': { localsConvention: 'asIs' } },
        options: [{ localsConvention: 'camelCaseOnly' }],
      },
    ],
    invalid: [
      // Shared settings camelCaseOnly: the original kebab key is no longer valid.
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles["my-button"];
        `,
        settings: {
          'css-modules-next': { localsConvention: 'camelCaseOnly' },
        },
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'my-button',
              moduleFile: join(fixturesDir, 'kebab.module.css'),
            },
          },
        ],
      },
      // Per-rule option (asIs) overrides shared settings (camelCase), so the
      // camelCase alias is rejected.
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles.myButton;
        `,
        settings: { 'css-modules-next': { localsConvention: 'camelCase' } },
        options: [{ localsConvention: 'asIs' }],
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'myButton',
              moduleFile: join(fixturesDir, 'kebab.module.css'),
            },
          },
        ],
      },
    ],
  });

  // ── localsConvention: camelCaseOnly ─────────────────────────────────────────

  ruleTester.run('camelCaseOnly — only camelCase keys are valid', rule, {
    valid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles.myButton;
          const b = styles.myButtonPrimary;
          const c = styles.label;
          const d = styles.icon;
        `,
        options: [{ localsConvention: 'camelCaseOnly' }],
      },
    ],
    invalid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles["my-button"];
        `,
        options: [{ localsConvention: 'camelCaseOnly' }],
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'my-button',
              moduleFile: join(fixturesDir, 'kebab.module.css'),
            },
          },
        ],
      },
    ],
  });

  // ── Named import support ────────────────────────────────────────────────────

  ruleTester.run('named imports — class exists in CSS module', rule, {
    valid: [
      // { container, button } both defined in button.module.css
      {
        filename: fixtureFile,
        code: `import { container, button } from './button.module.css';`,
      },
      // renamed local binding: imported name is still 'container'
      {
        filename: fixtureFile,
        code: `import { container as wrapper } from './button.module.css';`,
      },
      // mixed default + named — both valid
      {
        filename: fixtureFile,
        code: `
          import styles, { container } from './button.module.css';
          const a = styles.button;
        `,
      },
    ],
    invalid: [],
  });

  ruleTester.run('named imports — class missing from CSS module', rule, {
    valid: [],
    invalid: [
      // 'ghost' is not in button.module.css
      {
        filename: fixtureFile,
        code: `import { ghost } from './button.module.css';`,
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'button.module.css'),
            },
          },
        ],
      },
      // renamed binding: the imported name 'ghost' still doesn't exist
      {
        filename: fixtureFile,
        code: `import { ghost as g } from './button.module.css';`,
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'button.module.css'),
            },
          },
        ],
      },
      // one valid, one invalid in the same import
      {
        filename: fixtureFile,
        code: `import { container, ghost } from './button.module.css';`,
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'button.module.css'),
            },
          },
        ],
      },
      // mixed default + named — named specifier is invalid
      {
        filename: fixtureFile,
        code: `
          import styles, { ghost } from './button.module.css';
          const a = styles.container;
        `,
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'button.module.css'),
            },
          },
        ],
      },
    ],
  });

  ruleTester.run('named imports — localsConvention: camelCase', rule, {
    valid: [
      // 'my-button' exists in kebab.module.css; camelCase alias 'myButton' is also valid
      {
        filename: fixtureFile,
        code: `import { myButton } from './kebab.module.css';`,
        options: [{ localsConvention: 'camelCase' }],
      },
    ],
    invalid: [
      {
        filename: fixtureFile,
        code: `import { ghost } from './kebab.module.css';`,
        options: [{ localsConvention: 'camelCase' }],
        errors: [
          {
            messageId: 'undefinedClass',
            data: {
              className: 'ghost',
              moduleFile: join(fixturesDir, 'kebab.module.css'),
            },
          },
        ],
      },
    ],
  });
});
