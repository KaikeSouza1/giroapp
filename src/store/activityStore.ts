import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type ActivityType = 'run' | 'cycling' | 'walk'
export type ActivityStatus = 'idle' | 'running' | 'paused' | 'stopped'

export type Coordinate = {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
  altitude?: number | null
}

function haversineKm(c1: Coordinate, c2: Coordinate): number {
  const R = 6371
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type ActivityStore = {
  status: ActivityStatus
  activityType: ActivityType | null
  coordinates: Coordinate[]
  startTime: number | null
  pausedDuration: number
  pauseStartTime: number | null
  distanceKm: number
  currentPaceSecPerKm: number
  currentSpeedKmH: number
  isAutoPaused: boolean
  lastSavedActivityId: string | null

  setActivityType: (type: ActivityType) => void
  startActivity: () => void
  pauseActivity: (auto?: boolean) => void
  resumeActivity: () => void
  stopActivity: () => void
  addCoordinate: (coord: Coordinate) => void
  resetActivity: () => void
  setLastSavedActivityId: (id: string) => void
}

export const useActivityStore = create<ActivityStore>()(
  subscribeWithSelector((set, get) => ({
    status: 'idle',
    activityType: null,
    coordinates: [],
    startTime: null,
    pausedDuration: 0,
    pauseStartTime: null,
    distanceKm: 0,
    currentPaceSecPerKm: 0,
    currentSpeedKmH: 0,
    isAutoPaused: false,
    lastSavedActivityId: null,

    setActivityType: (type) => set({ activityType: type }),

    startActivity: () =>
      set({
        status: 'running',
        startTime: Date.now(),
        pausedDuration: 0,
        pauseStartTime: null,
        coordinates: [],
        distanceKm: 0,
        currentPaceSecPerKm: 0,
        currentSpeedKmH: 0,
        isAutoPaused: false,
      }),

    pauseActivity: (auto = false) => {
      if (get().status !== 'running') return
      set({ status: 'paused', pauseStartTime: Date.now(), isAutoPaused: auto })
    },

    resumeActivity: () => {
      const { pauseStartTime, pausedDuration } = get()
      const extra = pauseStartTime ? Date.now() - pauseStartTime : 0
      set({
        status: 'running',
        pausedDuration: pausedDuration + extra,
        pauseStartTime: null,
        isAutoPaused: false,
      })
    },

    stopActivity: () => {
      const { pauseStartTime, pausedDuration, status } = get()
      const extra = status === 'paused' && pauseStartTime ? Date.now() - pauseStartTime : 0
      set({
        status: 'stopped',
        pausedDuration: pausedDuration + extra,
        pauseStartTime: null,
      })
    },

    addCoordinate: (coord) => {
      const { status, coordinates, distanceKm } = get()
      if (status !== 'running') return

      const prev = coordinates[coordinates.length - 1]
      let addedKm = 0
      let speedKmH = 0
      let paceSecPerKm = 0

      if (prev) {
        const dist = haversineKm(prev, coord)
        const timeDiffHr = (coord.timestamp - prev.timestamp) / 3_600_000
        if (dist >= 0.002 && timeDiffHr > 0) {
          addedKm = dist
          speedKmH = dist / timeDiffHr
          paceSecPerKm = speedKmH > 0 ? 3600 / speedKmH : 0
        }
      }

      set({
        coordinates: [...coordinates, coord],
        distanceKm: distanceKm + addedKm,
        currentSpeedKmH: speedKmH,
        currentPaceSecPerKm: paceSecPerKm,
      })
    },

    resetActivity: () =>
      set({
        status: 'idle',
        activityType: null,
        coordinates: [],
        startTime: null,
        pausedDuration: 0,
        pauseStartTime: null,
        distanceKm: 0,
        currentPaceSecPerKm: 0,
        currentSpeedKmH: 0,
        isAutoPaused: false,
        lastSavedActivityId: null,
      }),

    setLastSavedActivityId: (id) => set({ lastSavedActivityId: id }),
  }))
)

// ── Helpers exportados ─────────────────────────────────────────────────────

export function formatPace(secPerKm: number): string {
  if (!secPerKm || !isFinite(secPerKm) || secPerKm <= 0) return '--:--'
  const m = Math.floor(secPerKm / 60)
  const s = Math.floor(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function getElapsedMs(
  startTime: number | null,
  pausedDuration: number,
  pauseStartTime: number | null
): number {
  if (!startTime) return 0
  const extra = pauseStartTime ? Date.now() - pauseStartTime : 0
  return Date.now() - startTime - pausedDuration - extra
}

export const ACTIVITY_META: Record<ActivityType, { label: string; emoji: string; icon: string }> = {
  run: { label: 'Corrida', emoji: '🏃', icon: '🏃' },
  cycling: { label: 'Ciclismo', emoji: '🚴', icon: '🚴' },
  walk: { label: 'Caminhada', emoji: '🚶', icon: '🚶' },
}