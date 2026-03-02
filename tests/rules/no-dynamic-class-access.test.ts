import { RuleTester } from 'eslint';
import { describe } from 'vitest';
import rule from '../../src/rules/no-dynamic-class-access';

// RuleTester.run() creates its own describe/it blocks internally, so it must
// be called at the top level of a describe, not inside an it().
describe('no-dynamic-class-access', () => {
  const ruleTester = new RuleTester({
    languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
  });

  ruleTester.run('static access patterns are allowed', rule, {
    valid: [
      // Dot notation — always fine
      {
        code: `import styles from './Button.module.css'; const el = styles.container;`,
      },
      // String literal bracket notation — statically known class name
      {
        code: `import styles from './Button.module.css'; const el = styles['container'];`,
      },
      // Numeric literal — unusual but static
      {
        code: `import styles from './Button.module.css'; const el = styles[0];`,
      },
      // Variable access on a non-CSS-module object — not tracked by this rule
      {
        code: `import obj from './utils'; const el = obj[name];`,
      },
    ],
    invalid: [],
  });

  ruleTester.run('dynamic variable access is flagged', rule, {
    valid: [],
    invalid: [
      // Identifier (variable)
      {
        code: `import styles from './Button.module.css'; const el = styles[name];`,
        errors: [
          {
            messageId: 'dynamicClassAccess',
            data: { objectName: 'styles' },
          },
        ],
      },
    ],
  });

  ruleTester.run('dynamic call expression access is flagged', rule, {
    valid: [],
    invalid: [
      {
        code: `import styles from './Button.module.css'; const el = styles[getClass()];`,
        errors: [
          {
            messageId: 'dynamicClassAccess',
            data: { objectName: 'styles' },
          },
        ],
      },
    ],
  });

  ruleTester.run('dynamic template literal access is flagged', rule, {
    valid: [],
    invalid: [
      {
        code: "import styles from './Button.module.css'; const el = styles[`${prefix}Button`];",
        errors: [
          {
            messageId: 'dynamicClassAccess',
            data: { objectName: 'styles' },
          },
        ],
      },
    ],
  });
});
