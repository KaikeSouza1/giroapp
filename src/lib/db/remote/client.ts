// src/lib/db/remote/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  connection: postgres.Sql | undefined
}

// Adicionamos prepare: false para compatibilidade com o Supavisor/Connection Pooling
const connection =
  globalForDb.connection ??
  postgres(process.env.DATABASE_URL!, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, 
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.connection = connection
}

export const db = drizzle(connection, { schema })