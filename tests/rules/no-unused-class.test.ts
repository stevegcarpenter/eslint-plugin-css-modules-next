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
    ],
  });
});
