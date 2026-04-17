import React from "react"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { LogOut, User, Search, Command } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { useNavigate } from "react-router"
import { NotificationCenter } from "@/components/common/NotificationCenter"
import { AppBreadcrumbs } from "./AppBreadcrumbs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { PresenceAvatars } from "@/components/common/PresenceAvatars"
import { usePresence } from "@/hooks/usePresence"
import { useProjectStore } from "@/store/projectStore"

export interface AppHeaderProps {
  projectName?: string
  onSearch?: (value: string) => void
}

export function AppHeader({ projectName, onSearch }: AppHeaderProps) {
  const { user, profile, signOut } = useAuthStore()
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const { peers } = usePresence(activeProjectId ?? null)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Get initials for avatar
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U'

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 gap-4">
      {/* Left: Breadcrumbs & Context */}
      <div className="flex items-center min-w-0 flex-1">
        <AppBreadcrumbs projectName={projectName} />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Real-time Presence */}
        {activeProjectId && peers.length > 0 && (
          <div className="flex items-center gap-3 mr-2 animate-in fade-in slide-in-from-right-4 duration-500">
            <PresenceAvatars users={peers} />
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
          </div>
        )}

        {/* P1.2.2: Cmd+K palette trigger */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
          className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors bg-transparent"
          title="Open command palette  Ctrl+K"
          aria-label="Open command palette"
        >
          <Command size={12} />
          <span>K</span>
        </button>
        {/* Search Bar (Collapsible on mobile) */}
        {onSearch && (
          <div className="relative hidden md:block group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search..."
              onChange={(e) => onSearch(e.target.value)}
              className="h-9 w-64 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        )}

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />

        {/* Notifications */}
        <NotificationCenter />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full select-none">
              <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-sm cursor-pointer transition-transform hover:scale-105">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-medium text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{profile?.full_name || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings#team')}>
              <User className="mr-2 h-4 w-4" />
              <span>Team & Organization</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export default AppHeader
