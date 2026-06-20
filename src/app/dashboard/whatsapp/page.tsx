'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238', wa:'#25D366',
}

const PISCINAS = [
  { v:'ingresados_ia',       l:'🤖 Ingresados IA',      c:T.blue },
  { v:'filtro_ia',           l:'⚡ Filtro IA',           c:T.purple },
  { v:'intervencion_humana', l:'👤 Intervención Humana', c:T.red },
  { v:'confirmados',         l:'✅ Confirmados',         c:T.green },
]

const PLANTILLAS_BASE: { tipo:string; nombre:string; emoji:string; color:string; contenido:string; estados:string[] }[] = [
  { tipo:'confirmacion', nombre:'Confirmación de pedido', emoji:'✅', color:T.green,
    contenido:'¡Hola {{cliente}}! 👋\n\nTe contactamos de {{tienda}} para confirmar tu pedido.\n\n📦 Producto: {{producto}}\n💰 Valor: {{pvp}}\n📍 Ciudad: {{ciudad}}\n\n¿Confirmamos tu pedido y dirección exacta?',
    estados:['ingresado','en_gestion'] },
  { tipo:'guia_generada', nombre:'Guía generada', emoji:'📋', color:T.blue,
    contenido:'¡Hola {{cliente}}! 📋\n\nTu pedido tiene guía generada.\n\n📦 Guía: {{guia}}\n📍 Destino: {{ciudad}}\n\nPuedes rastrearlo con este número en la transportadora.',
    estados:['confirmado'] },
  { tipo:'despacho', nombre:'Pedido despachado', emoji:'🚚', color:T.accent,
    contenido:'¡Hola {{cliente}}! 🎉\n\nTu pedido está en camino 🚚\n\n📦 Producto: {{producto}}\n📋 Guía: {{guia}}\n📍 Destino: {{ciudad}}\n⏱ Tiempo estimado: {{tiempo_entrega}}',
    estados:['despachado'] },
  { tipo:'bodega_destino', nombre:'En bodega destino', emoji:'📦', color:T.purple,
    contenido:'¡Hola {{cliente}}! 📦\n\nTu pedido llegó a la bodega de {{ciudad}}. El mensajero te llamará pronto para coordinar la entrega.',
    estados:['en_transito'] },
  { tipo:'transito', nombre:'En reparto/tránsito', emoji:'📍', color:T.purple,
    contenido:'¡Hola {{cliente}}! 📍\n\nTu pedido está muy cerca ⏰\n\n✅ Estar disponible para recibir\n✅ Tener el valor exacto: {{pvp}}\n✅ Confirma tu dirección',
    estados:['en_transito'] },
  { tipo:'novedad', nombre:'Gestión de novedad', emoji:'⚠️', color:T.yellow,
    contenido:'¡Hola {{cliente}}! ⚠️\n\nTuvimos una novedad con tu pedido.\n\n📦 Producto: {{producto}}\n\nNecesitamos confirmar tu dirección exacta y mejor horario de entrega. ¿Nos ayudas? 🙏',
    estados:['novedad'] },
  { tipo:'retrasado', nombre:'Pedido retrasado', emoji:'⏳', color:T.yellow,
    contenido:'¡Hola {{cliente}}! ⏳\n\nTu pedido está tomando más tiempo del esperado. Lo estamos gestionando activamente con la transportadora. Gracias por tu paciencia 🙏',
    estados:['en_transito','novedad'] },
  { tipo:'devolucion', nombre:'Gestión de devolución', emoji:'🔄', color:T.red,
    contenido:'¡Hola {{cliente}}! 🔄\n\nNos enteramos que tu pedido fue devuelto o cancelado.\n\n¿Qué pasó? Queremos entender para mejorar. Si deseas reagendar, con gusto te ayudamos 🙏',
    estados:['devolucion','cancelado'] },
  { tipo:'anticipo', nombre:'Solicitud de anticipo', emoji:'💰', color:T.accent,
    contenido:'Hola {{cliente}}, tu pedido está listo. Para asegurar la entrega a {{ciudad}}, solicitamos un pequeño anticipo del flete de {{anticipo_valor}}. ¿Deseas continuar? 😊',
    estados:['confirmado','en_gestion'] },
  { tipo:'recompra', nombre:'Recompra/Fidelización', emoji:'⭐', color:T.yellow,
    contenido:'¡Hola {{cliente}}! ⭐\n\n¿Todo llegó perfecto con tu {{producto}}? Tu opinión nos importa.\n\n🎁 Como cliente especial, tienes descuento exclusivo en tu próxima compra.',
    estados:['entregado'] },
  { tipo:'carrito_abandonado', nombre:'Carrito abandonado', emoji:'🛒', color:T.purple,
    contenido:'¡Hola {{cliente}}! 🛒\n\nVimos que estuviste interesado en {{producto}} ({{pvp}}). ¿Tienes alguna duda? Estamos aquí para ayudarte a completar tu pedido 😊',
    estados:['ingresado'] },
]

function getPais() {
  if (typeof window === 'undefined') return 'COL'
  return localStorage.getItem('dizgo_pais') || 'COL'
}
function fmt(v: number) {
  const cfgs: Record<string,{locale:string;currency:string;dec:number}> = {
    COL:{locale:'es-CO',currency:'COP',dec:0}, ECU:{locale:'en-US',currency:'USD',dec:2},
    MEX:{locale:'es-MX',currency:'MXN',dec:2}, PER:{locale:'es-PE',currency:'PEN',dec:2},
    CHL:{locale:'es-CL',currency:'CLP',dec:0}, ARG:{locale:'es-AR',currency:'ARS',dec:2},
  }
  const c = cfgs[getPais()] || cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).format(v)
}

type Pedido = {
  id: string; numero_pedido: string; cliente_nombre: string
  cliente_telefono: string; cliente_ciudad: string
  producto_nombre: string; producto_id: string; pvp: number; estado: string
  numero_guia: string; anticipo_valor: number; dias_transito: number
  created_at: string
}
type Chat = {
  id: string; pedido_id: string; customer_tel: string
  ia_modo_activo: boolean; pool_actual: string
  ultimo_mensaje_at: string | null; costo_mensajes: number
  motivo_cambio_modo: string | null
}
type Plantilla = {
  id: string; tipo: string; nombre: string; contenido: string
  activa: boolean; meta_aprobada: boolean
}
type StoreContext = {
  nombre_tienda: string; url_tienda: string; politica_envio: string
  tiempo_entrega: string; telefono_soporte: string
  cuentas_pago: Record<string,string>; numero_contacto: string
}
type Snapshot = {
  pvp: number; cpa_adquisicion: number; cpa_maximo_producto: number
  costo_proveedor: number; costo_flete: number; cf_por_pedido: number
  costo_servicio_wa: number; margen_pct: number; margen_con_upsell_pct: number
  cpa_excedido: boolean
}

const s: React.CSSProperties = { background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px' }
const s2: React.CSSProperties = { background:T.card2, border:`1px solid ${T.border}`, borderRadius:'9px' }

function llenarVariables(contenido: string, vars: Record<string,string>): string {
  let out = contenido
  Object.entries(vars).forEach(([k,v]) => { out = out.replaceAll(`{{${k}}}`, v) })
  return out
}

export default function WhatsAppPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'kanban'|'plantillas'|'lotes'>('kanban')

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [chats, setChats] = useState<Record<string, Chat>>({})
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [storeCtx, setStoreCtx] = useState<StoreContext | null>(null)
  const [metaCpa, setMetaCpa] = useState(0)
  const [peFaltantes, setPeFaltantes] = useState(0)

  const [pedidoActivo, setPedidoActivo] = useState<Pedido | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [plantillaSel, setPlantillaSel] = useState<string>('confirmacion')
  const [seleccionados, setSeleccionados] = useState<string[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

    const hoy = new Date()
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`

    const [{ data: pedsData }, { data: chatsData }, { data: plantData }, { data: ctxData }, { data: metaData }] = await Promise.all([
      supabase.from('pedidos').select('id, numero_pedido, cliente_nombre, cliente_telefono, cliente_ciudad, producto_nombre, producto_id, pvp, estado, numero_guia, anticipo_valor, dias_transito, created_at')
        .eq('tenant_id', tid).order('created_at', { ascending:false }).limit(150),
      supabase.from('whatsapp_chat_control').select('*').eq('tenant_id', tid),
      supabase.from('whatsapp_templates_config').select('*').eq('tenant_id', tid),
      supabase.from('whatsapp_store_context').select('*').eq('tenant_id', tid).single(),
      supabase.from('metas').select('meta_cpa, meta_pedidos').eq('tenant_id', tid).eq('periodo', periodo).single(),
    ])

    const peds = (pedsData || []) as Pedido[]
    setPedidos(peds)

    const chatsMap: Record<string, Chat> = {}
    ;(chatsData as Chat[] || []).forEach(c => { chatsMap[c.pedido_id] = c })
    const sinChat = peds.filter(p => !chatsMap[p.id] && !['entregado','cancelado','devolucion'].includes(p.estado))
    if (sinChat.length > 0) {
      const { data: nuevos } = await supabase.from('whatsapp_chat_control').insert(
        sinChat.map(p => ({ tenant_id: tid, pedido_id: p.id, customer_tel: p.cliente_telefono, ia_modo_activo: true, pool_actual: 'ingresados_ia' }))
      ).select()
      ;(nuevos as Chat[] || []).forEach(c => { chatsMap[c.pedido_id] = c })
    }
    setChats(chatsMap)

    if (plantData && plantData.length > 0) {
      setPlantillas(plantData as Plantilla[])
    } else {
      const { data: sembradas } = await supabase.from('whatsapp_templates_config').insert(
        PLANTILLAS_BASE.map(p => ({ tenant_id: tid, tipo: p.tipo, nombre: p.nombre, contenido: p.contenido, activa: true, meta_aprobada: false }))
      ).select()
      setPlantillas((sembradas || []) as Plantilla[])
    }

    setStoreCtx(ctxData as StoreContext | null)
    const meta = metaData as { meta_cpa?:number; meta_pedidos?:number } | null
    setMetaCpa(Number(meta?.meta_cpa) || 0)
    const entregadosMes = peds.filter(p => p.estado === 'entregado').length
    setPeFaltantes(Math.max((Number(meta?.meta_pedidos)||0) - entregadosMes, 0))

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function abrirChat(p: Pedido) {
    setPedidoActivo(p)
    const { data: prod } = await supabase.from('productos').select('costo_proveedor, costo_flete, pvp_final').eq('id', p.producto_id).single()
    const prodData = prod as { costo_proveedor:number; costo_flete:number; pvp_final:number } | null

    const chat = chats[p.id]
    const costoServicio = chat?.costo_mensajes || 0
    const cfPorPedido = 2318
    const costoProveedor = prodData?.costo_proveedor || 0
    const costoFlete = prodData?.costo_flete || 0
    const cpaAdq = metaCpa > 0 ? metaCpa * 0.9 : 0

    const costosTotal = costoProveedor + costoFlete + cfPorPedido + costoServicio + cpaAdq
    const margenPct = p.pvp > 0 ? Math.round(((p.pvp - costosTotal) / p.pvp) * 1000) / 10 : 0
    const margenUpsellPct = p.pvp > 0 ? Math.round(((p.pvp - costosTotal + 8200) / p.pvp) * 1000) / 10 : 0
    const cpaExcedido = metaCpa > 0 && cpaAdq > metaCpa

    const snap: Snapshot = {
      pvp: p.pvp, cpa_adquisicion: Math.round(cpaAdq), cpa_maximo_producto: metaCpa,
      costo_proveedor: costoProveedor, costo_flete: costoFlete, cf_por_pedido: cfPorPedido,
      costo_servicio_wa: costoServicio, margen_pct: margenPct, margen_con_upsell_pct: margenUpsellPct,
      cpa_excedido: cpaExcedido,
    }
    setSnapshot(snap)

    await supabase.from('contact_financial_snapshot').upsert({
      tenant_id: tenantId, pedido_id: p.id, ...snap,
    }, { onConflict: 'pedido_id' })
  }

  async function enviarWA(p: Pedido, plantillaTipo: string) {
    const pl = plantillas.find(x => x.tipo === plantillaTipo)
    if (!pl) return
    const vars: Record<string,string> = {
      cliente: p.cliente_nombre?.split(' ')[0] || 'Cliente',
      producto: p.producto_nombre || '', pvp: fmt(p.pvp||0), ciudad: p.cliente_ciudad || '',
      guia: p.numero_guia || 'en proceso', tienda: storeCtx?.nombre_tienda || 'la tienda',
      tiempo_entrega: storeCtx?.tiempo_entrega || '3 a 5 días hábiles',
      anticipo_valor: fmt(p.anticipo_valor||0),
    }
    const mensaje = llenarVariables(pl.contenido, vars)
    const tel = (p.cliente_telefono||'').replace(/\D/g,'')
    const prefijo = tel.startsWith('57') ? '' : '57'
    window.open(`https://wa.me/${prefijo}${tel}?text=${encodeURIComponent(mensaje)}`, '_blank')

    const chat = chats[p.id]
    if (chat) {
      await supabase.from('whatsapp_message_log').insert({
        chat_id: chat.id, tenant_id: tenantId, direccion: 'enviado', tipo: 'wa_me',
        contenido: mensaje, plantilla_id: pl.id, costo_meta: 0, estado: 'enviado',
      })
      await supabase.from('whatsapp_chat_control').update({ ultimo_mensaje_at: new Date().toISOString() }).eq('id', chat.id)
      setChats(prev => ({ ...prev, [p.id]: { ...chat, ultimo_mensaje_at: new Date().toISOString() } }))
    }
  }

  async function toggleModo(p: Pedido, motivo?: string) {
    const chat = chats[p.id]
    if (!chat) return
    const nuevoModo = !chat.ia_modo_activo
    await supabase.from('whatsapp_chat_control').update({ ia_modo_activo: nuevoModo, motivo_cambio_modo: motivo || null }).eq('id', chat.id)
    await supabase.from('contact_center_modes').insert({
      tenant_id: tenantId, pedido_id: p.id,
      modo_anterior: chat.ia_modo_activo ? 'ia' : 'humano',
      modo_nuevo: nuevoModo ? 'ia' : 'humano', motivo: motivo || 'manual',
    })
    setChats(prev => ({ ...prev, [p.id]: { ...chat, ia_modo_activo: nuevoModo, motivo_cambio_modo: motivo || null } }))
    if (!nuevoModo) await moverPiscina(p, 'intervencion_humana', motivo)
  }

  async function moverPiscina(p: Pedido, piscina: string, motivo?: string) {
    const chat = chats[p.id]
    if (!chat) return
    await supabase.from('whatsapp_chat_control').update({ pool_actual: piscina, motivo_cambio_modo: motivo || chat.motivo_cambio_modo }).eq('id', chat.id)
    setChats(prev => ({ ...prev, [p.id]: { ...chat, pool_actual: piscina } }))
  }

  const stats = {
    total: pedidos.length,
    ia: Object.values(chats).filter(c => c.ia_modo_activo).length,
    humano: Object.values(chats).filter(c => !c.ia_modo_activo).length,
    intervencion: Object.values(chats).filter(c => c.pool_actual === 'intervencion_humana').length,
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Cargando centro de contacto...
    </div>
  )

  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🛠️ Centro de Contacto Omnicanal</h1>
          <p style={{ fontSize:'12px', color:T.muted }}>DIZGO sabe si ese mensaje genera utilidad o pérdida · WhatsApp + Llamadas</p>
        </div>
      </div>

      {peFaltantes > 0 && (
        <div style={{ ...s, padding:'14px 18px', marginBottom:'16px', borderLeft:`3px solid ${T.accent}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px' }}>
          <div style={{ fontSize:'13px', color:T.text }}>
            🎯 Faltan <strong style={{ color:T.accent }}>{peFaltantes} pedidos</strong> para el PE del mes. ¿Enviar plantilla de carrito abandonado a los clientes sin confirmar?
          </div>
          <button onClick={() => { setTab('lotes'); setPlantillaSel('carrito_abandonado') }}
            style={{ padding:'7px 14px', background:`${T.accent}20`, border:`1px solid ${T.accent}40`, borderRadius:'8px', color:T.accent, cursor:'pointer', fontSize:'12px', fontWeight:'700' }}>
            Ir a envío por lotes
          </button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px' }}>
        {[
          { l:'Total chats activos', v:stats.total, c:T.blue, icon:'💬' },
          { l:'En modo IA', v:stats.ia, c:T.purple, icon:'🤖' },
          { l:'En modo Humano', v:stats.humano, c:T.accent, icon:'👤' },
          { l:'Intervención urgente', v:stats.intervencion, c:T.red, icon:'🔴' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px 14px', borderTop:`2px solid ${k.c}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:T.muted }}>{k.l}</span><span>{k.icon}</span>
            </div>
            <div style={{ fontSize:'22px', fontWeight:'800', color:k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
        {[
          { v:'kanban' as const, l:'📋 Tablero Kanban' },
          { v:'plantillas' as const, l:'📝 Plantillas' },
          { v:'lotes' as const, l:'📤 Envío por Lotes' },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: tab===t.v ? T.wa : 'rgba(255,255,255,0.05)', color: tab===t.v ? '#fff' : T.muted }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'kanban' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
          {PISCINAS.map(pis => {
            const pedidosPiscina = pedidos.filter(p => chats[p.id]?.pool_actual === pis.v)
            return (
              <div key={pis.v} style={{ ...s, padding:'10px', minHeight:'400px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:pis.c, marginBottom:'10px', padding:'4px 0', borderBottom:`2px solid ${pis.c}30` }}>
                  {pis.l} ({pedidosPiscina.length})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {pedidosPiscina.map(p => {
                    const chat = chats[p.id]
                    return (
                      <div key={p.id} onClick={() => abrirChat(p)}
                        style={{ ...s2, padding:'10px', cursor:'pointer', borderLeft:`3px solid ${pis.c}` }}>
                        <div style={{ fontSize:'12px', fontWeight:'600', color:T.text, marginBottom:'2px' }}>{p.cliente_nombre}</div>
                        <div style={{ fontSize:'10px', color:T.muted, marginBottom:'4px' }}>{p.cliente_ciudad} · {fmt(p.pvp||0)}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:'9px', padding:'2px 6px', borderRadius:'4px', background: chat?.ia_modo_activo ? `${T.purple}20` : `${T.accent}20`, color: chat?.ia_modo_activo ? T.purple : T.accent }}>
                            {chat?.ia_modo_activo ? '🤖 IA' : '👤 Humano'}
                          </span>
                          {chat?.ultimo_mensaje_at && (
                            <span style={{ fontSize:'9px', color:T.muted }}>
                              {Math.floor((Date.now()-new Date(chat.ultimo_mensaje_at).getTime())/3600000)}h
                            </span>
                          )}
                        </div>
                        {pis.v !== 'confirmados' && (
                          <div style={{ display:'flex', gap:'4px', marginTop:'6px', flexWrap:'wrap' }}>
                            {PISCINAS.filter(x => x.v !== pis.v).map(dest => (
                              <button key={dest.v} onClick={(e) => { e.stopPropagation(); moverPiscina(p, dest.v, 'manual') }}
                                style={{ fontSize:'8px', padding:'2px 5px', background:'rgba(255,255,255,0.05)', border:'none', borderRadius:'4px', color:T.muted, cursor:'pointer' }}>
                                →{dest.l.split(' ')[1]?.slice(0,4)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {pedidosPiscina.length === 0 && (
                    <div style={{ textAlign:'center', padding:'20px', fontSize:'11px', color:T.muted }}>Sin chats aquí</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'plantillas' && (
        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'16px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {plantillas.map(pl => {
              const base = PLANTILLAS_BASE.find(b => b.tipo === pl.tipo)
              return (
                <button key={pl.id} onClick={() => setPlantillaSel(pl.tipo)}
                  style={{ padding:'12px', borderRadius:'10px', cursor:'pointer', textAlign:'left',
                    border:`1px solid ${plantillaSel===pl.tipo ? (base?.color||T.wa)+'44' : T.border}`,
                    background: plantillaSel===pl.tipo ? `${base?.color||T.wa}10` : T.card }}>
                  <div style={{ fontSize:'13px', fontWeight:'600', color: plantillaSel===pl.tipo ? (base?.color||T.wa) : T.text }}>
                    {base?.emoji||'💬'} {pl.nombre}
                  </div>
                  <div style={{ fontSize:'10px', color:T.muted, marginTop:'3px' }}>{pl.activa ? '✓ Activa' : 'Inactiva'}</div>
                </button>
              )
            })}
          </div>

          <div style={{ ...s, padding:'18px' }}>
            {(() => {
              const pl = plantillas.find(x => x.tipo === plantillaSel)
              if (!pl) return <div style={{ color:T.muted, fontSize:'13px' }}>Selecciona una plantilla</div>
              return (
                <>
                  <div style={{ fontSize:'13px', fontWeight:'700', color:T.text, marginBottom:'12px' }}>{pl.nombre}</div>
                  <div style={{ background:'#0A0D14', borderRadius:'10px', padding:'14px', fontSize:'13px', lineHeight:'1.8', whiteSpace:'pre-wrap', border:`1px solid ${T.wa}30`, marginBottom:'14px' }}>
                    {llenarVariables(pl.contenido, { cliente:'Juan', producto:'Reloj LED', pvp:fmt(69900), ciudad:'Medellín', guia:'COL123456', tienda: storeCtx?.nombre_tienda || 'tu tienda', tiempo_entrega: storeCtx?.tiempo_entrega || '3-5 días', anticipo_valor: fmt(15000) })}
                  </div>
                  <div style={{ fontSize:'11px', color:T.muted }}>Variables disponibles: {'{{cliente}} {{producto}} {{pvp}} {{ciudad}} {{guia}} {{tienda}} {{tiempo_entrega}} {{anticipo_valor}}'}</div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {tab === 'lotes' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontWeight:'700', fontSize:'13px' }}>Seleccionar pedidos</span>
              <span style={{ fontSize:'12px', color:T.muted }}>{seleccionados.length} seleccionados</span>
            </div>
            <div style={{ maxHeight:'420px', overflowY:'auto' }}>
              {pedidos.filter(p => !['entregado','cancelado','devolucion'].includes(p.estado)).map(p => (
                <div key={p.id} onClick={() => setSeleccionados(prev => prev.includes(p.id) ? prev.filter(x=>x!==p.id) : [...prev, p.id])}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 16px', borderBottom:`1px solid ${T.border}`, cursor:'pointer',
                    background: seleccionados.includes(p.id) ? `${T.wa}08` : 'transparent' }}>
                  <input type="checkbox" checked={seleccionados.includes(p.id)} onChange={()=>{}} style={{ accentColor:T.wa }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'12px', fontWeight:'600' }}>{p.cliente_nombre}</div>
                    <div style={{ fontSize:'10px', color:T.muted }}>{p.cliente_telefono} · {p.cliente_ciudad}</div>
                  </div>
                  <span style={{ fontSize:'10px', color:T.muted }}>{p.estado}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.wa, marginBottom:'12px' }}>📤 CONFIGURAR ENVÍO</div>
            <div style={{ marginBottom:'14px' }}>
              <label style={{ fontSize:'11px', color:T.muted, display:'block', marginBottom:'6px' }}>Plantilla</label>
              <select value={plantillaSel} onChange={e=>setPlantillaSel(e.target.value)}
                style={{ width:'100%', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'7px', color:T.text, padding:'8px', fontSize:'12px' }}>
                {plantillas.map(pl => <option key={pl.tipo} value={pl.tipo}>{pl.nombre}</option>)}
              </select>
            </div>
            <div style={{ padding:'12px', background:`${T.wa}08`, borderRadius:'8px', marginBottom:'14px', fontSize:'12px', color:T.muted }}>
              {seleccionados.length} pedidos seleccionados · Se abre WA uno por uno para evitar bloqueos
            </div>
            <button onClick={async () => {
              for (const id of seleccionados) {
                const p = pedidos.find(x => x.id === id)
                if (p) await enviarWA(p, plantillaSel)
              }
              setSeleccionados([])
            }} disabled={seleccionados.length===0}
              style={{ width:'100%', padding:'12px', background: seleccionados.length>0 ? T.wa : 'rgba(255,255,255,0.05)', border:'none', borderRadius:'10px', color: seleccionados.length>0?'#fff':T.muted, cursor: seleccionados.length>0?'pointer':'not-allowed', fontSize:'14px', fontWeight:'700' }}>
              💬 Iniciar envío ({seleccionados.length})
            </button>
          </div>
        </div>
      )}

      {pedidoActivo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', justifyContent:'flex-end' }}>
          <div style={{ width:'420px', background:T.card, height:'100vh', overflowY:'auto', borderLeft:`1px solid ${T.border}` }}>
            <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between' }}>
              <div style={{ fontSize:'14px', fontWeight:'700' }}>{pedidoActivo.cliente_nombre}</div>
              <button onClick={()=>{setPedidoActivo(null);setSnapshot(null)}} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:'18px' }}>✕</button>
            </div>

            {snapshot && (
              <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:T.accent, marginBottom:'10px' }}>💰 FINANCIAL SNAPSHOT</div>
                <div style={{ ...s2, padding:'12px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', marginBottom:'8px' }}>{pedidoActivo.producto_nombre}</div>
                  {[
                    ['PVP', fmt(snapshot.pvp)],
                    ['CPA adquisición', `${fmt(snapshot.cpa_adquisicion)} ${snapshot.cpa_excedido?'⚠️':'✅'}`],
                    ['Costo proveedor', fmt(snapshot.costo_proveedor)],
                    ['Flete estimado', fmt(snapshot.costo_flete)],
                    ['CF por pedido', fmt(snapshot.cf_por_pedido)],
                    ['Costo WA', `$${snapshot.costo_servicio_wa.toFixed(2)}`],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'3px 0' }}>
                      <span style={{ color:T.muted }}>{k}</span><span style={{ color:T.text }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ height:'1px', background:T.border, margin:'6px 0' }} />
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'12px', fontWeight:'700' }}>Margen actual</span>
                    <span style={{ fontSize:'13px', fontWeight:'800', color: snapshot.margen_pct>=20?T.green:T.yellow }}>{snapshot.margen_pct}%</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'11px', color:T.muted }}>Con upsell</span>
                    <span style={{ fontSize:'12px', color:T.green }}>{snapshot.margen_con_upsell_pct}%</span>
                  </div>
                </div>
                {snapshot.cpa_excedido && (
                  <div style={{ marginTop:'8px', padding:'8px', background:`${T.red}10`, borderRadius:'7px', fontSize:'11px', color:T.red }}>
                    ⚠️ Este lead ya costó más de lo permitido. Confirma igual — no recuperes con descuento.
                  </div>
                )}
              </div>
            )}

            <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'12px', fontWeight:'600', color: chats[pedidoActivo.id]?.ia_modo_activo ? T.purple : T.accent }}>
                {chats[pedidoActivo.id]?.ia_modo_activo ? '🤖 MODO IA' : '👤 MODO HUMANO'}
              </span>
              <button onClick={() => toggleModo(pedidoActivo, 'manual')}
                style={{ padding:'6px 14px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:'20px', color:T.text, cursor:'pointer', fontSize:'11px' }}>
                Cambiar
              </button>
            </div>

            <div style={{ padding:'14px 20px' }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'10px' }}>ENVIAR PLANTILLA</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {plantillas.filter(pl => PLANTILLAS_BASE.find(b=>b.tipo===pl.tipo)?.estados.includes(pedidoActivo.estado)).map(pl => {
                  const base = PLANTILLAS_BASE.find(b=>b.tipo===pl.tipo)
                  return (
                    <button key={pl.id} onClick={() => enviarWA(pedidoActivo, pl.tipo)}
                      style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:`${base?.color||T.wa}10`, border:`1px solid ${base?.color||T.wa}30`, borderRadius:'8px', color:base?.color||T.wa, cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                      <span>{base?.emoji} {pl.nombre}</span><span>💬</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
