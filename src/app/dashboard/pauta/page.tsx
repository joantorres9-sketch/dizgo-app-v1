'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#111520', card2:'#0A0D14',
  accent:'#F5A623', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#8B96A8', border:'rgba(255,255,255,0.07)',
}

type Registro = {
  id: string; fecha: string; plataforma: string; campana: string
  inversion: number; impresiones: number; clics: number; ctr: number
  cpm: number; cpc: number; resultados: number; cpa: number; fuente: string
}
type Producto = { id: string; nombre: string; cpa_maximo: number }

const s: React.CSSProperties = { background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px' }

function semCPA(cpa: number, max: number) {
  if (max <= 0) return T.muted
  return cpa <= max * 0.8 ? T.green : cpa <= max ? T.yellow : T.red
}
function semROAS(roas: number) { return roas >= 3 ? T.green : roas >= 2 ? T.yellow : T.red }
function semCTR(ctr: number) { return ctr >= 2 ? T.green : ctr >= 1 ? T.yellow : T.red }
function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-CO')}` }
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function parsearCSVMeta(texto: string): Partial<Registro>[] {
  const lineas = texto.split('\n').filter(l => l.trim())
  if (lineas.length < 2) return []
  const headers = lineas[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,''))

  const idx = (...nombres: string[]) => {
    for (const n of nombres) {
      const i = headers.findIndex(h => h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }
  const iCampana = idx('nombre de la campaña','campaign name','campaña')
  const iInversion = idx('importe gastado','amount spent','gasto')
  const iAlcance = idx('alcance','reach')
  const iClics = idx('clics en el enlace','link clicks','clics')
  const iCtr = idx('ctr')
  const iCpm = idx('cpm')
  const iCpc = idx('cpc')
  const iResultados = idx('resultados','results')
  const iCosteResultado = idx('costo por resultado','cost per result')
  const iFecha = idx('día','day','fecha','date')

  return lineas.slice(1).map(linea => {
    const cols = linea.split(',').map(c => c.trim().replace(/"/g,''))
    const num = (i: number) => i >= 0 ? parseFloat(cols[i]?.replace(/[^0-9.-]/g,'')) || 0 : 0
    return {
      campana: iCampana >= 0 ? cols[iCampana] : 'Sin nombre',
      inversion: num(iInversion), impresiones: num(iAlcance), clics: num(iClics),
      ctr: num(iCtr), cpm: num(iCpm), cpc: num(iCpc),
      resultados: num(iResultados), cpa: iCosteResultado >= 0 ? num(iCosteResultado) : 0,
      fecha: iFecha >= 0 && cols[iFecha] ? cols[iFecha] : new Date().toISOString().slice(0,10),
    }
  }).filter(r => r.campana && r.campana !== 'Sin nombre')
}

export default function PautaPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'resumen'|'campanas'|'dia_dia'|'carga'>('resumen')
  const [plataforma, setPlataforma] = useState<'TODAS'|'META'|'TIKTOK'>('TODAS')
  const [registros, setRegistros] = useState<Registro[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadPlataforma, setUploadPlataforma] = useState<'META'|'TIKTOK'>('META')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

    const hoy = new Date()
    const ini30 = new Date(hoy.getTime() - 30*86400000).toISOString().slice(0,10)

    const [{ data: pautaData }, { data: prodsData }] = await Promise.all([
      supabase.from('pauta').select('*').eq('tenant_id', tid).gte('fecha', ini30).order('fecha', { ascending:false }),
      supabase.from('productos').select('id, nombre, cpa_maximo').eq('tenant_id', tid).eq('tipo','producto').eq('estado','activo'),
    ])

    setRegistros((pautaData||[]) as Registro[])
    setProductos((prodsData||[]) as Producto[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const filtrados = registros.filter(r => plataforma === 'TODAS' || r.plataforma === plataforma)
  const porCampana = filtrados.reduce((acc, r) => {
    if (!acc[r.campana]) acc[r.campana] = { campana:r.campana, plataforma:r.plataforma, inversion:0, impresiones:0, clics:0, resultados:0 }
    acc[r.campana].inversion += Number(r.inversion)
    acc[r.campana].impresiones += Number(r.impresiones)
    acc[r.campana].clics += Number(r.clics)
    acc[r.campana].resultados += Number(r.resultados)
    return acc
  }, {} as Record<string, { campana:string; plataforma:string; inversion:number; impresiones:number; clics:number; resultados:number }>)

  const campanas = Object.values(porCampana).map(c => {
    const cpaReal = c.resultados > 0 ? Math.round(c.inversion / c.resultados) : 0
    const ctr = c.impresiones > 0 ? Math.round(c.clics/c.impresiones*10000)/100 : 0
    const cpm = c.impresiones > 0 ? Math.round(c.inversion/c.impresiones*1000) : 0
    const cpc = c.clics > 0 ? Math.round(c.inversion/c.clics) : 0
    const prodMatch = productos.find(p => c.campana.toLowerCase().includes(p.nombre.toLowerCase()) || p.nombre.toLowerCase().includes(c.campana.toLowerCase()))
    const cpaMax = prodMatch?.cpa_maximo || 0
    const valorConversion = cpaMax > 0 ? c.resultados * cpaMax * 3 : c.resultados * cpaReal * 2.5
    const roas = c.inversion > 0 ? Math.round(valorConversion/c.inversion*100)/100 : 0
    return { ...c, cpaReal, ctr, cpm, cpc, cpaMax, roas, valorConversion, producto_id: prodMatch?.id }
  }).sort((a,b) => b.inversion - a.inversion)

  const totalInversion = filtrados.reduce((s,r) => s+Number(r.inversion), 0)
  const totalResultados = filtrados.reduce((s,r) => s+Number(r.resultados), 0)
  const totalImpresiones = filtrados.reduce((s,r) => s+Number(r.impresiones), 0)
  const totalClics = filtrados.reduce((s,r) => s+Number(r.clics), 0)
  const totalConversion = campanas.reduce((s,c) => s+c.valorConversion, 0)
  const cpaPromedio = totalResultados > 0 ? Math.round(totalInversion/totalResultados) : 0
  const roasPromedio = totalInversion > 0 ? Math.round(totalConversion/totalInversion*100)/100 : 0
  const ctrPromedio = totalImpresiones > 0 ? Math.round(totalClics/totalImpresiones*10000)/100 : 0

  const porDia = filtrados.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = { fecha:r.fecha, inversion:0, resultados:0 }
    acc[r.fecha].inversion += Number(r.inversion)
    acc[r.fecha].resultados += Number(r.resultados)
    return acc
  }, {} as Record<string, { fecha:string; inversion:number; resultados:number }>)
  const diaDia = Object.values(porDia).sort((a,b) => a.fecha.localeCompare(b.fecha)).slice(-14).map(d => ({
    ...d, cpa: d.resultados>0 ? Math.round(d.inversion/d.resultados) : 0,
  }))

  async function handleCSV(file: File) {
    setUploadMsg('Procesando archivo...')
    const texto = await file.text()
    const parsed = parsearCSVMeta(texto)
    if (parsed.length === 0) { setUploadMsg('❌ No se reconocieron columnas válidas en el CSV'); return }

    const { error } = await supabase.from('pauta').insert(
      parsed.map(p => ({
        tenant_id: tenantId, fecha: p.fecha, plataforma: uploadPlataforma,
        campana: p.campana, inversion: p.inversion, impresiones: p.impresiones,
        clics: p.clics, ctr: p.ctr, cpm: p.cpm, cpc: p.cpc,
        resultados: p.resultados, cpa: p.cpa, fuente: 'csv',
      }))
    )
    if (error) { setUploadMsg(`❌ Error: ${error.message}`); return }
    setUploadMsg(`✅ ${parsed.length} registros cargados correctamente`)
    await loadData()
  }

  async function enviarAlertaCPA(camp: typeof campanas[0]) {
    await supabase.from('alertas').insert({
      tenant_id: tenantId, tipo:'atencion', categoria:'operativa',
      titulo: `CPA excedido: ${camp.campana}`,
      mensaje: `CPA real de ${fmt(camp.cpaReal)} supera el máximo de ${fmt(camp.cpaMax)} para este producto. Esta campaña está comprando volumen a pérdida.`,
      accion: 'Pausar o ajustar segmentación/creativo de esta campaña',
      modulo:'Pauta', valor:`CPA: ${fmt(camp.cpaReal)}`, icono:'🟡',
    })
  }

  async function enviarOportunidad(camp: typeof campanas[0]) {
    await supabase.from('alertas').insert({
      tenant_id: tenantId, tipo:'oportunidad', categoria:'oportunidad',
      titulo: `Oportunidad de escalar: ${camp.campana}`,
      mensaje: `ROAS de ${camp.roas}x sostenido con ${camp.resultados} resultados. Producto con demanda comprobada — candidato a inversión adicional en pauta.`,
      accion: 'Revisar módulo Inversión → Etapa 3 para evaluar capital adicional',
      modulo:'Pauta', valor:`ROAS ${camp.roas}x`, icono:'🟢',
    })
  }

  async function guardarCpaMaximo(prodId: string, valor: number) {
    await supabase.from('productos').update({ cpa_maximo: valor }).eq('id', prodId)
    setProductos(prev => prev.map(p => p.id===prodId ? { ...p, cpa_maximo:valor } : p))
  }

  // Conexión real → Cuentas por Pagar (módulo P&G) — gasto pendiente con la plataforma de ads
  async function registrarPagoPendientePauta(plataforma: string, monto: number) {
    if (!tenantId || !monto) return
    const hoy = new Date()
    await supabase.from('cuentas_por_pagar').insert({
      tenant_id: tenantId, tercero: plataforma, tipo_tercero: 'proveedor',
      concepto: `Inversión en pauta — ${plataforma} (${MESES_ES?.[hoy.getMonth()] || ''})`,
      valor: monto, fecha_emision: hoy.toISOString().slice(0,10),
      fecha_vencimiento: new Date(hoy.getFullYear(), hoy.getMonth()+1, 5).toISOString().slice(0,10),
      estado: 'pendiente', categoria_flujo: 'operativo',
    })
    alert(`Registrado: ${fmt(monto)} pendiente de pago a ${plataforma} en módulo P&G → Cuentas por Pagar`)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Cargando datos de pauta...
    </div>
  )

  return (
    <div style={{ color:T.text, fontFamily:'system-ui,sans-serif' }}>

      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>📢 Pauta Meta & TikTok</h1>
        <p style={{ fontSize:'13px', color:T.muted }}>Datos reales desde Supabase · {registros.length} registros (últimos 30 días) · HACER</p>
      </div>

      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
        {(['TODAS','META','TIKTOK'] as const).map(p => (
          <button key={p} onClick={() => setPlataforma(p)}
            style={{ padding:'7px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: plataforma === p ? (p === 'META' ? '#1877F2' : p === 'TIKTOK' ? '#000' : T.accent) : 'rgba(255,255,255,0.05)',
              color: plataforma === p ? '#fff' : T.muted }}>
            {p === 'META' ? '🔵 Meta Ads' : p === 'TIKTOK' ? '⚫ TikTok Ads' : '📊 Todas'}
          </button>
        ))}
      </div>

      {registros.length === 0 && (
        <div style={{ ...s, padding:'30px', textAlign:'center', marginBottom:'16px', borderLeft:`3px solid ${T.accent}` }}>
          <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'8px' }}>Sin datos de pauta cargados aún</div>
          <div style={{ fontSize:'12px', color:T.muted }}>Ve a la pestaña &quot;Configurar&quot; para cargar tu primer CSV de Meta o TikTok Ads.</div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {[
          { label:'Inversión total', value:fmt(totalInversion), color:T.red, icon:'💸' },
          { label:'Resultados', value:totalResultados.toLocaleString(), color:T.green, icon:'🛒' },
          { label:'CPA promedio', value:fmt(cpaPromedio), color:semCPA(cpaPromedio,18000), icon:'🎯' },
          { label:'ROAS promedio', value:`${roasPromedio}x`, color:semROAS(roasPromedio), icon:'📈' },
          { label:'Impresiones', value:`${Math.round(totalImpresiones/1000)}K`, color:T.purple, icon:'👁️' },
          { label:'CTR promedio', value:`${ctrPromedio}%`, color:semCTR(ctrPromedio), icon:'📊' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'10px 12px', borderTop:`2px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
              <span style={{ fontSize:'10px', color:T.muted }}>{k.label}</span><span style={{ fontSize:'13px' }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:'16px', fontWeight:'800', color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { key:'resumen', label:'📊 Resumen' },
          { key:'campanas', label:'🎯 Por Campaña' },
          { key:'dia_dia', label:'📅 Día a Día' },
          { key:'carga', label:'⚙️ Configurar' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding:'8px 14px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              background: tab === t.key ? T.accent : 'rgba(255,255,255,0.05)', color: tab === t.key ? '#0A0D14' : T.muted }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'14px' }}>💸 INVERSIÓN POR CAMPAÑA</div>
            {campanas.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px', color:T.muted, fontSize:'12px' }}>Sin campañas en el rango seleccionado</div>
            ) : campanas.slice(0,8).map((c,i) => {
              const maxInv = campanas[0]?.inversion || 1
              return (
                <div key={i} style={{ marginBottom:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'12px', color:T.text }}>{c.campana}</span>
                    <span style={{ fontSize:'12px', fontWeight:'700', color:T.red }}>{fmt(c.inversion)}</span>
                  </div>
                  <div style={{ height:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'4px' }}>
                    <div style={{ height:'8px', width:`${(c.inversion/maxInv)*100}%`, borderRadius:'4px', background:semROAS(c.roas) }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'2px', fontSize:'10px', color:T.muted }}>
                    <span>ROAS: <span style={{ color:semROAS(c.roas), fontWeight:'700' }}>{c.roas}x</span></span>
                    <span>CPA: <span style={{ color:semCPA(c.cpaReal,c.cpaMax), fontWeight:'700' }}>{fmt(c.cpaReal)}{c.cpaMax>0?` / ${fmt(c.cpaMax)}`:''}</span></span>
                    <span>{c.resultados} resultados</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'12px' }}>🔬 EMBUDO DE CONVERSIÓN</div>
              {[
                { label:'Impresiones', value:totalImpresiones.toLocaleString('es-CO'), pct:100, color:T.text },
                { label:'Impresiones → Clics', value:`${totalClics.toLocaleString('es-CO')} clics`, pct:ctrPromedio, color:T.blue },
                { label:'Clics → Resultados', value:`${totalResultados} resultados`, pct: totalClics>0 ? Math.round(totalResultados/totalClics*1000)/10 : 0, color:T.purple },
                { label:'Valor generado', value:fmt(totalConversion), pct:roasPromedio, color:T.green, esROAS:true },
              ].map((row,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                  <div style={{ width:'130px', fontSize:'11px', color:T.muted, flexShrink:0 }}>{row.label}</div>
                  <div style={{ flex:1, height:'20px', background:'rgba(255,255,255,0.04)', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ height:'20px', width:`${Math.min(row.pct,100)}%`, background:row.color, borderRadius:'4px', display:'flex', alignItems:'center', paddingLeft:'6px' }}>
                      <span style={{ fontSize:'10px', color: i===0?'#0A0D14':'#fff', fontWeight:'700', whiteSpace:'nowrap' }}>
                        {row.esROAS ? `${row.pct}x ROAS` : `${row.pct}%`}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:row.color, width:'90px', textAlign:'right', flexShrink:0 }}>{row.value}</div>
                </div>
              ))}
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.red, marginBottom:'12px' }}>🚨 ALERTAS DE PAUTA</div>
              {campanas.filter(c => c.cpaMax > 0 && c.cpaReal > c.cpaMax).map((c,i) => (
                <div key={`exc-${i}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'7px', marginBottom:'5px', background:`${T.yellow}08`, borderLeft:`3px solid ${T.yellow}` }}>
                  <span style={{ fontSize:'12px', color:T.muted, flex:1 }}>⚠️ {c.campana}: CPA {fmt(c.cpaReal)} supera el máximo {fmt(c.cpaMax)}</span>
                  <button onClick={()=>enviarAlertaCPA(c)} style={{ fontSize:'10px', padding:'3px 8px', background:`${T.yellow}20`, border:`1px solid ${T.yellow}40`, borderRadius:'5px', color:T.yellow, cursor:'pointer' }}>Enviar</button>
                </div>
              ))}
              {campanas.filter(c => c.roas >= 3 && c.resultados >= 10).map((c,i) => (
                <div key={`opp-${i}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'7px', marginBottom:'5px', background:`${T.green}08`, borderLeft:`3px solid ${T.green}` }}>
                  <span style={{ fontSize:'12px', color:T.muted, flex:1 }}>✅ {c.campana}: ROAS {c.roas}x — candidato a escalar</span>
                  <button onClick={()=>enviarOportunidad(c)} style={{ fontSize:'10px', padding:'3px 8px', background:`${T.green}20`, border:`1px solid ${T.green}40`, borderRadius:'5px', color:T.green, cursor:'pointer' }}>Enviar</button>
                </div>
              ))}
              {campanas.length === 0 && <div style={{ fontSize:'12px', color:T.muted, textAlign:'center', padding:'10px' }}>Sin alertas — carga datos primero</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'campanas' && (
        <div style={{ ...s, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontWeight:'700' }}>🎯 Métricas por campaña — datos reales</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:T.card2, borderBottom:`1px solid ${T.border}` }}>
                  {['Campaña','Inversión','Impresiones','Clics','CTR','CPM','CPC','Resultados','CPA Real','ROAS','CPA Máx','Veredicto'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:'700', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campanas.map((c,i) => {
                  const ok = (c.cpaMax===0 || c.cpaReal <= c.cpaMax) && c.roas >= 2
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
                      <td style={{ padding:'10px 12px', fontWeight:'700' }}>{c.campana}</td>
                      <td style={{ padding:'10px 12px', color:T.red, fontWeight:'600' }}>{fmt(c.inversion)}</td>
                      <td style={{ padding:'10px 12px', color:T.muted }}>{Math.round(c.impresiones/1000)}K</td>
                      <td style={{ padding:'10px 12px', color:T.muted }}>{c.clics.toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', fontWeight:'700', color:semCTR(c.ctr) }}>{c.ctr}%</td>
                      <td style={{ padding:'10px 12px', color:T.muted }}>{fmt(c.cpm)}</td>
                      <td style={{ padding:'10px 12px', color:T.muted }}>{fmt(c.cpc)}</td>
                      <td style={{ padding:'10px 12px', fontWeight:'700', color:T.green }}>{c.resultados}</td>
                      <td style={{ padding:'10px 12px', fontWeight:'700', color:semCPA(c.cpaReal,c.cpaMax) }}>{fmt(c.cpaReal)}</td>
                      <td style={{ padding:'10px 12px', fontWeight:'800', fontSize:'14px', color:semROAS(c.roas) }}>{c.roas}x</td>
                      <td style={{ padding:'10px 12px', color:T.muted }}>{c.cpaMax>0 ? fmt(c.cpaMax) : '—'}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:'700', background: ok?`${T.green}15`:`${T.red}15`, color: ok?T.green:T.red }}>
                          {ok ? '✓ Escalar' : '✗ Revisar'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'dia_dia' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontWeight:'700' }}>📅 Evolución diaria (real, respeta filtro)</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:T.card2, borderBottom:`1px solid ${T.border}` }}>
                  {['Día','Inversión','Resultados','CPA'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:'700' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diaDia.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign:'center', padding:'30px', color:T.muted }}>Sin datos en el rango</td></tr>
                ) : diaDia.map((d,i) => (
                  <tr key={i} style={{ borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
                    <td style={{ padding:'9px 12px', color:T.muted }}>{d.fecha}</td>
                    <td style={{ padding:'9px 12px', color:T.red, fontWeight:'600' }}>{fmt(d.inversion)}</td>
                    <td style={{ padding:'9px 12px', color:T.green, fontWeight:'700' }}>{d.resultados}</td>
                    <td style={{ padding:'9px 12px', fontWeight:'700', color:semCPA(d.cpa,18000) }}>{fmt(d.cpa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>📈 CPA diario</div>
            {diaDia.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px', color:T.muted, fontSize:'12px' }}>Sin datos suficientes para graficar</div>
            ) : (
              <div style={{ display:'flex', alignItems:'flex-end', gap:'8px', height:'150px' }}>
                {diaDia.map((d,i) => {
                  const maxCpa = Math.max(...diaDia.map(x=>x.cpa), 1)
                  const pct = Math.min((d.cpa/maxCpa)*100, 100)
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%' }}>
                      <div style={{ flex:1, width:'100%', display:'flex', alignItems:'flex-end' }}>
                        <div style={{ width:'100%', height:`${pct}%`, borderRadius:'4px 4px 0 0', background:semCPA(d.cpa,18000), minHeight:'4px' }} />
                      </div>
                      <div style={{ fontSize:'8px', color:T.muted, marginTop:'4px' }}>{d.fecha.slice(5)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'carga' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px', gridColumn:'1 / -1' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.purple, marginBottom:'10px' }}>💳 REGISTRAR GASTO PENDIENTE DE PAUTA</div>
            <div style={{ fontSize:'11px', color:T.muted, marginBottom:'12px' }}>
              Si la inversión de este mes ({fmt(totalInversion)}) aún no se ha pagado a la plataforma, regístrala como cuenta por pagar en el módulo P&G.
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {['META','TIKTOK'].map(p => {
                const montoP = filtrados.filter(r=>r.plataforma===p).reduce((a,r)=>a+Number(r.inversion||0),0)
                if (montoP === 0) return null
                return (
                  <button key={p} onClick={() => registrarPagoPendientePauta(p === 'META' ? 'Meta Ads' : 'TikTok Ads', montoP)}
                    style={{ padding:'8px 16px', background:`${T.purple}15`, border:`1px solid ${T.purple}30`, borderRadius:'8px', color:T.purple, cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    Registrar {p === 'META' ? 'Meta' : 'TikTok'} — {fmt(montoP)}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'14px' }}>📤 CARGAR CSV REAL</div>
            <div style={{ fontSize:'12px', color:T.muted, marginBottom:'14px', lineHeight:'1.6' }}>
              Exporta tu reporte de Meta Ads (Ads Manager → Reportes → Exportar → CSV) o de TikTok Ads Manager.
            </div>
            <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
              {(['META','TIKTOK'] as const).map(p => (
                <button key={p} onClick={()=>setUploadPlataforma(p)}
                  style={{ flex:1, padding:'8px', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600',
                    border:`1px solid ${uploadPlataforma===p ? T.accent : T.border}`,
                    background: uploadPlataforma===p ? `${T.accent}15` : 'transparent', color: uploadPlataforma===p ? T.accent : T.muted }}>
                  {p === 'META' ? '🔵 Meta Ads' : '⚫ TikTok Ads'}
                </button>
              ))}
            </div>
            <label style={{ display:'block', padding:'24px', background:'rgba(255,255,255,0.02)', border:`2px dashed ${T.border}`, borderRadius:'10px', cursor:'pointer', textAlign:'center' }}>
              📁 Click para seleccionar archivo CSV
              <input type="file" accept=".csv" style={{ display:'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCSV(f) }} />
            </label>
            {uploadMsg && (
              <div style={{ marginTop:'12px', padding:'10px 14px', borderRadius:'8px', fontSize:'13px',
                background: uploadMsg.includes('✅') ? `${T.green}10` : uploadMsg.includes('❌') ? `${T.red}10` : `${T.blue}10`,
                color: uploadMsg.includes('✅') ? T.green : uploadMsg.includes('❌') ? T.red : T.blue }}>
                {uploadMsg}
              </div>
            )}
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'10px' }}>⚙️ CPA MÁXIMO POR PRODUCTO</div>
            <div style={{ fontSize:'11px', color:T.muted, marginBottom:'14px' }}>
              Calculado automáticamente desde el módulo Precio. Editable manualmente si lo necesitas.
            </div>
            {productos.length === 0 ? (
              <div style={{ fontSize:'12px', color:T.muted, textAlign:'center', padding:'20px' }}>Sin productos activos</div>
            ) : productos.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                <span style={{ flex:1, fontSize:'12px', color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</span>
                <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                  <span style={{ fontSize:'11px', color:T.muted }}>$</span>
                  <input type="number" defaultValue={p.cpa_maximo}
                    onBlur={e => guardarCpaMaximo(p.id, Number(e.target.value))}
                    style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'6px', color:T.text, padding:'5px 8px', fontSize:'12px', outline:'none', width:'100px', textAlign:'right' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
