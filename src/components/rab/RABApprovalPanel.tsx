/**
 * RAB Approval Panel
 * UI for managing RAB approval workflow
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { ScrollArea } from '../ui/scroll-area'
import { Textarea } from '../ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Ban,
  ChevronRight,
  Zap,
  Shield,
} from 'lucide-react'
import { useRABApprovalStore } from '../../store/rabApprovalStore'
import type { RABApproval, ApprovalStatus, ApprovalStep } from '../../types/rabApproval'
import { formatDistanceToNow } from 'date-fns'

export interface RABApprovalPanelProps {
  /** Project ID */
  projectId: string
  /** RAB Version ID to approve */
  rabVersionId?: string
  /** Open state */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** Mode: submit or view */
  mode?: 'submit' | 'view'
}

/**
 * Get status color
 */
function getStatusColor(status: ApprovalStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: ApprovalStatus) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="h-4 w-4" />
    case 'rejected':
      return <XCircle className="h-4 w-4" />
    case 'pending':
      return <Clock className="h-4 w-4" />
    case 'cancelled':
      return <Ban className="h-4 w-4" />
  }
}

/**
 * Step indicator component
 */
function StepIndicator({ step, isLast }: { step: ApprovalStep; isLast: boolean }) {
  const getStepColor = () => {
    if (step.status === 'approved') return 'bg-green-500 border-green-500'
    if (step.status === 'rejected') return 'bg-red-500 border-red-500'
    if (step.isCurrent) return 'bg-blue-500 border-blue-500 animate-pulse'
    return 'bg-gray-300 border-gray-300'
  }

  const getLineColor = () => {
    if (step.status === 'approved') return 'bg-green-500'
    return 'bg-gray-300'
  }

  return (
    <div className="flex flex-col items-center relative">
      {/* Step circle */}
      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${getStepColor()}`}>
        {step.status === 'approved' ? (
          <CheckCircle2 className="h-5 w-5 text-white" />
        ) : step.status === 'rejected' ? (
          <XCircle className="h-5 w-5 text-white" />
        ) : (
          <span className="text-white font-bold">{step.stepNumber}</span>
        )}
      </div>

      {/* Connecting line */}
      {!isLast && (
        <div className={`w-0.5 h-16 ${getLineColor()} mt-2`} />
      )}

      {/* Step info */}
      <div className="mt-2 text-center max-w-[120px]">
        <div className="text-sm font-semibold text-gray-900">{step.approverRole}</div>
        {step.approverName && (
          <div className="text-xs text-gray-500 mt-1">{step.approverName}</div>
        )}
        {step.actionDate && (
          <div className="text-xs text-gray-400 mt-1">
            {formatDistanceToNow(step.actionDate, { addSuffix: true })}
          </div>
        )}
        {step.isCurrent && (
          <Badge variant="outline" className="mt-2 text-xs">
            Current
          </Badge>
        )}
      </div>
    </div>
  )
}

/**
 * RAB Approval Panel Component
 */
export function RABApprovalPanel({
  projectId,
  rabVersionId,
  open,
  onClose,
  mode = 'view'
}: RABApprovalPanelProps) {
  const {
    templates,
    loading,
    submitForApproval,
    approve,
    reject,
    getApprovalsByProject,
    getApprovalHistory,
    fetchApprovals,
    loadTemplates
  } = useRABApprovalStore()

  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard')
  const [actionComments, setActionComments] = useState('')
  const [showActionDialog, setShowActionDialog] = useState<'approve' | 'reject' | null>(null)
  const [selectedApproval, setSelectedApproval] = useState<RABApproval | null>(null)

  // Load data
  useEffect(() => {
    if (open) {
      fetchApprovals(projectId)
      loadTemplates()
    }
  }, [open, projectId, fetchApprovals, loadTemplates])

  // Get approvals for this project
  const projectApprovals = getApprovalsByProject(projectId)
  const currentApproval = rabVersionId
    ? projectApprovals.find(a => a.rabVersionId === rabVersionId)
    : projectApprovals[0]

  // Handle submit for approval
  const handleSubmit = async () => {
    if (!rabVersionId) {
      return
    }

    try {
      await submitForApproval(projectId, rabVersionId, selectedTemplate)
      onClose()
    } catch (error) {
      console.error('Submit failed:', error)
    }
  }

  // Handle approve action
  const handleApprove = async () => {
    if (!selectedApproval) return

    try {
      await approve({
        approvalId: selectedApproval.id,
        action: 'approve',
        comments: actionComments,
        approverId: 'current-user-id', // TODO: Get from auth
        approverName: 'Current User' // TODO: Get from auth
      })
      setShowActionDialog(null)
      setActionComments('')
    } catch (error) {
      console.error('Approve failed:', error)
    }
  }

  // Handle reject action
  const handleReject = async () => {
    if (!selectedApproval) return

    try {
      await reject({
        approvalId: selectedApproval.id,
        action: 'reject',
        comments: actionComments,
        approverId: 'current-user-id', // TODO: Get from auth
        approverName: 'Current User' // TODO: Get from auth
      })
      setShowActionDialog(null)
      setActionComments('')
    } catch (error) {
      console.error('Reject failed:', error)
    }
  }

  // Render submit mode
  if (mode === 'submit') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Submit RAB for Approval
            </DialogTitle>
            <DialogDescription>
              Choose an approval workflow for this RAB version
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Approval Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        {template.id === 'fast-track' && <Zap className="h-4 w-4" />}
                        {template.id === 'detailed' && <Shield className="h-4 w-4" />}
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Approval Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {templates
                      .find(t => t.id === selectedTemplate)
                      ?.defaultSteps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                            {step.stepNumber}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{step.approverRole}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading.submission}>
              {loading.submission ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Render view/action mode
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Approval Status
            </div>
            {currentApproval && (
              <Badge className={getStatusColor(currentApproval.status)}>
                {getStatusIcon(currentApproval.status)}
                <span className="ml-1 capitalize">{currentApproval.status}</span>
              </Badge>
            )}
          </DialogTitle>
          {currentApproval && (
            <DialogDescription>
              {currentApproval.approvalChain.name} - Submitted{' '}
              {formatDistanceToNow(currentApproval.submittedAt, { addSuffix: true })} by{' '}
              {currentApproval.submittedByName}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading.approvals ? (
          <div className="py-8 text-center text-gray-500">Loading approvals...</div>
        ) : !currentApproval ? (
          <div className="py-8 text-center text-gray-500">No approval process started</div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Approval Chain Visualization */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Approval Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-around items-start py-4">
                    {currentApproval.approvalChain.steps.map((step, idx) => (
                      <StepIndicator
                        key={idx}
                        step={step}
                        isLast={idx === currentApproval.approvalChain.steps.length - 1}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Current Step Actions */}
              {currentApproval.status === 'pending' && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Awaiting Action
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-gray-700">
                        Current step: <strong>{currentApproval.approvalChain.steps[currentApproval.currentStep - 1]?.approverRole}</strong>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedApproval(currentApproval)
                            setShowActionDialog('approve')
                          }}
                          className="gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedApproval(currentApproval)
                            setShowActionDialog('reject')
                          }}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Approval History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getApprovalHistory(currentApproval.id).map((entry) => (
                      <div key={entry.id} className="flex gap-3 text-sm border-l-2 border-gray-200 pl-3">
                        <div className="flex-1">
                          <div className="font-medium">{entry.userName}</div>
                          <div className="text-gray-600 capitalize">{entry.action} at step {entry.stepNumber}</div>
                          {entry.comments && (
                            <div className="text-gray-500 text-xs mt-1 italic">&quot;{entry.comments}&quot;</div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Action Dialog */}
        <Dialog open={!!showActionDialog} onOpenChange={() => setShowActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {showActionDialog === 'approve' ? 'Approve RAB' : 'Reject RAB'}
              </DialogTitle>
              <DialogDescription>
                {showActionDialog === 'approve'
                  ? 'Add any comments before approving this RAB version'
                  : 'Please provide a reason for rejecting this RAB'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Comments (optional)"
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowActionDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={showActionDialog === 'approve' ? handleApprove : handleReject}
                variant={showActionDialog === 'approve' ? 'default' : 'destructive'}
                disabled={loading.action}
              >
                {loading.action ? 'Processing...' : showActionDialog === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
