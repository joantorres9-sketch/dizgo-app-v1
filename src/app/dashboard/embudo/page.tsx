'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RequierePermiso } from '@/components/RequierePermiso'
import { usePermisos, logAccion } from '@/lib/permisos'
import { clavePermiso } from '@/lib/modulos'
import { useTema } from '@/lib/tema'
import { parsearArchivo, type FilaImportada } from '@/lib/plantillasExcel'
import { configPedidosDropi, type FilaPedidoDropi, configPedidosShopify, type FilaPedidoShopify } from '@/lib/plantillasConfig'
import { agruparPedidosShopify, agruparPedidosDropi, cruzarShopifyDropi, compararConMeta, parsearCSVMeta, rangoSolapado, dentroDeRango, type PedidoNormalizado } from '@/lib/reconciliacion'

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
function fmt(n:number){ return n>=1000000?`$${(n/1000000).toFixed(1)}M`:`$${Math.round(n/1000)}K` }

export default function EmbudoPage() {
  const { T } = useTema()
  function diag(valor:number, bm:{min:number;bueno:number;excelente:number;inv?:boolean}) {
    if (bm.inv) {
      if (valor<=bm.excelente) return { color:T.green, label:'Excelente', icono:'🟢' }
      if (valor<=bm.bueno) return { color:T.yellow, label:'Bueno', icono:'🟡' }
      if (valor<=bm.min) return { color:T.yellow, label:'Aceptable', icono:'🟠' }
      return { color:T.red, label:'Crítico', icono:'🔴' }
    }
    if (valor>=bm.excelente) return { color:T.green, label:'Excelente', icono:'🟢' }
    if (valor>=bm.bueno) return { color:T.yellow, label:'Bueno', icono:'🟡' }
    if (valor>=bm.min) return { color:T.yellow, label:'Aceptable', icono:'🟠' }
    return { color:T.red, label:'Crítico', icono:'🔴' }
  }
  const s:React.CSSProperties = { background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px' }
  const supabase = createClient()
  const { puede, perfil, cargando: cargandoPermisos } = usePermisos()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'embudo'|'diagnostico'|'reconciliacion'|'simulador'|'mezcla'>('embudo')

  // ── Reconciliación Meta→Shopify→Dropi — todo corre client-side sobre los 3 archivos que se
  // suben en el momento, sin persistencia (análisis bajo demanda, igual que Precio & Costeo). ──
  const [rcMetaResultados, setRcMetaResultados] = useState<number | null>(null)
  const [rcShopify, setRcShopify] = useState<PedidoNormalizado[] | null>(null)
  const [rcDropi, setRcDropi] = useState<PedidoNormalizado[] | null>(null)
  const [rcMsg, setRcMsg] = useState<{ meta?: string; shopify?: string; dropi?: string }>({})
  const [rcProcesando, setRcProcesando] = useState<{ meta?: boolean; shopify?: boolean; dropi?: boolean }>({})

  async function rcSubirMeta(file: File) {
    setRcProcesando(p => ({ ...p, meta: true })); setRcMsg(m => ({ ...m, meta: undefined }))
    try {
      const texto = await file.text()
      const filas = parsearCSVMeta(texto)
      const total = filas.reduce((a, r) => a + Number(r.resultados || 0), 0)
      setRcMetaResultados(total)
      setRcMsg(m => ({ ...m, meta: `✅ ${filas.length} filas · ${total.toLocaleString('es-CO')} resultados reportados` }))
    } catch (e) { setRcMsg(m => ({ ...m, meta: `❌ ${e instanceof Error ? e.message : 'No se pudo leer el archivo'}` })) }
    finally { setRcProcesando(p => ({ ...p, meta: false })) }
  }
  async function rcSubirShopify(file: File) {
    setRcProcesando(p => ({ ...p, shopify: true })); setRcMsg(m => ({ ...m, shopify: undefined }))
    try {
      const filas = await parsearArchivo<FilaPedidoShopify>(file, configPedidosShopify)
      const pedidos = agruparPedidosShopify(filas)
      setRcShopify(pedidos)
      setRcMsg(m => ({ ...m, shopify: `✅ ${pedidos.length} pedidos detectados` }))
    } catch (e) { setRcMsg(m => ({ ...m, shopify: `❌ ${e instanceof Error ? e.message : 'No se pudo leer el archivo'}` })) }
    finally { setRcProcesando(p => ({ ...p, shopify: false })) }
  }
  async function rcSubirDropi(file: File) {
    setRcProcesando(p => ({ ...p, dropi: true })); setRcMsg(m => ({ ...m, dropi: undefined }))
    try {
      const filas = await parsearArchivo<FilaPedidoDropi>(file, configPedidosDropi)
      const pedidos = agruparPedidosDropi(filas)
      setRcDropi(pedidos)
      setRcMsg(m => ({ ...m, dropi: `✅ ${pedidos.length} pedidos detectados` }))
    } catch (e) { setRcMsg(m => ({ ...m, dropi: `❌ ${e instanceof Error ? e.message : 'No se pudo leer el archivo'}` })) }
    finally { setRcProcesando(p => ({ ...p, dropi: false })) }
  }

  const rcCruce = rcShopify && rcDropi ? cruzarShopifyDropi(rcShopify, rcDropi) : null
  const rcGapMeta = rcMetaResultados !== null && rcShopify ? compararConMeta(rcMetaResultados, rcShopify.length) : null
  // Fuga real solo dentro del rango de fechas que AMBOS archivos cubren -- si Dropi solo llega
  // hasta cierta fecha y Shopify tiene historial más largo, comparar contra el total de Shopify
  // infla la fuga con pedidos que simplemente todavía no le tocaba aparecer en Dropi (verificado
  // con datos reales: bajó de 79% a 17% al acotar al rango real).
  const rcRango = rcShopify && rcDropi ? rangoSolapado(rcShopify, rcDropi) : null
  const rcShopifyEnRango = rcShopify ? rcShopify.filter(p => dentroDeRango(p.fecha, rcRango)) : []
  const rcSinMatchEnRango = rcCruce ? rcCruce.sinMatch.filter(p => dentroDeRango(p.fecha, rcRango)) : []
  const rcSinMatchFueraDeRango = rcCruce ? rcCruce.sinMatch.length - rcSinMatchEnRango.length : 0
  const rcPctFugaReal = rcShopifyEnRango.length > 0 ? Math.round(rcSinMatchEnRango.length / rcShopifyEnRango.length * 100) : 0

  async function rcExportarPerdidos() {
    if (!rcCruce || rcCruce.sinMatch.length === 0) return
    logAccion(clavePermiso('embudo', 'reconciliacion'), 'descargar')
    const XLSX = await import('xlsx')
    const filas = rcCruce.sinMatch.map(p => ({
      'Orden Shopify': p.ordenId, Cliente: p.nombre, Teléfono: p.telefono,
      Fecha: p.fecha, Producto: p.producto, Valor: p.valor,
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 32 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos perdidos')
    XLSX.writeFile(wb, `pedidos_perdidos_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const [pautaRows, setPautaRows] = useState<Registro[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [productos, setProductos] = useState<Producto[]>([])

  const [simCTR, setSimCTR] = useState(0)
  const [simConf, setSimConf] = useState(0)
  const [simDespacho, setSimDespacho] = useState(0)
  const [simEntrega, setSimEntrega] = useState(0)
  const [simDev, setSimDev] = useState(0)
  const [inicializado, setInicializado] = useState(false)

  const loadData = useCallback(async (tid: string) => {
    setLoading(true)
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

  useEffect(() => {
    if (cargandoPermisos) return
    if (!perfil?.tenantId) { setLoading(false); return }
    loadData(perfil.tenantId)
  }, [cargandoPermisos, perfil, loadData])

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
    { label:'Impresiones', valor:totalImpresiones, color:T.muted, icon:'👁️', dinero:totalInversion, esInversion:true },
    { label:'Clics (CTR)', valor:totalClics, color:T.blue, icon:'🖱️', dinero:totalInversion, esInversion:true },
    { label:'Pedidos generados', valor:pedidos.length, color:T.purple, icon:'🛒', dinero:pedidos.length*pvpPonderado, esInversion:false },
    { label:'Confirmados', valor:confirmados.length, color:T.yellow, icon:'📞', dinero:confirmados.length*pvpPonderado, esInversion:false },
    { label:'Despachados', valor:despachados.length, color:T.blue, icon:'📦', dinero:despachados.length*pvpPonderado, esInversion:false },
    { label:'Entregados', valor:entregados.length, color:T.green, icon:'✅', dinero:entregados.length*gananciaPonderada, esInversion:false, esGanancia:true },
    { label:'Devueltos', valor:devueltos.length, color:T.red, icon:'🔄', dinero:devueltos.length*pvpPonderado, esInversion:false },
  ]

  // Inicializar sliders del simulador con valores reales (solo una vez al cargar)
  useEffect(() => {
    if (!loading && !inicializado && pedidos.length > 0) {
      setSimCTR(ctrReal||1); setSimConf(tasaConfirmacion||50); setSimDespacho(tasaDespacho||70)
      setSimEntrega(tasaEntrega||65); setSimDev(tasaDevolucion||15)
      setInicializado(true)
    }
  }, [loading, inicializado, pedidos.length, ctrReal, tasaConfirmacion, tasaDespacho, tasaEntrega, tasaDevolucion])

  const TABS = [
    { key:'embudo', label:'🔬 Embudo visual' },
    { key:'diagnostico', label:'🚨 Diagnóstico' },
    { key:'reconciliacion', label:'🕵️ Reconciliación' },
    { key:'simulador', label:'⚡ Simulador' },
    { key:'mezcla', label:'🔀 Mezcla de productos' },
  ]
  const TABS_VISIBLES = TABS.filter(t => puede(clavePermiso('embudo', t.key), 'ver'))

  // Si la sub-pestaña activa dejó de ser visible (permiso revocado o aún no otorgado),
  // salta automáticamente a la primera sub-pestaña visible. Solo actúa cuando el permiso
  // ya cargó, para no pisar el tab inicial mientras `puede()` todavía responde false por defecto.
  useEffect(() => {
    if (cargandoPermisos) return
    if (TABS_VISIBLES.length === 0) return
    if (!TABS_VISIBLES.some(t => t.key === tab)) setTab(TABS_VISIBLES[0].key as typeof tab)
  }, [cargandoPermisos, tab, TABS_VISIBLES.map(t=>t.key).join(',')])

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
      style={{ width:'100%', accentColor:T.yellow, margin:'4px 0' }} />
  )

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Calculando embudo real del mes...
    </div>
  )

  return (
    <RequierePermiso modulo="embudo">
    <div style={{ color:T.text, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🔬 Embudo de Tráfico</h1>
        <p style={{ fontSize:'13px', color:T.muted }}>Pauta real → Confirmación → Despacho → Entrega · Ponderado por mezcla de productos · VERIFICAR</p>
      </div>

      {pedidos.length === 0 && (
        <div style={{ ...s, padding:'30px', textAlign:'center', marginBottom:'16px', borderLeft:`3px solid ${T.yellow}` }}>
          <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'6px' }}>Sin pedidos este mes</div>
          <div style={{ fontSize:'12px', color:T.muted }}>El embudo se construye automáticamente desde Pauta y Pedidos reales.</div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'6px', marginBottom:'16px' }}>
        {[
          { label:'Impresiones', value:(totalImpresiones/1000).toFixed(0)+'K', color:T.muted, icon:'👁️' },
          { label:'Clics', value:(totalClics/1000).toFixed(1)+'K', color:T.blue, icon:'🖱️' },
          { label:'CTR real', value:`${ctrReal}%`, color:diag(ctrReal,BENCHMARKS.ctr).color, icon:'📊' },
          { label:'Pedidos', value:pedidos.length.toLocaleString(), color:T.purple, icon:'🛒' },
          { label:'Confirmados', value:confirmados.length.toLocaleString(), color:T.yellow, icon:'📞' },
          { label:'Entregados', value:entregados.length.toLocaleString(), color:T.green, icon:'✅' },
          { label:'Conv. total', value:`${conversionGlobal}%`, color:T.green, icon:'🎯' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'10px', borderTop:`2px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
              <span style={{ fontSize:'9px', color:T.muted }}>{k.label}</span><span style={{ fontSize:'12px' }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:'16px', fontWeight:'800', color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {TABS_VISIBLES.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key as typeof tab)}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: tab===t.key?T.yellow:'rgba(255,255,255,0.05)', color: tab===t.key?'#0A0D14':T.muted }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'embudo' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'16px' }}>🔬 EMBUDO COMPLETO — datos reales del mes</div>
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
                      <span style={{ fontSize:'12px', color:T.muted }}>{e.label}</span>
                      {i>0 && <span style={{ fontSize:'10px', color:e.color, fontWeight:'700' }}>{pctEtapa}%</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      {i>0 && perdidaDinero>0 && <span style={{ fontSize:'10px', color:T.red }}>-{perdida.toLocaleString('es-CO')} ({fmt(perdidaDinero)})</span>}
                      <span style={{ fontSize:'13px', fontWeight:'800', color:e.color }}>{e.valor.toLocaleString('es-CO')}</span>
                      <span style={{ fontSize:'11px', fontWeight:'700', color: e.esGanancia?T.green:e.esInversion?T.red:T.muted, minWidth:'52px', textAlign:'right' }}>
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
                <div style={{ fontSize:'12px', color:T.muted }}>Conversión global</div>
                <div style={{ fontSize:'11px', color:T.muted }}>Impresiones → Entrega efectiva</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'22px', fontWeight:'800', color:T.green }}>{conversionGlobal}%</div>
                {entregados.length>0 && <div style={{ fontSize:'11px', color:T.muted }}>1 entrega cada {Math.round(totalImpresiones/entregados.length).toLocaleString()} impresiones</div>}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.purple, marginBottom:'14px' }}>💰 CPA REAL — ponderado por mezcla</div>
              {[
                { label:'CPA promedio pauta', v:cpaReal, color:T.blue },
                { label:'CPA por entregado', v:cpaEntregado, color:T.green },
                { label:'CPA máximo (mezcla, desde Precio)', v:cpaPromedioPonderado, color:T.purple },
              ].map((k,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', marginBottom:'6px', background:`${k.color}08`, borderLeft:`3px solid ${k.color}` }}>
                  <div style={{ flex:1, fontSize:'12px', color:T.text }}>{k.label}</div>
                  <div style={{ fontSize:'16px', fontWeight:'800', color:k.color }}>${k.v.toLocaleString('es-CO')}</div>
                </div>
              ))}
              <div style={{ marginTop:'10px', padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'8px', fontSize:'11px', color:T.muted }}>
                💡 CPA por entregado <strong style={{ color: cpaEntregado<=cpaPromedioPonderado?T.green:T.red }}>{cpaEntregado<=cpaPromedioPonderado?'✅ dentro':'❌ excede'}</strong> el máximo configurado en Precio para tu mezcla actual.
              </div>
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.red, marginBottom:'12px' }}>📉 PEDIDOS PERDIDOS POR ETAPA — impacto real en $</div>
              {[
                { etapa:'Generado → Confirmación', perdidos:pedidos.length-confirmados.length, pct:100-tasaConfirmacion, color:T.yellow },
                { etapa:'Confirmación → Despacho', perdidos:confirmados.length-despachados.length, pct:100-tasaDespacho, color:T.purple },
                { etapa:'Despacho → Entrega', perdidos:despachados.length-entregados.length, pct:100-tasaEntrega, color:T.red },
                { etapa:'Devueltos', perdidos:devueltos.length, pct:tasaDevolucion, color:T.red },
              ].map((p,i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:'7px', marginBottom:'6px', background:`${p.color}06` }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'11px', fontWeight:'700', color:p.color }}>{p.etapa}</span>
                    <div style={{ display:'flex', gap:'8px', alignItems:'baseline' }}>
                      <span style={{ fontSize:'12px', fontWeight:'800', color:p.color }}>-{p.perdidos.toLocaleString()} ({p.pct}%)</span>
                      <span style={{ fontSize:'12px', fontWeight:'800', color:T.red }}>{fmt(p.perdidos*pvpPonderado)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:'10px', padding:'10px 12px', background:'rgba(240,92,92,0.08)', borderRadius:'8px', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'12px', fontWeight:'700', color:T.red }}>TOTAL DINERO PERDIDO EN EL EMBUDO</span>
                <span style={{ fontSize:'15px', fontWeight:'900', color:T.red }}>{fmt((pedidos.length-entregados.length)*pvpPonderado)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'diagnostico' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'14px' }}>🔍 DIAGNÓSTICO POR INDICADOR — con impacto en $</div>
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
                  <div style={{ fontSize:'11px', color:dg.color, marginBottom: d.impacto>0?'4px':'0' }}>→ {dg.color===T.green?d.buena:d.mala}</div>
                  {d.impacto>0 && (
                    <div style={{ fontSize:'11px', fontWeight:'700', color:T.green }}>💰 Si llega a &quot;Bueno&quot;: +{fmt(d.impacto)}/mes</div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>📊 SCORE GLOBAL DEL EMBUDO</div>
            {(() => {
              const scores = [diag(ctrReal,BENCHMARKS.ctr), diag(tasaConfirmacion,BENCHMARKS.tasa_confirmacion), diag(tasaDespacho,BENCHMARKS.tasa_despacho), diag(tasaEntrega,BENCHMARKS.tasa_entrega), diag(tasaDevolucion,BENCHMARKS.tasa_devolucion)]
              const verdes = scores.filter(x=>x.color===T.green).length
              const amarillos = scores.filter(x=>x.color===T.yellow).length
              const rojos = scores.filter(x=>x.color===T.red).length
              const score = Math.round((verdes*100+amarillos*60+rojos*20)/scores.length)
              const scoreColor = score>=75?T.green:score>=50?T.yellow:T.red
              const oportunidadTotal =
                Math.max(BENCHMARKS.tasa_confirmacion.bueno-tasaConfirmacion,0)/100*pedidos.length*tasaDespacho/100*tasaEntrega/100*gananciaPonderada +
                Math.max(BENCHMARKS.tasa_despacho.bueno-tasaDespacho,0)/100*confirmados.length*tasaEntrega/100*gananciaPonderada +
                Math.max(BENCHMARKS.tasa_entrega.bueno-tasaEntrega,0)/100*despachados.length*gananciaPonderada +
                Math.max(tasaDevolucion-BENCHMARKS.tasa_devolucion.bueno,0)/100*entregados.length*gananciaPonderada
              return (
                <>
                  <div style={{ textAlign:'center', marginBottom:'16px' }}>
                    <div style={{ fontSize:'52px', fontWeight:'900', color:scoreColor }}>{score}</div>
                    <div style={{ fontSize:'13px', color:T.muted }}>Score del embudo /100</div>
                  </div>
                  <div style={{ display:'flex', gap:'10px', justifyContent:'center', marginBottom:'14px' }}>
                    {[{n:verdes,l:'Bueno',c:T.green},{n:amarillos,l:'Aceptable',c:T.yellow},{n:rojos,l:'Crítico',c:T.red}].map((x,i) => (
                      <div key={i} style={{ textAlign:'center', padding:'8px 12px', background:`${x.c}10`, borderRadius:'8px' }}>
                        <div style={{ fontSize:'20px', fontWeight:'800', color:x.c }}>{x.n}</div>
                        <div style={{ fontSize:'10px', color:T.muted }}>{x.l}</div>
                      </div>
                    ))}
                  </div>
                  {oportunidadTotal>0 && (
                    <div style={{ padding:'14px', background:'rgba(45,212,160,0.08)', borderRadius:'10px', border:'1px solid rgba(45,212,160,0.2)', textAlign:'center' }}>
                      <div style={{ fontSize:'11px', color:T.muted, marginBottom:'4px' }}>Oportunidad total si optimizas todo a &quot;Bueno&quot;</div>
                      <div style={{ fontSize:'22px', fontWeight:'900', color:T.green }}>+{fmt(oportunidadTotal)}/mes</div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {tab === 'reconciliacion' && (
        <div>
          <div style={{ ...s, padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent, marginBottom:'6px' }}>🕵️ RECONCILIACIÓN META → SHOPIFY → DROPI</div>
            <div style={{ fontSize:'12px', color:T.muted, lineHeight:'1.6' }}>
              Sube los 3 exports del mismo período para ver exactamente dónde se pierden pedidos —
              Meta reporta compras, pero no todas llegan a ser una orden real en Shopify, y no todas
              las órdenes de Shopify llegan a procesarse en Dropi. El cruce Shopify↔Dropi es por
              teléfono del cliente (con nombre y fecha como respaldo) — Meta solo se compara en
              total, porque sus reportes de anuncios no traen el nombre del comprador.
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'12px', marginBottom:'16px' }}>
            {[
              { key:'meta' as const, label:'📊 CSV Meta/TikTok Ads', ayuda:'Ads Manager → Reportes → Exportar → CSV', accept:'.csv', onFile:rcSubirMeta, done:rcMetaResultados!==null },
              { key:'shopify' as const, label:'🛍️ Export de pedidos Shopify', ayuda:'Shopify Admin → Pedidos → Exportar', accept:'.csv,.xlsx,.xls', onFile:rcSubirShopify, done:!!rcShopify },
              { key:'dropi' as const, label:'📦 Export de pedidos Dropi', ayuda:'Dropi → Órdenes → Exportar', accept:'.xlsx,.xls,.csv', onFile:rcSubirDropi, done:!!rcDropi },
            ].map(box => (
              <div key={box.key} style={{ ...s, padding:'16px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.text, marginBottom:'4px' }}>{box.label}</div>
                <div style={{ fontSize:'10.5px', color:T.muted, marginBottom:'10px' }}>{box.ayuda}</div>
                <label style={{ display:'block', padding:'18px', background: box.done ? `${T.green}08` : 'rgba(255,255,255,0.02)', border:`2px dashed ${box.done ? T.green : T.border}`, borderRadius:'10px', cursor: rcProcesando[box.key] ? 'wait' : 'pointer', textAlign:'center', fontSize:'12px', color: box.done ? T.green : T.muted }}>
                  {rcProcesando[box.key] ? '⏳ Procesando...' : box.done ? '✅ Archivo cargado — click para reemplazar' : '📁 Click para seleccionar archivo'}
                  <input type="file" accept={box.accept} style={{ display:'none' }} disabled={rcProcesando[box.key]}
                    onChange={e => { const f = e.target.files?.[0]; if (f) box.onFile(f) }} />
                </label>
                {rcMsg[box.key] && (
                  <div style={{ marginTop:'8px', fontSize:'11px', color: rcMsg[box.key]?.startsWith('❌') ? T.red : T.muted }}>{rcMsg[box.key]}</div>
                )}
              </div>
            ))}
          </div>

          {rcCruce && (
            <>
              <div style={{ ...s, padding:'20px', marginBottom:'16px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'14px' }}>🔻 EMBUDO DE RECONCILIACIÓN</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px' }}>
                  {[
                    ...(rcGapMeta ? [{ label:'Meta reportó', n:rcGapMeta.resultadosMeta, c:T.purple, sub:'resultados/compras' }] : []),
                    { label:'Shopify recibió', n:rcShopify!.length, c:T.blue, sub: rcGapMeta ? `-${rcGapMeta.gap} (${rcGapMeta.pctFuga}%) vs. Meta` : 'órdenes creadas' },
                    { label:'Dropi procesó', n:rcCruce.matched.length, c:T.green, sub:`-${rcSinMatchEnRango.length} (${rcPctFugaReal}%) vs. Shopify en el mismo rango` },
                  ].map((k,i) => (
                    <div key={i} style={{ textAlign:'center', padding:'14px', background:`${k.c}08`, borderRadius:'10px', border:`1px solid ${k.c}30` }}>
                      <div style={{ fontSize:'26px', fontWeight:'900', color:k.c }}>{k.n.toLocaleString('es-CO')}</div>
                      <div style={{ fontSize:'11px', color:T.text, fontWeight:'600' }}>{k.label}</div>
                      <div style={{ fontSize:'10px', color:T.muted }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
                {rcRango && (
                  <div style={{ marginTop:'12px', padding:'10px 12px', background:`${T.blue}08`, border:`1px solid ${T.blue}20`, borderRadius:'8px', fontSize:'11px', color:T.muted, lineHeight:1.6 }}>
                    ℹ️ El % de fuga de arriba solo cuenta pedidos entre <strong style={{color:T.text}}>{rcRango.desde}</strong> y <strong style={{color:T.text}}>{rcRango.hasta}</strong> — el rango que ambos archivos cubren en común.
                    {rcSinMatchFueraDeRango > 0 && <> Hay <strong style={{color:T.text}}>{rcSinMatchFueraDeRango}</strong> pedidos de Shopify fuera de ese rango (más recientes o más antiguos que el archivo de Dropi) que no se cuentan como fuga — probablemente aún no les tocaba aparecer en Dropi, o son de un período que ese archivo no cubre.</>}
                  </div>
                )}
              </div>

              <div style={{ ...s, overflow:'hidden' }}>
                <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                  <div style={{ fontWeight:'700', fontSize:'13px', color:T.red }}>📉 Pedidos en Shopify que nunca llegaron a Dropi ({rcCruce.sinMatch.length})</div>
                  {rcCruce.sinMatch.length > 0 && (
                    <button onClick={rcExportarPerdidos} disabled={!puede(clavePermiso('embudo','reconciliacion'),'descargar')}
                      style={{ padding:'6px 12px', background:`${T.accent}15`, border:`1px solid ${T.accent}30`, borderRadius:'7px', color:T.accent, fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                      ⬇️ Descargar Excel
                    </button>
                  )}
                </div>
                {rcCruce.sinMatch.length === 0 ? (
                  <div style={{ padding:'30px', textAlign:'center', color:T.green, fontSize:'13px' }}>✅ Todos los pedidos de Shopify llegaron a Dropi en este período.</div>
                ) : (
                  <div style={{ overflowX:'auto', maxHeight:'420px', overflowY:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                      <thead>
                        <tr style={{ background:T.card2, position:'sticky', top:0 }}>
                          {['Estado','Orden','Cliente','Teléfono','Fecha','Producto','Valor','Acción'].map(h => (
                            <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:'700', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rcCruce.sinMatch.map((p,i) => {
                          const enRango = dentroDeRango(p.fecha, rcRango)
                          return (
                          <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
                            <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }}>
                              {enRango ? (
                                <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px', background:`${T.red}20`, color:T.red }} title="Dentro del rango que Dropi cubre y no aparece -- posible fuga real, vale la pena investigar.">🔴 Fuga real</span>
                              ) : (
                                <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px', background:`${T.yellow}20`, color:T.yellow }} title="Fuera del rango de fechas que cubre el archivo de Dropi -- probablemente aún no le tocaba aparecer, no necesariamente se perdió.">🕒 Fuera de rango</span>
                              )}
                            </td>
                            <td style={{ padding:'9px 12px', color:T.muted, whiteSpace:'nowrap' }}>{p.ordenId}</td>
                            <td style={{ padding:'9px 12px', fontWeight:'600' }}>{p.nombre || '—'}</td>
                            <td style={{ padding:'9px 12px', color:T.muted, whiteSpace:'nowrap' }}>{p.telefono || '—'}</td>
                            <td style={{ padding:'9px 12px', color:T.muted, whiteSpace:'nowrap' }}>{p.fecha}</td>
                            <td style={{ padding:'9px 12px', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.producto}</td>
                            <td style={{ padding:'9px 12px', color:T.green, fontWeight:'600', whiteSpace:'nowrap' }}>${p.valor.toLocaleString('es-CO')}</td>
                            <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }}>
                              {p.telefono ? (
                                <a href={`https://wa.me/${p.telefono.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                                  style={{ padding:'4px 10px', background:`${T.green}15`, border:`1px solid ${T.green}30`, borderRadius:'6px', color:T.green, fontSize:'11px', fontWeight:'600', textDecoration:'none' }}>
                                  💬 WhatsApp
                                </a>
                              ) : '—'}
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'simulador' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'6px' }}>⚡ SIMULADOR — basado en ganancia ponderada real</div>
            <div style={{ fontSize:'11px', color:T.muted, marginBottom:'16px' }}>Ganancia ponderada actual: <strong style={{ color:T.green }}>${gananciaPonderada.toLocaleString('es-CO')}</strong>/pedido (mezcla real)</div>
            {[
              { label:'CTR', val:simCTR, set:setSimCTR, min:0.5, max:5, step:0.1, unidad:'%' },
              { label:'% Confirmación', val:simConf, set:setSimConf, min:30, max:95, step:1, unidad:'%' },
              { label:'% Despacho', val:simDespacho, set:setSimDespacho, min:50, max:98, step:1, unidad:'%' },
              { label:'% Entrega', val:simEntrega, set:setSimEntrega, min:50, max:98, step:1, unidad:'%' },
              { label:'% Devolución', val:simDev, set:setSimDev, min:1, max:30, step:1, unidad:'%' },
            ].map((sl,i) => (
              <div key={i} style={{ marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                  <span style={{ fontSize:'12px', color:T.muted }}>{sl.label}</span>
                  <span style={{ fontSize:'13px', fontWeight:'800', color:T.yellow }}>{sl.val.toFixed(1)}{sl.unidad}</span>
                </div>
                {sld(sl.val, sl.set, sl.min, sl.max, sl.step)}
              </div>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.green, marginBottom:'14px' }}>📊 RESULTADO SIMULACIÓN</div>
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
                      <div style={{ fontSize:'10px', color:T.muted }}>{k.label}</div>
                      <div style={{ fontSize:'16px', fontWeight:'800', color:T.text }}>{k.sim.toLocaleString()} <span style={{ fontSize:'11px', color: d>=0?T.green:T.red }}>{d>=0?'+':''}{d}</span></div>
                      {k.dinero>0 && <div style={{ fontSize:'11px', fontWeight:'700', color:T.purple, marginTop:'2px' }}>{fmt(k.dinero)}</div>}
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'14px', background: mejora_ganancia>=0?'rgba(45,212,160,0.08)':'rgba(240,92,92,0.08)', borderRadius:'10px' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:T.muted }}>Diferencia mensual proyectada</div>
                  <div style={{ fontSize:'22px', fontWeight:'900', color: mejora_ganancia>=0?T.green:T.red }}>{mejora_ganancia>=0?'+':''}{fmt(mejora_ganancia)}</div>
                  <div style={{ fontSize:'11px', color:T.muted }}>= {fmt(mejora_ganancia*12)} al año</div>
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
            <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'13px' }}>Sin productos vendidos este mes</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:T.bg, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Producto','Unidades','% del mix','Ganancia total','CPA máx (Precio)'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:'700' }}>{h}</th>
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
                      <td style={{ padding:'10px 12px', color:T.muted }}>{m.unidades}</td>
                      <td style={{ padding:'10px 12px', color:T.blue, fontWeight:'700' }}>{pct}%</td>
                      <td style={{ padding:'10px 12px', color:T.green, fontWeight:'700' }}>${m.ganancia.toLocaleString('es-CO')}</td>
                      <td style={{ padding:'10px 12px', color:T.purple }}>{m.cpaMax>0?`$${m.cpaMax.toLocaleString('es-CO')}`:'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div style={{ padding:'14px 16px', fontSize:'11px', color:T.muted, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            💡 Esta mezcla es la que define la ganancia ponderada real (${gananciaPonderada.toLocaleString('es-CO')}/pedido) usada en el embudo y el simulador — igual que en el módulo Equilibrio.
          </div>
        </div>
      )}
    </div>
    </RequierePermiso>
  )
}
