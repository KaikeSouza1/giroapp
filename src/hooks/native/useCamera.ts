// src/hooks/native/useCamera.ts
// ─────────────────────────────────────────────────────────────────────────────
// Hook para acessar a câmera via plugin Capacitor.
//
// FORMATOS SUPORTADOS:
//  - Base64: string codificada, fácil de salvar no SQLite e enviar via API.
//  - Uri (webPath): caminho do arquivo no dispositivo, bom para <img src>.
//
// O hook retorna AMBOS para máxima flexibilidade:
//  - Use base64 → para salvar no SQLite e sincronizar com Supabase.
//  - Use webPath → para exibir a prévia na tela instantaneamente.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'

export type CapturedPhoto = {
  base64: string        // dados da imagem sem o prefixo "data:image/jpeg;base64,"
  webPath: string       // URI para usar diretamente em <img src={webPath} />
  mimeType: 'image/jpeg'
  size: 'large' | 'medio' | 'small' // qualidade aproximada usada
}

export type CameraState = {
  photo: CapturedPhoto | null
  loading: boolean
  error: string | null
  takePhoto: (quality?: 'large' | 'medio' | 'small') => Promise<CapturedPhoto | null>
  openGallery: () => Promise<CapturedPhoto | null>
  clearPhoto: () => void
}

// Mapa de qualidade → número (0-100) esperado pelo plugin
const QUALITY_MAP = {
  large: 90,   // trilha: mais qualidade para identificação facial
  medium: 75,  // padrão para check-ins
  small: 50,   // thumbnails e previews
} as const

export function useCamera(): CameraState {
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Função interna compartilhada entre câmera e galeria ──────────────────
  const capture = useCallback(
    async (source: 'camera' | 'gallery', quality: 'large' | 'medio' | 'small' = 'medio'): Promise<CapturedPhoto | null> => {
      setLoading(true)
      setError(null)

      try {
        // Import dinâmico — mesmo motivo do useGeolocation
        const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera')

        const image = await Camera.getPhoto({
          // ResultType.Base64 → retorna a string base64 diretamente
          // ResultType.Uri    → retorna um caminho de arquivo local
          // Pedimos os DOIS via DataUrl para ter ambos sem chamadas extras
          resultType: CameraResultType.DataUrl,

          source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,

          quality: QUALITY_MAP[quality],

          // Redimensionamento automático — economiza espaço no SQLite
          // e acelera o upload posterior para o Supabase
          width: quality === 'large' ? 1280 : quality === 'medio' ? 960 : 640,
          height: quality === 'large' ? 1280 : quality === 'medio' ? 960 : 640,

          // Corrige automaticamente a orientação EXIF (evita foto de lado)
          correctOrientation: true,
        })

        // image.dataUrl vem como "data:image/jpeg;base64,XXXXX..."
        // Precisamos remover o prefixo para salvar só os bytes no SQLite
        const dataUrl = image.dataUrl ?? ''
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')

        // webPath é o URI local — pode ser usado diretamente em <img src>
        // No browser de dev, o dataUrl também serve como src
        const webPath = image.webPath ?? dataUrl

        const result: CapturedPhoto = {
          base64,
          webPath,
          mimeType: 'image/jpeg',
          size: quality,
        }

        setPhoto(result)
        return result

      } catch (err: any) {
        // O usuário cancelou a câmera — não é um erro real
        if (
          err?.message?.includes('cancelado') ||
          err?.message?.includes('canceled') ||
          err?.message?.includes('No image picked') ||
          err?.message?.includes('User cancelled')
        ) {
          // Cancela silenciosamente sem mostrar erro na tela
          return null
        }

        const message = translateCameraError(err?.message ?? 'Erro desconhecido')
        setError(message)
        return null

      } finally {
        setLoading(false)
      }
    },
    []
  )

  const takePhoto = useCallback(
    (quality: 'large' | 'medio' | 'small' = 'medio') => capture('camera', quality),
    [capture]
  )

  const openGallery = useCallback(
    () => capture('gallery', 'medio'),
    [capture]
  )

  const clearPhoto = useCallback(() => {
    setPhoto(null)
    setError(null)
  }, [])

  return { photo, loading, error, takePhoto, openGallery, clearPhoto }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function translateCameraError(message: string): string {
  const m = message.toLowerCase()

  if (m.includes('permission') || m.includes('denied')) {
    return 'Permissão de câmera negada. Ative nas configurações do dispositivo.'
  }
  if (m.includes('not available') || m.includes('not supported')) {
    return 'Câmera não disponível neste dispositivo.'
  }

  return `Erro na câmera: ${message}`
}