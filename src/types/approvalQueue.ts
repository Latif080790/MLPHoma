import type { ApprovalEntityType, ApprovalStatus, ApprovalRequest } from './approval'

export type ApprovalQueueScope = 'PURCHASE_ORDER' | 'MATERIAL_TRANSFER' | 'PAYMENT'

export interface ApprovalQueueItem {
  id: string
  approvalId: string
  projectId: string
  scope: ApprovalQueueScope
  entityType: ApprovalEntityType
  entityId: string
  title: string
  requesterName?: string
  status: ApprovalStatus
  createdAt: string
}

const SCOPE_MAP: Record<ApprovalQueueScope, ApprovalEntityType[]> = {
  PURCHASE_ORDER: ['PURCHASE_ORDER'],
  MATERIAL_TRANSFER: ['MATERIAL_TRANSFER', 'EMERGENCY_TRANSFER'],
  PAYMENT: ['PAYMENT'],
}

export function toApprovalQueueItems(requests: ApprovalRequest[]): ApprovalQueueItem[] {
  const allowedTypes = new Set<ApprovalEntityType>([
    ...SCOPE_MAP.PURCHASE_ORDER,
    ...SCOPE_MAP.MATERIAL_TRANSFER,
    ...SCOPE_MAP.PAYMENT,
  ])

  return requests
    .filter((request) => request.status === 'PENDING' && allowedTypes.has(request.entityType))
    .map((request) => {
      const scope: ApprovalQueueScope =
        request.entityType === 'PURCHASE_ORDER'
          ? 'PURCHASE_ORDER'
          : request.entityType === 'PAYMENT'
            ? 'PAYMENT'
            : 'MATERIAL_TRANSFER'

      return {
        id: request.id,
        approvalId: request.id,
        projectId: request.projectId,
        scope,
        entityType: request.entityType,
        entityId: request.entityId,
        title: request.title,
        requesterName: request.requesterName,
        status: request.status,
        createdAt: request.createdAt,
      }
    })
}
