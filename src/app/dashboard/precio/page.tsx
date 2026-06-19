'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238',
}

// ── 12 PAÍSES ─────────────────────────────────────────────────
const PAISES: Record<string, { nombre:string; locale:string; currency:string; dec:number; margenBenchmark:number }> = {
  COL:{ nombre:'Colombia',  locale:'es-CO', currency:'COP', dec:0, margenBenchmark:22 },
  ECU:{ nombre:'Ecuador',   locale:'en-US', currency:'USD', dec:2, margenBenchmark:25 },
  MEX:{ nombre:'México',    locale:'es-MX', currency:'MXN', dec:2, margenBenchmark:28 },
  PER:{ nombre:'Perú',      locale:'es-PE', currency:'PEN', dec:2, margenBenchmark:24 },
  CHL:{ nombre:'Chile',     locale:'es-CL', currency:'CLP', dec:0, margenBenchmark:26 },
  ARG:{ nombre:'Argentina', locale:'es-AR', currency:'ARS', dec:2, margenBenchmark:30 },
  PAN:{ nombre:'Panamá',    locale:'en-US', currency:'USD', dec:2, margenBenchmark:23 },
  CRI:{ nombre:'Costa Rica',locale:'es-CR', currency:'CRC', dec:0, margenBenchmark:24 },
  GTM:{ nombre:'Guatemala', locale:'es-GT', currency:'GTQ', dec:2, margenBenchmark:25 },
  BOL:{ nombre:'Bolivia',   locale:'es-BO', currency:'BOB', dec:2, margenBenchmark:23 },
  URY:{ nombre:'Uruguay',   locale:'es-UY', currency:'UYU', dec:2, margenBenchmark:27 },
  VEN:{ nombre:'Venezuela', locale:'en-US', currency:'USD', dec:2, margenBenchmark:32 },
}

function getPais() {
  if (typeof window === 'undefined') return 'COL'
  return localStorage.getItem('dizgo_pais') || 'COL'
}
function fmt(v: number, pais = getPais()) {
  const c = PAISES[pais] || PAISES.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).format(v)
}
const safe = (n:number) => isNaN(n)||!isFinite(n) ? 0 : n

type Producto = {
  id: string; nombre: string; tipo: string; estado: string
  pvp_final: number; costo_proveedor: number; costo_flete: number
  costo_flete_dev: number; costo_fulfillment: number; cf_pedido: number
  pct_devolucion: number; pct_publicidad: number; pct_desc_popup: number
  pct_com_plataforma: number; pct_pasarela: number; pct_com_pasarela: number
  pct_com_ventas: number; pct_com_admin: number
  pct_pub_dev: number; pct_pub_cancel: number
  pvp_historial: { fecha:string; pvp_anterior:number; pvp_nuevo:number; motivo:string; margen_anterior:number; margen_nuevo:number }[]
  ticket_clasificacion: string
  pvp_x2_desc: number; pvp_x2_final: number; pvp_x3_desc: number; pvp_x3_final: number
  estado_resultados_snap: Record<string, number>
  presupuesto_pauta_mes: number; pedidos_esperados_mes: number
}

type Tab = 'costeo' | 'historia' | 'volumen' | 'proyeccion' | 'resultados'

const inp: React.CSSProperties = { width:'100%', background:'#0A1628', border:`1.5px solid ${T.border}`, borderRadius:'7px', padding:'8px 10px', fontSize:'12px', color:T.text, outline:'none', boxSizing:'border-box' }
const lbl: React.CSSProperties = { fontSize:'11px', color:T.muted, marginBottom:'4px', display:'block' }
const s2: React.CSSProperties = { background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px' }

// ── CLASIFICACIÓN TICKET ──────────────────────────────────────
function clasificarTicket(pvp: number): string {
  if (pvp < 30000) return 'Muy bajo'
  if (pvp < 60000) return 'Bajo'
  if (pvp < 100000) return 'Medio'
  if (pvp < 200000) return 'Alto'
  return 'Muy alto'
}

export default function PrecioPage() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [prodSel, setProdSel] = useState<Producto|null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pvpHumano, setPvpHumano] = useState(0)
  const [margenDeseado, setMargenDeseado] = useState(25)
  const [motivo, setMotivo] = useState('ajuste')
  const [tab, setTab] = useState<Tab>('costeo')
  const [pais, setPais] = useState('COL')

  const [estadoProd, setEstadoProd] = useState<'testeo'|'activo'|'temporada'>('activo')
  const [presupuestoMes, setPresupuestoMes] = useState(0)
  const [pedidosEsperados, setPedidosEsperados] = useState(0)

  const [peMetaPedidos, setPeMetaPedidos] = useState(0)
  const [cpaRealHistorico, setCpaRealHistorico] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    setPais(getPais())
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id

    const hoy = new Date()
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`
    const iniMes = `${periodo.slice(0,7)}-01`
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).toISOString().slice(0,10)

    const [{ data: prods }, { data: metaData }, { data: pautaData }] = await Promise.all([
      supabase.from('productos').select('*').eq('tenant_id', tid).eq('tipo', 'producto').order('nombre'),
      supabase.from('metas').select('meta_pedidos').eq('tenant_id', tid).eq('periodo', periodo).single(),
      supabase.from('pauta').select('inversion, resultados').eq('tenant_id', tid).gte('fecha', iniMes).lte('fecha', finMes),
    ])

    setProductos((prods||[]) as Producto[])
    setPeMetaPedidos(Number((metaData as { meta_pedidos?: number }|null)?.meta_pedidos) || 0)

    const pRows = (pautaData||[]) as { inversion:number; resultados:number }[]
    const invT = pRows.reduce((a,p)=>a+Number(p.inversion||0),0)
    const resT = pRows.reduce((a,p)=>a+Number(p.resultados||0),0)
    setCpaRealHistorico(resT>0 ? Math.round(invT/resT) : 0)

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function selProducto(p: Producto) {
    setProdSel(p)
    setPvpHumano(p.pvp_final || 0)
    setPresupuestoMes(p.presupuesto_pauta_mes || 0)
    setPedidosEsperados(p.pedidos_esperados_mes || 0)
    setTab('costeo')
  }

  function sumaTodosPcts(p: Producto): number {
    return p.pct_devolucion + p.pct_publicidad + p.pct_pub_dev + p.pct_pub_cancel +
      p.pct_desc_popup + p.pct_com_plataforma + p.pct_pasarela + p.pct_com_pasarela +
      p.pct_com_ventas + p.pct_com_admin
  }
  function costosDirectosTotal(p: Producto): number {
    return p.costo_proveedor + p.costo_flete + p.costo_flete_dev + p.costo_fulfillment + p.cf_pedido
  }
  function calcPVS(p: Producto, margen: number): number {
    if (!p) return 0
    const costosFijos = costosDirectosTotal(p)
    const sumPcts = (sumaTodosPcts(p) + margen) / 100
    if (sumPcts >= 1) return 0
    return Math.round(costosFijos / (1 - sumPcts))
  }
  function calcMargenReal(p: Producto, pvp: number): number {
    if (!p || !pvp) return 0
    const costosFijos = costosDirectosTotal(p)
    const sumPcts = sumaTodosPcts(p) / 100
    const costoTotal = costosFijos + (pvp * sumPcts)
    return Math.round(((pvp - costoTotal) / pvp) * 1000) / 10
  }

  function getCalificacion(margen: number) {
    if (margen >= 25) return { label:'✅ ÓPTIMA',    color:T.green,  desc:'Producto rentable y escalable' }
    if (margen >= 15) return { label:'⚠️ RIESGOSA',  color:T.yellow, desc:'Margen bajo — revisar costos' }
    return                   { label:'❌ PELIGROSA', color:T.red,    desc:'Operando en zona de pérdida' }
  }

  const pvsSugerido = prodSel ? calcPVS(prodSel, margenDeseado) : 0
  const margenReal  = prodSel ? calcMargenReal(prodSel, pvpHumano) : 0
  const calif        = getCalificacion(margenReal)
  const benchmarkPais = PAISES[pais]?.margenBenchmark || 22

  const alertaBenchmark = prodSel && margenReal > 0 && margenReal < benchmarkPais
    ? `Este producto en ${PAISES[pais]?.nombre} tiene margen promedio del ${benchmarkPais}% — estás en ${margenReal.toFixed(1)}%`
    : null

  const redondeosComunes = pvpHumano > 0 ? [
    Math.floor(pvpHumano/1000)*1000,
    Math.ceil(pvpHumano/1000)*1000 - 100,
    Math.ceil(pvpHumano/5000)*5000 - 1,
    Math.floor(pvpHumano/10000)*10000 + 9900,
  ].filter((v,i,a) => v>0 && a.indexOf(v)===i).sort((a,b)=>a-b) : []

  const ticketClass = clasificarTicket(pvpHumano)

  const x2Desc = prodSel?.pvp_x2_desc || 10
  const x3Desc = prodSel?.pvp_x3_desc || 15
  const pvpX2Normal = pvpHumano * 2
  const pvpX2Final  = pvpHumano > 0 ? Math.round(pvpX2Normal * (1 - x2Desc/100)) : 0
  const pvpX3Normal = pvpHumano * 3
  const pvpX3Final  = pvpHumano > 0 ? Math.round(pvpX3Normal * (1 - x3Desc/100)) : 0

  const tcEstim = 65, teEstim = 78
  const pedidosConfirmados = Math.round(pedidosEsperados * tcEstim/100)
  const pedidosEntregados3 = Math.round(pedidosConfirmados * teEstim/100)
  const cpaMaximo = prodSel ? Math.round(margenReal>0 ? pvpHumano * (1 - sumaTodosPcts(prodSel)/100) * 0.6 : 0) : 0
  const pePedidosProducto = prodSel && margenReal>0
    ? Math.ceil((prodSel.cf_pedido * 30) / (pvpHumano * margenReal/100))
    : 0
  const roiAds = presupuestoMes>0 && pedidosEntregados3>0
    ? safe(Math.round((pedidosEntregados3 * pvpHumano * margenReal/100) / presupuestoMes * 100) / 100)
    : 0
  const roiFinanciero = presupuestoMes>0
    ? safe(Math.round((pedidosEntregados3 * pvpHumano * margenReal/100 - presupuestoMes) / presupuestoMes * 100) / 100)
    : 0

  const ventasProyectadas = pedidosEsperados * pvpHumano
  const facturadoReal     = pedidosEntregados3 * pvpHumano
  const costoPublicidad   = facturadoReal * (prodSel ? (prodSel.pct_publicidad+prodSel.pct_pub_dev+prodSel.pct_pub_cancel)/100 : 0)
  const costoProveedorTot = pedidosEntregados3 * (prodSel?.costo_proveedor||0)
  const costoFleteTot     = pedidosEntregados3 * ((prodSel?.costo_flete||0) + (prodSel?.costo_flete_dev||0))
  const costoFulfillTot   = pedidosEntregados3 * (prodSel?.costo_fulfillment||0)
  const costoAdminTot     = facturadoReal * (prodSel ? (prodSel.pct_com_admin+prodSel.pct_com_ventas)/100 : 0)
  const costoComisiones   = facturadoReal * (prodSel ? (prodSel.pct_com_plataforma+prodSel.pct_com_pasarela+prodSel.pct_pasarela)/100 : 0)
  const costoDescPopup    = facturadoReal * (prodSel ? prodSel.pct_desc_popup/100 : 0)
  const utilidadAntesImp  = facturadoReal - costoPublicidad - costoProveedorTot - costoFleteTot - costoFulfillTot - costoAdminTot - costoComisiones - costoDescPopup
  const pctUtilidad       = facturadoReal>0 ? safe(Math.round(utilidadAntesImp/facturadoReal*1000)/10) : 0

  async function guardarPVP() {
    if (!prodSel || !pvpHumano) return
    setSaving(true)
    const historial = [...(prodSel.pvp_historial||[]), {
      fecha: new Date().toISOString(),
      pvp_anterior: prodSel.pvp_final,
      pvp_nuevo: pvpHumano,
      motivo,
      margen_anterior: calcMargenReal(prodSel, prodSel.pvp_final),
      margen_nuevo: margenReal,
    }]
    const snap = {
      ventas_proy: ventasProyectadas, facturado_real: facturadoReal,
      publicidad: costoPublicidad, proveedor: costoProveedorTot,
      flete: costoFleteTot, fulfillment: costoFulfillTot,
      admin: costoAdminTot, comisiones: costoComisiones,
      utilidad: utilidadAntesImp, pct_utilidad: pctUtilidad, roi: roiFinanciero,
    }
    await supabase.from('productos').update({
      pvp_final: pvpHumano,
      pvp_historial: historial,
      precio_motivo: motivo,
      pvp_x2_final: pvpX2Final, pvp_x2_desc: x2Desc,
      pvp_x3_final: pvpX3Final, pvp_x3_desc: x3Desc,
      ticket_clasificacion: ticketClass,
      estado_resultados_snap: snap,
      presupuesto_pauta_mes: presupuestoMes,
      pedidos_esperados_mes: pedidosEsperados,
    }).eq('id', prodSel.id)
    setProdSel({ ...prodSel, pvp_final:pvpHumano, pvp_historial:historial })
    setSaving(false)
    loadData()
  }

  async function revertirPrecio(pvpAnterior: number) {
    if (!prodSel) return
    setPvpHumano(pvpAnterior)
    setMotivo('reversion')
  }

  const costosFijosTotal = prodSel ? costosDirectosTotal(prodSel) : 0
  const costosVarTotal   = prodSel && pvpHumano ? pvpHumano * (sumaTodosPcts(prodSel)/100) : 0

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Cargando módulo de precios...
    </div>
  )

  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:T.text, marginBottom:'4px' }}>💡 Precio & Costeo Inverso</h1>
          <p style={{ fontSize:'12px', color:T.muted }}>PVS = Costos / (1 - %pub - %com - %margen) · {PAISES[pais]?.nombre}</p>
        </div>
        <select value={pais} onChange={e => { setPais(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('dizgo_pais', e.target.value) }}
          style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'7px', color:T.text, padding:'6px 10px', fontSize:'12px', outline:'none' }}>
          {Object.entries(PAISES).map(([k,v]) => <option key={k} value={k}>{v.nombre}</option>)}
        </select>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'16px' }}>

        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', overflow:'hidden', height:'fit-content' }}>
          <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.border}`, fontSize:'12px', fontWeight:'600', color:T.muted }}>
            Selecciona un producto
          </div>
          {productos.length===0 ? (
            <div style={{ padding:'20px', textAlign:'center' }}>
              <div style={{ fontSize:'12px', color:T.muted, marginBottom:'8px' }}>No hay productos</div>
              <a href="/dashboard/productos" style={{ fontSize:'11px', color:T.accent }}>Ir al catálogo →</a>
            </div>
          ) : productos.map(p => {
            const m = calcMargenReal(p, p.pvp_final)
            const sc = m>=25 ? T.green : m>=15 ? T.yellow : T.red
            return (
              <div key={p.id} onClick={() => selProducto(p)}
                style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}`, cursor:'pointer',
                  background: prodSel?.id===p.id ? `${T.accent}10` : 'transparent',
                  borderLeft:`3px solid ${prodSel?.id===p.id ? T.accent : 'transparent'}` }}>
                <div style={{ fontSize:'12px', fontWeight:'600', color:T.text, marginBottom:'3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'11px', color:T.muted }}>{fmt(p.pvp_final, pais)}</span>
                  <span style={{ fontSize:'11px', fontWeight:'700', color:sc }}>{m>0 ? m.toFixed(1)+'%' : '--'}</span>
                </div>
              </div>
            )
          })}
        </div>

        {!prodSel ? (
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', padding:'60px', textAlign:'center' }}>
            <div>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>💡</div>
              <div style={{ fontSize:'14px', fontWeight:'600', color:T.text, marginBottom:'6px' }}>Selecciona un producto</div>
              <div style={{ fontSize:'12px', color:T.muted }}>Elige un producto de la lista para calcular su precio óptimo</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px 16px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
              <div>
                <div style={{ fontSize:'14px', fontWeight:'700', color:T.text }}>{prodSel.nombre}</div>
                <div style={{ fontSize:'11px', color:T.muted, marginTop:'2px' }}>{prodSel.estado} · Ticket: {ticketClass}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'11px', color:T.muted }}>Calificación IA</div>
                <div style={{ fontSize:'13px', fontWeight:'700', color:calif.color }}>{calif.label}</div>
                <div style={{ fontSize:'10px', color:T.muted }}>{calif.desc}</div>
              </div>
            </div>

            {alertaBenchmark && (
              <div style={{ ...s2, padding:'10px 14px', marginBottom:'12px', borderLeft:`3px solid ${T.yellow}`, fontSize:'12px', color:T.muted }}>
                💡 <strong style={{ color:T.yellow }}>Oportunidad:</strong> {alertaBenchmark}
              </div>
            )}

            <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
              {[
                { v:'costeo'     as Tab, l:'📊 Costeo Inverso' },
                { v:'historia'   as Tab, l:'📋 Historial' },
                { v:'volumen'    as Tab, l:'🎯 Volumen x2/x3' },
                { v:'proyeccion' as Tab, l:'📈 Presupuesto' },
                { v:'resultados' as Tab, l:'💰 Mini P&G' },
              ].map(t => (
                <button key={t.v} onClick={() => setTab(t.v)}
                  style={{ padding:'7px 14px', borderRadius:'7px', cursor:'pointer', fontSize:'12px', fontWeight: tab===t.v?'600':'400',
                    border:`1px solid ${tab===t.v ? T.accent : T.border}`,
                    background: tab===t.v ? `${T.accent}15` : 'transparent', color: tab===t.v ? T.accent : T.muted }}>
                  {t.l}
                </button>
              ))}
            </div>

            {tab==='costeo' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>

                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'12px' }}>💰 ESTRUCTURA DE COSTOS — 8 CAPAS</div>

                  <div style={{ fontSize:'11px', fontWeight:'600', color:T.muted, marginBottom:'6px' }}>COSTOS DIRECTOS ($)</div>
                  {[
                    ['Proveedor', prodSel.costo_proveedor],
                    ['Flete envío', prodSel.costo_flete],
                    ['Flete devolución', prodSel.costo_flete_dev],
                    ['Fulfillment', prodSel.costo_fulfillment],
                    ['CF por pedido', prodSel.cf_pedido],
                  ].map(([k,v]) => (
                    <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:'12px', borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ color:T.muted }}>{k}</span>
                      <span style={{ color:T.text, fontWeight:'500' }}>{fmt(v as number, pais)}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:'12px', fontWeight:'700' }}>
                    <span style={{ color:T.text }}>Subtotal directo</span>
                    <span style={{ color:T.red }}>{fmt(costosFijosTotal, pais)}</span>
                  </div>

                  <div style={{ height:'1px', background:T.border, margin:'8px 0' }} />

                  <div style={{ fontSize:'11px', fontWeight:'600', color:T.muted, marginBottom:'6px' }}>PORCENTAJES (% del PVP)</div>
                  {[
                    ['Devolución', prodSel.pct_devolucion],
                    ['Publicidad', prodSel.pct_publicidad],
                    ['Pub. por devolución', prodSel.pct_pub_dev],
                    ['Pub. cancelaciones', prodSel.pct_pub_cancel],
                    ['Desc. popup', prodSel.pct_desc_popup],
                    ['Com. plataforma', prodSel.pct_com_plataforma],
                    ['Pasarela', prodSel.pct_pasarela],
                    ['Com. pasarela', prodSel.pct_com_pasarela],
                    ['Com. ventas', prodSel.pct_com_ventas],
                    ['Com. admin', prodSel.pct_com_admin],
                  ].map(([k,v]) => (
                    <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:'12px', borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ color:T.muted }}>{k}</span>
                      <span style={{ color:T.text }}>{v}%</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:'12px', fontWeight:'700' }}>
                    <span style={{ color:T.text }}>Total % variable</span>
                    <span style={{ color:T.yellow }}>{sumaTodosPcts(prodSel).toFixed(1)}%</span>
                  </div>
                </div>

                <div>
                  <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px', marginBottom:'12px' }}>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'12px' }}>🎯 PVS SUGERIDO POR EL SISTEMA</div>
                    <div style={{ marginBottom:'10px' }}>
                      <label style={lbl}>Margen deseado (%)</label>
                      <input style={inp} type="number" value={margenDeseado} onChange={e=>setMargenDeseado(parseFloat(e.target.value)||25)} min="5" max="60" />
                    </div>
                    <div style={{ background:`${T.green}15`, border:`1px solid ${T.green}30`, borderRadius:'8px', padding:'12px', textAlign:'center', marginBottom:'10px' }}>
                      <div style={{ fontSize:'11px', color:T.muted, marginBottom:'4px' }}>PVS mínimo para margen de {margenDeseado}%</div>
                      <div style={{ fontSize:'26px', fontWeight:'800', color:T.green }}>{fmt(pvsSugerido, pais)}</div>
                    </div>
                    {redondeosComunes.length > 0 && (
                      <div>
                        <div style={{ fontSize:'11px', color:T.muted, marginBottom:'6px' }}>💡 Sugerencias de precio psicológico</div>
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                          {redondeosComunes.slice(0,4).map(v => (
                            <button key={v} onClick={() => setPvpHumano(v)}
                              style={{ padding:'5px 10px', background:`${T.purple}15`, border:`1px solid ${T.purple}30`, borderRadius:'6px', color:T.purple, cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>
                              {fmt(v, pais)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'12px' }}>👤 PVP DEFINIDO POR TI</div>
                    <div style={{ marginBottom:'10px' }}>
                      <label style={lbl}>Precio de venta final</label>
                      <input style={{ ...inp, fontSize:'16px', padding:'10px', fontWeight:'700', borderColor:T.accent }} type="number" value={pvpHumano||''} onChange={e=>setPvpHumano(parseFloat(e.target.value)||0)} />
                    </div>
                    {pvpHumano > 0 && (
                      <div style={{ marginBottom:'12px' }}>
                        <div style={{ background:`${calif.color}12`, border:`1px solid ${calif.color}30`, borderRadius:'8px', padding:'10px', marginBottom:'8px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                            <span style={{ fontSize:'12px', color:T.muted }}>Costos directos</span>
                            <span style={{ fontSize:'12px', color:T.red, fontWeight:'600' }}>{fmt(costosFijosTotal, pais)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                            <span style={{ fontSize:'12px', color:T.muted }}>Costos variables</span>
                            <span style={{ fontSize:'12px', color:T.yellow, fontWeight:'600' }}>{fmt(costosVarTotal, pais)}</span>
                          </div>
                          <div style={{ height:'1px', background:T.border, margin:'6px 0' }} />
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ fontSize:'13px', fontWeight:'700', color:T.text }}>Margen neto real</span>
                            <span style={{ fontSize:'16px', fontWeight:'800', color:calif.color }}>{margenReal.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ fontSize:'12px', fontWeight:'600', color:calif.color, textAlign:'center' }}>{calif.label} — {calif.desc}</div>
                        {margenReal < 15 && (
                          <div style={{ marginTop:'8px', padding:'8px', background:`${T.red}10`, borderRadius:'6px', fontSize:'11px', color:T.red, textAlign:'center' }}>
                            ⚠️ Si eres terco, sé consciente: este margen destruye valor en el largo plazo
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ marginBottom:'10px' }}>
                      <label style={lbl}>Motivo del precio</label>
                      <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={motivo} onChange={e=>setMotivo(e.target.value)}>
                        <option value="ajuste">Ajuste de margen</option>
                        <option value="oportunidad">Oportunidad de mercado</option>
                        <option value="remate">Remate / Liquidación</option>
                        <option value="estrategico">Precio estratégico</option>
                        <option value="temporada">Temporada / Oferta</option>
                      </select>
                    </div>
                    <button onClick={guardarPVP} disabled={saving||!pvpHumano}
                      style={{ width:'100%', padding:'11px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor: saving||!pvpHumano?'not-allowed':'pointer', fontSize:'13px', opacity: saving||!pvpHumano?0.6:1 }}>
                      {saving ? 'Guardando...' : '💾 Guardar PVP — Aplicar a toda la app'}
                    </button>
                    <div style={{ fontSize:'10px', color:T.muted, textAlign:'center', marginTop:'6px' }}>
                      Se aplica a catálogo, costos, PE, Metas y P&G
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab==='historia' && (
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontSize:'12px', fontWeight:'600', color:T.text }}>
                  Historial de precios — {prodSel.nombre}
                </div>
                {!prodSel.pvp_historial || prodSel.pvp_historial.length===0 ? (
                  <div style={{ padding:'30px', textAlign:'center', fontSize:'12px', color:T.muted }}>No hay cambios de precio registrados aún</div>
                ) : [...prodSel.pvp_historial].reverse().map((h,i) => (
                  <div key={i} style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'12px', color:T.muted, marginBottom:'2px' }}>
                        {new Date(h.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </div>
                      <div style={{ fontSize:'11px', color:T.muted, textTransform:'capitalize' }}>{h.motivo}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'11px', color:T.muted, textDecoration:'line-through' }}>{fmt(h.pvp_anterior, pais)}</div>
                      <div style={{ fontSize:'13px', fontWeight:'700', color:T.text }}>→ {fmt(h.pvp_nuevo, pais)}</div>
                    </div>
                    <div style={{ textAlign:'right', minWidth:'60px' }}>
                      <div style={{ fontSize:'11px', color:T.muted }}>{h.margen_anterior?.toFixed(1)}%</div>
                      <div style={{ fontSize:'13px', fontWeight:'700', color: h.margen_nuevo>=25?T.green:h.margen_nuevo>=15?T.yellow:T.red }}>→ {h.margen_nuevo?.toFixed(1)}%</div>
                    </div>
                    <button onClick={() => revertirPrecio(h.pvp_anterior)}
                      style={{ padding:'5px 10px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'6px', color:T.blue, cursor:'pointer', fontSize:'10px' }}>
                      ↺ Revertir
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab==='volumen' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                {[
                  { label:'Precio x2 (combo de 2)', normal:pvpX2Normal, pvp:pvpX2Final, desc:x2Desc, costoUnit:2 },
                  { label:'Precio x3 (combo de 3)', normal:pvpX3Normal, pvp:pvpX3Final, desc:x3Desc, costoUnit:3 },
                ].map((v,idx) => {
                  const margenVol = prodSel && v.pvp>0
                    ? safe(Math.round(((v.pvp - (costosFijosTotal*v.costoUnit + v.pvp*sumaTodosPcts(prodSel)/100)) / v.pvp) * 1000) / 10)
                    : 0
                  const ahorro = v.normal - v.pvp
                  const valorUnidad = v.costoUnit > 0 ? Math.round(v.pvp / v.costoUnit) : 0
                  return (
                    <div key={idx} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'16px' }}>
                      <div style={{ fontSize:'12px', fontWeight:'700', color:T.purple, marginBottom:'10px' }}>{v.label}</div>
                      <div style={{ marginBottom:'8px' }}>
                        <label style={lbl}>% Descuento</label>
                        <input type="number" style={{ ...inp, width:'80px' }} value={v.desc}
                          onChange={e => setProdSel(prev => prev ? { ...prev, [idx===0?'pvp_x2_desc':'pvp_x3_desc']: Number(e.target.value) } as Producto : prev)} />
                      </div>
                      <div style={{ fontSize:'11px', color:T.muted, textDecoration:'line-through' }}>{fmt(v.normal, pais)}</div>
                      <div style={{ fontSize:'28px', fontWeight:'800', color:T.text, marginBottom:'4px' }}>{fmt(v.pvp, pais)}</div>
                      <div style={{ fontSize:'11px', color:T.muted, marginBottom:'8px' }}>Valor/unidad: {fmt(valorUnidad, pais)}</div>
                      <div style={{ fontSize:'12px', color:T.green, marginBottom:'8px' }}>Ahorro cliente: {fmt(ahorro, pais)}</div>
                      <div style={{ fontSize:'13px', fontWeight:'700', color: margenVol>=25?T.green:margenVol>=15?T.yellow:T.red }}>Margen: {margenVol.toFixed(1)}%</div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab==='proyeccion' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'16px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>📈 PRESUPUESTO DEL PRODUCTO</div>
                  <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
                    {(['testeo','activo','temporada'] as const).map(e => (
                      <button key={e} onClick={() => setEstadoProd(e)}
                        style={{ flex:1, padding:'7px', borderRadius:'7px', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                          border:`1px solid ${estadoProd===e ? T.accent : T.border}`,
                          background: estadoProd===e ? `${T.accent}15` : 'transparent', color: estadoProd===e ? T.accent : T.muted }}>
                        {e.charAt(0).toUpperCase()+e.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginBottom:'10px' }}>
                    <label style={lbl}>Presupuesto pauta mensual ($)</label>
                    <input type="number" style={inp} value={presupuestoMes||''} onChange={e=>setPresupuestoMes(Number(e.target.value))} />
                  </div>
                  <div style={{ marginBottom:'10px' }}>
                    <label style={lbl}>Pedidos generados esperados (Shopify)</label>
                    <input type="number" style={inp} value={pedidosEsperados||''} onChange={e=>setPedidosEsperados(Number(e.target.value))} />
                  </div>
                  {cpaRealHistorico > 0 && presupuestoMes > 0 && (
                    <div style={{ fontSize:'11px', color:T.muted, marginBottom:'10px' }}>
                      💡 Con CPA histórico de {fmt(cpaRealHistorico, pais)}, este presupuesto generaría ≈ {Math.round(presupuestoMes/cpaRealHistorico)} pedidos
                    </div>
                  )}
                  <button onClick={guardarPVP} style={{ width:'100%', padding:'9px', background:`${T.blue}20`, border:`1px solid ${T.blue}40`, borderRadius:'8px', color:T.blue, cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    💾 Guardar presupuesto
                  </button>
                </div>

                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'16px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'14px' }}>🎯 PROYECCIÓN DEL EMBUDO</div>
                  {[
                    { l:'Pedidos generados', v:pedidosEsperados, c:T.text },
                    { l:'Confirmados (65% est.)', v:pedidosConfirmados, c:T.blue },
                    { l:'Entregados (78% est.)', v:pedidosEntregados3, c:T.green },
                    { l:'PE del producto (pedidos/mes)', v:pePedidosProducto, c:T.yellow },
                    { l:'CPA máximo calculado', v:fmt(cpaMaximo, pais), c:T.purple },
                    { l:'ROI Ads', v:`${roiAds.toFixed(1)}x`, c: roiAds>=2?T.green:T.red },
                    { l:'ROI Financiero', v:`${roiFinanciero}%`, c: roiFinanciero>=0?T.green:T.red },
                  ].map((k,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:'12px', color:T.muted }}>{k.l}</span>
                      <span style={{ fontSize:'13px', fontWeight:'700', color:k.c }}>{k.v}</span>
                    </div>
                  ))}
                  {peMetaPedidos > 0 && (
                    <div style={{ marginTop:'10px', padding:'8px 10px', background:`${T.accent}08`, borderRadius:'8px', fontSize:'11px', color:T.muted }}>
                      Meta global del mes: <strong style={{ color:T.accent }}>{peMetaPedidos} pedidos</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab==='resultados' && (
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'20px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'4px' }}>💰 ESTADO DE RESULTADOS POR PRODUCTO</div>
                <div style={{ fontSize:'11px', color:T.muted, marginBottom:'16px' }}>Conoce el impacto ANTES de entrar en operación — esto afecta el P&G global</div>
                {[
                  { l:'Ventas Shopify proyectadas', v:ventasProyectadas, sign:'' },
                  { l:'Facturado real (entregados)', v:facturadoReal, sign:'', bold:true },
                  { l:'(-) Publicidad', v:costoPublicidad, sign:'-' },
                  { l:'(-) Proveedor', v:costoProveedorTot, sign:'-' },
                  { l:'(-) Flete', v:costoFleteTot, sign:'-' },
                  { l:'(-) Fulfillment', v:costoFulfillTot, sign:'-' },
                  { l:'(-) Administrativos/Ventas', v:costoAdminTot, sign:'-' },
                  { l:'(-) Comisiones/Pasarela', v:costoComisiones, sign:'-' },
                  { l:'(-) Descuento popup', v:costoDescPopup, sign:'-' },
                ].map((row,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.border}`, fontWeight: row.bold?'700':'400' }}>
                    <span style={{ fontSize:'12px', color: row.sign==='-' ? T.muted : T.text }}>{row.l}</span>
                    <span style={{ fontSize:'13px', color: row.sign==='-' ? T.red : T.text }}>{row.sign}{fmt(row.v, pais)}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 0', marginTop:'6px' }}>
                  <span style={{ fontSize:'15px', fontWeight:'800', color:T.text }}>UTILIDAD ANTES DE IMPUESTOS</span>
                  <span style={{ fontSize:'20px', fontWeight:'900', color: utilidadAntesImp>=0?T.green:T.red }}>{fmt(utilidadAntesImp, pais)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
                  <span style={{ fontSize:'12px', color:T.muted }}>% Utilidad / ROI financiero</span>
                  <span style={{ fontSize:'14px', fontWeight:'700', color: pctUtilidad>=15?T.green:pctUtilidad>=5?T.yellow:T.red }}>{pctUtilidad}%</span>
                </div>
                <div style={{ marginTop:'12px', padding:'10px 12px', background:`${T.purple}08`, borderRadius:'8px', fontSize:'11px', color:T.muted }}>
                  📊 Este snapshot se guarda al presionar &quot;Guardar PVP&quot; y se consolida en P&G Resultados global
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
