'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238',
}

interface MetasMes {
  periodo: string
  meta_pedidos: number; meta_pedidos_dia: number
  meta_ventas: number; meta_utilidad: number
  meta_cpa: number; meta_inversion_pauta: number
  meta_confirmacion: number; meta_entrega: number; meta_devolucion_max: number
}

interface HistorialMes {
  mes: string; periodo: string
  pedidos: number; meta: number
  ventas: number; utilidad: number; activo?: boolean
}

const META_DEFAULT: MetasMes = {
  periodo: '', meta_pedidos:500, meta_pedidos_dia:17,
  meta_ventas:35000000, meta_utilidad:4500000,
  meta_cpa:15000, meta_inversion_pauta:1500000,
  meta_confirmacion:65, meta_entrega:78, meta_devolucion_max:12,
}

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function MetasPage() {
  const supabase = createClient()

  const hoy          = new Date()
  const diaActual    = hoy.getDate()
  const diasMes      = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const diasRestantes = diasMes - diaActual
  const periodoKey   = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2,'0')}-01`

  const [tenantId,   setTenantId]   = useState('')
  const [loading,    setLoading]    = useState(true)
  const [guardando,  setGuardando]  = useState(false)
  const [tab,        setTab]        = useState<'metas'|'proyeccion'|'historial'>('metas')

  // Metas (editables + guardadas en BD)
  const [metas,      setMetas]      = useState<MetasMes>(META_DEFAULT)

  // Ejecución real desde BD
  const [pedidosActuales,     setPedidosActuales]     = useState(0)
  const [ventasActuales,      setVentasActuales]      = useState(0)
  const [utilidadActual,      setUtilidadActual]      = useState(0)
  const [confirmacionActual,  setConfirmacionActual]  = useState(0)
  const [entregaActual,       setEntregaActual]       = useState(0)
  const [devolucionActual,    setDevolucionActual]    = useState(0)
  const [cpaActual,           setCpaActual]           = useState(0)
  const [pautaActual,         setPautaActual]         = useState(0)
  const [historial,           setHistorial]           = useState<HistorialMes[]>([])

  const s:   React.CSSProperties = { background:T.card,  border:`1px solid ${T.border}`, borderRadius:'12px' }
  const s2:  React.CSSProperties = { background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px' }
  const inp: React.CSSProperties = {
    background:T.card2, border:`1px solid ${T.border}`, borderRadius:'7px',
    color:T.text, padding:'6px 10px', fontSize:'13px', outline:'none',
    width:'100%', boxSizing:'border-box',
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!prof?.tenant_id) { setLoading(false); return }
    const tid = prof.tenant_id
    setTenantId(tid)

    const iniMes = `${periodoKey.slice(0,7)}-01`
    const finMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${diasMes}`

    // Cargar en paralelo
    const [
      { data: metaData },
      { data: pedidosMes },
      { data: pautaData },
      { data: walletData },
      { data: histData },
    ] = await Promise.all([
      supabase.from('metas').select('*').eq('tenant_id', tid).eq('periodo', periodoKey).single(),
      supabase.from('pedidos').select('estado, pvp, ganancia').eq('tenant_id', tid)
        .gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes + 'T23:59:59'),
      supabase.from('pauta').select('inversion, cpa, resultados').eq('tenant_id', tid)
        .gte('fecha', iniMes).lte('fecha', finMes),
      supabase.from('wallet_transacciones').select('tipo, monto').eq('tenant_id', tid)
        .gte('fecha', iniMes).lte('fecha', finMes + 'T23:59:59'),
      // Historial últimos 6 meses
      supabase.from('metas').select('periodo, meta_pedidos').eq('tenant_id', tid)
        .order('periodo', { ascending: false }).limit(6),
    ])

    // ── Metas ─────────────────────────────────────────────────
    if (metaData) {
      setMetas({
        periodo:              metaData.periodo,
        meta_pedidos:         Number(metaData.meta_pedidos)        || 500,
        meta_pedidos_dia:     Number(metaData.meta_pedidos_dia)    || 17,
        meta_ventas:          Number(metaData.meta_ventas)         || 35000000,
        meta_utilidad:        Number(metaData.meta_utilidad)       || 4500000,
        meta_cpa:             Number(metaData.meta_cpa)            || 15000,
        meta_inversion_pauta: Number(metaData.meta_inversion_pauta)|| 1500000,
        meta_confirmacion:    Number(metaData.meta_confirmacion)   || 65,
        meta_entrega:         Number(metaData.meta_entrega)        || 78,
        meta_devolucion_max:  Number(metaData.meta_devolucion_max) || 12,
      })
    }

    // ── Pedidos reales ─────────────────────────────────────────
    const peds = (pedidosMes || []) as { estado:string; pvp:number; ganancia:number }[]
    const entregados  = peds.filter(p => p.estado === 'ENTREGADO')
    const confirmados = peds.filter(p => ['CONFIRMADO','DESPACHADO','EN_TRANSITO','ENTREGADO','NOVEDAD','DEVOLUCION'].includes(p.estado))
    const despachados = peds.filter(p => ['DESPACHADO','EN_TRANSITO','ENTREGADO','NOVEDAD','DEVOLUCION'].includes(p.estado))
    const devoluciones = peds.filter(p => p.estado === 'DEVOLUCION')

    const totalVentas   = entregados.reduce((a, p) => a + Number(p.pvp     || 0), 0)
    const totalGanancia = entregados.reduce((a, p) => a + Number(p.ganancia || 0), 0)

    setPedidosActuales(entregados.length)
    setVentasActuales(Math.round(totalVentas))
    setUtilidadActual(Math.round(totalGanancia))
    setConfirmacionActual(peds.length > 0 ? Math.round(confirmados.length / peds.length * 100) : 0)
    setEntregaActual(despachados.length > 0 ? Math.round(entregados.length / despachados.length * 100) : 0)
    setDevolucionActual(entregados.length > 0 ? Math.round(devoluciones.length / entregados.length * 100) : 0)

    // ── Pauta real ─────────────────────────────────────────────
    const pautaRows = (pautaData || []) as { inversion:number; cpa:number; resultados:number }[]
    const totalPauta     = pautaRows.reduce((a, p) => a + Number(p.inversion  || 0), 0)
    const totalResultados = pautaRows.reduce((a, p) => a + Number(p.resultados || 0), 0)
    const cpaMedio       = totalResultados > 0 ? Math.round(totalPauta / totalResultados) : 0
    setPautaActual(Math.round(totalPauta))
    setCpaActual(cpaMedio)

    // ── Wallet (utilidad desde wallet si no hay en pedidos) ───
    const wRows = (walletData || []) as { tipo:string; monto:number }[]
    if (totalGanancia === 0 && wRows.length > 0) {
      const entradas = wRows.filter(w => w.tipo === 'ENTRADA').reduce((a, w) => a + Number(w.monto), 0)
      const salidas  = wRows.filter(w => w.tipo === 'SALIDA').reduce((a, w) => a + Number(w.monto), 0)
      setUtilidadActual(Math.round(entradas - salidas))
    }

    // ── Historial (últimos 6 meses) ───────────────────────────
    const hist = (histData || []) as { periodo:string; meta_pedidos:number }[]
    // Para cada mes del historial cargamos pedidos entregados
    const histConDatos: HistorialMes[] = await Promise.all(
      hist.map(async (h) => {
        const mesDate = new Date(h.periodo)
        const ini = h.periodo.slice(0, 7) + '-01'
        const fin = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 0)
          .toISOString().slice(0, 10)
        const { data: pedHist } = await supabase.from('pedidos')
          .select('pvp, ganancia').eq('tenant_id', tid).eq('estado', 'ENTREGADO')
          .gte('fecha_pedido', ini).lte('fecha_pedido', fin + 'T23:59:59')
        const rows = (pedHist || []) as { pvp:number; ganancia:number }[]
        const mesIdx = mesDate.getMonth()
        return {
          mes:      MESES_ES[mesIdx],
          periodo:  h.periodo,
          pedidos:  rows.length,
          meta:     Number(h.meta_pedidos) || 500,
          ventas:   rows.reduce((a, p) => a + Number(p.pvp || 0), 0),
          utilidad: rows.reduce((a, p) => a + Number(p.ganancia || 0), 0),
          activo:   h.periodo === periodoKey,
        }
      })
    )
    setHistorial(histConDatos.reverse())
    setLoading(false)
  }, [supabase, periodoKey, diasMes])

  useEffect(() => { loadData() }, [loadData])

  // ── GUARDAR METAS ──────────────────────────────────────────
  async function guardarMetas(nuevasMetas: Partial<MetasMes>) {
    const merged = { ...metas, ...nuevasMetas }
    setMetas(merged)
    if (!tenantId) return
    setGuardando(true)
    await supabase.from('metas').upsert(
      {
        tenant_id:             tenantId,
        periodo:               periodoKey,
        meta_pedidos:          merged.meta_pedidos,
        meta_pedidos_dia:      Math.ceil(merged.meta_pedidos / diasMes),
        meta_ventas:           merged.meta_ventas,
        meta_utilidad:         merged.meta_utilidad,
        meta_cpa:              merged.meta_cpa,
        meta_inversion_pauta:  merged.meta_inversion_pauta,
        meta_confirmacion:     merged.meta_confirmacion,
        meta_entrega:          merged.meta_entrega,
        meta_devolucion_max:   merged.meta_devolucion_max,
      },
      { onConflict: 'tenant_id,periodo' }
    )
    setGuardando(false)
  }

  // ── CÁLCULOS ───────────────────────────────────────────────
  const pctDias      = Math.round(diaActual / diasMes * 100)
  const pctPedidos   = Math.min(Math.round(pedidosActuales / (metas.meta_pedidos || 1) * 100), 150)
  const vaBien       = pedidosActuales >= Math.round(metas.meta_pedidos * diaActual / diasMes)
  const ritmoActual  = diaActual > 0 ? pedidosActuales / diaActual : 0
  const proyPedidos  = Math.round(ritmoActual * diasMes)
  const proyVentas   = diaActual > 0 ? Math.round((ventasActuales / diaActual) * diasMes) : 0
  const proyUtilidad = diaActual > 0 ? Math.round((utilidadActual / diaActual) * diasMes) : 0
  const pedFaltantes = Math.max(metas.meta_pedidos - pedidosActuales, 0)
  const pedDiaNec    = diasRestantes > 0 ? Math.ceil(pedFaltantes / diasRestantes) : 0
  const ventDiaNec   = diasRestantes > 0 ? Math.ceil((metas.meta_ventas - ventasActuales) / diasRestantes) : 0

  function semaforo(actual: number, meta: number, inv = false): string {
    const p = meta > 0 ? actual / meta * 100 : 0
    if (inv) return p <= 80 ? T.green : p <= 100 ? T.yellow : T.red
    return p >= 90 ? T.green : p >= 70 ? T.yellow : T.red
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Cargando metas y ejecución real...
    </div>
  )

  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🎯 Metas & Proyecciones</h1>
          <p style={{ fontSize:'12px', color:T.muted }}>
            Día {diaActual} de {diasMes} · {diasRestantes} días restantes · PLANEAR → VERIFICAR
          </p>
        </div>
        {guardando && <span style={{ fontSize:'11px', color:T.muted, alignSelf:'center' }}>Guardando...</span>}
      </div>

      {/* Barra de progreso del mes */}
      <div style={{ ...s, padding:'14px 18px', marginBottom:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
          <span style={{ fontSize:'12px', color:T.muted }}>Progreso del mes — Día {diaActual}/{diasMes}</span>
          <span style={{ fontSize:'12px', fontWeight:'700', color: vaBien ? T.green : T.yellow }}>
            {vaBien ? '✅ En ritmo' : '⚠️ Necesitas acelerar'}
          </span>
        </div>
        <div style={{ height:'10px', background:'rgba(255,255,255,0.04)', borderRadius:'5px', position:'relative', marginBottom:'6px', overflow:'hidden' }}>
          <div style={{ position:'absolute', height:'100%', width:`${pctDias}%`, background:'rgba(255,255,255,0.08)', borderRadius:'5px' }} />
          <div style={{ position:'absolute', height:'100%', width:`${Math.min(pctPedidos,100)}%`, background: vaBien ? T.green : T.yellow, borderRadius:'5px', transition:'width .5s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:T.muted }}>
          <span>Tiempo: {pctDias}%</span>
          <span>Pedidos: {pctPedidos}% de la meta</span>
          <span style={{ fontWeight:'700', color:T.text }}>{pedidosActuales.toLocaleString('es-CO')} / {metas.meta_pedidos.toLocaleString('es-CO')} pedidos</span>
        </div>
      </div>

      {/* KPIs principales */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
        {[
          { label:'Pedidos entregados', actual:pedidosActuales,  meta:metas.meta_pedidos,  fmt:(n:number) => n.toLocaleString('es-CO'), inv:false },
          { label:'Ventas del mes',     actual:ventasActuales,   meta:metas.meta_ventas,   fmt:(n:number) => `$${Math.round(n/1000)}K`,  inv:false },
          { label:'Utilidad real',      actual:utilidadActual,   meta:metas.meta_utilidad, fmt:(n:number) => `$${Math.round(n/1000)}K`,  inv:false },
          { label:'Pedidos/día hoy',    actual:pedDiaNec,        meta:metas.meta_pedidos/diasMes, fmt:(n:number) => `${Math.round(n)}/día`, inv:false },
        ].map((k, i) => {
          const color = semaforo(k.actual, k.meta, k.inv)
          const pct   = Math.min(Math.round(k.actual / (k.meta || 1) * 100), 100)
          return (
            <div key={i} style={{ ...s, padding:'14px', borderTop:`2px solid ${color}` }}>
              <div style={{ fontSize:'11px', color:T.muted, marginBottom:'6px' }}>{k.label}</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color, marginBottom:'6px' }}>{k.fmt(k.actual)}</div>
              <div style={{ height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', marginBottom:'4px', overflow:'hidden' }}>
                <div style={{ height:'4px', width:`${pct}%`, background:color, borderRadius:'2px', transition:'width .5s' }} />
              </div>
              <div style={{ fontSize:'10px', color:T.muted }}>{pct}% · meta: {k.fmt(k.meta)}</div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
        {[
          { key:'metas' as const,     label:'🎯 Configurar Metas' },
          { key:'proyeccion' as const, label:'📈 Proyección' },
          { key:'historial' as const,  label:'📅 Historial' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'8px 16px', borderRadius:'9px', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              border:`1px solid ${tab === t.key ? T.accent : T.border}`,
              background: tab === t.key ? `${T.accent}15` : 'transparent',
              color: tab === t.key ? T.accent : T.muted }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB METAS ══ */}
      {tab === 'metas' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>

          {/* Metas configurables */}
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'14px' }}>
              🎯 METAS DEL MES — {MESES_ES[hoy.getMonth()]} {hoy.getFullYear()}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[
                { label:'Meta de Pedidos entregados',  key:'meta_pedidos'         as keyof MetasMes },
                { label:'Meta de Ventas ($)',           key:'meta_ventas'          as keyof MetasMes },
                { label:'Meta de Utilidad ($)',         key:'meta_utilidad'        as keyof MetasMes },
                { label:'CPA Máximo ($)',               key:'meta_cpa'             as keyof MetasMes },
                { label:'Inversión Pauta ($)',          key:'meta_inversion_pauta' as keyof MetasMes },
                { label:'% Confirmación mínimo',       key:'meta_confirmacion'    as keyof MetasMes },
                { label:'% Entrega mínimo',            key:'meta_entrega'         as keyof MetasMes },
                { label:'% Devolución máximo',         key:'meta_devolucion_max'  as keyof MetasMes },
              ].map((item) => (
                <div key={String(item.key)} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <label style={{ flex:1, fontSize:'12px', color:T.muted }}>{item.label}</label>
                  <input type="number" value={Number(metas[item.key])}
                    onChange={e => guardarMetas({ [item.key]: Number(e.target.value) } as Partial<MetasMes>)}
                    style={{ ...inp, width:'130px', textAlign:'right' }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop:'14px', padding:'10px 12px', ...s2, fontSize:'11px', color:T.muted }}>
              ✅ Metas guardadas automáticamente en Supabase al editar
              <br />→ Alimentan: PE · Dashboard · P&G · Alertas
            </div>
          </div>

          {/* Ejecución real */}
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'14px' }}>
              📊 EJECUCIÓN REAL — Día {diaActual} de {diasMes}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { label:'Pedidos entregados',  actual:pedidosActuales,    meta:metas.meta_pedidos,       inv:false, src:'pedidos BD' },
                { label:'Ventas ($)',           actual:ventasActuales,     meta:metas.meta_ventas,        inv:false, src:'pedidos BD' },
                { label:'Utilidad ($)',         actual:utilidadActual,     meta:metas.meta_utilidad,      inv:false, src:'wallet/pedidos' },
                { label:'CPA actual ($)',       actual:cpaActual,          meta:metas.meta_cpa,           inv:true,  src:'pauta BD' },
                { label:'Pauta invertida ($)',  actual:pautaActual,        meta:metas.meta_inversion_pauta,inv:false,src:'pauta BD' },
                { label:'% Confirmación',       actual:confirmacionActual, meta:metas.meta_confirmacion,  inv:false, src:'pedidos BD' },
                { label:'% Entrega',            actual:entregaActual,      meta:metas.meta_entrega,       inv:false, src:'pedidos BD' },
                { label:'% Devolución',         actual:devolucionActual,   meta:metas.meta_devolucion_max,inv:true,  src:'pedidos BD' },
              ].map((item, i) => {
                const color = semaforo(item.actual, item.meta, item.inv)
                const pct   = Math.min(Math.round(item.actual / (item.meta || 1) * 100), 150)
                return (
                  <div key={i}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                      <span style={{ flex:1, fontSize:'12px', color:T.muted }}>{item.label}</span>
                      <span style={{ fontSize:'10px', color:T.border }}>← {item.src}</span>
                      <span style={{ fontSize:'13px', fontWeight:'700', color, width:'80px', textAlign:'right' }}>
                        {item.actual.toLocaleString('es-CO')}
                      </span>
                      <span style={{ fontSize:'11px', fontWeight:'700', color, width:'38px', textAlign:'right' }}>
                        {Math.round(item.actual / (item.meta || 1) * 100)}%
                      </span>
                    </div>
                    <div style={{ height:'3px', background:'rgba(255,255,255,0.04)', borderRadius:'2px', overflow:'hidden' }}>
                      <div style={{ height:'3px', width:`${Math.min(pct,100)}%`, background:color, borderRadius:'2px', transition:'width .5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={loadData}
              style={{ marginTop:'14px', padding:'8px 16px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'8px', color:T.blue, cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
              ↺ Actualizar datos reales
            </button>
          </div>
        </div>
      )}

      {/* ══ TAB PROYECCIÓN ══ */}
      {tab === 'proyeccion' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>
              📈 PROYECCIÓN AL CIERRE DEL MES
            </div>
            <div style={{ fontSize:'12px', color:T.muted, marginBottom:'14px', lineHeight:'1.6' }}>
              Basado en el ritmo actual de <strong style={{ color:T.text }}>{ritmoActual.toFixed(1)} pedidos/día</strong> (días 1-{diaActual})
            </div>
            {[
              { label:'Pedidos proyectados', proy:proyPedidos,  meta:metas.meta_pedidos,  fmt:(n:number) => n.toLocaleString('es-CO'),   color:T.blue },
              { label:'Ventas proyectadas',  proy:proyVentas,   meta:metas.meta_ventas,   fmt:(n:number) => `$${Math.round(n/1000)}K`,    color:T.purple },
              { label:'Utilidad proyectada', proy:proyUtilidad, meta:metas.meta_utilidad, fmt:(n:number) => `$${Math.round(n/1000)}K`,    color:T.green },
            ].map((k, i) => {
              const cumple = k.proy >= k.meta
              return (
                <div key={i} style={{ padding:'14px', ...s2, marginBottom:'10px', borderLeft:`3px solid ${cumple ? T.green : T.red}` }}>
                  <div style={{ fontSize:'11px', color:T.muted, marginBottom:'6px' }}>{k.label}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <span style={{ fontSize:'20px', fontWeight:'800', color: cumple ? T.green : T.red }}>{k.fmt(k.proy)}</span>
                      <span style={{ fontSize:'11px', color:T.muted, marginLeft:'8px' }}>meta: {k.fmt(k.meta)}</span>
                    </div>
                    <span style={{ fontSize:'11px', fontWeight:'700', padding:'4px 10px', borderRadius:'6px',
                      background: cumple ? `${T.green}15` : `${T.red}15`,
                      color: cumple ? T.green : T.red }}>
                      {cumple ? '✓ Alcanzarás' : '✗ No alcanzarás'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'14px' }}>⚡ ¿QUÉ NECESITAS HACER HOY?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'14px' }}>
              {[
                { icon:'📦', pregunta:'Pedidos/día necesarios', respuesta:`${pedDiaNec}`,                         alerta: pedDiaNec > 25 },
                { icon:'💰', pregunta:'Ventas/día necesarias',  respuesta:`$${Math.round(ventDiaNec/1000)}K`,     alerta: ventDiaNec > 1500000 },
                { icon:'📅', pregunta:'Días restantes',         respuesta:`${diasRestantes} días`,                alerta: diasRestantes < 7 },
                { icon:'🎯', pregunta:'Pedidos que te faltan',  respuesta:`${pedFaltantes}`,                      alerta: pedFaltantes > metas.meta_pedidos * 0.5 },
                { icon:'⚡', pregunta:'Ritmo actual',           respuesta:`${ritmoActual.toFixed(1)}/día`,        alerta: ritmoActual < metas.meta_pedidos / diasMes },
                { icon:'🔥', pregunta:'Ritmo necesario',        respuesta:`${pedDiaNec}/día`,                     alerta: pedDiaNec > ritmoActual * 1.5 },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', borderRadius:'8px',
                  background: item.alerta ? `${T.red}08` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${item.alerta ? T.red + '30' : T.border}` }}>
                  <span style={{ fontSize:'12px', color:T.muted }}><span style={{ marginRight:'6px' }}>{item.icon}</span>{item.pregunta}</span>
                  <span style={{ fontSize:'14px', fontWeight:'800', color: item.alerta ? T.red : T.green }}>{item.respuesta}</span>
                </div>
              ))}
            </div>

            <div style={{ padding:'14px', borderRadius:'10px',
              background: vaBien ? `${T.green}08` : `${T.red}08`,
              border: `1px solid ${vaBien ? T.green : T.red}30` }}>
              <div style={{ fontSize:'14px', fontWeight:'700', color: vaBien ? T.green : T.red, marginBottom:'5px' }}>
                {vaBien ? '✅ Vas en buen ritmo' : '⚠️ Necesitas acelerar'}
              </div>
              <div style={{ fontSize:'12px', color:T.muted, lineHeight:'1.7' }}>
                {vaBien
                  ? `Si mantienes el ritmo, cerrarás con ${proyPedidos} pedidos — ${proyPedidos >= metas.meta_pedidos ? 'superando' : 'cerca de'} tu meta.`
                  : `Para ${metas.meta_pedidos} pedidos necesitas ${pedDiaNec}/día en los próximos ${diasRestantes} días.`}
              </div>
            </div>

            <div style={{ marginTop:'12px', padding:'10px 12px', ...s2, fontSize:'11px', color:T.muted }}>
              🔗 PE actual: <strong style={{ color:T.accent }}>ver módulo Equilibrio</strong>
              {' · '}P&G: <strong style={{ color:T.green }}>ver módulo Resultados</strong>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB HISTORIAL ══ */}
      {tab === 'historial' && (
        <div style={{ ...s, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:'700', fontSize:'13px' }}>📅 Historial de meses</span>
            <span style={{ fontSize:'11px', color:T.muted }}>Datos reales desde Supabase</span>
          </div>

          {/* Gráfico de barras */}
          {historial.length > 0 && (
            <div style={{ padding:'20px', display:'flex', alignItems:'flex-end', gap:'12px', height:'160px' }}>
              {historial.map((m, i) => {
                const maxMeta = Math.max(...historial.map(x => x.meta), 1)
                const pctBar  = Math.min((m.pedidos / maxMeta) * 100, 100)
                const metaPct = Math.min((m.meta    / maxMeta) * 100, 100)
                const cumple  = m.pedidos >= m.meta
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                    <div style={{ fontSize:'10px', color: cumple ? T.green : T.red, fontWeight:'700' }}>{m.pedidos}</div>
                    <div style={{ width:'100%', height:'100px', display:'flex', alignItems:'flex-end' }}>
                      <div style={{ width:'100%', height:`${metaPct}%`, background:'rgba(255,255,255,0.05)', borderRadius:'3px 3px 0 0', position:'relative', overflow:'hidden' }}>
                        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${(m.pedidos / (m.meta || 1)) * 100}%`, maxHeight:'100%', background: cumple ? T.green : T.red, borderRadius:'3px 3px 0 0', transition:'height .4s' }} />
                      </div>
                    </div>
                    <div style={{ fontSize:'11px', color: m.activo ? T.yellow : T.muted, fontWeight: m.activo ? '700' : '400' }}>
                      {m.mes}{m.activo ? ' ←' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr style={{ background:'#060E1C', borderBottom:`1px solid ${T.border}` }}>
                {['Mes','Pedidos','Meta','Cumplimiento','Ventas','Utilidad','Estado'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:'700' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px', color:T.muted }}>
                  No hay historial aún — las metas guardadas aparecerán aquí
                </td></tr>
              ) : historial.map((m, i) => {
                const cumple = m.pedidos >= m.meta
                const pct    = m.meta > 0 ? Math.round(m.pedidos / m.meta * 100) : 0
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, background: m.activo ? `${T.yellow}05` : 'transparent' }}>
                    <td style={{ padding:'10px 14px', fontWeight: m.activo ? '700' : '400', color: m.activo ? T.yellow : T.text }}>{m.mes}</td>
                    <td style={{ padding:'10px 14px', fontWeight:'700', color: cumple ? T.green : T.red }}>{m.pedidos.toLocaleString('es-CO')}</td>
                    <td style={{ padding:'10px 14px', color:T.muted }}>{m.meta.toLocaleString('es-CO')}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <div style={{ flex:1, height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px', overflow:'hidden' }}>
                          <div style={{ height:'6px', width:`${Math.min(pct,100)}%`, background: cumple ? T.green : T.red, borderRadius:'3px' }} />
                        </div>
                        <span style={{ fontSize:'12px', fontWeight:'700', color: cumple ? T.green : T.red, width:'35px' }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px', color:T.muted }}>${Math.round(m.ventas / 1000)}K</td>
                    <td style={{ padding:'10px 14px', color:T.green }}>${Math.round(m.utilidad / 1000)}K</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'6px',
                        background: cumple ? `${T.green}15` : `${T.red}15`,
                        color: cumple ? T.green : T.red }}>
                        {cumple ? '✓ Cumplida' : '✗ No cumplida'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota pie */}
      <div style={{ marginTop:'14px', padding:'12px 16px', background:T.card2, borderRadius:'10px', border:`1px solid ${T.border}`, fontSize:'12px', color:T.muted }}>
        📌 Datos reales desde Supabase · Pedidos: <strong style={{ color:T.text }}>tabla pedidos</strong> ·
        Pauta: <strong style={{ color:T.text }}>tabla pauta</strong> ·
        Metas guardadas: <strong style={{ color:T.green }}>tabla metas</strong> ·
        Alimenta PE · Dashboard · Alertas
        {guardando && <span style={{ marginLeft:'10px', color:T.muted }}>· Guardando...</span>}
      </div>
    </div>
  )
}
