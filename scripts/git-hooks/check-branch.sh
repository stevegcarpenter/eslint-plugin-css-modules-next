#!/bin/sh

# Get the current branch name
branch=$(git symbolic-ref --short HEAD 2>/dev/null)

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "\033[0;31mERROR: Direct commits to the '$branch' branch are restricted.\033[0m"
  echo "\033[0;31m-------------------------------------------------------------------------------\033[0m"
  echo "\033[0;31mPlease create a feature branch and open a pull request instead.\033[0m"
  echo "\033[0;31mIf you need to bypass this check, add --no-verify to the commit command.\033[0m"
  echo "\033[0;31m-------------------------------------------------------------------------------\033[0m"
  exit 1
fi

exit 0
