'use client'
import { useTema } from '@/lib/tema'

// Switch claro/oscuro reutilizable -- vive en el sidebar del dashboard (siempre visible) y se
// puede reusar en páginas públicas si hace falta más adelante.
export function SelectorTema({ compacto = false }: { compacto?: boolean }) {
  const { modo, T, alternar } = useTema()
  const esOscuro = modo === 'oscuro'

  return (
    <button
      onClick={alternar}
      title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: compacto ? 'auto' : '100%',
        padding: compacto ? '6px' : '8px 10px',
        background: T.card2, border: `1px solid ${T.border}`, borderRadius: '8px',
        color: T.text, fontSize: '12px', cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '14px' }}>{esOscuro ? '🌙' : '☀️'}</span>
      {!compacto && <span>{esOscuro ? 'Modo oscuro' : 'Modo claro'}</span>}
    </button>
  )
}
