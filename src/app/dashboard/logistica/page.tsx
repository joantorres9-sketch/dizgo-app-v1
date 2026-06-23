'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Pedido = {
  id: string; cliente_nombre: string; cliente_telefono: string
  cliente_ciudad: string; cliente_departamento: string; pais: string
  transportadora: string; numero_guia: string; estado: string
  novedad_tipo: string | null; novedad_solucionada: boolean
  fecha_pedido: string; fecha_despacho: string | null; fecha_entrega: string | null
  pvp: number
}
type Zona = {
  id: string; ciudad: string; departamento: string
  dias_transito_min: number; dias_transito_max: number
  tasa_entrega: number; tasa_devolucion: number
  zona_roja: boolean; motivo_zona_roja: string | null
  pedidos_muestra: number
}

const TRANSPORTADORAS_PAIS: Record<string, { nombre:string; emoji:string; color:string }[]> = {
  COL: [
    { nombre:'ENVIA', emoji:'🟠', color:'#F5A623' },
    { nombre:'COORDINADORA', emoji:'🔵', color:'#3D8EF0' },
    { nombre:'SERVIENTREGA', emoji:'🔴', color:'#F05C5C' },
    { nombre:'INTERRAPIDISIMO', emoji:'🟢', color:'#2DD4A0' },
    { nombre:'TCC', emoji:'🟣', color:'#9B6BFF' },
  ],
  ECU: [
    { nombre:'SERVIENTREGA', emoji:'🔴', color:'#F05C5C' },
    { nombre:'LAAR', emoji:'🟠', color:'#F5A623' },
    { nombre:'GINTRACOM', emoji:'🔵', color:'#3D8EF0' },
    { nombre:'URBANO', emoji:'🟢', color:'#2DD4A0' },
  ],
}
const COLOR_DEFAULT = { emoji:'📦', color:'#8B96A8' }
function getTransInfo(pais: string, nombre: string) {
  return TRANSPORTADORAS_PAIS[pais]?.find(t => t.nombre === nombre?.toUpperCase()) || { nombre, ...COLOR_DEFAULT }
}

const s = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }
function semE(tasa: number) { return tasa >= 75 ? '#2DD4A0' : tasa >= 50 ? '#F5A623' : '#F05C5C' }
function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-CO')}` }

export default function LogisticaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pais, setPais] = useState('COL')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [tab, setTab] = useState<'transportadoras'|'novedades'|'ciudades'|'analisis'>('transportadoras')
  const [transportadoraSel, setTransportadoraSel] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id

    const hoy = new Date()
    const ini30 = new Date(hoy.getTime() - 30*86400000).toISOString()

    const [{ data: pedsData }, { data: zonasData }] = await Promise.all([
      supabase.from('pedidos').select('id, cliente_nombre, cliente_telefono, cliente_ciudad, cliente_departamento, pais, transportadora, numero_guia, estado, novedad_tipo, novedad_solucionada, fecha_pedido, fecha_despacho, fecha_entrega, pvp')
        .eq('tenant_id', tid).gte('fecha_pedido', ini30).order('fecha_pedido', { ascending:false }),
      supabase.from('zonas_logisticas').select('*').eq('tenant_id', tid),
    ])

    setPedidos((pedsData||[]) as Pedido[])
    setZonas((zonasData||[]) as Zona[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const pedidosPais = pedidos.filter(p => p.pais === pais)
  const transNombres = [...new Set(pedidosPais.map(p => p.transportadora).filter(Boolean))]

  const transportadoras = transNombres.map(nombre => {
    const peds = pedidosPais.filter(p => p.transportadora === nombre)
    const entregados = peds.filter(p => p.estado === 'entregado' || p.estado === 'ENTREGADO').length
    const devolucion = peds.filter(p => p.estado === 'devolucion' || p.estado === 'DEVOLUCION').length
    const novedad = peds.filter(p => p.novedad_tipo && !p.novedad_solucionada).length
    const transito = peds.filter(p => ['despachado','DESPACHADO','en_transito','EN_TRANSITO'].includes(p.estado)).length
    const cancelado = peds.filter(p => p.estado === 'cancelado' || p.estado === 'CANCELADO').length
    const valorEntregado = peds.filter(p => p.estado === 'entregado' || p.estado === 'ENTREGADO').reduce((a,p)=>a+Number(p.pvp||0),0)
    const valorDevolucion = peds.filter(p => p.estado === 'devolucion' || p.estado === 'DEVOLUCION').reduce((a,p)=>a+Number(p.pvp||0),0)
    const conTiempos = peds.filter(p => p.fecha_despacho && p.fecha_entrega)
    const diasProm = conTiempos.length > 0
      ? Math.round(conTiempos.reduce((a,p) => a + (new Date(p.fecha_entrega!).getTime() - new Date(p.fecha_despacho!).getTime())/86400000, 0) / conTiempos.length)
      : 0
    const info = getTransInfo(pais, nombre)
    return { nombre, ...info, total:peds.length, entregados, devolucion, novedad, transito, cancelado, valor_entregado:valorEntregado, valor_devolucion:valorDevolucion, dias_promedio:diasProm }
  }).sort((a,b) => b.total - a.total)

  const novedadesActivas = pedidosPais.filter(p => p.novedad_tipo && !p.novedad_solucionada)
  const novedadesResueltas = pedidosPais.filter(p => p.novedad_tipo && p.novedad_solucionada)

  const totalPedidos = pedidosPais.length
  const totalEntregados = pedidosPais.filter(p => ['entregado','ENTREGADO'].includes(p.estado)).length
  const totalEnTransito = pedidosPais.filter(p => ['despachado','DESPACHADO','en_transito','EN_TRANSITO'].includes(p.estado)).length
  const totalNovedades = pedidosPais.filter(p => p.novedad_tipo).length
  const tasaEntrega = totalPedidos > 0 ? Math.round(totalEntregados/totalPedidos*100) : 0

  // Agrupación real por ciudad
  const porCiudad = pedidosPais.reduce((acc, p) => {
    const key = p.cliente_ciudad || 'Sin ciudad'
    if (!acc[key]) acc[key] = { ciudad:key, dpto:p.cliente_departamento||'', total:0, entregados:0 }
    acc[key].total++
    if (['entregado','ENTREGADO'].includes(p.estado)) acc[key].entregados++
    return acc
  }, {} as Record<string, { ciudad:string; dpto:string; total:number; entregados:number }>)
  const ciudadesTop = Object.values(porCiudad).sort((a,b) => b.total-a.total).slice(0,10)
  const maxCiudad = ciudadesTop[0]?.total || 1

  const porDpto = pedidosPais.reduce((acc, p) => {
    const key = p.cliente_departamento || 'Sin departamento'
    acc[key] = (acc[key]||0) + 1
    return acc
  }, {} as Record<string, number>)
  const dptosTop = Object.entries(porDpto).sort((a,b) => b[1]-a[1]).slice(0,8)
  const maxDpto = dptosTop[0]?.[1] || 1

  const transSel = transportadoraSel ? transportadoras.find(t => t.nombre === transportadoraSel) : null

  async function marcarNovedadResuelta(pedidoId: string) {
    await supabase.from('pedidos').update({ novedad_solucionada: true }).eq('id', pedidoId)
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, novedad_solucionada:true } : p))
  }
  async function reabrirNovedad(pedidoId: string) {
    await supabase.from('pedidos').update({ novedad_solucionada: false }).eq('id', pedidoId)
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, novedad_solucionada:false } : p))
  }
  function abrirWA(p: Pedido) {
    const tel = (p.cliente_telefono||'').replace(/\D/g,'')
    const msg = encodeURIComponent(`Hola ${p.cliente_nombre||''}, te contactamos sobre tu pedido con guía ${p.numero_guia||'en proceso'}. Tuvimos una novedad: "${p.novedad_tipo}". ¿Puedes confirmar tu dirección en ${p.cliente_ciudad}? 🙏`)
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank')
  }

  // Alertas dinámicas reales (no texto fijo)
  const alertasLogisticas = [
    novedadesActivas.length >= 5 && { icono:'⚠️', color:'#F5A623', titulo:`${novedadesActivas.length} novedades activas`, desc:'Revisa y contacta a los clientes antes de que escale a devolución.' },
    transportadoras.find(t => t.total >= 5 && Math.round(t.entregados/t.total*100) < 50) && { icono:'📊', color:'#F05C5C', titulo:`Transportadora con bajo rendimiento`, desc:`${transportadoras.find(t => t.total >= 5 && Math.round(t.entregados/t.total*100) < 50)?.nombre} tiene tasa de entrega menor al 50%. Evalúa reducir volumen.` },
    zonas.filter(z => z.zona_roja).length > 0 && { icono:'🗺️', color:'#3D8EF0', titulo:`${zonas.filter(z=>z.zona_roja).length} zona(s) roja(s) configurada(s)`, desc:'Aplica protocolo de anticipo de flete en estas zonas.' },
    ciudadesTop[0] && { icono:'📍', color:'#9B6BFF', titulo:`${ciudadesTop[0].ciudad} concentra el mayor volumen`, desc:`${Math.round(ciudadesTop[0].total/totalPedidos*100)}% de tus pedidos. Asegura buena cobertura ahí.` },
  ].filter(Boolean) as { icono:string; color:string; titulo:string; desc:string }[]

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Cargando datos de logística...
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🚚 Logística & Transportadoras</h1>
          <p style={{ fontSize:'13px', color:'#8B96A8' }}>Datos reales últimos 30 días · {pedidosPais.length} pedidos · HACER</p>
        </div>
        <select value={pais} onChange={e => setPais(e.target.value)}
          style={{ background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'6px 10px', fontSize:'12px' }}>
          <option value="COL">🇨🇴 Colombia</option>
          <option value="ECU">🇪🇨 Ecuador</option>
        </select>
      </div>

      {pedidosPais.length === 0 && (
        <div style={{ ...s, padding:'30px', textAlign:'center', marginBottom:'16px', borderLeft:'3px solid #F5A623' }}>
          <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'6px' }}>Sin pedidos en este país en los últimos 30 días</div>
          <div style={{ fontSize:'12px', color:'#8B96A8' }}>Los datos aparecerán automáticamente cuando registres pedidos en el módulo Pedidos.</div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px', marginBottom:'16px' }}>
        {[
          { label:'Total pedidos', value:totalPedidos.toLocaleString(), color:'#E8EDF5', icon:'📦' },
          { label:'Entregados', value:totalEntregados.toLocaleString(), color:'#2DD4A0', icon:'✅' },
          { label:'Tasa entrega', value:`${tasaEntrega}%`, color:semE(tasaEntrega), icon:'📊' },
          { label:'En tránsito', value:totalEnTransito.toLocaleString(), color:'#3D8EF0', icon:'🚚' },
          { label:'Novedades', value:totalNovedades.toLocaleString(), color:'#F5A623', icon:'⚠️' },
          { label:'Sin resolver', value:novedadesActivas.length.toString(), color: novedadesActivas.length > 0 ? '#F05C5C' : '#2DD4A0', icon:'🚨' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px', borderTop:`2px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:'#8B96A8' }}>{k.label}</span><span style={{ fontSize:'14px' }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
        {[
          { key:'transportadoras', label:'🚚 Transportadoras' },
          { key:'novedades', label:`⚠️ Novedades (${novedadesActivas.length} sin resolver)` },
          { key:'ciudades', label:'🗺️ Cobertura' },
          { key:'analisis', label:'📊 Análisis' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding:'8px 14px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              background: tab === t.key ? '#F5A623' : 'rgba(255,255,255,0.05)', color: tab === t.key ? '#0A0D14' : '#8B96A8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'transportadoras' && (
        <div style={{ display:'grid', gridTemplateColumns: transSel ? '1fr 1fr' : '1fr', gap:'16px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {transportadoras.length === 0 ? (
              <div style={{ ...s, padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin transportadoras registradas aún</div>
            ) : transportadoras.map(t => {
              const tasaE = t.total>0 ? Math.round(t.entregados/t.total*100) : 0
              const tasaD = t.total>0 ? Math.round(t.devolucion/t.total*100) : 0
              const tasaN = t.total>0 ? Math.round(t.novedad/t.total*100) : 0
              const seleccionada = transportadoraSel === t.nombre
              return (
                <div key={t.nombre} onClick={() => setTransportadoraSel(seleccionada ? null : t.nombre)}
                  style={{ ...s, padding:'18px', cursor:'pointer', border:`1px solid ${seleccionada ? t.color + '44' : 'rgba(255,255,255,0.07)'}`, background: seleccionada ? t.color + '08' : '#111520' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
                    <span style={{ fontSize:'28px' }}>{t.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'16px', fontWeight:'800', color:t.color }}>{t.nombre}</div>
                      <div style={{ fontSize:'11px', color:'#5A6478' }}>{t.dias_promedio>0?`${t.dias_promedio} días promedio real`:'Sin datos de tiempo suficientes'}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'22px', fontWeight:'800', color:'#E8EDF5' }}>{t.total.toLocaleString()}</div>
                      <div style={{ fontSize:'10px', color:'#5A6478' }}>pedidos</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                    {[
                      { label:'Entregados', value:t.entregados, pct:tasaE, color:'#2DD4A0' },
                      { label:'Novedades', value:t.novedad, pct:tasaN, color:'#F5A623' },
                      { label:'Devoluciones', value:t.devolucion, pct:tasaD, color:'#F05C5C' },
                    ].map((bar,i) => (
                      <div key={i}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                          <span style={{ fontSize:'10px', color:'#8B96A8' }}>{bar.label}</span>
                          <span style={{ fontSize:'11px', fontWeight:'700', color:bar.color }}>{bar.pct}%</span>
                        </div>
                        <div style={{ height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px' }}>
                          <div style={{ height:'6px', width:`${bar.pct}%`, background:bar.color, borderRadius:'3px' }} />
                        </div>
                        <div style={{ fontSize:'10px', color:'#5A6478', marginTop:'2px' }}>{bar.value} pedidos</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    <div style={{ background:'rgba(45,212,160,0.06)', borderRadius:'8px', padding:'8px 10px' }}>
                      <div style={{ fontSize:'10px', color:'#5A6478' }}>Valor entregado</div>
                      <div style={{ fontSize:'14px', fontWeight:'700', color:'#2DD4A0' }}>{fmt(t.valor_entregado)}</div>
                    </div>
                    <div style={{ background:'rgba(240,92,92,0.06)', borderRadius:'8px', padding:'8px 10px' }}>
                      <div style={{ fontSize:'10px', color:'#5A6478' }}>Valor en devolución</div>
                      <div style={{ fontSize:'14px', fontWeight:'700', color:'#F05C5C' }}>{fmt(t.valor_devolucion)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop:'10px', padding:'8px 10px', borderRadius:'8px', fontSize:'12px',
                    background: tasaE >= 70 ? 'rgba(45,212,160,0.06)' : tasaE >= 40 ? 'rgba(245,166,35,0.06)' : 'rgba(240,92,92,0.06)',
                    color: semE(tasaE), fontWeight:'600', border:`1px solid ${semE(tasaE)}22` }}>
                    {tasaE >= 70 ? '✅ Transportadora confiable' : tasaE >= 40 ? '⚠️ Rendimiento moderado — revisar' : '❌ Rendimiento bajo — considerar cambio'}
                  </div>
                </div>
              )
            })}
          </div>

          {transSel && (
            <div style={{ ...s, padding:'20px', position:'sticky', top:'20px', maxHeight:'600px', overflowY:'auto' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:transSel.color, marginBottom:'16px' }}>{transSel.emoji} DETALLE — {transSel.nombre}</div>
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontSize:'11px', color:'#5A6478', fontWeight:'700', marginBottom:'10px' }}>EMBUDO LOGÍSTICO</div>
                {[
                  { label:'Pedidos generados', value:transSel.total, color:'#E8EDF5', pct:100 },
                  { label:'En tránsito', value:transSel.transito, color:'#3D8EF0', pct:transSel.total>0?Math.round(transSel.transito/transSel.total*100):0 },
                  { label:'Con novedad', value:transSel.novedad, color:'#F5A623', pct:transSel.total>0?Math.round(transSel.novedad/transSel.total*100):0 },
                  { label:'Entregados', value:transSel.entregados, color:'#2DD4A0', pct:transSel.total>0?Math.round(transSel.entregados/transSel.total*100):0 },
                  { label:'Devueltos', value:transSel.devolucion, color:'#F05C5C', pct:transSel.total>0?Math.round(transSel.devolucion/transSel.total*100):0 },
                ].map((row,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                    <span style={{ fontSize:'11px', color:'#8B96A8', width:'130px', flexShrink:0 }}>{row.label}</span>
                    <div style={{ flex:1, height:'18px', background:'rgba(255,255,255,0.04)', borderRadius:'4px', overflow:'hidden' }}>
                      <div style={{ height:'18px', width:`${row.pct}%`, background:row.color, borderRadius:'4px', display:'flex', alignItems:'center', paddingLeft:'6px' }}>
                        <span style={{ fontSize:'10px', color:'#0A0D14', fontWeight:'700' }}>{row.pct}%</span>
                      </div>
                    </div>
                    <span style={{ fontSize:'11px', color:row.color, fontWeight:'700', width:'40px', textAlign:'right' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:'11px', color:'#5A6478', fontWeight:'700', marginBottom:'8px' }}>NOVEDADES ACTIVAS</div>
              {pedidosPais.filter(p => p.transportadora === transSel.nombre && p.novedad_tipo && !p.novedad_solucionada).length === 0
                ? <div style={{ fontSize:'12px', color:'#5A6478', padding:'8px 0' }}>✅ Sin novedades activas</div>
                : pedidosPais.filter(p => p.transportadora === transSel.nombre && p.novedad_tipo && !p.novedad_solucionada).map(p => (
                  <div key={p.id} style={{ padding:'10px 12px', background:'rgba(245,166,35,0.06)', borderRadius:'8px', marginBottom:'6px', border:'1px solid rgba(245,166,35,0.15)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                      <span style={{ fontSize:'11px', fontWeight:'700', color:'#F5A623' }}>{p.cliente_nombre}</span>
                      <span style={{ fontSize:'10px', color:'#5A6478' }}>{p.numero_guia}</span>
                    </div>
                    <div style={{ fontSize:'11px', color:'#8B96A8', marginBottom:'4px' }}>{p.novedad_tipo}</div>
                    <div style={{ fontSize:'10px', color:'#5A6478' }}>{p.cliente_ciudad}</div>
                  </div>
                ))
              }
              <div style={{ marginTop:'14px', padding:'12px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:transSel.color, marginBottom:'6px' }}>💡 RECOMENDACIÓN</div>
                <div style={{ fontSize:'12px', color:'#8B96A8', lineHeight:'1.6' }}>
                  {transSel.total > 0 && Math.round(transSel.entregados/transSel.total*100) >= 70
                    ? `${transSel.nombre} tiene buen desempeño. Mantén como transportadora principal.`
                    : transSel.total > 0 && Math.round(transSel.entregados/transSel.total*100) >= 40
                    ? `${transSel.nombre} tiene rendimiento moderado. Monitorea las novedades y evalúa alternativas.`
                    : `${transSel.nombre} tiene bajo rendimiento de entrega o aún faltan datos suficientes.`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'novedades' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontWeight:'700' }}>⚠️ Novedades activas</span>
              <span style={{ fontSize:'12px', color:'#F5A623' }}>{novedadesActivas.length} sin resolver</span>
            </div>
            {novedadesActivas.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>✅ Sin novedades activas</div>
            ) : novedadesActivas.map(p => (
              <div key={p.id} style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'600' }}>{p.cliente_nombre}</div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>{p.cliente_ciudad} · {p.transportadora} · {p.numero_guia}</div>
                  </div>
                  <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:'700', flexShrink:0, background:'rgba(245,166,35,0.15)', color:'#F5A623' }}>
                    {p.novedad_tipo}
                  </span>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={() => abrirWA(p)} style={{ padding:'5px 12px', background:'rgba(37,211,102,0.1)', border:'none', borderRadius:'6px', color:'#25D366', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>
                    💬 WhatsApp
                  </button>
                  <button onClick={() => marcarNovedadResuelta(p.id)} style={{ padding:'5px 12px', background:'rgba(45,212,160,0.1)', border:'none', borderRadius:'6px', color:'#2DD4A0', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>
                    ✅ Marcar resuelta
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'12px' }}>📊 TIPOS DE NOVEDAD (real)</div>
              {(() => {
                const porTipo = pedidosPais.filter(p=>p.novedad_tipo).reduce((acc,p) => {
                  acc[p.novedad_tipo!] = (acc[p.novedad_tipo!]||0)+1; return acc
                }, {} as Record<string,number>)
                const total = Object.values(porTipo).reduce((a,b)=>a+b,0)
                const ordenado = Object.entries(porTipo).sort((a,b)=>b[1]-a[1])
                return ordenado.length === 0 ? (
                  <div style={{ fontSize:'12px', color:'#5A6478', textAlign:'center', padding:'20px' }}>Sin novedades registradas</div>
                ) : ordenado.map(([tipo,count],i) => (
                  <div key={i} style={{ marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                      <span style={{ fontSize:'11px', color:'#8B96A8' }}>{tipo}</span>
                      <span style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623' }}>{count}</span>
                    </div>
                    <div style={{ height:'5px', background:'rgba(255,255,255,0.05)', borderRadius:'3px' }}>
                      <div style={{ height:'5px', width:`${total>0?Math.round(count/total*100):0}%`, background:'#F5A623', borderRadius:'3px' }} />
                    </div>
                  </div>
                ))
              })()}
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'12px' }}>✅ Novedades resueltas ({novedadesResueltas.length})</div>
              {novedadesResueltas.length === 0 ? (
                <div style={{ fontSize:'12px', color:'#5A6478', textAlign:'center', padding:'10px' }}>Ninguna resuelta aún</div>
              ) : novedadesResueltas.slice(0,8).map(p => (
                <div key={p.id} style={{ padding:'10px 12px', background:'rgba(45,212,160,0.05)', borderRadius:'8px', marginBottom:'6px', border:'1px solid rgba(45,212,160,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:'600', color:'#2DD4A0' }}>{p.cliente_nombre}</div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>{(p.novedad_tipo||'').slice(0,40)}</div>
                  </div>
                  <button onClick={() => reabrirNovedad(p.id)} style={{ padding:'3px 8px', background:'rgba(255,255,255,0.05)', border:'none', borderRadius:'5px', color:'#5A6478', cursor:'pointer', fontSize:'10px' }}>
                    Reabrir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'ciudades' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>🗺️ Top ciudades con más pedidos (real)</div>
            {ciudadesTop.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin datos suficientes</div>
            ) : ciudadesTop.map((c,i) => {
              const pct = c.total>0 ? Math.round(c.entregados/c.total*100) : 0
              return (
                <div key={i} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'24px', height:'24px', background: i<3?'#F5A623':'rgba(255,255,255,0.06)', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'800', color: i<3?'#0A0D14':'#5A6478', flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:'600' }}>{c.ciudad}</div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>{c.dpto}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'14px', fontWeight:'700', color:'#E8EDF5' }}>{c.total}</div>
                    <div style={{ fontSize:'10px', color:'#5A6478' }}>pedidos</div>
                  </div>
                  <div style={{ width:'80px' }}>
                    <div style={{ height:'20px', background:'rgba(255,255,255,0.04)', borderRadius:'4px', overflow:'hidden' }}>
                      <div style={{ height:'20px', width:`${(c.total/maxCiudad)*100}%`, background:'#3D8EF0', borderRadius:'4px', display:'flex', alignItems:'center', paddingLeft:'4px' }}>
                        <span style={{ fontSize:'9px', color:'#fff', fontWeight:'700', whiteSpace:'nowrap' }}>{pct}% ent.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'14px' }}>📊 DISTRIBUCIÓN POR DEPARTAMENTO (real)</div>
            {dptosTop.length === 0 ? (
              <div style={{ fontSize:'12px', color:'#5A6478', textAlign:'center', padding:'20px' }}>Sin datos suficientes</div>
            ) : dptosTop.map(([dpto,total],i) => {
              const pct = Math.round(total/maxDpto*100)
              const colores = ['#3D8EF0','#F5A623','#2DD4A0','#9B6BFF','#F05C5C']
              return (
                <div key={i} style={{ marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'12px', color:'#8B96A8' }}>{dpto}</span>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <span style={{ fontSize:'12px', fontWeight:'700', color:colores[i%5] }}>{total}</span>
                    </div>
                  </div>
                  <div style={{ height:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'4px' }}>
                    <div style={{ height:'8px', width:`${pct}%`, background:colores[i%5], borderRadius:'4px' }} />
                  </div>
                </div>
              )
            })}
            {dptosTop[0] && (
              <div style={{ marginTop:'14px', padding:'12px', background:'rgba(61,142,240,0.06)', borderRadius:'8px', border:'1px solid rgba(61,142,240,0.15)', fontSize:'12px', color:'#8B96A8', lineHeight:'1.6' }}>
                💡 <strong style={{ color:'#3D8EF0' }}>{dptosTop[0][0]}</strong> concentra {Math.round(dptosTop[0][1]/totalPedidos*100)}% de tus pedidos. Asegura buena cobertura de transportadoras ahí.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'analisis' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>📊 Comparativo de transportadoras (real)</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:'#0A0D14', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Transportadora','Total','Entregados','% Entrega','Novedades','% Nov.','Veredicto'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:'10px', color:'#5A6478', fontWeight:'700', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transportadoras.map((t,i) => {
                  const tasaE = t.total>0?Math.round(t.entregados/t.total*100):0
                  const tasaN = t.total>0?Math.round(t.novedad/t.total*100):0
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding:'10px 12px', fontWeight:'700', color:t.color }}>{t.emoji} {t.nombre}</td>
                      <td style={{ padding:'10px 12px', color:'#8B96A8' }}>{t.total.toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', color:'#2DD4A0', fontWeight:'700' }}>{t.entregados}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ fontWeight:'800', color:semE(tasaE), fontSize:'14px' }}>{tasaE}%</span></td>
                      <td style={{ padding:'10px 12px', color:'#F5A623' }}>{t.novedad}</td>
                      <td style={{ padding:'10px 12px', color:'#F5A623' }}>{tasaN}%</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:'700', background: tasaE>=50?'rgba(45,212,160,0.1)':'rgba(245,166,35,0.1)', color: tasaE>=50?'#2DD4A0':'#F5A623' }}>
                          {tasaE>=50?'✓ Principal':'⚠ Revisar'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#F05C5C', marginBottom:'12px' }}>🚨 ALERTAS LOGÍSTICAS (real)</div>
              {alertasLogisticas.length === 0 ? (
                <div style={{ fontSize:'12px', color:'#5A6478', textAlign:'center', padding:'20px' }}>✅ Sin alertas activas</div>
              ) : alertasLogisticas.map((a,i) => (
                <div key={i} style={{ padding:'12px 14px', background:`${a.color}08`, borderRadius:'10px', marginBottom:'8px', borderLeft:`3px solid ${a.color}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                    <span>{a.icono}</span><span style={{ fontSize:'12px', fontWeight:'700', color:a.color }}>{a.titulo}</span>
                  </div>
                  <div style={{ fontSize:'11px', color:'#8B96A8', lineHeight:'1.5' }}>{a.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'12px' }}>💡 ESTRATEGIA RECOMENDADA</div>
              {[
                novedadesActivas.length > 0 && `📞 Llamar a los ${novedadesActivas.length} clientes con novedad pendiente hoy`,
                zonas.filter(z=>z.zona_roja).length > 0 && `📍 Revisar pedidos en las ${zonas.filter(z=>z.zona_roja).length} zona(s) roja(s) configuradas`,
                transportadoras[0] && `🚚 ${transportadoras[0].nombre} es tu transportadora con mayor volumen — vigila su desempeño`,
                '📊 Activar WhatsApp de seguimiento para pedidos en tránsito > 3 días',
                '🔄 Para devoluciones: contactar al cliente en las primeras 24 horas',
              ].filter(Boolean).map((r,i) => (
                <div key={i} style={{ display:'flex', gap:'8px', marginBottom:'8px', fontSize:'12px', color:'#8B96A8' }}>
                  <span style={{ flexShrink:0 }}>{(r as string).split(' ')[0]}</span>
                  <span>{(r as string).slice((r as string).indexOf(' ')+1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
