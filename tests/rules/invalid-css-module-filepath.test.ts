import { RuleTester } from 'eslint';
import { describe } from 'vitest';
import rule from '../../src/rules/invalid-css-module-filepath';

// RuleTester.run() creates its own describe/it blocks internally, so it must
// be called at the top level of a describe, not inside an it().
describe('invalid-css-module-filepath', () => {
  const ruleTester = new RuleTester({
    languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
  });

  ruleTester.run('co-located and correctly named imports', rule, {
    valid: [
      // Matching base name, same directory — all supported extensions
      {
        filename: '/project/src/Button.tsx',
        code: `import styles from './Button.module.css';`,
      },
      {
        filename: '/project/src/Button.tsx',
        code: `import styles from './Button.module.scss';`,
      },
      {
        filename: '/project/src/Button.tsx',
        code: `import styles from './Button.module.less';`,
      },
      // Plain .css (not *.module.*) — rule only applies to CSS modules
      {
        filename: '/project/src/Button.tsx',
        code: `import './global.css';`,
      },
      // Non-CSS import — ignored entirely
      {
        filename: '/project/src/Button.tsx',
        code: `import React from 'react';`,
      },
    ],
    invalid: [],
  });

  ruleTester.run('CSS module base name does not match source file', rule, {
    valid: [],
    invalid: [
      // Button.tsx importing Card.module.css — should be Button.module.css
      {
        filename: '/project/src/Button.tsx',
        code: `import styles from './Card.module.css';`,
        errors: [
          {
            messageId: 'wrongBaseName',
            data: {
              actualFile: 'Card.module.css',
              expectedFile: 'Button.module.css',
              sourceFile: 'Button.tsx',
            },
          },
        ],
      },
      // Different extension but still wrong name
      {
        filename: '/project/src/Button.tsx',
        code: `import styles from './Card.module.scss';`,
        errors: [
          {
            messageId: 'wrongBaseName',
            data: {
              actualFile: 'Card.module.scss',
              expectedFile: 'Button.module.scss',
              sourceFile: 'Button.tsx',
            },
          },
        ],
      },
    ],
  });

  ruleTester.run('CSS module is not co-located with source file', rule, {
    valid: [],
    invalid: [
      // Parent directory
      {
        filename: '/project/src/components/Button.tsx',
        code: `import styles from '../styles/Button.module.css';`,
        errors: [
          {
            messageId: 'notColocated',
            data: {
              importPath: '../styles/Button.module.css',
              sourceFile: 'Button.tsx',
            },
          },
        ],
      },
      // Subdirectory
      {
        filename: '/project/src/Button.tsx',
        code: `import styles from './css/Button.module.css';`,
        errors: [
          {
            messageId: 'notColocated',
            data: {
              importPath: './css/Button.module.css',
              sourceFile: 'Button.tsx',
            },
          },
        ],
      },
    ],
  });
});
