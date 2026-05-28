
// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const PROJECT = {
  name: 'CMPLNG VILLAGE', code: 'PRJ-2026-0019', status: 'Active',
  budget: 12800000000, ahspCount: 2475, wbsCount: 13, rabCount: 8, rapCount: 5,
  rabTotal: 210316500, rapBudget: 125117500, actualSpent: 48700000,
  phase: 'Construction', progress: 22, syncStatus: 'Synced'
}

const WBS_NODES = [
  { id:1, code:'1', name:'Pekerjaan Persiapan', level:0, expanded:true, rabLinked:0, budget:0 },
  { id:2, code:'1.1', name:'Mobilisasi', level:1, parentId:1, rabLinked:0, budget:0 },
  { id:3, code:'1.2', name:'Pembersihan Lahan', level:1, parentId:1, rabLinked:0, budget:0 },
  { id:4, code:'2', name:'Pekerjaan Tanah & Pondasi', level:0, expanded:true, rabLinked:4, budget:62283500 },
  { id:5, code:'2.1', name:'Galian Tanah', level:1, parentId:4, rabLinked:2, budget:23441500 },
  { id:6, code:'2.2', name:'Pasangan Pondasi Batu Kali', level:1, parentId:4, rabLinked:2, budget:38842000 },
  { id:7, code:'3', name:'Pekerjaan Struktur', level:0, expanded:true, rabLinked:2, budget:72155000 },
  { id:8, code:'3.1', name:'Sloof Beton', level:1, parentId:7, rabLinked:1, budget:23150000 },
  { id:9, code:'3.2', name:'Kolom & Ring Balok', level:1, parentId:7, rabLinked:1, budget:49005000 },
  { id:10, code:'4', name:'Pekerjaan Arsitektur', level:0, expanded:true, rabLinked:2, budget:89920000 },
  { id:11, code:'4.1', name:'Pasang Dinding Hebel', level:1, parentId:10, rabLinked:1, budget:44800000 },
  { id:12, code:'4.2', name:'Plester & aci', level:1, parentId:10, rabLinked:2, budget:45120000 },
  { id:13, code:'5', name:'Finishing', level:0, expanded:false, rabLinked:0, budget:0 },
]

const AHSP_ITEMS = [
  { id:1, no:2, cat:'A. ANGKUT MATERIAL', code:'1.4.1.9', name:'Mengangkut 1 m3 tanah lepas, jarak > 300 m s.d 400 m', unit:'M3', ver:'v1', mat:0, labor:93210, equip:0, subcon:0, linked:true },
  { id:2, no:3, cat:'A. ANGKUT MATERIAL', code:'1.4.1.12', name:'Mengangkut 1 m3 tanah lepas, jarak > 600 m tiap 100 m tambahan', unit:'M3', ver:'v1', mat:0, labor:30240, equip:0, subcon:0, linked:false },
  { id:3, no:4, cat:'A. ANGKUT MATERIAL', code:'1.4.1.6', name:'Mengangkut 1 m3 tanah lepas, jarak > 50 m s.d 100 m', unit:'M3', ver:'v1', mat:0, labor:37840, equip:0, subcon:0, linked:true },
  { id:4, no:5, cat:'A. ANGKUT MATERIAL', code:'1.4.1.2', name:'Mengangkut 1 m3 tanah lepas, jarak > 10 m s.d 20 m', unit:'M3', ver:'v1', mat:0, labor:24780, equip:0, subcon:0, linked:false },
  { id:5, no:6, cat:'A. ANGKUT MATERIAL', code:'1.4.2.5', name:'1 m3 Pembuangan tanah lumpur sejauh 5 km', unit:'M3', ver:'v1', mat:0, labor:141370, equip:4338, subcon:0, linked:false },
  { id:6, no:1, cat:'B. PEKERJAAN BETON', code:'2.1.1.1', name:'1 m3 Beton K-175 untuk sloof, termasuk bekisting', unit:'M3', ver:'v1', mat:756000, labor:125000, equip:45000, subcon:0, linked:true },
  { id:7, no:2, cat:'B. PEKERJAAN BETON', code:'2.1.1.2', name:'1 m3 Beton K-250 untuk kolom & ring balok', unit:'M3', ver:'v1', mat:892000, labor:145000, equip:52000, subcon:0, linked:true },
  { id:8, no:3, cat:'B. PEKERJAAN BETON', code:'2.1.2.1', name:'1 m2 Bekisting kolom kayu biasa, 2x pakai', unit:'M2', ver:'v1', mat:125000, labor:85000, equip:0, subcon:0, linked:false },
  { id:9, no:1, cat:'C. PASANGAN DINDING', code:'4.1.1.1', name:'1 m2 Pasangan bata ringan Hebel tebal 10 cm', unit:'M2', ver:'v1', mat:95000, labor:45000, equip:0, subcon:0, linked:true },
  { id:10, no:2, cat:'C. PASANGAN DINDING', code:'4.1.1.2', name:'1 m2 Plesteran 1:4 tebal 15 mm', unit:'M2', ver:'v1', mat:18500, labor:22000, equip:0, subcon:0, linked:true },
  { id:11, no:3, cat:'C. PASANGAN DINDING', code:'4.1.1.3', name:'1 m2 Acian semen Portland', unit:'M2', ver:'v1', mat:12000, labor:18000, equip:0, subcon:0, linked:true },
  { id:12, no:1, cat:'D. PEKERJAAN PONDASI', code:'2.2.1.1', name:'1 m3 Pasangan batu kali 1:4 untuk pondasi', unit:'M3', ver:'v1', mat:185000, labor:125000, equip:0, subcon:0, linked:true },
  { id:13, no:2, cat:'D. PEKERJAAN PONDASI', code:'2.2.1.2', name:'1 m3 Urugan pasir bawah pondasi, dipadatkan', unit:'M3', ver:'v1', mat:145000, labor:35000, equip:0, subcon:0, linked:false },
]

const RAB_ITEMS = [
  { id:1, wbs:'2.1', no:'2.1.01', cls:'A', code:'1.4.1.6', desc:'Angkut tanah lepas >50m sd 100m', vol:250, sat:'M3', unitPrice:37840, total:9460000, status:'published' },
  { id:2, wbs:'2.1', no:'2.1.02', cls:'A', code:'1.4.1.9', desc:'Angkut tanah lepas >300m sd 400m', vol:150, sat:'M3', unitPrice:93210, total:13981500, status:'published' },
  { id:3, wbs:'2.2', no:'2.2.01', cls:'A', code:'2.2.1.1', desc:'Pasangan batu kali 1:4 pondasi', vol:80, sat:'M3', unitPrice:310000, total:24800000, status:'published' },
  { id:4, wbs:'2.2', no:'2.2.02', cls:'B', code:'2.2.1.2', desc:'Urugan pasir bawah pondasi', vol:95, sat:'M3', unitPrice:180000, total:17100000, status:'draft' },
  { id:5, wbs:'3.1', no:'3.1.01', cls:'A', code:'2.1.1.1', desc:'Beton K-175 sloof + bekisting', vol:25, sat:'M3', unitPrice:926000, total:23150000, status:'published' },
  { id:6, wbs:'3.2', no:'3.2.01', cls:'A', code:'2.1.1.2', desc:'Beton K-250 kolom & ring balok', vol:45, sat:'M3', unitPrice:1089000, total:49005000, status:'published' },
  { id:7, wbs:'4.1', no:'4.1.01', cls:'B', code:'4.1.1.1', desc:'Pasang bata ringan Hebel t=10cm', vol:320, sat:'M2', unitPrice:140000, total:44800000, status:'published' },
  { id:8, wbs:'4.2', no:'4.2.01', cls:'B', code:'4.1.1.2', desc:'Plesteran 1:4 t=15mm', vol:640, sat:'M2', unitPrice:40500, total:25920000, status:'draft' },
]

const RAP_ITEMS = [
  { id:1, name:'Pekerjaan Galian & Angkut Tanah', wbs:'2.1', budget:23441500, committed:18000000, actual:15200000, remaining:8241500, progress:65, cpi:1.05, status:'on-track' },
  { id:2, name:'Pasangan Pondasi Batu Kali', wbs:'2.2', budget:24800000, committed:24800000, actual:23100000, remaining:1700000, progress:93, cpi:0.92, status:'warning' },
  { id:3, name:'Sloof Beton K-175', wbs:'3.1', budget:23150000, committed:15000000, actual:10400000, remaining:12750000, progress:45, cpi:1.12, status:'on-track' },
  { id:4, name:'Kolom & Ring Balok K-250', wbs:'3.2', budget:49005000, committed:8500000, actual:0, remaining:49005000, progress:0, cpi:null, status:'planned' },
  { id:5, name:'Pasang Dinding Hebel', wbs:'4.1', budget:44800000, committed:0, actual:0, remaining:44800000, progress:0, cpi:null, status:'planned' },
]

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const fIDR = (n, short=false) => {
  if (n === null || n === undefined) return '—'
  if (short) {
    if (n >= 1e9) return `Rp ${(n/1e9).toFixed(1)}B`
    if (n >= 1e6) return `Rp ${(n/1e6).toFixed(0)}M`
    return `Rp ${(n/1e3).toFixed(0)}K`
  }
  return 'Rp ' + n.toLocaleString('id-ID')
}
const pct = (v, t) => t > 0 ? Math.round(v/t*100) : 0

// ─── ICON ATOMS ───────────────────────────────────────────────────────────────
const PATHS = {
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  'check-circle': 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  'alert-triangle': 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  'alert-circle': 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 8v4M12 16h.01',
  'git-branch': 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  dollar: 'M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6',
  'trending-up': 'M22 7 13.5 15.5 8.5 10.5 2 17M22 7h-6M22 7v6',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  table: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
  plus: 'M12 5v14M5 12h14',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  'refresh-cw': 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  'bar-chart': 'M12 20V10M18 20V4M6 20v-4',
  columns: 'M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18',
  maximize: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  layout: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM3 9h18M9 21V9',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
}

const I = ({ name, size=14, cls='' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <path d={PATHS[name] || ''} />
  </svg>
)

// ─── SHARED ATOMS ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    'on-track': ['bg-emerald-100 text-emerald-700', 'On Track'],
    'warning':  ['bg-amber-100 text-amber-700', 'Warning'],
    'over-budget': ['bg-red-100 text-red-700', 'Over Budget'],
    'planned':  ['bg-slate-100 text-slate-600', 'Planned'],
    'published':['bg-blue-100 text-blue-700', 'Published'],
    'draft':    ['bg-amber-100 text-amber-700', 'Draft'],
    'not-started':['bg-slate-100 text-slate-500', 'Belum Mulai'],
  }
  const [cls, label] = map[status] || ['bg-slate-100 text-slate-500', status]
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cls}`}>{label}</span>
}

const MiniProgress = ({ value, max=100, variant='blue' }) => {
  const p = Math.min(100, Math.round((value/max)*100))
  const colors = { blue:'bg-blue-500', green:'bg-emerald-500', amber:'bg-amber-500', red:'bg-red-500', slate:'bg-slate-300' }
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[variant]||colors.blue}`} style={{width:`${p}%`}} />
      </div>
      <span className="text-[10px] font-mono text-slate-500 w-7 text-right">{p}%</span>
    </div>
  )
}

const CpiChip = ({ value }) => {
  if (!value) return <span className="text-slate-400 text-xs">—</span>
  const cls = value >= 1 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${cls}`}>{value.toFixed(2)}</span>
}

// ─── BUDGET HEALTH BAR ────────────────────────────────────────────────────────
const BudgetHealthBar = ({ compact=false }) => {
  const rabPct = pct(PROJECT.rabTotal, PROJECT.budget)
  const rapPct = pct(PROJECT.rapBudget, PROJECT.budget)
  const actPct = pct(PROJECT.actualSpent, PROJECT.budget)
  return (
    <div className={`grid grid-cols-4 gap-px bg-slate-200 border-b border-slate-200 ${compact ? 'text-xs' : ''}`}>
      {[
        { label:'PROJECT BUDGET', val:fIDR(PROJECT.budget,true), sub:'anggaran ditetapkan', color:'text-blue-600', dot:'bg-blue-500' },
        { label:'RAB TOTAL', val:rabPct>0?fIDR(PROJECT.rabTotal,true):'—', sub:`${rabPct}% dari Budget`, color:'text-slate-700', dot:'bg-slate-400' },
        { label:'RAP PLANNED', val:rapPct>0?fIDR(PROJECT.rapBudget,true):'—', sub:`${rapPct}% dari Budget`, color:'text-slate-700', dot:'bg-slate-400' },
        { label:'ACTUAL SPENT', val:actPct>0?fIDR(PROJECT.actualSpent,true):'—', sub:actPct>0?`${actPct}% Terserap`:'belum ada data', color:'text-slate-700', dot:'bg-slate-400' },
      ].map(({ label, val, sub, color, dot }) => (
        <div key={label} className="bg-white px-4 py-2.5 flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
            <div className={`font-bold ${compact?'text-sm':'text-base'} ${color} font-mono`}>{val}</div>
            <div className="text-[10px] text-slate-400">{sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── AHSP TABLE ───────────────────────────────────────────────────────────────
const AHSPTableContent = ({ compact=false, onAddToRAB }) => {
  const cats = [...new Set(AHSP_ITEMS.map(i => i.cat))]
  const th = compact ? 'px-3 py-1.5' : 'px-4 py-2.5'
  const td = compact ? 'px-3 py-2' : 'px-4 py-3'
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-900 text-slate-300">
            <th className={`${th} text-left w-8`}><input type="checkbox" className="rounded border-slate-600" /></th>
            <th className={`${th} text-left w-10`}>No.</th>
            <th className={`${th} text-left min-w-[280px]`}>Deskripsi</th>
            <th className={`${th} text-center w-14`}>Unit</th>
            <th className={`${th} text-right w-28`}>MATERIAL</th>
            <th className={`${th} text-right w-28`}>LABOR</th>
            <th className={`${th} text-right w-28`}>EQUIPMENT</th>
            <th className={`${th} text-right w-24`}>SUBCON</th>
            <th className={`${th} text-right w-32`}>TOTAL HARGA</th>
            <th className={`${th} text-center w-20`}>AKSI</th>
          </tr>
        </thead>
        <tbody>
          {cats.map(cat => {
            const catItems = AHSP_ITEMS.filter(i => i.cat === cat)
            return (
              <React.Fragment key={cat}>
                <tr className="bg-slate-800 text-slate-200">
                  <td colSpan={10} className={`${td} font-bold text-[11px] tracking-wide`}>{cat}</td>
                </tr>
                {catItems.map(item => {
                  const total = item.mat + item.labor + item.equip + item.subcon
                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50 group transition-colors">
                      <td className={`${td} text-center`}><input type="checkbox" className="rounded" /></td>
                      <td className={`${td} text-slate-400 font-mono`}>{item.no}</td>
                      <td className={`${td}`}>
                        <div className="font-medium text-slate-800 leading-snug">{item.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="bg-blue-100 text-blue-700 rounded px-1.5 py-0 text-[10px] font-bold">{item.ver}</span>
                          <span className="text-slate-400 text-[10px] font-mono">{item.code}</span>
                          {item.linked && <span className="bg-emerald-100 text-emerald-700 rounded px-1.5 py-0 text-[10px] font-bold">RAB↗</span>}
                        </div>
                      </td>
                      <td className={`${td} text-center text-slate-600 font-medium`}>{item.unit}</td>
                      <td className={`${td} text-right font-mono text-slate-700`}>{item.mat > 0 ? 'Rp '+item.mat.toLocaleString('id-ID') : <span className="text-slate-300">—</span>}</td>
                      <td className={`${td} text-right font-mono text-orange-600`}>{item.labor > 0 ? 'Rp '+item.labor.toLocaleString('id-ID') : <span className="text-slate-300">—</span>}</td>
                      <td className={`${td} text-right font-mono text-blue-600`}>{item.equip > 0 ? 'Rp '+item.equip.toLocaleString('id-ID') : <span className="text-slate-300">—</span>}</td>
                      <td className={`${td} text-right font-mono text-purple-600`}>{item.subcon > 0 ? 'Rp '+item.subcon.toLocaleString('id-ID') : <span className="text-slate-300">—</span>}</td>
                      <td className={`${td} text-right font-mono font-semibold text-slate-900`}>Rp {total.toLocaleString('id-ID')}</td>
                      <td className={`${td} text-center`}>
                        <button onClick={() => onAddToRAB && onAddToRAB(item)} className="opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 mx-auto">
                          <span>→ RAB</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot className="sticky bottom-0">
          <tr className="bg-slate-900 text-white">
            <td colSpan={4} className={`${td} font-bold text-[11px] uppercase tracking-wider`}>GRAND TOTAL KATALOG</td>
            <td className={`${td} text-right font-mono font-bold text-blue-300`}>Rp 3.092.957.238</td>
            <td className={`${td} text-right font-mono font-bold text-orange-300`}>Rp 406.760.989</td>
            <td className={`${td} text-right font-mono font-bold text-blue-300`}>Rp 118.397.247</td>
            <td className={`${td} text-right font-mono font-bold`}>Rp 0</td>
            <td className={`${td} text-right font-mono font-bold text-emerald-300`}>Rp 3.618.115.474</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── WBS TREE ─────────────────────────────────────────────────────────────────
const WBSTree = ({ selected, onSelect, compact=false }) => {
  const [expanded, setExpanded] = React.useState({ 4:true, 7:true, 10:true })
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))
  return (
    <div className="overflow-y-auto flex-1">
      {WBS_NODES.filter(n => n.level === 0).map(root => (
        <div key={root.id}>
          <button onClick={() => toggle(root.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 transition-colors ${selected===root.id?'bg-blue-50 border-l-2 border-blue-600':''}`}>
            <I name={expanded[root.id]?'chevron-down':'chevron-right'} size={12} cls="text-slate-400 flex-shrink-0" />
            <span className="font-bold text-[11px] uppercase tracking-wide text-slate-700">{root.code}. {root.name}</span>
            {root.rabLinked > 0 && <span className="ml-auto bg-blue-100 text-blue-700 rounded text-[10px] font-bold px-1.5">{root.rabLinked}</span>}
          </button>
          {expanded[root.id] && WBS_NODES.filter(n => n.parentId === root.id).map(child => (
            <button key={child.id} onClick={() => onSelect(child.id)} className={`w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left hover:bg-slate-50 transition-colors ${selected===child.id?'bg-blue-50 border-l-2 border-blue-600 text-blue-700':''}`}>
              <span className="text-[11px] font-mono text-slate-400 w-8 flex-shrink-0">{child.code}</span>
              <span className="text-[11px] text-slate-700 truncate">{child.name}</span>
              {child.rabLinked > 0 ? (
                <span className="ml-auto text-[10px] font-mono text-emerald-600 flex-shrink-0">{fIDR(child.budget||0, true)}</span>
              ) : (
                <span className="ml-auto text-[10px] text-slate-300 flex-shrink-0">0 item</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── RAB TABLE ────────────────────────────────────────────────────────────────
const RABTableContent = ({ wbsFilter=null }) => {
  const items = wbsFilter ? RAB_ITEMS.filter(i => i.wbs === wbsFilter || i.wbs.startsWith(wbsFilter+'.')) : RAB_ITEMS
  const total = items.reduce((s,i) => s+i.total, 0)
  if (items.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 text-slate-400">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><I name="plus" size={20} cls="text-slate-400" /></div>
      <div className="text-center">
        <div className="font-semibold text-slate-500 text-sm">Belum ada item RAB</div>
        <div className="text-xs mt-1">Pilih node WBS lalu klik "+ Add Item" atau tambah dari katalog AHSP</div>
      </div>
      <button className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
        <I name="plus" size={13} /> Tambah dari Katalog AHSP
      </button>
    </div>
  )
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-800 text-slate-200">
            <th className="px-3 py-2 text-left w-8"><input type="checkbox" className="rounded border-slate-600"/></th>
            <th className="px-3 py-2 text-left font-semibold w-20">No.</th>
            <th className="px-3 py-2 text-center font-semibold w-10">CLS</th>
            <th className="px-3 py-2 text-left font-semibold min-w-[200px]">Deskripsi & Spesifikasi</th>
            <th className="px-3 py-2 text-right font-semibold w-20">Volume</th>
            <th className="px-3 py-2 text-center font-semibold w-14">SAT</th>
            <th className="px-3 py-2 text-right font-semibold w-32">Unit Price</th>
            <th className="px-3 py-2 text-right font-semibold w-36">TOTAL AMOUNT</th>
            <th className="px-3 py-2 text-center font-semibold w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
              <td className="px-3 py-2"><input type="checkbox" className="rounded"/></td>
              <td className="px-3 py-2 font-mono text-slate-500">{item.no}</td>
              <td className="px-3 py-2 text-center">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.cls==='A'?'bg-red-100 text-red-700':item.cls==='B'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>{item.cls}</span>
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800">{item.desc}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.code} · WBS {item.wbs}</div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-slate-700">{item.vol.toLocaleString('id-ID')}</td>
              <td className="px-3 py-2 text-center text-slate-600">{item.sat}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-700">{fIDR(item.unitPrice)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{fIDR(item.total)}</td>
              <td className="px-3 py-2 text-center"><StatusBadge status={item.status} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0">
          <tr className="bg-slate-800 text-white">
            <td colSpan={7} className="px-3 py-2 font-bold text-[11px] uppercase tracking-wider">GRAND TOTAL ESTIMATED</td>
            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-300">{fIDR(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── RAP TABLE ────────────────────────────────────────────────────────────────
const RAPTableContent = () => (
  <div className="flex-1 overflow-auto">
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 z-10">
        <tr className="bg-slate-800 text-slate-200">
          <th className="px-3 py-2 text-left font-semibold min-w-[180px]">Item Name</th>
          <th className="px-3 py-2 text-center font-semibold w-16">WBS</th>
          <th className="px-3 py-2 text-right font-semibold w-32">Total Budget</th>
          <th className="px-3 py-2 text-right font-semibold w-32">Committed</th>
          <th className="px-3 py-2 text-right font-semibold w-32">Actual Cost</th>
          <th className="px-3 py-2 text-right font-semibold w-32">Remaining</th>
          <th className="px-3 py-2 text-center font-semibold w-28">Progress</th>
          <th className="px-3 py-2 text-center font-semibold w-16">CPI</th>
          <th className="px-3 py-2 text-center font-semibold w-24">Status</th>
        </tr>
      </thead>
      <tbody>
        {RAP_ITEMS.map(item => (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
            <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
            <td className="px-3 py-2 text-center font-mono text-slate-500 text-[10px]">{item.wbs}</td>
            <td className="px-3 py-2 text-right font-mono text-slate-700">{fIDR(item.budget)}</td>
            <td className="px-3 py-2 text-right font-mono text-amber-600">{fIDR(item.committed)}</td>
            <td className="px-3 py-2 text-right font-mono text-red-600">{item.actual > 0 ? fIDR(item.actual) : <span className="text-slate-300">—</span>}</td>
            <td className="px-3 py-2 text-right font-mono text-emerald-600">{fIDR(item.remaining)}</td>
            <td className="px-3 py-2"><MiniProgress value={item.progress} variant={item.progress>80?'amber':item.progress>0?'blue':'slate'} /></td>
            <td className="px-3 py-2 text-center"><CpiChip value={item.cpi} /></td>
            <td className="px-3 py-2 text-center"><StatusBadge status={item.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ─── EVM PANEL ────────────────────────────────────────────────────────────────
const EVMPanel = () => {
  const totalBudget = RAP_ITEMS.reduce((s,i) => s+i.budget, 0)
  const totalActual = RAP_ITEMS.reduce((s,i) => s+i.actual, 0)
  const activeItems = RAP_ITEMS.filter(i=>i.actual>0)
  const avgProgress = activeItems.length > 0 ? Math.round(activeItems.reduce((s,i) => s+i.progress, 0) / activeItems.length) : 0
  const ev = (avgProgress/100) * totalBudget
  const cpi = totalActual > 0 ? (ev/totalActual) : 1
  const spi = 0.88
  const eac = totalBudget / cpi
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">EVM Dashboard</div>
      {[
        { label:'CPI', value:cpi.toFixed(2), sub:'Cost Performance', good: cpi >= 1 },
        { label:'SPI', value:spi.toFixed(2), sub:'Schedule Performance', good: spi >= 1 },
        { label:'EAC', value:fIDR(eac, true), sub:'Estimate at Completion', good: eac <= totalBudget },
        { label:'Progress', value:`${avgProgress}%`, sub:'Rata-rata Kemajuan Fisik', good: avgProgress >= 20 },
      ].map(({ label, value, sub, good }) => (
        <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100">
          <div>
            <div className="text-[11px] font-bold text-slate-700">{label}</div>
            <div className="text-[10px] text-slate-400">{sub}</div>
          </div>
          <div className={`font-mono font-bold text-sm ${good?'text-emerald-600':'text-red-500'}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}

Object.assign(window, {
  PROJECT, WBS_NODES, AHSP_ITEMS, RAB_ITEMS, RAP_ITEMS,
  fIDR, pct, I,
  StatusBadge, MiniProgress, CpiChip,
  BudgetHealthBar, AHSPTableContent, WBSTree, RABTableContent, RAPTableContent, EVMPanel
})
