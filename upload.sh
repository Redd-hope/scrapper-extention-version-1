#!/bin/bash

# Fail on errors
set -e

# Set repo variables
REMOTE_URL="https://github.com/Redd-hope/scrapper-extention-version-1.git"
BRANCH="main"  # or use "master" if that's your default branch

# Step 1: Initialize git if not done
if [ ! -d .git ]; then
  git init
fi

# Step 2: Add remote if not already added
if ! git remote | grep -q origin; then
  git remote add origin $REMOTE_URL
else
  git remote set-url origin $REMOTE_URL
fi

# Step 3: Fetch and checkout the remote branch
git fetch origin $BRANCH
git checkout -B $BRANCH || git checkout -b $BRANCH

# Step 4: Pull remote and merge with conflict resolution (append mode)
git pull origin $BRANCH --strategy-option=theirs || {
  echo "Merge conflicts found. Resolving by appending local content..."
  conflicted_files=$(git diff --name-only --diff-filter=U)
  for file in $conflicted_files; do
    echo -e "\n\n# ===== Appending Local Changes =====\n" >> "$file"
    cat -- "$file.mine" >> "$file"
    rm -f "$file.mine" "$file.BASE" "$file.LOCAL" "$file.REMOTE"
    git add "$file"
  done
  git commit -m "Merged with remote by appending local changes"
}

# Step 5: Add and commit local changes
git add .
git commit -m "Uploaded local repo and merged with remote"

# Step 6: Push to GitHub
git push origin $BRANCH
