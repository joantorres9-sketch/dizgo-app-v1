'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Registro = { fecha:string; campana:string; inversion:number; impresiones:number; clics:number; resultados:number }
type Pedido = { estado:string; producto_id:string; pvp:number; ganancia:number }
type Producto = { id:string; nombre:string; cpa_maximo:number; pvp_final:number }

const BENCHMARKS = {
  ctr: { min:0.8, bueno:1.5, excelente:2.5 },
  tasa_confirmacion: { min:50, bueno:65, excelente:80 },
  tasa_despacho: { min:70, bueno:80, excelente:90 },
  tasa_entrega: { min:65, bueno:78, excelente:88 },
  tasa_devolucion: { min:20, bueno:12, excelente:5, inv:true },
}
function diag(valor:number, bm:{min:number;bueno:number;excelente:number;inv?:boolean}) {
  if (bm.inv) {
    if (valor<=bm.excelente) return { color:'#2DD4A0', label:'Excelente', icono:'🟢' }
    if (valor<=bm.bueno) return { color:'#F5A623', label:'Bueno', icono:'🟡' }
    if (valor<=bm.min) return { color:'#F5A623', label:'Aceptable', icono:'🟠' }
    return { color:'#F05C5C', label:'Crítico', icono:'🔴' }
  }
  if (valor>=bm.excelente) return { color:'#2DD4A0', label:'Excelente', icono:'🟢' }
  if (valor>=bm.bueno) return { color:'#F5A623', label:'Bueno', icono:'🟡' }
  if (valor>=bm.min) return { color:'#F5A623', label:'Aceptable', icono:'🟠' }
  return { color:'#F05C5C', label:'Crítico', icono:'🔴' }
}
function fmt(n:number){ return n>=1000000?`$${(n/1000000).toFixed(1)}M`:`$${Math.round(n/1000)}K` }
const s:React.CSSProperties = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }

export default function EmbudoPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'embudo'|'diagnostico'|'simulador'|'mezcla'>('embudo')

  const [pautaRows, setPautaRows] = useState<Registro[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [productos, setProductos] = useState<Producto[]>([])

  const [simCTR, setSimCTR] = useState(0)
  const [simConf, setSimConf] = useState(0)
  const [simDespacho, setSimDespacho] = useState(0)
  const [simEntrega, setSimEntrega] = useState(0)
  const [simDev, setSimDev] = useState(0)
  const [inicializado, setInicializado] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id

    const hoy = new Date()
    const iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0,10)
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).toISOString().slice(0,10)

    const [{ data: pautaData }, { data: pedidosData }, { data: prodsData }] = await Promise.all([
      supabase.from('pauta').select('fecha, campana, inversion, impresiones, clics, resultados').eq('tenant_id', tid).gte('fecha', iniMes).lte('fecha', finMes),
      supabase.from('pedidos').select('estado, producto_id, pvp, ganancia').eq('tenant_id', tid).gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes+'T23:59:59'),
      supabase.from('productos').select('id, nombre, cpa_maximo, pvp_final').eq('tenant_id', tid).eq('tipo','producto').eq('estado','activo'),
    ])

    setPautaRows((pautaData||[]) as Registro[])
    setPedidos((pedidosData||[]) as Pedido[])
    setProductos((prodsData||[]) as Producto[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── EMBUDO REAL — desde pauta + pedidos, sin datos fijos ──────
  const totalInversion = pautaRows.reduce((a,r)=>a+Number(r.inversion||0),0)
  const totalImpresiones = pautaRows.reduce((a,r)=>a+Number(r.impresiones||0),0)
  const totalClics = pautaRows.reduce((a,r)=>a+Number(r.clics||0),0)
  const totalResultadosPauta = pautaRows.reduce((a,r)=>a+Number(r.resultados||0),0)
  const ctrReal = totalImpresiones>0 ? Math.round(totalClics/totalImpresiones*10000)/100 : 0
  const cpmReal = totalImpresiones>0 ? Math.round(totalInversion/totalImpresiones*1000) : 0

  const enFlujo = ['CONFIRMADO','confirmado','DESPACHADO','despachado','EN_TRANSITO','en_transito','ENTREGADO','entregado','NOVEDAD','novedad','DEVOLUCION','devolucion']
  const confirmados = pedidos.filter(p=>enFlujo.includes(p.estado))
  const despachados = pedidos.filter(p=>['DESPACHADO','despachado','EN_TRANSITO','en_transito','ENTREGADO','entregado','NOVEDAD','novedad','DEVOLUCION','devolucion'].includes(p.estado))
  const entregados = pedidos.filter(p=>['ENTREGADO','entregado'].includes(p.estado))
  const devueltos = pedidos.filter(p=>['DEVOLUCION','devolucion'].includes(p.estado))

  const tasaConfirmacion = pedidos.length>0 ? Math.round(confirmados.length/pedidos.length*100) : 0
  const tasaDespacho = confirmados.length>0 ? Math.round(despachados.length/confirmados.length*100) : 0
  const tasaEntrega = despachados.length>0 ? Math.round(entregados.length/despachados.length*100) : 0
  const tasaDevolucion = (entregados.length+devueltos.length)>0 ? Math.round(devueltos.length/(entregados.length+devueltos.length)*100) : 0

  // ── MEZCLA REAL DE PRODUCTOS — el corazón del pedido del usuario ──
  const porProducto = pedidos.filter(p=>p.producto_id).reduce((acc,p) => {
    if (!acc[p.producto_id]) acc[p.producto_id] = { unidades:0, ganancia:0, pvp:0 }
    acc[p.producto_id].unidades++
    if (['ENTREGADO','entregado'].includes(p.estado)) { acc[p.producto_id].ganancia += Number(p.ganancia||0); acc[p.producto_id].pvp += Number(p.pvp||0) }
    return acc
  }, {} as Record<string,{unidades:number; ganancia:number; pvp:number}>)

  const mezcla = Object.entries(porProducto).map(([id, d]) => {
    const prod = productos.find(x=>x.id===id)
    return { id, nombre: prod?.nombre || 'Producto', unidades: d.unidades, ganancia: d.ganancia, pvp: d.pvp, cpaMax: prod?.cpa_maximo || 0 }
  }).sort((a,b) => b.unidades-a.unidades)

  const totalUnidadesEntregadas = entregados.length
  // Ganancia ponderada real por la mezcla — esto reemplaza el "$8.940 fijo" del código original
  const gananciaPonderada = totalUnidadesEntregadas>0
    ? Math.round(entregados.reduce((a,p)=>a+Number(p.ganancia||0),0) / totalUnidadesEntregadas)
    : (mezcla.length>0 ? Math.round(mezcla.reduce((a,m)=>a+m.ganancia,0)/Math.max(mezcla.reduce((a,m)=>a+m.unidades,0),1)) : 0)

  const cpaPromedioPonderado = mezcla.length>0 && mezcla.some(m=>m.cpaMax>0)
    ? Math.round(mezcla.filter(m=>m.cpaMax>0).reduce((a,m)=>a+m.cpaMax*m.unidades,0) / mezcla.filter(m=>m.cpaMax>0).reduce((a,m)=>a+m.unidades,0))
    : 18000 // fallback solo si no hay ningún CPA configurado en Precio

  const cpaReal = totalResultadosPauta>0 ? Math.round(totalInversion/totalResultadosPauta) : 0
  const cpaEntregado = entregados.length>0 ? Math.round(totalInversion/entregados.length) : 0
  const conversionGlobal = totalImpresiones>0 ? Math.round(entregados.length/totalImpresiones*100000)/1000 : 0

  // PVP ponderado real de la mezcla — para valorar etapas pre-entrega en $
  const pvpPonderado = totalUnidadesEntregadas>0
    ? Math.round(entregados.reduce((a,p)=>a+Number(p.pvp||0),0) / totalUnidadesEntregadas)
    : (mezcla.length>0 ? Math.round(mezcla.reduce((a,m)=>a+m.pvp,0)/Math.max(mezcla.reduce((a,m)=>a+m.unidades,0),1)) : 0)

  const ETAPAS = [
    { label:'Impresiones', valor:totalImpresiones, color:'#5A6478', icon:'👁️', dinero:totalInversion, esInversion:true },
    { label:'Clics (CTR)', valor:totalClics, color:'#3D8EF0', icon:'🖱️', dinero:totalInversion, esInversion:true },
    { label:'Pedidos generados', valor:pedidos.length, color:'#9B6BFF', icon:'🛒', dinero:pedidos.length*pvpPonderado, esInversion:false },
    { label:'Confirmados', valor:confirmados.length, color:'#F5A623', icon:'📞', dinero:confirmados.length*pvpPonderado, esInversion:false },
    { label:'Despachados', valor:despachados.length, color:'#3D8EF0', icon:'📦', dinero:despachados.length*pvpPonderado, esInversion:false },
    { label:'Entregados', valor:entregados.length, color:'#2DD4A0', icon:'✅', dinero:entregados.length*gananciaPonderada, esInversion:false, esGanancia:true },
    { label:'Devueltos', valor:devueltos.length, color:'#F05C5C', icon:'🔄', dinero:devueltos.length*pvpPonderado, esInversion:false },
  ]

  // Inicializar sliders del simulador con valores reales (solo una vez al cargar)
  useEffect(() => {
    if (!loading && !inicializado && pedidos.length > 0) {
      setSimCTR(ctrReal||1); setSimConf(tasaConfirmacion||50); setSimDespacho(tasaDespacho||70)
      setSimEntrega(tasaEntrega||65); setSimDev(tasaDevolucion||15)
      setInicializado(true)
    }
  }, [loading, inicializado, pedidos.length, ctrReal, tasaConfirmacion, tasaDespacho, tasaEntrega, tasaDevolucion])

  const sim_clics = Math.round(totalImpresiones*simCTR/100)
  const sim_confirmados = Math.round(pedidos.length*simConf/100)
  const sim_despachados = Math.round(sim_confirmados*simDespacho/100)
  const sim_entregados = Math.round(sim_despachados*simEntrega/100)
  const sim_devueltos = Math.round(sim_entregados*simDev/100)
  const sim_entregados_netos = sim_entregados-sim_devueltos
  const sim_ganancia = sim_entregados_netos*gananciaPonderada
  const ganancia_actual = entregados.length*gananciaPonderada
  const mejora_ganancia = sim_ganancia-ganancia_actual

  const sld = (val:number, set:(v:number)=>void, min:number, max:number, step=0.1) => (
    <input type="range" min={min} max={max} step={step} value={val} onChange={e=>set(Number(e.target.value))}
      style={{ width:'100%', accentColor:'#F5A623', margin:'4px 0' }} />
  )

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Calculando embudo real del mes...
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🔬 Embudo de Tráfico</h1>
        <p style={{ fontSize:'13px', color:'#8B96A8' }}>Pauta real → Confirmación → Despacho → Entrega · Ponderado por mezcla de productos · VERIFICAR</p>
      </div>

      {pedidos.length === 0 && (
        <div style={{ ...s, padding:'30px', textAlign:'center', marginBottom:'16px', borderLeft:'3px solid #F5A623' }}>
          <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'6px' }}>Sin pedidos este mes</div>
          <div style={{ fontSize:'12px', color:'#8B96A8' }}>El embudo se construye automáticamente desde Pauta y Pedidos reales.</div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'6px', marginBottom:'16px' }}>
        {[
          { label:'Impresiones', value:(totalImpresiones/1000).toFixed(0)+'K', color:'#5A6478', icon:'👁️' },
          { label:'Clics', value:(totalClics/1000).toFixed(1)+'K', color:'#3D8EF0', icon:'🖱️' },
          { label:'CTR real', value:`${ctrReal}%`, color:diag(ctrReal,BENCHMARKS.ctr).color, icon:'📊' },
          { label:'Pedidos', value:pedidos.length.toLocaleString(), color:'#9B6BFF', icon:'🛒' },
          { label:'Confirmados', value:confirmados.length.toLocaleString(), color:'#F5A623', icon:'📞' },
          { label:'Entregados', value:entregados.length.toLocaleString(), color:'#2DD4A0', icon:'✅' },
          { label:'Conv. total', value:`${conversionGlobal}%`, color:'#2DD4A0', icon:'🎯' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'10px', borderTop:`2px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
              <span style={{ fontSize:'9px', color:'#8B96A8' }}>{k.label}</span><span style={{ fontSize:'12px' }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:'16px', fontWeight:'800', color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { key:'embudo', label:'🔬 Embudo visual' },
          { key:'diagnostico', label:'🚨 Diagnóstico' },
          { key:'simulador', label:'⚡ Simulador' },
          { key:'mezcla', label:'🔀 Mezcla de productos' },
        ].map(t => (
          <button key={t.key} onClick={()=>setTab(t.key as typeof tab)}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: tab===t.key?'#F5A623':'rgba(255,255,255,0.05)', color: tab===t.key?'#0A0D14':'#8B96A8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'embudo' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'16px' }}>🔬 EMBUDO COMPLETO — datos reales del mes</div>
            {ETAPAS.map((e,i) => {
              const anchoPct = totalImpresiones>0 ? Math.max((e.valor/totalImpresiones)*100,3) : 3
              const perdida = i>0 ? ETAPAS[i-1].valor-e.valor : 0
              const perdidaDinero = i>0 && !e.esInversion ? perdida*pvpPonderado : 0
              const pctEtapa = i>0 && ETAPAS[i-1].valor>0 ? Math.round(e.valor/ETAPAS[i-1].valor*100) : 100
              return (
                <div key={i} style={{ marginBottom:'6px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ fontSize:'14px' }}>{e.icon}</span>
                      <span style={{ fontSize:'12px', color:'#8B96A8' }}>{e.label}</span>
                      {i>0 && <span style={{ fontSize:'10px', color:e.color, fontWeight:'700' }}>{pctEtapa}%</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      {i>0 && perdidaDinero>0 && <span style={{ fontSize:'10px', color:'#F05C5C' }}>-{perdida.toLocaleString('es-CO')} ({fmt(perdidaDinero)})</span>}
                      <span style={{ fontSize:'13px', fontWeight:'800', color:e.color }}>{e.valor.toLocaleString('es-CO')}</span>
                      <span style={{ fontSize:'11px', fontWeight:'700', color: e.esGanancia?'#2DD4A0':e.esInversion?'#F05C5C':'#5A6478', minWidth:'52px', textAlign:'right' }}>
                        {e.esInversion?'-':''}{fmt(e.dinero)}
                      </span>
                    </div>
                  </div>
                  <div style={{ height:'24px', background:'rgba(255,255,255,0.04)', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ height:'24px', width:`${anchoPct}%`, background:`${e.color}30`, borderRadius:'4px' }} />
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop:'14px', padding:'12px 14px', background:'rgba(45,212,160,0.06)', borderRadius:'10px', border:'1px solid rgba(45,212,160,0.15)', display:'flex', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:'12px', color:'#8B96A8' }}>Conversión global</div>
                <div style={{ fontSize:'11px', color:'#5A6478' }}>Impresiones → Entrega efectiva</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'22px', fontWeight:'800', color:'#2DD4A0' }}>{conversionGlobal}%</div>
                {entregados.length>0 && <div style={{ fontSize:'11px', color:'#5A6478' }}>1 entrega cada {Math.round(totalImpresiones/entregados.length).toLocaleString()} impresiones</div>}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', marginBottom:'14px' }}>💰 CPA REAL — ponderado por mezcla</div>
              {[
                { label:'CPA promedio pauta', v:cpaReal, color:'#3D8EF0' },
                { label:'CPA por entregado', v:cpaEntregado, color:'#2DD4A0' },
                { label:'CPA máximo (mezcla, desde Precio)', v:cpaPromedioPonderado, color:'#9B6BFF' },
              ].map((k,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', marginBottom:'6px', background:`${k.color}08`, borderLeft:`3px solid ${k.color}` }}>
                  <div style={{ flex:1, fontSize:'12px', color:'#E8EDF5' }}>{k.label}</div>
                  <div style={{ fontSize:'16px', fontWeight:'800', color:k.color }}>${k.v.toLocaleString('es-CO')}</div>
                </div>
              ))}
              <div style={{ marginTop:'10px', padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'8px', fontSize:'11px', color:'#8B96A8' }}>
                💡 CPA por entregado <strong style={{ color: cpaEntregado<=cpaPromedioPonderado?'#2DD4A0':'#F05C5C' }}>{cpaEntregado<=cpaPromedioPonderado?'✅ dentro':'❌ excede'}</strong> el máximo configurado en Precio para tu mezcla actual.
              </div>
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#F05C5C', marginBottom:'12px' }}>📉 PEDIDOS PERDIDOS POR ETAPA — impacto real en $</div>
              {[
                { etapa:'Generado → Confirmación', perdidos:pedidos.length-confirmados.length, pct:100-tasaConfirmacion, color:'#F5A623' },
                { etapa:'Confirmación → Despacho', perdidos:confirmados.length-despachados.length, pct:100-tasaDespacho, color:'#9B6BFF' },
                { etapa:'Despacho → Entrega', perdidos:despachados.length-entregados.length, pct:100-tasaEntrega, color:'#F05C5C' },
                { etapa:'Devueltos', perdidos:devueltos.length, pct:tasaDevolucion, color:'#F05C5C' },
              ].map((p,i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:'7px', marginBottom:'6px', background:`${p.color}06` }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'11px', fontWeight:'700', color:p.color }}>{p.etapa}</span>
                    <div style={{ display:'flex', gap:'8px', alignItems:'baseline' }}>
                      <span style={{ fontSize:'12px', fontWeight:'800', color:p.color }}>-{p.perdidos.toLocaleString()} ({p.pct}%)</span>
                      <span style={{ fontSize:'12px', fontWeight:'800', color:'#F05C5C' }}>{fmt(p.perdidos*pvpPonderado)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:'10px', padding:'10px 12px', background:'rgba(240,92,92,0.08)', borderRadius:'8px', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'12px', fontWeight:'700', color:'#F05C5C' }}>TOTAL DINERO PERDIDO EN EL EMBUDO</span>
                <span style={{ fontSize:'15px', fontWeight:'900', color:'#F05C5C' }}>{fmt((pedidos.length-entregados.length)*pvpPonderado)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'diagnostico' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'14px' }}>🔍 DIAGNÓSTICO POR INDICADOR — con impacto en $</div>
            {[
              { metrica:'CTR', valor:ctrReal, bm:BENCHMARKS.ctr, unidad:'%', buena:'Creativos funcionando bien', mala:'Cambiar creative, hook o copy', impacto:0 },
              { metrica:'% Confirmación', valor:tasaConfirmacion, bm:BENCHMARKS.tasa_confirmacion, unidad:'%', buena:'Buen proceso de ventas', mala:'Activar WhatsApp inmediato — máximo 2h',
                impacto: Math.max(BENCHMARKS.tasa_confirmacion.bueno-tasaConfirmacion,0)/100*pedidos.length*tasaDespacho/100*tasaEntrega/100*gananciaPonderada },
              { metrica:'% Despacho', valor:tasaDespacho, bm:BENCHMARKS.tasa_despacho, unidad:'%', buena:'Despacho eficiente', mala:'Revisar inventario antes de despachar',
                impacto: Math.max(BENCHMARKS.tasa_despacho.bueno-tasaDespacho,0)/100*confirmados.length*tasaEntrega/100*gananciaPonderada },
              { metrica:'% Entrega', valor:tasaEntrega, bm:BENCHMARKS.tasa_entrega, unidad:'%', buena:'Transportadora eficiente', mala:'Gestionar novedades en primeras 24h',
                impacto: Math.max(BENCHMARKS.tasa_entrega.bueno-tasaEntrega,0)/100*despachados.length*gananciaPonderada },
              { metrica:'% Devolución', valor:tasaDevolucion, bm:BENCHMARKS.tasa_devolucion, unidad:'%', buena:'Cliente satisfecho', mala:'Revisar calidad de producto y descripción',
                impacto: Math.max(tasaDevolucion-BENCHMARKS.tasa_devolucion.bueno,0)/100*entregados.length*gananciaPonderada },
            ].map((d,i) => {
              const dg = diag(d.valor, d.bm)
              return (
                <div key={i} style={{ padding:'12px 14px', borderRadius:'10px', marginBottom:'8px', background:`${dg.color}06`, borderLeft:`3px solid ${dg.color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontSize:'16px' }}>{dg.icono}</span>
                      <span style={{ fontSize:'13px', fontWeight:'700' }}>{d.metrica}</span>
                      <span style={{ fontSize:'11px', fontWeight:'800', color:dg.color }}>[{dg.label}]</span>
                    </div>
                    <span style={{ fontSize:'16px', fontWeight:'800', color:dg.color }}>{d.valor}{d.unidad}</span>
                  </div>
                  <div style={{ fontSize:'11px', color:dg.color, marginBottom: d.impacto>0?'4px':'0' }}>→ {dg.color==='#2DD4A0'?d.buena:d.mala}</div>
                  {d.impacto>0 && (
                    <div style={{ fontSize:'11px', fontWeight:'700', color:'#2DD4A0' }}>💰 Si llega a &quot;Bueno&quot;: +{fmt(d.impacto)}/mes</div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'14px' }}>📊 SCORE GLOBAL DEL EMBUDO</div>
            {(() => {
              const scores = [diag(ctrReal,BENCHMARKS.ctr), diag(tasaConfirmacion,BENCHMARKS.tasa_confirmacion), diag(tasaDespacho,BENCHMARKS.tasa_despacho), diag(tasaEntrega,BENCHMARKS.tasa_entrega), diag(tasaDevolucion,BENCHMARKS.tasa_devolucion)]
              const verdes = scores.filter(x=>x.color==='#2DD4A0').length
              const amarillos = scores.filter(x=>x.color==='#F5A623').length
              const rojos = scores.filter(x=>x.color==='#F05C5C').length
              const score = Math.round((verdes*100+amarillos*60+rojos*20)/scores.length)
              const scoreColor = score>=75?'#2DD4A0':score>=50?'#F5A623':'#F05C5C'
              const oportunidadTotal =
                Math.max(BENCHMARKS.tasa_confirmacion.bueno-tasaConfirmacion,0)/100*pedidos.length*tasaDespacho/100*tasaEntrega/100*gananciaPonderada +
                Math.max(BENCHMARKS.tasa_despacho.bueno-tasaDespacho,0)/100*confirmados.length*tasaEntrega/100*gananciaPonderada +
                Math.max(BENCHMARKS.tasa_entrega.bueno-tasaEntrega,0)/100*despachados.length*gananciaPonderada +
                Math.max(tasaDevolucion-BENCHMARKS.tasa_devolucion.bueno,0)/100*entregados.length*gananciaPonderada
              return (
                <>
                  <div style={{ textAlign:'center', marginBottom:'16px' }}>
                    <div style={{ fontSize:'52px', fontWeight:'900', color:scoreColor }}>{score}</div>
                    <div style={{ fontSize:'13px', color:'#8B96A8' }}>Score del embudo /100</div>
                  </div>
                  <div style={{ display:'flex', gap:'10px', justifyContent:'center', marginBottom:'14px' }}>
                    {[{n:verdes,l:'Bueno',c:'#2DD4A0'},{n:amarillos,l:'Aceptable',c:'#F5A623'},{n:rojos,l:'Crítico',c:'#F05C5C'}].map((x,i) => (
                      <div key={i} style={{ textAlign:'center', padding:'8px 12px', background:`${x.c}10`, borderRadius:'8px' }}>
                        <div style={{ fontSize:'20px', fontWeight:'800', color:x.c }}>{x.n}</div>
                        <div style={{ fontSize:'10px', color:'#5A6478' }}>{x.l}</div>
                      </div>
                    ))}
                  </div>
                  {oportunidadTotal>0 && (
                    <div style={{ padding:'14px', background:'rgba(45,212,160,0.08)', borderRadius:'10px', border:'1px solid rgba(45,212,160,0.2)', textAlign:'center' }}>
                      <div style={{ fontSize:'11px', color:'#8B96A8', marginBottom:'4px' }}>Oportunidad total si optimizas todo a &quot;Bueno&quot;</div>
                      <div style={{ fontSize:'22px', fontWeight:'900', color:'#2DD4A0' }}>+{fmt(oportunidadTotal)}/mes</div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {tab === 'simulador' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'6px' }}>⚡ SIMULADOR — basado en ganancia ponderada real</div>
            <div style={{ fontSize:'11px', color:'#8B96A8', marginBottom:'16px' }}>Ganancia ponderada actual: <strong style={{ color:'#2DD4A0' }}>${gananciaPonderada.toLocaleString('es-CO')}</strong>/pedido (mezcla real)</div>
            {[
              { label:'CTR', val:simCTR, set:setSimCTR, min:0.5, max:5, step:0.1, unidad:'%' },
              { label:'% Confirmación', val:simConf, set:setSimConf, min:30, max:95, step:1, unidad:'%' },
              { label:'% Despacho', val:simDespacho, set:setSimDespacho, min:50, max:98, step:1, unidad:'%' },
              { label:'% Entrega', val:simEntrega, set:setSimEntrega, min:50, max:98, step:1, unidad:'%' },
              { label:'% Devolución', val:simDev, set:setSimDev, min:1, max:30, step:1, unidad:'%' },
            ].map((sl,i) => (
              <div key={i} style={{ marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                  <span style={{ fontSize:'12px', color:'#8B96A8' }}>{sl.label}</span>
                  <span style={{ fontSize:'13px', fontWeight:'800', color:'#F5A623' }}>{sl.val.toFixed(1)}{sl.unidad}</span>
                </div>
                {sld(sl.val, sl.set, sl.min, sl.max, sl.step)}
              </div>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'14px' }}>📊 RESULTADO SIMULACIÓN</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', marginBottom:'14px' }}>
                {[
                  { label:'Clics', actual:totalClics, sim:sim_clics, dinero:0 },
                  { label:'Confirmados', actual:confirmados.length, sim:sim_confirmados, dinero:sim_confirmados*pvpPonderado },
                  { label:'Despachados', actual:despachados.length, sim:sim_despachados, dinero:sim_despachados*pvpPonderado },
                  { label:'Entregados netos', actual:entregados.length-devueltos.length, sim:sim_entregados_netos, dinero:sim_entregados_netos*gananciaPonderada },
                ].map((k,i) => {
                  const d = k.sim-k.actual
                  return (
                    <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:'8px', padding:'10px 12px' }}>
                      <div style={{ fontSize:'10px', color:'#5A6478' }}>{k.label}</div>
                      <div style={{ fontSize:'16px', fontWeight:'800', color:'#E8EDF5' }}>{k.sim.toLocaleString()} <span style={{ fontSize:'11px', color: d>=0?'#2DD4A0':'#F05C5C' }}>{d>=0?'+':''}{d}</span></div>
                      {k.dinero>0 && <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B6BFF', marginTop:'2px' }}>{fmt(k.dinero)}</div>}
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'14px', background: mejora_ganancia>=0?'rgba(45,212,160,0.08)':'rgba(240,92,92,0.08)', borderRadius:'10px' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'#8B96A8' }}>Diferencia mensual proyectada</div>
                  <div style={{ fontSize:'22px', fontWeight:'900', color: mejora_ganancia>=0?'#2DD4A0':'#F05C5C' }}>{mejora_ganancia>=0?'+':''}{fmt(mejora_ganancia)}</div>
                  <div style={{ fontSize:'11px', color:'#5A6478' }}>= {fmt(mejora_ganancia*12)} al año</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'mezcla' && (
        <div style={{ ...s, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>🔀 Mezcla real de productos vendidos este mes</div>
          {mezcla.length === 0 ? (
            <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin productos vendidos este mes</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:'#0A0D14', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Producto','Unidades','% del mix','Ganancia total','CPA máx (Precio)'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:'#5A6478', fontWeight:'700' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mezcla.map((m,i) => {
                  const totalU = mezcla.reduce((a,x)=>a+x.unidades,0)
                  const pct = totalU>0 ? Math.round(m.unidades/totalU*100) : 0
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding:'10px 12px', fontWeight:'600' }}>{m.nombre}</td>
                      <td style={{ padding:'10px 12px', color:'#8B96A8' }}>{m.unidades}</td>
                      <td style={{ padding:'10px 12px', color:'#3D8EF0', fontWeight:'700' }}>{pct}%</td>
                      <td style={{ padding:'10px 12px', color:'#2DD4A0', fontWeight:'700' }}>${m.ganancia.toLocaleString('es-CO')}</td>
                      <td style={{ padding:'10px 12px', color:'#9B6BFF' }}>{m.cpaMax>0?`$${m.cpaMax.toLocaleString('es-CO')}`:'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div style={{ padding:'14px 16px', fontSize:'11px', color:'#5A6478', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            💡 Esta mezcla es la que define la ganancia ponderada real (${gananciaPonderada.toLocaleString('es-CO')}/pedido) usada en el embudo y el simulador — igual que en el módulo Equilibrio.
          </div>
        </div>
      )}
    </div>
  )
}
