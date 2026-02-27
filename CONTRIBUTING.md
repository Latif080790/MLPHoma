# Contributing to MLPHoma

Thank you for contributing to MLPHoma! This document provides guidelines and standards for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [WCAG Accessibility Standards](#wcag-accessibility-standards)
- [Code Quality Guidelines](#code-quality-guidelines)
- [Git Commit Guidelines](#git-commit-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

This project follows professional standards of conduct. Be respectful, collaborative, and constructive in all interactions.

---

## Getting Started

### Prerequisites
- Node.js 20+ 
- npm 10+
- Git
- Supabase CLI (optional, for local database)

### Installation

```bash
# Clone the repository
git clone https://github.com/Latif080790/MLPHoma.git
cd MLPHoma

# Install dependencies
npm install

# Setup pre-commit hooks (automatic via npm prepare script)
# If not automatic, run: npx husky install

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start Vite development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint (strict, fails on warnings)
npm run lint:fix     # Auto-fix ESLint issues
npm run test         # Run unit tests with Vitest
npm run test:ui      # Run tests with UI
npm run test:coverage # Generate test coverage report
```

---

## Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features (branch from develop)
- `fix/*` - Bug fixes (branch from develop or main for hotfixes)
- `refactor/*` - Code refactoring without behavior change

### Workflow Steps

1. **Create a branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Follow code quality guidelines
   - Write tests for new features
   - Ensure WCAG compliance (see below)

3. **Commit changes**
   ```bash
   git add .
   git commit -m "type(scope): description"
   # Pre-commit hook will automatically run ESLint
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

5. **CI/CD checks**
   - ESLint validation (automatic)
   - WCAG compliance check (automatic)
   - Build verification (automatic)
   - All checks must pass before merge

---

## WCAG Accessibility Standards

MLPHoma is committed to **WCAG 2.1 AA compliance**. All UI components must meet these standards.

### Typography Requirements ⚠️ CRITICAL

**Minimum Font Size: 12px** (enforced by ESLint)

#### ❌ PROHIBITED
```tsx
// These will fail ESLint and block commits
<div className="text-[9px]">Too small</div>
<div className="text-[10px]">Too small</div>
<div className="text-[11px]">Too small</div>
```

#### ✅ APPROVED
```tsx
// Use text-xs (12px) or larger
<div className="text-xs">Compliant (12px)</div>      // Minimum size
<div className="text-sm">Compliant (14px)</div>      // Recommended
<div className="text-base">Compliant (16px)</div>    // Body text
<div className="text-lg">Compliant (18px)</div>      // Headings
```

### Tailwind CSS Font Size Reference

| Class | Size | Status | Use Case |
|-------|------|--------|----------|
| `text-[9px]` | 9px | ❌ **PROHIBITED** | Violates WCAG |
| `text-[10px]` | 10px | ❌ **PROHIBITED** | Violates WCAG |
| `text-[11px]` | 11px | ❌ **PROHIBITED** | Violates WCAG |
| `text-xs` | 12px | ✅ **MINIMUM** | Small labels, badges, metadata |
| `text-sm` | 14px | ✅ Recommended | Secondary text, descriptions |
| `text-base` | 16px | ✅ Recommended | Body text, primary content |
| `text-lg` | 18px | ✅ Recommended | Subheadings, emphasized text |
| `text-xl` | 20px+ | ✅ Recommended | Headings, titles |

### Automated Enforcement

**ESLint Rules** (`.eslintrc.cjs`):
- Blocks `text-[9px]`, `text-[10px]`, `text-[11px]` with error-level severity
- Custom error messages explain WCAG violation
- Runs automatically on:
  - Pre-commit (via husky + lint-staged)
  - Pull requests (via GitHub Actions)
  - Push to main/develop (via GitHub Actions)

**Pre-commit Hooks**:
```bash
# Automatically runs on git commit
# Scans only staged .ts/.tsx files
# Auto-fixes violations where possible
# Blocks commit if unfixable violations exist
```

**CI/CD Pipeline** (`.github/workflows/eslint.yml`):
```yaml
# Runs on every push and pull request
# Checks entire codebase for WCAG violations
# Fails build if violations found
# Blocks merge until fixed
```

### Additional WCAG Guidelines

While typography is enforced automatically, please also consider:

1. **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
2. **Interactive Elements**: Minimum 44×44px touch target size
3. **Keyboard Navigation**: All interactive elements must be keyboard-accessible
4. **ARIA Labels**: Add descriptive labels for screen readers
5. **Focus Indicators**: Visible focus styles on all interactive elements

### Testing Accessibility

```bash
# Run ESLint WCAG check
npm run lint

# Check specific file
npx eslint src/components/YourComponent.tsx

# Auto-fix violations
npm run lint:fix
```

### Fixing WCAG Violations

If you encounter WCAG typography violations:

1. **Identify violations**
   ```bash
   npm run lint
   ```

2. **Replace with compliant sizes**
   ```tsx
   // Before (violation)
   <span className="text-[10px] text-muted-foreground">Small text</span>
   
   // After (compliant)
   <span className="text-xs text-muted-foreground">Small text</span>
   ```

3. **Verify fix**
   ```bash
   npm run lint
   # Should show 0 errors
   ```

4. **Commit changes**
   ```bash
   git add .
   git commit -m "fix(a11y): replace text-[10px] with text-xs for WCAG compliance"
   # Pre-commit hook will validate
   ```

---

## Code Quality Guidelines

### TypeScript Standards

1. **Type Safety**: Avoid `any` types. Use proper interfaces/types.
   ```tsx
   // ❌ Bad
   const handleClick = (data: any) => { ... }
   
   // ✅ Good
   interface ClickData {
     id: string;
     timestamp: number;
   }
   const handleClick = (data: ClickData) => { ... }
   ```

2. **Null Safety**: Handle null/undefined cases explicitly.
   ```tsx
   // ✅ Good
   const user = data?.user ?? fallbackUser;
   if (!project) return <EmptyState />;
   ```

3. **Enum vs Union Types**: Use const enums or union types for constants.
   ```tsx
   // ✅ Good
   type Status = 'pending' | 'approved' | 'rejected';
   const STATUS = {
     PENDING: 'pending',
     APPROVED: 'approved',
     REJECTED: 'rejected',
   } as const;
   ```

### React/TSX Standards

1. **Component Structure**
   ```tsx
   // Recommended structure
   import statements
   
   interface ComponentProps { ... }
   
   export function Component({ prop1, prop2 }: ComponentProps) {
     // Hooks (all at top, before conditionals)
     const [state, setState] = useState();
     const query = useQuery();
     
     // Early returns (after hooks)
     if (loading) return <Skeleton />;
     if (error) return <ErrorState />;
     
     // Event handlers
     const handleClick = () => { ... };
     
     // Render
     return ( ... );
   }
   ```

2. **Hook Rules**
   - All hooks must run before conditional returns
   - No hooks inside conditionals/loops
   - Custom hooks must start with "use"

3. **Props Destructuring**: Destructure props in function signature.
   ```tsx
   // ✅ Good
   export function Card({ title, description, children }: CardProps) { ... }
   
   // ❌ Avoid
   export function Card(props: CardProps) {
     const { title, description } = props; // Extra line
   }
   ```

4. **Component Naming**: PascalCase for components, camelCase for functions.
   ```tsx
   // ✅ Good
   function UserProfile() { ... }
   const handleSubmit = () => { ... };
   ```

### File Organization

```
src/
├── components/        # Reusable UI components
│   ├── common/       # Shared across modules
│   ├── rab/          # RAB-specific components
│   ├── ahsp/         # AHSP-specific components
│   └── ...           # Domain-specific folders
├── pages/            # Route-level pages
│   └── modules/      # Feature modules
├── services/         # API/business logic services
├── store/            # Zustand state management
├── hooks/            # Custom React hooks
├── lib/              # Utility functions
├── types/            # TypeScript type definitions
└── test/             # Test utilities and fixtures
```

### Naming Conventions

- **Files**: PascalCase for components (`UserCard.tsx`), camelCase for utilities (`formatCurrency.ts`)
- **Folders**: kebab-case or camelCase (`rab/`, `supplyChain/`)
- **Functions**: camelCase (`getUserData`, `handleSubmit`)
- **Constants**: UPPER_SNAKE_CASE (`API_TIMEOUT`, `MAX_RETRY`)
- **Interfaces/Types**: PascalCase (`UserData`, `ProjectConfig`)

---

## Git Commit Guidelines

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no behavior change)
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `test`: Adding/updating tests
- `chore`: Maintenance tasks (dependencies, build config)
- `perf`: Performance improvements
- `ci`: CI/CD configuration changes
- `build`: Build system changes

### Scopes (examples)

- `rab`: RAB module
- `ahsp`: AHSP module
- `finance`: Finance module
- `supply`: Supply chain
- `a11y`: Accessibility
- `ui`: UI components
- `api`: API integration
- `db`: Database

### Examples

```bash
# Feature addition
git commit -m "feat(rab): add TKDN percentage calculation to RAB table"

# Bug fix
git commit -m "fix(ahsp): correct price rounding in AHSP item editor"

# Accessibility fix
git commit -m "fix(a11y): replace text-[10px] with text-xs for WCAG compliance"

# Refactoring
git commit -m "refactor(supply): extract PO validation logic to service layer"

# Documentation
git commit -m "docs(contributing): add WCAG typography guidelines"

# Breaking change
git commit -m "feat(api)!: migrate to Supabase v3 API

BREAKING CHANGE: Supabase client initialization now requires apiVersion option"
```

---

## Testing Requirements

### Unit Tests

Write unit tests for:
- Complex business logic
- Utility functions
- Custom hooks
- Critical user flows

```tsx
// Example: src/lib/__tests__/formatCurrency.test.ts
import { expect, test } from 'vitest';
import { formatCurrency } from '../formatCurrency';

test('formatCurrency formats IDR correctly', () => {
  expect(formatCurrency(1000000)).toBe('Rp 1.000.000');
  expect(formatCurrency(0)).toBe('Rp 0');
});
```

### Component Tests

Use React Testing Library for component tests:

```tsx
// Example: src/components/__tests__/UserCard.test.tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { UserCard } from '../UserCard';

test('renders user name', () => {
  render(<UserCard name="John Doe" role="PM" />);
  expect(screen.getByText('John Doe')).toBeInTheDocument();
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Run specific test file
npm run test src/lib/__tests__/formatCurrency.test.ts
```

### Test Coverage Goals

- **Critical paths**: 80%+ coverage
- **Utility functions**: 90%+ coverage
- **UI components**: Focus on behavior, not implementation

---

## Pull Request Process

### Before Creating PR

1. ✅ Run linter and fix violations
   ```bash
   npm run lint:fix
   ```

2. ✅ Run tests and ensure they pass
   ```bash
   npm run test
   ```

3. ✅ Build locally to verify no errors
   ```bash
   npm run build
   ```

4. ✅ Verify WCAG compliance
   ```bash
   # Should show 0 violations
   npm run lint | grep -i wcag
   ```

### PR Title Format

Follow commit message format:
```
type(scope): Short description
```

Example:
```
feat(rab): Add TKDN compliance validation
fix(a11y): Fix WCAG typography violations in finance module
refactor(supply): Extract PO service layer
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] WCAG compliance verified

## Related Issues
Closes #123

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] WCAG compliance verified (no text-[9/10/11px])
```

### Review Process

1. **Automated Checks** (must pass):
   - ✅ ESLint validation
   - ✅ WCAG compliance check
   - ✅ Build verification
   - ✅ Tests pass

2. **Code Review** (1+ approvals required):
   - Code quality
   - Architecture/design patterns
   - Test coverage
   - Documentation

3. **Merge**:
   - Squash and merge (for feature branches)
   - Regular merge (for release branches)

---

## Additional Resources

### Project Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [SETUP.md](SETUP.md) - Setup instructions
- [WCAG_TYPOGRAPHY_COMPLIANCE_REPORT.md](WCAG_TYPOGRAPHY_COMPLIANCE_REPORT.md) - Accessibility compliance report

### External Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Vitest Documentation](https://vitest.dev/)

---

## Questions or Issues?

If you have questions about contributing:
1. Check existing documentation
2. Search closed issues/PRs for similar cases
3. Open a new issue with the `question` label

---

**Thank you for contributing to MLPHoma!** 🚀
