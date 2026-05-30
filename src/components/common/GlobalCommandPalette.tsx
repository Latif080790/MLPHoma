/**
 * GlobalCommandPalette.tsx — P1.2.2
 *
 * Cmd+K / Ctrl+K command palette for fast navigation.
 * Renders a CommandDialog on top of any page, accessible from anywhere
 * in the app.  Mount once in <App /> at the root level.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command'
import {
    Layout, FolderOpen, DollarSign, Calendar, ShoppingCart,
    CreditCard, GitPullRequest, FileText, Settings, PackageCheck,
    BookOpen, BarChart3, Globe, Zap, Layers, Shield, PieChart,
    Moon, Sun, Wrench, ShieldCheck, HardHat,
} from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { getCommandPaletteItems, type NavIconKey } from '@/config/navRegistry'

const ICON_MAP: Record<NavIconKey, React.ElementType> = {
    LayoutDashboard: Layout,
    FolderKanban: FolderOpen,
    ClipboardList: BookOpen,
    Calculator: DollarSign,
    BarChart3,
    CalendarClock: Calendar,
    Truck: ShoppingCart,
    Wallet: CreditCard,
    FileDiff: GitPullRequest,
    FolderOpen: FileText,
    ClipboardCheck: PackageCheck,
    Flag: Shield,
    Layers: Globe,
    PieChart,
    Zap,
    Sliders: Layers,
    Settings,
    Wrench,
    ShieldCheck,
    HardHat,
}

export default function GlobalCommandPalette() {
    const [open, setOpen] = useState(false)
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
    const navigate = useNavigate()
    const { projects, setActiveProject } = useProjectStore()

    // Register Ctrl+K / Cmd+K shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen(prev => !prev)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    const runCommand = (path: string) => {
        setOpen(false)
        navigate(path)
    }

    const toggleTheme = () => {
        const root = document.documentElement
        const next = !root.classList.contains('dark')
        root.classList.toggle('dark', next)
        try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* ignore storage errors */ }
        setIsDark(next)
        setOpen(false)
    }

    const projectList = Object.values(projects)
    const navCommands = React.useMemo(() => getCommandPaletteItems(), [])

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search modules or switch project…" />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Modules">
                    {navCommands.map((cmd) => {
                        const Icon = ICON_MAP[cmd.iconKey]
                        return (
                        <CommandItem
                            key={cmd.id}
                            value={`${cmd.label} ${cmd.description || ''} ${cmd.keywords.join(' ')}`}
                            onSelect={() => runCommand(cmd.path)}
                            className="flex items-center gap-3 cursor-pointer"
                        >
                            <span className="text-muted-foreground"><Icon size={14} /></span>
                            <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm">{cmd.label}</span>
                                {cmd.description && (
                                    <span className="text-xs text-muted-foreground ml-2">{cmd.description}</span>
                                )}
                            </div>
                        </CommandItem>
                    )})}
                </CommandGroup>

                {projectList.length > 0 && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Switch Project">
                            {projectList.map(p => (
                                <CommandItem
                                    key={p.id}
                                    value={`project ${p.name} ${p.code ?? ''}`}
                                    onSelect={() => {
                                        setActiveProject(p.id)
                                        setOpen(false)
                                    }}
                                    className="flex items-center gap-3 cursor-pointer"
                                >
                                    <FolderOpen size={14} className="text-blue-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-sm truncate">{p.name}</span>
                                        {p.code && <span className="text-xs text-muted-foreground ml-2 font-mono">{p.code}</span>}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}

                <CommandSeparator />
                <CommandGroup heading="Actions">
                    <CommandItem
                        value="toggle theme dark light mode appearance"
                        onSelect={toggleTheme}
                        className="flex items-center gap-3 cursor-pointer"
                    >
                        {isDark ? <Sun size={14} className="text-amber-400 shrink-0" /> : <Moon size={14} className="text-indigo-500 shrink-0" />}
                        <span className="font-medium text-sm">{isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                    </CommandItem>
                    <CommandItem
                        value="settings configuration project"
                        onSelect={() => runCommand('/settings')}
                        className="flex items-center gap-3 cursor-pointer"
                    >
                        <Settings size={14} className="text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm">Open Settings</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>

            {/* Keyboard hint */}
            <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>Esc close</span>
            </div>
        </CommandDialog>
    )
}
