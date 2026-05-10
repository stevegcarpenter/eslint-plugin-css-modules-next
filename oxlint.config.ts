import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript'],
  categories: {
    correctness: 'warn',
  },
  rules: {
    'no-unused-vars': 'error',
  },
  options: {
    typeAware: true,
  },
  ignorePatterns: ['node_modules/**', 'dist/**', 'scripts/**'],
});
