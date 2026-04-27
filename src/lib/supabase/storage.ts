
import { createClient } from '@supabase/supabase-js'



const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)


export async function uploadImageToBucket(
  file: File, 
  bucketName: string = 'giro-app', 
  folderPath: string = 'routes'
): Promise<string> {
    
  
  const fileExtension = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`
  const filePath = `${folderPath}/${fileName}`

  
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

  
  const { data: publicUrlData } = supabaseClient.storage
    .from(bucketName)
    .getPublicUrl(filePath)

  return publicUrlData.publicUrl
}