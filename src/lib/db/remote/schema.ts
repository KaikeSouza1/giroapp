import { pgTable, uuid, text, varchar, timestamp, 
         boolean, numeric, integer, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── ENUMS (Tipos Traduzidos para Português) ─────────────────────────────────

export const routeStatusEnum = pgEnum('route_status', ['rascunho', 'publicado', 'arquivado'])
export const checkinStatusEnum = pgEnum('checkin_status', ['pendente', 'aprovado', 'rejeitado'])
export const difficultyEnum = pgEnum('difficulty', ['facil', 'medio', 'dificil', 'extremo'])
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin_org', 'usuario'])
export const routeTypeEnum = pgEnum('route_type', ['caminhada', 'corrida', 'cicloturismo', '4x4', 'moto', 'outros']) // Adicionado corrida
export const sessionStatusEnum = pgEnum('session_status', ['em_andamento', 'pausado', 'concluido', 'cancelado'])

// ─── ORGANIZAÇÕES (SaaS) ──────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 150 }).notNull().unique(),
  logoUrl: text('logo_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── USUÁRIOS ─────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  supabaseAuthId: uuid('supabase_auth_id').notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),

  // Anti-fraude: selfie de referência cadastrada no onboarding
  referenceSelfiePath: text('reference_selfie_path'),
  isSelfieCaptured: boolean('is_selfie_captured').default(false),

  isEmailVerified: boolean('is_email_verified').default(false),
  isActive: boolean('is_active').default(true),
  isAdmin: boolean('is_admin').default(false),

  // Campos SaaS
  role: userRoleEnum('role').default('usuario').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── SEGUIDORES (Social) ──────────────────────────────────────────────────────

export const followers = pgTable('followers', {
  id: uuid('id').primaryKey().defaultRandom(),
  followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── ROTAS ───────────────────────────────────────────────────────────────────

export const routes = pgTable('routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 200 }).notNull().unique(),
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  difficulty: difficultyEnum('difficulty').default('medio'),
  status: routeStatusEnum('status').default('rascunho'),
  distanceKm: numeric('distance_km', { precision: 8, scale: 2 }),
  estimatedMinutes: integer('estimated_minutes'),

  // Ponto de início da rota
  startLatitude: numeric('start_latitude', { precision: 10, scale: 7 }),
  startLongitude: numeric('start_longitude', { precision: 10, scale: 7 }),

  createdByAdminId: uuid('created_by_admin_id').references(() => users.id),

  // Campos SaaS
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  type: routeTypeEnum('type').default('caminhada').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── WAYPOINTS (Pontos da Rota) ───────────────────────────────────────────────

export const waypoints = pgTable('waypoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),           // sequência: 1, 2, 3...
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  radiusMeters: integer('radius_meters').default(50),  // raio de validação GPS
  requiresSelfie: boolean('requires_selfie').default(true),
  photoUrl: text('photo_url'),                 // foto de referência do local
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── REGISTRO DE PASSAGEM (Check-in de Waypoints) ────────────────────────────

export const checkins = pgTable('checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  localId: uuid('local_id').notNull().unique(),   
  userId: uuid('user_id').notNull().references(() => users.id),
  waypointId: uuid('waypoint_id').notNull().references(() => waypoints.id),
  routeSessionId: uuid('route_session_id').notNull(), 

  capturedLatitude: numeric('captured_latitude', { precision: 10, scale: 7 }).notNull(),
  capturedLongitude: numeric('captured_longitude', { precision: 10, scale: 7 }).notNull(),
  distanceFromWaypointMeters: numeric('distance_from_waypoint_meters', { precision: 8, scale: 2 }),

  selfieImagePath: text('selfie_image_path').notNull(),
  biometricScore: numeric('biometric_score', { precision: 5, scale: 4 }), 
  biometricStatus: checkinStatusEnum('biometric_status').default('pendente'),
  biometricValidatedAt: timestamp('biometric_validated_at'),

  capturedAtOffline: timestamp('captured_at_offline').notNull(),  
  syncedAt: timestamp('synced_at').defaultNow(),                  

  metadata: jsonb('metadata'),   
})

// ─── SESSÕES DE ATIVIDADE (O "STRAVA" TRACKER) ───────────────────────────────

export const routeSessions = pgTable('route_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  localId: uuid('local_id').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id),
  
  // Opcional: O usuário pode fazer um "Treino Livre" sem seguir uma rota do app
  routeId: uuid('route_id').references(() => routes.id), 
  activityType: routeTypeEnum('activity_type').default('caminhada'),
  
  status: sessionStatusEnum('status').default('em_andamento'),
  
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  
  // --- MÉTRICAS REAIS DO TRACKING ---
  totalDistanceKm: numeric('total_distance_km', { precision: 8, scale: 2 }),
  durationSeconds: integer('duration_seconds'), // Tempo real de movimento (exclui auto-pause)
  averagePace: varchar('average_pace', { length: 15 }), // ex: "05:30/km"
  
  // --- O OURO: DADOS DO MAPA E COMPARTILHAMENTO ---
  // Guarda um array gigante com o histórico de GPS: [{lat, lng, timestamp, speed}]
  pathCoordinates: jsonb('path_coordinates'), 
  
  // A URL da imagem irada gerada no final com os dados + mapa para o Instagram
  socialImageUrl: text('social_image_url'),
})

// ─── INSÍGNIAS (Badges) ───────────────────────────────────────────────────────

export const badges = pgTable('badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url').notNull(),
  type: varchar('type', { length: 30 }).default('conclusao_rota'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const userBadges = pgTable('user_badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  badgeId: uuid('badge_id').notNull().references(() => badges.id),
  routeSessionId: uuid('route_session_id').references(() => routeSessions.id),
  awardedAt: timestamp('awarded_at').defaultNow().notNull(),
})

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  routes: many(routes),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, { fields: [users.organizationId], references: [organizations.id] }),
  checkins: many(checkins),
  routeSessions: many(routeSessions),
  userBadges: many(userBadges),
  followers: many(followers, { relationName: 'following' }),
  following: many(followers, { relationName: 'followers' }),
}))

export const routesRelations = relations(routes, ({ many, one }) => ({
  organization: one(organizations, { fields: [routes.organizationId], references: [organizations.id] }),
  waypoints: many(waypoints),
  sessions: many(routeSessions),
  badge: one(badges, { fields: [routes.id], references: [badges.routeId] }),
}))

export const waypointsRelations = relations(waypoints, ({ one, many }) => ({
  route: one(routes, { fields: [waypoints.routeId], references: [routes.id] }),
  checkins: many(checkins),
}))