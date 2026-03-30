// src/hooks/native/useGeolocation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Hook para acessar a geolocalização via plugin Capacitor.
//
// POR QUE IMPORT DINÂMICO?
// No Next.js, o código dos hooks é avaliado no servidor (SSR) durante o build.
// O Capacitor não existe no servidor — só no browser/nativo.
// Fazendo o import dentro da função (lazy), garantimos que ele só roda
// quando o usuário realmente chama getPosition() no dispositivo.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'

// Tipagem manual para evitar import de tipos no topo do módulo
export type GeoPosition = {
  latitude: number
  longitude: number
  accuracy: number       // metros — quão preciso é o sinal GPS
  altitude: number | null
  timestamp: number      // Unix ms
}

export type GeolocationState = {
  position: GeoPosition | null
  loading: boolean
  error: string | null
  getPosition: () => Promise<GeoPosition | null>
}

export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getPosition = useCallback(async (): Promise<GeoPosition | null> => {
    setLoading(true)
    setError(null)

    try {
      // ── Import dinâmico: só carrega o plugin quando a função é chamada ──
      const { Geolocation } = await import('@capacitor/geolocation')

      // No Android/iOS, isso abre o diálogo de permissão na primeira vez.
      // No browser (dev), usa a Geolocation API do navegador.
      const coords = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,   // usa GPS real (mais lento, mais preciso)
        timeout: 15000,             // desiste após 15 segundos
      })

      const result: GeoPosition = {
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
        accuracy: coords.coords.accuracy,
        altitude: coords.coords.altitude,
        timestamp: coords.timestamp,
      }

      setPosition(result)
      return result

    } catch (err: any) {
      // Capacitor retorna mensagens específicas por plataforma
      const message = translateGeolocationError(err?.message ?? 'Erro desconhecido')
      setError(message)
      return null

    } finally {
      setLoading(false)
    }
  }, [])

  return { position, loading, error, getPosition }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Traduz as mensagens de erro técnicas do plugin para português legível.
 * Os códigos variam por plataforma, então verificamos por substring.
 */
function translateGeolocationError(message: string): string {
  const m = message.toLowerCase()

  if (m.includes('permission') || m.includes('denied')) {
    return 'Permissão de localização negada. Ative nas configurações do dispositivo.'
  }
  if (m.includes('timeout')) {
    return 'GPS demorou demais para responder. Tente em um local com sinal melhor.'
  }
  if (m.includes('unavailable') || m.includes('position unavailable')) {
    return 'Localização indisponível. Verifique se o GPS está ativado.'
  }

  return `Erro de localização: ${message}`
}