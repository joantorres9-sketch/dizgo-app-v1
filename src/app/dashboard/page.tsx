'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'

// ── TIPOS ────────────────────────────────────────────────────
type MesData = {
  mes: string; periodo: string
  ventas: number; ganancia: number; pedidos: number
  entregados: number; cancelados: number; inversion_pauta: number
  cpa: number; margen: number; tasa_entrega: number
}
type AlertaItem = { id:string; tipo:string; titulo:string; mensaje:string; modulo:string; icono:string; created_at:string }
type KPI = { label:string; valor:string; sub:string; color:string; icon:string; href:string; delta?:string; deltaPos?:boolean }

// ── HELPERS ──────────────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const C = { azul:'#3D8EF0', verde:'#2DD4A0', amarillo:'#F5A623', rojo:'#F05C5C', morado:'#9B6BFF', fondo:'#0A0D14', card:'#111520', borde:'rgba(255,255,255,0.07)', muted:'#5A6478', texto:'#E8EDF5', sub:'#8B96A8' }
const s = (extra?:React.CSSProperties): React.CSSProperties => ({ background:C.card, border:`1px solid ${C.borde}`, borderRadius:'12px', ...extra })
function fmt(n:number){ return n>=1000000?`$${(n/1000000).toFixed(1)}M`:n>=1000?`$${Math.round(n/1000)}K`:`$${Math.round(n)}` }
function fmtFull(n:number){ return `$${Math.round(n).toLocaleString('es-CO')}` }
function pct(n:number){ return `${Math.round(n)}%` }
function semC(v:number,bueno:number,malo:number,inv=false){
  if(inv) return v<=malo?C.verde:v<=bueno?C.amarillo:C.rojo
  return v>=bueno?C.verde:v>=malo?C.amarillo:C.rojo
}

const PERIODOS = [
  { key:'mes', label:'Este mes' },
  { key:'trimestre', label:'Trimestre' },
  { key:'semestre', label:'Semestre' },
  { key:'año', label:'Año' },
  { key:'custom', label:'Personalizado' },
]

export default function DashboardPage() {
  const supabase = createClient()
  const printRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('semestre')
  const [fechaIni, setFechaIni] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [historico, setHistorico] = useState<MesData[]>([])
  const [mesActual, setMesActual] = useState<MesData|null>(null)
  const [mesAnterior, setMesAnterior] = useState<MesData|null>(null)
  const [alertas, setAlertas] = useState<AlertaItem[]>([])
  const [cxpVencidas, setCxpVencidas] = useState(0)
  const [stockBajo, setStockBajo] = useState(0)
  const [saldoWallet, setSaldoWallet] = useState(0)
  const [pqrsfVencidas, setPqrsfVencidas] = useState(0)
  const [superAnalisis, setSuperAnalisis] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [nombreTienda, setNombreTienda] = useState('Mi Tienda')

  const getMesesRango = useCallback(() => {
    const hoy = new Date()
    if (periodo === 'mes') return 1
    if (periodo === 'trimestre') return 3
    if (periodo === 'semestre') return 6
    if (periodo === 'año') return 12
    if (periodo === 'custom' && fechaIni && fechaFin) {
      const meses = (new Date(fechaFin).getFullYear()-new Date(fechaIni).getFullYear())*12 +
        new Date(fechaFin).getMonth()-new Date(fechaIni).getMonth()+1
      return Math.max(1, meses)
    }
    return 1
  }, [periodo, fechaIni, fechaFin])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id, nombre_tienda').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)
    if (profile.nombre_tienda) setNombreTienda(profile.nombre_tienda)

    const hoy = new Date()
    const mesesAtras = getMesesRango()
    const hoyStr = hoy.toISOString().slice(0,10)

    // Cargar histórico de meses
    const mesesData: MesData[] = []
    for (let i = mesesAtras-1; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1)
      const ini = fecha.toISOString().slice(0,10)
      const fin = new Date(fecha.getFullYear(), fecha.getMonth()+1, 0).toISOString().slice(0,10)
      const per = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-01`

      const [{ data: peds }, { data: pauta }] = await Promise.all([
        supabase.from('pedidos').select('pvp,ganancia,estado').eq('tenant_id',tid).gte('fecha_pedido',ini).lte('fecha_pedido',fin+'T23:59:59'),
        supabase.from('pauta').select('inversion,resultados').eq('tenant_id',tid).gte('fecha',ini).lte('fecha',fin),
      ])
      const rows = (peds||[]) as {pvp:number;ganancia:number;estado:string}[]
      const total = rows.length
      const entregados = rows.filter(p=>['ENTREGADO','entregado'].includes(p.estado)).length
      const cancelados = rows.filter(p=>['CANCELADO','cancelado'].includes(p.estado)).length
      const ventas = rows.filter(p=>['ENTREGADO','entregado'].includes(p.estado)).reduce((a,p)=>a+Number(p.pvp||0),0)
      const ganancia = rows.filter(p=>['ENTREGADO','entregado'].includes(p.estado)).reduce((a,p)=>a+Number(p.ganancia||0),0)
      const inv_pauta = (pauta||[]).reduce((a:number,r:{inversion:number})=>a+Number(r.inversion||0),0)
      const resultados = (pauta||[]).reduce((a:number,r:{resultados:number})=>a+Number(r.resultados||0),0)
      mesesData.push({
        mes: MESES[fecha.getMonth()], periodo: per,
        ventas, ganancia, pedidos: total,
        entregados, cancelados,
        inversion_pauta: inv_pauta,
        cpa: resultados>0?Math.round(inv_pauta/resultados):0,
        margen: ventas>0?Math.round(ganancia/ventas*100):0,
        tasa_entrega: total>0?Math.round(entregados/total*100):0,
      })
    }
    setHistorico(mesesData)
    setMesActual(mesesData[mesesData.length-1] || null)
    setMesAnterior(mesesData[mesesData.length-2] || null)

    // Datos transversales
    const [{ data: walletData }, { data: cxpData }, { data: invData }, { data: alertasData }, { data: pqrsfData }] = await Promise.all([
      supabase.from('wallet_transacciones').select('tipo,monto').eq('tenant_id',tid),
      supabase.from('cuentas_por_pagar').select('valor,fecha_vencimiento').eq('tenant_id',tid).eq('estado','pendiente').lt('fecha_vencimiento',hoyStr),
      supabase.from('inventario').select('cantidad_disponible,stock_minimo').eq('tenant_id',tid),
      supabase.from('alertas').select('*').eq('tenant_id',tid).order('created_at',{ascending:false}).limit(8),
      supabase.from('pqrsf').select('id').eq('tenant_id',tid).eq('estado','abierto').lt('fecha_limite',hoyStr),
    ])

    const wRows = (walletData||[]) as {tipo:string;monto:number}[]
    setSaldoWallet(Math.round(wRows.filter(w=>w.tipo==='ENTRADA').reduce((a,w)=>a+Number(w.monto),0)-wRows.filter(w=>w.tipo==='SALIDA').reduce((a,w)=>a+Number(w.monto),0)))
    setCxpVencidas((cxpData||[]).length)
    setStockBajo(((invData||[]) as {cantidad_disponible:number;stock_minimo:number}[]).filter(i=>i.cantidad_disponible<=i.stock_minimo).length)
    setAlertas((alertasData||[]) as AlertaItem[])
    setPqrsfVencidas((pqrsfData||[]).length)
    setLoading(false)
  }, [supabase, getMesesRango])

  useEffect(() => { loadData() }, [loadData])

  async function ejecutarSuperAgente() {
    if (!mesActual) return
    setAnalizando(true)
    const contexto = `
DIZGO — Análisis gerencial completo
Período: ${periodo === 'mes'?'Mes actual':periodo}
Tienda: ${nombreTienda}

FINANCIERO:
- Ventas entregadas: ${fmtFull(mesActual.ventas)}
- Ganancia neta: ${fmtFull(mesActual.ganancia)} (margen ${mesActual.margen}%)
- Saldo caja disponible: ${fmtFull(saldoWallet)}
- CXP vencidas: ${cxpVencidas} obligaciones
- Inversión pauta: ${fmtFull(mesActual.inversion_pauta)}

OPERACIONAL:
- Total pedidos: ${mesActual.pedidos}
- Entregados: ${mesActual.entregados} (${mesActual.tasa_entrega}% tasa entrega)
- Cancelados: ${mesActual.cancelados}
- CPA real: ${fmtFull(mesActual.cpa)}

ALERTAS ACTIVAS: ${alertas.length} alertas | Stock bajo: ${stockBajo} productos | PQRSF vencidas: ${pqrsfVencidas}

${mesAnterior?`MES ANTERIOR: Ventas ${fmtFull(mesAnterior.ventas)} | Ganancia ${fmtFull(mesAnterior.ganancia)} | Entregados ${mesAnterior.entregados}`:''}

Como Super Agente Gerencial de DIZGO, analiza esta situación y genera:
1. 🚨 ALERTAS URGENTES (máx 3, las más críticas para actuar HOY)
2. 💡 OPORTUNIDADES (máx 3, con estimado de impacto en $)
3. ✅ ACCIONES RECOMENDADAS (máx 3, concretas y accionables esta semana)
4. 📊 DIAGNÓSTICO EJECUTIVO (2 líneas, semáforo general 🟢/🟡/🔴)

Sé directo, usa números reales, sin rodeos. Formato con emojis y saltos de línea claros.`

    try {
      const res = await fetch('/api/agentes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt:contexto}) })
      const data = await res.json()
      setSuperAnalisis(data.texto||'')
      if (tenantId) {
        await supabase.from('agentes_ia_logs').insert({ tenant_id:tenantId, agente:'super_dashboard', trigger_tipo:'manual', input_resumen:`Dashboard ${periodo}`, output_texto:data.texto||'', tokens_usados:data.tokens||0, estado:'ok' })
      }
    } catch { setSuperAnalisis('❌ Error al conectar con el Super Agente') }
    setAnalizando(false)
  }

  function exportarPDF() { window.print() }

  const delta = (actual:number, anterior:number) => {
    if (!anterior || anterior===0) return null
    const d = Math.round((actual-anterior)/anterior*100)
    return { val:`${d>0?'+':''}${d}%`, pos:d>=0 }
  }

  const kpis: KPI[] = mesActual ? [
    { label:'Ventas del período', valor:fmt(mesActual.ventas), sub:`${mesActual.entregados} pedidos entregados`, color:C.azul, icon:'💰', href:'/dashboard/pedidos', ...( delta(mesActual.ventas, mesAnterior?.ventas||0) && {delta:delta(mesActual.ventas,mesAnterior?.ventas||0)!.val, deltaPos:delta(mesActual.ventas,mesAnterior?.ventas||0)!.pos}) },
    { label:'Ganancia neta', valor:fmt(mesActual.ganancia), sub:`Margen ${pct(mesActual.margen)}`, color:semC(mesActual.margen,15,8), icon:'📈', href:'/dashboard/pyg', ...( delta(mesActual.ganancia, mesAnterior?.ganancia||0) && {delta:delta(mesActual.ganancia,mesAnterior?.ganancia||0)!.val, deltaPos:delta(mesActual.ganancia,mesAnterior?.ganancia||0)!.pos}) },
    { label:'Tasa de entrega', valor:pct(mesActual.tasa_entrega), sub:`${mesActual.cancelados} cancelados`, color:semC(mesActual.tasa_entrega,78,65), icon:'🚚', href:'/dashboard/pedidos' },
    { label:'Caja disponible', valor:fmt(saldoWallet), sub:cxpVencidas>0?`⚠️ ${cxpVencidas} CXP vencidas`:'Sin obligaciones vencidas', color:cxpVencidas>0?C.amarillo:C.verde, icon:'🏦', href:'/dashboard/pyg' },
    { label:'Inversión pauta', valor:fmt(mesActual.inversion_pauta), sub:`CPA real ${fmtFull(mesActual.cpa)}`, color:C.morado, icon:'📡', href:'/dashboard/pauta' },
    { label:'ROAS', valor:mesActual.inversion_pauta>0?(mesActual.ventas/mesActual.inversion_pauta).toFixed(1)+'x':'—', sub:'Retorno sobre pauta', color:semC(mesActual.inversion_pauta>0?mesActual.ventas/mesActual.inversion_pauta:0,3,1.5), icon:'🎯', href:'/dashboard/pauta' },
  ] : []

  const embudo = mesActual ? [
    { label:'Pedidos generados', n:mesActual.pedidos, color:C.azul },
    { label:'Entregados', n:mesActual.entregados, color:C.verde },
    { label:'Cancelados', n:mesActual.cancelados, color:C.rojo },
  ] : []

  const pieData = mesActual ? [
    { name:'Ganancia', value:Math.max(0,mesActual.ganancia), color:C.verde },
    { name:'Pauta', value:Math.max(0,mesActual.inversion_pauta), color:C.morado },
    { name:'Otros costos', value:Math.max(0,mesActual.ventas-mesActual.ganancia-mesActual.inversion_pauta), color:C.muted },
  ] : []

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'12px' }}>
      <div style={{ fontSize:'32px' }}>⚡</div>
      <div style={{ color:C.sub, fontSize:'14px' }}>Cargando Centro de Mando...</div>
    </div>
  )

  return (
    <div ref={printRef} style={{ color:C.texto, fontFamily:'system-ui,sans-serif', maxWidth:'1400px' }} className="dashboard-print">
      <style>{`
        @media print {
          aside, nav, button, .no-print { display:none!important; }
          main { margin:0!important; padding:16px!important; }
          .dashboard-print { color:#000!important; background:#fff!important; }
          .card-print { background:#f8f8f8!important; border:1px solid #ddd!important; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:'800', marginBottom:'2px' }}>⚡ Centro de Mando</h1>
          <p style={{ fontSize:'13px', color:C.sub }}>{nombreTienda} · {new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }} className="no-print">
          {PERIODOS.map(p => (
            <button key={p.key} onClick={()=>setPeriodo(p.key)}
              style={{ padding:'7px 12px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
                background:periodo===p.key?C.amarillo:'rgba(255,255,255,0.06)', color:periodo===p.key?C.fondo:C.sub }}>
              {p.label}
            </button>
          ))}
          {periodo==='custom' && (
            <>
              <input type="date" value={fechaIni} onChange={e=>setFechaIni(e.target.value)}
                style={{ background:'#0A0D14', border:`1px solid ${C.borde}`, borderRadius:'8px', color:C.texto, padding:'6px 10px', fontSize:'12px' }} />
              <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)}
                style={{ background:'#0A0D14', border:`1px solid ${C.borde}`, borderRadius:'8px', color:C.texto, padding:'6px 10px', fontSize:'12px' }} />
              <button onClick={loadData} style={{ padding:'7px 12px', background:C.azul, border:'none', borderRadius:'8px', color:'#fff', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>Aplicar</button>
            </>
          )}
          <button onClick={ejecutarSuperAgente} disabled={analizando}
            style={{ padding:'7px 14px', background:'rgba(155,107,255,0.15)', border:`1px solid ${C.morado}40`, borderRadius:'8px', color:C.morado, cursor:analizando?'wait':'pointer', fontSize:'12px', fontWeight:'700' }}>
            {analizando?'⏳ Analizando...':'🤖 Super Agente'}
          </button>
          <button onClick={exportarPDF}
            style={{ padding:'7px 14px', background:'rgba(240,92,92,0.1)', border:'none', borderRadius:'8px', color:C.rojo, cursor:'pointer', fontSize:'12px', fontWeight:'700' }}>
            📄 PDF Gerencial
          </button>
        </div>
      </div>

      {/* ── ALERTA SUPER AGENTE ── */}
      {superAnalisis && (
        <div style={{ ...s(), padding:'16px', marginBottom:'16px', borderLeft:`3px solid ${C.morado}` }}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:C.morado, marginBottom:'8px' }}>🤖 ANÁLISIS DEL SUPER AGENTE</div>
          <div style={{ fontSize:'13px', lineHeight:'1.8', whiteSpace:'pre-wrap', color:C.texto }}>{superAnalisis}</div>
        </div>
      )}

      {/* ── ALERTAS URGENTES ── */}
      {(cxpVencidas>0 || stockBajo>0 || pqrsfVencidas>0) && (
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
          {cxpVencidas>0 && <div style={{ padding:'8px 14px', background:'rgba(240,92,92,0.1)', borderRadius:'8px', border:`1px solid ${C.rojo}30`, fontSize:'12px', color:C.rojo, fontWeight:'700' }}>🚨 {cxpVencidas} CXP vencidas — Riesgo de mora</div>}
          {stockBajo>0 && <div style={{ padding:'8px 14px', background:'rgba(245,166,35,0.1)', borderRadius:'8px', border:`1px solid ${C.amarillo}30`, fontSize:'12px', color:C.amarillo, fontWeight:'700' }}>⚠️ {stockBajo} productos con stock crítico</div>}
          {pqrsfVencidas>0 && <div style={{ padding:'8px 14px', background:'rgba(240,92,92,0.1)', borderRadius:'8px', border:`1px solid ${C.rojo}30`, fontSize:'12px', color:C.rojo, fontWeight:'700' }}>📬 {pqrsfVencidas} PQRSF vencidas sin respuesta</div>}
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px', marginBottom:'16px' }}>
        {kpis.map((k,i) => (
          <a key={i} href={k.href} style={{ ...s(), padding:'14px', borderTop:`2px solid ${k.color}`, textDecoration:'none', display:'block', cursor:'pointer' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:C.sub, lineHeight:'1.3' }}>{k.label}</span>
              <span style={{ fontSize:'14px' }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:'20px', fontWeight:'900', color:k.color, marginBottom:'3px' }}>{k.valor}</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'10px', color:C.muted }}>{k.sub}</span>
              {k.delta && <span style={{ fontSize:'10px', fontWeight:'700', color:k.deltaPos?C.verde:C.rojo }}>{k.delta}</span>}
            </div>
          </a>
        ))}
      </div>

      {/* ── GRÁFICAS PRINCIPALES ── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px', marginBottom:'12px' }}>
        {/* Gráfica de línea ventas/ganancia */}
        <div style={{ ...s(), padding:'16px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:C.azul, marginBottom:'14px' }}>📈 Ventas vs Ganancia — evolución del período</div>
          {historico.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historico} margin={{top:5,right:10,left:0,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v=>fmt(v)} tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v:number,n:string)=>[fmtFull(v), n==='ventas'?'Ventas':'Ganancia']} contentStyle={{background:C.card,border:`1px solid ${C.borde}`,borderRadius:'8px',fontSize:'12px'}} labelStyle={{color:C.sub}} />
                <Line type="monotone" dataKey="ventas" stroke={C.azul} strokeWidth={2} dot={{r:3,fill:C.azul}} name="ventas" />
                <Line type="monotone" dataKey="ganancia" stroke={C.verde} strokeWidth={2} dot={{r:3,fill:C.verde}} name="ganancia" />
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:C.muted, fontSize:'13px' }}>Sin datos en el período</div>}
        </div>

        {/* Distribución del ingreso — pie */}
        <div style={{ ...s(), padding:'16px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:C.amarillo, marginBottom:'14px' }}>🥧 Distribución del ingreso</div>
          {mesActual && mesActual.ventas > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                    {pieData.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v:number)=>fmtFull(v)} contentStyle={{background:C.card,border:`1px solid ${C.borde}`,borderRadius:'8px',fontSize:'11px'}} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginTop:'8px' }}>
                {pieData.map((d,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:'6px' }}><span style={{ width:'8px', height:'8px', borderRadius:'50%', background:d.color, display:'inline-block' }} />{d.name}</span>
                    <span style={{ fontWeight:'700', color:d.color }}>{mesActual.ventas>0?pct(d.value/mesActual.ventas*100):'—'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ height:'150px', display:'flex', alignItems:'center', justifyContent:'center', color:C.muted, fontSize:'12px' }}>Sin ventas en el período</div>}
        </div>
      </div>

      {/* ── FILA INFERIOR ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
        {/* Barras pedidos por mes */}
        <div style={{ ...s(), padding:'16px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:C.verde, marginBottom:'14px' }}>📦 Pedidos por mes</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={historico} margin={{top:5,right:5,left:0,bottom:5}}>
              <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.borde}`,borderRadius:'8px',fontSize:'11px'}} />
              <Bar dataKey="entregados" fill={C.verde} radius={[4,4,0,0]} name="Entregados" />
              <Bar dataKey="cancelados" fill={C.rojo} radius={[4,4,0,0]} name="Cancelados" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Embudo del mes */}
        <div style={{ ...s(), padding:'16px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:C.morado, marginBottom:'14px' }}>🔬 Embudo del mes</div>
          {embudo.map((e,i) => (
            <div key={i} style={{ marginBottom:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'12px' }}>
                <span style={{ color:C.sub }}>{e.label}</span>
                <span style={{ fontWeight:'800', color:e.color }}>{e.n.toLocaleString('es-CO')}</span>
              </div>
              <div style={{ height:'8px', background:'rgba(255,255,255,0.04)', borderRadius:'4px' }}>
                <div style={{ height:'8px', width:`${mesActual && mesActual.pedidos>0?Math.round(e.n/mesActual.pedidos*100):0}%`, background:e.color, borderRadius:'4px', minWidth:e.n>0?'4px':'0' }} />
              </div>
            </div>
          ))}
          {mesActual && (
            <div style={{ marginTop:'12px', padding:'8px 10px', background:`${semC(mesActual.tasa_entrega,78,65)}10`, borderRadius:'8px' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'11px', color:C.sub }}>Tasa de entrega</span>
                <span style={{ fontSize:'14px', fontWeight:'800', color:semC(mesActual.tasa_entrega,78,65) }}>{pct(mesActual.tasa_entrega)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Alertas recientes */}
        <div style={{ ...s(), padding:'16px', overflow:'hidden' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:C.rojo, marginBottom:'12px' }}>🚨 Alertas recientes</div>
          {alertas.length === 0 ? (
            <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', padding:'20px' }}>✅ Sin alertas activas</div>
          ) : alertas.slice(0,5).map((a,i) => (
            <div key={i} style={{ padding:'8px 0', borderBottom:`1px solid ${C.borde}`, display:'flex', gap:'8px', alignItems:'flex-start' }}>
              <span style={{ fontSize:'14px', flexShrink:0 }}>{a.icono||'🔔'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'11px', fontWeight:'600', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.titulo}</div>
                <div style={{ fontSize:'10px', color:C.muted }}>{a.modulo} · {new Date(a.created_at).toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit'})}</div>
              </div>
              <span style={{ fontSize:'9px', padding:'2px 6px', borderRadius:'4px', background:a.tipo==='critico'?`${C.rojo}20`:`${C.amarillo}20`, color:a.tipo==='critico'?C.rojo:C.amarillo, flexShrink:0, fontWeight:'700' }}>{a.tipo}</span>
            </div>
          ))}
          {alertas.length > 5 && <div style={{ fontSize:'11px', color:C.muted, textAlign:'center', marginTop:'8px' }}>+{alertas.length-5} alertas más en <a href="/dashboard/alertas" style={{ color:C.azul }}>Alertas</a></div>}
        </div>
      </div>

      {/* ── COMPARATIVO MARGEN ── */}
      {historico.length > 1 && (
        <div style={{ ...s(), padding:'16px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:C.amarillo, marginBottom:'14px' }}>📊 Comparativo — Margen neto y CPA por mes</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={historico} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} width={30} unit="%" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v=>fmt(v)} tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} width={55} />
              <Tooltip formatter={(v:number,n:string)=>n==='margen'?[`${v}%`,'Margen']:[fmtFull(v),'CPA']} contentStyle={{background:C.card,border:`1px solid ${C.borde}`,borderRadius:'8px',fontSize:'11px'}} />
              <Bar yAxisId="left" dataKey="margen" fill={C.verde} radius={[4,4,0,0]} name="margen" />
              <Bar yAxisId="right" dataKey="cpa" fill={C.morado} radius={[4,4,0,0]} name="cpa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── PIE DE PÁGINA ── */}
      <div style={{ marginTop:'16px', padding:'12px 16px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'11px', color:C.muted }}>
        <span>DIZGO v2.0 · Centro de Mando Gerencial · {new Date().toLocaleDateString('es-CO')}</span>
        <span>Datos en tiempo real desde Supabase · Análisis por Claude Sonnet 4.6</span>
      </div>
    </div>
    </div>
  )
}
