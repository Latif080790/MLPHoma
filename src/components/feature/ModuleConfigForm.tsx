/**
 * ModuleConfigForm.tsx
 *
 * Small reusable form for editing a module's key configuration fields.
 * - Uses react-hook-form for inputs and basic zod schema validation.
 * - Designed for extensibility: each module can offer a small form subset.
 */

import React from 'react'
import { useForm, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'
import { Copy, Save } from 'lucide-react'

/**
 * Props for ModuleConfigForm
 */
interface ModuleConfigFormProps<T> {
  /** Module display title */
  title: string
  /** Initial values (partial of module config) */
  initialValue: Partial<T>
  /** Zod schema for validation */
  schema: z.ZodTypeAny
  /** On valid submit */
  onSubmit: (data: Partial<T>) => void
  /** Optional compact layout */
  compact?: boolean
}

/**
 * ModuleConfigForm
 *
 * Generic small form renderer. For enterprise UI we will later replace with
 * a full dynamic form per-module. For now it exposes common fields such as toggles,
 * numeric thresholds and names.
 */
export function ModuleConfigForm<T = any>({ title, initialValue, schema, onSubmit, compact = false }: ModuleConfigFormProps<T>) {
  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValue as any,
    mode: 'onSubmit',
  })

  return <ModuleConfigFormInner title={title} methods={methods as any} onSubmit={onSubmit} compact={compact} />
}

/**
 * Inner component separated to satisfy smaller reusable pieces.
 */
function ModuleConfigFormInner<T>({ title, methods, onSubmit, compact }: { title: string; methods: UseFormReturn<Partial<T>>; onSubmit: (d: any) => void; compact?: boolean }) {
  const { register, handleSubmit, formState } = methods

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={compact ? 'space-y-2' : 'space-y-4'}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-transparent" size="sm" type="button" onClick={() => methods.reset()}>
            <Copy className="mr-2" />
            Reset
          </Button>
          <Button size="sm" type="submit">
            <Save className="mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Minimal set of example fields that apply across many modules */}
      <div className="grid grid-cols-1 gap-2">
        <div>
          <Label>Name</Label>
          <Input {...register('meta.name' as any)} placeholder="Display name" />
        </div>

        <div>
          <Label>Schema Version</Label>
          <Input {...register('meta.schemaVersion' as any)} placeholder="1.0.0" />
        </div>

        <div>
          <Label>Priority Threshold (example numeric)</Label>
          <Input type="number" {...register('notifications.thresholds.priority' as any)} placeholder="e.g. 10" />
        </div>
      </div>

      {formState.errors && Object.keys(formState.errors).length > 0 ? (
        <div className="text-sm text-red-600">
          {Object.entries(formState.errors).map(([k, v]: any) => (
            <div key={k}>{k}: {String((v as any).message)}</div>
          ))}
        </div>
      ) : null}
    </form>
  )
}

export default ModuleConfigForm