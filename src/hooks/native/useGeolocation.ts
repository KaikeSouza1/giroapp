import { useState, useEffect } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { Coordinate, useActivityStore } from '@/store/activityStore'

export function useGeolocation() {
  const [location, setLocation] = useState<Coordinate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let watchId: string | null = null

    async function startWatch() {
      try {
        
        const perm = await Geolocation.checkPermissions()
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions()
          if (req.location !== 'granted') {
            setError('Permissão de localização negada.')
            return
          }
        }

        
        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0, 
          },
          (position, err) => {
            if (err) {
              console.error('Erro no GPS:', err)
              setError(err.message)
              return
            }

            if (position) {
              const coord: Coordinate = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
                altitude: position.coords.altitude,
              }
              
              
              
              if (coord.lat === 0 && coord.lng === 0) return
              
              
              if (coord.accuracy > 100) return

              setLocation(coord)

              
              if (useActivityStore.getState().status === 'running') {
                useActivityStore.getState().addCoordinate(coord)
              }
            }
          }
        )
      } catch (e: any) {
        setError(e.message)
      }
    }

    startWatch()

    return () => {
      
      if (watchId) Geolocation.clearWatch({ id: watchId })
    }
  }, [])

  return { location, error }
}