












import { useState, useCallback } from 'react'

export type CapturedPhoto = {
  base64: string        
  webPath: string       
  mimeType: 'image/jpeg'
  size: 'large' | 'medium' | 'small' 
}

export type CameraState = {
  photo: CapturedPhoto | null
  loading: boolean
  error: string | null
  takePhoto: (quality?: 'large' | 'medium' | 'small') => Promise<CapturedPhoto | null>
  openGallery: () => Promise<CapturedPhoto | null>
  clearPhoto: () => void
}


const QUALITY_MAP = {
  large: 90,   
  medium: 75,  
  small: 50,   
} as const

export function useCamera(): CameraState {
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  
  const capture = useCallback(
    async (source: 'camera' | 'gallery', quality: 'large' | 'medium' | 'small' = 'medium'): Promise<CapturedPhoto | null> => {
      setLoading(true)
      setError(null)

      try {
        
        const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera')

        const image = await Camera.getPhoto({
          
          
          
          resultType: CameraResultType.DataUrl,

          source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,

          quality: QUALITY_MAP[quality],

          
          
          width: quality === 'large' ? 1280 : quality === 'medium' ? 960 : 640,
          height: quality === 'large' ? 1280 : quality === 'medium' ? 960 : 640,

          
          correctOrientation: true,
        })

        
        
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
        
        if (
          err?.message?.includes('cancelled') ||
          err?.message?.includes('canceled') ||
          err?.message?.includes('No image picked') ||
          err?.message?.includes('User cancelled')
        ) {
          
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
    (quality: 'large' | 'medium' | 'small' = 'medium') => capture('camera', quality),
    [capture]
  )

  const openGallery = useCallback(
    () => capture('gallery', 'medium'),
    [capture]
  )

  const clearPhoto = useCallback(() => {
    setPhoto(null)
    setError(null)
  }, [])

  return { photo, loading, error, takePhoto, openGallery, clearPhoto }
}



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