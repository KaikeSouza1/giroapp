import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { db } from '@/lib/db/remote/client'
import { routeSessions, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // 1. Iniciar o Supabase no lado do Servidor para checar a Autenticação
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // 2. Pegar o usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 3. Achar o ID interno do usuário no nosso banco (Drizzle) usando o ID do Supabase
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1)

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuário não encontrado no banco de dados' }, { status: 404 })
    }

    // 4. Fazer o Upload da Imagem para o Supabase Storage (se o usuário não tiver pulado a foto)
    let finalImageUrl = null

    if (body.socialImageBase64) {
      // Converte o texto Base64 em um Buffer de imagem
      const buffer = Buffer.from(body.socialImageBase64, 'base64')
      const fileName = `${dbUser.id}-${Date.now()}.png`

      // Faz o upload pro bucket "giro-app"
      const { error: uploadError } = await supabase.storage
        .from('giro-app')
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true
        })

      if (uploadError) {
        console.error("Erro no upload da imagem:", uploadError)
        // Não vamos travar a API se a imagem falhar, apenas deixamos a URL como null
      } else {
        // Pega o link público da imagem salva no bucket "giro-app"
        const { data: publicUrlData } = supabase.storage
          .from('giro-app')
          .getPublicUrl(fileName)
          
        finalImageUrl = publicUrlData.publicUrl
      }
    }

    // 5. Salvar a sessão completa na nossa tabela do Drizzle
    await db.insert(routeSessions).values({
      localId: uuidv4(), // Geramos um ID único para essa sessão
      userId: dbUser.id,
      activityType: body.activityType || 'caminhada',
      status: 'concluido', // Como ele chegou na tela de share, o treino acabou
      startedAt: new Date(body.startedAt),
      completedAt: new Date(body.completedAt),
      totalDistanceKm: body.totalDistanceKm, // String numérica ("5.20")
      durationSeconds: body.durationSeconds,
      averagePace: body.averagePace,
      pathCoordinates: body.pathCoordinates, // JSON com todas as coordenadas!
      socialImageUrl: finalImageUrl,
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erro fatal ao salvar a sessão:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}