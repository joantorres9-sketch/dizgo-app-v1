'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Alerta = {
  id: string; tenant_id: string | null
  tipo: 'critico'|'atencion'|'info'|'oportunidad'|'externo'
  categoria: 'operativa'|'externa'|'oportunidad'|'pef'
  titulo: string; mensaje: string; accion: string
  modulo: string; valor: string
  icono: string; activa: boolean; leida: boolean
  publicada_por: string | null
  created_at: string; expira_at: string | null
}

type CostoOculto = {
  categoria: string; concepto: string
  pct_impacto: number; valor_estimado: number
  detectado: boolean; color: string
}

const NIVEL_INFO: Record<string, { color:string; bg:string; icono:string; label:string }> = {
  critico:     { color:'#F05C5C', bg:'rgba(240,92,92,0.08)',  icono:'🔴', label:'CRÍTICO' },
  atencion:    { color:'#F5A623', bg:'rgba(245,166,35,0.08)', icono:'🟡', label:'ATENCIÓN' },
  info:        { color:'#3D8EF0', bg:'rgba(61,142,240,0.08)', icono:'🔵', label:'INFO' },
  oportunidad: { color:'#2DD4A0', bg:'rgba(45,212,160,0.08)', icono:'🟢', label:'OPORTUNIDAD' },
  externo:     { color:'#9B6BFF', bg:'rgba(155,107,255,0.08)',icono:'🟣', label:'EXTERNO' },
}

const CATEGORIA_LABEL: Record<string, string> = {
  operativa:'⚙️ Operativa', externa:'📅 Externa', oportunidad:'💡 Oportunidad', pef:'🔍 PEF'
}

const EVENTOS_2026 = [
  { fecha:'2026-06-21', evento:'Día del Padre',          oportunidad:'Relojes + productos masculinos',      color:'#9B6BFF' },
  { fecha:'2026-07-20', evento:'Independencia Colombia', oportunidad:'Descuentos + pauta especial',          color:'#2DD4A0' },
  { fecha:'2026-08-07', evento:'Batalla de Boyacá',       oportunidad:'Festivo + fin de semana largo',        color:'#F5A623' },
  { fecha:'2026-10-31', evento:'Halloween',               oportunidad:'Disfraces + accesorios temáticos',     color:'#F05C5C' },
  { fecha:'2026-11-30', evento:'Black Friday',            oportunidad:'Mayor pico de ventas del año',         color:'#2DD4A0' },
  { fecha:'2026-12-25', evento:'Navidad',                 oportunidad:'Regalos — escalar 45 días antes',      color:'#9B6BFF' },
]

const s = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }
const inp = { background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'13px', outline:'none', width:'100%', boxSizing:'border-box' as const }

export default function AlertasPage() {
  const supabase = createClient()

  const [tenantId, setTenantId] = useState('')
  const [esSuperadmin, setEsSuperadmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [costosOcultos, setCostosOcultos] = useState<CostoOculto[]>([])
  const [tab, setTab] = useState<'alertas'|'pef'|'oportunidades'|'nueva'>('alertas')
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS')
  const [filtroNivel, setFiltroNivel] = useState('TODOS')
  const [alertaSel, setAlertaSel] = useState<Alerta | null>(null)
  const [nueva, setNueva] = useState({ titulo:'', mensaje:'', accion:'', tipo:'externo', categoria:'externa', modulo:'General', destinatarios:'todas' })
  const [oportunidadesProducto, setOportunidadesProducto] = useState<{ nombre:string; señal:string; recomendacion:string; potencial:string; color:string; prioridad:number }[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id, rol').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)
    setEsSuperadmin(profile.rol === 'superadmin')

    const hoy = new Date()
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`
    const iniMes = `${periodo.slice(0,7)}-01`
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).toISOString().slice(0,10)

    const [
      { data: alertasDB },
      { data: pedidosMes },
      { data: pautaData },
      { data: walletData },
      { data: costosData },
      { data: metaData },
    ] = await Promise.all([
      supabase.from('alertas').select('*')
        .or(`tenant_id.eq.${tid},tenant_id.is.null`)
        .eq('activa', true).order('created_at', { ascending:false }).limit(100),
      supabase.from('pedidos').select('estado, transportadora, numero_guia, fecha_pedido').eq('tenant_id', tid)
        .gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes+'T23:59:59'),
      supabase.from('pauta').select('cpa, inversion, resultados, campana').eq('tenant_id', tid)
        .gte('fecha', iniMes).lte('fecha', finMes),
      supabase.from('wallet_transacciones').select('tipo, monto').eq('tenant_id', tid),
      supabase.from('costos_fijos').select('total').eq('tenant_id', tid).eq('periodo', periodo).eq('activo', true),
      supabase.from('metas').select('meta_cpa, meta_confirmacion').eq('tenant_id', tid).eq('periodo', periodo).single(),
    ])

    const alertasReales = (alertasDB || []) as Alerta[]

    const peds = (pedidosMes || []) as { estado:string; transportadora:string; numero_guia:string; fecha_pedido:string }[]
    const enFlujo = ['CONFIRMADO','DESPACHADO','EN_TRANSITO','ENTREGADO','NOVEDAD','DEVOLUCION']
    const confirmados = peds.filter(p => enFlujo.includes(p.estado)).length
    const tcReal = peds.length>0 ? Math.round(confirmados/peds.length*100) : 0
    const novedades = peds.filter(p => p.estado === 'NOVEDAD')

    const pRows = (pautaData||[]) as { cpa:number; inversion:number; resultados:number; campana:string }[]
    const invT = pRows.reduce((a,p)=>a+Number(p.inversion||0),0)
    const resT = pRows.reduce((a,p)=>a+Number(p.resultados||0),0)
    const cpaReal = resT>0 ? Math.round(invT/resT) : 0

    const wRows = (walletData||[]) as { tipo:string; monto:number }[]
    const saldoWallet = wRows.filter(w=>w.tipo==='ENTRADA').reduce((a,w)=>a+Number(w.monto),0)
      - wRows.filter(w=>w.tipo==='SALIDA').reduce((a,w)=>a+Number(w.monto),0)

    const meta = metaData as { meta_cpa?:number; meta_confirmacion?:number } | null
    const metaCpa = Number(meta?.meta_cpa) || 15000
    const metaConf = Number(meta?.meta_confirmacion) || 65

    const yaExiste = (titulo: string) => alertasReales.some(a =>
      a.titulo === titulo && new Date(a.created_at).toDateString() === hoy.toDateString())

    const nuevasAutomaticas: Partial<Alerta>[] = []

    if (cpaReal > metaCpa && cpaReal > 0) {
      const titulo = 'CPA real superó el límite'
      if (!yaExiste(titulo)) nuevasAutomaticas.push({
        tipo:'critico', categoria:'operativa', titulo,
        mensaje:`CPA actual $${cpaReal.toLocaleString('es-CO')} vs máximo permitido $${metaCpa.toLocaleString('es-CO')}. Si sube más, la operación pierde dinero en pauta.`,
        accion:'Pausar campañas con CPA por encima del máximo y redistribuir presupuesto',
        modulo:'Pauta', valor:`CPA: $${cpaReal.toLocaleString('es-CO')}`, icono:'🔴',
      })
    }
    if (novedades.length >= 15) {
      const transp = novedades[0]?.transportadora || 'transportadora'
      const titulo = `${novedades.length} novedades sin resolver en ${transp}`
      if (!yaExiste(titulo)) nuevasAutomaticas.push({
        tipo:'critico', categoria:'operativa', titulo,
        mensaje:`${novedades.length} pedidos con novedad activa este mes. Riesgo de devoluciones masivas si no se gestionan.`,
        accion:'Revisar y llamar a los pedidos con novedad pendiente hoy',
        modulo:'Logística', valor:`${novedades.length} novedades`, icono:'🔴',
      })
    }
    if (tcReal > 0 && tcReal < metaConf) {
      const titulo = `Tasa de confirmación bajó al ${tcReal}%`
      if (!yaExiste(titulo)) nuevasAutomaticas.push({
        tipo:'atencion', categoria:'operativa', titulo,
        mensaje:`Tu meta de confirmación es ${metaConf}% y este mes vas en ${tcReal}%. Revisa horarios de llamada y tiempos de respuesta.`,
        accion:'Confirmar en horario pico: 9am-12m y 6pm-9pm. Enviar WhatsApp en las primeras 2h.',
        modulo:'Pedidos', valor:`${tcReal}% vs meta ${metaConf}%`, icono:'🟡',
      })
    }
    if (saldoWallet > 0 && saldoWallet < 500000) {
      const titulo = 'Saldo wallet bajo'
      if (!yaExiste(titulo)) nuevasAutomaticas.push({
        tipo:'atencion', categoria:'operativa', titulo,
        mensaje:`Saldo disponible para operación es de $${saldoWallet.toLocaleString('es-CO')}, menor a $500.000. Considera no retirar hasta tener más liquidez.`,
        accion:'No retirar hasta que el saldo supere $500K',
        modulo:'Wallet', valor:`$${saldoWallet.toLocaleString('es-CO')}`, icono:'🟡',
      })
    }

    // BODEGA — stock bajo e inventario en riesgo
    const { data: stockBajo } = await supabase.from('inventario').select('producto_id, bodega_id, cantidad_disponible, stock_minimo')
      .eq('tenant_id', tid).lt('cantidad_disponible', 5)
    if ((stockBajo||[]).length > 0) {
      const titulo = `${stockBajo!.length} producto(s) con stock crítico en bodega`
      if (!yaExiste(titulo)) nuevasAutomaticas.push({
        tipo:'critico', categoria:'operativa', titulo,
        mensaje:`Hay ${stockBajo!.length} producto(s) con menos de 5 unidades disponibles. Revisa el módulo Bodega para sugerencias de traslado o compra.`,
        accion:'Ir a Bodega → Stock por bodega → gestionar quiebre',
        modulo:'BODEGA', valor:`${stockBajo!.length} productos`, icono:'🚨',
      })
    }

    const { data: riesgosProd } = await supabase.from('alertas_riesgo_producto')
      .select('tipo_riesgo, recomendacion, producto_id').eq('tenant_id', tid).eq('resuelta', false).limit(5)
    if ((riesgosProd||[]).length > 0) {
      const titulo = `${riesgosProd!.length} producto(s) en riesgo de pérdida de valor`
      if (!yaExiste(titulo)) nuevasAutomaticas.push({
        tipo:'atencion', categoria:'operativa', titulo,
        mensaje:`La IA detectó productos con riesgo: ${Array.from(new Set(riesgosProd!.map((r:{tipo_riesgo:string}) => r.tipo_riesgo))).join(', ')}. Toma acción antes de perder valor.`,
        accion:'Ir a Bodega → Riesgo IA → revisar recomendaciones',
        modulo:'BODEGA', valor:`${riesgosProd!.length} en riesgo`, icono:'⚠️',
      })
    }

    if (nuevasAutomaticas.length > 0) {
      const { data: inserted } = await supabase.from('alertas').insert(
        nuevasAutomaticas.map(a => ({ ...a, tenant_id: tid, activa: true, leida: false, publicada_por: null }))
      ).select()
      if (inserted) alertasReales.unshift(...(inserted as Alerta[]))
    }

    setAlertas(alertasReales)

    const totalCF = (costosData||[]).reduce((a:number,c:{total:number})=>a+Number(c.total||0),0)
    const costoConfirmacion = Math.round(peds.length * 3/60 * 25000)
    const costoNovedades    = Math.round(novedades.length * 45/60 * 25000)
    const pedidosSinConfirmar = peds.filter(p => p.estado === 'NUEVO' || p.estado === 'PENDIENTE').length
    const costoDevAsegurada   = Math.round(pedidosSinConfirmar * 0.3 * 50000)

    setCostosOcultos([
      { categoria:'Prevención', concepto:`Tiempo de confirmación de pedidos (${peds.length} este mes)`, pct_impacto: totalCF>0 ? Math.round(costoConfirmacion/totalCF*1000)/10 : 0, valor_estimado:costoConfirmacion, detectado:true, color:'#F5A623' },
      { categoria:'Prevención', concepto:`Atención a novedades (${novedades.length} activas)`, pct_impacto: totalCF>0 ? Math.round(costoNovedades/totalCF*1000)/10 : 0, valor_estimado:costoNovedades, detectado: novedades.length>0, color:'#F5A623' },
      { categoria:'Evaluación', concepto:'Tiempo en revisión de campañas y pauta', pct_impacto:0.5, valor_estimado:90000, detectado: pRows.length>0, color:'#3D8EF0' },
      { categoria:'Fallas', concepto:'Pedidos pendientes sin confirmar (riesgo devolución)', pct_impacto: totalCF>0 ? Math.round(costoDevAsegurada/totalCF*1000)/10 : 0, valor_estimado:costoDevAsegurada, detectado: pedidosSinConfirmar>0, color:'#F05C5C' },
      { categoria:'Fallas', concepto:'Costo de leads no convertidos (pauta desperdiciada)', pct_impacto: invT>0 && totalCF>0 ? Math.round((invT*(1-tcReal/100))/totalCF*1000)/10 : 0, valor_estimado:Math.round(invT*(1-tcReal/100)), detectado: invT>0, color:'#F05C5C' },
    ])

    const porCampana: Record<string, { inversion:number; resultados:number }> = {}
    pRows.forEach(p => {
      if (!p.campana) return
      if (!porCampana[p.campana]) porCampana[p.campana] = { inversion:0, resultados:0 }
      porCampana[p.campana].inversion += Number(p.inversion||0)
      porCampana[p.campana].resultados += Number(p.resultados||0)
    })
    const oportunidades = Object.entries(porCampana)
      .map(([nombre, d]) => {
        const cpaCamp = d.resultados>0 ? d.inversion/d.resultados : 0
        const roasEstim = cpaCamp>0 ? Math.round((50000/cpaCamp)*10)/10 : 0
        return { nombre, señal:`CPA $${Math.round(cpaCamp).toLocaleString('es-CO')} · ${d.resultados} pedidos`, recomendacion: roasEstim>=3 ? 'Escalar presupuesto — buen ROAS' : 'Mantener y monitorear', potencial: roasEstim>=3 ? `ROAS ${roasEstim}x` : '', color: roasEstim>=4?'#2DD4A0':roasEstim>=3?'#F5A623':'#3D8EF0', prioridad:0, roas:roasEstim }
      })
      .filter(o => o.roas >= 2.5)
      .sort((a,b) => b.roas - a.roas)
      .slice(0,4)
      .map((o,i) => ({ ...o, prioridad:i+1 }))
    setOportunidadesProducto(oportunidades)

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const noLeidas = alertas.filter(a => !a.leida).length
  const criticas = alertas.filter(a => a.tipo === 'critico' && !a.leida).length

  const filtradas = alertas.filter(a => {
    if (filtroCategoria !== 'TODOS' && a.categoria !== filtroCategoria) return false
    if (filtroNivel !== 'TODOS' && a.tipo !== filtroNivel) return false
    return true
  })

  async function marcarLeida(id: string) {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a))
    setAlertaSel(prev => prev?.id === id ? { ...prev, leida: true } : prev)
    await supabase.from('alertas').update({ leida: true }).eq('id', id)
  }

  async function marcarTodasLeidas() {
    setAlertas(prev => prev.map(a => ({ ...a, leida: true })))
    const ids = alertas.filter(a => !a.leida).map(a => a.id)
    if (ids.length > 0) await supabase.from('alertas').update({ leida: true }).in('id', ids)
  }

  async function crearAlerta() {
    if (!nueva.titulo || !nueva.mensaje) return
    const { data:{ user } } = await supabase.auth.getUser()
    const tipoIcono: Record<string,string> = { critico:'🔴', atencion:'🟡', info:'🔵', oportunidad:'🟢', externo:'🟣' }
    const { data } = await supabase.from('alertas').insert({
      tenant_id: nueva.destinatarios === 'todas' && esSuperadmin ? null : tenantId,
      tipo: nueva.tipo, categoria: nueva.categoria,
      titulo: nueva.titulo, mensaje: nueva.mensaje, accion: nueva.accion,
      modulo: nueva.modulo, icono: tipoIcono[nueva.tipo] || '⚠️',
      destinatarios: nueva.destinatarios, activa: true, leida: false,
      publicada_por: user?.id || null,
    }).select().single()
    if (data) setAlertas(prev => [data as Alerta, ...prev])
    setNueva({ titulo:'', mensaje:'', accion:'', tipo:'externo', categoria:'externa', modulo:'General', destinatarios:'todas' })
    setTab('alertas')
  }

  const totalPEF = costosOcultos.filter(c => c.detectado).reduce((s,c) => s+c.valor_estimado, 0)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Analizando indicadores y generando alertas...
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🚨 Centro de Alertas & Decisiones</h1>
          <p style={{ fontSize:'13px', color:'#8B96A8' }}>Alertas reales desde tus módulos · PEF costos ocultos · Oportunidades · ACTUAR</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {noLeidas > 0 && (
            <button onClick={marcarTodasLeidas}
              style={{ padding:'8px 14px', background:'rgba(255,255,255,0.05)', border:'none', borderRadius:'9px', color:'#8B96A8', cursor:'pointer', fontSize:'12px' }}>
              ✓ Marcar todas leídas
            </button>
          )}
          <button onClick={() => setTab('nueva')}
            style={{ padding:'9px 18px', background:'#F5A623', color:'#0A0D14', border:'none', borderRadius:'10px', fontWeight:'700', fontSize:'13px', cursor:'pointer' }}>
            + Nueva alerta
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {[
          { label:'Sin leer', value:noLeidas, color: noLeidas > 0 ? '#F05C5C' : '#2DD4A0', icon:'🔔' },
          { label:'Críticas', value:criticas, color: criticas > 0 ? '#F05C5C' : '#2DD4A0', icon:'🔴' },
          { label:'Operativas', value:alertas.filter(a=>a.categoria==='operativa').length, color:'#F5A623', icon:'⚙️' },
          { label:'Externas', value:alertas.filter(a=>a.categoria==='externa').length, color:'#3D8EF0', icon:'📅' },
          { label:'Oportunidades', value:alertas.filter(a=>a.categoria==='oportunidad').length, color:'#2DD4A0', icon:'💡' },
          { label:'Costos PEF', value:`$${Math.round(totalPEF/1000)}K`, color:'#9B6BFF', icon:'🔍' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px', borderTop:`2px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:'#8B96A8' }}>{k.label}</span>
              <span>{k.icon}</span>
            </div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { key:'alertas', label:`🚨 Alertas (${noLeidas} nuevas)` },
          { key:'pef', label:'🔍 Diagnóstico PEF' },
          { key:'oportunidades', label:'💡 Oportunidades' },
          { key:'nueva', label:'✏️ Nueva alerta' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: tab === t.key ? '#F5A623' : 'rgba(255,255,255,0.05)',
              color: tab === t.key ? '#0A0D14' : '#8B96A8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'alertas' && (
        <div style={{ display:'grid', gridTemplateColumns: alertaSel ? '1fr 380px' : '1fr', gap:'16px' }}>
          <div>
            <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
              {['TODOS','operativa','externa','oportunidad','pef'].map(f => (
                <button key={f} onClick={() => setFiltroCategoria(f)}
                  style={{ padding:'5px 12px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                    background: filtroCategoria === f ? '#F5A623' : 'rgba(255,255,255,0.05)',
                    color: filtroCategoria === f ? '#0A0D14' : '#8B96A8' }}>
                  {f === 'TODOS' ? 'Todos' : CATEGORIA_LABEL[f]}
                </button>
              ))}
              <div style={{ width:'1px', background:'rgba(255,255,255,0.08)', margin:'0 2px' }} />
              {['TODOS','critico','atencion','info','oportunidad','externo'].map(n => (
                <button key={n} onClick={() => setFiltroNivel(n)}
                  style={{ padding:'5px 10px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                    background: filtroNivel === n ? (n === 'TODOS' ? '#F5A623' : `${NIVEL_INFO[n]?.color || '#F5A623'}22`) : 'rgba(255,255,255,0.05)',
                    color: filtroNivel === n ? (n === 'TODOS' ? '#0A0D14' : NIVEL_INFO[n]?.color) : '#8B96A8' }}>
                  {n === 'TODOS' ? 'Todos' : `${NIVEL_INFO[n]?.icono} ${NIVEL_INFO[n]?.label}`}
                </button>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {filtradas.length === 0 ? (
                <div style={{ ...s, padding:'40px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>
                  No hay alertas con estos filtros. Tu operación está limpia ✅
                </div>
              ) : filtradas.map(a => {
                const ni = NIVEL_INFO[a.tipo] || NIVEL_INFO.info
                const activa = alertaSel?.id === a.id
                return (
                  <div key={a.id} onClick={() => { setAlertaSel(activa ? null : a); if(!a.leida) marcarLeida(a.id) }}
                    style={{ ...s, padding:'14px 16px', cursor:'pointer', transition:'all .12s',
                      border:`1px solid ${activa ? ni.color + '44' : !a.leida ? ni.color + '22' : 'rgba(255,255,255,0.07)'}`,
                      background: activa ? ni.bg : !a.leida ? `${ni.color}04` : '#111520',
                      opacity: a.leida && !activa ? 0.7 : 1 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
                      <span style={{ fontSize:'18px', flexShrink:0, marginTop:'2px' }}>{a.icono || ni.icono}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                          {!a.leida && <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:ni.color, flexShrink:0 }} />}
                          <span style={{ fontSize:'13px', fontWeight:'700', color: a.leida ? '#8B96A8' : '#E8EDF5' }}>{a.titulo}</span>
                          <span style={{ fontSize:'10px', padding:'1px 7px', borderRadius:'5px', background:`${ni.color}15`, color:ni.color, fontWeight:'700' }}>{ni.label}</span>
                          <span style={{ fontSize:'10px', color:'#5A6478' }}>{CATEGORIA_LABEL[a.categoria] || a.categoria}</span>
                          {!a.publicada_por && <span style={{ fontSize:'10px', color:'#3D8EF0' }}>🤖 Auto</span>}
                          {a.publicada_por && <span style={{ fontSize:'10px', color:'#9B6BFF' }}>👤 Admin</span>}
                        </div>
                        <div style={{ fontSize:'12px', color:'#8B96A8', marginBottom:'4px', lineHeight:'1.4' }}>{a.mensaje}</div>
                        <div style={{ display:'flex', gap:'12px', fontSize:'11px' }}>
                          {a.valor && <span style={{ color:ni.color, fontWeight:'700' }}>{a.valor}</span>}
                          <span style={{ color:'#5A6478' }}>{a.modulo}</span>
                          <span style={{ color:'#5A6478' }}>{new Date(a.created_at).toLocaleDateString('es-CO')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {alertaSel && (
            <div style={{ ...s, padding:'20px', position:'sticky', top:'20px', maxHeight:'80vh', overflowY:'auto' }}>
              {(() => {
                const ni = NIVEL_INFO[alertaSel.tipo] || NIVEL_INFO.info
                return (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                      <span style={{ fontSize:'22px' }}>{alertaSel.icono || ni.icono}</span>
                      <button onClick={() => setAlertaSel(null)} style={{ background:'none', border:'none', color:'#8B96A8', cursor:'pointer', fontSize:'20px' }}>×</button>
                    </div>
                    <div style={{ fontSize:'14px', fontWeight:'800', color:ni.color, marginBottom:'8px', lineHeight:'1.3' }}>{alertaSel.titulo}</div>
                    <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', background:`${ni.color}15`, color:ni.color, fontWeight:'700' }}>{ni.label}</span>
                      <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', background:'rgba(255,255,255,0.06)', color:'#8B96A8' }}>{CATEGORIA_LABEL[alertaSel.categoria]}</span>
                      <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', background:'rgba(255,255,255,0.06)', color:'#8B96A8' }}>{alertaSel.modulo}</span>
                    </div>
                    <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:'10px', padding:'12px 14px', marginBottom:'12px' }}>
                      <div style={{ fontSize:'11px', color:'#5A6478', fontWeight:'700', marginBottom:'6px' }}>SITUACIÓN</div>
                      <div style={{ fontSize:'13px', color:'#8B96A8', lineHeight:'1.7' }}>{alertaSel.mensaje}</div>
                      {alertaSel.valor && (
                        <div style={{ marginTop:'8px', fontSize:'16px', fontWeight:'800', color:ni.color }}>{alertaSel.valor}</div>
                      )}
                    </div>
                    {alertaSel.accion && (
                      <div style={{ padding:'12px 14px', borderRadius:'10px', background:`${ni.color}08`, border:`1px solid ${ni.color}22`, marginBottom:'14px' }}>
                        <div style={{ fontSize:'11px', color:ni.color, fontWeight:'700', marginBottom:'6px' }}>⚡ ACCIÓN RECOMENDADA</div>
                        <div style={{ fontSize:'12px', color:'#E8EDF5', lineHeight:'1.6' }}>{alertaSel.accion}</div>
                      </div>
                    )}
                    <div style={{ fontSize:'11px', color:'#5A6478', display:'flex', justifyContent:'space-between' }}>
                      <span>Fecha: {new Date(alertaSel.created_at).toLocaleDateString('es-CO')}</span>
                      <span>Fuente: {!alertaSel.publicada_por ? '🤖 Automática' : '👤 Admin'}</span>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {tab === 'pef' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight:'700', marginBottom:'4px' }}>🔍 Diagnóstico PEF — Costos Ocultos</div>
              <div style={{ fontSize:'12px', color:'#8B96A8' }}>Prevención · Evaluación · Fallas — calculado con tus datos reales del mes</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {[
                { letra:'P', nombre:'Prevención', color:'#F5A623', items:costosOcultos.filter(c=>c.categoria==='Prevención') },
                { letra:'E', nombre:'Evaluación', color:'#3D8EF0', items:costosOcultos.filter(c=>c.categoria==='Evaluación') },
                { letra:'F', nombre:'Fallas', color:'#F05C5C', items:costosOcultos.filter(c=>c.categoria==='Fallas') },
              ].map((cat,i) => (
                <div key={i} style={{ padding:'14px', borderRight: i<2?'1px solid rgba(255,255,255,0.06)':'none' }}>
                  <div style={{ fontSize:'22px', fontWeight:'900', color:cat.color }}>{cat.letra}</div>
                  <div style={{ fontSize:'12px', fontWeight:'700', marginBottom:'10px' }}>{cat.nombre}</div>
                  <div style={{ fontSize:'16px', fontWeight:'800', color:cat.color }}>
                    ${cat.items.filter(c=>c.detectado).reduce((s,c)=>s+c.valor_estimado,0).toLocaleString('es-CO')}
                  </div>
                  <div style={{ fontSize:'10px', color:'#5A6478' }}>/mes detectado</div>
                </div>
              ))}
            </div>
            {costosOcultos.map((c,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', opacity: c.detectado?1:0.5 }}>
                <div style={{ width:'24px', height:'24px', borderRadius:'6px', background:`${c.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'800', color:c.color, flexShrink:0 }}>{c.categoria[0]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'12px', color: c.detectado?'#E8EDF5':'#5A6478', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.concepto}</div>
                  <div style={{ fontSize:'10px', color:'#5A6478' }}>Impacto: {c.pct_impacto}% del CF · {c.detectado ? '✅ Detectado' : '⚠️ Sin datos suficientes'}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:'800', color:c.color }}>${c.valor_estimado.toLocaleString('es-CO')}</div>
                  <div style={{ fontSize:'9px', color:'#5A6478' }}>/mes</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', marginBottom:'14px' }}>💰 RESUMEN COSTOS OCULTOS</div>
            <div style={{ padding:'12px 14px', borderRadius:'10px', marginBottom:'8px', background:'#F5A62306', borderLeft:'3px solid #F5A623' }}>
              <div style={{ fontSize:'12px', color:'#8B96A8' }}>Costos ocultos detectados este mes</div>
              <div style={{ fontSize:'20px', fontWeight:'800', color:'#F5A623' }}>${totalPEF.toLocaleString('es-CO')}</div>
            </div>
            <div style={{ marginTop:'8px', padding:'14px', background:'rgba(155,107,255,0.06)', borderRadius:'10px', border:'1px solid rgba(155,107,255,0.2)' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', marginBottom:'6px' }}>💡 ¿QUÉ HACER CON ESTO?</div>
              <div style={{ fontSize:'12px', color:'#8B96A8', lineHeight:'1.7' }}>
                Si reduces el PEF en un 30%, liberas <strong style={{ color:'#2DD4A0' }}>${Math.round(totalPEF*0.3/1000)}K/mes</strong> adicionales en utilidad real sin vender un solo producto más.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'oportunidades' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'14px' }}>💡 OPORTUNIDADES DETECTADAS (desde Pauta real)</div>
            {oportunidadesProducto.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'12px' }}>
                Aún no hay suficientes datos de pauta este mes para detectar oportunidades con ROAS alto
              </div>
            ) : oportunidadesProducto.map((op,i) => (
              <div key={i} style={{ padding:'14px', borderRadius:'10px', marginBottom:'8px', background:`${op.color}08`, borderLeft:`3px solid ${op.color}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                  <span style={{ fontSize:'14px', fontWeight:'800', color:op.color }}>{op.nombre}</span>
                  {op.potencial && <span style={{ fontSize:'13px', fontWeight:'700', color:'#2DD4A0' }}>{op.potencial}</span>}
                </div>
                <div style={{ fontSize:'12px', color:'#F5A623', marginBottom:'5px' }}>📊 {op.señal}</div>
                <div style={{ fontSize:'12px', color:'#8B96A8' }}>→ {op.recomendacion}</div>
              </div>
            ))}
          </div>

          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'12px' }}>📅 CALENDARIO — Próximos eventos clave</div>
            {EVENTOS_2026.map((ev,i) => {
              const dias = Math.ceil((new Date(ev.fecha).getTime() - Date.now()) / 86400000)
              if (dias < 0) return null
              return (
                <div key={i} style={{ display:'flex', gap:'12px', padding:'10px 12px', borderRadius:'8px', marginBottom:'6px', background:'rgba(255,255,255,0.02)' }}>
                  <div style={{ textAlign:'center', flexShrink:0 }}>
                    <div style={{ fontSize:'18px', fontWeight:'900', color:ev.color }}>{dias}</div>
                    <div style={{ fontSize:'9px', color:'#5A6478' }}>días</div>
                  </div>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:'700' }}>{ev.evento}</div>
                    <div style={{ fontSize:'11px', color:'#8B96A8' }}>{new Date(ev.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'long'})}</div>
                    <div style={{ fontSize:'11px', color:ev.color }}>→ {ev.oportunidad}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'nueva' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'16px' }}>✏️ CREAR NUEVA ALERTA {esSuperadmin && '— Modo Superadmin'}</div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'10px', marginBottom:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Categoría</label>
                <select value={nueva.categoria} onChange={e => setNueva(p=>({...p,categoria:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                  <option value="operativa">⚙️ Operativa</option>
                  <option value="externa">📅 Externa</option>
                  <option value="oportunidad">💡 Oportunidad</option>
                  <option value="pef">🔍 PEF</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Nivel</label>
                <select value={nueva.tipo} onChange={e => setNueva(p=>({...p,tipo:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                  <option value="critico">🔴 CRÍTICO</option>
                  <option value="atencion">🟡 ATENCIÓN</option>
                  <option value="info">🔵 INFO</option>
                  <option value="oportunidad">🟢 OPORTUNIDAD</option>
                  <option value="externo">🟣 EXTERNO</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Módulo</label>
                <select value={nueva.modulo} onChange={e => setNueva(p=>({...p,modulo:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                  {['Pauta','Pedidos','Logística','Wallet','Costos','Productos','General','PQRSF'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {esSuperadmin && (
                <div>
                  <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Destinatarios</label>
                  <select value={nueva.destinatarios} onChange={e => setNueva(p=>({...p,destinatarios:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="todas">Todas las tiendas</option>
                    <option value="mi_tienda">Solo mi tienda</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ marginBottom:'10px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Título *</label>
              <input value={nueva.titulo} onChange={e => setNueva(p=>({...p,titulo:e.target.value}))}
                placeholder="Ej: Festivo 29 de mayo — planificar despachos" style={inp} />
            </div>
            <div style={{ marginBottom:'10px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Mensaje *</label>
              <textarea value={nueva.mensaje} onChange={e => setNueva(p=>({...p,mensaje:e.target.value}))}
                rows={3} placeholder="Describe la situación..." style={{ ...inp, resize:'vertical' }} />
            </div>
            <div style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Acción recomendada</label>
              <input value={nueva.accion} onChange={e => setNueva(p=>({...p,accion:e.target.value}))}
                placeholder="Ej: Despachar todo el 28 antes de las 2pm" style={inp} />
            </div>

            <button onClick={crearAlerta} disabled={!nueva.titulo || !nueva.mensaje}
              style={{ width:'100%', padding:'11px', background: nueva.titulo && nueva.mensaje ? '#F5A623' : 'rgba(255,255,255,0.05)',
                border:'none', borderRadius:'10px', color: nueva.titulo && nueva.mensaje ? '#0A0D14' : '#5A6478',
                cursor: nueva.titulo && nueva.mensaje ? 'pointer' : 'not-allowed', fontWeight:'700', fontSize:'13px' }}>
              🚨 Publicar Alerta
            </button>
          </div>

          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'12px' }}>📋 TIPOS DE ALERTAS</div>
            {[
              { tipo:'⚙️ Operativa', ejemplos:'CPA fuera de rango, tasa confirmación baja, saldo wallet bajo — se generan automáticamente', color:'#F5A623' },
              { tipo:'📅 Externa', ejemplos:'Festivos, días especiales, eventos del mercado', color:'#3D8EF0' },
              { tipo:'💡 Oportunidad', ejemplos:'Producto con alto ROAS, nicho nuevo, tendencia detectada', color:'#2DD4A0' },
              { tipo:'🔍 PEF', ejemplos:'Costo oculto detectado, ineficiencia en proceso, tiempo no costeado', color:'#9B6BFF' },
            ].map((t,i) => (
              <div key={i} style={{ padding:'12px', borderRadius:'8px', marginBottom:'7px', background:`${t.color}06`, borderLeft:`3px solid ${t.color}` }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:t.color, marginBottom:'4px' }}>{t.tipo}</div>
                <div style={{ fontSize:'11px', color:'#8B96A8' }}>{t.ejemplos}</div>
              </div>
            ))}
            <div style={{ marginTop:'10px', padding:'10px 12px', background:'rgba(155,107,255,0.06)', borderRadius:'8px', fontSize:'11px', color:'#8B96A8', lineHeight:'1.6' }}>
              Las alertas operativas se generan automáticamente al detectar CPA alto, novedades acumuladas, confirmación baja o saldo de wallet bajo. También llegan aquí las alertas que envían los módulos Precio, Equilibrio e Inversión.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
