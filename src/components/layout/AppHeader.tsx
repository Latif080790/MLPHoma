import React from "react"
import { ThemeToggle } from "../shared/ThemeToggle"
import { LogOut, User } from "lucide-react"
import { useAuthStore } from "../../store/authStore"
import { useNavigate } from "react-router"
import { NotificationCenter } from "../common/NotificationCenter"

export interface AppHeaderProps {
  projectName?: string
  onSearch?: (value: string) => void
}

export function AppHeader({ projectName, onSearch }: AppHeaderProps) {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="glass sticky top-0 z-30 border-b">
      <div className="flex items-center gap-4 px-6 py-3">
        {/* Breadcrumb / Page context */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            {projectName || "Dashboard"}
          </span>
          {projectName && projectName !== "Dashboard" && projectName !== "Welcome" && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Active
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          {onSearch && (
            <input
              type="text"
              placeholder="Search…"
              aria-label="Search"
              onChange={(e) => onSearch(e.target.value)}
              className="w-48 rounded-lg border bg-[hsl(var(--background))] px-3 py-1.5 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))] sm:w-56 transition-shadow"
            />
          )}

          {/* Notifications */}
          <NotificationCenter />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* User Profile / Logout */}
          <div className="flex items-center gap-3 pl-2 border-l ml-1">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-medium">{profile?.full_name || 'User'}</span>
              <span className="text-[10px] text-muted-foreground">{user?.email || ''}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              title="Log Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
