'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const C = { verde:'#2DD4A0', card:'#111520', borde:'rgba(255,255,255,0.07)', texto:'#E8EDF5', sub:'#8B96A8', accent:'#F58720' }

type PasoSetup = { key: string; href: string; icon: string; label: string; hecho: boolean; detalle: string }

// Guía de costeo -- muchas tiendas venden por Dropi/Shopify sin haber costeado nunca de
// verdad. Después de cargar pedidos (que crea productos "en blanco" en el Catálogo) esta
// guía los lleva paso a paso: costear productos -> costos fijos -> nómina -> publicidad, y
// luego -- una vez lo básico está listo -- a simular precio y revisar el punto de equilibrio.
// No se oculta de forma permanente mientras falte algo, para no dejar a nadie a medias.
export function GuiaCosteo({ tenantId }: { tenantId: string }) {
  const supabase = createClient()
  const [cargando, setCargando] = useState(true)
  const [pasos, setPasos] = useState<PasoSetup[]>([])
  const [ocultaSesion, setOcultaSesion] = useState(false)
  const [ocultaPermanente, setOcultaPermanente] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    setOcultaSesion(typeof window !== 'undefined' && sessionStorage.getItem(`dizgo_guia_costeo_oculta_${tenantId}`) === '1')
    setOcultaPermanente(typeof window !== 'undefined' && localStorage.getItem(`dizgo_guia_costeo_avanzada_${tenantId}`) === '1')

    let vivo = true
    async function cargar() {
      const periodo = new Date().toISOString().slice(0, 7)
      const [{ data: productos }, { data: costosFijos }, { data: colaboradores }, { data: pauta }] = await Promise.all([
        supabase.from('productos').select('id,pvp_final,costo_proveedor').eq('tenant_id', tenantId).eq('tipo', 'producto').eq('estado', 'activo'),
        supabase.from('costos_fijos').select('id').eq('tenant_id', tenantId).eq('periodo', periodo).eq('activo', true),
        supabase.from('colaboradores').select('id').eq('tenant_id', tenantId).eq('activo', true),
        supabase.from('pauta').select('id').eq('tenant_id', tenantId).limit(1),
      ])
      if (!vivo) return

      const totalProductos = (productos || []).length
      const productosIncompletos = (productos || []).filter(p => !p.pvp_final || !p.costo_proveedor).length
      const productosListos = totalProductos > 0 && productosIncompletos === 0

      setPasos([
        {
          key: 'productos', href: '/dashboard/productos', icon: '📦', label: 'Completa el costeo de tus productos',
          hecho: productosListos,
          detalle: totalProductos === 0 ? 'Aún no tienes productos activos en tu Catálogo.'
            : productosIncompletos > 0 ? `${productosIncompletos} de ${totalProductos} productos les falta PVP o costo de proveedor -- así llegan los que se crean solos al cargar pedidos de Dropi.`
            : `Tus ${totalProductos} productos activos ya tienen su costeo básico.`,
        },
        {
          key: 'costos', href: '/dashboard/costos', icon: '💰', label: 'Registra tus costos fijos del mes',
          hecho: (costosFijos || []).length > 0,
          detalle: (costosFijos || []).length > 0 ? 'Ya tienes costos fijos registrados este mes.' : 'Arriendo, servicios, herramientas -- todo lo que pagas exista o no vendas.',
        },
        {
          key: 'nomina', href: '/dashboard/nomina', icon: '👥', label: 'Registra tu nómina',
          hecho: (colaboradores || []).length > 0,
          detalle: (colaboradores || []).length > 0 ? `${(colaboradores || []).length} colaboradores activos registrados.` : 'Tu equipo también es un costo fijo del negocio, aunque no lo sientas en el día a día.',
        },
        {
          key: 'pauta', href: '/dashboard/pauta', icon: '📡', label: 'Registra tu inversión en publicidad',
          hecho: (pauta || []).length > 0,
          detalle: (pauta || []).length > 0 ? 'Ya tienes campañas registradas.' : 'Meta, TikTok -- lo que inviertes en pauta para vender también hace parte del costo real.',
        },
      ])
      setCargando(false)
    }
    cargar()
    return () => { vivo = false }
  }, [tenantId])

  if (cargando || !pasos.length || ocultaSesion) return null

  const completados = pasos.filter(p => p.hecho).length
  const setupCompleto = completados === pasos.length

  function ocultarPorAhora() {
    sessionStorage.setItem(`dizgo_guia_costeo_oculta_${tenantId}`, '1')
    setOcultaSesion(true)
  }
  function ocultarAvanzada() {
    localStorage.setItem(`dizgo_guia_costeo_avanzada_${tenantId}`, '1')
    setOcultaPermanente(true)
  }

  if (setupCompleto) {
    if (ocultaPermanente) return null
    return (
      <div className="no-print" style={{ background: C.card, border: `1px solid ${C.borde}`, borderLeft: `3px solid ${C.verde}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: C.texto }}>🎉 Ya tienes lo básico de tu costeo listo</div>
          <div style={{ fontSize: '11.5px', color: C.sub, marginTop: '2px' }}>Ahora toca verificar: simula tu precio y revisa tu punto de equilibrio con datos reales.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard/precio" style={{ textDecoration: 'none', fontSize: '11.5px', fontWeight: 600, color: C.accent, background: `${C.accent}15`, border: `1px solid ${C.accent}30`, borderRadius: '8px', padding: '7px 12px' }}>💡 Simular precio</Link>
          <Link href="/dashboard/equilibrio" style={{ textDecoration: 'none', fontSize: '11.5px', fontWeight: 600, color: C.accent, background: `${C.accent}15`, border: `1px solid ${C.accent}30`, borderRadius: '8px', padding: '7px 12px' }}>⚖️ Punto de equilibrio</Link>
          <button onClick={ocultarAvanzada} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: '13px' }}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div className="no-print" style={{ background: C.card, border: `1px solid ${C.borde}`, borderLeft: `3px solid ${C.accent}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: C.texto }}>🧭 Guía de costeo -- {completados}/{pasos.length} pasos</div>
          <div style={{ fontSize: '11.5px', color: C.sub, marginTop: '2px' }}>Vender es la parte fácil. Aquí te guiamos, paso a paso, a saber cuánto ganas de verdad en cada venta.</div>
        </div>
        <button onClick={ocultarPorAhora} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: '13px', flexShrink: 0, whiteSpace: 'nowrap' }}>✕ Ocultar por ahora</button>
      </div>
      <div style={{ display: 'grid', gap: '6px' }}>
        {pasos.map(p => (
          <Link key={p.key} href={p.href} style={{ textDecoration: 'none', display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '9px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <span style={{ fontSize: '15px', flexShrink: 0 }}>{p.hecho ? '✅' : p.icon}</span>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: p.hecho ? C.verde : C.texto }}>{p.label}</div>
              <div style={{ fontSize: '10.5px', color: C.sub, lineHeight: 1.4 }}>{p.detalle}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
