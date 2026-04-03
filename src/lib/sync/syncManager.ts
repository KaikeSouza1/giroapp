import { Network } from '@capacitor/network'

interface SyncQueueItem {
  id: string
  entity_type: 'checkin' | 'route_session'
  payload: string
  status: 'pendente' | 'syncing' | 'synced' | 'error'
  attempts: number
  last_error: string | null
  created_at: string
  synced_at: string | null
}

class SyncManager {
  private isSyncing = false

  async startListening() {
    Network.addListener('networkStatusChange', async (status) => {
      if (status.connected) {
        await this.runSync()
      }
    })
    const status = await Network.getStatus()
    if (status.connected) await this.runSync()
  }

  async runSync() {
    if (this.isSyncing) return
    this.isSyncing = true

    try {
      const pendingItems = await this.getPendingQueueItems()
      if (pendingItems.length === 0) return

      await this.markAs(pendingItems.map(i => i.id), 'syncing')

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: pendingItems }),
      })

      const result = await response.json()

      for (const confirmed of result.confirmed as { localId: string; syncedAt: string }[]) {
        await this.markAs([confirmed.localId], 'synced', confirmed.syncedAt)
      }
      for (const failed of result.failed as { localId: string; reason: string }[]) {
        await this.markError(failed.localId, failed.reason)
      }

    } catch (err) {
      console.error('[Sync] Falha:', err)
      await this.resetSyncingToPending()
    } finally {
      this.isSyncing = false
    }
  }

  async enqueueCheckin(checkinData: {
    localId: string
    sessionId: string
    waypointId: string
    latitude: number
    longitude: number
    selfieBase64: string
    capturedAt: string
  }) {
    const queueItem: SyncQueueItem = {
      id: checkinData.localId,
      entity_type: 'checkin',
      payload: JSON.stringify(checkinData),
      status: 'pendente',
      attempts: 0,
      last_error: null,
      created_at: checkinData.capturedAt,
      synced_at: null,
    }
    await this.insertQueueItem(queueItem)
  }

  private async getPendingQueueItems(): Promise<SyncQueueItem[]> {
    return []
  }

  private async markAs(ids: string[], status: SyncQueueItem['status'], syncedAt?: string): Promise<void> {
    console.log('[Sync] markAs', { ids, status, syncedAt })
  }

  private async markError(id: string, error: string): Promise<void> {
    console.log('[Sync] markError', { id, error })
  }

  private async resetSyncingToPending(): Promise<void> {
    console.log('[Sync] resetSyncingToPending')
  }

  private async insertQueueItem(item: SyncQueueItem): Promise<void> {
    console.log('[Sync] insertQueueItem', item)
  }
}

export const syncManager = new SyncManager()