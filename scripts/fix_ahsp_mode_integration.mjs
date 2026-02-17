#!/usr/bin/env node
/**
 * AHSP Mode Integration Fix Script
 * Applies Phase 1 & 2 implementation changes
 * 
 * Usage: node scripts/fix_ahsp_mode_integration.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

// Backup directory
const BACKUP_DIR = path.join(ROOT, 'backups', `ahsp-mode-fix-${Date.now()}`)

// Files to modify
const FILES = {
  AHSP_EDITOR: path.join(ROOT, 'src/components/ahsp/AHSPItemEditor.tsx'),
  AHSP_CATALOG: path.join(ROOT, 'src/components/ahsp/AHSPCatalog.tsx'),
  SUPABASE_CLIENT: path.join(ROOT, 'src/lib/supabaseClient.ts'),
  AHSP_TYPES: path.join(ROOT, 'src/types/ahsp.ts'),
  AHSP_STORE: path.join(ROOT, 'src/store/ahspStore.ts'),
}

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function success(message) {
  log(`✅ ${message}`, 'green')
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue')
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function error(message) {
  log(`❌ ${message}`, 'red')
}

// Create backup
function backup(filePath) {
  const relativePath = path.relative(ROOT, filePath)
  const backupPath = path.join(BACKUP_DIR, relativePath)
  const backupDir = path.dirname(backupPath)
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath)
    return backupPath
  }
  return null
}

// Apply all backups
function backupAll() {
  info('Creating backups...')
  const backups = {}
  Object.entries(FILES).forEach(([key, filePath]) => {
    const backupPath = backup(filePath)
    if (backupPath) {
      backups[key] = backupPath
      success(`Backed up: ${path.relative(ROOT, filePath)}`)
    } else {
      warn(`File not found: ${path.relative(ROOT, filePath)}`)
    }
  })
  return backups
}

// Restore from backup
function restore(backups) {
  error('Restoring from backups...')
  Object.entries(backups).forEach(([key, backupPath]) => {
    const originalPath = FILES[key]
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, originalPath)
      success(`Restored: ${path.relative(ROOT, originalPath)}`)
    }
  })
}

// Apply changes to AHSPItemEditor.tsx
function fixAHSPItemEditor() {
  info('Step 1: Fixing AHSPItemEditor.tsx...')
  const filePath = FILES.AHSP_EDITOR
  let content = fs.readFileSync(filePath, 'utf8')
  
  // STEP 1.1: Add imports
  const importSearch = `import type { AHSPItem, AHSPComponent, ResourceType, ResourceUnit } from '../../types/ahsp'`
  if (content.includes(importSearch)) {
    const importReplacement = `import type { AHSPItem, AHSPComponent, ResourceType, ResourceUnit } from '../../types/ahsp'
import type { AHSPCreationMode } from './AHSPCreationModeDialog'
import { SNI_PRESETS, type SNIPreset, getSNIPreset } from '../../lib/sniPresets'`
    content = content.replace(importSearch, importReplacement)
    success('  ✓ Added imports')
  } else {
    warn('  ⚠ Could not find import location')
  }
  
  // STEP 1.2: Update interface
  const interfaceSearch = `/** Props for AHSPItemEditor component */
export interface AHSPItemEditorProps {
  /** Current item being edited (null for new item) */
  item?: AHSPItem | null
  /** Whether dialog is open */
  open: boolean
  /** Dialog close handler */
  onClose: () => void
  /** Save handler - returns the saved item ID for new items */
  onSave: (item: Omit<AHSPItem, 'id' | 'createdAt' | 'updatedAt'>) => string | Promise<string>
}`
  
  if (content.includes(interfaceSearch)) {
    const interfaceReplacement = `/** Props for AHSPItemEditor component */
export interface AHSPItemEditorProps {
  /** Current item being edited (null for new item) */
  item?: AHSPItem | null
  /** Whether dialog is open */
  open: boolean
  /** Dialog close handler */
  onClose: () => void
  /** Save handler - returns the saved item ID for new items */
  onSave: (item: Omit<AHSPItem, 'id' | 'createdAt' | 'updatedAt'>) => string | Promise<string>
  /** Creation mode (SNI/Custom/Historical) */
  mode?: AHSPCreationMode
  /** Source reference for SNI or historical items */
  sourceReference?: string
}`
    content = content.replace(interfaceSearch, interfaceReplacement)
    success('  ✓ Updated interface')
  } else {
    warn('  ⚠ Could not find interface')
  }
  
  // STEP 1.3: Update function signature
  const funcSearch = `/**
 * AHSPItemEditor Component
 */
export function AHSPItemEditor({
  item,
  open,
  onClose,
  onSave,
}: AHSPItemEditorProps) {`
  
  if (content.includes(funcSearch)) {
    const funcReplacement = `/**
 * AHSPItemEditor Component
 */
export function AHSPItemEditor({
  item,
  open,
  onClose,
  onSave,
  mode,
  sourceReference,
}: AHSPItemEditorProps) {`
    content = content.replace(funcSearch, funcReplacement)
    success('  ✓ Updated function signature')
  } else {
    warn('  ⚠ Could not find function signature')
  }
  
  // STEP 1.4: Add SNI state
  const stateSearch = `  const [pendingDeleteComponentId, setPendingDeleteComponentId] = useState<string | null>(null)
  const [resourceSearch, setResourceSearch] = useState('')`
  if (content.includes(stateSearch)) {
    const stateAddition = `  const [pendingDeleteComponentId, setPendingDeleteComponentId] = useState<string | null>(null)
  const [resourceSearch, setResourceSearch] = useState('')
  const [selectedSNIPreset, setSelectedSNIPreset] = useState<string | null>(null)
  const [showSNIHelp, setShowSNIHelp] = useState(mode === 'sni')`
    content = content.replace(stateSearch, stateAddition)
    success('  ✓ Added SNI state')
  } else {
    warn('  ⚠ Could not find state location')
  }
  
  // STEP 1.5: Add SNI preset handler (after handleDeleteComponent)
  const handlerSearch = `  /**
   * Handle deleting component
   */
  const handleDeleteComponent = (componentId: string) => {
    setPendingDeleteComponentId(componentId)
  }`
  
  if (content.includes(handlerSearch)) {
    const handlerAddition = `  /**
   * Handle deleting component
   */
  const handleDeleteComponent = (componentId: string) => {
    setPendingDeleteComponentId(componentId)
  }

  /**
   * Handle applying SNI preset
   */
  const handleApplySNIPreset = (preset: SNIPreset) => {
    // Auto-fill master data
    setFormData(prev => ({
      ...prev,
      code: preset.code,
      name: preset.name,
      category: preset.category,
      unit: preset.unit as ResourceUnit,
      description: preset.description || '',
    }))

    // Auto-add components from SNI
    preset.components.forEach(comp => {
      // Check if resource exists
      let resource = resources.find(r => r.code === comp.code)
      
      if (!resource) {
        // Create new resource
        const newResourceId = addResource({
          code: comp.code,
          name: comp.name,
          type: comp.type,
          unit: comp.unit as ResourceUnit,
          unitPrice: comp.estimatedPrice,
          specifications: comp.notes || \`SNI preset component\`,
          isActive: true,
        })
        resource = resources.find(r => r.id === newResourceId)
      }

      if (resource) {
        // Add component with SNI coefficient
        addComponent(currentAHSPId, {
          resourceId: resource.id,
          type: comp.type,
          coefficient: comp.coefficient,
          unit: comp.unit as ResourceUnit,
          unitPrice: comp.estimatedPrice,
          subtotal: comp.coefficient * comp.estimatedPrice,
        })
      }
    })

    toast.success(\`SNI Preset "\${preset.code}" diterapkan dengan \${preset.components.length} components\`, {
      description: preset.name
    })
    setShowSNIHelp(false)
  }`
    
    content = content.replace(handlerSearch, handlerAddition)
    success('  ✓ Added SNI preset handler')
  } else {
    warn('  ⚠ Could not find handler location')
  }
  
  // STEP 1.6: Add SNI Preset UI (after "General Identification" section header)
  const uiSearch = `                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-4">
                    <div className="h-4 w-1 bg-blue-600 rounded-full" />
                    General Identification
                  </div>`
  
  if (content.includes(uiSearch)) {
    const uiAddition = `                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-4">
                    <div className="h-4 w-1 bg-blue-600 rounded-full" />
                    General Identification
                  </div>

                  {/* SNI Preset Selector - only show if mode is 'sni' */}
                  {mode === 'sni' && !item && (
                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-200 space-y-4 mb-6">
                      <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                        <FileText className="h-4 w-4" />
                        SNI Preset Library
                      </div>
                      <p className="text-xs text-blue-600">
                        Pilih preset SNI untuk auto-fill component & coefficient berdasarkan standar
                      </p>
                      <Select 
                        value={selectedSNIPreset || undefined}
                        onValueChange={(code) => {
                          setSelectedSNIPreset(code)
                          const preset = getSNIPreset(code)
                          if (preset) handleApplySNIPreset(preset)
                        }}
                      >
                        <SelectTrigger className="h-12 rounded-2xl border-blue-200 bg-white font-bold">
                          <SelectValue placeholder="Pilih SNI Preset..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-blue-200 shadow-xl max-h-80">
                          {SNI_PRESETS.map(preset => (
                            <SelectItem key={preset.code} value={preset.code} className="py-3 font-semibold">
                              {preset.code} - {preset.name}
                              <span className="block text-xs text-slate-500">{preset.category}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedSNIPreset && (
                        <div className="p-3 bg-white rounded-xl border border-blue-100">
                          <p className="text-xs text-blue-600 font-bold mb-1">Components Auto-Loaded:</p>
                          <p className="text-xs text-slate-600">
                            {getSNIPreset(selectedSNIPreset)?.components.length || 0} items dari SNI
                          </p>
                        </div>
                      )}
                    </div>
                  )}`
    
    content = content.replace(uiSearch, uiAddition)
    success('  ✓ Added SNI preset UI')
  } else {
    warn('  ⚠ Could not find UI location')
  }
  
  fs.writeFileSync(filePath, content, 'utf8')
  success('Step 1 completed!')
}

// Apply changes to supabaseClient.ts
function fixSupabaseClient() {
  info('Step 2: Fixing supabaseClient.ts...')
  const filePath = FILES.SUPABASE_CLIENT
  let content = fs.readFileSync(filePath, 'utf8')
  
  // Find the end of the file or after last export
  const insertionPoint = content.lastIndexOf('export ')
  const beforeInsertion = content.substring(0, insertionPoint)
  const lastExportEnd = content.indexOf('\n', content.indexOf('}', insertionPoint))
  const afterInsertion = content.substring(lastExportEnd + 1)
  
  const newFunctions = `

/**
 * Save AHSP creation log
 * Tracks how AHSP was created (SNI/Custom/Historical)
 */
export async function saveCreationLog(log: {
  ahsp_id: string
  creation_mode: 'sni' | 'custom' | 'historical'
  source_reference?: string
  created_by?: string
  metadata?: any
}) {
  const client = assertSupabase()
  const id = \`log-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`
  return client.from('ahsp_creation_logs').insert({
    id,
    ...log,
    created_at: new Date().toISOString()
  })
}

/**
 * Get creation log for an AHSP item
 */
export async function getCreationLog(ahspId: string) {
  const client = assertSupabase()
  return client
    .from('ahsp_creation_logs')
    .select('*')
    .eq('ahsp_id', ahspId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
}
`
  
  content = beforeInsertion + content.substring(insertionPoint, lastExportEnd + 1) + newFunctions + afterInsertion
  
  fs.writeFileSync(filePath, content, 'utf8')
  success('Step 2 completed!')
}

// Apply changes to AHSPCatalog.tsx
function fixAHSPCatalog() {
  info('Step 3: Fixing AHSPCatalog.tsx...')
  const filePath = FILES.AHSP_CATALOG
  let content = fs.readFileSync(filePath, 'utf8')
  
  // STEP 3.1: Add import
  const importSearch = `import { supabase } from '../../lib/supabaseClient'`
  if (content.includes(importSearch)) {
    const importReplacement = `import { supabase, saveCreationLog } from '../../lib/supabaseClient'`
    content = content.replace(importSearch, importReplacement)
    success('  ✓ Added saveCreationLog import')
  }
  
  // STEP 3.2: Add icons import
  const iconSearch = `import { FileText,`
  if (content.includes(iconSearch)) {
    const iconReplacement = `import { FileText, History, Wrench,`
    content = content.replace(iconSearch, iconReplacement)
    success('  ✓ Added History and Wrench icons')
  }
  
  // STEP 3.3: Update handleModeSelect
  const modeSelectSearch = `  const handleModeSelect = (mode: AHSPCreationMode) => {
    setSelectedMode(mode)
    setEditingItem(null)
    setShowModeDialog(false)
    setShowEditor(true)
  }`
  
  if (content.includes(modeSelectSearch)) {
    const modeSelectReplacement = `  const handleModeSelect = (mode: AHSPCreationMode) => {
    setSelectedMode(mode)
    setEditingItem(null)
    setShowModeDialog(false)
    setShowEditor(true)
    
    // Set source reference based on mode
    if (mode === 'sni') {
      setSourceReference('') // Will be set after SNI preset selection
    } else if (mode === 'historical') {
      // TODO: Show historical selector first
    }
    
    toast.info(\`Creating AHSP in \${mode.toUpperCase()} mode\`)
  }`
    content = content.replace(modeSelectSearch, modeSelectReplacement)
    success('  ✓ Updated handleModeSelect')
  }
  
  // STEP 3.4: Update AHSPItemEditor props
  const editorSearch = `        <AHSPItemEditor
          item={editingItem}
          open={showEditor}
          onClose={() => {
            setShowEditor(false)
            setSelectedMode(null)
            setSourceReference(null)
          }}
          onSave={async (data) => {
            let itemId: string
            if (editingItem) {
              updateAHSPItem(editingItem.id, data)
              itemId = editingItem.id
            } else {
              itemId = addAHSPItem(data)
            }
            return itemId
          }}
        />`
  
  if (content.includes(editorSearch)) {
    const editorReplacement = `        <AHSPItemEditor
          item={editingItem}
          open={showEditor}
          mode={selectedMode}
          sourceReference={sourceReference}
          onClose={() => {
            setShowEditor(false)
            setSelectedMode(null)
            setSourceReference(null)
          }}
          onSave={async (data) => {
            let itemId: string
            if (editingItem) {
              updateAHSPItem(editingItem.id, data)
              itemId = editingItem.id
            } else {
              itemId = addAHSPItem(data)
              
              // Save creation log for new items
              if (selectedMode) {
                try {
                  await saveCreationLog({
                    ahsp_id: itemId,
                    creation_mode: selectedMode,
                    source_reference: sourceReference || undefined,
                    metadata: {
                      created_via: 'ahsp_catalog',
                      timestamp: new Date().toISOString()
                    }
                  })
                } catch (error) {
                  console.error('Failed to save creation log:', error)
                }
              }
            }
            return itemId
          }}
        />`
    content = content.replace(editorSearch, editorReplacement)
    success('  ✓ Updated AHSPItemEditor props with mode and creation log')
  }
  
  // STEP 3.5: Add mode badge in list (find the item name display)
  // This is complex due to JSX structure, adding it as a comment instruction
  const badgeLocation = `                      <div className="font-semibold text-slate-800 text-sm leading-tight">{item.name}</div>`
  
  if (content.includes(badgeLocation)) {
    const badgeAddition = `                      <div className="font-semibold text-slate-800 text-sm leading-tight">{item.name}</div>
                      {/* Show creation mode badge */}
                      {item.creationMode && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline"
                            className={\`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 \${
                              item.creationMode === 'sni' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              item.creationMode === 'historical' ? 'bg-green-50 text-green-700 border-green-200' :
                              'bg-purple-50 text-purple-700 border-purple-200'
                            }\`}
                          >
                            {item.creationMode === 'sni' && <FileText className="h-2.5 w-2.5 mr-0.5" />}
                            {item.creationMode === 'historical' && <History className="h-2.5 w-2.5 mr-0.5" />}
                            {item.creationMode === 'custom' && <Wrench className="h-2.5 w-2.5 mr-0.5" />}
                            {item.creationMode}
                          </Badge>
                        </div>
                      )}`
    content = content.replace(badgeLocation, badgeAddition)
    success('  ✓ Added mode badge in list')
  }
  
  fs.writeFileSync(filePath, content, 'utf8')
  success('Step 3 completed!')
}

// Apply changes to ahsp.ts types
function fixAHSPTypes() {
  info('Step 4: Fixing ahsp.ts types...')
  const filePath = FILES.AHSP_TYPES
  let content = fs.readFileSync(filePath, 'utf8')
  
  // Find AHSPItem interface and add fields
  const interfaceSearch = `export interface AHSPItem {`
  
  if (content.includes(interfaceSearch)) {
    // Find the closing brace of the interface
    const startIndex = content.indexOf(interfaceSearch)
    const endIndex = content.indexOf('}', startIndex)
    const interfaceContent = content.substring(startIndex, endIndex)
    
    // Check if creationMode already exists
    if (!interfaceContent.includes('creationMode')) {
      const insertion = `  // Creation tracking
  creationMode?: 'sni' | 'custom' | 'historical'
  sourceReference?: string
}`
      
      content = content.substring(0, endIndex) + insertion + content.substring(endIndex + 1)
      success('  ✓ Added creationMode and sourceReference to AHSPItem')
    } else {
      info('  ℹ️  creationMode already exists in interface')
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8')
  success('Step 4 completed!')
}

// Apply changes to ahspStore.ts
function fixAHSPStore() {
  info('Step 5: Fixing ahspStore.ts...')
  const filePath = FILES.AHSP_STORE
  let content = fs.readFileSync(filePath, 'utf8')
  
  // STEP 5.1: Add import
  const importSearch = `import { supabase } from '../lib/supabaseClient'`
  if (content.includes(importSearch)) {
    const importReplacement = `import { supabase, getCreationLog } from '../lib/supabaseClient'`
    content = content.replace(importSearch, importReplacement)
    success('  ✓ Added getCreationLog import')
  }
  
  // STEP 5.2: Update fetchAHSPItems to load creation logs
  // Find the set state call in fetchAHSPItems
  const setState = `      set((state) => ({
        ahspItems: ahspItems,`
  
  if (content.includes(setState)) {
    // Add creation log loading before set state
    const loadLogsCode = `      // Load creation logs for each item
      const itemsWithMode = await Promise.all(
        ahspItems.map(async (item) => {
          try {
            const { data: log } = await getCreationLog(item.id)
            if (log) {
              return {
                ...item,
                creationMode: log.creation_mode,
                sourceReference: log.source_reference
              }
            }
          } catch (error) {
            // Log might not exist for old items
          }
          return item
        })
      )

      set((state) => ({
        ahspItems: itemsWithMode,`
    
    content = content.replace(setState, loadLogsCode)
    success('  ✓ Added creation log loading to fetchAHSPItems')
  }
  
  fs.writeFileSync(filePath, content, 'utf8')
  success('Step 5 completed!')
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(60))
  log('🚀 AHSP MODE INTEGRATION FIX', 'bold')
  log('Phase 1 & 2 Implementation Script', 'blue')
  console.log('='.repeat(60) + '\n')
  
  try {
    // Step 0: Create backups
    const backups = backupAll()
    info(`\nBackups saved to: ${BACKUP_DIR}\n`)
    
    // Step 1: Fix AHSPItemEditor
    fixAHSPItemEditor()
    
    // Step 2: Fix SupabaseClient
    fixSupabaseClient()
    
    // Step 3: Fix AHSPCatalog
    fixAHSPCatalog()
    
    // Step 4: Fix AHSP Types
    fixAHSPTypes()
    
    // Step 5: Fix AHSP Store
    fixAHSPStore()
    
    console.log('\n' + '='.repeat(60))
    success('✨ ALL CHANGES APPLIED SUCCESSFULLY!')
    console.log('='.repeat(60))
    
    console.log('\n📋 NEXT STEPS:\n')
    info('1. Review changes with: git diff')
    info('2. Test SNI preset loading')
    info('3. Verify creation log saving')
    info('4. Check mode badges in AHSP list')
    info('5. Run: npm run dev')
    
    console.log('\n⚠️  If anything goes wrong:')
    warn(`node scripts/rollback_ahsp_fix.mjs ${path.basename(BACKUP_DIR)}`)
    
    // Create rollback script
    createRollbackScript(BACKUP_DIR)
    
  } catch (err) {
    error('\n❌ ERROR OCCURRED!')
    console.error(err)
    error('\nRestoring from backups...')
    restore(backups)
    process.exit(1)
  }
}

// Create rollback script
function createRollbackScript(backupDir) {
  const scriptPath = path.join(ROOT, 'scripts', 'rollback_ahsp_fix.mjs')
  const rollbackScript = `#!/usr/bin/env node
/**
 * Rollback AHSP Mode Integration Fix
 * Usage: node scripts/rollback_ahsp_fix.mjs [backup-folder-name]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

const backupFolder = process.argv[2] || '${path.basename(backupDir)}'
const BACKUP_DIR = path.join(ROOT, 'backups', backupFolder)

console.log('🔄 Rolling back from:', BACKUP_DIR)

if (!fs.existsSync(BACKUP_DIR)) {
  console.error('❌ Backup directory not found:', BACKUP_DIR)
  process.exit(1)
}

// Copy all files from backup
function restoreDirectory(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      restoreDirectory(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
      console.log('✅ Restored:', path.relative(ROOT, destPath))
    }
  }
}

try {
  restoreDirectory(BACKUP_DIR, ROOT)
  console.log('\\n✅ Rollback completed successfully!')
} catch (err) {
  console.error('❌ Rollback failed:', err)
  process.exit(1)
}
`
  
  fs.writeFileSync(scriptPath, rollbackScript, 'utf8')
  fs.chmodSync(scriptPath, '755')
  success(`\n📝 Rollback script created: ${path.relative(ROOT, scriptPath)}`)
}

// Run main
main().catch(console.error)
