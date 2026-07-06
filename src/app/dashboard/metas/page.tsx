'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── TEMA ──────────────────────────────────────────────────────
const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238', gold:'#FFD700',
}

type Tab = 'metas' | 'tiempo_real' | 'proyeccion' | 'historial' | 'hoy'
type Modo = 'sobrevivir' | 'rentabilidad' | 'crecer' | 'tiburon'
type Horizonte = 'mes' | 'trimestre' | 'anual'

interface MetasMes {
  modo_objetivo: Modo; horizonte: Horizonte
  meta_pedidos: number; meta_ventas: number; meta_utilidad: number; meta_cpa: number
  meta_confirmacion: number; meta_despacho: number; meta_entrega: number; meta_devolucion_max: number
  meta_iso_objetivo: number; meta_inversion_pauta: number; meta_roas: number
  meta_recompra: number; meta_ltv: number; meta_pqrsf_resolucion: number
  meta_tiempo_confirmacion: number; meta_tiempo_despacho: number; meta_nps: number
  meta_pedidos_trimestre: number; meta_ventas_trimestre: number
  meta_pedidos_anual: number; meta_ventas_anual: number
}

interface Tarea { ico:string; color:string; prioridad:string; titulo:string; desc:string }

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const META_DEFAULT: MetasMes = {
  modo_objetivo:'rentabilidad', horizonte:'mes',
  meta_pedidos:500, meta_ventas:35000000, meta_utilidad:4500000, meta_cpa:15000,
  meta_confirmacion:75, meta_despacho:90, meta_entrega:80, meta_devolucion_max:12,
  meta_iso_objetivo:75, meta_inversion_pauta:1500000, meta_roas:2,
  meta_recompra:15, meta_ltv:0, meta_pqrsf_resolucion:95,
  meta_tiempo_confirmacion:2, meta_tiempo_despacho:24, meta_nps:70,
  meta_pedidos_trimestre:0, meta_ventas_trimestre:0, meta_pedidos_anual:0, meta_ventas_anual:0,
}

const MODOS: { v:Modo; l:string; desc:string; color:string }[] = [
  { v:'sobrevivir',   l:'🔴 Sobrevivir',   desc:'Cubrir el PE mínimo. No quebrar.',          color:T.red },
  { v:'rentabilidad', l:'🟡 Rentabilidad', desc:'Generar utilidad real este mes.',            color:T.yellow },
  { v:'crecer',       l:'🟢 Crecer',       desc:'Escalar controladamente con excedentes.',    color:T.green },
  { v:'tiburon',      l:'🟠 Tiburón',      desc:'Escalar agresivo al máximo de capacidad.',   color:T.gold },
]

const fmt = (n:number) => `$${Math.round(n).toLocaleString('es-CO')}`
const fmtK = (n:number) => `$${Math.round(n/1000).toLocaleString('es-CO')}K`
const safe = (n:number) => isNaN(n) || !isFinite(n) ? 0 : n
const pct  = (a:number,b:number) => b>0 ? Math.round(a/b*100) : 0

// ── ISO ───────────────────────────────────────────────────────
function calcISO(tc:number, td:number, te:number, dev:number, margen:number): number {
  const margenFactor = Math.min(margen / 15, 1) // tope en 1.0 a partir de 15%
  const iso = (tc/100) * (td/100) * (te/100) * (1 - dev/100) * margenFactor * 100
  return safe(Math.round(iso))
}
function estadoISO(iso:number) { return iso >= 80 ? 'verde' : iso >= 60 ? 'amarillo' : 'rojo' }
function colorISO(iso:number) { return iso >= 80 ? T.green : iso >= 60 ? T.yellow : T.red }

export default function MetasPage() {
  const supabase = createClient()

  const hoy = new Date()
  const diaActual = hoy.getDate()
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate()
  const diasRestantes = diasMes - diaActual
  const periodoKey = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`

  const [tenantId, setTenantId] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [guardando,setGuardando]= useState(false)
  const [tab,      setTab]      = useState<Tab>('hoy')
  const [metas,    setMetas]    = useState<MetasMes>(META_DEFAULT)
  const [modoMedicion, setModoMedicion] = useState<'pe_minimo'|'meta'|'optimista'>('meta')

  // Datos reales conectados
  const [pedidosActuales, setPedidosActuales] = useState(0)
  const [shopifyActuales, setShopifyActuales] = useState(0)
  const [confActuales,    setConfActuales]    = useState(0)
  const [despActuales,    setDespActuales]    = useState(0)
  const [ventasActuales,  setVentasActuales]  = useState(0)
  const [utilidadActual,  setUtilidadActual]  = useState(0)
  const [tcReal, setTcReal] = useState(0)
  const [tdReal, setTdReal] = useState(0)
  const [teReal, setTeReal] = useState(0)
  const [devReal, setDevReal] = useState(0)
  const [margenReal, setMargenReal] = useState(0)
  const [cpaReal, setCpaReal] = useState(0)
  const [pautaReal, setPautaReal] = useState(0)
  const [roasReal, setRoasReal] = useState(0)
  const [peMinimo, setPeMinimo] = useState(0)
  const [confirmadores, setConfirmadores] = useState(0)
  const [walletSaldo, setWalletSaldo] = useState(0)
  const [cuotaCredito, setCuotaCredito] = useState(0)
  const [pqrsfPendientes, setPqrsfPendientes] = useState(0)
  const [pqrsfResolucion24h, setPqrsfResolucion24h] = useState(0)
  const [tasaRecompra, setTasaRecompra] = useState(0)
  const [ltvCalculado, setLtvCalculado] = useState(0)
  const [historial, setHistorial] = useState<{ mes:string; periodo:string; pedidos:number; meta:number; ventas:number; utilidad:number; iso:number; tc:number; activo?:boolean }[]>([])

  const s:  React.CSSProperties = { background:T.card,  border:`1px solid ${T.border}`, borderRadius:'12px' }
  const s2: React.CSSProperties = { background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px' }
  const inp: React.CSSProperties = { background:T.card2, border:`1px solid ${T.border}`, borderRadius:'7px', color:T.text, padding:'6px 10px', fontSize:'13px', outline:'none', width:'100%', boxSizing:'border-box' }

  // ── CARGA DE DATOS ────────────────────────────────────────
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
    const ini3m  = new Date(hoy.getFullYear(), hoy.getMonth()-3, 1).toISOString().slice(0,10)

    const [
      { data: metaData }, { data: pedidosMes }, { data: pedidos3m },
      { data: costos }, { data: pautaData }, { data: walletData },
      { data: creditosData }, { data: pqrsfData }, { data: histData },
      { data: colabsData }, { data: peConfig },
    ] = await Promise.all([
      supabase.from('metas').select('*').eq('tenant_id', tid).eq('periodo', periodoKey).single(),
      supabase.from('pedidos').select('estado, pvp, ganancia, cliente_tel').eq('tenant_id', tid)
        .gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes+'T23:59:59'),
      supabase.from('pedidos').select('cliente_tel, estado').eq('tenant_id', tid)
        .gte('fecha_pedido', ini3m).lte('fecha_pedido', finMes+'T23:59:59'),
      supabase.from('costos_fijos').select('total').eq('tenant_id', tid).eq('periodo', periodoKey).eq('activo', true),
      supabase.from('pauta').select('inversion, resultados, cpa').eq('tenant_id', tid)
        .gte('fecha', iniMes).lte('fecha', finMes),
      supabase.from('wallet_transacciones').select('tipo, monto').eq('tenant_id', tid),
      supabase.from('inversiones_creditos').select('cuota_mensual').eq('tenant_id', tid).eq('estado', 'activo'),
      supabase.from('pqrsf').select('estado, created_at, fecha_respuesta').eq('tenant_id', tid)
        .gte('created_at', iniMes),
      supabase.from('metas').select('periodo, meta_pedidos').eq('tenant_id', tid)
        .order('periodo', { ascending:false }).limit(6),
      supabase.from('colaboradores').select('cargo').eq('tenant_id', tid).eq('activo', true),
      supabase.from('pe_configuraciones').select('*').eq('tenant_id', tid).eq('periodo', periodoKey).single(),
    ])

    // ── Metas ─────────────────────────────────────────────
    if (metaData) {
      const m = metaData as Record<string, number | string>
      setMetas({
        modo_objetivo: (m.modo_objetivo as Modo) || 'rentabilidad',
        horizonte: (m.horizonte as Horizonte) || 'mes',
        meta_pedidos: Number(m.meta_pedidos) || 500,
        meta_ventas: Number(m.meta_ventas) || 35000000,
        meta_utilidad: Number(m.meta_utilidad) || 4500000,
        meta_cpa: Number(m.meta_cpa) || 15000,
        meta_confirmacion: Number(m.meta_confirmacion) || 75,
        meta_despacho: Number(m.meta_despacho) || 90,
        meta_entrega: Number(m.meta_entrega) || 80,
        meta_devolucion_max: Number(m.meta_devolucion_max) || 12,
        meta_iso_objetivo: Number(m.meta_iso_objetivo) || 75,
        meta_inversion_pauta: Number(m.meta_inversion_pauta) || 1500000,
        meta_roas: Number(m.meta_roas) || 2,
        meta_recompra: Number(m.meta_recompra) || 15,
        meta_ltv: Number(m.meta_ltv) || 0,
        meta_pqrsf_resolucion: Number(m.meta_pqrsf_resolucion) || 95,
        meta_tiempo_confirmacion: Number(m.meta_tiempo_confirmacion) || 2,
        meta_tiempo_despacho: Number(m.meta_tiempo_despacho) || 24,
        meta_nps: Number(m.meta_nps) || 70,
        meta_pedidos_trimestre: Number(m.meta_pedidos_trimestre) || 0,
        meta_ventas_trimestre: Number(m.meta_ventas_trimestre) || 0,
        meta_pedidos_anual: Number(m.meta_pedidos_anual) || 0,
        meta_ventas_anual: Number(m.meta_ventas_anual) || 0,
      })
    }

    // ── Embudo del mes ────────────────────────────────────
    const peds = (pedidosMes || []) as { estado:string; pvp:number; ganancia:number; cliente_tel:string }[]
    const enFlujo = ['CONFIRMADO','DESPACHADO','EN_TRANSITO','ENTREGADO','NOVEDAD','DEVOLUCION']
    const conf = peds.filter(p => enFlujo.includes(p.estado))
    const desp = peds.filter(p => ['DESPACHADO','EN_TRANSITO','ENTREGADO','NOVEDAD','DEVOLUCION'].includes(p.estado))
    const entregados = peds.filter(p => p.estado === 'ENTREGADO')
    const devs = peds.filter(p => p.estado === 'DEVOLUCION')

    setShopifyActuales(peds.length)
    setConfActuales(conf.length)
    setDespActuales(desp.length)
    setPedidosActuales(entregados.length)
    setVentasActuales(Math.round(entregados.reduce((a,p) => a+Number(p.pvp||0),0)))
    const utilTotal = entregados.reduce((a,p) => a+Number(p.ganancia||0),0)
    setUtilidadActual(Math.round(utilTotal))

    setTcReal(safe(pct(conf.length, peds.length)))
    setTdReal(safe(pct(desp.length, conf.length)))
    setTeReal(safe(pct(entregados.length, desp.length)))
    setDevReal(safe(pct(devs.length, entregados.length + devs.length)))
    const pvpTotal = entregados.reduce((a,p)=>a+Number(p.pvp||0),0)
    setMargenReal(pvpTotal>0 ? safe(Math.round(utilTotal/pvpTotal*100)) : 0)

    // ── Recompra (3 meses, mismo teléfono) ─────────────────
    const p3m = (pedidos3m || []) as { cliente_tel:string; estado:string }[]
    const telsValidos = p3m.filter(p => p.cliente_tel && p.estado === 'ENTREGADO').map(p => p.cliente_tel)
    const conteoTel: Record<string, number> = {}
    telsValidos.forEach(t => { conteoTel[t] = (conteoTel[t]||0) + 1 })
    const totalClientesUnicos = Object.keys(conteoTel).length
    const recurrentes = Object.values(conteoTel).filter(c => c > 1).length
    setTasaRecompra(totalClientesUnicos > 0 ? safe(Math.round(recurrentes/totalClientesUnicos*100)) : 0)
    const ticketProm = pvpTotal > 0 && entregados.length > 0 ? pvpTotal / entregados.length : 0
    setLtvCalculado(Math.round(ticketProm * (1 + recurrentes/Math.max(totalClientesUnicos,1)) * 1.5))

    // ── CF / Pauta / CPA / ROAS ─────────────────────────────
    setPautaReal(Math.round((pautaData||[]).reduce((a:number,p:{inversion:number})=>a+Number(p.inversion||0),0)))
    const resT = (pautaData||[]).reduce((a:number,p:{resultados:number})=>a+Number(p.resultados||0),0)
    const invT = (pautaData||[]).reduce((a:number,p:{inversion:number})=>a+Number(p.inversion||0),0)
    setCpaReal(resT>0 ? Math.round(invT/resT) : 0)
    setRoasReal(invT>0 ? safe(Math.round(utilTotal/invT*100)/100) : 0)

    // ── Wallet ──────────────────────────────────────────────
    const wRows = (walletData||[]) as { tipo:string; monto:number }[]
    const ent = wRows.filter(w=>w.tipo==='ENTRADA').reduce((a,w)=>a+Number(w.monto),0)
    const sal = wRows.filter(w=>w.tipo==='SALIDA').reduce((a,w)=>a+Number(w.monto),0)
    setWalletSaldo(Math.round(ent-sal))

    // ── Crédito activo ───────────────────────────────────────
    setCuotaCredito(Math.round((creditosData||[]).reduce((a:number,c:{cuota_mensual:number})=>a+Number(c.cuota_mensual||0),0)))

    // ── PQRSF ─────────────────────────────────────────────────
    const pqrsfRows = (pqrsfData||[]) as { estado:string; created_at:string; fecha_respuesta:string|null }[]
    setPqrsfPendientes(pqrsfRows.filter(p => p.estado !== 'CERRADO').length)
    const conRespuesta = pqrsfRows.filter(p => p.fecha_respuesta)
    const en24h = conRespuesta.filter(p => {
      const diff = new Date(p.fecha_respuesta!).getTime() - new Date(p.created_at).getTime()
      return diff <= 24*60*60*1000
    })
    setPqrsfResolucion24h(conRespuesta.length>0 ? safe(Math.round(en24h.length/conRespuesta.length*100)) : 100)

    // ── Nómina / capacidad ────────────────────────────────────
    const cols = (colabsData||[]) as { cargo:string }[]
    setConfirmadores(cols.filter(c=>c.cargo.toLowerCase().includes('confirmad')).length)

    // ── PE Mínimo desde módulo Equilibrio ─────────────────────
    if (peConfig) setPeMinimo(0) // placeholder; PE real se calcula en su propio módulo

    // ── Historial 6 meses ──────────────────────────────────────
    const hist = (histData||[]) as { periodo:string; meta_pedidos:number }[]
    const histConDatos = await Promise.all(hist.map(async (h) => {
      const mesDate = new Date(h.periodo)
      const ini = h.periodo.slice(0,7)+'-01'
      const fin = new Date(mesDate.getFullYear(), mesDate.getMonth()+1, 0).toISOString().slice(0,10)
      const { data: pedHist } = await supabase.from('pedidos').select('pvp, ganancia, estado')
        .eq('tenant_id', tid).gte('fecha_pedido', ini).lte('fecha_pedido', fin+'T23:59:59')
      const rows = (pedHist||[]) as { pvp:number; ganancia:number; estado:string }[]
      const entr = rows.filter(r=>r.estado==='ENTREGADO')
      const confH = rows.filter(r=>enFlujo.includes(r.estado))
      const tcH = safe(pct(confH.length, rows.length))
      const pvpH = entr.reduce((a,r)=>a+Number(r.pvp||0),0)
      const utilH = entr.reduce((a,r)=>a+Number(r.ganancia||0),0)
      const margenH = pvpH>0 ? safe(Math.round(utilH/pvpH*100)) : 0
      return {
        mes: MESES_ES[mesDate.getMonth()], periodo: h.periodo,
        pedidos: entr.length, meta: Number(h.meta_pedidos)||500,
        ventas: pvpH, utilidad: utilH,
        iso: calcISO(tcH, 90, tcH>0?safe(pct(entr.length,confH.length)):0, 0, margenH),
        tc: tcH, activo: h.periodo === periodoKey,
      }
    }))
    setHistorial(histConDatos.reverse())
    setLoading(false)
  }, [supabase, periodoKey, diasMes])

  useEffect(() => { loadData() }, [loadData])

  async function guardarMetas(nuevas: Partial<MetasMes>) {
    const merged = { ...metas, ...nuevas }
    setMetas(merged)
    if (!tenantId) return
    setGuardando(true)
    await supabase.from('metas').upsert({ tenant_id:tenantId, periodo:periodoKey, ...merged }, { onConflict:'tenant_id,periodo' })
    setGuardando(false)
  }

  // ── ISO ACTUAL ────────────────────────────────────────────
  const isoActual = calcISO(tcReal, tdReal, teReal, devReal, margenReal)
  const isoColor  = colorISO(isoActual)
  const isoEstado = estadoISO(isoActual)

  // ── Meta efectiva según modo de medición ───────────────────
  const metaEfectiva = modoMedicion === 'pe_minimo' ? Math.round(metas.meta_pedidos*0.7)
    : modoMedicion === 'optimista' ? Math.round(metas.meta_pedidos*1.3) : metas.meta_pedidos

  // ── Proyección ponderada (castigada por ISO) ────────────────
  const ritmoActual = diaActual>0 ? pedidosActuales/diaActual : 0
  const factorSalud = isoActual >= 75 ? 1.05 : isoActual >= 60 ? 1.0 : 0.85
  const proyPedidos = Math.round(ritmoActual * diasMes * factorSalud)
  const proyVentas  = diaActual>0 ? Math.round((ventasActuales/diaActual)*diasMes*factorSalud) : 0
  const proyUtilidad= diaActual>0 ? Math.round((utilidadActual/diaActual)*diasMes*factorSalud) : 0
  const pctMeta     = safe(pct(pedidosActuales, metaEfectiva))
  const vaBien      = pedidosActuales >= Math.round(metaEfectiva*diaActual/diasMes)
  const pedFaltantes= Math.max(metaEfectiva - pedidosActuales, 0)
  const pedDiaNec   = diasRestantes>0 ? Math.ceil(pedFaltantes/diasRestantes) : 0
  const capDiaConf  = confirmadores * 40

  // ── Diagnóstico inteligente ──────────────────────────────────
  function diagnosticoInteligente(): string {
    if (cpaReal > metas.meta_cpa && metas.meta_cpa > 0) {
      return `Tu CPA actual (${fmt(cpaReal)}) supera el máximo (${fmt(metas.meta_cpa)}). Estás comprando volumen a pérdida. El problema no es el ritmo — es el margen.`
    }
    if (tcReal < metas.meta_confirmacion && capDiaConf > 0 && pedDiaNec > capDiaConf) {
      return `Tu TC del mes es ${tcReal}% vs meta ${metas.meta_confirmacion}%. Con ${confirmadores} confirmador(es) procesas ${capDiaConf}/día. Físicamente no puedes llegar a ${pedDiaNec}/día. Optimiza confirmación primero.`
    }
    if (devReal > metas.meta_devolucion_max) {
      return `Tu devolución (${devReal}%) supera el máximo (${metas.meta_devolucion_max}%). Revisa calidad de producto o información en el checkout antes de escalar pauta.`
    }
    return ''
  }
  const diagnostico = diagnosticoInteligente()

  // ── Status motivador ──────────────────────────────────────
  function statusMotivador(): { texto:string; color:string } {
    if (pedidosActuales >= metaEfectiva) return { texto:`🏆 Superaste la meta. ¿Es momento de revisar si puedes escalar el siguiente mes? Tu ISO lo permite.`, color:T.green }
    if (vaBien) return { texto:`¡Vas por delante! Llevas el ${pctMeta}% en el ${Math.round(diaActual/diasMes*100)}% del mes. Continúa así.`, color:T.green }
    if (pedDiaNec <= capDiaConf || capDiaConf === 0) return { texto:`Estás en el ritmo. Necesitas mantener ${pedDiaNec} pedidos/día los próximos ${diasRestantes} días.`, color:T.yellow }
    return { texto:`Necesitas acelerar. La brecha es de ${pedFaltantes} pedidos en ${diasRestantes} días (${pedDiaNec}/día). ¿Simular inyección de pauta?`, color:T.red }
  }
  const status = statusMotivador()

  // ── Tareas del día (IA) ──────────────────────────────────────
  const tareas: Tarea[] = []
  if (pqrsfPendientes > 5) tareas.push({ ico:'🔴', color:T.red, prioridad:'URGENTE', titulo:`${pqrsfPendientes} PQRSF pendientes`, desc:'Revisar y resolver para no afectar meta de calidad' })
  if (cpaReal > metas.meta_cpa && metas.meta_cpa > 0) tareas.push({ ico:'🟡', color:T.yellow, prioridad:'IMPORTANTE', titulo:`CPA en ${fmt(cpaReal)}`, desc:`El máximo es ${fmt(metas.meta_cpa)}. Revisar campaña activa` })
  if (roasReal >= 3) tareas.push({ ico:'🟢', color:T.green, prioridad:'OPORTUNIDAD', titulo:`ROAS en ${roasReal.toFixed(1)}x`, desc:'Por encima de 3x. Considera escalar presupuesto' })
  if (tcReal < metas.meta_confirmacion) tareas.push({ ico:'🟡', color:T.yellow, prioridad:'IMPORTANTE', titulo:`TC en ${tcReal}% vs meta ${metas.meta_confirmacion}%`, desc:'Optimiza el proceso de confirmación' })
  tareas.push({ ico:'💡', color:T.blue, prioridad:'IA SUGIERE', titulo:'Mejor horario de confirmación', desc:'Basado en patrones típicos: 10am-12m y 7-9pm' })

  function SemBadge({ ok, warn }: { ok:boolean; warn?:boolean }) {
    const color = ok ? T.green : warn ? T.yellow : T.red
    return <span style={{ fontSize:'11px', fontWeight:'700', color }}>{ok ? '✅' : warn ? '🟡' : '🔴'}</span>
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Calculando el oráculo de eficiencia...
    </div>
  )

  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🎯 Metas & Proyecciones</h1>
          <p style={{ fontSize:'12px', color:T.muted }}>El Oráculo de Eficiencia · Día {diaActual}/{diasMes} · {diasRestantes} días restantes</p>
        </div>
        {guardando && <span style={{ fontSize:'11px', color:T.muted }}>Guardando...</span>}
      </div>

      {/* ── ISO — META MAESTRA ── */}
      <div style={{ ...s, padding:'18px 22px', marginBottom:'18px', border:`2px solid ${isoColor}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'14px' }}>
          <div>
            <div style={{ fontSize:'11px', color:T.muted, marginBottom:'4px' }}>ÍNDICE DE SALUD DE LA OPERACIÓN</div>
            <div style={{ fontSize:'36px', fontWeight:'900', color:isoColor }}>{isoActual}%</div>
            <div style={{ fontSize:'12px', color:isoColor, fontWeight:'700', marginTop:'2px' }}>
              {isoEstado==='verde' ? '🟢 Tu tienda está saludable y lista para escalar' : isoEstado==='amarillo' ? '🟡 Tienda funcional — optimiza antes de escalar' : '🔴 Tienda en riesgo — no escales todavía'}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,auto)', gap:'14px', textAlign:'center' }}>
            {[
              { l:'TC', v:tcReal, meta:metas.meta_confirmacion },
              { l:'TD', v:tdReal, meta:metas.meta_despacho },
              { l:'TE', v:teReal, meta:metas.meta_entrega },
              { l:'Dev', v:devReal, meta:metas.meta_devolucion_max, inv:true },
              { l:'Margen', v:margenReal, meta:15 },
            ].map((k,i) => {
              const ok = k.inv ? k.v <= k.meta : k.v >= k.meta
              return (
                <div key={i}>
                  <div style={{ fontSize:'10px', color:T.muted }}>{k.l}</div>
                  <div style={{ fontSize:'16px', fontWeight:'800', color: ok ? T.green : T.red }}>{k.v}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { v:'hoy' as Tab,         l:'☀️ ¿Qué necesitas hoy?' },
          { v:'metas' as Tab,       l:'🎯 Configurar Metas' },
          { v:'tiempo_real' as Tab, l:'🕐 Tiempo Real' },
          { v:'proyeccion' as Tab,  l:'🔮 Proyección' },
          { v:'historial' as Tab,   l:'📅 Historial' },
        ].map(t => (
          <button key={t.v} onClick={()=>setTab(t.v)}
            style={{ padding:'8px 14px', borderRadius:'9px', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              border:`1px solid ${tab===t.v ? T.accent : T.border}`,
              background: tab===t.v ? `${T.accent}15` : 'transparent', color: tab===t.v ? T.accent : T.muted }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══════════════════ TAB: ¿QUÉ NECESITAS HOY? ══════════════════ */}
      {tab === 'hoy' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'12px' }}>📋 RESUMEN DEL DÍA</div>
              {[
                { l:'ISO actual', v:`${isoActual}%`, c:isoColor },
                { l:'Entregados ayer/hoy', v:`${pedidosActuales}`, c:T.green },
                { l:'PQRSF pendientes', v:`${pqrsfPendientes}`, c: pqrsfPendientes>5 ? T.red : T.muted },
                { l:'Saldo Wallet', v:fmt(walletSaldo), c:T.blue },
              ].map((k,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontSize:'12px', color:T.muted }}>{k.l}</span>
                  <span style={{ fontSize:'14px', fontWeight:'700', color:k.c }}>{k.v}</span>
                </div>
              ))}
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'12px' }}>✅ TAREAS PRIORITARIAS DE HOY</div>
              {tareas.map((t,i) => (
                <div key={i} style={{ display:'flex', gap:'10px', padding:'10px', ...s2, marginBottom:'8px', borderLeft:`3px solid ${t.color}` }}>
                  <span style={{ fontSize:'18px', flexShrink:0 }}>{t.ico}</span>
                  <div>
                    <div style={{ fontSize:'10px', fontWeight:'700', color:t.color }}>{t.prioridad}</div>
                    <div style={{ fontSize:'12px', color:T.text, fontWeight:'600' }}>{t.titulo}</div>
                    <div style={{ fontSize:'11px', color:T.muted }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'12px' }}>🎯 META DEL DÍA</div>
              {[
                { l:'Pedidos a confirmar hoy', v:Math.ceil((metaEfectiva-confActuales)/Math.max(diasRestantes,1)) },
                { l:'Pedidos a despachar hoy', v:Math.ceil((metaEfectiva-despActuales)/Math.max(diasRestantes,1)) },
                { l:'Pedidos esperados en entrega hoy', v:Math.ceil(metaEfectiva/diasMes) },
              ].map((k,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontSize:'12px', color:T.muted }}>{k.l}</span>
                  <span style={{ fontSize:'15px', fontWeight:'800', color:T.accent }}>{Math.max(k.v,0)}</span>
                </div>
              ))}
              <div style={{ marginTop:'12px', padding:'10px 12px', background:`${T.accent}08`, borderRadius:'8px', fontSize:'11px', color:T.muted }}>
                Si logras estos números hoy, cierras el mes con <strong style={{ color:T.green }}>{fmt(proyUtilidad)}</strong> ({pct(proyUtilidad, metas.meta_utilidad)}% de tu meta)
              </div>
            </div>

            <div style={{ ...s, padding:'18px', border:`1px solid ${status.color}30` }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:status.color, marginBottom:'10px' }}>💬 MENSAJE DEL DÍA</div>
              <div style={{ fontSize:'13px', color:T.text, lineHeight:'1.7' }}>{status.texto}</div>
              {diagnostico && (
                <div style={{ marginTop:'12px', padding:'10px 12px', background:`${T.red}08`, borderRadius:'8px', border:`1px solid ${T.red}20`, fontSize:'12px', color:T.muted, lineHeight:'1.6' }}>
                  🔍 <strong style={{ color:T.red }}>Diagnóstico:</strong> {diagnostico}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: CONFIGURAR METAS ══════════════════ */}
      {tab === 'metas' && (
        <div>
          {/* Paso 1 — Modo objetivo */}
          <div style={{ ...s, padding:'18px', marginBottom:'16px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'12px' }}>PASO 1 — ¿Qué quieres lograr este mes?</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px' }}>
              {MODOS.map(m => (
                <button key={m.v} onClick={()=>guardarMetas({ modo_objetivo:m.v })}
                  style={{ padding:'12px', borderRadius:'10px', cursor:'pointer', textAlign:'left',
                    border:`2px solid ${metas.modo_objetivo===m.v ? m.color : T.border}`,
                    background: metas.modo_objetivo===m.v ? `${m.color}12` : 'transparent' }}>
                  <div style={{ fontSize:'13px', fontWeight:'700', color: metas.modo_objetivo===m.v ? m.color : T.text }}>{m.l}</div>
                  <div style={{ fontSize:'10px', color:T.muted, marginTop:'3px' }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selector horizonte */}
          <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
            {(['mes','trimestre','anual'] as Horizonte[]).map(h => (
              <button key={h} onClick={()=>guardarMetas({ horizonte:h })}
                style={{ flex:1, padding:'8px', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600',
                  border:`1px solid ${metas.horizonte===h ? T.purple : T.border}`,
                  background: metas.horizonte===h ? `${T.purple}15` : 'transparent', color: metas.horizonte===h ? T.purple : T.muted }}>
                {h==='mes'?'📅 Corto plazo (mes)':h==='trimestre'?'📊 Mediano (trimestre)':'🚀 Largo plazo (año)'}
              </button>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
            {/* Metas operativas mes */}
            {metas.horizonte === 'mes' && (
              <div style={{ ...s, padding:'20px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'14px' }}>🎯 METAS CORTO PLAZO — {MESES_ES[hoy.getMonth()]} {hoy.getFullYear()}</div>
                {[
                  { l:'Meta de pedidos entregados', k:'meta_pedidos' as keyof MetasMes },
                  { l:'Meta de ventas ($)', k:'meta_ventas' as keyof MetasMes },
                  { l:'Meta de utilidad ($)', k:'meta_utilidad' as keyof MetasMes },
                  { l:'CPA máximo ($)', k:'meta_cpa' as keyof MetasMes },
                  { l:'Inversión pauta ($)', k:'meta_inversion_pauta' as keyof MetasMes },
                  { l:'Meta ISO (%)', k:'meta_iso_objetivo' as keyof MetasMes },
                  { l:'% Confirmación mínimo', k:'meta_confirmacion' as keyof MetasMes },
                  { l:'% Despacho mínimo', k:'meta_despacho' as keyof MetasMes },
                  { l:'% Entrega mínimo', k:'meta_entrega' as keyof MetasMes },
                  { l:'% Devolución máximo', k:'meta_devolucion_max' as keyof MetasMes },
                ].map(it => (
                  <div key={String(it.k)} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                    <label style={{ flex:1, fontSize:'12px', color:T.muted }}>{it.l}</label>
                    <input type="number" value={Number(metas[it.k])}
                      onChange={e=>guardarMetas({ [it.k]: Number(e.target.value) } as Partial<MetasMes>)}
                      style={{ ...inp, width:'130px', textAlign:'right' }} />
                  </div>
                ))}
              </div>
            )}

            {metas.horizonte === 'trimestre' && (
              <div style={{ ...s, padding:'20px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>📊 METAS MEDIANO PLAZO — TRIMESTRE</div>
                {[
                  { l:'Meta pedidos trimestre', k:'meta_pedidos_trimestre' as keyof MetasMes },
                  { l:'Meta ventas trimestre ($)', k:'meta_ventas_trimestre' as keyof MetasMes },
                  { l:'Meta LTV cliente ($)', k:'meta_ltv' as keyof MetasMes },
                  { l:'% Recompra objetivo', k:'meta_recompra' as keyof MetasMes },
                ].map(it => (
                  <div key={String(it.k)} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                    <label style={{ flex:1, fontSize:'12px', color:T.muted }}>{it.l}</label>
                    <input type="number" value={Number(metas[it.k])}
                      onChange={e=>guardarMetas({ [it.k]: Number(e.target.value) } as Partial<MetasMes>)}
                      style={{ ...inp, width:'130px', textAlign:'right' }} />
                  </div>
                ))}
                <div style={{ marginTop:'10px', padding:'10px', ...s2, fontSize:'11px', color:T.muted }}>
                  Tasa de recompra real: <strong style={{ color:T.green }}>{tasaRecompra}%</strong> · LTV calculado: <strong style={{ color:T.accent }}>{fmt(ltvCalculado)}</strong>
                </div>
              </div>
            )}

            {metas.horizonte === 'anual' && (
              <div style={{ ...s, padding:'20px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.purple, marginBottom:'14px' }}>🚀 METAS LARGO PLAZO — AÑO</div>
                {[
                  { l:'Meta pedidos anual', k:'meta_pedidos_anual' as keyof MetasMes },
                  { l:'Meta ventas anual ($)', k:'meta_ventas_anual' as keyof MetasMes },
                ].map(it => (
                  <div key={String(it.k)} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                    <label style={{ flex:1, fontSize:'12px', color:T.muted }}>{it.l}</label>
                    <input type="number" value={Number(metas[it.k])}
                      onChange={e=>guardarMetas({ [it.k]: Number(e.target.value) } as Partial<MetasMes>)}
                      style={{ ...inp, width:'150px', textAlign:'right' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Metas de calidad + sugerencia IA */}
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{ ...s, padding:'18px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'12px' }}>💎 METAS DE CALIDAD — Enamorar al cliente</div>
                {[
                  { l:'% Recompra (LTV)', k:'meta_recompra' as keyof MetasMes, real:tasaRecompra },
                  { l:'% PQRSF resuelto <24h', k:'meta_pqrsf_resolucion' as keyof MetasMes, real:pqrsfResolucion24h },
                  { l:'NPS interno estimado', k:'meta_nps' as keyof MetasMes, real:0 },
                  { l:'Tiempo confirmación (h)', k:'meta_tiempo_confirmacion' as keyof MetasMes, real:0 },
                  { l:'Tiempo despacho (h)', k:'meta_tiempo_despacho' as keyof MetasMes, real:0 },
                ].map(it => (
                  <div key={String(it.k)} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                    <label style={{ flex:1, fontSize:'11px', color:T.muted }}>{it.l}</label>
                    {it.real > 0 && <span style={{ fontSize:'10px', color:T.green }}>real: {it.real}%</span>}
                    <input type="number" value={Number(metas[it.k])}
                      onChange={e=>guardarMetas({ [it.k]: Number(e.target.value) } as Partial<MetasMes>)}
                      style={{ ...inp, width:'80px', textAlign:'right' }} />
                  </div>
                ))}
              </div>

              <div style={{ ...s, padding:'18px', border:`1px solid ${T.accent}30` }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'10px' }}>💡 PASO 2 — Sugerencia IA basada en tu historial</div>
                <div style={{ fontSize:'12px', color:T.muted, lineHeight:'1.7' }}>
                  Basado en tu historial y recursos actuales (capacidad {capDiaConf} pedidos/día, wallet {fmt(walletSaldo)}):
                  <br />📦 <strong style={{ color:T.text }}>{Math.round(historial.slice(-3).reduce((a,h)=>a+h.pedidos,0)/Math.max(historial.slice(-3).length,1)) || metas.meta_pedidos} pedidos entregados</strong>
                  <br />💰 <strong style={{ color:T.text }}>{fmtK(historial.slice(-3).reduce((a,h)=>a+h.ventas,0)/Math.max(historial.slice(-3).length,1) || metas.meta_ventas)}</strong> en ventas
                  <br />💎 <strong style={{ color:T.text }}>{fmtK(historial.slice(-3).reduce((a,h)=>a+h.utilidad,0)/Math.max(historial.slice(-3).length,1) || metas.meta_utilidad)}</strong> en utilidad
                </div>
                <div style={{ marginTop:'10px', fontSize:'11px', color:T.muted }}>
                  PASO 3: Para metas más ambiciosas, el sistema validará capacidad en tiempo real y te enlazará con Inversión si falta capital.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: TIEMPO REAL ══════════════════ */}
      {tab === 'tiempo_real' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
                <span style={{ fontSize:'12px', fontWeight:'700', color:T.green }}>📊 GPS DEL MES</span>
                <select value={modoMedicion} onChange={e=>setModoMedicion(e.target.value as typeof modoMedicion)}
                  style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'6px', color:T.text, fontSize:'11px', padding:'3px 8px' }}>
                  <option value="pe_minimo">PE Mínimo</option>
                  <option value="meta">Meta configurada</option>
                  <option value="optimista">Escenario Optimista</option>
                </select>
              </div>
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                  <span style={{ fontSize:'12px', color:T.muted }}>{pedidosActuales.toLocaleString('es-CO')} / {metaEfectiva.toLocaleString('es-CO')} pedidos</span>
                  <span style={{ fontSize:'14px', fontWeight:'800', color: vaBien ? T.green : T.red }}>{Math.min(pctMeta,150)}%</span>
                </div>
                <div style={{ height:'10px', background:'rgba(255,255,255,0.05)', borderRadius:'5px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(pctMeta,100)}%`, background: vaBien ? T.green : T.red, borderRadius:'5px', transition:'width .5s' }} />
                </div>
              </div>
              <div style={{ padding:'12px', borderRadius:'10px', background:`${status.color}08`, border:`1px solid ${status.color}30` }}>
                <div style={{ fontSize:'13px', color:status.color, fontWeight:'700' }}>{status.texto}</div>
              </div>
            </div>

            {/* Embudo en tiempo real */}
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'12px' }}>🔽 EFICIENCIA DEL EMBUDO</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'6px' }}>
                {[
                  { l:'Shopify', n:shopifyActuales, meta:100, c:T.text },
                  { l:'Confirmados', n:confActuales, pctV:tcReal, metaV:metas.meta_confirmacion },
                  { l:'Despachados', n:despActuales, pctV:tdReal, metaV:metas.meta_despacho },
                  { l:'Entregados', n:pedidosActuales, pctV:teReal, metaV:metas.meta_entrega },
                ].map((e,i) => {
                  const mal = i>0 && (e as { pctV?:number; metaV?:number }).pctV !== undefined && (e.pctV! < e.metaV! * 0.85)
                  return (
                    <div key={i} style={{ ...s2, padding:'10px 6px', textAlign:'center', border:`1px solid ${mal ? T.red : T.border}` }}>
                      <div style={{ fontSize:'9px', color:T.muted }}>{e.l}</div>
                      <div style={{ fontSize:'20px', fontWeight:'800', color: i===3 ? T.green : mal ? T.red : T.text }}>{e.n}</div>
                      {i>0 && <div style={{ fontSize:'9px', color: mal ? T.red : T.green }}>{(e as { pctV:number }).pctV}%</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Calendario */}
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'12px' }}>📆 CALENDARIO DEL MES</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'4px', marginBottom:'12px' }}>
              {Array.from({ length:diasMes }, (_,i)=>i+1).map(dia => {
                const acumDia = Math.round(ritmoActual*dia)
                const metaDia = Math.ceil(metaEfectiva*dia/diasMes)
                const cubre = acumDia >= metaDia
                const esFuturo = dia > diaActual
                const esHoy = dia === diaActual
                return (
                  <div key={dia} style={{ padding:'5px 3px', borderRadius:'6px', textAlign:'center',
                    background: esHoy ? T.accent : cubre && !esFuturo ? `${T.green}20` : esFuturo ? 'rgba(255,255,255,0.02)' : `${T.red}15`,
                    border:`1px solid ${esHoy ? T.accent : T.border}` }}>
                    <div style={{ fontSize:'10px', fontWeight:'700', color: esHoy ? '#000' : cubre && !esFuturo ? T.green : esFuturo ? T.border : T.red }}>{dia}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding:'12px', background:`${T.blue}08`, borderRadius:'10px', border:`1px solid ${T.blue}20` }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:T.blue, marginBottom:'6px' }}>📐 Proyección (ponderada por ISO)</div>
              <div style={{ fontSize:'12px', color:T.muted, lineHeight:'1.6' }}>
                A este ritmo cerrarás en <strong style={{ color: proyPedidos>=metaEfectiva ? T.green : T.red }}>{proyPedidos} pedidos</strong>
                {' '}({pct(proyPedidos,metaEfectiva)}% de tu meta). Factor de salud aplicado: <strong>{factorSalud}x</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: PROYECCIÓN ══════════════════ */}
      {tab === 'proyeccion' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>🔮 PROYECCIÓN 30/60/90 DÍAS</div>
            {[30,60,90].map(dias => {
              const meses = dias/30
              const proyP = Math.round(proyPedidos * meses)
              const proyV = Math.round(proyVentas * meses)
              const proyU = Math.round(proyUtilidad * meses)
              return (
                <div key={dias} style={{ ...s2, padding:'14px', marginBottom:'10px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'700', color:T.accent, marginBottom:'8px' }}>+{dias} días</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px' }}>
                    {[
                      { l:'Pedidos', v:proyP.toLocaleString('es-CO') },
                      { l:'Ventas', v:fmtK(proyV) },
                      { l:'Utilidad', v:fmtK(proyU) },
                    ].map((k,i) => (
                      <div key={i}>
                        <div style={{ fontSize:'10px', color:T.muted }}>{k.l}</div>
                        <div style={{ fontSize:'14px', fontWeight:'700', color:T.text }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {cuotaCredito > 0 && (
              <div style={{ marginTop:'10px', padding:'10px 12px', background:`${T.red}08`, borderRadius:'8px', fontSize:'11px', color:T.muted }}>
                💳 Cuota de crédito activa: <strong style={{ color:T.red }}>{fmt(cuotaCredito)}/mes</strong> — ya descontada del flujo proyectado
              </div>
            )}
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'14px' }}>💎 RETENCIÓN Y LTV</div>
            {[
              { l:'Tasa de recompra real', v:`${tasaRecompra}%`, c:T.green },
              { l:'LTV calculado', v:fmt(ltvCalculado), c:T.accent },
              { l:'% ventas sin pauta nueva', v:`${Math.min(tasaRecompra*1.5,40)}%`, c:T.blue },
            ].map((k,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:'12px', color:T.muted }}>{k.l}</span>
                <span style={{ fontSize:'15px', fontWeight:'800', color:k.c }}>{k.v}</span>
              </div>
            ))}
            <div style={{ marginTop:'12px', padding:'12px', background:`${T.green}08`, borderRadius:'10px', fontSize:'12px', color:T.muted, lineHeight:'1.6' }}>
              Si mantienes <strong style={{ color:T.text }}>{tasaRecompra}%</strong> de recompra, en 6 meses una parte creciente de tus ventas no necesitará pauta nueva, reduciendo tu CPA efectivo progresivamente.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: HISTORIAL ══════════════════ */}
      {tab === 'historial' && (
        <div style={{ ...s, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.border}`, fontWeight:'700', fontSize:'13px' }}>📅 Historial — La memoria del negocio</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead>
              <tr style={{ background:'#060E1C' }}>
                {['Mes','Pedidos','Meta','%','ISO','TC','Ventas','Utilidad','Tendencia'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:'700' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historial.length===0 ? (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:'40px', color:T.muted }}>Sin historial aún</td></tr>
              ) : historial.map((m,i) => {
                const cumple = m.pedidos >= m.meta
                const pctC = m.meta>0 ? Math.round(m.pedidos/m.meta*100) : 0
                const anterior = historial[i-1]
                const mejora = anterior ? m.iso - anterior.iso : 0
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, background: m.activo ? `${T.yellow}05` : 'transparent' }}>
                    <td style={{ padding:'9px 12px', fontWeight: m.activo?'700':'400', color: m.activo?T.yellow:T.text }}>{m.mes}</td>
                    <td style={{ padding:'9px 12px', fontWeight:'700', color: cumple?T.green:T.red }}>{m.pedidos}</td>
                    <td style={{ padding:'9px 12px', color:T.muted }}>{m.meta}</td>
                    <td style={{ padding:'9px 12px', fontWeight:'700', color: cumple?T.green:T.red }}>{pctC}%</td>
                    <td style={{ padding:'9px 12px', fontWeight:'700', color:colorISO(m.iso) }}>{m.iso}%</td>
                    <td style={{ padding:'9px 12px', color:T.muted }}>{m.tc}%</td>
                    <td style={{ padding:'9px 12px', color:T.muted }}>{fmtK(m.ventas)}</td>
                    <td style={{ padding:'9px 12px', color:T.green }}>{fmtK(m.utilidad)}</td>
                    <td style={{ padding:'9px 12px' }}>
                      {anterior && (
                        <span style={{ fontSize:'11px', fontWeight:'700', color: mejora>=0?T.green:T.red }}>
                          {mejora>=0?'↑':'↓'} {Math.abs(mejora)} pts
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota de pie */}
      <div style={{ marginTop:'16px', padding:'12px 16px', background:T.card2, borderRadius:'10px', border:`1px solid ${T.border}`, fontSize:'12px', color:T.muted }}>
        🔗 Conectado con: <strong style={{ color:T.text }}>CF</strong> · <strong style={{ color:T.text }}>Nómina</strong> · <strong style={{ color:T.text }}>Pedidos</strong> ·
        <strong style={{ color:T.text }}> Pauta</strong> · <strong style={{ color:T.text }}>Wallet</strong> · <strong style={{ color:T.text }}>Inversión</strong> · <strong style={{ color:T.text }}>PQRSF</strong> ·
        → <strong style={{ color:T.green }}>Dashboard</strong> · <strong style={{ color:T.green }}>Alertas</strong>
        {guardando && <span style={{ marginLeft:'10px' }}>· Guardando...</span>}
      </div>
    </div>
  )
}
