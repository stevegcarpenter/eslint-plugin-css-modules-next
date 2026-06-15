import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

import { RuleTester } from 'eslint';
import { describe } from 'vitest';

import rule from '../../src/rules/no-unused-class';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures'
);
const fixtureFile = join(fixturesDir, 'Button.tsx');

// The rule reports CSS paths relative to context.cwd, which RuleTester leaves at
// process.cwd(); mirror that here so message assertions stay environment-stable.
const relFixture = (name: string) =>
  relative(process.cwd(), join(fixturesDir, name));

// RuleTester.run() creates its own describe/it blocks internally, so it must
// be called at the top level of a describe, not inside an it().
describe('no-unused-class', () => {
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
      { code: `import './global.css';` },
      {
        code: `import styles from './styles.css'; const el = styles.someClass;`,
      },
    ],
    invalid: [],
  });

  ruleTester.run('all CSS classes are used', rule, {
    valid: [
      // button.module.css defines .container, .button, .unused — all three referenced
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const a = styles.container;
          const b = styles.button;
          const c = styles.unused;
        `,
      },
      // namespace import (import * as styles) — same behaviour
      {
        filename: fixtureFile,
        code: `
          import * as styles from './button.module.css';
          const a = styles.container;
          const b = styles.button;
          const c = styles.unused;
        `,
      },
    ],
    invalid: [],
  });

  ruleTester.run('unused CSS class is reported', rule, {
    valid: [],
    invalid: [
      // button.module.css defines .container, .button, and .unused.
      // Only .container and .button are referenced — .unused should be flagged.
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const a = styles.container;
          const b = styles.button;
        `,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'unused',
              moduleFile: relFixture('button.module.css'),
              line: '11',
            },
          },
        ],
      },
      // same check via namespace import
      {
        filename: fixtureFile,
        code: `
          import * as styles from './button.module.css';
          const a = styles.container;
          const b = styles.button;
        `,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'unused',
              moduleFile: relFixture('button.module.css'),
              line: '11',
            },
          },
        ],
      },
    ],
  });

  // ── Nested classes ──────────────────────────────────────────────────────────
  // card.module.css uses compound selectors: .card .header, .card .body
  // The parser extracts every distinct class name from each selector, so
  // .header and .body are tracked even though they appear nested under .card.

  ruleTester.run('all nested classes (compound selector) are used', rule, {
    valid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './card.module.css';
          const a = styles.card;
          const b = styles.header;
          const c = styles.body;
        `,
      },
    ],
    invalid: [],
  });

  ruleTester.run('unused nested class (compound selector) is reported', rule, {
    valid: [],
    invalid: [
      // card.module.css defines .card, .header, .body via .card .header / .card .body rules.
      // Only .card and .header are referenced — .body should be flagged.
      {
        filename: fixtureFile,
        code: `
          import styles from './card.module.css';
          const a = styles.card;
          const b = styles.header;
        `,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'body',
              moduleFile: relFixture('card.module.css'),
              line: '11',
            },
          },
        ],
      },
    ],
  });

  // card.module.scss uses SCSS nesting: .card { .header { } .body { } }
  // postcss-scss preserves each nested block as its own Rule node, so
  // walkRules visits .header and .body independently.

  ruleTester.run('all nested classes (SCSS nesting) are used', rule, {
    valid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './card.module.scss';
          const a = styles.card;
          const b = styles.header;
          const c = styles.body;
        `,
      },
    ],
    invalid: [],
  });

  ruleTester.run('unused nested class (SCSS nesting) is reported', rule, {
    valid: [],
    invalid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './card.module.scss';
          const a = styles.card;
          const b = styles.header;
        `,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'body',
              moduleFile: relFixture('card.module.scss'),
              line: '10',
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

  ruleTester.run('no-unused-class (:global block)', rule, {
    valid: [
      {
        filename: globalBlockFile,
        code: `import styles from './global-block.module.css';
styles.localClass;`,
      },
      {
        filename: globalBlockNestedFile,
        code: `import styles from './global-block-nested.module.css';
styles.localClass; styles.wrapper;`,
      },
      {
        filename: globalParensFile,
        code: `import styles from './global-parens.module.css';
styles.localClass;`,
      },
    ],
    invalid: [],
  });

  // ── Bracket notation ────────────────────────────────────────────────────────

  ruleTester.run('bracket notation with string literal counts as usage', rule, {
    valid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles["my-button"];
          const b = styles["my-button--primary"];
          const c = styles.label;
          const d = styles.icon;
        `,
      },
    ],
    invalid: [],
  });

  // ── localsConvention: asIs (default) ────────────────────────────────────────

  ruleTester.run('asIs — kebab-case classes must be accessed as-is', rule, {
    valid: [
      {
        filename: fixtureFile,
        code: `
          import styles from './kebab.module.css';
          const a = styles["my-button"];
          const b = styles["my-button--primary"];
          const c = styles.label;
          const d = styles.icon;
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
          const b = styles.myButtonPrimary;
          const c = styles.label;
          const d = styles.icon;
        `,
        options: [{ localsConvention: 'asIs' }],
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'my-button',
              moduleFile: relFixture('kebab.module.css'),
              line: '1',
            },
          },
          {
            messageId: 'unusedClass',
            data: {
              className: 'my-button--primary',
              moduleFile: relFixture('kebab.module.css'),
              line: '6',
            },
          },
        ],
      },
    ],
  });

  // ── localsConvention: camelCase ─────────────────────────────────────────────

  ruleTester.run(
    'camelCase — camelCase access satisfies kebab-case definition',
    rule,
    {
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
          options: [{ localsConvention: 'camelCase' }],
        },
        {
          filename: fixtureFile,
          code: `
          import styles from './kebab.module.css';
          const a = styles["my-button"];
          const b = styles["my-button--primary"];
          const c = styles.label;
          const d = styles.icon;
        `,
          options: [{ localsConvention: 'camelCase' }],
        },
      ],
      invalid: [
        {
          filename: fixtureFile,
          code: `
          import styles from './kebab.module.css';
          const a = styles.myButton;
          const b = styles.label;
        `,
          options: [{ localsConvention: 'camelCase' }],
          errors: [
            {
              messageId: 'unusedClass',
              data: {
                className: 'my-button--primary',
                moduleFile: relFixture('kebab.module.css'),
                line: '6',
              },
            },
            {
              messageId: 'unusedClass',
              data: {
                className: 'icon',
                moduleFile: relFixture('kebab.module.css'),
                line: '15',
              },
            },
          ],
        },
      ],
    }
  );

  // ── localsConvention: camelCaseOnly ─────────────────────────────────────────

  ruleTester.run(
    'camelCaseOnly — only camelCase access satisfies kebab-case definition',
    rule,
    {
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
          const b = styles["my-button--primary"];
          const c = styles.label;
          const d = styles.icon;
        `,
          options: [{ localsConvention: 'camelCaseOnly' }],
          errors: [
            {
              messageId: 'unusedClass',
              data: {
                className: 'my-button',
                moduleFile: relFixture('kebab.module.css'),
                line: '1',
              },
            },
            {
              messageId: 'unusedClass',
              data: {
                className: 'my-button--primary',
                moduleFile: relFixture('kebab.module.css'),
                line: '6',
              },
            },
          ],
        },
      ],
    }
  );

  // ── Named import support ────────────────────────────────────────────────────

  ruleTester.run(
    'named imports — all classes imported by name are used',
    rule,
    {
      valid: [
        // All three classes in button.module.css imported by name
        {
          filename: fixtureFile,
          code: `import { container, button, unused } from './button.module.css';`,
        },
        // Mixed default + named — together they cover all classes
        {
          filename: fixtureFile,
          code: `
          import styles, { unused } from './button.module.css';
          const a = styles.container;
          const b = styles.button;
        `,
        },
      ],
      invalid: [],
    }
  );

  ruleTester.run('named imports — unimported class is reported', rule, {
    valid: [],
    invalid: [
      // Only container and button imported — unused should be flagged
      {
        filename: fixtureFile,
        code: `import { container, button } from './button.module.css';`,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'unused',
              moduleFile: relFixture('button.module.css'),
              line: '11',
            },
          },
        ],
      },
      // Only one class imported — two flagged
      {
        filename: fixtureFile,
        code: `import { container } from './button.module.css';`,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'button',
              moduleFile: relFixture('button.module.css'),
              line: '6',
            },
          },
          {
            messageId: 'unusedClass',
            data: {
              className: 'unused',
              moduleFile: relFixture('button.module.css'),
              line: '11',
            },
          },
        ],
      },
    ],
  });

  // ── Destructuring support ───────────────────────────────────────────────────

  ruleTester.run('destructuring — all classes destructured are used', rule, {
    valid: [
      // All three classes destructured from default import
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const { container, button, unused } = styles;
        `,
      },
      // Renamed binding: key is 'container', local is 'wrapper' — CSS class is used
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const { container: wrapper, button, unused } = styles;
        `,
      },
      // Mix of destructuring + member expression covers all classes
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const { container } = styles;
          const b = styles.button;
          const c = styles.unused;
        `,
      },
    ],
    invalid: [],
  });

  ruleTester.run('destructuring — undestructured class is reported', rule, {
    valid: [],
    invalid: [
      // container and button destructured — unused is not
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const { container, button } = styles;
        `,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'unused',
              moduleFile: relFixture('button.module.css'),
              line: '11',
            },
          },
        ],
      },
    ],
  });

  ruleTester.run('destructuring — non-CSS-module object is not tracked', rule, {
    valid: [],
    invalid: [
      // Destructuring 'obj' (not a CSS module) does not mark styles' classes as used
      {
        filename: fixtureFile,
        code: `
          import styles from './button.module.css';
          const obj = { container: 'x' };
          const { container } = obj;
        `,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'container',
              moduleFile: relFixture('button.module.css'),
              line: '1',
            },
          },
          {
            messageId: 'unusedClass',
            data: {
              className: 'button',
              moduleFile: relFixture('button.module.css'),
              line: '6',
            },
          },
          {
            messageId: 'unusedClass',
            data: {
              className: 'unused',
              moduleFile: relFixture('button.module.css'),
              line: '11',
            },
          },
        ],
      },
    ],
  });
});
