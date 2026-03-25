// Schema local — é um SUBSET do PostgreSQL.
// Armazena apenas o necessário para funcionar 100% offline.

export const LOCAL_SCHEMA_SQL = `
  -- Dados das rotas baixados do servidor (cache)
  CREATE TABLE IF NOT EXISTS local_routes (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    difficulty  TEXT,
    cover_image_blob BLOB,       -- imagem armazenada localmente!
    distance_km REAL,
    cached_at   TEXT NOT NULL    -- ISO timestamp de quando foi cacheado
  );

  -- Waypoints baixados do servidor
  CREATE TABLE IF NOT EXISTS local_waypoints (
    id              TEXT PRIMARY KEY,
    route_id        TEXT NOT NULL,
    sort_order      INTEGER NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    radius_meters   INTEGER DEFAULT 50,
    requires_selfie INTEGER DEFAULT 1,
    FOREIGN KEY (route_id) REFERENCES local_routes(id)
  );

  -- FILA DE SINCRONIZAÇÃO — coração do offline-first
  -- Cada ação offline vira uma linha aqui com status 'pending'
  CREATE TABLE IF NOT EXISTS sync_queue (
    id            TEXT PRIMARY KEY,    -- UUID local gerado na hora
    entity_type   TEXT NOT NULL,       -- 'checkin' | 'route_session'
    payload       TEXT NOT NULL,       -- JSON serializado com TODOS os dados
    status        TEXT DEFAULT 'pending',  -- pending | syncing | synced | error
    attempts      INTEGER DEFAULT 0,
    last_error    TEXT,
    created_at    TEXT NOT NULL,       -- quando o evento aconteceu offline
    synced_at     TEXT                 -- quando foi confirmado pelo servidor
  );

  -- Sessões de rota iniciadas offline
  CREATE TABLE IF NOT EXISTS local_sessions (
    id          TEXT PRIMARY KEY,
    route_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    status      TEXT DEFAULT 'in_progress',
    started_at  TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (route_id) REFERENCES local_routes(id)
  );

  -- Check-ins capturados offline
  CREATE TABLE IF NOT EXISTS local_checkins (
    id                  TEXT PRIMARY KEY,
    session_id          TEXT NOT NULL,
    waypoint_id         TEXT NOT NULL,
    latitude            REAL NOT NULL,
    longitude           REAL NOT NULL,
    selfie_image_base64 TEXT,          -- foto salva como base64 no SQLite
    captured_at         TEXT NOT NULL,
    sync_status         TEXT DEFAULT 'pending',  -- pending | synced
    FOREIGN KEY (session_id) REFERENCES local_sessions(id),
    FOREIGN KEY (waypoint_id) REFERENCES local_waypoints(id)
  );
`
