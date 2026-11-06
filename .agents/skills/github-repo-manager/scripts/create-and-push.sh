#!/usr/bin/env bash
set -e

# ==============================================================================
# Helper Script: Create GitHub Repo and Push
# Usage: ./create-and-push.sh [repo_name] [visibility: public|private]
# ==============================================================================

REPO_NAME="${1:-$(basename "$PWD")}"
VISIBILITY="${2:-public}"

echo "==> 1. Checking Git & GitHub CLI authentication..."
if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is not installed." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is not installed." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: GitHub CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

echo "==> 2. Initializing Git repository if needed..."
if [ ! -d ".git" ]; then
  git init -b main
else
  # Ensure we are on branch main
  CURRENT_BRANCH=$(git branch --show-current || echo "")
  if [ -z "$CURRENT_BRANCH" ]; then
    git checkout -b main || true
  fi
fi

echo "==> 3. Staging and committing files..."
git add .
if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "feat: initial release for $REPO_NAME"
fi

echo "==> 4. Checking if remote origin already exists..."
if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote 'origin' already exists: $(git remote get-url origin)"
  echo "Pushing directly to origin main..."
  git push -u origin main
else
  echo "==> 5. Creating GitHub repository: $REPO_NAME ($VISIBILITY)..."
  gh repo create "$REPO_NAME" "--$VISIBILITY" --source=. --remote=origin --push --description "Web Dashboard Live Scoring Perbakin (Air Pistol & Air Rifle)"
fi

echo "==> Success! Repository published to GitHub:"
gh repo view

