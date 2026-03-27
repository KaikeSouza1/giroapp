// src/lib/supabase/storage.ts
import { createClient } from '@supabase/supabase-js'

// Criamos um cliente Supabase exclusivo para o navegador usando as chaves públicas
// Isso evita o erro de "next/headers" em Client Components
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Faz o upload de um arquivo para o Supabase Storage e retorna a URL pública.
 * Seguro para ser chamado diretamente de um 'use client' (Client Component).
 */
export async function uploadImageToBucket(
  file: File, 
  bucketName: string = 'giro-app', // <-- AGORA SIM, COM HÍFEN!
  folderPath: string = 'routes'
): Promise<string> {
    
  // Cria um nome único para o arquivo
  const fileExtension = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`
  const filePath = `${folderPath}/${fileName}`

  // Faz o upload direto do navegador para o Supabase
  const { data, error } = await supabaseClient.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Erro no upload da imagem:', error)
    throw new Error('Falha ao fazer upload da imagem.')
  }

  // Pega a URL pública gerada
  const { data: publicUrlData } = supabaseClient.storage
    .from(bucketName)
    .getPublicUrl(filePath)

  return publicUrlData.publicUrl
}