/**
 * eventBus.ts
 *
 * Lightweight typed event bus for decoupling Zustand stores.
 * Replaces direct cross-store imports with a pub/sub pattern.
 *
 * Usage:
 *   // Publisher (in wbsStore):
 *   eventBus.emit('wbs:deleted', { projectId, wbsItemIds })
 *
 *   // Subscriber (in rabWbsLinkStore init):
 *   eventBus.on('wbs:deleted', ({ wbsItemIds }) => { unlinkByWbsId(...) })
 *
 * Benefits:
 *   - Stores no longer import each other directly
 *   - Easy to add new subscribers without modifying publishers
 *   - Testable: can mock eventBus in unit tests
 */

// ─── Event Type Definitions ───

export interface EventMap {
  /** WBS item(s) deleted — subscribers should clean up related links */
  'wbs:deleted': { projectId: string; wbsItemIds: string[] }

  /** WBS items imported (full replace) — subscribers should clean up old links */
  'wbs:imported': { projectId: string; oldWbsItemIds: string[]; newWbsItemIds: string[] }

  /** RAB items changed — subscribers should check if RAP needs update */
  'rab:changed': { projectId: string; changeType: 'add' | 'update' | 'remove' | 'import'; itemIds: string[] }

  /** RAB baseline locked/unlocked */
  'rab:baseline': { projectId: string; action: 'locked' | 'unlocked' }

  /** RAP items re-initialized from RAB */
  'rap:initialized': { projectId: string; itemCount: number }

  /** Finance invoice status changed */
  'finance:invoice-status': { invoiceId: string; projectId: string; oldStatus: string; newStatus: string }

  /** Timeline tasks changed — subscribers should refetch timeline */
  'timeline:changed': { projectId: string; reason?: string }
  'po:approved': { projectId: string; poId: string }

  /** Project active changed */
  'project:active-changed': { projectId: string }
}

// ─── Event Bus Implementation ───

type EventHandler<T> = (payload: T) => void

class EventBus {
  private handlers: Map<string, Set<EventHandler<unknown>>> = new Map()

  /**
   * Subscribe to an event.
   * Returns an unsubscribe function.
   */
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    const set = this.handlers.get(event)!
    set.add(handler as EventHandler<unknown>)

    // Return unsubscribe function
    return () => {
      set.delete(handler as EventHandler<unknown>)
      if (set.size === 0) {
        this.handlers.delete(event)
      }
    }
  }

  /**
   * Emit an event with payload.
   * All registered handlers are called synchronously.
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event)
    if (!set || set.size === 0) return

    for (const handler of set) {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err)
      }
    }
  }

  /**
   * Remove all handlers for a specific event (for testing).
   */
  off<K extends keyof EventMap>(event: K): void {
    this.handlers.delete(event)
  }

  /**
   * Clear all handlers (for testing/teardown).
   */
  clear(): void {
    this.handlers.clear()
  }
}

/** Singleton event bus instance */
export const eventBus = new EventBus()
