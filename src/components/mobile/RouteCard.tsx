'use client'

// ─────────────────────────────────────────────────────────────────────────────
// src/components/mobile/RouteCard.tsx
//
// Componente reutilizável de card de rota para o app mobile.
// Usado em: home/page.tsx, routes listing, feed.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'

type RouteCardProps = {
  id: string
  name: string
  description: string | null
  difficulty: string
  type: string
  distanceKm: string | null
  estimatedMinutes: number | null
  coverImageUrl: string | null
  organizationName: string | null
}

const difficultyLabel: Record<string, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
  extreme: 'Extremo',
}

const difficultyColor: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
  extreme: '#7c3aed',
}

const typeEmoji: Record<string, string> = {
  caminhada: '🥾',
  cicloturismo: '🚴',
  '4x4': '🚙',
  moto: '🏍️',
  outros: '🗺️',
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

export default function RouteCard({
  id,
  name,
  description,
  difficulty,
  type,
  distanceKm,
  estimatedMinutes,
  coverImageUrl,
  organizationName,
}: RouteCardProps) {
  const color = difficultyColor[difficulty] ?? '#f59e0b'

  return (
    <Link href={`/routes/${id}`} className="block">
      <div
        className="bg-white rounded-3xl overflow-hidden transition-all active:scale-[0.98]"
        style={{ border: '1.5px solid #F0F0F0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        {/* ── FOTO DE CAPA ──────────────────────────────────── */}
        <div className="relative w-full overflow-hidden" style={{ height: '180px' }}>
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={name}
              className="w-full h-full object-cover"
              style={{ display: 'block' }}
            />
          ) : (
            /* Placeholder quando não há foto */
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #FFF0EB 0%, #FFD9C0 100%)',
              }}
            >
              <span style={{ fontSize: '2.5rem' }}>{typeEmoji[type] ?? '🗺️'}</span>
              <span className="text-xs font-bold" style={{ color: '#E05300', opacity: 0.5 }}>
                Sem foto de capa
              </span>
            </div>
          )}

          {/* Gradiente suave na base da imagem para legibilidade */}
          {coverImageUrl && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 45%, transparent 100%)',
              }}
            />
          )}

          {/* Badge de dificuldade — canto superior esquerdo */}
          <div
            className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black"
            style={{
              background: 'rgba(255,255,255,0.92)',
              color: color,
              backdropFilter: 'blur(6px)',
              border: `1.5px solid ${color}30`,
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: color }}
            />
            {difficultyLabel[difficulty] ?? difficulty}
          </div>

          {/* Badge da organização — canto superior direito */}
          {organizationName && (
            <div
              className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
              style={{
                background: 'rgba(224,83,0,0.88)',
                color: 'white',
                backdropFilter: 'blur(6px)',
              }}
            >
              {organizationName}
            </div>
          )}

          {/* Nome da rota sobre a foto (apenas quando tem imagem) */}
          {coverImageUrl && (
            <div className="absolute bottom-3 left-4 right-4">
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                {typeEmoji[type]} {type}
              </p>
              <h3 className="font-black text-white text-base leading-snug drop-shadow-sm line-clamp-1">
                {name}
              </h3>
            </div>
          )}
        </div>

        {/* ── INFORMAÇÕES ABAIXO DA FOTO ────────────────────── */}
        <div className="px-4 pt-3 pb-4">
          {/* Título (quando NÃO tem foto — já aparece sobre a imagem quando tem) */}
          {!coverImageUrl && (
            <>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {typeEmoji[type]} {type}
                </span>
              </div>
              <h3 className="font-black text-gray-900 text-base leading-snug mb-1 line-clamp-2">
                {name}
              </h3>
            </>
          )}

          {/* Descrição */}
          {description && (
            <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">
              {description}
            </p>
          )}

          {/* Stats + botão */}
          <div className="flex items-center gap-3 mt-1">
            {distanceKm && (
              <div className="flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#E05300"
                  strokeWidth="2.5"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="text-xs font-bold text-gray-500">{distanceKm} km</span>
              </div>
            )}

            {estimatedMinutes && (
              <div className="flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#E05300"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-xs font-bold text-gray-500">
                  {formatDuration(estimatedMinutes)}
                </span>
              </div>
            )}

            {/* Botão Iniciar — empurrado para a direita */}
            <div className="ml-auto">
              <div
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black text-white"
                style={{
                  background: 'linear-gradient(135deg, #830200, #E05300)',
                }}
              >
                Iniciar
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}