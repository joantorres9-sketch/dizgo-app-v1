'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Pedido = {
  id: string; cliente_nombre: string; cliente_telefono: string
  cliente_ciudad: string; cliente_departamento: string; pais: string
  transportadora: string; numero_guia: string; estado: string
  novedad_tipo: string | null; novedad_solucionada: boolean
  fecha_pedido: string; fecha_despacho: string | null; fecha_entrega: string | null
  pvp: number; confirmador_id: string | null
}
type Transportadora = {
  nombre: string; emoji: string; color: string
  tarifa_min: number; tarifa_max: number
  dias_recaudo_min: number; dias_recaudo_max: number; cobertura_pct: number
}
type Confirmador = { id: string; nombre: string; apellido: string }
type ObjecionIA = { categoria: string; nombre_visible: string; script_sugerido: string; tono: string }

const s: React.CSSProperties = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }
function semE(tasa: number) { return tasa >= 75 ? '#2DD4A0' : tasa >= 50 ? '#F5A623' : '#F05C5C' }
function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-CO')}` }
function diasEntre(a: string, b: string) { return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) }

export default function LogisticaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pais, setPais] = useState('COL')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [transData, setTransData] = useState<Transportadora[]>([])
  const [confirmadores, setConfirmadores] = useState<Record<string, Confirmador>>({})
  const [objeciones, setObjeciones] = useState<ObjecionIA[]>([])
  const [tab, setTab] = useState<'flujo_caja'|'transportadoras'|'novedades'|'mapa'|'equipo'>('flujo_caja')
  const [deptoSel, setDeptoSel] = useState<string | null>(null)
  const [novedadSel, setNovedadSel] = useState<Pedido | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id

    const hoy = new Date()
    const ini30 = new Date(hoy.getTime() - 30*86400000).toISOString()

    const [{ data: pedsData }, { data: transRows }, { data: confRows }, { data: objRows }] = await Promise.all([
      supabase.from('pedidos').select('id, cliente_nombre, cliente_telefono, cliente_ciudad, cliente_departamento, pais, transportadora, numero_guia, estado, novedad_tipo, novedad_solucionada, fecha_pedido, fecha_despacho, fecha_entrega, pvp, confirmador_id')
        .eq('tenant_id', tid).gte('fecha_pedido', ini30).order('fecha_pedido', { ascending:false }),
      supabase.from('transportadoras_pais').select('*').eq('activo', true),
      supabase.from('profiles').select('id, nombre, apellido').eq('tenant_id', tid),
      supabase.from('novedades_categorias_ia').select('*').eq('activo', true),
    ])

    setPedidos((pedsData||[]) as Pedido[])
    setTransData((transRows||[]) as Transportadora[])
    const confMap: Record<string, Confirmador> = {}
    ;(confRows||[]).forEach((c: Confirmador) => { confMap[c.id] = c })
    setConfirmadores(confMap)
    setObjeciones((objRows||[]) as ObjecionIA[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const pedidosPais = pedidos.filter(p => p.pais === pais)
  const transPaisInfo = transData.filter(t => (t as Transportadora & {pais_codigo?:string}).pais_codigo === pais || true)

  // ── FLUJO DE CAJA POR ETAPA — $ y días, no solo cantidad ──────
  const enConfirmacion = pedidosPais.filter(p => !['cancelado','CANCELADO'].includes(p.estado) && !p.fecha_despacho)
  const enTransito = pedidosPais.filter(p => p.fecha_despacho && !p.fecha_entrega && !['devolucion','DEVOLUCION','cancelado','CANCELADO'].includes(p.estado))
  const entregados = pedidosPais.filter(p => ['entregado','ENTREGADO'].includes(p.estado))
  const enDevolucion = pedidosPais.filter(p => ['devolucion','DEVOLUCION'].includes(p.estado))
  const conNovedad = pedidosPais.filter(p => p.novedad_tipo && !p.novedad_solucionada)

  function diasPromedio(lista: Pedido[], desde: 'fecha_pedido', hasta: 'fecha_despacho'|'fecha_entrega'|null) {
    const conFechas = hasta ? lista.filter(p => p[desde] && p[hasta]) : lista.filter(p => p[desde])
    if (conFechas.length === 0) return 0
    const suma = conFechas.reduce((a,p) => {
      const fin = hasta ? (p[hasta] as string) : new Date().toISOString()
      return a + diasEntre(p[desde], fin)
    }, 0)
    return Math.round(suma / conFechas.length)
  }

  const etapas = [
    { label:'En confirmación', emoji:'📞', color:'#3D8EF0', lista:enConfirmacion, dias:diasPromedio(enConfirmacion,'fecha_pedido',null) },
    { label:'En tránsito', emoji:'🚚', color:'#9B6BFF', lista:enTransito, dias:diasPromedio(enTransito,'fecha_pedido','fecha_despacho') },
    { label:'Con novedad', emoji:'⚠️', color:'#F5A623', lista:conNovedad, dias:diasPromedio(conNovedad,'fecha_pedido',null) },
    { label:'Entregados', emoji:'✅', color:'#2DD4A0', lista:entregados, dias:diasPromedio(entregados,'fecha_pedido','fecha_entrega') },
    { label:'En devolución', emoji:'🔄', color:'#F05C5C', lista:enDevolucion, dias:diasPromedio(enDevolucion,'fecha_pedido',null) },
  ].map(e => ({ ...e, valor: e.lista.reduce((a,p)=>a+Number(p.pvp||0),0), cantidad: e.lista.length }))

  const dineroAtrapado = etapas.filter(e => e.label !== 'Entregados').reduce((a,e) => a + e.valor, 0)
  const dineroPerdido = enDevolucion.reduce((a,p)=>a+Number(p.pvp||0),0)
  const dineroLiberado = entregados.reduce((a,p)=>a+Number(p.pvp||0),0)

  // ── TRANSPORTADORAS reales cruzadas con datos de catálogo ──────
  const transNombres = Array.from(new Set(pedidosPais.map(p => p.transportadora).filter(Boolean)))
  const transportadoras = transNombres.map(nombre => {
    const peds = pedidosPais.filter(p => p.transportadora === nombre)
    const entregadosT = peds.filter(p => ['entregado','ENTREGADO'].includes(p.estado)).length
    const devolucionT = peds.filter(p => ['devolucion','DEVOLUCION'].includes(p.estado)).length
    const novedadT = peds.filter(p => p.novedad_tipo && !p.novedad_solucionada).length
    const valorEntregadoT = peds.filter(p => ['entregado','ENTREGADO'].includes(p.estado)).reduce((a,p)=>a+Number(p.pvp||0),0)
    const catalogo = transPaisInfo.find(t => t.nombre === nombre?.toUpperCase())
    return {
      nombre, total: peds.length, entregados: entregadosT, devolucion: devolucionT, novedad: novedadT,
      valor_entregado: valorEntregadoT, catalogo,
    }
  }).sort((a,b) => b.total - a.total)

  // ── MAPA DE CALOR POR TEXTO (departamento -> ciudades) ─────────
  const porDepto = pedidosPais.reduce((acc, p) => {
    const key = p.cliente_departamento || 'Sin departamento'
    if (!acc[key]) acc[key] = { depto:key, total:0, entregados:0, valor:0 }
    acc[key].total++
    if (['entregado','ENTREGADO'].includes(p.estado)) { acc[key].entregados++; acc[key].valor += Number(p.pvp||0) }
    return acc
  }, {} as Record<string, { depto:string; total:number; entregados:number; valor:number }>)
  const deptosOrdenados = Object.values(porDepto).sort((a,b) => b.total-a.total)
  const maxDepto = deptosOrdenados[0]?.total || 1

  const ciudadesDelDepto = deptoSel ? pedidosPais.filter(p => (p.cliente_departamento||'Sin departamento') === deptoSel).reduce((acc, p) => {
    const key = p.cliente_ciudad || 'Sin ciudad'
    if (!acc[key]) acc[key] = { ciudad:key, total:0, entregados:0 }
    acc[key].total++
    if (['entregado','ENTREGADO'].includes(p.estado)) acc[key].entregados++
    return acc
  }, {} as Record<string, { ciudad:string; total:number; entregados:number }>) : {}
  const ciudadesOrdenadas = Object.values(ciudadesDelDepto).sort((a,b) => b.total-a.total)
  const maxCiudad = ciudadesOrdenadas[0]?.total || 1

  // ── EQUIPO — quién gestionó desde confirmación ─────────────────
  const porConfirmador = pedidosPais.filter(p => p.confirmador_id).reduce((acc, p) => {
    const key = p.confirmador_id!
    if (!acc[key]) acc[key] = { id:key, total:0, entregados:0, novedad:0 }
    acc[key].total++
    if (['entregado','ENTREGADO'].includes(p.estado)) acc[key].entregados++
    if (p.novedad_tipo && !p.novedad_solucionada) acc[key].novedad++
    return acc
  }, {} as Record<string, { id:string; total:number; entregados:number; novedad:number }>)
  const equipoOrdenado = Object.values(porConfirmador).sort((a,b) => b.total-a.total)

  function objecionPara(novedadTipo: string | null): ObjecionIA | null {
    if (!novedadTipo) return null
    const t = novedadTipo.toLowerCase()
    return objeciones.find(o => t.includes(o.categoria.replace('_',' ')) || o.nombre_visible.toLowerCase().includes(t) || t.includes(o.categoria)) || objeciones[1] || null
  }
  function abrirWAObjecion(p: Pedido) {
    const obj = objecionPara(p.novedad_tipo)
    const tel = (p.cliente_telefono||'').replace(/\D/g,'')
    const msg = obj ? obj.script_sugerido.replace('{{cliente}}', p.cliente_nombre?.split(' ')[0]||'') : `Hola, te contactamos sobre tu pedido con guía ${p.numero_guia||''}`
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Cargando logística...
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🚚 Logística & Flujo de Caja</h1>
          <p style={{ fontSize:'13px', color:'#8B96A8' }}>Últimos 30 días · {pedidosPais.length} pedidos · dinero real por etapa</p>
        </div>
        <select value={pais} onChange={e => setPais(e.target.value)}
          style={{ background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'6px 10px', fontSize:'12px' }}>
          <option value="COL">🇨🇴 Colombia</option>
          <option value="ECU">🇪🇨 Ecuador</option>
        </select>
      </div>

      {/* Resumen financiero global */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
        <div style={{ ...s, padding:'16px', borderTop:'3px solid #F5A623' }}>
          <div style={{ fontSize:'11px', color:'#8B96A8', marginBottom:'4px' }}>💰 Dinero atrapado en proceso</div>
          <div style={{ fontSize:'24px', fontWeight:'800', color:'#F5A623' }}>{fmt(dineroAtrapado)}</div>
          <div style={{ fontSize:'10px', color:'#5A6478' }}>aún no libera flujo de caja</div>
        </div>
        <div style={{ ...s, padding:'16px', borderTop:'3px solid #2DD4A0' }}>
          <div style={{ fontSize:'11px', color:'#8B96A8', marginBottom:'4px' }}>✅ Dinero liberado (entregado)</div>
          <div style={{ fontSize:'24px', fontWeight:'800', color:'#2DD4A0' }}>{fmt(dineroLiberado)}</div>
          <div style={{ fontSize:'10px', color:'#5A6478' }}>ya disponible en Wallet</div>
        </div>
        <div style={{ ...s, padding:'16px', borderTop:'3px solid #F05C5C' }}>
          <div style={{ fontSize:'11px', color:'#8B96A8', marginBottom:'4px' }}>🔄 Dinero perdido en devolución</div>
          <div style={{ fontSize:'24px', fontWeight:'800', color:'#F05C5C' }}>{fmt(dineroPerdido)}</div>
          <div style={{ fontSize:'10px', color:'#5A6478' }}>{enDevolucion.length} pedidos devueltos</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { key:'flujo_caja', label:'💰 Flujo de caja por etapa' },
          { key:'transportadoras', label:'🚚 Transportadoras' },
          { key:'novedades', label:`⚠️ Novedades (${conNovedad.length})` },
          { key:'mapa', label:'🗺️ Mapa de cobertura' },
          { key:'equipo', label:'👥 Equipo confirmador' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding:'8px 14px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              background: tab === t.key ? '#F5A623' : 'rgba(255,255,255,0.05)', color: tab === t.key ? '#0A0D14' : '#8B96A8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'flujo_caja' && (
        <div style={{ ...s, padding:'20px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'16px' }}>💰 EMBUDO FINANCIERO — cantidad, días y $ por etapa</div>
          {etapas.map((e,i) => {
            const pct = Math.max((e.cantidad / (pedidosPais.length||1)) * 100, 2)
            return (
              <div key={i} style={{ marginBottom:'16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                  <span style={{ fontSize:'13px', fontWeight:'600' }}>{e.emoji} {e.label}</span>
                  <div style={{ display:'flex', gap:'16px', fontSize:'12px' }}>
                    <span style={{ color:'#8B96A8' }}>{e.cantidad} pedidos</span>
                    <span style={{ color:e.color, fontWeight:'700' }}>{fmt(e.valor)}</span>
                    <span style={{ color:'#5A6478' }}>{e.dias} días prom.</span>
                  </div>
                </div>
                <div style={{ height:'14px', background:'rgba(255,255,255,0.04)', borderRadius:'7px', overflow:'hidden' }}>
                  <div style={{ height:'14px', width:`${pct}%`, background:e.color, borderRadius:'7px' }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop:'16px', padding:'14px', background:'rgba(245,166,35,0.06)', borderRadius:'10px', border:'1px solid rgba(245,166,35,0.2)' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'6px' }}>💡 IMPACTO EN FLUJO DE CAJA</div>
            <div style={{ fontSize:'12px', color:'#8B96A8', lineHeight:'1.6' }}>
              Tienes <strong style={{ color:'#F5A623' }}>{fmt(dineroAtrapado)}</strong> que todavía no entra a tu Wallet.
              Si reduces 2 días el tiempo en confirmación, ese dinero llega más rápido y mejora tu capacidad de reinvertir en pauta.
            </div>
          </div>
        </div>
      )}

      {tab === 'transportadoras' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {transportadoras.length === 0 ? (
            <div style={{ ...s, padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin transportadoras registradas en pedidos aún</div>
          ) : transportadoras.map(t => {
            const tasaE = t.total>0 ? Math.round(t.entregados/t.total*100) : 0
            return (
              <div key={t.nombre} style={{ ...s, padding:'18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:'800', color: t.catalogo?.color || '#8B96A8' }}>{t.catalogo?.emoji || '📦'} {t.nombre}</div>
                    {t.catalogo && (
                      <div style={{ fontSize:'11px', color:'#5A6478', marginTop:'4px' }}>
                        Tarifa publicada: {fmt(t.catalogo.tarifa_min)} - {fmt(t.catalogo.tarifa_max)} · Recaudo: {t.catalogo.dias_recaudo_min}-{t.catalogo.dias_recaudo_max} días · Cobertura: {t.catalogo.cobertura_pct}%
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'22px', fontWeight:'800', color:semE(tasaE) }}>{tasaE}%</div>
                    <div style={{ fontSize:'10px', color:'#5A6478' }}>tasa real de entrega</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
                  {[
                    { l:'Total pedidos', v:t.total, c:'#E8EDF5' },
                    { l:'Entregados', v:t.entregados, c:'#2DD4A0' },
                    { l:'Novedades', v:t.novedad, c:'#F5A623' },
                    { l:'Devoluciones', v:t.devolucion, c:'#F05C5C' },
                  ].map((k,i) => (
                    <div key={i} style={{ textAlign:'center', padding:'8px', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>
                      <div style={{ fontSize:'16px', fontWeight:'700', color:k.c }}>{k.v}</div>
                      <div style={{ fontSize:'9px', color:'#5A6478' }}>{k.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:'10px', fontSize:'12px', color:'#2DD4A0', fontWeight:'600' }}>Valor entregado: {fmt(t.valor_entregado)}</div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'novedades' && (
        <div style={{ display:'grid', gridTemplateColumns: novedadSel ? '1fr 400px' : '1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>⚠️ Novedades activas — con sugerencia IA</div>
            {conNovedad.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>✅ Sin novedades activas</div>
            ) : conNovedad.map(p => {
              const activa = novedadSel?.id === p.id
              return (
                <div key={p.id} onClick={() => setNovedadSel(activa ? null : p)}
                  style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', cursor:'pointer', background: activa ? 'rgba(245,166,35,0.05)' : 'transparent' }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'600' }}>{p.cliente_nombre}</div>
                      <div style={{ fontSize:'11px', color:'#5A6478' }}>{p.cliente_ciudad} · {p.transportadora} · {fmt(p.pvp||0)}</div>
                    </div>
                    <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:'700', background:'rgba(245,166,35,0.15)', color:'#F5A623', alignSelf:'flex-start' }}>
                      {p.novedad_tipo}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {novedadSel && (() => {
            const obj = objecionPara(novedadSel.novedad_tipo)
            return (
              <div style={{ ...s, padding:'20px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'14px' }}>🤖 IA SUGIERE — Resolución de objeción</div>
                <div style={{ fontSize:'13px', fontWeight:'600', marginBottom:'4px' }}>{novedadSel.cliente_nombre}</div>
                <div style={{ fontSize:'11px', color:'#5A6478', marginBottom:'14px' }}>{novedadSel.novedad_tipo} · {novedadSel.cliente_ciudad}</div>
                {obj ? (
                  <>
                    <div style={{ fontSize:'11px', color:'#5A6478', marginBottom:'6px' }}>Categoría: {obj.nombre_visible}</div>
                    <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:'10px', padding:'14px', fontSize:'13px', lineHeight:'1.7', marginBottom:'14px' }}>
                      {obj.script_sugerido.replace('{{cliente}}', novedadSel.cliente_nombre?.split(' ')[0]||'')}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:'12px', color:'#5A6478', marginBottom:'14px' }}>Sin script específico — usando mensaje genérico de seguimiento.</div>
                )}
                <button onClick={() => abrirWAObjecion(novedadSel)}
                  style={{ width:'100%', padding:'11px', background:'rgba(37,211,102,0.12)', border:'none', borderRadius:'9px', color:'#25D366', cursor:'pointer', fontSize:'13px', fontWeight:'700' }}>
                  💬 Enviar por WhatsApp
                </button>
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'mapa' && (
        <div style={{ display:'grid', gridTemplateColumns: deptoSel ? '1fr 1fr' : '1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>🗺️ Mapa de calor — por departamento (click para ver ciudades)</div>
            {deptosOrdenados.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin datos suficientes</div>
            ) : deptosOrdenados.map((d,i) => {
              const pct = d.total>0 ? Math.round(d.entregados/d.total*100) : 0
              const activo = deptoSel === d.depto
              return (
                <div key={i} onClick={() => setDeptoSel(activo ? null : d.depto)}
                  style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', cursor:'pointer', background: activo ? 'rgba(245,166,35,0.06)' : 'transparent', display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:'600' }}>{d.depto}</div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>{fmt(d.valor)} entregado</div>
                  </div>
                  <div style={{ width:'120px' }}>
                    <div style={{ height:'18px', background:'rgba(255,255,255,0.04)', borderRadius:'4px', overflow:'hidden' }}>
                      <div style={{ height:'18px', width:`${(d.total/maxDepto)*100}%`, background:semE(pct), borderRadius:'4px' }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right', width:'50px' }}>
                    <div style={{ fontSize:'14px', fontWeight:'700' }}>{d.total}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {deptoSel && (
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'14px' }}>🏙️ Ciudades de {deptoSel}</div>
              {ciudadesOrdenadas.length === 0 ? (
                <div style={{ fontSize:'12px', color:'#5A6478', textAlign:'center', padding:'20px' }}>Sin ciudades registradas</div>
              ) : ciudadesOrdenadas.map((c,i) => {
                const pct = c.total>0 ? Math.round(c.entregados/c.total*100) : 0
                return (
                  <div key={i} style={{ marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <span style={{ fontSize:'12px' }}>{c.ciudad}</span>
                      <span style={{ fontSize:'12px', fontWeight:'700', color:semE(pct) }}>{c.total} pedidos · {pct}%</span>
                    </div>
                    <div style={{ height:'7px', background:'rgba(255,255,255,0.04)', borderRadius:'4px' }}>
                      <div style={{ height:'7px', width:`${(c.total/maxCiudad)*100}%`, background:semE(pct), borderRadius:'4px' }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop:'12px', padding:'10px', background:'rgba(61,142,240,0.06)', borderRadius:'8px', fontSize:'11px', color:'#8B96A8' }}>
                📍 Mapa basado en texto de dirección. La versión con coordenadas oficiales (drill-down táctil exacto) llega en la siguiente fase.
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'equipo' && (
        <div style={{ ...s, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>👥 Gestión por confirmador — quién atendió desde confirmación</div>
          {equipoOrdenado.length === 0 ? (
            <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin pedidos con confirmador asignado aún</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:'#0A0D14', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Confirmador','Pedidos gestionados','Entregados','% Éxito','Novedades activas'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:'#5A6478', fontWeight:'700' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equipoOrdenado.map((c,i) => {
                  const conf = confirmadores[c.id]
                  const pct = c.total>0 ? Math.round(c.entregados/c.total*100) : 0
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding:'10px 12px', fontWeight:'700' }}>{conf ? `${conf.nombre} ${conf.apellido}` : 'Sin nombre'}</td>
                      <td style={{ padding:'10px 12px', color:'#8B96A8' }}>{c.total}</td>
                      <td style={{ padding:'10px 12px', color:'#2DD4A0', fontWeight:'700' }}>{c.entregados}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ fontWeight:'800', fontSize:'14px', color:semE(pct) }}>{pct}%</span></td>
                      <td style={{ padding:'10px 12px', color:'#F5A623' }}>{c.novedad}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div style={{ padding:'14px 16px', fontSize:'11px', color:'#5A6478', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            💡 Asigna el campo &quot;confirmador&quot; al gestionar un pedido en el módulo Pedidos para que aparezca aquí.
          </div>
        </div>
      )}
    </div>
  )
}
