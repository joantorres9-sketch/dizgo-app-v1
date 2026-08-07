'use client'
import { useState } from 'react'
import Link from 'next/link'

const C = { verde:'#2DD4A0', card:'#111520', borde:'rgba(255,255,255,0.07)', texto:'#E8EDF5', sub:'#8B96A8' }

// Checklist de bienvenida para usuarios de cortesía — el tenant llega pre-cargado con datos demo
// (sembrarTenantDemo) y sin esta guía un usuario nuevo no sabe qué mirar primero. Enlaza directo
// a los módulos con más "chicha" para que la primera impresión sea rápida.
const PASOS_GUIA = [
  { href: '/dashboard/pedidos', icon: '📦', label: 'Pedidos', desc: '~528 pedidos de ejemplo con estados reales — mira el flujo completo de gestión.' },
  { href: '/dashboard/pyg', icon: '🏛️', label: 'P&G Dashboard', desc: 'Ventas, ganancia y márgenes de 6 meses ya calculados.' },
  { href: '/dashboard/pauta', icon: '📡', label: 'Pauta Meta/TikTok', desc: '12 campañas con CPA, CTR y ROAS reales — así se ve tu inversión publicitaria.' },
  { href: '/dashboard/nomina', icon: '👥', label: 'Nómina', desc: 'Colaboradores de ejemplo con nómina calculada por país.' },
  { href: '/dashboard/bodega', icon: '🏭', label: 'Bodega', desc: 'Inventario inicial en dos bodegas — prueba la carga masiva de compras.' },
  { href: '/dashboard/metas', icon: '🎯', label: 'Metas', desc: 'Objetivos progresivos de 6 meses ya cargados.' },
  { href: '/dashboard/alertas', icon: '🚨', label: 'Alertas', desc: '8 alertas reales de ejemplo por módulo, para que veas cómo te avisa DIZGO.' },
  { href: '/dashboard/admin', icon: '⚙️', label: 'Superadmin', desc: 'Cuando termines de explorar, aquí está el botón para borrar los datos de prueba.' },
]

export function GuiaBienvenida() {
  const [cerrada, setCerrada] = useState(() => typeof window !== 'undefined' && localStorage.getItem('dizgo_guia_bienvenida_cerrada') === '1')

  if (cerrada) return null

  function cerrar() {
    localStorage.setItem('dizgo_guia_bienvenida_cerrada', '1')
    setCerrada(true)
  }

  return (
    <div className="no-print" style={{ background: C.card, border: `1px solid ${C.borde}`, borderLeft: `3px solid ${C.verde}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: C.texto }}>🎁 Bienvenido a tu DIZGO de prueba</div>
          <div style={{ fontSize: '11.5px', color: C.sub, marginTop: '2px' }}>Tu tienda ya viene con datos de ejemplo. Explora estos módulos para ver todo lo que DIZGO puede hacer:</div>
        </div>
        <button onClick={cerrar} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>✕ Ocultar</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px' }}>
        {PASOS_GUIA.map(p => (
          <Link key={p.href} href={p.href} style={{ textDecoration: 'none', display: 'flex', gap: '8px', padding: '9px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <span style={{ fontSize: '15px', flexShrink: 0 }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: C.texto }}>{p.label}</div>
              <div style={{ fontSize: '10.5px', color: C.sub, lineHeight: 1.4 }}>{p.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
