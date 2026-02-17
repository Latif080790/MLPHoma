/**
 * traceability.ts
 * Type definitions for document traceability and lineage tracking.
 * Enables full procurement audit trail: MR → PO → GRN → Invoice (AP)
 */

/**
 * Document types that participate in traceability
 */
export type TraceableDocType = 'MR' | 'PO' | 'GRN' | 'INVOICE' | 'CLAIM' | 'MTR'

/**
 * Trace link metadata - connects one document to its source/predecessor
 */
export interface TraceLink {
    /** Source document type */
    fromType: TraceableDocType
    /** Source document ID */
    fromId: string
    /** Source document number/reference */
    fromRef?: string
    
    /** Target document type */
    toType: TraceableDocType
    /** Target document ID */
    toId: string
    /** Target document number/reference */
    toRef?: string
    
    /** WBS item ID (if applicable) */
    wbsId?: string
    /** WBS item name for display */
    wbsName?: string
    
    /** Item/line linking (optional) */
    itemId?: string
    itemName?: string
    
    /** Link creation timestamp */
    createdAt: string
}

/**
 * Document lineage - full chain of documents
 */
export interface DocumentLineage {
    /** Current document type */
    docType: TraceableDocType
    /** Current document ID */
    docId: string
    /** Current document number */
    docNumber: string
    
    /** Upstream documents (predecessors) */
    upstream: TraceLink[]
    /** Downstream documents (successors) */
    downstream: TraceLink[]
    
    /** Root WBS item */
    wbsId?: string
    wbsName?: string
}

/**
 * Trace summary for UI display
 */
export interface TraceSummary {
    /** Document being traced */
    docType: TraceableDocType
    docId: string
    docNumber: string
    
    /** Has upstream links */
    hasUpstream: boolean
    /** Has downstream links */
    hasDownstream: boolean
    
    /** Count by document type */
    upstreamCounts: Partial<Record<TraceableDocType, number>>
    downstreamCounts: Partial<Record<TraceableDocType, number>>
    
    /** Full lineage chain (simplified) */
    chain: {
        type: TraceableDocType
        id: string
        ref: string
        createdAt: string
    }[]
}

/**
 * Trace metadata embedded in documents
 */
export interface TraceMetadata {
    /** Direct parent document */
    sourceDoc?: {
        type: TraceableDocType
        id: string
        ref: string
    }
    
    /** Direct child documents */
    derivedDocs?: {
        type: TraceableDocType
        id: string
        ref: string
    }[]
    
    /** Root WBS lineage */
    wbsLineage?: {
        wbsId: string
        wbsName: string
        wbsCode?: string
    }
}

/**
 * Trace query filters
 */
export interface TraceQueryOptions {
    /** Project ID scope */
    projectId: string
    
    /** Document type filter */
    docType?: TraceableDocType
    
    /** Document ID filter */
    docId?: string
    
    /** WBS filter */
    wbsId?: string
    
    /** Date range */
    fromDate?: string
    toDate?: string
    
    /** Include upstream chain */
    includeUpstream?: boolean
    /** Include downstream chain */
    includeDownstream?: boolean
    
    /** Maximum depth for traversal */
    maxDepth?: number
}
