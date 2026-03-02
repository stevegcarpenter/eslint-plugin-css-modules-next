#!/bin/sh

# Pre-commit hook to run prettier checking
# This script runs prettier to check for formatting errors before allowing a commit

echo "🎨 Running prettier check..."

# Run prettier to check for formatting errors
pnpm run pretty:check
PRETTIER_EXIT_CODE=$?

if [ $PRETTIER_EXIT_CODE -ne 0 ]; then
  echo "❌ Prettier found formatting issues. Please fix them and try again."
  echo "💡 Tip: Run 'pnpm run pretty:fix' to automatically fix formatting issues."
  exit $PRETTIER_EXIT_CODE
fi

exit 0
