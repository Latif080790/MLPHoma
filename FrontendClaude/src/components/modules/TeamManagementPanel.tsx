/**
 * TeamManagementPanel.tsx
 * Wires userManagementService into the Settings → Team tab.
 * Shows project members with roles, invite capability.
 */

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableRow, TableHeader } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Users, UserPlus, Shield, Loader2, Mail } from "lucide-react"
import { userManagementService, ProjectMember, UserProfile } from "@/services/userManagementService"
import { toast } from "sonner"

interface TeamManagementPanelProps {
    projectId: string
}

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-red-100 text-red-800',
    manager: 'bg-blue-100 text-blue-800',
    user: 'bg-green-100 text-green-800',
    viewer: 'bg-gray-100 text-gray-800',
}

export function TeamManagementPanel({ projectId }: TeamManagementPanelProps) {
    const [members, setMembers] = useState<ProjectMember[]>([])
    const [allUsers, setAllUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(false)
    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviteEmail, setInviteEmail] = useState("")
    const [inviteRole, setInviteRole] = useState("user")
    const [inviting, setInviting] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const [m, u] = await Promise.all([
                userManagementService.getProjectMembers(projectId),
                userManagementService.getUsers()
            ])
            setMembers(m)
            setAllUsers(u)
        } catch {
            // failed to load — empty state shown
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (projectId) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    const handleInvite = async () => {
        if (!inviteEmail) return
        setInviting(true)
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await userManagementService.inviteUser(inviteEmail, inviteRole as any)
            toast.success(`Invited ${inviteEmail}`)
            setInviteOpen(false)
            setInviteEmail("")
            load()
        } catch (err: unknown) {
            toast.error("Invite failed", { description: (err as Error).message })
        } finally {
            setInviting(false)
        }
    }

    const handleAssign = async (userId: string, role: string) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await userManagementService.assignToProject(projectId, userId, role as any)
            toast.success("Member assigned")
            load()
        } catch (err: unknown) {
            toast.error((err as Error).message)
        }
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await userManagementService.updateUserRole(userId, newRole as any)
            toast.success("Role updated")
            load()
        } catch (err: unknown) {
            toast.error((err as Error).message)
        }
    }

    // Users not yet assigned to this project
    const memberUserIds = new Set(members.map(m => m.userId))
    const unassigned = allUsers.filter(u => !memberUserIds.has(u.id))

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Project Team ({members.length})
                        </CardTitle>
                        <CardDescription>Manage who can access this project.</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => setInviteOpen(true)}>
                        <UserPlus size={14} /> Invite
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : members.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            No team members assigned. Click Invite to add members.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Project Role</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map(m => (
                                    <TableRow key={m.userId}>
                                        <TableCell className="font-medium">
                                            {m.profileName || 'Unknown'}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {m.profileEmail || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={ROLE_COLORS[m.projectRole || 'user'] || ''}>
                                                <Shield className="h-3 w-3 mr-1" />
                                                {m.projectRole || 'user'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={m.projectRole}
                                                onValueChange={(val) => handleRoleChange(m.userId, val)}
                                            >
                                                <SelectTrigger className="h-8 w-[130px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                    <SelectItem value="manager">Manager</SelectItem>
                                                    <SelectItem value="user">User</SelectItem>
                                                    <SelectItem value="viewer">Viewer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Unassigned Users Quick-Add */}
            {unassigned.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Available Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {unassigned.slice(0, 5).map(u => (
                                <div key={u.id} className="flex justify-between items-center p-2 rounded border">
                                    <div>
                                        <div className="font-medium text-sm">{u.fullName}</div>
                                        <div className="text-xs text-muted-foreground">{u.email}</div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAssign(u.id, 'user')}
                                    >
                                        Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Invite Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Email Address</Label>
                            <div className="flex gap-2">
                                <Mail className="h-4 w-4 mt-3 text-muted-foreground" />
                                <Input
                                    placeholder="email@example.com"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Role</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                        <Button onClick={handleInvite} disabled={inviting}>
                            {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                            Send Invite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
