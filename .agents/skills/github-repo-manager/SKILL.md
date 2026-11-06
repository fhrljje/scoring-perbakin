---
name: github-repo-manager
description: >-
  Automates initializing git repositories, creating remote GitHub repositories using the GitHub CLI (`gh`),
  and pushing code cleanly. Use when the user asks to create a GitHub repo, initialize git, or push the project to GitHub.
---

# GitHub Repository Manager Skill

This skill guides the agent in initializing a Git repository, verifying GitHub CLI (`gh`) authentication, creating a remote repository on GitHub, and pushing the project commits.

## Workflow & Steps

### 1. Verify Prerequisites
Run the following commands to ensure Git and GitHub CLI are installed and authenticated:
```bash
git --version
gh --version
gh auth status
```
*Note: `gh auth status` requires network access and should be run outside the sandbox if the sandbox restricts external network.*

### 2. Prepare Local Repository
1. Ensure a proper `.gitignore` file exists to avoid committing `.DS_Store`, secrets, or temporary files.
2. Initialize Git if `.git` does not exist:
   ```bash
   git init -b main
   ```
3. Configure user email and name locally if not globally set:
   ```bash
   git config user.name
   git config user.email
   ```
4. Stage all relevant files and create the initial commit:
   ```bash
   git add .
   git commit -m "feat: initial commit"
   ```

### 3. Create GitHub Repository and Push
Use the `gh repo create` command which handles creating the remote and pushing in a single streamlined operation:
```bash
# For Public Repository:
gh repo create <repo-name> --public --source=. --remote=origin --push

# For Private Repository:
gh repo create <repo-name> --private --source=. --remote=origin --push
```
*Flags used:*
* `--source=.`: Uses the current directory as the source.
* `--remote=origin`: Automatically adds the created GitHub repo as git remote `origin`.
* `--push`: Automatically pushes the current branch (`main`) to GitHub.

### 4. Verification
Verify that the remote is set and the branch is tracking properly:
```bash
git remote -v
git status
gh repo view --web || gh repo view
```

### 5. Executable Script Helper
A ready-to-run helper script is provided at [create-and-push.sh](./scripts/create-and-push.sh).
Usage:
```bash
bash .agents/skills/github-repo-manager/scripts/create-and-push.sh [repo-name] [public|private]
```

