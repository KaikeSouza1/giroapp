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
        // 1. Pede permissão de GPS
        const perm = await Geolocation.checkPermissions()
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions()
          if (req.location !== 'granted') {
            setError('Permissão de localização negada.')
            return
          }
        }

        // 2. Começa a "ouvir" o GPS do celular com alta precisão
        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0, // Não usa cache, pega a posição real de agora
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
              
              // 🛡️ ANTI-BUGS DE GPS:
              // 1. Ignora a "Ilha Nula" (0,0)
              if (coord.lat === 0 && coord.lng === 0) return
              
              // 2. Ignora se o GPS estiver muito impreciso (margem de erro maior que 100 metros)
              if (coord.accuracy > 100) return

              setLocation(coord)

              // Só adiciona a coordenada no histórico se a atividade estiver rodando (nem pausada, nem parada)
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
      // Limpa o ouvinte quando o usuário sair da tela
      if (watchId) Geolocation.clearWatch({ id: watchId })
    }
  }, [])

  return { location, error }
}