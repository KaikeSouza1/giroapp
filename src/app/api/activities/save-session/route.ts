import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js' // Mudamos para o client normal para poder injetar o Token
import { db } from '@/lib/db/remote/client'
import { routeSessions, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // 1. Pega o Token do cabeçalho (Funciona perfeito no app Mobile)
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado (Token ausente)' }, { status: 401 })
    }

    // 2. Iniciar o Supabase usando o Token recebido do celular
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado (Token inválido)' }, { status: 401 })
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

    // 4. Fazer o Upload da Imagem para o Supabase Storage (se tiver)
    let finalImageUrl = null

    if (body.socialImageBase64) {
      const buffer = Buffer.from(body.socialImageBase64, 'base64')
      const fileName = `${dbUser.id}-${Date.now()}.png`

      const { error: uploadError } = await supabase.storage
        .from('giro-app')
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true
        })

      if (uploadError) {
        console.error("Erro no upload da imagem:", uploadError)
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('giro-app')
          .getPublicUrl(fileName)
          
        finalImageUrl = publicUrlData.publicUrl
      }
    }

    // 5. Salvar a sessão completa na nossa tabela do Drizzle
    const [novaSessao] = await db.insert(routeSessions).values({
      localId: uuidv4(),
      userId: dbUser.id,
      activityType: body.activityType || 'caminhada',
      status: 'concluido',
      startedAt: new Date(body.startedAt),
      completedAt: new Date(body.completedAt),
      totalDistanceKm: body.totalDistanceKm, // Já vem formatado
      durationSeconds: body.durationSeconds,
      averagePace: body.averagePace,
      pathCoordinates: body.pathCoordinates,
      socialImageUrl: finalImageUrl,
    }).returning() // Retorna a linha salva para pegarmos o ID

    // Devolvemos o ID para a tela de Resumo saber qual treino foi salvo
    return NextResponse.json({ success: true, id: novaSessao.id })

  } catch (error) {
    console.error('Erro fatal ao salvar a sessão:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}