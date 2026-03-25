import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { supabaseAuthId, selfiePath } = await request.json()

    await db.update(users)
      .set({ referenceSelfiePath: selfiePath, isSelfieCaptured: true })
      .where(eq(users.supabaseAuthId, supabaseAuthId))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

---

## Último passo — Crie o bucket no Supabase

1. No painel do Supabase vá em **Storage**
2. Clique em **New bucket**
3. Nome: `giro-media`
4. Marque como **Public** (para as fotos dos waypoints) ou **Private** (para selfies) — recomendo **Private**
5. Clique em **Save**

---

## Resumo do que foi criado
```
✅ src/app/(mobile)/layout.tsx
✅ src/app/(mobile)/(auth)/login/page.tsx
✅ src/app/(mobile)/(auth)/register/page.tsx
✅ src/app/(mobile)/(auth)/selfie/page.tsx
✅ src/app/api/users/create/route.ts
✅ src/app/api/users/update-selfie/route.ts