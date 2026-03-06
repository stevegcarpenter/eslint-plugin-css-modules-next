#!/bin/sh

# Install git hooks from the scripts/git-hooks directory to .git/hooks

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
GIT_HOOKS_SOURCE="$SCRIPT_DIR/git-hooks"

# Create .git/hooks directory if it doesn't exist
if [ ! -d "$HOOKS_DIR" ]; then
  echo "📁 Creating .git/hooks directory..."
  mkdir -p "$HOOKS_DIR"
fi

# Check if git-hooks directory exists
if [ ! -d "$GIT_HOOKS_SOURCE" ]; then
  echo "⚠️  Git hooks source directory not found: $GIT_HOOKS_SOURCE"
  exit 1
fi

# Copy all scripts from git-hooks directory
echo "📋 Installing git hooks from $GIT_HOOKS_SOURCE..."

for script in "$GIT_HOOKS_SOURCE"/*; do
  if [ -f "$script" ]; then
    script_name=$(basename "$script")
    script_dest="$HOOKS_DIR/$script_name"
    
    # Make the source script executable
    chmod +x "$script"
    
    # Copy the script
    cp "$script" "$script_dest"
    
    # Make the copied hook executable
    chmod +x "$script_dest"
    
    echo "✅ Installed: $script_name"
  fi
done

echo "✅ All git hooks installed successfully!"
