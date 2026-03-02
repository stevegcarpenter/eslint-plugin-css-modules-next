#!/bin/sh

# Pre-commit hook to run eslint linting
# This script runs eslint to check for linting errors before allowing a commit

echo "🔎 Running eslint..."

# Run eslint to check for linting errors
pnpm run lint
LINT_EXIT_CODE=$?

if [ $LINT_EXIT_CODE -ne 0 ]; then
  echo "❌ ESLint found errors. Please fix them and try again."
  echo "💡 Tip: Run 'pnpm run lint:fix' to automatically fix some issues."
  exit $LINT_EXIT_CODE
fi

exit 0
