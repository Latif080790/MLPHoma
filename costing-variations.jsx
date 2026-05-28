
// ─── SHARED PIPELINE NAV TABS ─────────────────────────────────────────────────
const TABS = [
  { id:'AHSP', label:'AHSP', count:2475, icon:'table', status:'done' },
  { id:'WBS',  label:'WBS',  count:13,   icon:'git-branch', status:'done' },
  { id:'RAB',  label:'RAB',  count:8,    icon:'dollar', status:'warn' },
  { id:'RAP',  label:'RAP',  count:5,    icon:'trending-up', status:'warn' },
  { id:'Resource', label:'Resource', count:null, icon:'wrench', status:'pending' },
]

const TabStatus = ({ status }) => {
  if (status === 'done')    return <I name="check-circle" size={12} cls="text-emerald-500 flex-shrink-0" />
  if (status === 'warn')    return <I name="alert-triangle" size={12} cls="text-amber-500 flex-shrink-0" />
  return <span className="w-3 h-3 rounded-full border-2 border-slate-300 flex-shrink-0 inline-block" />
}

// ─── VARIATION A: UNIFIED RAIL ────────────────────────────────────────────────
const VariationA = ({ tab, setTab }) => {
  const [wbsSelected, setWbsSelected] = React.useState(5)
  const [addToRABItem, setAddToRABItem] = React.useState(null)
  const selectedWbsNode = WBS_NODES.find(n => n.id === wbsSelected)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-['Inter',sans-serif]">
      {/* Left Rail */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Project</div>
          <div className="font-bold text-sm text-slate-900 mt-0.5 truncate">{PROJECT.name}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono text-slate-500">{PROJECT.code}</span>
            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase px-1.5 rounded">{PROJECT.status}</span>
          </div>
        </div>

        <div className="px-3 pt-3 pb-1">
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">PIPELINE COSTING</div>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-left transition-all ${tab===t.id ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}>
              <I name={t.icon} size={13} cls={tab===t.id?'text-blue-200':'text-slate-400'} />
              <span className={`text-[11px] font-semibold flex-1 ${tab===t.id?'text-white':'text-slate-700'}`}>{t.label}</span>
              {t.count !== null && (
                <span className={`text-[10px] font-mono font-bold rounded px-1.5 py-0.5 ${tab===t.id?'bg-blue-500 text-blue-100':t.status==='warn'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-500'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-2 border-t border-slate-100 mt-1">
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">BUDGET STATUS</div>
          {[
            { label:'Budget Terpakai RAB', val:pct(PROJECT.rabTotal, PROJECT.budget), color:'bg-blue-500' },
            { label:'Terserap RAP', val:pct(PROJECT.rapBudget, PROJECT.budget), color:'bg-amber-500' },
            { label:'Actual Spent', val:pct(PROJECT.actualSpent, PROJECT.budget), color:'bg-emerald-500' },
          ].map(g => (
            <div key={g.label} className="mb-2.5">
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>{g.label}</span>
                <span className="font-mono font-bold">{g.val}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${g.color}`} style={{width:`${g.val}%`}} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden border-t border-slate-100 mt-1">
          <div className="px-4 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">WBS STRUKTUR</div>
          <div className="overflow-y-auto max-h-48">
            {WBS_NODES.filter(n => n.level === 0).map(root => (
              <div key={root.id}>
                <div className="px-4 py-1 text-[10px] font-bold text-slate-600 uppercase">{root.code}. {root.name.length > 22 ? root.name.slice(0,22)+'…' : root.name}</div>
                {WBS_NODES.filter(n => n.parentId === root.id).map(child => (
                  <button key={child.id} onClick={() => { setWbsSelected(child.id); setTab('WBS') }}
                    className={`w-full text-left pl-6 pr-3 py-0.5 text-[10px] hover:bg-slate-50 transition-colors flex items-center justify-between ${wbsSelected===child.id?'text-blue-600 font-semibold':' text-slate-500'}`}>
                    <span className="truncate">{child.name}</span>
                    {child.rabLinked > 0 && <span className="text-[9px] font-mono text-emerald-600 ml-1">✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-slate-400">Synced · Pipeline 2/4</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-11 bg-white border-b border-slate-200 flex items-center px-5 gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Costing</span><span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">{TABS.find(t=>t.id===tab)?.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {tab === 'AHSP' && <>
              <button className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"><I name="download" size={12} />Ekspor</button>
              <button className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"><I name="upload" size={12} />Impor</button>
              <button className="flex items-center gap-1.5 text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all"><I name="plus" size={12} />Tambah Item</button>
            </>}
            {tab === 'RAB' && <>
              <button className="flex items-center gap-1.5 text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200"><I name="columns" size={12} />Kolom</button>
              <button className="flex items-center gap-1.5 text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200"><I name="layers" size={12} />vBaseline</button>
              <button className="flex items-center gap-1.5 text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200"><I name="activity" size={12} />Analyze Drift</button>
              <button className="flex items-center gap-1.5 text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200"><I name="lock" size={12} />Lock Baseline</button>
              <button className="flex items-center gap-1.5 text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700"><I name="plus" size={12} />Add Item</button>
            </>}
          </div>
        </div>

        <BudgetHealthBar compact={true} />

        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'AHSP' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-0 px-5 pt-3 pb-0 border-b border-slate-200 bg-white flex-shrink-0">
                {['AHSP Items','DKH Resources','Analytics','Settings'].map(st => (
                  <button key={st} className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${st==='AHSP Items'?'border-blue-600 text-blue-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>{st}</button>
                ))}
                <div className="ml-auto flex items-center gap-3 pb-2">
                  <div className="relative"><input placeholder="Cari item AHSP..." className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-48 focus:outline-none focus:border-blue-400" /><I name="search" size={12} cls="absolute left-2.5 top-2 text-slate-400" /></div>
                </div>
              </div>
              <AHSPTableContent onAddToRAB={setAddToRABItem} />
            </div>
          )}
          {tab === 'WBS' && (
            <div className="flex h-full">
              <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">WBS Structure</span>
                  <span className="ml-auto text-[10px] font-mono text-slate-400">13 nodes</span>
                </div>
                <WBSTree selected={wbsSelected} onSelect={setWbsSelected} />
              </div>
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-3 flex-shrink-0">
                  <span className="font-semibold text-sm text-slate-800">{selectedWbsNode ? selectedWbsNode.name : 'Rencana Anggaran Biaya (RAB)'}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button className="flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200"><I name="layers" size={12} />vBaseline</button>
                    <button className="flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200"><I name="upload" size={12} />Import</button>
                    <button className="flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200"><I name="activity" size={12} />Analyze Drift</button>
                    <button className="flex items-center gap-1.5 text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700"><I name="plus" size={12} />Add Item</button>
                  </div>
                </div>
                <RABTableContent wbsFilter={selectedWbsNode?.code} />
                <div className="px-4 py-2 bg-white border-t border-slate-200 flex items-center gap-4 text-[10px] text-slate-500 flex-shrink-0">
                  <span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> CLASS A: 80% COST BASELINE
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> CLASS B: 15% COST BASELINE
                  <span className="w-3 h-3 rounded-full bg-slate-300 inline-block" /> CLASS C: NON-CRITICAL
                  <span className="ml-auto font-mono font-bold text-slate-700">GRAND TOTAL: {fIDR(RAB_ITEMS.filter(i => selectedWbsNode ? i.wbs.startsWith(selectedWbsNode.code) : true).reduce((s,i)=>s+i.total,0))}</span>
                </div>
              </div>
            </div>
          )}
          {tab === 'RAB' && (
            <div className="flex flex-col h-full">
              <div className="grid grid-cols-4 gap-px bg-slate-200 flex-shrink-0 border-b border-slate-200">
                {[['TOTAL ITEMS', RAB_ITEMS.length, 'text-slate-900'],['SUBTOTAL', fIDR(RAB_ITEMS.reduce((s,i)=>s+i.total,0)), 'text-slate-900'],['OH + PROFIT + TAX', 'Rp 0', 'text-slate-500'],['FINAL TOTAL', fIDR(RAB_ITEMS.reduce((s,i)=>s+i.total,0)), 'text-blue-600']].map(([label,val,cls]) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
                    <div className={`font-bold text-xl font-mono mt-0.5 ${cls}`}>{val}</div>
                  </div>
                ))}
              </div>
              <RABTableContent />
            </div>
          )}
          {tab === 'RAP' && (
            <div className="flex flex-col h-full">
              <div className="grid grid-cols-5 gap-px bg-slate-200 flex-shrink-0 border-b border-slate-200">
                {[['TOTAL BUDGET',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.budget,0),true),'text-slate-900'],
                  ['COMMITTED',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.committed,0),true),'text-amber-600'],
                  ['ACTUAL COST',fIDR(PROJECT.actualSpent,true),'text-red-600'],
                  ['REMAINING',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.budget,0)-PROJECT.actualSpent,true),'text-emerald-600'],
                  ['EFISIENSI','CPI 1.04','text-emerald-600']].map(([label,val,cls]) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
                    <div className={`font-bold text-lg font-mono mt-0.5 ${cls}`}>{val}</div>
                  </div>
                ))}
              </div>
              <RAPTableContent />
            </div>
          )}
          {tab === 'Resource' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <I name="wrench" size={40} cls="mx-auto mb-3 opacity-20" />
                <div className="font-semibold text-slate-500">Belum ada item RAP</div>
                <div className="text-xs mt-1">Sync RAP dari RAB terlebih dahulu</div>
                <button className="mt-4 text-xs border border-slate-200 px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-50" onClick={() => setTab('RAP')}>→ Buka RAP</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── VARIATION B: DENSE WORKSHEET ────────────────────────────────────────────
const VariationB = ({ tab, setTab }) => {
  const [kpiOpen, setKpiOpen] = React.useState(true)
  const [wbsSelected, setWbsSelected] = React.useState(null)
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white font-['Inter',sans-serif]">
      <div className="h-9 bg-slate-900 flex items-center px-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center"><I name="layers" size={11} cls="text-white" /></div>
          <span className="text-xs font-bold text-white">MLPHoma</span>
          <span className="text-slate-600 text-xs">/</span>
          <span className="text-xs text-slate-300">Project Costing</span>
          <span className="text-slate-600 text-xs">/</span>
          <span className="text-xs text-white font-semibold">{PROJECT.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-400">
          <span className="font-mono">{PROJECT.code}</span>
          <span className="bg-emerald-900 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase">{PROJECT.status}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{PROJECT.syncStatus}</span>
          <span className="bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded font-bold">Pipeline 2/4</span>
        </div>
      </div>

      <div className="h-10 bg-slate-800 border-b border-slate-700 flex items-center flex-shrink-0 overflow-x-auto">
        <div className="flex items-center">
          {TABS.map((t, idx) => (
            <React.Fragment key={t.id}>
              <button onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 h-10 text-xs font-semibold transition-all flex-shrink-0 border-b-2 ${tab===t.id ? 'text-white border-blue-400 bg-slate-700' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-700/50'}`}>
                <I name={t.icon} size={12} />
                <span>{t.label}</span>
                {t.count !== null && <span className={`text-[10px] font-mono rounded px-1.5 py-0.5 ${tab===t.id?'bg-blue-600 text-white':t.status==='warn'?'bg-amber-500/20 text-amber-400':'bg-slate-700 text-slate-400'}`}>{t.count}</span>}
                <TabStatus status={t.status} />
              </button>
              {idx < TABS.length-1 && <span className="text-slate-600 text-xs flex-shrink-0">›</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="ml-auto px-4 flex items-center gap-2">
          {tab === 'AHSP' && <>
            <button className="text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-700 flex items-center gap-1.5"><I name="filter" size={11}/>Filter</button>
            <button className="text-[11px] bg-blue-600 text-white font-semibold px-3 py-1 rounded flex items-center gap-1.5"><I name="plus" size={11}/>Tambah Item</button>
          </>}
          {(tab === 'RAB' || tab === 'WBS') && <>
            <button className="text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-700 flex items-center gap-1.5"><I name="layers" size={11}/>vBaseline</button>
            <button className="text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-700 flex items-center gap-1.5"><I name="activity" size={11}/>Analyze Drift</button>
            <button className="text-[11px] bg-blue-600 text-white font-semibold px-3 py-1 rounded flex items-center gap-1.5"><I name="plus" size={11}/>Add Item</button>
          </>}
        </div>
      </div>

      <div className="flex-shrink-0">
        <div className="flex items-center gap-0 bg-slate-100 border-b border-slate-200">
          <button onClick={() => setKpiOpen(!kpiOpen)} className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-slate-500 hover:text-slate-700 flex-shrink-0">
            <I name={kpiOpen?'chevron-down':'chevron-right'} size={10} />
            <span className="font-bold uppercase tracking-wider">Budget Health</span>
          </button>
          {!kpiOpen && (
            <div className="flex items-center gap-6 px-4 text-[11px]">
              <span className="text-slate-500">Budget: <strong className="text-blue-600 font-mono">{fIDR(PROJECT.budget,true)}</strong></span>
              <span className="text-slate-500">RAB: <strong className="text-slate-700 font-mono">{pct(PROJECT.rabTotal,PROJECT.budget)}%</strong></span>
              <span className="text-slate-500">Actual: <strong className="text-emerald-600 font-mono">{fIDR(PROJECT.actualSpent,true)}</strong></span>
            </div>
          )}
        </div>
        {kpiOpen && <BudgetHealthBar compact={true} />}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'AHSP' && <AHSPTableContent compact={true} />}
        {tab === 'WBS' && (
          <div className="flex h-full">
            <div className="w-52 border-r border-slate-200 flex flex-col bg-slate-50">
              <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>WBS Structure</span><span className="text-slate-400">13 nodes</span>
              </div>
              <WBSTree selected={wbsSelected} onSelect={setWbsSelected} compact={true} />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 bg-white border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-3">
                <span>Rencana Anggaran Biaya (RAB)</span>
                {wbsSelected && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono text-[10px]">{WBS_NODES.find(n=>n.id===wbsSelected)?.name}</span>}
              </div>
              <RABTableContent wbsFilter={WBS_NODES.find(n=>n.id===wbsSelected)?.code} />
            </div>
          </div>
        )}
        {tab === 'RAB' && (
          <div className="flex flex-col h-full">
            <div className="grid grid-cols-4 gap-px bg-slate-200 flex-shrink-0">
              {[['TOTAL ITEMS', RAB_ITEMS.length],['SUBTOTAL', fIDR(RAB_ITEMS.reduce((s,i)=>s+i.total,0))],['OH + PROFIT + TAX', 'Rp 0'],['FINAL TOTAL', fIDR(RAB_ITEMS.reduce((s,i)=>s+i.total,0))]].map(([l,v]) => (
                <div key={l} className="bg-white px-4 py-2.5"><div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{l}</div><div className="font-bold text-lg font-mono mt-0.5 text-slate-900">{v}</div></div>
              ))}
            </div>
            <RABTableContent />
          </div>
        )}
        {tab === 'RAP' && (
          <div className="flex flex-col h-full">
            <div className="grid grid-cols-5 gap-px bg-slate-200 flex-shrink-0">
              {[['TOTAL BUDGET',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.budget,0))],['COMMITTED',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.committed,0))],['ACTUAL COST',fIDR(PROJECT.actualSpent)],['REMAINING',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.budget,0)-PROJECT.actualSpent)],['EFISIENSI (CPI)','1.04']].map(([l,v]) => (
                <div key={l} className="bg-white px-3 py-2.5"><div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{l}</div><div className="font-bold text-sm font-mono mt-0.5 text-slate-900">{v}</div></div>
              ))}
            </div>
            <RAPTableContent />
          </div>
        )}
        {tab === 'Resource' && (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center"><I name="wrench" size={32} cls="mx-auto mb-2 opacity-20" /><div className="text-sm font-medium">No Data Available</div></div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── VARIATION C: MULTI-PANE COMPARISON ──────────────────────────────────────
const VariationC = ({ tab, setTab }) => {
  const [wbsSelected, setWbsSelected] = React.useState(5)
  const selNode = WBS_NODES.find(n => n.id === wbsSelected)
  const selRab = RAB_ITEMS.filter(i => selNode ? i.wbs === selNode.code || i.wbs.startsWith(selNode.code+'.') : true)
  const selRap = RAP_ITEMS.filter(i => selNode ? i.wbs === selNode.code || i.wbs.startsWith(selNode.code+'.') : true)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-900 font-['Inter',sans-serif]">
      <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center px-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center"><I name="layers" size={12} cls="text-white" /></div>
          <span className="text-xs font-black text-white tracking-wide">MLPHoma</span>
          <span className="text-slate-600">·</span>
          <span className="text-xs font-semibold text-blue-400">{PROJECT.name}</span>
        </div>
        <div className="flex items-center gap-1 ml-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${tab===t.id?'bg-blue-600 text-white':'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              {t.count !== null && <span className="font-mono">{t.count}</span>}
              <span>{t.label}</span>
              <TabStatus status={t.status} />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Synced</span>
          <span className="bg-amber-900/50 text-amber-400 font-bold px-2 py-0.5 rounded">Pipeline 2/4</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-slate-800 border-b border-slate-700 flex-shrink-0">
        {[
          { label:'PROJECT BUDGET', val:fIDR(PROJECT.budget,true), sub:'anggaran', c:'text-blue-400' },
          { label:'RAB TOTAL', val:fIDR(PROJECT.rabTotal,true), sub:`${pct(PROJECT.rabTotal,PROJECT.budget)}% dari Budget`, c:'text-slate-300' },
          { label:'RAP PLANNED', val:fIDR(PROJECT.rapBudget,true), sub:`${pct(PROJECT.rapBudget,PROJECT.budget)}% dari Budget`, c:'text-amber-400' },
          { label:'ACTUAL SPENT', val:fIDR(PROJECT.actualSpent,true), sub:`${pct(PROJECT.actualSpent,PROJECT.budget)}% Terserap`, c:'text-emerald-400' },
        ].map(({ label, val, sub, c }) => (
          <div key={label} className="bg-slate-900 px-4 py-2 flex items-center gap-3">
            <div><div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</div><div className={`font-bold text-base font-mono mt-0.5 ${c}`}>{val}</div><div className="text-[10px] text-slate-500">{sub}</div></div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex gap-px bg-slate-800">
        {/* WBS Pane */}
        <div className="w-64 flex-shrink-0 bg-slate-900 flex flex-col">
          <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"><I name="git-branch" size={11} cls="text-blue-400"/>WBS Structure</span>
            <span className="text-[10px] font-mono text-slate-500">13 nodes</span>
          </div>
          <div className="overflow-y-auto flex-1">
            {WBS_NODES.filter(n => n.level === 0).map(root => (
              <div key={root.id}>
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400 bg-slate-800/50">{root.code}. {root.name.length>20?root.name.slice(0,20)+'…':root.name}</div>
                {WBS_NODES.filter(n => n.parentId === root.id).map(child => (
                  <button key={child.id} onClick={() => setWbsSelected(child.id)}
                    className={`w-full text-left px-5 py-2 flex items-center justify-between transition-all ${wbsSelected===child.id?'bg-blue-900/60 border-l-2 border-blue-500':'hover:bg-slate-800/50 border-l-2 border-transparent'}`}>
                    <div>
                      <div className={`text-[11px] font-semibold ${wbsSelected===child.id?'text-blue-300':'text-slate-300'}`}>{child.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">{child.code}</div>
                    </div>
                    <div className="text-right">
                      {child.rabLinked > 0 ? (
                        <div className="text-[10px] font-mono text-emerald-400">{fIDR(child.budget||0,true)}</div>
                      ) : (
                        <div className="text-[10px] text-slate-600">0 item</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* RAB Pane */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5"><I name="dollar" size={11} cls="text-blue-400"/>RAB — {selNode?.name || 'Semua'}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400">{selRab.length} items</span>
              <span className="text-[10px] font-mono font-bold text-emerald-400">{fIDR(selRab.reduce((s,i)=>s+i.total,0),true)}</span>
              <button className="text-[10px] bg-blue-600 text-white font-bold px-2.5 py-1 rounded flex items-center gap-1"><I name="plus" size={10}/>Add</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {selRab.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <I name="plus" size={28} cls="opacity-20" />
                <div className="text-sm font-medium text-slate-500">Pilih WBS node → Tambah dari AHSP</div>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100">
                  <tr className="border-b border-slate-200">
                    {['No.','CLS','Deskripsi','Vol','SAT','Unit Price','Total','Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selRab.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{item.no}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.cls==='A'?'bg-red-100 text-red-700':item.cls==='B'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>{item.cls}</span></td>
                      <td className="px-3 py-2"><div className="text-[11px] font-medium text-slate-800">{item.desc}</div><div className="text-[10px] font-mono text-slate-400">{item.code}</div></td>
                      <td className="px-3 py-2 font-mono text-[11px]">{item.vol}</td>
                      <td className="px-3 py-2 text-slate-500 text-[11px]">{item.sat}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-right">{fIDR(item.unitPrice)}</td>
                      <td className="px-3 py-2 font-mono font-bold text-[11px] text-right text-slate-900">{fIDR(item.total)}</td>
                      <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RAP + EVM Pane */}
        <div className="w-80 flex-shrink-0 bg-slate-900 flex flex-col overflow-hidden">
          <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5"><I name="trending-up" size={11} cls="text-emerald-400"/>RAP + EVM</span>
            <span className="text-[10px] font-mono text-slate-400">{selNode?.name?.slice(0,16)||'Semua'}</span>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-3">
            {selRap.map(item => (
              <div key={item.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-[11px] font-semibold text-slate-200 leading-snug">{item.name}</div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                  <div><div className="text-slate-500">Budget</div><div className="font-mono font-bold text-slate-300">{fIDR(item.budget,true)}</div></div>
                  <div><div className="text-slate-500">Actual</div><div className="font-mono font-bold text-red-400">{item.actual > 0 ? fIDR(item.actual,true) : '—'}</div></div>
                  <div><div className="text-slate-500">Committed</div><div className="font-mono font-bold text-amber-400">{item.committed > 0 ? fIDR(item.committed,true) : '—'}</div></div>
                  <div><div className="text-slate-500">Remaining</div><div className="font-mono font-bold text-emerald-400">{fIDR(item.remaining,true)}</div></div>
                </div>
                <MiniProgress value={item.progress} variant={item.progress>80?'amber':item.progress>0?'green':'slate'} />
                {item.cpi && (
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className="text-slate-500">CPI:</span>
                    <CpiChip value={item.cpi} />
                    <span className={`${item.cpi>=1?'text-emerald-400':'text-red-400'} font-semibold`}>{item.cpi>=1?'Under Budget':'Over Budget'}</span>
                  </div>
                )}
              </div>
            ))}
            {selRap.length === 0 && (
              <div className="text-center text-slate-600 py-6 text-xs">Pilih WBS node untuk melihat data RAP</div>
            )}
            <div className="bg-blue-950/50 border border-blue-800/50 rounded-lg p-3">
              <EVMPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── VARIATION D: COMMAND CENTER ──────────────────────────────────────────────
const VariationD = ({ tab, setTab }) => {
  const [wbsSelected, setWbsSelected] = React.useState(null)
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 font-['Inter',sans-serif]">
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <div className="px-5 pt-3 pb-0 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm"><I name="layers" size={15} cls="text-white" /></div>
            <div><div className="font-black text-sm text-slate-900">{PROJECT.name}</div><div className="text-[10px] text-slate-400 font-mono">{PROJECT.code} · {PROJECT.status}</div></div>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-0 flex-1">
            {TABS.map((t, idx) => (
              <React.Fragment key={t.id}>
                <button onClick={() => setTab(t.id)}
                  className={`flex flex-col items-center gap-0.5 px-5 pb-3 pt-2 border-b-2 transition-all ${tab===t.id?'border-blue-600':'border-transparent hover:border-slate-300'}`}>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${tab===t.id?'text-blue-600':'text-slate-500'}`}>
                    <TabStatus status={t.status} />
                    <span>{t.label}</span>
                  </div>
                  {t.count !== null && <span className={`text-[11px] font-mono font-bold ${tab===t.id?'text-blue-600':t.status==='warn'?'text-amber-600':'text-slate-400'}`}>{t.count.toLocaleString()} items</span>}
                  {t.count === null && <span className="text-[11px] text-slate-300">—</span>}
                </button>
                {idx < TABS.length-1 && (
                  <div className="flex flex-col items-center pb-3 px-1 text-slate-300">
                    <I name="chevron-right" size={16} cls="mt-2" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2">
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Synced</span>
            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full">Pipeline 2/4</span>
          </div>
        </div>
      </div>

      <BudgetHealthBar compact={true} />

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'AHSP' && (
            <div className="flex flex-col h-full">
              <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
                <div className="flex gap-0">
                  {['AHSP Items','DKH Resources','Analytics','Settings'].map(st => (
                    <button key={st} className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${st==='AHSP Items'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>{st}</button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="relative"><input placeholder="Cari item AHSP..." className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44 focus:outline-none focus:border-blue-400" /><I name="search" size={12} cls="absolute left-2.5 top-2 text-slate-400" /></div>
                  <button className="text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><I name="plus" size={12}/>Tambah Item</button>
                </div>
              </div>
              <AHSPTableContent compact={true} />
            </div>
          )}
          {tab === 'WBS' && (
            <div className="flex h-full">
              <div className="w-56 bg-white border-r border-slate-200 flex flex-col">
                <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">WBS Structure · 13 nodes</div>
                <WBSTree selected={wbsSelected} onSelect={setWbsSelected} />
              </div>
              <div className="flex-1 flex flex-col bg-white">
                <div className="px-4 py-2 border-b border-slate-200 font-semibold text-sm text-slate-800 flex items-center gap-3">
                  <span>Rencana Anggaran Biaya</span>
                  <div className="ml-auto flex gap-2">
                    <button className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 flex items-center gap-1.5"><I name="activity" size={12}/>Analyze Drift</button>
                    <button className="text-xs px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg flex items-center gap-1.5"><I name="plus" size={12}/>Add Item</button>
                  </div>
                </div>
                <RABTableContent wbsFilter={WBS_NODES.find(n=>n.id===wbsSelected)?.code} />
              </div>
            </div>
          )}
          {tab === 'RAB' && (
            <div className="flex flex-col h-full bg-white">
              <div className="grid grid-cols-4 gap-px bg-slate-200 flex-shrink-0 border-b border-slate-200">
                {[['TOTAL ITEMS',RAB_ITEMS.length,'text-slate-900'],['SUBTOTAL',fIDR(RAB_ITEMS.reduce((s,i)=>s+i.total,0)),'text-slate-900'],['OH + PROFIT + TAX','Rp 0','text-slate-400'],['FINAL TOTAL',fIDR(RAB_ITEMS.reduce((s,i)=>s+i.total,0)),'text-blue-600']].map(([l,v,c]) => (
                  <div key={l} className="bg-white px-4 py-3"><div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{l}</div><div className={`font-bold text-xl font-mono mt-0.5 ${c}`}>{v}</div></div>
                ))}
              </div>
              <RABTableContent />
            </div>
          )}
          {tab === 'RAP' && (
            <div className="flex flex-col h-full bg-white">
              <div className="grid grid-cols-5 gap-px bg-slate-200 flex-shrink-0">
                {[['TOTAL BUDGET',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.budget,0),true),'text-slate-900'],['COMMITTED',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.committed,0),true),'text-amber-600'],['ACTUAL COST',fIDR(PROJECT.actualSpent,true),'text-red-600'],['REMAINING',fIDR(RAP_ITEMS.reduce((s,i)=>s+i.budget,0)-PROJECT.actualSpent,true),'text-emerald-600'],['EFISIENSI','CPI 1.04 ↑','text-emerald-600']].map(([l,v,c]) => (
                  <div key={l} className="bg-white px-3 py-2.5"><div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{l}</div><div className={`font-bold text-base font-mono mt-0.5 ${c}`}>{v}</div></div>
                ))}
              </div>
              <RAPTableContent />
            </div>
          )}
          {tab === 'Resource' && (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center text-slate-400"><I name="wrench" size={32} cls="mx-auto mb-2 opacity-20" /><div className="text-sm font-medium text-slate-500">Belum ada item RAP</div><button className="mt-3 text-xs border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600" onClick={()=>setTab('RAP')}>→ Buka RAP</button></div>
            </div>
          )}
        </div>

        {/* EVM Right Panel */}
        <div className="w-72 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5"><I name="shield" size={12} cls="text-blue-500"/>EVM & Budget Guard</span>
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-4">
            <EVMPanel />
            <div className="pt-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Alert Center</div>
              {[
                { sev:'warning', msg:'Pondasi: committed budget 100%', detail:'Sisa Rp 1.7M — perlu persetujuan PM' },
                { sev:'info', msg:'Sloof: CPI 1.12 — efisiensi tinggi', detail:'EV lebih besar dari AC' },
                { sev:'info', msg:'Pipeline 2/4 — RAB perlu diisi', detail:'11 dari 13 WBS nodes belum ter-link' },
              ].map((a, i) => (
                <div key={i} className={`rounded-lg p-3 mb-2 border text-[11px] ${a.sev==='warning'?'bg-amber-50 border-amber-200':'bg-blue-50 border-blue-200'}`}>
                  <div className={`font-semibold ${a.sev==='warning'?'text-amber-800':'text-blue-800'}`}>{a.msg}</div>
                  <div className={`mt-0.5 ${a.sev==='warning'?'text-amber-600':'text-blue-600'}`}>{a.detail}</div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">S-Curve Progress</div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="space-y-1.5">
                  {['Jan','Feb','Mar','Apr','Mei'].map((m,i) => {
                    const plan = [5,12,28,45,58][i]
                    const act = [0,8,22,38,48][i]
                    return (
                      <div key={m}>
                        <div className="flex justify-between text-[9px] text-slate-400 mb-0.5"><span>{m} 2026</span><span className="font-mono">{act}% / {plan}%</span></div>
                        <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="absolute h-full bg-blue-200 rounded-full" style={{width:`${plan}%`}} />
                          <div className="absolute h-full bg-blue-600 rounded-full" style={{width:`${act}%`}} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200"/> Rencana</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"/> Aktual</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

Object.assign(window, { VariationA, VariationB, VariationC, VariationD })
