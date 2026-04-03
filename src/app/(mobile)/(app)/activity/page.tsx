'use client'

import { useRouter } from 'next/navigation'
import { useActivityStore, ActivityType } from '@/store/activityStore'

const TYPES: { type: ActivityType; label: string; emoji: string; desc: string; color: string }[] = [
  { type: 'corrida', label: 'Corrida', emoji: '🏃', desc: 'Registre sua corrida ao ar livre', color: '#E05300' },
  { type: 'cicloturismo', label: 'Ciclismo', emoji: '🚴', desc: 'Pedal urbano ou trilha off-road', color: '#3B82F6' },
  { type: 'caminhada', label: 'Caminhada', emoji: '🚶', desc: 'Registre seu passeio ou trilha leve', color: '#22C55E' },
]

export default function ActivitySetupPage() {
  const router = useRouter()
  const { activityType, setActivityType, resetActivity } = useActivityStore()

  function handleSelect(type: ActivityType) {
    resetActivity()
    setActivityType(type)
  }

  function handleStart() {
    if (!activityType) return
    router.push('/activity/record')
  }

  return (
    <div
      className="min-h-screen flex flex-col font-[family-name:var(--font-dm)]"
      style={{ background: '#0A0A0A' }}
    >
      {/* Glow hero */}
      <div className="relative overflow-hidden px-6 pt-14 pb-10">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(224,83,0,0.25) 0%, transparent 70%)',
          }}
        />
        <button
          onClick={() => router.back()}
          className="relative z-10 mb-6 flex items-center gap-2 text-white/50 text-sm font-semibold"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Voltar
        </button>
        <p className="relative text-white/40 text-xs font-bold uppercase tracking-widest mb-1">
          Nova Atividade
        </p>
        <h1 className="relative text-white font-black text-4xl leading-none">
          Qual o treino
          <br />
          de hoje?
        </h1>
      </div>

      {/* Type selector */}
      <div className="flex-1 px-5 flex flex-col gap-3">
        {TYPES.map((a) => {
          const active = activityType === a.type
          return (
            <button
              key={a.type}
              onClick={() => handleSelect(a.type)}
              className="w-full text-left rounded-3xl transition-all duration-200 active:scale-[0.97] overflow-hidden"
              style={{
                background: active
                  ? `linear-gradient(135deg, ${a.color}33 0%, ${a.color}18 100%)`
                  : 'rgba(255,255,255,0.05)',
                border: active ? `1.5px solid ${a.color}80` : '1.5px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-4 p-5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{
                    background: active ? `${a.color}25` : 'rgba(255,255,255,0.07)',
                  }}
                >
                  {a.emoji}
                </div>
                <div className="flex-1">
                  <p className="font-black text-white text-xl">{a.label}</p>
                  <p className="text-white/40 text-sm mt-0.5 font-medium">{a.desc}</p>
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: active ? a.color : 'rgba(255,255,255,0.08)',
                    border: active ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                  }}
                >
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>

              {active && (
                <div
                  className="h-0.5 mx-5 mb-4 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${a.color}, transparent)` }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* CTA */}
      <div className="px-5 pb-12 pt-6">
        <button
          onClick={handleStart}
          disabled={!activityType}
          className="w-full py-5 rounded-3xl text-white font-black text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-25"
          style={{
            background: activityType
              ? 'linear-gradient(135deg, #830200 0%, #E05300 55%, #FF8C00 100%)'
              : 'rgba(255,255,255,0.1)',
            boxShadow: activityType ? '0 8px 32px rgba(224,83,0,0.35)' : 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          {activityType
            ? `Iniciar ${TYPES.find((t) => t.type === activityType)?.label}`
            : 'Selecione uma atividade'}
        </button>
      </div>
    </div>
  )
}