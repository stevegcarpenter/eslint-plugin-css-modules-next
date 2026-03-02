import { RuleTester } from 'eslint';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
    ],
  });
});
