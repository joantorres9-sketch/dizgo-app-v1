'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── TEMA ──────────────────────────────────────────────────────
const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238',
  gold:'#FFD700',
}

// ── TIPOS ─────────────────────────────────────────────────────
type Modo = 'minimo' | 'rentabilidad' | 'tiburon'
type Tab  = 'tiempo_real' | 'escenarios' | 'capacidad'

interface ProductoPE {
  id: string; nombre: string; pvp_final: number
  costo_proveedor: number; costo_flete: number
  costo_fulfillment: number; pct_publicidad: number
  pct_com_plataforma: number; pct_desc_popup: number; pct_pasarela: number
  ganancia_neta: number; participacion: number
}

interface DatosLive {
  shopify: number; confirmados: number
  despachados: number; entregados: number
}

interface Capacidad {
  confirmadores: number; empacadores: number
  wa_automatizado: boolean; dropi_api_activa: boolean
}

interface Config {
  modo_activo: Modo
  tasa_confirmacion: number; tasa_despacho: number; tasa_entrega: number
  utilidad_meta: number; cpa_referencia: number
  num_confirmadores: number; num_empacadores: number
}

// ── HELPERS ───────────────────────────────────────────────────
const fmt  = (n: number, d = 0) => `$${Math.round(n).toLocaleString('es-CO', { minimumFractionDigits: d })}`
const pct  = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0
const safe = (n: number) => isNaN(n) || !isFinite(n) ? 0 : n

function calcGanancia(p: ProductoPE): number {
  const cv = p.costo_proveedor + p.costo_flete + p.costo_fulfillment +
    (p.pvp_final * (p.pct_publicidad + p.pct_com_plataforma + p.pct_desc_popup + p.pct_pasarela) / 100)
  return Math.round(p.pvp_final - cv)
}

// ── CONSTANTES ────────────────────────────────────────────────
const MODOS: { v: Modo; l: string; sub: string; color: string }[] = [
  { v:'minimo',        l:'🔴 PE Mínimo',         sub:'Solo cubrir CF+CV. No quebrar.',          color: T.red },
  { v:'rentabilidad',  l:'🟡 Meta Rentabilidad',  sub:'CF+CV+utilidad deseada.',                 color: T.yellow },
  { v:'tiburon',       l:'🟢 Modo Tiburón',       sub:'Escalar al máximo con recursos actuales.', color: T.gold },
]

const CONFIG_DEFAULT: Config = {
  modo_activo: 'minimo',
  tasa_confirmacion: 65, tasa_despacho: 90, tasa_entrega: 78,
  utilidad_meta: 0, cpa_referencia: 0,
  num_confirmadores: 1, num_empacadores: 1,
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────
export default function EquilibrioPage() {
  const supabase = createClient()

  // Estado global
  const [tenantId,  setTenantId]  = useState('')
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<Tab>('tiempo_real')
  const [config,    setConfig]    = useState<Config>(CONFIG_DEFAULT)
  const [guardando, setGuardando] = useState(false)

  // Datos Supabase
  const [productos,    setProductos]    = useState<ProductoPE[]>([])
  const [cfMes,        setCfMes]        = useState(0)
  const [pautaMes,     setPautaMes]     = useState(0)
  const [walletSaldo,  setWalletSaldo]  = useState(0)
  const [datosLive,    setDatosLive]    = useState<DatosLive>({ shopify:0, confirmados:0, despachados:0, entregados:0 })
  const [datosHoy,     setDatosHoy]     = useState<DatosLive>({ shopify:0, confirmados:0, despachados:0, entregados:0 })
  const [capacidad,    setCapacidad]    = useState<Capacidad>({ confirmadores:1, empacadores:1, wa_automatizado:false, dropi_api_activa:false })
  const [metaPedidos,  setMetaPedidos]  = useState(0)

  // UI
  const [diaActual,        setDiaActual]        = useState(new Date().getDate())
  const [escenarioActivo,  setEscenarioActivo]  = useState<number | null>(null)
  const [pedidosOverride,  setPedidosOverride]  = useState<number | null>(null)

  // Estilos locales
  const s:   React.CSSProperties = { background:T.card,  border:`1px solid ${T.border}`, borderRadius:'12px' }
  const s2:  React.CSSProperties = { background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px' }
  const inp: React.CSSProperties = {
    background:T.card2, border:`1px solid ${T.border}`, borderRadius:'7px',
    color:T.text, padding:'7px 10px', fontSize:'13px', outline:'none', width:'110px',
  }

  // ── CARGA DE DATOS ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!prof?.tenant_id) { setLoading(false); return }
    const tid = prof.tenant_id
    setTenantId(tid)

    const hoy        = new Date()
    const iniMes     = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
    const finMes     = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().slice(0, 10)
    const periodoKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const hoyStr     = hoy.toISOString().slice(0, 10)

    const [
      { data: prods },
      { data: costos },
      { data: pautaData },
      { data: pedidosMes },
      { data: pedidosHoy },
      { data: walletData },
      { data: confData },
      { data: colabs },
      { data: metaData },
    ] = await Promise.all([
      supabase.from('productos').select('*').eq('tenant_id', tid).eq('estado', 'activo'),
      supabase.from('costos_fijos').select('total, categoria').eq('tenant_id', tid).eq('periodo', periodoKey).eq('activo', true),
      supabase.from('pauta').select('inversion').eq('tenant_id', tid).gte('fecha', iniMes).lte('fecha', finMes),
      supabase.from('pedidos').select('estado').eq('tenant_id', tid).gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes + 'T23:59:59'),
      supabase.from('pedidos').select('estado').eq('tenant_id', tid).gte('fecha_pedido', hoyStr).lte('fecha_pedido', hoyStr + 'T23:59:59'),
      supabase.from('wallet_transacciones').select('tipo, monto').eq('tenant_id', tid),
      supabase.from('pe_configuraciones').select('*').eq('tenant_id', tid).eq('periodo', periodoKey).single(),
      supabase.from('colaboradores').select('cargo, activo').eq('tenant_id', tid).eq('activo', true),
      supabase.from('metas').select('meta_pedidos').eq('tenant_id', tid).eq('periodo', periodoKey).single(),
    ])

    // ── CF y Pauta ────────────────────────────────────────────
    const totalCF = (costos || []).reduce((a: number, c: { total: number }) => a + Number(c.total || 0), 0)
    const totalPauta = (pautaData || []).reduce((a: number, p: { inversion: number }) => a + Number(p.inversion || 0), 0)
    setCfMes(Math.round(totalCF))
    setPautaMes(Math.round(totalPauta))

    // ── Wallet saldo ──────────────────────────────────────────
    const entradas = (walletData || []).filter((w: { tipo: string }) => w.tipo === 'ENTRADA').reduce((a: number, w: { monto: number }) => a + Number(w.monto), 0)
    const salidas  = (walletData || []).filter((w: { tipo: string }) => w.tipo === 'SALIDA').reduce((a: number, w: { monto: number }) => a + Number(w.monto), 0)
    setWalletSaldo(Math.round(entradas - salidas))

    // ── Embudo del mes (TC/TD/TE) ─────────────────────────────
    const ped = (pedidosMes || []) as { estado: string }[]
    const enFlujo   = ['confirmado','despachado','en_transito','entregado','novedad','devolucion']
    const confStats = ped.filter(p => enFlujo.includes(p.estado)).length
    const despStats = ped.filter(p => ['despachado','en_transito','entregado','novedad','devolucion'].includes(p.estado)).length
    const entrStats = ped.filter(p => p.estado === 'entregado').length
    setDatosLive({ shopify: ped.length, confirmados: confStats, despachados: despStats, entregados: entrStats })

    // ── Embudo de HOY ─────────────────────────────────────────
    const h = (pedidosHoy || []) as { estado: string }[]
    setDatosHoy({
      shopify:     h.length,
      confirmados: h.filter(p => enFlujo.includes(p.estado)).length,
      despachados: h.filter(p => ['despachado','en_transito','entregado','novedad','devolucion'].includes(p.estado)).length,
      entregados:  h.filter(p => p.estado === 'entregado').length,
    })

    // ── Tasas reales del mes ──────────────────────────────────
    const tcReal = safe(pct(confStats, ped.length))
    const tdReal = safe(pct(despStats, confStats))
    const teReal = safe(pct(entrStats, despStats))

    // ── Productos con ganancia ────────────────────────────────
    const rawProds = (prods || []) as ProductoPE[]
    const total = rawProds.length || 1
    const prodsConPE = rawProds.map(p => ({
      ...p,
      pvp_final:     Number(p.pvp_final),
      costo_proveedor: Number(p.costo_proveedor),
      costo_flete:    Number(p.costo_flete),
      costo_fulfillment: Number(p.costo_fulfillment),
      pct_publicidad: Number(p.pct_publicidad),
      pct_com_plataforma: Number(p.pct_com_plataforma),
      pct_desc_popup: Number(p.pct_desc_popup),
      pct_pasarela:   Number(p.pct_pasarela),
      ganancia_neta:  0,
      participacion:  Math.round(100 / total),
    })).map(p => ({ ...p, ganancia_neta: calcGanancia(p) }))
    setProductos(prodsConPE)

    // ── Configuración PE ──────────────────────────────────────
    if (confData) {
      setConfig({
        modo_activo:       confData.modo_activo || 'minimo',
        tasa_confirmacion: Number(confData.tasa_confirmacion) || tcReal || 65,
        tasa_despacho:     Number(confData.tasa_despacho)     || tdReal || 90,
        tasa_entrega:      Number(confData.tasa_entrega)      || teReal || 78,
        utilidad_meta:     Number(confData.utilidad_meta)     || 0,
        cpa_referencia:    Number(confData.cpa_referencia)    || 0,
        num_confirmadores: Number(confData.num_confirmadores) || 1,
        num_empacadores:   Number(confData.num_empacadores)   || 1,
      })
    } else {
      // Si no hay config guardada, usar tasas reales del mes
      setConfig(prev => ({
        ...prev,
        tasa_confirmacion: tcReal || 65,
        tasa_despacho:     tdReal || 90,
        tasa_entrega:      teReal || 78,
      }))
    }

    // ── Capacidad desde nómina ────────────────────────────────
    const cols = (colabs || []) as { cargo: string; activo: boolean }[]
    setCapacidad({
      confirmadores:    cols.filter(c => c.cargo.toLowerCase().includes('confirmad')).length,
      empacadores:      cols.filter(c => c.cargo.toLowerCase().includes('empacad')).length,
      wa_automatizado:  false,
      dropi_api_activa: false,
    })

    setMetaPedidos(Number((metaData as { meta_pedidos?: number } | null)?.meta_pedidos) || 0)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── GUARDAR CONFIG ─────────────────────────────────────────
  async function guardarConfig(nuevoConfig: Partial<Config>) {
    const merged = { ...config, ...nuevoConfig }
    setConfig(merged)
    if (!tenantId) return
    setGuardando(true)
    const hoy = new Date()
    const periodoKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    await supabase.from('pe_configuraciones').upsert(
      { tenant_id: tenantId, periodo: periodoKey, ...merged },
      { onConflict: 'tenant_id,periodo' }
    )
    setGuardando(false)
  }

  // ── CÁLCULOS CENTRALES ─────────────────────────────────────
  const prodsEfectivos = productos.length > 0 ? productos : [
    { id:'1', nombre:'Producto Demo', pvp_final:69900, costo_proveedor:18000, costo_flete:5000,
      costo_fulfillment:3000, pct_publicidad:20, pct_com_plataforma:3, pct_desc_popup:5, pct_pasarela:0,
      ganancia_neta:9920, participacion:100 } as ProductoPE,
  ]

  const gananciaPond = safe(Math.round(
    prodsEfectivos.reduce((s, p) => s + (p.ganancia_neta * p.participacion / 100), 0)
  ))
  const pvpPond  = safe(Math.round(prodsEfectivos.reduce((s, p) => s + (p.pvp_final * p.participacion / 100), 0)))
  const cfReal   = cfMes > 0 ? cfMes : 1159000
  const pautaReal = pautaMes > 0 ? pautaMes : 1500000
  const totalCF  = cfReal + pautaReal

  // PE base por modo
  const peMinimo       = gananciaPond > 0 ? Math.ceil(totalCF / gananciaPond) : 0
  const peRentabilidad = gananciaPond > 0 ? Math.ceil((totalCF + config.utilidad_meta) / gananciaPond) : 0
  const capDia         = (capacidad.confirmadores || config.num_confirmadores) * 40
  const peTiburon      = capDia * 30

  const PE_MODOS = {
    minimo:       peMinimo,
    rentabilidad: peRentabilidad,
    tiburon:      peTiburon,
  }
  const peMeta = PE_MODOS[config.modo_activo]

  // Fórmula inversa embudo: Shopify requerido
  const tc = config.tasa_confirmacion / 100
  const td = config.tasa_despacho     / 100
  const te = config.tasa_entrega      / 100
  const factorEmbudo = safe(tc * td * te)
  const shopifyRequerido = (peMeta: number) => factorEmbudo > 0 ? Math.ceil(peMeta / factorEmbudo) : 0

  // Tiempo real
  const entregadosActuales = pedidosOverride !== null ? pedidosOverride : datosLive.entregados
  const gananciaAcum       = entregadosActuales * gananciaPond
  const pctAvance          = safe(pct(gananciaAcum, totalCF + (config.modo_activo === 'rentabilidad' ? config.utilidad_meta : 0)))
  const ritmoActual        = diaActual > 0 ? entregadosActuales / diaActual : 0
  const proyeccionMes      = Math.round(ritmoActual * 30)
  const diasRestantes      = 30 - diaActual
  const faltanEntregados   = Math.max(peMeta - entregadosActuales, 0)
  const ritmoNecesario     = diasRestantes > 0 ? Math.ceil(faltanEntregados / diasRestantes) : 0
  const vaBien             = entregadosActuales >= (peMeta * diaActual / 30)

  const modoColor = { minimo: T.red, rentabilidad: T.yellow, tiburon: T.gold }[config.modo_activo]

  // ── ESCENARIOS ─────────────────────────────────────────────
  const escenarios = [
    { nombre:'Pesimista',    factor:0.7, color:T.red,    tc:config.tasa_confirmacion * 0.85, td:config.tasa_despacho * 0.9, te:config.tasa_entrega * 0.85 },
    { nombre:'Realista',     factor:1.0, color:T.yellow, tc:config.tasa_confirmacion,        td:config.tasa_despacho,       te:config.tasa_entrega },
    { nombre:'Optimista',    factor:1.3, color:T.green,  tc:config.tasa_confirmacion * 1.1,  td:config.tasa_despacho * 1.05, te:config.tasa_entrega * 1.1 },
    { nombre:'Personalizado',factor:0,   color:T.purple, tc:config.tasa_confirmacion,        td:config.tasa_despacho,       te:config.tasa_entrega },
  ].map(e => {
    const pedidos    = e.factor > 0 ? Math.round(peMeta * e.factor) : metaPedidos || peMeta
    const tcE        = Math.min(e.tc, 100) / 100
    const tdE        = Math.min(e.td, 100) / 100
    const teE        = Math.min(e.te, 100) / 100
    const embudo     = safe(tcE * tdE * teE)
    const shopify    = embudo > 0 ? Math.ceil(pedidos / embudo) : 0
    const inversion  = config.cpa_referencia > 0 ? shopify * config.cpa_referencia : pautaReal
    const stock      = pedidos * prodsEfectivos.reduce((s, p) => s + p.costo_proveedor * p.participacion / 100, 0)
    const fletes     = pedidos * prodsEfectivos.reduce((s, p) => s + (p.costo_flete + p.costo_fulfillment) * p.participacion / 100, 0)
    const capital    = inversion + stock + fletes + cfReal
    const utilidad   = pedidos * gananciaPond - totalCF
    const walletPct  = walletSaldo > 0 ? Math.min(Math.round((walletSaldo / capital) * 100), 100) : 0
    return { ...e, pedidos, shopify, inversion, stock, fletes, capital, utilidad, walletPct, faltaCapital: Math.max(capital - walletSaldo, 0) }
  })

  // ── DIAGNÓSTICO CAPACIDAD ──────────────────────────────────
  const capConfirmadores = (capacidad.confirmadores || config.num_confirmadores) * 40
  const capEmpacadores   = (capacidad.empacadores   || config.num_empacadores)   * 60
  const capTotal         = Math.min(capConfirmadores, capEmpacadores)

  const diagModos = ([
    { modo:'minimo'      as Modo, pedidosDia: Math.ceil(peMinimo / 30) },
    { modo:'rentabilidad'as Modo, pedidosDia: Math.ceil(peRentabilidad / 30) },
    { modo:'tiburon'     as Modo, pedidosDia: Math.ceil(peTiburon / 30) },
  ]).map(d => ({
    ...d,
    sat: safe(Math.round((d.pedidosDia / (capTotal || 1)) * 100)),
    ok:  d.pedidosDia <= capTotal,
  }))

  // ── BARRA PE ───────────────────────────────────────────────
  function BarraPE({ actual, meta, color }: { actual: number; meta: number; color: string }) {
    const p = Math.min(safe(pct(actual, meta)), 100)
    return (
      <div style={{ height:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'6px', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${p}%`, background:color, borderRadius:'6px', transition:'width .5s' }} />
      </div>
    )
  }

  // ── SEMÁFORO ───────────────────────────────────────────────
  function Semaforo({ perdida }: { perdida: number }) {
    const color = perdida < 5 ? T.green : perdida < 15 ? T.yellow : T.red
    const label = perdida < 5 ? '🟢 Óptimo' : perdida < 15 ? '🟡 Revisar' : '🔴 Crítico'
    return <span style={{ fontSize:'10px', fontWeight:'700', color }}>{label} ({perdida.toFixed(0)}% pérdida)</span>
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Calculando punto de equilibrio...
    </div>
  )

  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:T.text, marginBottom:'4px' }}>⚖️ Punto de Equilibrio</h1>
          <p style={{ fontSize:'12px', color:T.muted }}>Los pedidos Shopify son una ilusión — el dinero real está en los entregados</p>
        </div>
        {guardando && <span style={{ fontSize:'11px', color:T.muted, alignSelf:'center' }}>Guardando...</span>}
      </div>

      {/* ── SELECTOR DE MODO ── */}
      <div style={{ ...s, padding:'16px 20px', marginBottom:'20px' }}>
        <div style={{ fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'12px', letterSpacing:'0.05em' }}>
          MODO DE PUNTO DE EQUILIBRIO
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'10px' }}>
          {MODOS.map(m => (
            <button key={m.v} onClick={() => guardarConfig({ modo_activo: m.v })}
              style={{ padding:'12px 14px', borderRadius:'10px', cursor:'pointer', textAlign:'left', border:`2px solid ${config.modo_activo === m.v ? m.color : T.border}`,
                background: config.modo_activo === m.v ? `${m.color}12` : 'transparent', transition:'all .2s' }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color: config.modo_activo === m.v ? m.color : T.text, marginBottom:'3px' }}>{m.l}</div>
              <div style={{ fontSize:'11px', color:T.muted }}>{m.sub}</div>
              <div style={{ fontSize:'16px', fontWeight:'800', color: m.color, marginTop:'8px' }}>
                {PE_MODOS[m.v]} pedidos
              </div>
              {m.v === 'rentabilidad' && config.modo_activo === 'rentabilidad' && (
                <div style={{ marginTop:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ fontSize:'10px', color:T.muted }}>Utilidad deseada:</span>
                  <input type="number" value={config.utilidad_meta}
                    onChange={e => guardarConfig({ utilidad_meta: Number(e.target.value) })}
                    onClick={e => e.stopPropagation()}
                    style={{ ...inp, width:'90px', padding:'4px 8px', fontSize:'11px' }} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs CENTRALES ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px', marginBottom:'20px' }}>
        {[
          { l:'PE Meta (modo activo)',   v:`${peMeta} pedidos`,          sub:`${shopifyRequerido(peMeta)} en Shopify`,   c:modoColor },
          { l:'Ganancia ponderada',      v:fmt(gananciaPond),             sub:'por pedido entregado (mezcla)',            c:T.green },
          { l:'Total a cubrir',          v:fmt(totalCF),                  sub:`CF ${fmt(cfReal)} + Pauta ${fmt(pautaReal)}`, c:T.blue },
          { l:'Factor embudo TC×TD×TE',  v:`${(factorEmbudo*100).toFixed(1)}%`, sub:`${config.tasa_confirmacion}%×${config.tasa_despacho}%×${config.tasa_entrega}%`, c:T.purple },
        ].map(k => (
          <div key={k.l} style={{ ...s, padding:'14px 16px', borderTop:`3px solid ${k.c}` }}>
            <div style={{ fontSize:'10px', color:T.muted, marginBottom:'4px' }}>{k.l}</div>
            <div style={{ fontSize:'18px', fontWeight:'800', color:k.c, marginBottom:'2px' }}>{k.v}</div>
            <div style={{ fontSize:'10px', color:T.muted }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── EMBUDO VISUAL (siempre visible) ── */}
      <div style={{ ...s, padding:'16px 20px', marginBottom:'20px' }}>
        <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'12px' }}>
          🔽 EMBUDO REAL DEL MES — 4 ETAPAS
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'8px' }}>
          {[
            { l:'🛍️ Shopify',      n:datosLive.shopify,      perdida:0,                                             desc:'Total pedidos recibidos' },
            { l:'📞 Confirmados', n:datosLive.confirmados,  perdida:safe(100 - pct(datosLive.confirmados, datosLive.shopify)),     desc:`TC: ${pct(datosLive.confirmados, datosLive.shopify)}%` },
            { l:'📦 Despachados', n:datosLive.despachados,  perdida:safe(100 - pct(datosLive.despachados, datosLive.confirmados)), desc:`TD: ${pct(datosLive.despachados, datosLive.confirmados)}%` },
            { l:'💰 Entregados',  n:datosLive.entregados,   perdida:safe(100 - pct(datosLive.entregados, datosLive.despachados)),  desc:`TE: ${pct(datosLive.entregados, datosLive.despachados)}%` },
          ].map((e, i) => (
            <div key={i} style={{ ...s2, padding:'14px', textAlign:'center', position:'relative' }}>
              <div style={{ fontSize:'11px', color:T.muted, marginBottom:'6px' }}>{e.l}</div>
              <div style={{ fontSize:'28px', fontWeight:'900', color: i === 3 ? T.green : T.text, marginBottom:'4px' }}>{e.n}</div>
              <div style={{ fontSize:'10px', color: i === 0 ? T.muted : T.blue, marginBottom:'6px' }}>{e.desc}</div>
              {i > 0 && <Semaforo perdida={e.perdida} />}
              {i < 3 && (
                <div style={{ position:'absolute', right:'-14px', top:'50%', transform:'translateY(-50%)', zIndex:2, fontSize:'16px', color:T.muted }}>→</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop:'12px', padding:'10px 14px', background:`${T.accent}08`, borderRadius:'8px', border:`1px solid ${T.accent}20`, fontSize:'12px', color:T.muted }}>
          Para entregar <strong style={{ color:T.text }}>{peMeta} pedidos</strong> necesitas capturar{' '}
          <strong style={{ color:T.accent }}>{shopifyRequerido(peMeta).toLocaleString('es-CO')} en Shopify</strong>{' '}
          con las tasas actuales ({config.tasa_confirmacion}% × {config.tasa_despacho}% × {config.tasa_entrega}%)
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { v:'tiempo_real' as Tab, l:'🕐 Tiempo Real' },
          { v:'escenarios'  as Tab, l:'🎯 Escenarios' },
          { v:'capacidad'   as Tab, l:'🏭 Capacidad' },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{ padding:'8px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'13px',
              fontWeight: tab === t.v ? '700' : '400',
              border: `1px solid ${tab === t.v ? T.accent : T.border}`,
              background: tab === t.v ? `${T.accent}15` : 'transparent',
              color: tab === t.v ? T.accent : T.muted }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB 1 — TIEMPO REAL (GPS del mes)
      ══════════════════════════════════════════════════════════ */}
      {tab === 'tiempo_real' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>

          {/* Columna izquierda */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

            {/* Inputs */}
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'14px' }}>📊 SEGUIMIENTO GPS DEL MES</div>
              <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'16px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'11px', color:T.muted, marginBottom:'5px' }}>Día actual</label>
                  <input type="number" value={diaActual} min={1} max={30}
                    onChange={e => setDiaActual(Number(e.target.value))} style={inp} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'11px', color:T.muted, marginBottom:'5px' }}>
                    Entregados {pedidosOverride === null && <span style={{ color:T.green, fontSize:'9px' }}>(BD auto)</span>}
                  </label>
                  <input type="number" value={pedidosOverride !== null ? pedidosOverride : entregadosActuales} min={0}
                    onChange={e => setPedidosOverride(Number(e.target.value))} style={inp} />
                </div>
                {pedidosOverride !== null && (
                  <div style={{ display:'flex', alignItems:'flex-end' }}>
                    <button onClick={() => setPedidosOverride(null)}
                      style={{ padding:'7px 11px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'7px', color:T.blue, cursor:'pointer', fontSize:'11px' }}>
                      ↺ BD
                    </button>
                  </div>
                )}
              </div>

              {/* Velocímetro */}
              <div style={{ marginBottom:'12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                  <span style={{ fontSize:'12px', color:T.muted }}>Avance hacia {MODOS.find(m => m.v === config.modo_activo)?.l}</span>
                  <span style={{ fontSize:'16px', fontWeight:'900', color: vaBien ? T.green : T.red }}>{Math.min(pctAvance, 100)}%</span>
                </div>
                <BarraPE actual={gananciaAcum} meta={totalCF} color={vaBien ? T.green : T.red} />
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
                  <span style={{ fontSize:'10px', color:T.muted }}>$0</span>
                  <span style={{ fontSize:'10px', color:modoColor }}>{fmt(totalCF)} meta</span>
                </div>
              </div>

              {/* Sub-barras CF y Pauta */}
              {[
                { l:'Costos Fijos cubiertos',  v:Math.min(safe(pct(gananciaAcum, cfReal)),      100), c:T.blue },
                { l:'Pauta cubierta',           v:Math.min(safe(pct(Math.max(gananciaAcum - cfReal, 0), pautaReal)), 100), c:T.purple },
              ].map((b, i) => (
                <div key={i} style={{ marginBottom:'8px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'11px', color:T.muted }}>{b.l}</span>
                    <span style={{ fontSize:'11px', fontWeight:'700', color:b.c }}>{b.v}%</span>
                  </div>
                  <BarraPE actual={b.v} meta={100} color={b.c} />
                </div>
              ))}

              {/* Status */}
              <div style={{ marginTop:'14px', padding:'12px', borderRadius:'10px',
                background: vaBien ? `${T.green}08` : `${T.red}08`,
                border:`1px solid ${vaBien ? T.green : T.red}30` }}>
                <div style={{ fontSize:'14px', fontWeight:'700', color: vaBien ? T.green : T.red, marginBottom:'5px' }}>
                  {entregadosActuales >= peMeta
                    ? `🎉 ¡Superaste el PE! Modo ${MODOS.find(m => m.v === config.modo_activo)?.l}`
                    : vaBien ? '✅ En ritmo — vas bien' : '⚠️ Por debajo del ritmo — acelerar'}
                </div>
                <div style={{ fontSize:'12px', color:T.muted, lineHeight:'1.6' }}>
                  {entregadosActuales >= peMeta
                    ? `Ganancia adicional: ${fmt((entregadosActuales - peMeta) * gananciaPond)}`
                    : `Necesitas ${faltanEntregados} pedidos más en ${diasRestantes} días → ${ritmoNecesario}/día`}
                </div>
                <div style={{ marginTop:'8px', fontSize:'11px', color:T.muted }}>
                  Ritmo actual: <strong style={{ color:T.text }}>{ritmoActual.toFixed(1)}/día</strong> →
                  Proyección mes: <strong style={{ color: proyeccionMes >= peMeta ? T.green : T.red }}>{proyeccionMes} entregados</strong>
                </div>
              </div>
            </div>

            {/* Embudo de HOY */}
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'12px' }}>📅 EMBUDO DE HOY</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'6px' }}>
                {[
                  { l:'Shopify', n:datosHoy.shopify },
                  { l:'Conf.',   n:datosHoy.confirmados,  perdida:safe(100 - pct(datosHoy.confirmados, datosHoy.shopify)) },
                  { l:'Desp.',   n:datosHoy.despachados,  perdida:safe(100 - pct(datosHoy.despachados, datosHoy.confirmados)) },
                  { l:'Entregados', n:datosHoy.entregados, perdida:safe(100 - pct(datosHoy.entregados, datosHoy.despachados)) },
                ].map((e, i) => {
                  const mal = i > 0 && ((e as { perdida?: number }).perdida || 0) > 15
                  return (
                    <div key={i} style={{ ...s2, padding:'10px 8px', textAlign:'center', border:`1px solid ${mal ? T.red : T.border}` }}>
                      <div style={{ fontSize:'10px', color:T.muted, marginBottom:'4px' }}>{e.l}</div>
                      <div style={{ fontSize:'22px', fontWeight:'800', color: i===3 ? T.green : mal ? T.red : T.text }}>{e.n}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop:'10px', fontSize:'11px', color:T.muted }}>
                Meta hoy: <strong style={{ color:modoColor }}>{Math.ceil(peMeta / 30)} entregados</strong>
                {' · '}Shopify hoy: <strong style={{ color:T.text }}>{Math.ceil(shopifyRequerido(peMeta) / 30)} requeridos</strong>
              </div>
            </div>
          </div>

          {/* Columna derecha — Calendario */}
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'12px' }}>
              📆 CALENDARIO DEL MES — MAPA DE CALOR
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'4px', marginBottom:'12px' }}>
              {Array.from({ length:30 }, (_, i) => i + 1).map(dia => {
                const ritmo      = diaActual > 0 ? entregadosActuales / diaActual : 0
                const acumDia    = Math.round(ritmo * dia)
                const metaDia    = Math.ceil(peMeta * dia / 30)
                const esPEDia    = acumDia >= peMeta && Math.round(ritmo * (dia - 1)) < peMeta
                const cubreDia   = acumDia >= metaDia
                const esFuturo   = dia > diaActual
                const esHoy      = dia === diaActual
                return (
                  <div key={dia} style={{ padding:'5px 3px', borderRadius:'6px', textAlign:'center',
                    background: esHoy ? modoColor : esPEDia ? `${T.purple}40` : cubreDia && !esFuturo ? `${T.green}20` : esFuturo ? 'rgba(255,255,255,0.02)' : `${T.red}15`,
                    border:`1px solid ${esHoy ? modoColor : T.border}` }}>
                    <div style={{ fontSize:'10px', fontWeight:'700',
                      color: esHoy ? '#000' : esPEDia ? T.purple : cubreDia && !esFuturo ? T.green : esFuturo ? T.border : T.red }}>
                      {dia}
                    </div>
                    {!esFuturo && <div style={{ fontSize:'7px', color: esHoy ? '#000' : T.muted }}>{acumDia}</div>}
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'14px' }}>
              {[
                { color:`${T.red}40`,    label:'Bajo ritmo' },
                { color:`${T.purple}40`, label:'Día PE' },
                { color:`${T.green}30`,  label:'En ritmo' },
                { color:modoColor,       label:'Hoy' },
              ].map((l, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'3px', background:l.color }} />
                  <span style={{ fontSize:'10px', color:T.muted }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Tasas configurables */}
            <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:'14px' }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:T.blue, marginBottom:'10px' }}>⚙️ TASAS DEL EMBUDO</div>
              {[
                { l:'TC — Confirmación %', k:'tasa_confirmacion' as keyof Config },
                { l:'TD — Despacho %',     k:'tasa_despacho'     as keyof Config },
                { l:'TE — Entrega %',      k:'tasa_entrega'      as keyof Config },
              ].map(row => (
                <div key={String(row.k)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <span style={{ fontSize:'11px', color:T.muted }}>{row.l}</span>
                  <input type="number" min={0} max={100}
                    value={Number(config[row.k])}
                    onChange={e => guardarConfig({ [row.k]: Number(e.target.value) } as Partial<Config>)}
                    style={{ ...inp, width:'80px', textAlign:'right' }} />
                </div>
              ))}
              <div style={{ marginTop:'10px', padding:'8px 10px', background:`${T.accent}08`, borderRadius:'8px', fontSize:'11px', color:T.muted }}>
                Factor embudo: <strong style={{ color:T.accent }}>{(factorEmbudo * 100).toFixed(1)}%</strong>
                {' — '}De cada 100 Shopify se entregan <strong style={{ color:T.text }}>{(factorEmbudo * 100).toFixed(0)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 2 — ESCENARIOS (Predictivo)
      ══════════════════════════════════════════════════════════ */}
      {tab === 'escenarios' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'12px', marginBottom:'16px' }}>
            {escenarios.map((e, i) => (
              <div key={i}
                onClick={() => setEscenarioActivo(escenarioActivo === i ? null : i)}
                style={{ ...s, padding:'18px', borderTop:`3px solid ${e.color}`, cursor:'pointer',
                  outline: escenarioActivo === i ? `2px solid ${e.color}` : 'none', transition:'all .2s' }}>
                <div style={{ fontSize:'14px', fontWeight:'800', color:e.color, marginBottom:'4px' }}>{e.nombre}</div>
                <div style={{ fontSize:'10px', color:T.muted, marginBottom:'12px' }}>
                  {e.factor > 0 ? `×${e.factor} del PE meta` : 'Define tu propia meta'}
                </div>
                {[
                  { l:'Entregados meta', v:e.pedidos.toString(),           c:T.text },
                  { l:'Shopify requerido', v:e.shopify.toLocaleString('es-CO'), c:T.blue },
                  { l:'Inversión pauta',  v:fmt(e.inversion),              c:T.purple },
                  { l:'Utilidad neta',    v:fmt(e.utilidad),               c: e.utilidad >= 0 ? T.green : T.red },
                ].map((row, j) => (
                  <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${T.border}` }}>
                    <span style={{ fontSize:'11px', color:T.muted }}>{row.l}</span>
                    <span style={{ fontSize:'12px', fontWeight:'700', color:row.c }}>{row.v}</span>
                  </div>
                ))}
                <div style={{ marginTop:'10px', padding:'8px', background:`${e.color}10`, borderRadius:'8px', fontSize:'11px', color:e.color, fontWeight:'700' }}>
                  {e.utilidad >= 0 ? `✓ ${fmt(e.utilidad)} de utilidad` : `✗ Pérdida de ${fmt(Math.abs(e.utilidad))}`}
                </div>
                <div style={{ marginTop:'8px', fontSize:'10px', color:T.muted, textAlign:'center' }}>
                  {escenarioActivo === i ? '▲ Cerrar flujo de caja' : '▼ Ver flujo de caja'}
                </div>
              </div>
            ))}
          </div>

          {/* Flujo de caja expandible */}
          {escenarioActivo !== null && (
            <div style={{ ...s, padding:'20px', border:`1px solid ${escenarios[escenarioActivo].color}40`, marginBottom:'16px' }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color:escenarios[escenarioActivo].color, marginBottom:'16px' }}>
                💰 FLUJO DE CAJA — Escenario {escenarios[escenarioActivo].nombre}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
                <div>
                  {[
                    { l:'📢 Inversión publicitaria', v:escenarios[escenarioActivo].inversion, nota:'CPA × pedidos Shopify requeridos' },
                    { l:'📦 Stock proveedor',        v:escenarios[escenarioActivo].stock,     nota:'Costo proveedor × pedidos meta' },
                    { l:'🚚 Fletes y logística',     v:escenarios[escenarioActivo].fletes,    nota:'Flete + fulfillment × pedidos' },
                    { l:'🏢 Costos fijos',           v:cfReal,                                nota:'CF operativos del mes' },
                  ].map((item, j) => (
                    <div key={j} style={{ padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontSize:'12px', color:T.text }}>{item.l}</span>
                        <span style={{ fontSize:'13px', fontWeight:'700', color:T.red }}>{fmt(item.v)}</span>
                      </div>
                      <div style={{ fontSize:'10px', color:T.muted, marginTop:'2px' }}>{item.nota}</div>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', fontSize:'14px', fontWeight:'800' }}>
                    <span style={{ color:T.text }}>CAPITAL TOTAL REQUERIDO</span>
                    <span style={{ color:T.accent }}>{fmt(escenarios[escenarioActivo].capital)}</span>
                  </div>
                </div>
                <div>
                  <div style={{ ...s2, padding:'14px', marginBottom:'10px' }}>
                    <div style={{ fontSize:'11px', color:T.muted, marginBottom:'8px' }}>💼 COBERTURA DE CAPITAL</div>
                    <BarraPE actual={escenarios[escenarioActivo].walletPct} meta={100} color={escenarios[escenarioActivo].walletPct >= 80 ? T.green : T.yellow} />
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px' }}>
                      <span style={{ fontSize:'11px', color:T.muted }}>Wallet actual: {fmt(walletSaldo)}</span>
                      <span style={{ fontSize:'12px', fontWeight:'700', color: escenarios[escenarioActivo].walletPct >= 80 ? T.green : T.yellow }}>
                        {escenarios[escenarioActivo].walletPct}% cubierto
                      </span>
                    </div>
                  </div>
                  <div style={{ ...s2, padding:'14px', background:`${T.yellow}08`, border:`1px solid ${T.yellow}20` }}>
                    <div style={{ fontSize:'11px', color:T.yellow, fontWeight:'700', marginBottom:'6px' }}>⚠️ RETORNO AL WALLET</div>
                    <div style={{ fontSize:'12px', color:T.muted, lineHeight:'1.6' }}>
                      El dinero regresa en <strong style={{ color:T.text }}>5-8 días</strong> post-entrega.
                      Asegura este flujo en banco <strong style={{ color:T.yellow }}>ANTES</strong> de encender campañas.
                    </div>
                    {escenarios[escenarioActivo].faltaCapital > 0 && (
                      <div style={{ marginTop:'10px', padding:'8px', background:`${T.red}10`, borderRadius:'8px' }}>
                        <div style={{ fontSize:'11px', color:T.red, fontWeight:'700' }}>
                          🏦 Capital a conseguir: {fmt(escenarios[escenarioActivo].faltaCapital)}
                        </div>
                        <div style={{ fontSize:'10px', color:T.muted, marginTop:'3px' }}>→ Ver módulo Inversión & Créditos</div>
                      </div>
                    )}
                  </div>
                  <div style={{ ...s2, padding:'12px', marginTop:'10px' }}>
                    <div style={{ fontSize:'11px', color:T.muted, marginBottom:'6px' }}>📊 MEZCLA DE PRODUCTOS EN PE</div>
                    {prodsEfectivos.slice(0, 4).map((p, j) => (
                      <div key={j} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'3px 0', borderBottom:`1px solid ${T.border}` }}>
                        <span style={{ color:T.muted }}>{p.nombre.slice(0, 20)}</span>
                        <span style={{ color:T.green }}>{fmt(p.ganancia_neta)}/ped</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CPA config */}
          <div style={{ ...s2, padding:'14px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'10px' }}>⚙️ PARÁMETRO CPA (para cálculo de inversión en escenarios)</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'12px', color:T.muted }}>CPA de referencia:</span>
              <input type="number" value={config.cpa_referencia}
                onChange={e => guardarConfig({ cpa_referencia: Number(e.target.value) })}
                style={{ ...inp, width:'120px' }} placeholder="0 = usar pauta real" />
              <span style={{ fontSize:'11px', color:T.muted }}>Si es 0, usa la pauta real del mes</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 3 — DIAGNÓSTICO DE CAPACIDAD
      ══════════════════════════════════════════════════════════ */}
      {tab === 'capacidad' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>

          {/* Recursos actuales */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>👥 CAPACIDAD HUMANA (desde Nómina)</div>
              {[
                { l:'Confirmadores', n:capacidad.confirmadores || config.num_confirmadores, cap:40, color:T.blue,   emoji:'📞' },
                { l:'Empacadores',   n:capacidad.empacadores   || config.num_empacadores,   cap:60, color:T.green,  emoji:'📦' },
              ].map((r, i) => (
                <div key={i} style={{ marginBottom:'14px', padding:'12px', ...s2, borderLeft:`3px solid ${r.color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                    <span style={{ fontSize:'12px', color:T.text, fontWeight:'600' }}>{r.emoji} {r.l}</span>
                    <span style={{ fontSize:'12px', color:r.color, fontWeight:'700' }}>{r.n} personas</span>
                  </div>
                  <div style={{ fontSize:'11px', color:T.muted }}>
                    Capacidad: <strong style={{ color:T.text }}>{r.n * r.cap} pedidos/día</strong>
                    {' '}({r.cap}/persona/día)
                  </div>
                  <div style={{ marginTop:'6px' }}>
                    <label style={{ fontSize:'10px', color:T.muted }}>Ajuste manual:</label>
                    <input type="number" min={0} max={20}
                      value={i === 0 ? config.num_confirmadores : config.num_empacadores}
                      onChange={e => guardarConfig(i === 0 ? { num_confirmadores: Number(e.target.value) } : { num_empacadores: Number(e.target.value) })}
                      style={{ ...inp, width:'70px', marginLeft:'8px', padding:'3px 8px', fontSize:'11px' }} />
                  </div>
                </div>
              ))}
              <div style={{ padding:'10px 12px', background:`${T.accent}08`, borderRadius:'8px', border:`1px solid ${T.accent}20` }}>
                <div style={{ fontSize:'11px', color:T.muted }}>Capacidad máxima diaria (cuello de botella):</div>
                <div style={{ fontSize:'20px', fontWeight:'800', color:T.accent }}>{capTotal} pedidos/día</div>
                <div style={{ fontSize:'10px', color:T.muted, marginTop:'2px' }}>= {capTotal * 30} pedidos/mes potencial</div>
              </div>
            </div>

            <div style={{ ...s, padding:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.purple, marginBottom:'12px' }}>🔧 TECNOLOGÍA ACTIVA</div>
              {[
                { l:'WhatsApp automatizado',    v:capacidad.wa_automatizado,  k:'wa_automatizado' as keyof Capacidad,  gain:'+15% TC' },
                { l:'Integración Dropi API',    v:capacidad.dropi_api_activa, k:'dropi_api_activa' as keyof Capacidad, gain:'-2h respuesta' },
              ].map((t, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontSize:'12px', color:T.text }}>{t.l}</div>
                    <div style={{ fontSize:'10px', color:T.green }}>{t.gain}</div>
                  </div>
                  <div style={{ fontSize:'13px', fontWeight:'700', color: t.v ? T.green : T.muted }}>
                    {t.v ? '✅ Activo' : '❌ Inactivo'}
                  </div>
                </div>
              ))}
              <div style={{ marginTop:'12px', padding:'10px', background:`${T.blue}08`, borderRadius:'8px', fontSize:'11px', color:T.muted }}>
                💡 Wallet disponible para pauta: <strong style={{ color:T.blue }}>{fmt(walletSaldo)}</strong>
              </div>
            </div>
          </div>

          {/* Diagnóstico por modo */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'14px' }}>📊 DIAGNÓSTICO POR MODO VS CAPACIDAD</div>
              {diagModos.map((d, i) => {
                const modoInfo = MODOS[i]
                return (
                  <div key={i} style={{ ...s2, padding:'14px', marginBottom:'10px', borderLeft:`3px solid ${modoInfo.color}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                      <span style={{ fontSize:'12px', fontWeight:'700', color:modoInfo.color }}>{modoInfo.l}</span>
                      <span style={{ fontSize:'11px', fontWeight:'700', color: d.ok ? T.green : T.red }}>
                        {d.ok ? '✅ Sostenible' : '⚠️ Saturado'}
                      </span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                      <span style={{ fontSize:'11px', color:T.muted }}>Requiere:</span>
                      <span style={{ fontSize:'12px', color:T.text }}>{d.pedidosDia}/día</span>
                    </div>
                    <BarraPE actual={d.pedidosDia} meta={capTotal} color={d.ok ? modoInfo.color : T.red} />
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px', fontSize:'10px', color:T.muted }}>
                      <span>0</span>
                      <span style={{ color: d.ok ? T.green : T.red }}>Saturación: {d.sat}%</span>
                      <span>Cap. {capTotal}/día</span>
                    </div>
                    {!d.ok && (
                      <div style={{ marginTop:'8px', padding:'7px', background:`${T.red}08`, borderRadius:'7px', fontSize:'11px', color:T.red }}>
                        ⚠️ Saturación {d.sat}% — necesitas +{Math.ceil((d.pedidosDia - capTotal) / 40)} confirmador(es) o +{Math.ceil((d.pedidosDia - capTotal) / 60)} empacador(es)
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Recomendaciones IA */}
            <div style={{ ...s, padding:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'12px' }}>🤖 RECOMENDACIONES</div>
              {[
                !capacidad.wa_automatizado && {
                  ico:'💬', color:T.blue,
                  msg:`Activar WhatsApp automatizado puede mejorar TC en +15%, equivale a +${Math.round((config.tasa_confirmacion * 1.15 - config.tasa_confirmacion))}% de confirmaciones sin contratar.`,
                },
                diagModos[2].sat > 100 && {
                  ico:'📞', color:T.yellow,
                  msg:`Para Modo Tiburón (${peTiburon} pedidos/mes) sin contratar: optimiza confirmación automatizada y horarios de llamada por zona horaria.`,
                },
                walletSaldo < escenarios[1].capital && {
                  ico:'🏦', color:T.red,
                  msg:`Tu wallet cubre solo ${escenarios[1].walletPct}% del capital del escenario Realista. Revisa el módulo Inversión & Créditos antes de escalar pauta.`,
                },
                diagModos[0].ok && !diagModos[1].ok && {
                  ico:'📈', color:T.green,
                  msg:`Puedes sostener el PE Mínimo con tu equipo actual. Para Meta Rentabilidad, considera +1 confirmador o automatización WhatsApp.`,
                },
              ].filter(Boolean).map((r, i) => r && (
                <div key={i} style={{ display:'flex', gap:'10px', padding:'10px', ...s2, marginBottom:'8px', borderLeft:`3px solid ${r.color}` }}>
                  <span style={{ fontSize:'20px', flexShrink:0 }}>{r.ico}</span>
                  <span style={{ fontSize:'12px', color:T.muted, lineHeight:'1.6' }}>{r.msg}</span>
                </div>
              ))}
              <div style={{ marginTop:'8px', padding:'10px', background:`${T.muted}08`, borderRadius:'8px', fontSize:'11px', color:T.muted, textAlign:'center' }}>
                🔗 Conectado con: Nómina · Wallet · Pauta · Metas · Pedidos
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTA DE PIE ── */}
      <div style={{ marginTop:'16px', padding:'12px 16px', background:T.card2, borderRadius:'10px', border:`1px solid ${T.border}`, fontSize:'12px', color:T.muted }}>
        📌 Ganancia ponderada: <strong style={{ color:T.green }}>{fmt(gananciaPond)}/pedido</strong> ·
        CF real: <strong style={{ color:T.blue }}>{fmt(cfReal)}</strong> ·
        Pauta real: <strong style={{ color:T.purple }}>{fmt(pautaReal)}</strong> ·
        Modo activo: <strong style={{ color:modoColor }}>{MODOS.find(m => m.v === config.modo_activo)?.l}</strong>
        {guardando && <span style={{ marginLeft:'12px', color:T.muted }}>· Guardando config...</span>}
      </div>
    </div>
  )
}
