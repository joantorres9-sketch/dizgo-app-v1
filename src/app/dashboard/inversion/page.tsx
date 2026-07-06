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
type Tab = 'inversion' | 'capital_propio' | 'oportunidad' | 'credito' | 'roi'
type Dictamen = 'verde' | 'amarillo' | 'rojo' | 'pendiente'

interface Activo {
  id: string; concepto: string; categoria: string
  valor: number; vida_util_meses: number; activo: boolean; notas: string
}
interface Capital {
  id: string; concepto: string; categoria: string
  valor: number; tipo: string; activo: boolean
}
interface Socio {
  id: string; nombre: string; tipo_aporte: string
  valor_aporte: number; pct_participacion: number; activo: boolean
}
interface Credito {
  id: string; nombre: string; fuente: string; estado: string
  monto: number; tasa_mensual: number; plazo_meses: number
  tipo_cuota: string; destino: string; periodo_gracia: number
  cuota_mensual: number; total_pagar: number; total_intereses: number
  dictamen: string; dictamen_razon: string
}

// ── TASAS BANCARIAS POR PAÍS ──────────────────────────────────
const TASAS_PAIS: Record<string, { nombre: string; tasa_min: number; tasa_max: number; moneda: string; referencia: string }> = {
  COL: { nombre:'Colombia',  tasa_min:1.5,  tasa_max:3.5,  moneda:'COP', referencia:'DTF + spread' },
  ECU: { nombre:'Ecuador',   tasa_min:0.8,  tasa_max:1.8,  moneda:'USD', referencia:'BCE referencial' },
  MEX: { nombre:'México',    tasa_min:1.2,  tasa_max:2.8,  moneda:'MXN', referencia:'TIIE + spread' },
  PER: { nombre:'Perú',      tasa_min:1.0,  tasa_max:2.5,  moneda:'PEN', referencia:'BCRP referencial' },
  CHL: { nombre:'Chile',     tasa_min:0.7,  tasa_max:1.5,  moneda:'CLP', referencia:'TPM + spread' },
  ARG: { nombre:'Argentina', tasa_min:5.0,  tasa_max:12.0, moneda:'ARS', referencia:'TNA BCRA' },
  PAN: { nombre:'Panamá',    tasa_min:0.6,  tasa_max:1.2,  moneda:'USD', referencia:'Prime Rate' },
  CRI: { nombre:'Costa Rica',tasa_min:1.0,  tasa_max:2.0,  moneda:'CRC', referencia:'TPM BCCR' },
  GTM: { nombre:'Guatemala', tasa_min:1.2,  tasa_max:2.2,  moneda:'GTQ', referencia:'Banguat ref.' },
  BOL: { nombre:'Bolivia',   tasa_min:0.8,  tasa_max:1.8,  moneda:'BOB', referencia:'BCB referencial' },
  URY: { nombre:'Uruguay',   tasa_min:0.9,  tasa_max:1.8,  moneda:'UYU', referencia:'BCU referencial' },
  VEN: { nombre:'Venezuela', tasa_min:4.0,  tasa_max:10.0, moneda:'USD', referencia:'BCV referencial' },
}

// ── HELPERS ───────────────────────────────────────────────────
function fmt(v: number, pais = 'COL'): string {
  const cfgs: Record<string,{locale:string;currency:string;dec:number}> = {
    COL:{locale:'es-CO',currency:'COP',dec:0}, ECU:{locale:'en-US',currency:'USD',dec:2},
    MEX:{locale:'es-MX',currency:'MXN',dec:2}, PER:{locale:'es-PE',currency:'PEN',dec:2},
    CHL:{locale:'es-CL',currency:'CLP',dec:0}, ARG:{locale:'es-AR',currency:'ARS',dec:2},
  }
  const c = cfgs[pais] || cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec}).format(v)
}
const safe = (n: number) => isNaN(n) || !isFinite(n) ? 0 : n
const pct  = (a: number, b: number) => b > 0 ? Math.round(a / b * 100) : 0

function calcCuotaFija(monto: number, tasaMensual: number, plazo: number): number {
  const tm = tasaMensual / 100
  if (tm === 0) return Math.round(monto / plazo)
  return Math.round(monto * (tm * Math.pow(1 + tm, plazo)) / (Math.pow(1 + tm, plazo) - 1))
}

// ── ACTIVOS DEFAULT ───────────────────────────────────────────
const ACTIVOS_DEFAULT: Omit<Activo,'id'>[] = [
  { concepto:'Computador / Portátil', categoria:'hardware',   valor:2500000, vida_util_meses:36, activo:true,  notas:'' },
  { concepto:'Celular',               categoria:'hardware',   valor:1200000, vida_util_meses:24, activo:true,  notas:'' },
  { concepto:'Cámara para fotos/video',categoria:'hardware',  valor:800000,  vida_util_meses:36, activo:false, notas:'' },
  { concepto:'Ring Light / Iluminación',categoria:'hardware', valor:150000,  vida_util_meses:24, activo:false, notas:'' },
  { concepto:'Escritorio y silla',    categoria:'mobiliario', valor:600000,  vida_util_meses:60, activo:true,  notas:'' },
  { concepto:'Router / Red',          categoria:'hardware',   valor:200000,  vida_util_meses:36, activo:true,  notas:'' },
]
const CAPITAL_DEFAULT: Omit<Capital,'id'>[] = [
  { concepto:'Capital de trabajo inicial',     categoria:'capital_trabajo', valor:3000000, tipo:'propio', activo:true  },
  { concepto:'Primera pauta publicitaria',     categoria:'pauta',           valor:1500000, tipo:'propio', activo:true  },
  { concepto:'Testeo de productos',            categoria:'testeo',          valor:500000,  tipo:'propio', activo:true  },
  { concepto:'Licencias y plataformas 3 meses',categoria:'licencias',      valor:450000,  tipo:'propio', activo:true  },
  { concepto:'Inventario inicial (si aplica)', categoria:'inventario',      valor:0,       tipo:'propio', activo:false },
  { concepto:'Reserva emergencias (1 mes CF)', categoria:'reserva',         valor:1159000, tipo:'propio', activo:true  },
]

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────
export default function InversionPage() {
  const supabase = createClient()

  const [tenantId, setTenantId] = useState('')
  const [pais,     setPais]     = useState('COL')
  const [loading,  setLoading]  = useState(true)
  const [guardando,setGuardando]= useState(false)
  const [tab,      setTab]      = useState<Tab>('inversion')

  // Datos propios del módulo (Supabase)
  const [activos,  setActivos]  = useState<Activo[]>([])
  const [capital,  setCapital]  = useState<Capital[]>([])
  const [socios,   setSocios]   = useState<Socio[]>([])
  const [creditos, setCreditos] = useState<Credito[]>([])
  const [creditoActivo, setCreditoActivo] = useState<Credito | null>(null)

  // Datos de otros módulos (solo lectura)
  const [cfMes,          setCfMes]          = useState(0)
  const [walletSaldo,    setWalletSaldo]    = useState(0)
  const [utilidadProm3m, setUtilidadProm3m] = useState(0)
  const [gananciaPedido, setGananciaPedido] = useState(0)
  const [tcReal,         setTcReal]         = useState(0)
  const [tdReal,         setTdReal]         = useState(0)
  const [teReal,         setTeReal]         = useState(0)
  const [devReal,        setDevReal]        = useState(0)
  const [margenReal,     setMargenReal]     = useState(0)
  const [cpaHistorico,   setCpaHistorico]   = useState(0)
  const [confirmadores,  setConfirmadores]  = useState(0)
  const [empacadores,    setEmpacadores]    = useState(0)

  // Simulador crédito
  const [simMonto,     setSimMonto]     = useState(5000000)
  const [simTasa,      setSimTasa]      = useState(2.5)
  const [simPlazo,     setSimPlazo]     = useState(12)
  const [simTipo,      setSimTipo]      = useState<'fija'|'variable'>('fija')
  const [simDestino,   setSimDestino]   = useState('pauta')
  const [simFuente,    setSimFuente]    = useState('bancario')
  const [simGracia,    setSimGracia]    = useState(0)
  const [simNombre,    setSimNombre]    = useState('Mi crédito')
  const [modoPayback,  setModoPayback]  = useState<'pesimista'|'realista'|'optimista'>('realista')

  // Nuevo activo / capital
  const [newActivo,  setNewActivo]  = useState({ concepto:'', valor:0, vida:36, cat:'hardware' })
  const [newCapital, setNewCapital] = useState({ concepto:'', valor:0, cat:'capital_trabajo' })
  const [newSocio,   setNewSocio]   = useState({ nombre:'', aporte:0, pct:0, tipo:'dinero' })

  const s:  React.CSSProperties = { background:T.card,  border:`1px solid ${T.border}`, borderRadius:'12px' }
  const s2: React.CSSProperties = { background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px' }
  const inp: React.CSSProperties = {
    background:T.card2, border:`1px solid ${T.border}`, borderRadius:'7px',
    color:T.text, padding:'6px 10px', fontSize:'13px', outline:'none',
    width:'100%', boxSizing:'border-box',
  }

  // ── CARGA DE DATOS ────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!prof?.tenant_id) { setLoading(false); return }
    const tid = prof.tenant_id
    setTenantId(tid)

    const hoy    = new Date()
    const ini3m  = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1).toISOString().slice(0,10)
    const iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0,10)
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).toISOString().slice(0,10)
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`

    const [
      { data: tenantData },
      { data: activosDB },
      { data: capitalDB },
      { data: sociosDB },
      { data: creditosDB },
      { data: pedidos3m },
      { data: pedidosMes },
      { data: costos },
      { data: walletData },
      { data: pautaData },
      { data: colabsData },
      { data: prodsData },
    ] = await Promise.all([
      supabase.from('tenants').select('pais, moneda').eq('id', tid).single(),
      supabase.from('inversiones_activos').select('*').eq('tenant_id', tid).eq('activo', true),
      supabase.from('inversiones_capital').select('*').eq('tenant_id', tid).eq('activo', true),
      supabase.from('inversiones_socios').select('*').eq('tenant_id', tid).eq('activo', true),
      supabase.from('inversiones_creditos').select('*').eq('tenant_id', tid).order('created_at', { ascending:false }),
      supabase.from('pedidos').select('estado, ganancia, pvp').eq('tenant_id', tid)
        .gte('fecha_pedido', ini3m).lte('fecha_pedido', finMes+'T23:59:59'),
      supabase.from('pedidos').select('estado').eq('tenant_id', tid)
        .gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes+'T23:59:59'),
      supabase.from('costos_fijos').select('total').eq('tenant_id', tid).eq('periodo', periodo).eq('activo', true),
      supabase.from('wallet_transacciones').select('tipo, monto').eq('tenant_id', tid),
      supabase.from('pauta').select('inversion, resultados').eq('tenant_id', tid)
        .gte('fecha', ini3m).lte('fecha', finMes),
      supabase.from('colaboradores').select('cargo, activo').eq('tenant_id', tid).eq('activo', true),
      supabase.from('productos').select('pvp, costo_proveedor, costo_flete_envio, costo_fulfillment, pct_publicidad, pct_comision, pct_popup, pct_pasarela').eq('tenant_id', tid).eq('estado', 'activo'),
    ])

    // País / moneda
    if (tenantData) setPais((tenantData as { pais: string }).pais || 'COL')

    // Módulo propio — activos, capital, socios, créditos
    if (activosDB && activosDB.length > 0) setActivos(activosDB as Activo[])
    else setActivos(ACTIVOS_DEFAULT.map((a,i) => ({ ...a, id:`def_${i}` })))

    if (capitalDB && capitalDB.length > 0) setCapital(capitalDB as Capital[])
    else setCapital(CAPITAL_DEFAULT.map((c,i) => ({ ...c, id:`def_${i}` })))

    setSocios((sociosDB || []) as Socio[])
    setCreditos((creditosDB || []) as Credito[])
    const activo = (creditosDB || []).find((c: Credito) => c.estado === 'activo') as Credito | undefined
    setCreditoActivo(activo || null)

    // TC/TD/TE desde pedidos 3 meses
    const p3m = (pedidos3m || []) as { estado:string; ganancia:number; pvp:number }[]
    const enFlujo = ['CONFIRMADO','DESPACHADO','EN_TRANSITO','ENTREGADO','NOVEDAD','DEVOLUCION']
    const conf3  = p3m.filter(p => enFlujo.includes(p.estado)).length
    const desp3  = p3m.filter(p => ['DESPACHADO','EN_TRANSITO','ENTREGADO','NOVEDAD','DEVOLUCION'].includes(p.estado)).length
    const entr3  = p3m.filter(p => p.estado === 'ENTREGADO').length
    const devs3  = p3m.filter(p => p.estado === 'DEVOLUCION').length
    setTcReal(safe(pct(conf3, p3m.length)))
    setTdReal(safe(pct(desp3, conf3)))
    setTeReal(safe(pct(entr3, desp3)))
    setDevReal(safe(pct(devs3, entr3 + devs3)))

    // Utilidad promedio 3 meses
    const utilTotal = p3m.filter(p => p.estado === 'ENTREGADO').reduce((a,p) => a + Number(p.ganancia||0), 0)
    setUtilidadProm3m(Math.round(utilTotal / 3))

    // Margen real promedio
    const pvpTotal = p3m.filter(p => p.estado === 'ENTREGADO').reduce((a,p) => a + Number(p.pvp||0), 0)
    const margenAvg = pvpTotal > 0 ? safe(Math.round(utilTotal / pvpTotal * 100)) : 0
    setMargenReal(margenAvg)

    // Ganancia por pedido (desde productos activos)
    const prods = (prodsData || []) as { pvp:number; costo_proveedor:number; costo_flete_envio:number; costo_fulfillment:number; pct_publicidad:number; pct_comision:number; pct_popup:number; pct_pasarela:number }[]
    if (prods.length > 0) {
      const ganProm = prods.reduce((a, p) => {
        const cv = Number(p.costo_proveedor) + Number(p.costo_flete_envio) + Number(p.costo_fulfillment) +
          (Number(p.pvp) * (Number(p.pct_publicidad) + Number(p.pct_comision) + Number(p.pct_popup) + Number(p.pct_pasarela)) / 100)
        return a + (Number(p.pvp) - cv)
      }, 0) / prods.length
      setGananciaPedido(Math.round(ganProm))
    }

    // CF del mes
    setCfMes(Math.round((costos || []).reduce((a: number, c: { total: number }) => a + Number(c.total||0), 0)))

    // Wallet saldo total
    const wRows = (walletData || []) as { tipo:string; monto:number }[]
    const ent = wRows.filter(w => w.tipo==='ENTRADA').reduce((a,w) => a+Number(w.monto),0)
    const sal = wRows.filter(w => w.tipo==='SALIDA').reduce((a,w) => a+Number(w.monto),0)
    setWalletSaldo(Math.round(ent - sal))

    // CPA histórico
    const pRows = (pautaData || []) as { inversion:number; resultados:number }[]
    const invT = pRows.reduce((a,p) => a+Number(p.inversion||0),0)
    const resT = pRows.reduce((a,p) => a+Number(p.resultados||0),0)
    setCpaHistorico(resT > 0 ? Math.round(invT / resT) : 0)

    // Nómina
    const cols = (colabsData || []) as { cargo:string }[]
    setConfirmadores(cols.filter(c => c.cargo.toLowerCase().includes('confirmad')).length)
    setEmpacadores(cols.filter(c => c.cargo.toLowerCase().includes('empacad')).length)

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── CÁLCULOS CENTRALES ────────────────────────────────────
  const totalActivos    = activos.filter(a => a.activo).reduce((s,a) => s + Number(a.valor), 0)
  const depreciacionMes = activos.filter(a => a.activo).reduce((s,a) => s + Number(a.valor) / Number(a.vida_util_meses||1), 0)
  const totalCapital    = capital.filter(c => c.activo).reduce((s,c) => s + Number(c.valor), 0)
  const totalInversion  = totalActivos + totalCapital
  const totalAportes    = socios.reduce((s,so) => s + Number(so.valor_aporte), 0)
  const brechaFinanc    = Math.max(totalInversion - totalAportes, 0)
  const paybackMeses    = utilidadProm3m > 0 ? Math.ceil(totalInversion / utilidadProm3m) : 0

  // Simulador crédito
  const cuotaSim     = calcCuotaFija(simMonto, simTasa, simPlazo)
  // Cuota alemana mes 1 (la más alta): capital fijo + interés sobre saldo total
  const cuotaAlemanaMes1 = Math.round((simMonto / simPlazo) + (simMonto * simTasa / 100))
  const cuotaResumen = simTipo === 'variable' ? cuotaAlemanaMes1 : cuotaSim
  const totalPagar   = simTipo === 'variable'
    ? Math.round(simMonto + (simMonto * simTasa/100 * (simPlazo+1)/2)) // suma de intereses decrecientes aproximada
    : cuotaSim * simPlazo
  const totalIntSim  = totalPagar - simMonto
  const cfConCredito = cfMes + cuotaResumen
  const msc          = cuotaResumen > 0 ? safe(utilidadProm3m / cuotaResumen) : 0
  const pedidosExtra = gananciaPedido > 0 ? Math.ceil(cuotaResumen / gananciaPedido) : 0
  const roiEsperado  = simMonto > 0 ? safe(Math.round((utilidadProm3m * simPlazo - simMonto) / simMonto * 100)) : 0
  const wacc         = simTasa // simplificado (tasa del crédito como costo de capital)
  const roiMensual   = simMonto > 0 && simPlazo > 0 ? safe(utilidadProm3m / simMonto * 100) : 0

  // Tabla amortización — soporta fija (francesa) y variable (alemana)
  const capitalFijoAleman = Math.round(simMonto / simPlazo)
  const amortizacion: { mes:number; cuota:number; interes:number; capital_pago:number; saldo:number }[] = []
  let saldoAm = simMonto
  for (let i = 1; i <= Math.min(simPlazo, 24); i++) {
    const interes = Math.round(saldoAm * simTasa / 100)
    if (simTipo === 'variable') {
      const capital_pago = Math.min(capitalFijoAleman, saldoAm)
      const cuotaMes = capital_pago + interes
      saldoAm = Math.max(saldoAm - capital_pago, 0)
      amortizacion.push({ mes:i, cuota:cuotaMes, interes, capital_pago, saldo:Math.round(saldoAm) })
    } else {
      const capital_pago = cuotaSim - interes
      saldoAm = Math.max(saldoAm - capital_pago, 0)
      amortizacion.push({ mes:i, cuota:cuotaSim, interes, capital_pago, saldo:Math.round(saldoAm) })
    }
  }

  // ── DICTAMEN DIZGO ────────────────────────────────────────
  const semaforos = {
    confirmacion: tcReal >= 75 ? 'verde' : tcReal >= 60 ? 'amarillo' : 'rojo',
    entrega:      teReal >= 75 ? 'verde' : teReal >= 65 ? 'amarillo' : 'rojo',
    devolucion:   devReal <= 12 ? 'verde' : devReal <= 20 ? 'amarillo' : 'rojo',
    margen:       margenReal >= 15 ? 'verde' : margenReal >= 10 ? 'amarillo' : 'rojo',
    msc:          msc >= 1.5 ? 'verde' : msc >= 1.0 ? 'amarillo' : 'rojo',
    wacc:         roiMensual >= wacc ? 'verde' : roiMensual >= wacc * 0.8 ? 'amarillo' : 'rojo',
  }
  const rojosCount    = Object.values(semaforos).filter(v => v === 'rojo').length
  const amarillosCount = Object.values(semaforos).filter(v => v === 'amarillo').length
  const dictamen: Dictamen = rojosCount >= 2 ? 'rojo' : rojosCount === 1 || amarillosCount >= 2 ? 'amarillo' : 'verde'

  const dictamenTexto = {
    rojo: 'No estás listo para apalancamiento externo. Ajusta la operación primero. El banco no perdona lo que el mercado no compra.',
    amarillo: 'Algunos indicadores necesitan ajuste antes de endeudarte. Optimiza primero, luego solicita el crédito.',
    verde: 'Tu operación está lista para apalancarse. Los indicadores muestran solidez suficiente para absorber la cuota.',
    pendiente: 'Completa los datos del simulador para obtener el dictamen.',
  }[dictamen]

  const colorDictamen = { verde:T.green, amarillo:T.yellow, rojo:T.red, pendiente:T.muted }[dictamen]

  // ── PAYBACK ESCENARIOS ────────────────────────────────────
  const factorPayback = { pesimista:0.7, realista:1.0, optimista:1.3 }[modoPayback]
  const utilidadPayback = Math.round(utilidadProm3m * factorPayback)
  const paybackEsc = utilidadPayback > 0 ? Math.ceil(totalInversion / utilidadPayback) : 0

  // ── GUARDAR ACTIVO ────────────────────────────────────────
  async function guardarActivo() {
    if (!newActivo.concepto || !tenantId) return
    setGuardando(true)
    const { data } = await supabase.from('inversiones_activos').insert({
      tenant_id: tenantId, concepto: newActivo.concepto, categoria: newActivo.cat,
      valor: newActivo.valor, vida_util_meses: newActivo.vida, activo: true,
    }).select().single()
    if (data) setActivos(prev => [...prev, data as Activo])
    setNewActivo({ concepto:'', valor:0, vida:36, cat:'hardware' })
    setGuardando(false)
  }

  async function guardarCapital() {
    if (!newCapital.concepto || !tenantId) return
    setGuardando(true)
    const { data } = await supabase.from('inversiones_capital').insert({
      tenant_id: tenantId, concepto: newCapital.concepto, categoria: newCapital.cat,
      valor: newCapital.valor, tipo: 'propio', activo: true,
    }).select().single()
    if (data) setCapital(prev => [...prev, data as Capital])
    setNewCapital({ concepto:'', valor:0, cat:'capital_trabajo' })
    setGuardando(false)
  }

  async function guardarSocio() {
    if (!newSocio.nombre || !tenantId) return
    setGuardando(true)
    const { data } = await supabase.from('inversiones_socios').insert({
      tenant_id: tenantId, nombre: newSocio.nombre, tipo_aporte: newSocio.tipo,
      valor_aporte: newSocio.aporte, pct_participacion: newSocio.pct, activo: true,
    }).select().single()
    if (data) setSocios(prev => [...prev, data as Socio])
    setNewSocio({ nombre:'', aporte:0, pct:0, tipo:'dinero' })
    setGuardando(false)
  }

  async function guardarCredito() {
    if (!tenantId) return
    setGuardando(true)
    await supabase.from('inversiones_creditos').insert({
      tenant_id: tenantId, nombre: simNombre, fuente: simFuente, estado: 'simulacion',
      monto: simMonto, tasa_mensual: simTasa, plazo_meses: simPlazo,
      tipo_cuota: simTipo, destino: simDestino, periodo_gracia: simGracia,
      cuota_mensual: cuotaSim, total_pagar: totalPagar, total_intereses: totalIntSim,
      dictamen, dictamen_razon: dictamenTexto,
    })
    await supabase.from('inversiones_dictamen').insert({
      tenant_id: tenantId, fecha: new Date().toISOString().slice(0,10),
      sem_confirmacion: semaforos.confirmacion, sem_entrega: semaforos.entrega,
      sem_devolucion: semaforos.devolucion, sem_margen: semaforos.margen,
      sem_msc: semaforos.msc, sem_general: dictamen,
      tc_momento: tcReal, te_momento: teReal, dev_momento: devReal,
      margen_momento: margenReal, msc_momento: Math.round(msc * 100) / 100,
      dictamen_texto: dictamenTexto,
    })
    // FIX 3 — Conexión a Alertas: el dictamen siempre genera una alerta visible
    await supabase.from('alertas').insert({
      tenant_id: tenantId,
      tipo: dictamen === 'rojo' ? 'critico' : dictamen === 'amarillo' ? 'atencion' : 'info',
      categoria: 'operativa',
      titulo: `Dictamen de crédito: ${simNombre} — ${dictamen.toUpperCase()}`,
      mensaje: dictamenTexto,
      accion: dictamen === 'rojo' ? 'Ajusta TC, TE o margen antes de solicitar este crédito' : dictamen === 'amarillo' ? 'Optimiza los indicadores en amarillo antes de firmar' : 'Puedes proceder con la solicitud del crédito',
      modulo: 'Inversión', valor: `Cuota: ${fmt(cuotaResumen, pais)}`, icono: dictamen==='rojo'?'🔴':dictamen==='amarillo'?'🟡':'🟢',
    })
    await loadData()
    setGuardando(false)
  }

  // FIX 1+2 — Activar crédito: suma la cuota a CF real y registra pedidos adicionales en Metas
  async function activarCredito(creditoId: string) {
    if (!tenantId) return
    setGuardando(true)
    const credito = creditos.find(c => c.id === creditoId)
    if (!credito) { setGuardando(false); return }

    const hoy = new Date()
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`

    // Marca el crédito como activo
    await supabase.from('inversiones_creditos').update({ estado: 'activo', fecha_inicio: hoy.toISOString().slice(0,10) }).eq('id', creditoId)

    // FIX 1 — La cuota completa entra a CF como un concepto nuevo (cantidad=1, valor=cuota)
    // Nota: solo el interés del mes afecta utilidad en el P&G; el capital es salida de caja.
    // Aquí registramos la CUOTA TOTAL en CF porque es la salida de caja real que compromete el flujo.
    await supabase.from('costos_fijos').insert({
      tenant_id: tenantId, periodo, categoria: 'Otros',
      concepto: `Cuota crédito — ${credito.nombre}`,
      cantidad: 1, valor_unitario: credito.cuota_mensual,
      activo: true, notas: `Crédito ${credito.fuente} · interés ${fmt(Math.round(credito.cuota_mensual - (credito.monto/credito.plazo_meses)), pais)}/mes va al P&G como gasto financiero`,
    })

    // Cuenta por pagar recurrente — alimenta el módulo financiero PYG-02
    await supabase.from('cuentas_por_pagar').insert({
      tenant_id: tenantId, tercero: credito.fuente || 'Entidad financiera',
      tipo_tercero: 'otro', concepto: `Cuota mensual crédito — ${credito.nombre}`,
      valor: credito.cuota_mensual, fecha_emision: hoy.toISOString().slice(0,10),
      fecha_vencimiento: new Date(hoy.getFullYear(), hoy.getMonth()+1, 5).toISOString().slice(0,10),
      estado: 'pendiente', categoria_flujo: 'financiacion',
      origen_modulo: 'inversion', origen_id: credito.id,
    })

    // FIX 2 — Pedidos adicionales requeridos se suman a la meta del mes
    const pedidosExtraCredito = gananciaPedido > 0 ? Math.ceil(credito.cuota_mensual / gananciaPedido) : 0
    const { data: metaActual } = await supabase.from('metas').select('meta_pedidos').eq('tenant_id', tenantId).eq('periodo', periodo).single()
    if (metaActual) {
      await supabase.from('metas').update({ meta_pedidos: Number(metaActual.meta_pedidos||0) + pedidosExtraCredito }).eq('tenant_id', tenantId).eq('periodo', periodo)
    }

    await supabase.from('alertas').insert({
      tenant_id: tenantId, tipo:'info', categoria:'operativa',
      titulo: `Crédito activado: ${credito.nombre}`,
      mensaje: `La cuota de ${fmt(credito.cuota_mensual, pais)} ya se suma a tus Costos Fijos. Tu meta de pedidos subió en ${pedidosExtraCredito} para cubrirla.`,
      accion: 'Revisa el módulo Metas para confirmar el nuevo objetivo del mes',
      modulo:'Inversión', valor: fmt(credito.cuota_mensual, pais), icono:'🟢',
    })

    await loadData()
    setGuardando(false)
  }

  // ── SEMÁFORO VISUAL ───────────────────────────────────────
  function SemBadge({ estado }: { estado: string }) {
    const color = estado === 'verde' ? T.green : estado === 'amarillo' ? T.yellow : estado === 'rojo' ? T.red : T.muted
    const icon  = estado === 'verde' ? '🟢' : estado === 'amarillo' ? '🟡' : estado === 'rojo' ? '🔴' : '⚪'
    return <span style={{ fontSize:'12px', fontWeight:'700', color }}>{icon} {estado === 'verde' ? 'OK' : estado === 'amarillo' ? 'Revisar' : estado === 'rojo' ? 'Crítico' : '—'}</span>
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Cargando módulo de inversión...
    </div>
  )

  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>💰 Inversión & Créditos</h1>
          <p style={{ fontSize:'12px', color:T.muted }}>Capital · Riesgo · Apalancamiento · DIZGO es tu Asesor de Capital</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'11px', color:T.muted }}>País:</span>
          <select value={pais} onChange={e => setPais(e.target.value)}
            style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'7px', color:T.text, padding:'5px 10px', fontSize:'12px', outline:'none' }}>
            {Object.entries(TASAS_PAIS).map(([k,v]) => <option key={k} value={k}>{v.nombre}</option>)}
          </select>
          {guardando && <span style={{ fontSize:'11px', color:T.muted }}>Guardando...</span>}
        </div>
      </div>

      {/* KPIs principales */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', marginBottom:'20px' }}>
        {[
          { l:'Inversión total',    v:fmt(totalInversion, pais),          c:T.red,    sub:'activos + capital' },
          { l:'Aportes socios',     v:fmt(totalAportes, pais),            c:T.blue,   sub:'capital propio cubierto' },
          { l:'Brecha financ.',     v:fmt(brechaFinanc, pais),            c: brechaFinanc>0 ? T.yellow : T.green, sub: brechaFinanc>0 ? 'requiere crédito' : '✅ cubierto' },
          { l:'Depreciación/mes',   v:fmt(Math.round(depreciacionMes), pais), c:T.purple, sub:'impacta CF automáticamente' },
          { l:'Payback estimado',   v:`${paybackMeses} meses`,            c: paybackMeses<=12 ? T.green : T.yellow, sub:`util. prom. ${fmt(utilidadProm3m, pais)}/mes` },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px 14px', borderTop:`2px solid ${k.c}` }}>
            <div style={{ fontSize:'10px', color:T.muted, marginBottom:'4px' }}>{k.l}</div>
            <div style={{ fontSize:'16px', fontWeight:'800', color:k.c, marginBottom:'2px' }}>{k.v}</div>
            <div style={{ fontSize:'9px', color:T.muted }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { v:'inversion'     as Tab, l:'💼 Etapa 1 — Inversión' },
          { v:'capital_propio'as Tab, l:'🌱 Etapa 2 — Capital Propio' },
          { v:'oportunidad'   as Tab, l:'🎯 Etapa 3 — Oportunidad' },
          { v:'credito'       as Tab, l:'🏦 Etapa 4 — Crédito' },
          { v:'roi'           as Tab, l:'📊 ROI & Payback' },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{ padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              border:`1px solid ${tab===t.v ? T.accent : T.border}`,
              background: tab===t.v ? `${T.accent}15` : 'transparent',
              color: tab===t.v ? T.accent : T.muted }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1 — INVERSIÓN INICIAL
      ══════════════════════════════════════════════════════ */}
      {tab === 'inversion' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>

          {/* Activos */}
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'12px' }}>🖥️ ACTIVOS TANGIBLES (con depreciación)</div>
            {activos.map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', opacity: a.activo ? 1 : 0.5 }}>
                <input type="checkbox" checked={a.activo}
                  onChange={async () => {
                    const updated = activos.map(x => x.id===a.id ? {...x, activo:!x.activo} : x)
                    setActivos(updated)
                    if (a.id.startsWith('def_')) return
                    await supabase.from('inversiones_activos').update({ activo: !a.activo }).eq('id', a.id)
                  }}
                  style={{ cursor:'pointer', accentColor:T.blue }} />
                <span style={{ flex:1, fontSize:'11px', color: a.activo ? T.text : T.muted }}>{a.concepto}</span>
                <span style={{ fontSize:'10px', color:T.purple }}>{a.vida_util_meses}m</span>
                <input type="number" value={Number(a.valor)}
                  onChange={e => setActivos(activos.map(x => x.id===a.id ? {...x, valor:Number(e.target.value)} : x))}
                  style={{ ...inp, width:'110px', textAlign:'right', fontSize:'12px' }} />
              </div>
            ))}

            {/* Agregar activo */}
            <div style={{ ...s2, padding:'12px', marginTop:'12px' }}>
              <div style={{ fontSize:'11px', color:T.muted, marginBottom:'8px' }}>+ Agregar activo</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 60px', gap:'6px', marginBottom:'6px' }}>
                <input placeholder="Concepto" value={newActivo.concepto}
                  onChange={e => setNewActivo(p => ({...p, concepto:e.target.value}))} style={{...inp, fontSize:'11px'}} />
                <input type="number" placeholder="Valor" value={newActivo.valor || ''}
                  onChange={e => setNewActivo(p => ({...p, valor:Number(e.target.value)}))} style={{...inp, fontSize:'11px'}} />
                <input type="number" placeholder="Vida" value={newActivo.vida}
                  onChange={e => setNewActivo(p => ({...p, vida:Number(e.target.value)}))} style={{...inp, fontSize:'11px'}} />
              </div>
              <button onClick={guardarActivo}
                style={{ padding:'6px 14px', background:`${T.blue}20`, border:`1px solid ${T.blue}40`, borderRadius:'7px', color:T.blue, cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>
                + Agregar
              </button>
            </div>

            <div style={{ marginTop:'10px', padding:'10px 12px', ...s2, display:'flex', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:'11px', color:T.muted }}>Subtotal activos</div>
                <div style={{ fontSize:'16px', fontWeight:'800', color:T.blue }}>{fmt(totalActivos, pais)}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'11px', color:T.muted }}>Depreciación/mes → CF</div>
                <div style={{ fontSize:'16px', fontWeight:'800', color:T.purple }}>{fmt(Math.round(depreciacionMes), pais)}</div>
              </div>
            </div>
          </div>

          {/* Capital + Socios */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'12px' }}>💵 CAPITAL DE TRABAJO & OTROS</div>
              {capital.map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', opacity: c.activo ? 1 : 0.5 }}>
                  <input type="checkbox" checked={c.activo}
                    onChange={() => setCapital(capital.map(x => x.id===c.id ? {...x, activo:!x.activo} : x))}
                    style={{ cursor:'pointer', accentColor:T.green }} />
                  <span style={{ flex:1, fontSize:'11px', color: c.activo ? T.text : T.muted }}>{c.concepto}</span>
                  <input type="number" value={Number(c.valor)}
                    onChange={e => setCapital(capital.map(x => x.id===c.id ? {...x, valor:Number(e.target.value)} : x))}
                    style={{ ...inp, width:'110px', textAlign:'right', fontSize:'12px' }} />
                </div>
              ))}
              <div style={{ ...s2, padding:'10px', marginTop:'8px', display:'flex', gap:'6px' }}>
                <input placeholder="Concepto" value={newCapital.concepto}
                  onChange={e => setNewCapital(p => ({...p, concepto:e.target.value}))} style={{...inp, fontSize:'11px'}} />
                <input type="number" placeholder="Valor" value={newCapital.valor || ''}
                  onChange={e => setNewCapital(p => ({...p, valor:Number(e.target.value)}))} style={{...inp, width:'90px', fontSize:'11px'}} />
                <button onClick={guardarCapital}
                  style={{ padding:'6px 12px', background:`${T.green}20`, border:`1px solid ${T.green}40`, borderRadius:'7px', color:T.green, cursor:'pointer', fontSize:'11px', flexShrink:0 }}>+</button>
              </div>
              <div style={{ marginTop:'8px', padding:'8px 12px', background:`${T.green}08`, borderRadius:'8px', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'11px', color:T.muted }}>Subtotal capital</span>
                <span style={{ fontSize:'14px', fontWeight:'800', color:T.green }}>{fmt(totalCapital, pais)}</span>
              </div>
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'12px' }}>👥 APORTES DE SOCIOS</div>
              {socios.map(so => (
                <div key={so.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontSize:'12px', color:T.text }}>{so.nombre}</span>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <span style={{ fontSize:'12px', fontWeight:'700', color:T.yellow }}>{fmt(Number(so.valor_aporte), pais)}</span>
                    <span style={{ fontSize:'10px', color:T.muted }}>{so.pct_participacion}%</span>
                  </div>
                </div>
              ))}
              <div style={{ ...s2, padding:'10px', marginTop:'8px', display:'grid', gridTemplateColumns:'1fr 80px 50px auto', gap:'5px', alignItems:'center' }}>
                <input placeholder="Nombre socio" value={newSocio.nombre}
                  onChange={e => setNewSocio(p => ({...p, nombre:e.target.value}))} style={{...inp, fontSize:'11px'}} />
                <input type="number" placeholder="Aporte" value={newSocio.aporte || ''}
                  onChange={e => setNewSocio(p => ({...p, aporte:Number(e.target.value)}))} style={{...inp, fontSize:'11px'}} />
                <input type="number" placeholder="%" value={newSocio.pct || ''}
                  onChange={e => setNewSocio(p => ({...p, pct:Number(e.target.value)}))} style={{...inp, fontSize:'11px'}} />
                <button onClick={guardarSocio}
                  style={{ padding:'6px 10px', background:`${T.yellow}20`, border:`1px solid ${T.yellow}40`, borderRadius:'7px', color:T.yellow, cursor:'pointer', fontSize:'11px' }}>+</button>
              </div>
              <div style={{ marginTop:'10px', padding:'10px 12px', background: brechaFinanc>0 ? `${T.yellow}08` : `${T.green}08`, borderRadius:'8px', border:`1px solid ${brechaFinanc>0 ? T.yellow : T.green}25` }}>
                {[
                  { l:'Total necesario',    v:fmt(totalInversion, pais), c:T.text },
                  { l:'Aportes socios',     v:fmt(totalAportes, pais),   c:T.blue },
                  { l:'Brecha → crédito',   v: brechaFinanc>0 ? fmt(brechaFinanc, pais) : '✅ Cubierto', c: brechaFinanc>0 ? T.yellow : T.green },
                ].map((row,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
                    <span style={{ fontSize:'11px', color:T.muted }}>{row.l}</span>
                    <span style={{ fontSize:'13px', fontWeight:'700', color:row.c }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2 — CAPITAL PROPIO
      ══════════════════════════════════════════════════════ */}
      {tab === 'capital_propio' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'14px' }}>🌱 DIAGNÓSTICO — ¿Puedo crecer con lo que tengo?</div>
            {[
              { l:'Utilidad promedio 3 meses', v:fmt(utilidadProm3m, pais), c:T.green, src:'pedidos BD' },
              { l:'CF mensual actual',         v:fmt(cfMes, pais),          c:T.blue,  src:'costos BD' },
              { l:'Wallet disponible',         v:fmt(walletSaldo, pais),    c:T.accent,src:'wallet BD' },
              { l:'Excedente mensual',         v:fmt(Math.max(utilidadProm3m - cfMes, 0), pais), c: utilidadProm3m > cfMes ? T.green : T.red, src:'calculado' },
            ].map((k,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize:'12px', color:T.text }}>{k.l}</div>
                  <div style={{ fontSize:'10px', color:T.border }}>← {k.src}</div>
                </div>
                <span style={{ fontSize:'16px', fontWeight:'800', color:k.c }}>{k.v}</span>
              </div>
            ))}

            <div style={{ marginTop:'14px', padding:'12px', background:`${T.blue}08`, borderRadius:'10px', border:`1px solid ${T.blue}20` }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:T.blue, marginBottom:'8px' }}>📅 PLAN ESCALONADO (sin crédito)</div>
              {[
                { fase:'Mes 1-3',  titulo:'Estandarización',              desc:'No escales aún. Logra TC≥75%, TE≥75%, dev≤12%.', color:T.red },
                { fase:'Mes 4-6',  titulo:'Optimización de indicadores',  desc:'Consolida métricas. Reinvierte solo excedentes.', color:T.yellow },
                { fase:'Mes 7+',   titulo:'Escala controlada',            desc:'Cuando todos los semáforos estén en verde.', color:T.green },
              ].map((f,i) => (
                <div key={i} style={{ display:'flex', gap:'10px', marginBottom:'8px' }}>
                  <div style={{ width:'50px', fontSize:'10px', color:f.color, fontWeight:'700', flexShrink:0 }}>{f.fase}</div>
                  <div>
                    <div style={{ fontSize:'11px', fontWeight:'600', color:T.text }}>{f.titulo}</div>
                    <div style={{ fontSize:'10px', color:T.muted }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'14px' }}>🚦 SEMÁFORO PARA ESCALAR CON CAPITAL PROPIO</div>
            {[
              { l:'TC ≥ 75% — Confirmación',     actual:tcReal,    meta:75,  inv:false, unidad:'%' },
              { l:'TE ≥ 75% — Entrega efectiva', actual:teReal,    meta:75,  inv:false, unidad:'%' },
              { l:'Dev ≤ 12% — Devoluciones',    actual:devReal,   meta:12,  inv:true,  unidad:'%' },
              { l:'Margen ≥ 15% — Rentabilidad', actual:margenReal,meta:15,  inv:false, unidad:'%' },
            ].map((item,i) => {
              const ok = item.inv ? item.actual <= item.meta : item.actual >= item.meta
              const warn = item.inv ? item.actual <= item.meta * 1.3 : item.actual >= item.meta * 0.8
              const color = ok ? T.green : warn ? T.yellow : T.red
              return (
                <div key={i} style={{ ...s2, padding:'12px', marginBottom:'8px', borderLeft:`3px solid ${color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'11px', color:T.text }}>{item.l}</span>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                      <span style={{ fontSize:'12px', fontWeight:'700', color }}>
                        {item.actual}{item.unidad}
                      </span>
                      <span style={{ fontSize:'10px', color: ok ? T.green : T.red }}>
                        {ok ? '✅ Listo' : `Meta: ${item.meta}${item.unidad}`}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop:'12px', padding:'14px', borderRadius:'10px',
              background: rojosCount===0 && amarillosCount===0 ? `${T.green}08` : `${T.yellow}08`,
              border:`1px solid ${rojosCount===0 && amarillosCount===0 ? T.green : T.yellow}25` }}>
              <div style={{ fontSize:'14px', fontWeight:'700', color: rojosCount===0 && amarillosCount===0 ? T.green : T.yellow, marginBottom:'6px' }}>
                {rojosCount===0 && amarillosCount===0
                  ? '✅ Puedes reinvertir excedentes — operación sólida'
                  : '⚠️ Estandariza antes de escalar — hay indicadores por mejorar'}
              </div>
              <div style={{ fontSize:'11px', color:T.muted, lineHeight:'1.6' }}>
                {rojosCount>0 ? `${rojosCount} indicador(es) en rojo requieren atención inmediata.` : ''}
                {amarillosCount>0 ? ` ${amarillosCount} indicador(es) en amarillo requieren optimización.` : ''}
                {rojosCount===0 && amarillosCount===0 ? 'Todos los indicadores están en verde. Considera el Modo Tiburón en Equilibrio.' : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3 — OPORTUNIDAD
      ══════════════════════════════════════════════════════ */}
      {tab === 'oportunidad' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.purple, marginBottom:'14px' }}>🎯 DETECTOR DE OPORTUNIDAD</div>
            {[
              { l:'ROAS > 3× por 30+ días',       ok: cpaHistorico > 0 && (gananciaPedido / cpaHistorico) >= 3, val:`ROAS ${cpaHistorico>0 ? (gananciaPedido/cpaHistorico).toFixed(1) : '—'}×` },
              { l:'TC/TE estables en verde',       ok: tcReal >= 75 && teReal >= 75,  val:`TC ${tcReal}% · TE ${teReal}%` },
              { l:'Margen absorbe intereses',      ok: margenReal >= 15,              val:`Margen ${margenReal}%` },
              { l:'Capacidad operativa disponible',ok: confirmadores > 0,             val:`${confirmadores} conf · ${empacadores} emp` },
            ].map((item,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize:'12px', color:T.text }}>{item.l}</div>
                  <div style={{ fontSize:'10px', color:T.muted }}>{item.val}</div>
                </div>
                <span style={{ fontSize:'13px', fontWeight:'700', color: item.ok ? T.green : T.red }}>
                  {item.ok ? '✅' : '❌'}
                </span>
              </div>
            ))}

            <div style={{ marginTop:'16px' }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:T.muted, marginBottom:'10px' }}>💡 VALIDADOR DE HIPÓTESIS</div>
              <div style={{ ...s2, padding:'12px', marginBottom:'8px' }}>
                <div style={{ fontSize:'11px', color:T.muted, marginBottom:'6px' }}>
                  "Si inyecto {fmt(simMonto, pais)} en pauta..."
                </div>
                {cpaHistorico > 0 ? (
                  <>
                    <div style={{ fontSize:'12px', color:T.text }}>
                      → Generaría ≈ <strong style={{ color:T.blue }}>{Math.round(simMonto / cpaHistorico)} pedidos</strong> en Shopify
                    </div>
                    <div style={{ fontSize:'12px', color:T.text }}>
                      → Entregados ≈ <strong style={{ color:T.green }}>{Math.round(simMonto / cpaHistorico * tcReal/100 * teReal/100)} pedidos</strong>
                    </div>
                    <div style={{ fontSize:'12px', color:T.text }}>
                      → Utilidad proyectada: <strong style={{ color:T.accent }}>{fmt(Math.round(simMonto / cpaHistorico * tcReal/100 * teReal/100 * gananciaPedido), pais)}</strong>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:'11px', color:T.muted }}>Ingresa pauta histórica para validar la hipótesis</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>🏦 FUENTES DE CAPITAL DISPONIBLES</div>
            {[
              { fuente:'Capital propio acumulado',   costo:`0%`,          disponible: walletSaldo > 0,           nota:'Wallet + banco' },
              { fuente:'Crédito bancario',           costo:`${TASAS_PAIS[pais]?.tasa_min}–${TASAS_PAIS[pais]?.tasa_max}%/mes`, disponible: rojosCount===0, nota:TASAS_PAIS[pais]?.referencia },
              { fuente:'Fintech / libranza',         costo:`2.5–4%/mes`,  disponible: margenReal >= 15,          nota:'Aprobación rápida' },
              { fuente:'Socios inversionistas',      costo:`% utilidades`,disponible: totalAportes > 0,          nota:'Dilución de participación' },
              { fuente:'Anticipo de cartera',        costo:`1.5–3%`,      disponible: false,                     nota:'Requiere cartera comprobable' },
              { fuente:'Crowdfunding',               costo:`Variable`,    disponible: false,                     nota:'Requiere validación pública' },
            ].map((f,i) => (
              <div key={i} style={{ display:'flex', gap:'10px', padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
                <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: f.disponible ? T.green : T.muted, marginTop:'3px', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'12px', color: f.disponible ? T.text : T.muted }}>{f.fuente}</span>
                    <span style={{ fontSize:'11px', fontWeight:'700', color: f.disponible ? T.accent : T.muted }}>{f.costo}</span>
                  </div>
                  <div style={{ fontSize:'10px', color:T.muted }}>{f.nota}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop:'14px', padding:'12px', background:`${T.purple}08`, borderRadius:'10px', border:`1px solid ${T.purple}20` }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:T.purple, marginBottom:'6px' }}>📐 COSTO REAL DEL CAPITAL (WACC)</div>
              <div style={{ fontSize:'12px', color:T.muted, lineHeight:'1.6' }}>
                Tasa del crédito: <strong style={{ color:T.text }}>{simTasa}%/mes</strong>
                <br />ROI mensual esperado: <strong style={{ color: roiMensual >= simTasa ? T.green : T.red }}>{roiMensual.toFixed(1)}%/mes</strong>
                <br />
                <strong style={{ color: roiMensual >= simTasa ? T.green : T.red }}>
                  {roiMensual >= simTasa ? '✅ ROI > WACC — la deuda genera valor' : '❌ ROI < WACC — la deuda destruye valor'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4 — DECISIÓN DEL CRÉDITO
      ══════════════════════════════════════════════════════ */}
      {tab === 'credito' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>

          {/* Parámetros + Dictamen */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'14px' }}>🏦 SIMULADOR DE CRÉDITO</div>
              {[
                { l:'Nombre del crédito',    el: <input value={simNombre} onChange={e=>setSimNombre(e.target.value)} style={inp} /> },
                { l:'Fuente', el: (
                  <select value={simFuente} onChange={e=>setSimFuente(e.target.value)} style={{...inp,cursor:'pointer'}}>
                    {['bancario','fintech','socio','factoring','crowdfunding','libranza'].map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                )},
                { l:'Monto ($)',              el: <input type="number" value={simMonto} onChange={e=>setSimMonto(Number(e.target.value))} style={inp} /> },
                { l:`Tasa mensual % (${TASAS_PAIS[pais]?.referencia || ''})`, el: <input type="number" step={0.1} value={simTasa} onChange={e=>setSimTasa(Number(e.target.value))} style={inp} /> },
                { l:'Plazo (meses)',          el: <input type="number" value={simPlazo} onChange={e=>setSimPlazo(Number(e.target.value))} style={inp} /> },
                { l:'Período de gracia',      el: <input type="number" value={simGracia} onChange={e=>setSimGracia(Number(e.target.value))} style={inp} /> },
                { l:'Destino',                el: (
                  <select value={simDestino} onChange={e=>setSimDestino(e.target.value)} style={{...inp,cursor:'pointer'}}>
                    {['pauta','capital','equipos','inventario','escalar'].map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                )},
              ].map((row,i) => (
                <div key={i} style={{ marginBottom:'10px' }}>
                  <label style={{ display:'block', fontSize:'11px', color:T.muted, marginBottom:'4px' }}>{row.l}</label>
                  {row.el}
                </div>
              ))}
              <div style={{ display:'flex', gap:'6px', marginTop:'4px' }}>
                {(['fija','variable'] as const).map(t => (
                  <button key={t} onClick={()=>setSimTipo(t)}
                    style={{ flex:1, padding:'7px', borderRadius:'7px', cursor:'pointer', fontSize:'12px', fontWeight:'600',
                      border:`1px solid ${simTipo===t ? T.yellow : T.border}`,
                      background: simTipo===t ? `${T.yellow}15` : 'transparent',
                      color: simTipo===t ? T.yellow : T.muted }}>
                    Cuota {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen crédito */}
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'12px' }}>📊 RESUMEN</div>
              {simTipo === 'variable' && (
                <div style={{ marginBottom:'10px', padding:'8px 10px', background:`${T.purple}08`, borderRadius:'7px', fontSize:'11px', color:T.muted }}>
                  📐 Cuota alemana: capital fijo de {fmt(capitalFijoAleman, pais)}/mes + interés decreciente. La cuota mostrada es la del mes 1 (la más alta) — disminuye cada mes.
                </div>
              )}
              {[
                { l: simTipo==='variable' ? 'Cuota mes 1 (decrece)' : 'Cuota mensual', v:fmt(cuotaResumen, pais), c:T.red },
                { l:'Total a pagar',   v:fmt(totalPagar, pais),   c:T.yellow },
                { l:'Total intereses', v:fmt(totalIntSim, pais),  c:T.red },
                { l:'CF con crédito',  v:fmt(cfConCredito, pais), c:T.red },
                { l:'MSC',             v:msc.toFixed(2),          c: msc>=1.5 ? T.green : msc>=1.0 ? T.yellow : T.red },
                { l:'Pedidos extra necesarios', v:`${pedidosExtra}/mes`, c:T.accent },
              ].map((k,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontSize:'11px', color:T.muted }}>{k.l}</span>
                  <span style={{ fontSize:'13px', fontWeight:'700', color:k.c }}>{k.v}</span>
                </div>
              ))}
              <div style={{ marginTop:'10px', padding:'8px 10px', background:`${T.accent}08`, borderRadius:'8px', fontSize:'11px', color:T.muted }}>
                Para cubrir la cuota de <strong style={{ color:T.accent }}>{fmt(cuotaResumen, pais)}</strong> necesitas{' '}
                <strong style={{ color:T.text }}>{pedidosExtra} pedidos más/mes</strong>
                {' '}a <strong style={{ color:T.green }}>{fmt(gananciaPedido, pais)}</strong>/pedido
              </div>
              <button onClick={guardarCredito}
                style={{ marginTop:'12px', width:'100%', padding:'9px', background:`${T.accent}20`, border:`1px solid ${T.accent}40`, borderRadius:'8px', color:T.accent, cursor:'pointer', fontSize:'12px', fontWeight:'700' }}>
                💾 Guardar simulación + Dictamen
              </button>
            </div>

            {/* Créditos guardados — activar conecta a CF y Metas */}
            {creditos.length > 0 && (
              <div style={{ ...s, padding:'16px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'10px' }}>📂 CRÉDITOS GUARDADOS</div>
                {creditos.slice(0,5).map(c => (
                  <div key={c.id} style={{ ...s2, padding:'10px 12px', marginBottom:'7px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:'12px', fontWeight:'600', color:T.text }}>{c.nombre}</div>
                      <div style={{ fontSize:'10px', color:T.muted }}>{fmt(c.cuota_mensual, pais)}/mes · {c.fuente} · {c.estado}</div>
                    </div>
                    {c.estado === 'simulacion' ? (
                      <button onClick={() => activarCredito(c.id)}
                        style={{ padding:'6px 12px', background:`${T.green}20`, border:`1px solid ${T.green}40`, borderRadius:'7px', color:T.green, cursor:'pointer', fontSize:'11px', fontWeight:'700' }}>
                        ✅ Activar
                      </button>
                    ) : (
                      <span style={{ fontSize:'11px', fontWeight:'700', color:T.green }}>🟢 Activo</span>
                    )}
                  </div>
                ))}
                <div style={{ fontSize:'10px', color:T.muted, marginTop:'6px' }}>
                  Al activar: la cuota se suma a Costos Fijos y los pedidos extra se suman a tu Meta del mes.
                </div>
              </div>
            )}
          </div>

          {/* Dictamen DIZGO + Tabla amortización */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

            {/* DICTAMEN */}
            <div style={{ ...s, padding:'20px', border:`2px solid ${colorDictamen}` }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color:colorDictamen, marginBottom:'14px' }}>
                🔍 DICTAMEN DIZGO — {dictamen.toUpperCase()}
              </div>

              {/* Semáforos */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', marginBottom:'14px' }}>
                {[
                  { l:'TC ≥ 75%',      estado:semaforos.confirmacion, val:`${tcReal}%` },
                  { l:'TE ≥ 75%',      estado:semaforos.entrega,      val:`${teReal}%` },
                  { l:'Dev ≤ 12%',     estado:semaforos.devolucion,   val:`${devReal}%` },
                  { l:'Margen ≥ 15%',  estado:semaforos.margen,       val:`${margenReal}%` },
                  { l:'MSC ≥ 1.5',     estado:semaforos.msc,          val:msc.toFixed(2) },
                  { l:'ROI > WACC',    estado:semaforos.wacc,         val:`${roiMensual.toFixed(1)}% vs ${simTasa}%` },
                ].map((s,i) => (
                  <div key={i} style={{ ...s2, padding:'8px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'11px', color:T.muted }}>{s.l}</span>
                    <div style={{ textAlign:'right' }}>
                      <SemBadge estado={s.estado} />
                      <div style={{ fontSize:'10px', color:T.muted }}>{s.val}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding:'14px', borderRadius:'10px', background:`${colorDictamen}08`, border:`1px solid ${colorDictamen}25` }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:colorDictamen, marginBottom:'8px' }}>
                  {dictamen === 'verde' ? '🟢 PUEDES TOMAR EL CRÉDITO' : dictamen === 'amarillo' ? '🟡 AJUSTA ANTES DE ENDEUDARTE' : '🔴 NO TOMES EL CRÉDITO'}
                </div>
                <div style={{ fontSize:'12px', color:T.muted, lineHeight:'1.7', fontStyle: dictamen==='rojo' ? 'italic' : 'normal' }}>
                  "{dictamenTexto}"
                </div>
              </div>
            </div>

            {/* Tabla amortización */}
            <div style={{ ...s, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontSize:'12px', fontWeight:'700', color:T.purple }}>
                📋 TABLA DE AMORTIZACIÓN
              </div>
              <div style={{ overflowY:'auto', maxHeight:'280px' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
                  <thead style={{ position:'sticky', top:0 }}>
                    <tr style={{ background:'#060E1C' }}>
                      {['Mes','Cuota','Interés → P&G','Capital','Saldo'].map(h => (
                        <th key={h} style={{ padding:'8px 10px', textAlign:'right', fontSize:'10px', color:T.muted, fontWeight:'700', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {amortizacion.map((row,i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:T.muted }}>{row.mes}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:T.red, fontWeight:'600' }}>{fmt(row.cuota, pais)}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:T.yellow }}>{fmt(row.interes, pais)}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:T.green }}>{fmt(row.capital_pago, pais)}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:T.muted }}>{fmt(row.saldo, pais)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:'8px 12px', fontSize:'10px', color:T.muted, borderTop:`1px solid ${T.border}` }}>
                💡 Solo el <strong style={{ color:T.yellow }}>Interés</strong> afecta el P&G · El <strong style={{ color:T.green }}>Capital</strong> es salida de caja
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 5 — ROI & PAYBACK
      ══════════════════════════════════════════════════════ */}
      {tab === 'roi' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'14px' }}>📊 ANÁLISIS ROI DE LA INVERSIÓN</div>

            {/* Selector escenario */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
              {(['pesimista','realista','optimista'] as const).map(m => (
                <button key={m} onClick={() => setModoPayback(m)}
                  style={{ flex:1, padding:'7px', borderRadius:'7px', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                    border:`1px solid ${modoPayback===m ? T.accent : T.border}`,
                    background: modoPayback===m ? `${T.accent}15` : 'transparent',
                    color: modoPayback===m ? T.accent : T.muted }}>
                  {m.charAt(0).toUpperCase()+m.slice(1)}
                  <div style={{ fontSize:'9px', color:T.muted, fontWeight:'400' }}>
                    ×{factorPayback}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ fontSize:'12px', color:T.muted, marginBottom:'14px', lineHeight:'1.6' }}>
              Utilidad mensual en escenario <strong style={{ color:T.text }}>{modoPayback}</strong>:{' '}
              <strong style={{ color:T.accent }}>{fmt(utilidadPayback, pais)}</strong>
              <br />
              <span style={{ fontSize:'10px' }}>(con retraso de rotación 5-8 días COD aplicado)</span>
            </div>

            {[
              { l:'Inversión total',   v:fmt(totalInversion, pais),         c:T.red },
              { l:'Utilidad/mes',      v:fmt(utilidadPayback, pais),        c:T.green },
              { l:'Payback estimado',  v:`${paybackEsc} meses`,             c: paybackEsc<=12 ? T.green : T.yellow },
              { l:'ROI período',       v:`${roiEsperado}%`,                 c: roiEsperado>=50 ? T.green : roiEsperado>=0 ? T.yellow : T.red },
              { l:'ROI pauta',         v:`${cpaHistorico>0 ? Math.round((gananciaPedido/cpaHistorico)*100) : '—'}%`, c:T.blue },
            ].map((k,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 12px', borderRadius:'8px', marginBottom:'6px', background:`${k.c}06` }}>
                <span style={{ fontSize:'12px', color:T.muted }}>{k.l}</span>
                <span style={{ fontSize:'16px', fontWeight:'800', color:k.c }}>{k.v}</span>
              </div>
            ))}

            <div style={{ marginTop:'12px', padding:'12px', borderRadius:'10px',
              background: roiEsperado>=100 ? `${T.green}08` : roiEsperado>=0 ? `${T.yellow}08` : `${T.red}08`,
              border:`1px solid ${roiEsperado>=100 ? T.green : roiEsperado>=0 ? T.yellow : T.red}25` }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color: roiEsperado>=100 ? T.green : roiEsperado>=0 ? T.yellow : T.red, marginBottom:'5px' }}>
                {roiEsperado>=100 ? '🚀 Inversión muy rentable' : roiEsperado>=50 ? '✅ Inversión rentable' : roiEsperado>=0 ? '⚠️ Inversión marginal' : '❌ No rentable'}
              </div>
              <div style={{ fontSize:'11px', color:T.muted, lineHeight:'1.6' }}>
                Payback en <strong style={{ color:T.text }}>{paybackEsc} meses</strong> con utilidad{' '}
                <strong style={{ color:T.accent }}>{fmt(utilidadPayback, pais)}/mes</strong> (escenario {modoPayback}).
                El retraso COD de 5-8 días aplaza el flujo real del primer mes.
              </div>
            </div>
          </div>

          {/* Tabla proyección mes a mes */}
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontSize:'12px', fontWeight:'700', color:T.yellow }}>
              📅 PROYECCIÓN MES A MES — {modoPayback.toUpperCase()}
            </div>
            <div style={{ overflowY:'auto', maxHeight:'460px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
                <thead style={{ position:'sticky', top:0 }}>
                  <tr style={{ background:'#060E1C' }}>
                    {['Mes','Utilidad','Acumulado','Pendiente','ROI'].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'right', fontSize:'10px', color:T.muted, fontWeight:'700' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length:Math.min(paybackEsc > 0 ? paybackEsc + 3 : 18, 24) }, (_,i) => {
                    // Retraso COD: mes 1 tiene 80% del flujo
                    const factorMes  = i === 0 ? 0.8 : 1.0
                    const utilMes    = Math.round(utilidadPayback * factorMes)
                    const acum       = utilMes + (i > 0 ? Math.round(utilidadPayback * i) : 0)
                    const pendiente  = Math.max(totalInversion - acum, 0)
                    const roi        = totalInversion > 0 ? Math.round((acum - totalInversion) / totalInversion * 100) : 0
                    const recuperado = acum >= totalInversion
                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, background: recuperado && acum - utilMes < totalInversion ? `${T.green}06` : 'transparent' }}>
                        <td style={{ padding:'6px 10px', textAlign:'right', color: recuperado && acum - utilMes < totalInversion ? T.green : T.muted }}>
                          {i===0 ? 'Mes 1 (-COD)' : `Mes ${i+1}`}
                        </td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:T.green }}>{fmt(utilMes, pais)}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:'600', color: recuperado ? T.green : T.text }}>{fmt(acum, pais)}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color: pendiente>0 ? T.red : T.green }}>
                          {pendiente>0 ? fmt(pendiente, pais) : '✅'}
                        </td>
                        <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:'700', color: roi>=0 ? T.green : T.red }}>{roi}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Nota de pie */}
      <div style={{ marginTop:'16px', padding:'12px 16px', background:T.card2, borderRadius:'10px', border:`1px solid ${T.border}`, fontSize:'12px', color:T.muted }}>
        🔗 Conectado con: <strong style={{ color:T.text }}>Costos Fijos</strong> (depreciación) ·{' '}
        <strong style={{ color:T.text }}>Pedidos</strong> (TC/TE/margen) ·{' '}
        <strong style={{ color:T.text }}>Wallet</strong> (saldo) ·{' '}
        <strong style={{ color:T.text }}>Pauta</strong> (CPA) ·{' '}
        <strong style={{ color:T.text }}>Nómina</strong> (capacidad) ·{' '}
        → <strong style={{ color:T.green }}>P&G</strong> (intereses) · <strong style={{ color:T.green }}>Alertas</strong> (dictamen) · <strong style={{ color:T.green }}>Metas</strong> (pedidos extra)
        {guardando && <span style={{ marginLeft:'10px' }}>· Guardando...</span>}
      </div>
    </div>
  )
}
