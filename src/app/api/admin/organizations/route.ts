import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { organizations, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select().from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)

    if (!dbUser || dbUser.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const allOrgs = await db.select().from(organizations)
    return NextResponse.json(allOrgs)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select().from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)
    if (!dbUser || dbUser.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, slug, logoUrl, adminEmail, adminPassword } = body

    if (!name || !slug || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    // 1. Cria a Organização no banco
    const [newOrg] = await db.insert(organizations).values({
      name,
      slug,
      logoUrl: logoUrl || null,
      isActive: true
    }).returning()

    // 2. Cria o Usuário do cliente no Supabase Auth (usando Admin Client para não precisar confirmar email)
    const adminSupabase = createAdminClient()
    const { data: authData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true // Já cria o e-mail como confirmado
    })

    if (createAuthError) {
      // Se der erro no Auth, retorna o erro (em um app real faríamos rollback da org)
      return NextResponse.json({ error: `Erro no Auth: ${createAuthError.message}` }, { status: 400 })
    }

    // 3. Vincula esse novo usuário como Admin da Organização na nossa tabela
    await db.insert(users).values({
      supabaseAuthId: authData.user.id,
      email: adminEmail,
      username: `${slug}-admin-${Date.now().toString().slice(-4)}`, // Username único
      displayName: `Admin ${name}`,
      role: 'org_admin',
      organizationId: newOrg.id
    })

    return NextResponse.json(newOrg, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}