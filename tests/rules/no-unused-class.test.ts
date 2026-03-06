import { RuleTester } from 'eslint';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe } from 'vitest';
import rule from '../../src/rules/no-unused-class';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures'
);
const fixtureFile = join(fixturesDir, 'Button.tsx');

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
          const a = styles.container;
          const b = styles.button;
        `,
        errors: [
          {
            messageId: 'unusedClass',
            data: {
              className: 'unused',
              moduleFile: join(fixturesDir, 'button.module.css'),
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
              moduleFile: join(fixturesDir, 'card.module.css'),
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
      // card.module.scss defines .card, .header (nested), .body (nested).
      // Only .card and .header are referenced — .body should be flagged.
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
              moduleFile: join(fixturesDir, 'card.module.scss'),
            },
          },
        ],
      },
    ],
  });
});
