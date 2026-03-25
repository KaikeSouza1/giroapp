import { pgTable, uuid, text, varchar, timestamp, 
         boolean, numeric, integer, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const routeStatusEnum = pgEnum('route_status', ['draft', 'published', 'archived'])
export const checkinStatusEnum = pgEnum('checkin_status', ['pending', 'approved', 'rejected'])
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard', 'extreme'])

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
  difficulty: difficultyEnum('difficulty').default('medium'),
  status: routeStatusEnum('status').default('draft'),
  distanceKm: numeric('distance_km', { precision: 8, scale: 2 }),
  estimatedMinutes: integer('estimated_minutes'),

  // Ponto de início da rota
  startLatitude: numeric('start_latitude', { precision: 10, scale: 7 }),
  startLongitude: numeric('start_longitude', { precision: 10, scale: 7 }),

  createdByAdminId: uuid('created_by_admin_id').references(() => users.id),
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

// ─── REGISTRO DE PASSAGEM (Check-in) ─────────────────────────────────────────

export const checkins = pgTable('checkins', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Chaves de origem — permite rastrear de qual dispositivo/sessão veio
  localId: uuid('local_id').notNull().unique(),   // ID gerado offline no SQLite
  userId: uuid('user_id').notNull().references(() => users.id),
  waypointId: uuid('waypoint_id').notNull().references(() => waypoints.id),
  routeSessionId: uuid('route_session_id').notNull(),  // agrupa check-ins de uma trilha

  // Localização no momento do check-in
  capturedLatitude: numeric('captured_latitude', { precision: 10, scale: 7 }).notNull(),
  capturedLongitude: numeric('captured_longitude', { precision: 10, scale: 7 }).notNull(),
  distanceFromWaypointMeters: numeric('distance_from_waypoint_meters', { precision: 8, scale: 2 }),

  // Anti-fraude biométrico
  selfieImagePath: text('selfie_image_path').notNull(),
  biometricScore: numeric('biometric_score', { precision: 5, scale: 4 }),  // 0.0000 ~ 1.0000
  biometricStatus: checkinStatusEnum('biometric_status').default('pending'),
  biometricValidatedAt: timestamp('biometric_validated_at'),

  // Timestamps duplos: quando aconteceu offline vs quando chegou ao servidor
  capturedAtOffline: timestamp('captured_at_offline').notNull(),  // hora real do evento
  syncedAt: timestamp('synced_at').defaultNow(),                  // hora que chegou ao servidor

  metadata: jsonb('metadata'),   // dados extras (modelo do device, versão do app, etc.)
})

// ─── SESSÕES DE ROTA (agrupador de check-ins) ────────────────────────────────

export const routeSessions = pgTable('route_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  localId: uuid('local_id').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id),
  routeId: uuid('route_id').notNull().references(() => routes.id),
  status: varchar('status', { length: 20 }).default('in_progress'), // in_progress | completed | abandoned
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  totalDistanceKm: numeric('total_distance_km', { precision: 8, scale: 2 }),
})

// ─── INSÍGNIAS (Badges) ───────────────────────────────────────────────────────

export const badges = pgTable('badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url').notNull(),
  type: varchar('type', { length: 30 }).default('route_completion'), // route_completion | milestone | special
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

export const usersRelations = relations(users, ({ many }) => ({
  checkins: many(checkins),
  routeSessions: many(routeSessions),
  userBadges: many(userBadges),
  followers: many(followers, { relationName: 'following' }),
  following: many(followers, { relationName: 'followers' }),
}))

export const routesRelations = relations(routes, ({ many, one }) => ({
  waypoints: many(waypoints),
  sessions: many(routeSessions),
  badge: one(badges, { fields: [routes.id], references: [badges.routeId] }),
}))

export const waypointsRelations = relations(waypoints, ({ one, many }) => ({
  route: one(routes, { fields: [waypoints.routeId], references: [routes.id] }),
  checkins: many(checkins),
}))