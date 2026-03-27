// src/lib/supabase/client.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // Adicionada a tipagem exata aqui para calar o TypeScript 👇
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // Ignorado de propósito: este erro acontece quando tentamos
            // setar cookies de dentro de um Server Component. O Middleware
            // do Supabase lida com a atualização correta da sessão.
          }
        },
      },
    }
  )
}