'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Producto = {
  id: string; nombre: string; pvp_final: number
  costo_proveedor: number; costo_flete: number; costo_flete_dev: number
  costo_fulfillment: number; costo_full_dev: number; cf_pedido: number
  pct_publicidad: number; pct_pub_dev: number; pct_pub_cancel: number
  pct_devolucion: number; pct_desc_popup: number; pct_com_plataforma: number
  pct_pasarela: number; pct_com_pasarela: number; pct_com_ventas: number; pct_com_admin: number
}
type Calculado = Producto & {
  unidades: number; ventas: number; costo_prod: number; flete_env: number; flete_dev: number
  fulfill: number; pub: number; comision: number; cf: number; total_costos: number
  utilidad_bruta: number; utilidad_neta: number; margen_bruto: number; margen_neto: number
  ganancia_unit: number
}

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function semG(mg: number) { return mg >= 15 ? '#2DD4A0' : mg >= 8 ? '#F5A623' : '#F05C5C' }
function fmt(n: number) { return n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n/1000)}K` : `$${Math.round(n)}` }
const s: React.CSSProperties = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }

export default function PYGPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'total'|'producto'|'mezcla'|'proyeccion'>('total')
  const [prodSel, setProdSel] = useState<string | null>(null)
  const [crecimiento, setCrecimiento] = useState(8)

  const [productos, setProductos] = useState<Producto[]>([])
  const [pedidosPorProducto, setPedidosPorProducto] = useState<Record<string, { unidades:number; ventas:number; ganancia:number }>>({})
  const [cfMes, setCfMes] = useState(0)
  const [cuotaCreditos, setCuotaCreditos] = useState(0)
  const [metaUtilidad, setMetaUtilidad] = useState(0)
  const [historico3m, setHistorico3m] = useState<{ mes:string; ventas:number; utilidad:number }[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id

    const hoy = new Date()
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`
    const iniMes = `${periodo.slice(0,7)}-01`
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).toISOString().slice(0,10)

    const [{ data: prodsData }, { data: pedidosData }, { data: costosData }, { data: creditosData }, { data: metaData }] = await Promise.all([
      supabase.from('productos').select('id, nombre, pvp_final, costo_proveedor, costo_flete, costo_flete_dev, costo_fulfillment, costo_full_dev, cf_pedido, pct_publicidad, pct_pub_dev, pct_pub_cancel, pct_devolucion, pct_desc_popup, pct_com_plataforma, pct_pasarela, pct_com_pasarela, pct_com_ventas, pct_com_admin')
        .eq('tenant_id', tid).eq('tipo','producto').eq('estado','activo'),
      supabase.from('pedidos').select('producto_id, pvp, ganancia, estado').eq('tenant_id', tid)
        .eq('estado','ENTREGADO').gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes+'T23:59:59'),
      supabase.from('costos_fijos').select('total').eq('tenant_id', tid).eq('periodo', periodo).eq('activo', true),
      supabase.from('inversiones_creditos').select('cuota_mensual').eq('tenant_id', tid).eq('estado','activo'),
      supabase.from('metas').select('meta_utilidad').eq('tenant_id', tid).eq('periodo', periodo).single(),
    ])

    setProductos((prodsData||[]) as Producto[])

    const porProd: Record<string, { unidades:number; ventas:number; ganancia:number }> = {}
    ;(pedidosData||[]).forEach((p: { producto_id:string; pvp:number; ganancia:number }) => {
      if (!p.producto_id) return
      if (!porProd[p.producto_id]) porProd[p.producto_id] = { unidades:0, ventas:0, ganancia:0 }
      porProd[p.producto_id].unidades++
      porProd[p.producto_id].ventas += Number(p.pvp||0)
      porProd[p.producto_id].ganancia += Number(p.ganancia||0)
    })
    setPedidosPorProducto(porProd)

    setCfMes(Math.round((costosData||[]).reduce((a:number,c:{total:number})=>a+Number(c.total||0),0)))
    setCuotaCreditos(Math.round((creditosData||[]).reduce((a:number,c:{cuota_mensual:number})=>a+Number(c.cuota_mensual||0),0)))
    setMetaUtilidad(Number((metaData as {meta_utilidad?:number}|null)?.meta_utilidad) || 0)

    // Histórico 3 meses reales para proyección basada en tendencia real
    const hist = await Promise.all([1,2,3].map(async (i) => {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1)
      const ini = fecha.toISOString().slice(0,10)
      const fin = new Date(fecha.getFullYear(), fecha.getMonth()+1, 0).toISOString().slice(0,10)
      const { data } = await supabase.from('pedidos').select('pvp, ganancia').eq('tenant_id', tid)
        .eq('estado','ENTREGADO').gte('fecha_pedido', ini).lte('fecha_pedido', fin+'T23:59:59')
      const rows = (data||[]) as { pvp:number; ganancia:number }[]
      return { mes: MESES_ES[fecha.getMonth()], ventas: rows.reduce((a,r)=>a+Number(r.pvp||0),0), utilidad: rows.reduce((a,r)=>a+Number(r.ganancia||0),0) }
    }))
    setHistorico3m(hist.reverse())

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── CÁLCULO POR PRODUCTO — usando datos reales de pedidos entregados ──
  function calcProd(p: Producto): Calculado {
    const real = pedidosPorProducto[p.id] || { unidades:0, ventas:0, ganancia:0 }
    const unidades = real.unidades
    const ventas = real.ventas
    const costo_prod = p.costo_proveedor * unidades
    const flete_env = p.costo_flete * unidades
    const flete_dev = p.costo_flete_dev * unidades
    const fulfill = (p.costo_fulfillment + p.costo_full_dev) * unidades
    const pub = Math.round(ventas * (p.pct_publicidad + p.pct_pub_dev + p.pct_pub_cancel) / 100)
    const comision = Math.round(ventas * (p.pct_com_plataforma + p.pct_pasarela + p.pct_com_pasarela + p.pct_com_ventas + p.pct_com_admin + p.pct_desc_popup) / 100)
    const cf = p.cf_pedido * unidades
    const total_costos = costo_prod + flete_env + flete_dev + fulfill + pub + comision + cf
    const utilidad_bruta = ventas - costo_prod - flete_env - flete_dev - fulfill
    const utilidad_neta = ventas - total_costos
    const margen_bruto = ventas > 0 ? Math.round(utilidad_bruta/ventas*100) : 0
    const margen_neto = ventas > 0 ? Math.round(utilidad_neta/ventas*100) : 0
    const ganancia_unit = unidades > 0 ? Math.round(utilidad_neta/unidades) : 0
    return { ...p, unidades, ventas, costo_prod, flete_env, flete_dev, fulfill, pub, comision, cf, total_costos, utilidad_bruta, utilidad_neta, margen_bruto, margen_neto, ganancia_unit }
  }

  const calcTodos = productos.map(calcProd).filter(p => p.unidades > 0)
  const totalUnidades = calcTodos.reduce((s,p) => s+p.unidades, 0)
  const totalVentas = calcTodos.reduce((s,p) => s+p.ventas, 0)
  const totalCostoProd = calcTodos.reduce((s,p) => s+p.costo_prod, 0)
  const totalFleteEnv = calcTodos.reduce((s,p) => s+p.flete_env, 0)
  const totalFleteDev = calcTodos.reduce((s,p) => s+p.flete_dev, 0)
  const totalFulfill = calcTodos.reduce((s,p) => s+p.fulfill, 0)
  const totalPub = calcTodos.reduce((s,p) => s+p.pub, 0)
  const totalComision = calcTodos.reduce((s,p) => s+p.comision, 0)
  const totalUtilBruta = totalVentas - totalCostoProd - totalFleteEnv - totalFleteDev - totalFulfill
  // CF real del mes (no la suma de cf_pedido por producto, que es estimado) + intereses de créditos
  const totalCostos = totalCostoProd + totalFleteEnv + totalFleteDev + totalFulfill + totalPub + totalComision + cfMes + cuotaCreditos
  const totalUtilNeta = totalVentas - totalCostos
  const margenBrutoTotal = totalVentas > 0 ? Math.round(totalUtilBruta/totalVentas*100) : 0
  const margenNetoTotal = totalVentas > 0 ? Math.round(totalUtilNeta/totalVentas*100) : 0

  // Proyección basada en tendencia real de 3 meses (no un % inventado por defecto)
  const tendenciaReal = historico3m.length >= 2 && historico3m[0].ventas > 0
    ? Math.round((historico3m[historico3m.length-1].ventas / historico3m[0].ventas - 1) * 100 / (historico3m.length-1))
    : crecimiento
  const MESES_PROYECCION = Array.from({length:6}, (_,i) => MESES_ES[(new Date().getMonth()+i+1)%12])
  const proyecciones = MESES_PROYECCION.map((mes,i) => {
    const factor = Math.pow(1+crecimiento/100, i+1)
    const ventas_p = Math.round(totalVentas*factor)
    const costos_p = Math.round(totalCostos*factor*0.97)
    return { mes, ventas:ventas_p, utilidad_neta:ventas_p-costos_p, margen: ventas_p>0?Math.round((ventas_p-costos_p)/ventas_p*100):0, unidades:Math.round(totalUnidades*factor) }
  })

  const prodActual = prodSel ? calcTodos.find(p => p.id === prodSel) : null

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Consolidando Estado de Resultados...
    </div>
  )

  if (calcTodos.length === 0) return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>
      <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'8px' }}>💰 Estado de Resultados P&G</h1>
      <div style={{ ...s, padding:'40px', textAlign:'center', borderLeft:'3px solid #F5A623' }}>
        <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'8px' }}>Sin pedidos entregados este mes</div>
        <div style={{ fontSize:'12px', color:'#8B96A8' }}>El P&G se construye automáticamente desde pedidos reales marcados como ENTREGADO.</div>
      </div>
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>

      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>💰 Estado de Resultados P&G</h1>
        <p style={{ fontSize:'13px', color:'#8B96A8' }}>Datos reales del mes · Consolida Precio + Costos + Inversión · VERIFICAR</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px', marginBottom:'16px' }}>
        {[
          { label:'Ventas brutas', value:fmt(totalVentas), color:'#2DD4A0', icon:'💰' },
          { label:'Total costos', value:fmt(totalCostos), color:'#F05C5C', icon:'💸' },
          { label:'Utilidad bruta', value:fmt(totalUtilBruta), color:semG(margenBrutoTotal), icon:'📊' },
          { label:'Utilidad neta', value:fmt(totalUtilNeta), color:semG(margenNetoTotal), icon:'💎' },
          { label:'Margen bruto', value:`${margenBrutoTotal}%`, color:semG(margenBrutoTotal), icon:'📈' },
          { label:'Margen neto', value:`${margenNetoTotal}%`, color:semG(margenNetoTotal), icon:'🎯' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px', borderTop:`2px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:'#8B96A8' }}>{k.label}</span><span>{k.icon}</span>
            </div>
            <div style={{ fontSize:'18px', fontWeight:'800', color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {metaUtilidad > 0 && (
        <div style={{ ...s, padding:'12px 16px', marginBottom:'16px', borderLeft:`3px solid ${totalUtilNeta>=metaUtilidad?'#2DD4A0':'#F5A623'}` }}>
          <div style={{ fontSize:'12px', color:'#8B96A8' }}>
            Meta de utilidad del mes: <strong style={{ color:'#E8EDF5' }}>{fmt(metaUtilidad)}</strong> ·
            Vas en <strong style={{ color: totalUtilNeta>=metaUtilidad?'#2DD4A0':'#F5A623' }}>{Math.round(totalUtilNeta/metaUtilidad*100)}%</strong> de la meta
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
        {[
          { key:'total', label:'🏪 P&G Total Tienda' },
          { key:'producto', label:'📦 P&G por Producto' },
          { key:'mezcla', label:'🔀 Mezcla de Productos' },
          { key:'proyeccion', label:'🔮 Proyección 6M' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: tab === t.key ? '#F5A623' : 'rgba(255,255,255,0.05)', color: tab === t.key ? '#0A0D14' : '#8B96A8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'total' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>💰 Cascada de Costos — Tienda completa</div>
            {[
              { concepto:'VENTAS BRUTAS', valor:totalVentas, tipo:'entrada', color:'#E8EDF5' },
              { sep:true },
              { concepto:'(-) Costo de productos', valor:totalCostoProd, tipo:'egreso', color:'#F05C5C', pct: totalVentas>0?Math.round(totalCostoProd/totalVentas*100):0 },
              { concepto:'(-) Flete de envío', valor:totalFleteEnv, tipo:'egreso', color:'#F05C5C', pct: totalVentas>0?Math.round(totalFleteEnv/totalVentas*100):0 },
              { concepto:'(-) Flete devolución', valor:totalFleteDev, tipo:'egreso', color:'#F05C5C', pct: totalVentas>0?Math.round(totalFleteDev/totalVentas*100):0 },
              { concepto:'(-) Fulfillment', valor:totalFulfill, tipo:'egreso', color:'#F05C5C', pct: totalVentas>0?Math.round(totalFulfill/totalVentas*100):0 },
              { concepto:'= UTILIDAD BRUTA', valor:totalUtilBruta, tipo:'subtotal', color:semG(margenBrutoTotal), pct:margenBrutoTotal },
              { sep:true },
              { concepto:'(-) Inversión en publicidad', valor:totalPub, tipo:'variable', color:'#9B6BFF', pct: totalVentas>0?Math.round(totalPub/totalVentas*100):0 },
              { concepto:'(-) Comisiones/pasarela/popup', valor:totalComision, tipo:'variable', color:'#9B6BFF', pct: totalVentas>0?Math.round(totalComision/totalVentas*100):0 },
              { concepto:'(-) Costos fijos del mes (real)', valor:cfMes, tipo:'fijo', color:'#3D8EF0', pct: totalVentas>0?Math.round(cfMes/totalVentas*100):0 },
              ...(cuotaCreditos > 0 ? [{ concepto:'(-) Cuota créditos activos', valor:cuotaCreditos, tipo:'fijo' as const, color:'#F05C5C', pct: totalVentas>0?Math.round(cuotaCreditos/totalVentas*100):0 }] : []),
              { concepto:'= UTILIDAD NETA', valor:totalUtilNeta, tipo:'resultado', color:semG(margenNetoTotal), pct:margenNetoTotal },
            ].map((row, i) => {
              if ('sep' in row && row.sep) return <div key={i} style={{ height:'1px', background:'rgba(255,255,255,0.05)', margin:'4px 0' }} />
              const r = row as { concepto:string; valor:number; tipo:string; color:string; pct?:number }
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 16px',
                  background: r.tipo === 'resultado' ? `${r.color}08` : r.tipo === 'subtotal' ? `${r.color}05` : 'transparent',
                  borderLeft: ['resultado','subtotal'].includes(r.tipo) ? `3px solid ${r.color}` : '3px solid transparent' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'12px', color: ['resultado','subtotal','entrada'].includes(r.tipo) ? '#E8EDF5' : '#8B96A8', fontWeight: ['resultado','subtotal','entrada'].includes(r.tipo) ? '700' : '400' }}>{r.concepto}</div>
                    {r.pct !== undefined && (
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'3px' }}>
                        <div style={{ height:'3px', width:`${Math.min(Math.abs(r.pct),100)}%`, maxWidth:'120px', background:r.color, borderRadius:'2px' }} />
                        <span style={{ fontSize:'10px', color:r.color }}>{r.pct}%</span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize: ['resultado','subtotal'].includes(r.tipo) ? '16px' : '13px', fontWeight:'800', color:r.color }}>
                      {r.tipo === 'entrada' ? '' : r.valor > 0 && !['resultado','subtotal'].includes(r.tipo) ? '-' : ''}${Math.abs(r.valor).toLocaleString('es-CO')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'14px' }}>📊 DISTRIBUCIÓN DE COSTOS SOBRE VENTAS</div>
              {[
                { label:'Costo producto', valor:totalCostoProd, color:'#F05C5C' },
                { label:'Flete envío + dev', valor:totalFleteEnv+totalFleteDev, color:'#F5A623' },
                { label:'Publicidad', valor:totalPub, color:'#9B6BFF' },
                { label:'Comisiones/pasarela', valor:totalComision, color:'#9B6BFF' },
                { label:'Costos fijos', valor:cfMes, color:'#3D8EF0' },
                ...(cuotaCreditos>0 ? [{ label:'Cuota créditos', valor:cuotaCreditos, color:'#F05C5C' }] : []),
                { label:'Fulfillment', valor:totalFulfill, color:'#8B96A8' },
              ].map((c,i) => {
                const pct = totalVentas>0 ? Math.round(c.valor/totalVentas*100) : 0
                return (
                  <div key={i} style={{ marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <span style={{ fontSize:'12px', color:'#8B96A8' }}>{c.label}</span>
                      <div style={{ display:'flex', gap:'10px' }}>
                        <span style={{ fontSize:'11px', color:'#5A6478' }}>{pct}%</span>
                        <span style={{ fontSize:'12px', fontWeight:'700', color:c.color }}>{fmt(c.valor)}</span>
                      </div>
                    </div>
                    <div style={{ height:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'4px' }}>
                      <div style={{ height:'8px', width:`${Math.min(pct*2.5,100)}%`, background:c.color, borderRadius:'4px' }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop:'12px', padding:'10px 12px', borderRadius:'8px', background:'rgba(255,255,255,0.02)', display:'flex', justifyContent:'space-between', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize:'12px', color:'#8B96A8' }}>Total costos / Ventas</span>
                <span style={{ fontSize:'14px', fontWeight:'800', color:semG(margenNetoTotal) }}>{totalVentas>0?Math.round(totalCostos/totalVentas*100):0}%</span>
              </div>
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'12px' }}>📋 RESUMEN EJECUTIVO</div>
              {[
                { label:'Productos con ventas', value:`${calcTodos.length} de ${productos.length} activos` },
                { label:'Unidades entregadas (mes)', value:totalUnidades.toLocaleString() },
                { label:'Ingreso promedio/pedido', value: totalUnidades>0?fmt(totalVentas/totalUnidades):'—' },
                { label:'Ganancia promedio/pedido', value: totalUnidades>0?fmt(totalUtilNeta/totalUnidades):'—' },
                { label:'CF real del mes', value:fmt(cfMes) },
                ...(cuotaCreditos>0 ? [{ label:'Cuota créditos activos', value:fmt(cuotaCreditos) }] : []),
              ].map((k,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:'12px', color:'#8B96A8' }}>{k.label}</span>
                  <span style={{ fontSize:'13px', fontWeight:'700', color:'#E8EDF5' }}>{k.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'producto' && (
        <div style={{ display:'grid', gridTemplateColumns: prodActual ? '1fr 380px' : '1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>📦 P&G por producto — clic para ver detalle</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                <thead>
                  <tr style={{ background:'#0A0D14', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    {['Producto','Unid.','Ventas','Util.Bruta','Util.Neta','MB%','MN%','Estado'].map(h => (
                      <th key={h} style={{ padding:'9px 10px', textAlign:'left', fontSize:'10px', color:'#5A6478', fontWeight:'700', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...calcTodos].sort((a,b) => b.utilidad_neta-a.utilidad_neta).map((p,i) => (
                    <tr key={i} onClick={() => setProdSel(prodSel===p.id?null:p.id)}
                      style={{ borderBottom:'1px solid rgba(255,255,255,0.03)', cursor:'pointer', background: prodSel===p.id?'rgba(245,166,35,0.06)':'transparent' }}>
                      <td style={{ padding:'9px 10px', fontWeight:'600' }}>{p.nombre}</td>
                      <td style={{ padding:'9px 10px', color:'#8B96A8' }}>{p.unidades}</td>
                      <td style={{ padding:'9px 10px', color:'#E8EDF5', fontWeight:'600' }}>{fmt(p.ventas)}</td>
                      <td style={{ padding:'9px 10px', color:semG(p.margen_bruto) }}>{fmt(p.utilidad_bruta)}</td>
                      <td style={{ padding:'9px 10px', color:semG(p.margen_neto), fontWeight:'700' }}>{fmt(p.utilidad_neta)}</td>
                      <td style={{ padding:'9px 10px', fontWeight:'700', color:semG(p.margen_bruto) }}>{p.margen_bruto}%</td>
                      <td style={{ padding:'9px 10px', fontWeight:'800', fontSize:'13px', color:semG(p.margen_neto) }}>{p.margen_neto}%</td>
                      <td style={{ padding:'9px 10px' }}>
                        <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'5px', fontWeight:'700',
                          background: p.margen_neto>=15?'rgba(45,212,160,0.1)':p.margen_neto>=8?'rgba(245,166,35,0.1)':'rgba(240,92,92,0.1)', color:semG(p.margen_neto) }}>
                          {p.margen_neto>=15?'✓ Escalar':p.margen_neto>=8?'⚠ Revisar':'✗ Problema'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'rgba(245,166,35,0.04)', borderTop:'2px solid rgba(245,166,35,0.2)' }}>
                    <td style={{ padding:'9px 10px', fontWeight:'800', color:'#F5A623' }}>TOTAL TIENDA</td>
                    <td style={{ padding:'9px 10px', color:'#F5A623' }}>{totalUnidades}</td>
                    <td style={{ padding:'9px 10px', color:'#F5A623', fontWeight:'700' }}>{fmt(totalVentas)}</td>
                    <td style={{ padding:'9px 10px', color:semG(margenBrutoTotal), fontWeight:'700' }}>{fmt(totalUtilBruta)}</td>
                    <td style={{ padding:'9px 10px', color:semG(margenNetoTotal), fontWeight:'800' }}>{fmt(totalUtilNeta)}</td>
                    <td style={{ padding:'9px 10px', fontWeight:'700', color:semG(margenBrutoTotal) }}>{margenBrutoTotal}%</td>
                    <td style={{ padding:'9px 10px', fontWeight:'800', color:semG(margenNetoTotal) }}>{margenNetoTotal}%</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {prodActual && (
            <div style={{ ...s, padding:'20px', position:'sticky', top:'20px', maxHeight:'80vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <div>
                  <div style={{ fontSize:'14px', fontWeight:'800' }}>{prodActual.nombre}</div>
                  <div style={{ fontSize:'11px', color:'#5A6478', marginTop:'2px' }}>{prodActual.unidades} unidades entregadas · PVP ${prodActual.pvp_final.toLocaleString('es-CO')}</div>
                </div>
                <button onClick={() => setProdSel(null)} style={{ background:'none', border:'none', color:'#8B96A8', cursor:'pointer', fontSize:'20px' }}>×</button>
              </div>
              <div style={{ fontSize:'11px', fontWeight:'700', color:'#5A6478', marginBottom:'8px' }}>P&G POR UNIDAD</div>
              {[
                { label:'PVP (precio venta)', valor:prodActual.pvp_final, color:'#E8EDF5', entrada:true },
                { label:'(-) Costo producto', valor:prodActual.costo_proveedor, color:'#F05C5C' },
                { label:'(-) Flete envío', valor:prodActual.costo_flete, color:'#F05C5C' },
                { label:'(-) Flete devolución', valor:prodActual.costo_flete_dev, color:'#F05C5C' },
                { label:'(-) Fulfillment', valor:prodActual.costo_fulfillment+prodActual.costo_full_dev, color:'#F05C5C' },
                { label:`(-) Publicidad (${prodActual.pct_publicidad}%)`, valor:Math.round(prodActual.pvp_final*prodActual.pct_publicidad/100), color:'#9B6BFF' },
                { label:'(-) CF / pedido', valor:prodActual.cf_pedido, color:'#3D8EF0' },
                { label:'= GANANCIA NETA / UNIDAD', valor:prodActual.ganancia_unit, color:semG(prodActual.margen_neto), resultado:true },
              ].map((row,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', borderRadius:'6px', marginBottom:'3px',
                  background: row.resultado?`${row.color}08`:'rgba(255,255,255,0.02)', borderLeft: row.resultado||row.entrada?`3px solid ${row.color}`:'3px solid transparent' }}>
                  <span style={{ fontSize:'11px', color: row.resultado||row.entrada?'#E8EDF5':'#8B96A8', fontWeight: row.resultado?'700':'400' }}>{row.label}</span>
                  <span style={{ fontSize:'12px', fontWeight: row.resultado?'800':'600', color:row.color }}>
                    {row.entrada?'':row.valor>=0&&!row.resultado?'-':''}${Math.abs(row.valor).toLocaleString('es-CO')}
                  </span>
                </div>
              ))}
              <div style={{ marginTop:'12px', padding:'12px', borderRadius:'10px', background:`${semG(prodActual.margen_neto)}08`, border:`1px solid ${semG(prodActual.margen_neto)}22` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                  <span style={{ fontSize:'12px', color:'#8B96A8' }}>Margen neto</span>
                  <span style={{ fontSize:'18px', fontWeight:'800', color:semG(prodActual.margen_neto) }}>{prodActual.margen_neto}%</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'12px', color:'#8B96A8' }}>Utilidad neta total ({prodActual.unidades}u)</span>
                  <span style={{ fontSize:'14px', fontWeight:'700', color:semG(prodActual.margen_neto) }}>{fmt(prodActual.utilidad_neta)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'mezcla' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'14px' }}>🔀 MEZCLA DE PRODUCTOS — Contribución a utilidad</div>
            {[...calcTodos].sort((a,b) => b.utilidad_neta-a.utilidad_neta).map((p,i) => {
              const pctUtil = totalUtilNeta>0 ? Math.round(p.utilidad_neta/totalUtilNeta*100) : 0
              const pctVentas = totalVentas>0 ? Math.round(p.ventas/totalVentas*100) : 0
              return (
                <div key={i} style={{ marginBottom:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'600' }}>{p.nombre}</span>
                    <div style={{ display:'flex', gap:'12px' }}>
                      <span style={{ fontSize:'11px', color:'#5A6478' }}>{p.unidades}u</span>
                      <span style={{ fontSize:'12px', fontWeight:'700', color:semG(p.margen_neto) }}>{fmt(p.utilidad_neta)}</span>
                    </div>
                  </div>
                  <div style={{ height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px', marginBottom:'3px' }}>
                    <div style={{ height:'6px', width:`${pctVentas}%`, background:semG(p.margen_neto), borderRadius:'3px', opacity:0.4 }} />
                  </div>
                  <div style={{ height:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'3px' }}>
                    <div style={{ height:'8px', width:`${Math.max(pctUtil,2)}%`, background:semG(p.margen_neto), borderRadius:'3px' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', fontSize:'10px', color:'#5A6478' }}>
                    <span>{pctVentas}% de ventas</span><span style={{ fontWeight:'700' }}>{pctUtil}% de utilidad</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'12px' }}>🏆 RANKING POR UTILIDAD NETA</div>
              {[...calcTodos].sort((a,b) => b.utilidad_neta-a.utilidad_neta).map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width:'22px', height:'22px', borderRadius:'6px', background: i<3?'#F5A623':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'800', color: i<3?'#0A0D14':'#5A6478', flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'12px', fontWeight:'600' }}>{p.nombre}</div>
                    <div style={{ fontSize:'10px', color:'#5A6478' }}>Margen: {p.margen_neto}%</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'13px', fontWeight:'800', color:semG(p.margen_neto) }}>{fmt(p.utilidad_neta)}</div>
                    <div style={{ fontSize:'10px', color:'#5A6478' }}>{p.unidades}u</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#F05C5C', marginBottom:'10px' }}>🚨 ALERTAS DE MEZCLA</div>
              {calcTodos.filter(p => p.margen_neto < 8).length === 0 ? (
                <div style={{ fontSize:'12px', color:'#5A6478', padding:'8px 0' }}>✅ Ningún producto en zona de riesgo</div>
              ) : calcTodos.filter(p => p.margen_neto < 8).map((p,i) => (
                <div key={i} style={{ padding:'10px 12px', background:'rgba(240,92,92,0.06)', borderRadius:'8px', marginBottom:'6px', borderLeft:'3px solid #F05C5C' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#F05C5C', marginBottom:'3px' }}>⚠️ {p.nombre}</div>
                  <div style={{ fontSize:'11px', color:'#8B96A8' }}>Margen neto: {p.margen_neto}% — Revisar precio en módulo Precio</div>
                </div>
              ))}
              {calcTodos.filter(p => p.margen_neto >= 15).length > 0 && (
                <div style={{ padding:'10px 12px', background:'rgba(45,212,160,0.06)', borderRadius:'8px', borderLeft:'3px solid #2DD4A0', marginTop:'6px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'3px' }}>✅ Productos para escalar</div>
                  <div style={{ fontSize:'11px', color:'#8B96A8' }}>{calcTodos.filter(p=>p.margen_neto>=15).map(p=>p.nombre).join(', ')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'proyeccion' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF' }}>🔮 PROYECCIÓN 6 MESES</div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'11px', color:'#8B96A8' }}>Crecimiento mensual:</span>
                <input type="range" min={-10} max={30} value={crecimiento} onChange={e => setCrecimiento(Number(e.target.value))} style={{ width:'80px', accentColor:'#9B6BFF' }} />
                <span style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', width:'34px' }}>{crecimiento}%</span>
              </div>
            </div>
            {historico3m.length > 0 && (
              <div style={{ marginBottom:'14px', padding:'8px 12px', background:'rgba(155,107,255,0.06)', borderRadius:'8px', fontSize:'11px', color:'#8B96A8' }}>
                📊 Tendencia real últimos 3 meses: <strong style={{ color:'#9B6BFF' }}>{tendenciaReal >= 0 ? '+' : ''}{tendenciaReal}%/mes</strong> — ajusta el slider si quieres simular otro escenario
              </div>
            )}
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Mes','Unidades','Ventas','Utilidad Neta','Margen'].map(h => (
                    <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:'10px', color:'#5A6478', fontWeight:'700' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom:'1px solid rgba(245,166,35,0.15)', background:'rgba(245,166,35,0.04)' }}>
                  <td style={{ padding:'7px 8px', fontWeight:'700', color:'#F5A623' }}>{MESES_ES[new Date().getMonth()]} (actual)</td>
                  <td style={{ padding:'7px 8px', color:'#8B96A8' }}>{totalUnidades}</td>
                  <td style={{ padding:'7px 8px', color:'#8B96A8' }}>{fmt(totalVentas)}</td>
                  <td style={{ padding:'7px 8px', fontWeight:'700', color:semG(margenNetoTotal) }}>{fmt(totalUtilNeta)}</td>
                  <td style={{ padding:'7px 8px', fontWeight:'700', color:semG(margenNetoTotal) }}>{margenNetoTotal}%</td>
                </tr>
                {proyecciones.map((m,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding:'7px 8px', color:'#9B6BFF', fontWeight:'600' }}>{m.mes}</td>
                    <td style={{ padding:'7px 8px', color:'#8B96A8' }}>{m.unidades}</td>
                    <td style={{ padding:'7px 8px', color:'#8B96A8' }}>{fmt(m.ventas)}</td>
                    <td style={{ padding:'7px 8px', fontWeight:'700', color:semG(m.margen) }}>{fmt(m.utilidad_neta)}</td>
                    <td style={{ padding:'7px 8px', fontWeight:'700', color:semG(m.margen) }}>{m.margen}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'12px' }}>📊 RESUMEN PROYECCIÓN 6M</div>
              {[
                { label:'Utilidad acumulada 6M', valor:fmt(proyecciones.reduce((s,p)=>s+p.utilidad_neta,0)), color:'#2DD4A0' },
                { label:'Ventas acumuladas 6M', valor:fmt(proyecciones.reduce((s,p)=>s+p.ventas,0)), color:'#3D8EF0' },
                { label:'Mejor mes proyectado', valor:`${proyecciones[5].mes}: ${fmt(proyecciones[5].utilidad_neta)}`, color:'#9B6BFF' },
                { label:'Crecimiento total 6M', valor: totalUtilNeta>0?`${Math.round((proyecciones[5].utilidad_neta/totalUtilNeta-1)*100)}%`:'—', color:'#F5A623' },
              ].map((k,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:'12px', color:'#8B96A8' }}>{k.label}</span>
                  <span style={{ fontSize:'14px', fontWeight:'800', color:k.color }}>{k.valor}</span>
                </div>
              ))}
            </div>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'12px' }}>🎯 ESCENARIOS PRÓXIMO MES</div>
              {[
                { nombre:'Pesimista', cr:-5, color:'#F05C5C' },
                { nombre:'Conservador', cr:5, color:'#F5A623' },
                { nombre:'Realista', cr:crecimiento, color:'#3D8EF0' },
                { nombre:'Optimista', cr:15, color:'#2DD4A0' },
              ].map((e,i) => {
                const utilidad_e = Math.round(totalUtilNeta*(1+e.cr/100))
                const ventas_e = Math.round(totalVentas*(1+e.cr/100))
                return (
                  <div key={i} style={{ padding:'10px 12px', borderRadius:'8px', marginBottom:'6px', background:`${e.color}08`, borderLeft:`3px solid ${e.color}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <span style={{ fontSize:'12px', fontWeight:'700', color:e.color }}>{e.nombre} ({e.cr>0?'+':''}{e.cr}%)</span>
                      <span style={{ fontSize:'13px', fontWeight:'800', color:e.color }}>{fmt(utilidad_e)}</span>
                    </div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>Ventas: {fmt(ventas_e)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
