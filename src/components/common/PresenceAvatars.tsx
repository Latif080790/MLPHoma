import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PresenceUser } from '@/services/realtime/presenceService'
import { cn } from '@/lib/utils'

interface PresenceAvatarsProps {
  users: PresenceUser[]
  max?: number
  className?: string
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ users, max = 5, className }) => {
  // Deduplicate by user_id — multiple presence connections can produce duplicate entries
  const uniqueUsers = users.filter((u, i, arr) => arr.findIndex(x => x.user_id === u.user_id) === i)
  const visibleUsers = uniqueUsers.slice(0, max)
  const remainingCount = Math.max(0, uniqueUsers.length - max)

  return (
    <TooltipProvider>
      <div className={cn("flex items-center -space-x-2 isolate", className)}>
        {visibleUsers.map((user) => (
          <Tooltip key={user.user_id}>
            <TooltipTrigger asChild>
              <div className="relative group cursor-default">
                <Avatar className={cn(
                  "h-8 w-8 ring-2 ring-white dark:ring-slate-900 border border-slate-200 dark:border-slate-800 transition-transform hover:z-10 hover:-translate-y-0.5",
                  user.status === 'editing' && "ring-blue-500"
                )}>
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-xs uppercase font-bold text-slate-500">
                    {user.full_name.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                {/* Status Dot */}
                <span className={cn(
                  "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                  user.status === 'online' ? "bg-emerald-500" :
                  user.status === 'editing' ? "bg-blue-500 animate-pulse" :
                  "bg-slate-400"
                )} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-col gap-1 p-2 bg-slate-900 text-white border-slate-800">
              <span className="font-bold text-xs">{user.full_name}</span>
              <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                {user.role} • {user.status === 'editing' ? `Editing ${user.current_module || 'Module'}` : 'Viewing Proyek'}
              </span>
            </TooltipContent>
          </Tooltip>
        ))}

        {remainingCount > 0 && (
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 ring-2 ring-white dark:ring-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500">
            +{remainingCount}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
