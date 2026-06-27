# Dead Code Audit — Design Spec
**Date:** 2026-06-27  
**Scope:** Full codebase audit using Knip to identify and remove all unused files across all layers of the MLPHoma project.

---

## 1. Background

The MLPHoma codebase has accumulated legacy page modules (`src/pages/modules/`) that were superseded by v3 rewrites (`src/pages/modules/v3/`). These orphaned pages drag along their own stores, services, types, hooks, and test files — none of which are reachable from the live application. A systematic dead code audit will reduce bundle size, lower cognitive overhead, and make future refactors safer.

---

## 2. Goal

Remove all files that are unreachable from the application's live entry points, after automated detection and per-group human confirmation.

**Success criteria:**
- `knip` reports zero unused files after the audit completes
- `npm run build` succeeds with no TypeScript errors
- All active routes (as defined in `PROTECTED_COMPONENT_MAP` in `App.tsx`) still render correctly

---

## 3. Tool: Knip

**Package:** `knip` (v5+), installed as devDependency only.

**Why Knip:**
- TypeScript-aware import graph analysis
- Understands dynamic imports (`lazyRetry()` wrappers)
- Scans all file types in one pass: `.ts`, `.tsx`
- Industry standard for this type of audit
- Zero false negatives compared to manual grep

**Configuration file: `knip.json` (project root)**

```json
{
  "entry": ["src/main.tsx", "src/App.tsx"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": ["src/vite-env.d.ts", "**/*.d.ts"]
}
```

**Entry points rationale:**
- `src/main.tsx` — React app root, mounts `<App />`
- `src/App.tsx` — all `lazyRetry()` dynamic imports are traced from here; Knip resolves them as dynamic entry points automatically

---

## 4. Audit Execution

1. Install: `npm install --save-dev knip`
2. Add script to `package.json`: `"knip": "knip"`
3. Run: `npm run knip -- --reporter json > knip-results.json`
4. Parse results and group by file type/domain

---

## 5. Deletion Strategy — 7 Groups, Per-Group Confirmation

Results are presented and deleted in this order (most isolated → most shared):

| Group | Path Pattern | Description |
|-------|-------------|-------------|
| **G1** | `src/pages/modules/` (non-v3) | Legacy page files not in any active route |
| **G2** | `src/components/<domain>/` | Component folders only used by G1 pages |
| **G3** | `src/store/` | Zustand stores only used by orphaned pages |
| **G4** | `src/services/` | Service files only consumed by orphaned stores/pages |
| **G5** | `src/types/` | Type definition files with no live imports |
| **G6** | `src/hooks/` & `src/lib/` | Hooks and utilities with no live callers |
| **G7** | `src/**/__tests__/` | Test files for deleted features |

**Protocol for each group:**
1. Present complete file list with count
2. Wait for user confirmation
3. Delete confirmed files
4. Re-run `npm run knip` to catch any newly-orphaned dependencies
5. Proceed to next group

**False-positive handling:** If a file appears in Knip output but the user wants to keep it (e.g., planned future use), skip it. Do not delete without explicit confirmation.

---

## 6. Known Pre-Identified Orphans (G1)

These are confirmed not present in `PROTECTED_COMPONENT_MAP` or `navRegistry`:

- `src/pages/modules/CashFlow.tsx`
- `src/pages/modules/ProjectCosting.tsx`
- `src/pages/modules/RAB.tsx`
- `src/pages/modules/RAP.tsx`
- `src/pages/modules/WBS.tsx`
- `src/pages/modules/ResourcePlan.tsx`
- `src/pages/modules/AHSP/index.tsx`

---

## 7. Post-Audit Verification

After all groups deleted:

1. `npm run build` — must succeed with zero TypeScript errors
2. `npm run knip` — must report zero unused files
3. Spot-check active routes in browser: Finance, QHSE, WBS (v3), ChangeManagement, SubcontractorManagement

---

## 8. Out of Scope

- Refactoring or rewriting any retained file
- Changing route configuration
- Evaluating whether any orphaned feature should be revived
- Changes to `public/`, `supabase/`, or any non-`src/` directory
