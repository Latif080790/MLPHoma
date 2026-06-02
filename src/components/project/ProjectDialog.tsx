import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { useAHSPStore } from '../../store/ahspStore'
import type { Project } from '../../store/projectStore'

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  onSave: (project: Partial<Project>) => void
}

export function ProjectDialog({ open, onOpenChange, project, onSave }: ProjectDialogProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<Partial<Project>>({
    defaultValues: {
      name: '',
      id: '',
      budget: 0,
      status: 'Planning',
      location: '',
      clientName: '',
      startDate: '',
      endDate: '',

      zoneId: '',
      meta: { description: '' }
    }
  })

  const { zones, fetchZones } = useAHSPStore()

  useEffect(() => {
    if (open) {
      fetchZones()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (project) {
      reset({
        ...project,
        meta: project.meta || { description: '' }
      })
    } else {
      reset({
        name: '',
        id: '',
        budget: 0,
        status: 'Planning',
        location: '',
        clientName: '',
        startDate: '',
        endDate: '',

        zoneId: '',
        meta: { description: '' }
      })
    }
  }, [project, reset, open])

  const onSubmit = (data: Partial<Project>) => {
    onSave(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            Fill in project information to continue with setup and costing workflow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id">Project ID/Number</Label>
              <Input
                id="id"
                {...register('id')}
                disabled={!!project}
                placeholder="Auto-generated if empty"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use internal numbering (PRJ-YYYY-XXXX).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(val) => setValue('status', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planning">Planning</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Hold">Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input id="name" {...register('name')} placeholder="Project Name" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" {...register('clientName')} placeholder="Client Name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (IDR)</Label>
              <Input
                id="budget"
                type="number"
                {...register('budget', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...register('location')} placeholder="Project Location" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoneId">Pricing Zone</Label>
            <Select
              value={watch('zoneId') || "default"}
              onValueChange={(val) => setValue('zoneId', val === "default" ? undefined : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Pricing Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (Master)</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Select a zone to apply specific material and labor prices.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('meta.description')}
              placeholder="Project description..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {project ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
