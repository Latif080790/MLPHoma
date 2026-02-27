# Pre-commit Hooks & CI/CD Setup Guide

This guide explains how to set up and use the WCAG compliance enforcement tools in MLPHoma.

## Overview

MLPHoma uses a multi-layer approach to enforce WCAG 2.1 AA compliance:

1. **Pre-commit hooks** (Husky + lint-staged) - Catch violations before commits
2. **CI/CD pipeline** (GitHub Actions) - Block PRs/merges with violations
3. **ESLint rules** - Define and enforce WCAG typography standards

---

## Setup Instructions

### 1. Install Dependencies

```bash
# Install all dependencies including husky and lint-staged
npm install

# The 'prepare' script will automatically run 'husky install'
# If not, run manually:
npx husky install
```

### 2. Verify Pre-commit Hook

```bash
# Check that the hook file exists
ls -la .husky/pre-commit

# The hook should be executable (Unix/Mac)
chmod +x .husky/pre-commit  # If needed on Unix/Mac

# On Windows, Git will handle execution automatically
```

### 3. Test Pre-commit Hook

Create a test violation to verify the hook works:

```bash
# Create a test file with WCAG violation
echo 'const test = "text-[10px]";' > test-wcag.ts

# Try to commit (should FAIL)
git add test-wcag.ts
git commit -m "test: wcag hook"

# Expected output:
# ❌ ESLint error: WCAG 2.1 AA violation: text-[10px] is too small
# ✗ ESLint found violations. Commit blocked.

# Fix the violation
echo 'const test = "text-xs";' > test-wcag.ts

# Try again (should SUCCEED)
git add test-wcag.ts
git commit -m "test: wcag hook"

# Clean up
git reset HEAD~1
rm test-wcag.ts
```

---

## How It Works

### Pre-commit Hook Flow

```
1. Developer runs: git commit -m "message"
   ↓
2. Husky intercepts commit
   ↓
3. lint-staged runs ESLint on staged .ts/.tsx files
   ↓
4a. If violations found → auto-fix if possible
4b. If unfixable → block commit with error message
   ↓
5a. No violations → commit proceeds ✅
5b. Violations remain → commit blocked ❌
```

### What Gets Checked

**Pre-commit** (fast, only staged files):
```bash
# Runs on: git commit
# Scans: Only .ts/.tsx files you've staged (git add)
# Command: eslint --fix --max-warnings 0
# Time: ~1-5 seconds (depending on number of files)
```

**CI/CD** (comprehensive, entire codebase):
```bash
# Runs on: git push, Pull Requests
# Scans: Entire src/ directory
# Commands:
#   - npm run lint (ESLint on all files)
#   - grep check for text-[9/10/11px] patterns
# Time: ~30-60 seconds
```

---

## Configuration Files

### 1. Package.json

```json
{
  "scripts": {
    "prepare": "husky || true"  // Auto-setup on npm install
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings 0",  // Fix and validate
      "git add"                          // Re-stage fixed files
    ]
  },
  "devDependencies": {
    "husky": "^9.0.11",
    "lint-staged": "^15.2.2"
  }
}
```

### 2. .husky/pre-commit

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

### 3. .github/workflows/eslint.yml

```yaml
name: ESLint WCAG Compliance Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  eslint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: # Check for WCAG violations with grep
```

---

## Usage Examples

### Scenario 1: Normal Development

```bash
# 1. Make changes to component
vim src/components/MyComponent.tsx

# 2. Add changes
git add src/components/MyComponent.tsx

# 3. Commit (pre-commit hook runs automatically)
git commit -m "feat(ui): add new component"

# Output if compliant:
# ✔ ESLint passed
# ✔ Preparing commit message...
# [feature/my-feature abc1234] feat(ui): add new component

# 4. Push (CI/CD runs automatically)
git push origin feature/my-feature

# GitHub Actions will validate entire codebase
```

### Scenario 2: WCAG Violation Detected

```bash
# 1. Accidentally use non-compliant font size
# Component.tsx contains: className="text-[10px]"

# 2. Try to commit
git add src/components/Component.tsx
git commit -m "feat: add component"

# Output (commit BLOCKED):
# ⚠️  ESLint found problems:
#
# src/components/Component.tsx
#   15:30  error  WCAG 2.1 AA violation: text-[10px] is too small (min 12px). Use text-xs or larger  no-restricted-syntax
#
# ✖ 1 problem (1 error, 0 warnings)
#
# ✗ lint-staged failed. Commit aborted.

# 3. Fix the violation
# Change: className="text-[10px]" → className="text-xs"

# 4. Try again
git add src/components/Component.tsx
git commit -m "feat: add component"

# Output (commit SUCCESS):
# ✔ ESLint passed
# [feature/my-feature def5678] feat: add component
```

### Scenario 3: Auto-fix Works

```bash
# Some violations can be auto-fixed by ESLint

# 1. Commit with fixable issues
git add .
git commit -m "refactor: cleanup code"

# Output:
# ⚠️  ESLint found fixable problems. Auto-fixing...
# ✔ Auto-fix completed
# ✔ Re-staging fixed files...
# ✔ ESLint passed
# [feature/cleanup ghi9012] refactor: cleanup code

# The commit includes the auto-fixed changes
```

### Scenario 4: Skip Hook (Emergency Only)

```bash
# ⚠️ NOT RECOMMENDED - Only for emergencies
# Bypasses pre-commit validation

git commit -m "wip: temporary commit" --no-verify

# WARNING: CI/CD will still catch violations!
# Your PR will be blocked until fixed.
```

---

## Troubleshooting

### Hook Not Running

**Problem**: Pre-commit hook doesn't execute

**Solutions**:
```bash
# 1. Reinstall husky
rm -rf .husky
npm run prepare

# 2. Check hook file exists
ls -la .husky/pre-commit

# 3. Make executable (Unix/Mac)
chmod +x .husky/pre-commit

# 4. Verify Git hooks path
git config core.hooksPath
# Should output: .husky
```

### Hook Runs But Always Passes

**Problem**: Hook executes but doesn't catch violations

**Solutions**:
```bash
# 1. Test ESLint directly
npm run lint

# 2. Check lint-staged config in package.json
cat package.json | grep -A 5 "lint-staged"

# 3. Test lint-staged manually
npx lint-staged

# 4. Check ESLint config
cat .eslintrc.cjs | grep -A 10 "no-restricted-syntax"
```

### CI/CD Fails But Local Hook Passes

**Problem**: Local commit succeeds, but GitHub Actions fails

**Causes**:
- Local hook only checks staged files
- CI/CD checks entire codebase
- Different files may have violations

**Solutions**:
```bash
# Run full lint locally (same as CI/CD)
npm run lint

# Check for WCAG violations in entire codebase
grep -r "text-\[9px\]" src/ --include="*.tsx"
grep -r "text-\[10px\]" src/ --include="*.tsx"
grep -r "text-\[11px\]" src/ --include="*.tsx"

# Fix all violations
npm run lint:fix

# Verify clean
npm run lint
```

### Windows-Specific Issues

**Problem**: Hook doesn't work on Windows

**Solutions**:
```powershell
# 1. Ensure Git Bash is installed (comes with Git for Windows)

# 2. Verify npm scripts use proper line endings
npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"

# 3. Check husky installation
npx husky install

# 4. Test hook manually
.husky/pre-commit
```

### Performance Issues

**Problem**: Hook takes too long (>10 seconds)

**Solutions**:
```bash
# 1. Check how many files are staged
git diff --cached --name-only

# 2. Limit lint-staged to fewer files
# Edit package.json:
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings 0 --quiet"  // Add --quiet flag
    ]
  }
}

# 3. Use partial commits
git add src/components/ComponentA.tsx
git commit -m "refactor: update ComponentA"

git add src/components/ComponentB.tsx
git commit -m "refactor: update ComponentB"
```

---

## Bypassing Hooks (Emergency Only)

### When to Bypass

**ONLY** in these scenarios:
- ⚠️ Critical hotfix needed immediately
- ⚠️ Hook is broken and blocking all commits
- ⚠️ Working on WIP branch (not merging to main)

**NEVER** bypass for:
- ❌ "I'll fix it later"
- ❌ Convenience
- ❌ Final commits to main/develop

### How to Bypass

```bash
# Skip pre-commit hook
git commit --no-verify -m "emergency: critical hotfix"

# WARNING: CI/CD will still run!
# Your PR WILL BE BLOCKED if violations exist.
```

### After Bypassing

```bash
# 1. Push to feature branch
git push origin feature/emergency-fix

# 2. CI/CD will fail with WCAG violations

# 3. Fix violations immediately
npm run lint:fix

# 4. Commit fixes
git add .
git commit -m "fix(a11y): resolve WCAG violations"

# 5. Push again (CI/CD should pass)
git push origin feature/emergency-fix
```

---

## Maintenance

### Updating Rules

To modify WCAG enforcement rules:

1. Edit `.eslintrc.cjs`
2. Update `CONTRIBUTING.md` documentation
3. Test changes locally
4. Update this guide if needed

### Disabling Hooks Temporarily

```bash
# Disable for current project
export HUSKY=0

# Commits will skip hooks until terminal closed
git commit -m "test without hooks"

# Re-enable (close terminal or unset)
unset HUSKY
```

### Monitoring CI/CD

View workflow runs:
1. Go to repository on GitHub
2. Click "Actions" tab
3. View ESLint workflow results
4. Check logs for failed runs

---

## Best Practices

### ✅ DO

- Run `npm run lint` before pushing
- Fix violations immediately when detected
- Keep commits small and focused
- Review auto-fix changes before committing
- Document WCAG compliance in PR descriptions

### ❌ DON'T

- Don't bypass hooks without good reason
- Don't commit with `--no-verify` to main/develop
- Don't ignore ESLint warnings
- Don't disable WCAG rules without team discussion
- Don't use font sizes below 12px (text-xs)

---

## Summary

✅ **Pre-commit hooks installed** - Catch violations before commit  
✅ **CI/CD pipeline configured** - Block PRs with violations  
✅ **ESLint rules enforced** - Automatic WCAG validation  
✅ **Documentation complete** - Guidelines in CONTRIBUTING.md

**Result**: WCAG 2.1 AA typography compliance is now automatically enforced at every stage of development.

---

**Questions?** See [CONTRIBUTING.md](CONTRIBUTING.md) or open an issue.
