# System Architecture Documentation

## Overview

MLPHoma adalah aplikasi manajemen proyek konstruksi yang mengintegrasikan:
- **AHSP** (Analisa Harga Satuan Pekerjaan) - Unit price analysis
- **RAB** (Rencana Anggaran Biaya) - Budget estimation
- **RAP** (Rencana Anggaran Pelaksanaan) - Time-phased budget
- **Timeline/Schedule** - CPM scheduling with Gantt chart
- **WBS** - Work Breakdown Structure
- **Curva-S** - Earned Value Management
- **Cash Flow** - Financial planning

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│   (React Components + shadcn/ui + Tailwind)                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ZUSTAND STORES                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  AHSP    │  │   RAB    │  │   RAP    │  │ Timeline │       │
│  │  Store   │  │  Store   │  │  Store   │  │  Store   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │ Project  │  │   WBS    │  │  Curva-S │                     │
│  │  Store   │  │  Store   │  │  Store   │                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                          │
│  ┌──────────────────────┐  ┌─────────────────────────┐         │
│  │ Calculation Service  │  │  Validation Service     │         │
│  │  - Price markup      │  │  - Zod schemas          │         │
│  │  - Component total   │  │  - Runtime validation   │         │
│  │  - RAB/AHSP formulas │  │  - Data integrity       │         │
│  └──────────────────────┘  └─────────────────────────┘         │
│                                                                  │
│  ┌──────────────────────┐  ┌─────────────────────────┐         │
│  │   Auto Scheduler     │  │  CPM Engine             │         │
│  │  - Task generation   │  │  - Critical path        │         │
│  │  - Resource alloc    │  │  - Float calculation    │         │
│  └──────────────────────┘  └─────────────────────────┘         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SYNC & PERSISTENCE LAYER                      │
│  ┌──────────────────────┐  ┌─────────────────────────┐         │
│  │  Sync Queue Manager  │  │  Local Storage          │         │
│  │  - Optimistic updates│  │  - Offline cache        │         │
│  │  - Retry logic       │  │  - State persistence    │         │
│  │  - Conflict resolve  │  │  - Undo/redo history    │         │
│  └──────────────────────┘  └─────────────────────────┘         │
└────────────────┬────────────────────────────────────────────────┘
                 │
│                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE + THICK CLIENT                       │
│  (Logic resides in React Services + Supabase Row Level Security)│
│  ┌────────────┐  ┌────────────┐  ┌──────────┐                 │
│  │  resources │  │ ahsp_items │  │ projects │                 │
│  └────────────┘  └────────────┘  └──────────┘                 │
│                                                                  │
│  ┌────────────────┐  ┌──────────┐  ┌─────────────────┐        │
│  │ ahsp_components│  │ rab_items│  │ timeline_tasks  │        │
│  └────────────────┘  └──────────┘  └─────────────────┘        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────┐      │
│  │  wbs_items   │  │ task_dependencies│  │  rap_data   │      │
│  └──────────────┘  └──────────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Calculation Logic

### 1. AHSP Pricing Formula

```typescript
// Step 1: Calculate base price from components
basePrice = Σ(component.coefficient × component.unitPrice)

// Step 2: Apply overhead
priceWithOverhead = basePrice × (1 + overheadPercent/100)

// Step 3: Apply profit
finalPrice = priceWithOverhead × (1 + profitPercent/100)
```

### 2. RAB Item Calculation

```typescript
// Step 1: Subtotal
subtotal = volume × unitPrice

// Step 2: Apply overhead
withOverhead = subtotal × (1 + overheadPercent/100)

// Step 3: Apply profit
withProfit = withOverhead × (1 + profitPercent/100)

// Step 4: Apply tax (PPN/PPh)
finalTotal = withProfit × (1 + taxPercent/100)
```

### 3. RAP Distribution

```typescript
// Monthly distribution based on task schedule
for each month in projectDuration:
  tasksInMonth = tasks.filter(t => t.overlapsMonth(month))
  monthlyBudget = Σ(task.cost × task.progressInMonth)
```

---

## Database Schema

### Core Tables

#### `resources`
Stores material, labor, equipment, and subcontractor data.
```sql
- id: text (PK)
- code: text
- name: text
- type: enum('material', 'labor', 'equipment', 'subcontractor')
- unit: text
- unit_price: numeric
- created_at: timestamp
- updated_at: timestamp
```

#### `ahsp_items`
Unit price analysis items.
```sql
- id: text (PK)
- code: text (UNIQUE)
- name: text
- description: text
- unit: text
- category: text
- base_price: numeric
- final_price: numeric
- overhead_percentage: numeric
- profit_percentage: numeric
- created_at: timestamp
- updated_at: timestamp
```

#### `ahsp_components`
AHSP breakdown (materials, labor, equipment per AHSP item).
```sql
- id: text (PK)
- ahsp_id: text (FK -> ahsp_items)
- resource_id: text (FK -> resources)
- type: text
- coefficient: numeric
- unit: text
- unit_price: numeric
- subtotal: numeric
- created_at: timestamp
- updated_at: timestamp
```

#### `projects`
Project master data.
```sql
- id: text (PK)
- code: text
- name: text
- client_name: text
- location: text
- start_date: date
- end_date: date
- budget: numeric
- status: text
- payment_terms: jsonb
- meta: jsonb
- created_at: timestamp
- updated_at: timestamp
```

#### `rab_items`
Budget items per project.
```sql
- id: text (PK)
- project_id: text (FK -> projects)
- ahsp_code: text
- name: text
- unit: text
- volume: numeric
- unit_price: numeric
- final_total: numeric
- task_id: text (FK -> timeline_tasks)
- created_at: timestamp
- updated_at: timestamp
```

#### `wbs_items`
Work Breakdown Structure.
```sql
- id: text (PK)
- project_id: text (FK -> projects)
- code: text
- name: text
- level: integer
- parent_id: text (FK -> wbs_items)
- sort_order: integer
- created_at: timestamp
- updated_at: timestamp
```

#### `timeline_tasks`
Schedule/Gantt tasks.
```sql
- id: text (PK)
- project_id: text (FK -> projects)
- name: text
- description: text
- start_date: date
- end_date: date
- duration: integer
- progress: numeric
- status: enum('not_started', 'in_progress', 'completed', 'delayed')
- priority: enum('low', 'medium', 'high')
- wbs_id: text (FK -> wbs_items)
- rab_id: text (FK -> rab_items)
- baseline_start_date: date
- baseline_end_date: date
- assigned_resources: jsonb
- created_at: timestamp
- updated_at: timestamp
```

#### `task_dependencies`
Task relationships (FS, SS, FF, SF).
```sql
- id: text (PK)
- project_id: text (FK -> projects)
- predecessor_id: text (FK -> timeline_tasks)
- successor_id: text (FK -> timeline_tasks)
- type: enum('FS', 'SS', 'FF', 'SF')
- lag: integer
- created_at: timestamp
```

#### `rap_data`
Time-phased budget (monthly cashflow plan).
```sql
- project_id: text (PK, FK -> projects)
- plan_data: jsonb (array of {period, planned, actual})
- updated_at: timestamp
```

---

## State Management Pattern

### Zustand Store Structure

```typescript
interface Store {
  // State
  items: Record<string, Item[]>
  
  // Actions
  addItem: (projectId: string, item: Item) => string
  updateItem: (projectId: string, id: string, updates: Partial<Item>) => void
  removeItem: (projectId: string, id: string) => void
  
  // Getters (cached for performance)
  getItems: (projectId: string) => Item[]
  
  // Sync (fire-and-forget pattern replaced with queue)
  syncProject: (projectId: string) => Promise<void>
}
```

### Data Validation Flow

```typescript
1. User Input
   ↓
2. Zod Schema Validation (validateAHSPItem, validateRABItem)
   ↓
3. Business Logic (calculationService)
   ↓
4. Store Update (Zustand)
   ↓
5. Sync Queue (supabaseSyncService)
   ↓
6. Supabase Insert/Update
```

---

## Performance Optimizations

### 1. Cached Getters
```typescript
// Prevents re-computation when source hasn't changed
const getCachedItems = createCachedGetter(
  () => store.items,
  (items) => Object.values(items).sort(...)
)
```

### 2. Debounced Updates
```typescript
// Prevent excessive re-renders on rapid input changes
const debouncedUpdate = debounce(updateItem, 300)
```

### 3. Lazy Loading
```typescript
// Load data only when needed
const items = useRabStore(s => 
  currentProject ? s.getItems(currentProject.id) : EMPTY_ARRAY
)
```

### 4. Optimistic Updates
```typescript
// Update UI immediately, sync in background
store.addItem(item) // UI updated
syncQueue.enqueue({ operation: 'insert', data: item }) // Background sync
```

---

## Error Handling Strategy

### 1. Runtime Validation
All data entering stores is validated with Zod schemas:
```typescript
const validated = AHSPItemSchema.safeParse(input)
if (!validated.success) {
  throw new ValidationError(validated.error.message)
}
```

### 2. Sync Retry Logic
Failed sync operations are retried with exponential backoff:
```typescript
retryDelay = baseDelay × 2^(retryCount - 1)
maxRetries = 3
```

### 3. Error Boundaries
React components wrapped in error boundaries to prevent crashes:
```tsx
<ErrorBoundary fallback={<ErrorDisplay />}>
  <Component />
</ErrorBoundary>
```

### 4. Toast Notifications
User-friendly error messages:
```typescript
toast.error('Failed to save AHSP item. Retrying...')
```

---

## Security Considerations

1. **RLS (Row Level Security)**: 
   - **Production Policies Enforced** (as of 2026-02-15).
   - Projects restricted to Owner (user_id) + Members (project_members).
   - Master Data (AHSP) restricted to Authenticated Read/Write.
   ```sql
   -- Strict Policy
   CREATE POLICY "Strict Project Access" ON projects 
   USING (auth.uid() = user_id OR EXISTS(SELECT 1 FROM project_members...));
   ```

2. **Environment Variables**: Supabase credentials in `.env.local` (not committed to git)

3. **Input Sanitization**: All user input validated with Zod before storage

4. **SQL Injection Prevention**: Using Supabase client ORM (no raw SQL from client)

---

## Development Workflow

### Running Locally
```bash
npm install
npm run dev
```

### Database Setup
1. Create Supabase project
2. Run `supabase_schema.sql` in SQL Editor
3. Set environment variables in `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Seed Data
```bash
node scripts/seed_ahsp_supabase.mjs
```

### Testing
```bash
npm test
npm run test:coverage
```

---

## Maintenance & Scalability

### Adding New Module
1. Create Zustand store in `src/store/`
2. Create types in `src/types/`
3. Add validation schemas in `src/lib/validationSchemas.ts`
4. Create UI components in `src/components/`
5. Add route in `src/config/routes.ts`
6. Update database schema if needed

### Performance Monitoring
- Use React DevTools Profiler
- Monitor Supabase dashboard for query performance
- Check localStorage usage (max 5-10MB recommended)

### Backup & Recovery
- Supabase automatic backups (retention depends on plan)
- Export functionality for RAB, AHSP, Timeline data
- LocalStorage serves as offline cache

---

## Known Limitations & Future Improvements

### Current Limitations
1. No multi-user collaboration (no real-time sync)
2. No authentication (all data public in dev)
3. No role-based access control
4. Limited offline functionality (queue only)

### Planned Improvements
1. Real-time collaboration with Supabase Realtime
2. User authentication with Supabase Auth
3. Advanced resource leveling in auto-scheduler
4. PDF/Excel export improvements
5. Mobile responsive design optimization
6. Progressive Web App (PWA) support

---

## Contributors & Support

For questions or issues:
1. Check this documentation
2. Review code comments in `src/lib/` services
3. Inspect Zustand stores in `src/store/`
4. Test with sample data in `src/lib/sampleData/`

---

**Last Updated**: November 2025
**Version**: 1.0.0
**License**: Private/Internal Use Only
