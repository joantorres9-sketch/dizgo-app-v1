'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

type Producto = {
  id:string; nombre:string; pvp_final:number; costo_proveedor:number; costo_flete:number
  costo_flete_dev:number; costo_fulfillment:number; costo_full_dev:number; cf_pedido:number
  pct_publicidad:number; pct_pub_dev:number; pct_pub_cancel:number; pct_desc_popup:number
  pct_com_plataforma:number; pct_pasarela:number; pct_com_pasarela:number; pct_com_ventas:number; pct_com_admin:number
}
type CXP = {
  id:string; tercero:string; tipo_tercero:string; concepto:string; valor:number
  fecha_emision:string; fecha_vencimiento:string; fecha_pago:string|null
  estado:string; categoria_flujo:string; metodo_pago:string|null
}
type MovCaja = {
  id:string; fecha:string; concepto:string; tipo:string; valor:number
  origen:string; categoria_flujo:string
}

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const TIPO_TERCERO_INFO: Record<string,{l:string;c:string;icon:string}> = {
  proveedor:{l:'Proveedor',c:'#3D8EF0',icon:'📦'}, nomina:{l:'Nómina',c:'#9B6BFF',icon:'👤'},
  prestaciones_sociales:{l:'Prestaciones',c:'#F5A623',icon:'🛡️'}, contratista:{l:'Contratista',c:'#2DD4A0',icon:'🔧'},
  prestador_servicios:{l:'Prestador servicio',c:'#F05C5C',icon:'💼'}, otro:{l:'Otro',c:'#8B96A8',icon:'📄'},
}
function semG(mg:number){ return mg>=15?'#2DD4A0':mg>=8?'#F5A623':'#F05C5C' }
function semLiq(r:number){ return r>=1.5?'#2DD4A0':r>=1?'#F5A623':'#F05C5C' }
function fmt(n:number){ return n>=1000000?`$${(n/1000000).toFixed(1)}M`:n>=1000?`$${Math.round(n/1000)}K`:`$${Math.round(n)}` }
function fmtFull(n:number){ return `$${Math.round(n).toLocaleString('es-CO')}` }
const s:React.CSSProperties = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }

export default function PYGPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'resultados'|'producto'|'mezcla'|'flujo_caja'|'balance'|'cxp'|'libro_caja'>('resultados')

  const [productos, setProductos] = useState<Producto[]>([])
  const [pedidosPorProducto, setPedidosPorProducto] = useState<Record<string,{unidades:number;ventas:number;ganancia:number}>>({})
  const [historicoMensual, setHistoricoMensual] = useState<{ mes:string; periodo:string; ventas:number; costos:number; utilidad:number; margen:number }[]>([])
  const [cfMes, setCfMes] = useState(0)
  const [walletSaldo, setWalletSaldo] = useState(0)
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState(0)
  const [activosFijos, setActivosFijos] = useState(0)
  const [saldoCreditosLP, setSaldoCreditosLP] = useState(0)
  const [cuotaCreditosCP, setCuotaCreditosCP] = useState(0)
  const [cxp, setCxp] = useState<CXP[]>([])
  const [movimientosCaja, setMovimientosCaja] = useState<MovCaja[]>([])
  const [flujoOperativo, setFlujoOperativo] = useState({ entrada:0, salida:0 })
  const [flujoInversion, setFlujoInversion] = useState({ entrada:0, salida:0 })
  const [flujoFinanciacion, setFlujoFinanciacion] = useState({ entrada:0, salida:0 })

  // Form nueva CXP
  const [nuevaCxp, setNuevaCxp] = useState({ tercero:'', tipo_tercero:'proveedor', concepto:'', valor:0, fecha_vencimiento:'', categoria_flujo:'operativo' })
  // Form movimiento manual caja
  const [nuevoMov, setNuevoMov] = useState({ concepto:'', tipo:'salida', valor:0, categoria_flujo:'operativo' })

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

    const hoy = new Date()
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`
    const iniMes = `${periodo.slice(0,7)}-01`
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).toISOString().slice(0,10)
    const ini30 = new Date(hoy.getTime()-30*86400000).toISOString()

    const [
      { data: prodsData }, { data: costosData }, { data: walletData },
      { data: pedidosTransito }, { data: activosData }, { data: creditosData },
      { data: cxpData }, { data: movData }, { data: pedidosMesProducto },
    ] = await Promise.all([
      supabase.from('productos').select('id, nombre, pvp_final, costo_proveedor, costo_flete, costo_flete_dev, costo_fulfillment, costo_full_dev, cf_pedido, pct_publicidad, pct_pub_dev, pct_pub_cancel, pct_desc_popup, pct_com_plataforma, pct_pasarela, pct_com_pasarela, pct_com_ventas, pct_com_admin').eq('tenant_id', tid).eq('tipo','producto').eq('estado','activo'),
      supabase.from('costos_fijos').select('total').eq('tenant_id', tid).eq('periodo', periodo).eq('activo', true),
      supabase.from('wallet_transacciones').select('tipo, monto').eq('tenant_id', tid),
      supabase.from('pedidos').select('pvp').eq('tenant_id', tid).gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes+'T23:59:59')
        .not('estado', 'in', '(entregado,cancelado,devolucion)'),
      supabase.from('inversiones_activos').select('valor').eq('tenant_id', tid).eq('activo', true),
      supabase.from('inversiones_creditos').select('cuota_mensual, monto, plazo_meses').eq('tenant_id', tid).eq('estado','activo'),
      supabase.from('cuentas_por_pagar').select('*').eq('tenant_id', tid).order('fecha_vencimiento', { ascending:true }),
      supabase.from('libro_caja').select('*').eq('tenant_id', tid).gte('fecha', ini30.slice(0,10)).order('fecha', { ascending:false }),
      supabase.from('pedidos').select('producto_id, pvp, ganancia, estado').eq('tenant_id', tid)
        .eq('estado','entregado').gte('fecha_pedido', iniMes).lte('fecha_pedido', finMes+'T23:59:59'),
    ])

    setProductos((prodsData||[]) as Producto[])

    const porProd: Record<string,{unidades:number;ventas:number;ganancia:number}> = {}
    ;(pedidosMesProducto||[]).forEach((p:{producto_id:string;pvp:number;ganancia:number}) => {
      if (!p.producto_id) return
      if (!porProd[p.producto_id]) porProd[p.producto_id] = { unidades:0, ventas:0, ganancia:0 }
      porProd[p.producto_id].unidades++
      porProd[p.producto_id].ventas += Number(p.pvp||0)
      porProd[p.producto_id].ganancia += Number(p.ganancia||0)
    })
    setPedidosPorProducto(porProd)

    setCfMes(Math.round((costosData||[]).reduce((a:number,c:{total:number})=>a+Number(c.total||0),0)))

    const wRows = (walletData||[]) as { tipo:string; monto:number }[]
    setWalletSaldo(Math.round(wRows.filter(w=>w.tipo==='ENTRADA').reduce((a,w)=>a+Number(w.monto),0) - wRows.filter(w=>w.tipo==='SALIDA').reduce((a,w)=>a+Number(w.monto),0)))

    setCuentasPorCobrar(Math.round((pedidosTransito||[]).reduce((a:number,p:{pvp:number})=>a+Number(p.pvp||0),0)))
    setActivosFijos(Math.round((activosData||[]).reduce((a:number,x:{valor:number})=>a+Number(x.valor||0),0)))

    const creditosRows = (creditosData||[]) as { cuota_mensual:number; monto:number; plazo_meses:number }[]
    setCuotaCreditosCP(Math.round(creditosRows.reduce((a,c)=>a+Number(c.cuota_mensual||0),0)))
    setSaldoCreditosLP(Math.round(creditosRows.reduce((a,c)=>a+Number(c.monto||0),0)))

    setCxp((cxpData||[]) as CXP[])
    const movs = (movData||[]) as MovCaja[]
    setMovimientosCaja(movs)

    const sumFlujo = (cat:string, tipo:string) => movs.filter(m=>m.categoria_flujo===cat && m.tipo===tipo).reduce((a,m)=>a+Number(m.valor||0),0)
    setFlujoOperativo({ entrada: sumFlujo('operativo','entrada'), salida: sumFlujo('operativo','salida') })
    setFlujoInversion({ entrada: sumFlujo('inversion','entrada'), salida: sumFlujo('inversion','salida') })
    setFlujoFinanciacion({ entrada: sumFlujo('financiacion','entrada'), salida: sumFlujo('financiacion','salida') })

    // Histórico 6 meses reales para Estado de Resultados
    const hist = await Promise.all([5,4,3,2,1,0].map(async (i) => {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1)
      const ini = fecha.toISOString().slice(0,10)
      const fin = new Date(fecha.getFullYear(), fecha.getMonth()+1, 0).toISOString().slice(0,10)
      const per = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-01`
      const [{ data: pedHist }, { data: cfHist }] = await Promise.all([
        supabase.from('pedidos').select('pvp, ganancia').eq('tenant_id', tid).eq('estado','entregado').gte('fecha_pedido', ini).lte('fecha_pedido', fin+'T23:59:59'),
        supabase.from('costos_fijos').select('total').eq('tenant_id', tid).eq('periodo', per).eq('activo', true),
      ])
      const rows = (pedHist||[]) as { pvp:number; ganancia:number }[]
      const ventas = rows.reduce((a,r)=>a+Number(r.pvp||0),0)
      const utilidad = rows.reduce((a,r)=>a+Number(r.ganancia||0),0)
      const cfH = (cfHist||[]).reduce((a:number,c:{total:number})=>a+Number(c.total||0),0)
      const costos = ventas - utilidad + cfH
      return { mes: MESES_ES[fecha.getMonth()], periodo: per, ventas, costos, utilidad: ventas-costos, margen: ventas>0?Math.round((ventas-costos)/ventas*100):0 }
    }))
    setHistoricoMensual(hist)

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const activoCorriente = walletSaldo + cuentasPorCobrar
  const activoTotal = activoCorriente + activosFijos
  const pasivoCorriente = cxp.filter(c=>c.estado==='pendiente').reduce((a,c)=>a+Number(c.valor),0) + cuotaCreditosCP
  const pasivoTotal = pasivoCorriente + saldoCreditosLP
  const patrimonio = activoTotal - pasivoTotal
  const razonCorriente = pasivoCorriente>0 ? Math.round((activoCorriente/pasivoCorriente)*100)/100 : 0
  const capitalTrabajo = activoCorriente - pasivoCorriente

  const mesActual = historicoMensual[historicoMensual.length-1] || { ventas:0, costos:0, utilidad:0, margen:0, mes:'', periodo:'' }

  // ── P&G POR PRODUCTO — usando datos reales de pedidos entregados del mes ──
  function calcProd(p: Producto) {
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
    const margen_bruto = ventas>0 ? Math.round(utilidad_bruta/ventas*100) : 0
    const margen_neto = ventas>0 ? Math.round(utilidad_neta/ventas*100) : 0
    return { ...p, unidades, ventas, costo_prod, flete_env, flete_dev, fulfill, pub, comision, cf, total_costos, utilidad_bruta, utilidad_neta, margen_bruto, margen_neto }
  }
  const calcTodos = productos.map(calcProd).filter(p => p.unidades > 0).sort((a,b) => b.utilidad_neta-a.utilidad_neta)
  const totalUnidadesProd = calcTodos.reduce((a,p)=>a+p.unidades,0)
  const totalVentasProd = calcTodos.reduce((a,p)=>a+p.ventas,0)
  const totalUtilNetaProd = calcTodos.reduce((a,p)=>a+p.utilidad_neta,0)

  const flujoNetoOperativo = flujoOperativo.entrada - flujoOperativo.salida
  const flujoNetoInversion = flujoInversion.entrada - flujoInversion.salida
  const flujoNetoFinanciacion = flujoFinanciacion.entrada - flujoFinanciacion.salida
  const flujoNetoTotal = flujoNetoOperativo + flujoNetoInversion + flujoNetoFinanciacion

  async function guardarCxp() {
    if (!nuevaCxp.tercero || !nuevaCxp.concepto || !nuevaCxp.valor || !nuevaCxp.fecha_vencimiento || !tenantId) return
    const { data } = await supabase.from('cuentas_por_pagar').insert({
      tenant_id: tenantId, tercero: nuevaCxp.tercero, tipo_tercero: nuevaCxp.tipo_tercero,
      concepto: nuevaCxp.concepto, valor: nuevaCxp.valor, fecha_vencimiento: nuevaCxp.fecha_vencimiento,
      categoria_flujo: nuevaCxp.categoria_flujo, estado: 'pendiente',
    }).select().single()
    if (data) setCxp(prev => [data as CXP, ...prev])
    setNuevaCxp({ tercero:'', tipo_tercero:'proveedor', concepto:'', valor:0, fecha_vencimiento:'', categoria_flujo:'operativo' })
  }

  async function pagarCxp(item: CXP) {
    const hoy = new Date().toISOString().slice(0,10)
    await supabase.from('cuentas_por_pagar').update({ estado:'pagado', fecha_pago: hoy }).eq('id', item.id)
    setCxp(prev => prev.map(c => c.id===item.id ? { ...c, estado:'pagado', fecha_pago:hoy } : c))
    await supabase.from('libro_caja').insert({
      tenant_id: tenantId, fecha: hoy, concepto: `Pago a ${item.tercero} — ${item.concepto}`,
      tipo: 'salida', valor: item.valor, origen: 'cuentas_por_pagar',
      referencia_tabla: 'cuentas_por_pagar', referencia_id: item.id, categoria_flujo: item.categoria_flujo,
    })
    loadData()
  }

  async function guardarMovimientoManual() {
    if (!nuevoMov.concepto || !nuevoMov.valor || !tenantId) return
    const { data:{ user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('libro_caja').insert({
      tenant_id: tenantId, fecha: new Date().toISOString().slice(0,10),
      concepto: nuevoMov.concepto, tipo: nuevoMov.tipo, valor: nuevoMov.valor,
      origen: 'manual', categoria_flujo: nuevoMov.categoria_flujo, registrado_por: user?.id,
    }).select().single()
    if (data) setMovimientosCaja(prev => [data as MovCaja, ...prev])
    setNuevoMov({ concepto:'', tipo:'salida', valor:0, categoria_flujo:'operativo' })
  }

  function exportarExcel() {
    const filas = [
      ['ESTADO DE RESULTADOS — DIZGO'],
      ['Mes','Ventas','Costos','Utilidad','Margen %'],
      ...historicoMensual.map(h => [h.mes, h.ventas, h.costos, h.utilidad, h.margen]),
      [], ['BALANCE GENERAL'],
      ['Activo corriente', activoCorriente], ['Activo fijo', activosFijos], ['Activo total', activoTotal],
      ['Pasivo corriente', pasivoCorriente], ['Pasivo largo plazo', saldoCreditosLP], ['Pasivo total', pasivoTotal],
      ['Patrimonio', patrimonio],
    ]
    const ws = XLSX.utils.aoa_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'P&G')
    XLSX.writeFile(wb, `DIZGO_PyG_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Consolidando información financiera...
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🏛️ Suite Financiera P&G</h1>
          <p style={{ fontSize:'13px', color:'#8B96A8' }}>Resultados · Flujo de Caja · Balance · Cuentas por Pagar · Libro de Caja</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={exportarExcel} style={{ padding:'8px 14px', background:'rgba(45,212,160,0.1)', border:'none', borderRadius:'8px', color:'#2DD4A0', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>📊 Excel</button>
          <button onClick={() => window.print()} style={{ padding:'8px 14px', background:'rgba(240,92,92,0.1)', border:'none', borderRadius:'8px', color:'#F05C5C', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>📄 PDF</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {[
          { l:'Utilidad neta (mes)', v:fmt(mesActual.utilidad), c:semG(mesActual.margen), icon:'💎' },
          { l:'Caja disponible', v:fmt(walletSaldo), c:'#2DD4A0', icon:'💰' },
          { l:'Por cobrar (en tránsito)', v:fmt(cuentasPorCobrar), c:'#3D8EF0', icon:'🚚' },
          { l:'Por pagar pendiente', v:fmt(pasivoCorriente), c:'#F5A623', icon:'📋' },
          { l:'Liquidez (razón corriente)', v:razonCorriente.toFixed(2), c:semLiq(razonCorriente), icon:'⚖️' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px', borderTop:`2px solid ${k.c}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:'#8B96A8' }}>{k.l}</span><span>{k.icon}</span>
            </div>
            <div style={{ fontSize:'17px', fontWeight:'800', color:k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { key:'resultados', label:'📈 Estado de Resultados' },
          { key:'producto', label:'📦 P&G por Producto' },
          { key:'mezcla', label:'🔀 Mezcla de Productos' },
          { key:'flujo_caja', label:'💧 Flujo de Caja' },
          { key:'balance', label:'⚖️ Balance General' },
          { key:'cxp', label:`📋 Cuentas por Pagar (${cxp.filter(c=>c.estado==='pendiente').length})` },
          { key:'libro_caja', label:'📒 Libro de Caja' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding:'8px 14px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              background: tab===t.key?'#F5A623':'rgba(255,255,255,0.05)', color: tab===t.key?'#0A0D14':'#8B96A8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resultados' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>📈 Histórico 6 meses — Estado de Resultados</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:'#0A0D14', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Mes','Ventas','Costos','Utilidad','Margen'].map(h => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'10px', color:'#5A6478', fontWeight:'700' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historicoMensual.map((h,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)', background: i===historicoMensual.length-1?'rgba(245,166,35,0.04)':'transparent' }}>
                    <td style={{ padding:'8px 10px', fontWeight: i===historicoMensual.length-1?'700':'400', color: i===historicoMensual.length-1?'#F5A623':'#E8EDF5' }}>{h.mes}</td>
                    <td style={{ padding:'8px 10px', color:'#8B96A8' }}>{fmt(h.ventas)}</td>
                    <td style={{ padding:'8px 10px', color:'#F05C5C' }}>{fmt(h.costos)}</td>
                    <td style={{ padding:'8px 10px', fontWeight:'700', color:semG(h.margen) }}>{fmt(h.utilidad)}</td>
                    <td style={{ padding:'8px 10px', fontWeight:'700', color:semG(h.margen) }}>{h.margen}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'14px' }}>💰 CASCADA DEL MES ACTUAL ({mesActual.mes})</div>
            {[
              { c:'VENTAS BRUTAS', v:mesActual.ventas, color:'#E8EDF5', bold:true },
              { c:'(-) Costos totales del mes', v:-mesActual.costos, color:'#F05C5C' },
              { c:'= UTILIDAD NETA', v:mesActual.utilidad, color:semG(mesActual.margen), bold:true },
            ].map((row,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom: row.bold?'2px solid rgba(255,255,255,0.08)':'1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: row.bold?'13px':'12px', fontWeight: row.bold?'700':'400', color: row.bold?'#E8EDF5':'#8B96A8' }}>{row.c}</span>
                <span style={{ fontSize: row.bold?'16px':'13px', fontWeight: row.bold?'800':'600', color:row.color }}>{fmtFull(Math.abs(row.v))}</span>
              </div>
            ))}
            <div style={{ marginTop:'14px', padding:'12px', background:`${semG(mesActual.margen)}08`, borderRadius:'10px', border:`1px solid ${semG(mesActual.margen)}22` }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'12px', color:'#8B96A8' }}>Margen neto del mes</span>
                <span style={{ fontSize:'20px', fontWeight:'800', color:semG(mesActual.margen) }}>{mesActual.margen}%</span>
              </div>
            </div>
            <div style={{ marginTop:'10px', fontSize:'11px', color:'#5A6478' }}>{productos.length} productos activos en catálogo</div>
          </div>
        </div>
      )}

      {tab === 'producto' && (
        <div style={{ ...s, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>📦 P&G por producto — pedidos entregados este mes</div>
          {calcTodos.length === 0 ? (
            <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin pedidos entregados este mes por producto</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:'#0A0D14', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Producto','Unid.','Ventas','Util.Bruta','Util.Neta','MB%','MN%'].map(h => (
                    <th key={h} style={{ padding:'9px 10px', textAlign:'left', fontSize:'10px', color:'#5A6478', fontWeight:'700' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calcTodos.map((p,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding:'9px 10px', fontWeight:'600' }}>{p.nombre}</td>
                    <td style={{ padding:'9px 10px', color:'#8B96A8' }}>{p.unidades}</td>
                    <td style={{ padding:'9px 10px', color:'#E8EDF5' }}>{fmt(p.ventas)}</td>
                    <td style={{ padding:'9px 10px', color:semG(p.margen_bruto) }}>{fmt(p.utilidad_bruta)}</td>
                    <td style={{ padding:'9px 10px', fontWeight:'700', color:semG(p.margen_neto) }}>{fmt(p.utilidad_neta)}</td>
                    <td style={{ padding:'9px 10px', fontWeight:'700', color:semG(p.margen_bruto) }}>{p.margen_bruto}%</td>
                    <td style={{ padding:'9px 10px', fontWeight:'800', color:semG(p.margen_neto) }}>{p.margen_neto}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'rgba(245,166,35,0.04)', borderTop:'2px solid rgba(245,166,35,0.2)' }}>
                  <td style={{ padding:'9px 10px', fontWeight:'800', color:'#F5A623' }}>TOTAL</td>
                  <td style={{ padding:'9px 10px', color:'#F5A623' }}>{totalUnidadesProd}</td>
                  <td style={{ padding:'9px 10px', color:'#F5A623', fontWeight:'700' }}>{fmt(totalVentasProd)}</td>
                  <td colSpan={2} style={{ padding:'9px 10px', color:semG(totalVentasProd>0?Math.round(totalUtilNetaProd/totalVentasProd*100):0), fontWeight:'800' }}>{fmt(totalUtilNetaProd)}</td>
                  <td colSpan={2} style={{ padding:'9px 10px', fontWeight:'800', color:semG(totalVentasProd>0?Math.round(totalUtilNetaProd/totalVentasProd*100):0) }}>{totalVentasProd>0?Math.round(totalUtilNetaProd/totalVentasProd*100):0}%</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {tab === 'mezcla' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'14px' }}>🔀 MEZCLA — Contribución a utilidad</div>
            {calcTodos.length === 0 ? (
              <div style={{ fontSize:'12px', color:'#5A6478', textAlign:'center', padding:'20px' }}>Sin datos este mes</div>
            ) : calcTodos.map((p,i) => {
              const pctUtil = totalUtilNetaProd>0 ? Math.round(p.utilidad_neta/totalUtilNetaProd*100) : 0
              const pctVentas = totalVentasProd>0 ? Math.round(p.ventas/totalVentasProd*100) : 0
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
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F05C5C', marginBottom:'12px' }}>🚨 ALERTAS DE MEZCLA</div>
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
      )}

      {tab === 'flujo_caja' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'14px' }}>💧 ESTADO DE FLUJO DE EFECTIVO — Método directo NIIF (30 días)</div>
            {[
              { titulo:'ACTIVIDADES DE OPERACIÓN', entrada:flujoOperativo.entrada, salida:flujoOperativo.salida, neto:flujoNetoOperativo, color:'#2DD4A0' },
              { titulo:'ACTIVIDADES DE INVERSIÓN', entrada:flujoInversion.entrada, salida:flujoInversion.salida, neto:flujoNetoInversion, color:'#9B6BFF' },
              { titulo:'ACTIVIDADES DE FINANCIACIÓN', entrada:flujoFinanciacion.entrada, salida:flujoFinanciacion.salida, neto:flujoNetoFinanciacion, color:'#F5A623' },
            ].map((f,i) => (
              <div key={i} style={{ marginBottom:'14px', padding:'12px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', borderLeft:`3px solid ${f.color}` }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:f.color, marginBottom:'8px' }}>{f.titulo}</div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px' }}>
                  <span style={{ color:'#8B96A8' }}>Entradas</span><span style={{ color:'#2DD4A0' }}>{fmtFull(f.entrada)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px' }}>
                  <span style={{ color:'#8B96A8' }}>Salidas</span><span style={{ color:'#F05C5C' }}>-{fmtFull(f.salida)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'6px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize:'12px', fontWeight:'700' }}>Flujo neto</span>
                  <span style={{ fontSize:'14px', fontWeight:'800', color: f.neto>=0?'#2DD4A0':'#F05C5C' }}>{fmtFull(f.neto)}</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop:'10px', padding:'14px', background:'rgba(245,166,35,0.06)', borderRadius:'10px', border:'1px solid rgba(245,166,35,0.2)' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'13px', fontWeight:'700' }}>VARIACIÓN NETA DE EFECTIVO</span>
                <span style={{ fontSize:'18px', fontWeight:'800', color: flujoNetoTotal>=0?'#2DD4A0':'#F05C5C' }}>{fmtFull(flujoNetoTotal)}</span>
              </div>
            </div>
          </div>

          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', marginBottom:'14px' }}>🔮 FLUJO PROYECTADO — dinero que viene en camino</div>
            <div style={{ padding:'14px', background:'rgba(155,107,255,0.06)', borderRadius:'10px', marginBottom:'14px' }}>
              <div style={{ fontSize:'11px', color:'#8B96A8', marginBottom:'4px' }}>Cuentas por cobrar — pedidos en tránsito sin entregar</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color:'#9B6BFF' }}>{fmtFull(cuentasPorCobrar)}</div>
              <div style={{ fontSize:'10px', color:'#5A6478', marginTop:'4px' }}>Este dinero entra a caja entre 5-11 días después de cada entrega (recaudo transportadora)</div>
            </div>
            <div style={{ padding:'14px', background:'rgba(245,166,35,0.06)', borderRadius:'10px', marginBottom:'14px' }}>
              <div style={{ fontSize:'11px', color:'#8B96A8', marginBottom:'4px' }}>Compromisos de salida — cuentas por pagar pendientes</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color:'#F5A623' }}>{fmtFull(pasivoCorriente)}</div>
              <div style={{ fontSize:'10px', color:'#5A6478', marginTop:'4px' }}>Incluye proveedores, nómina, contratistas y cuotas de crédito del mes</div>
            </div>
            <div style={{ padding:'14px', borderRadius:'10px', background: (cuentasPorCobrar-pasivoCorriente)>=0?'rgba(45,212,160,0.06)':'rgba(240,92,92,0.06)', border:`1px solid ${(cuentasPorCobrar-pasivoCorriente)>=0?'rgba(45,212,160,0.2)':'rgba(240,92,92,0.2)'}` }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color: (cuentasPorCobrar-pasivoCorriente)>=0?'#2DD4A0':'#F05C5C', marginBottom:'6px' }}>
                {(cuentasPorCobrar-pasivoCorriente)>=0 ? '✅ Cobertura suficiente' : '⚠️ Brecha de caja proyectada'}
              </div>
              <div style={{ fontSize:'12px', color:'#8B96A8', lineHeight:'1.6' }}>
                Lo que viene ({fmt(cuentasPorCobrar)}) {(cuentasPorCobrar-pasivoCorriente)>=0?'cubre':'no cubre'} lo que debes pagar pronto ({fmt(pasivoCorriente)}).
                Diferencia: <strong style={{ color: (cuentasPorCobrar-pasivoCorriente)>=0?'#2DD4A0':'#F05C5C' }}>{fmt(Math.abs(cuentasPorCobrar-pasivoCorriente))}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'balance' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>⚖️ Estado de Situación Financiera (Balance — parcial)</div>
            <div style={{ padding:'16px' }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:'#2DD4A0', marginBottom:'8px' }}>ACTIVO</div>
              {[
                { l:'Caja (Wallet)', v:walletSaldo },
                { l:'Cuentas por cobrar', v:cuentasPorCobrar },
                { l:'Activos fijos (Inversión)', v:activosFijos },
              ].map((r,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:'12px' }}>
                  <span style={{ color:'#8B96A8' }}>{r.l}</span><span style={{ color:'#E8EDF5' }}>{fmtFull(r.v)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:'1px solid rgba(255,255,255,0.08)', marginTop:'6px' }}>
                <span style={{ fontSize:'13px', fontWeight:'700' }}>TOTAL ACTIVO</span><span style={{ fontSize:'15px', fontWeight:'800', color:'#2DD4A0' }}>{fmtFull(activoTotal)}</span>
              </div>

              <div style={{ fontSize:'11px', fontWeight:'700', color:'#F05C5C', marginTop:'18px', marginBottom:'8px' }}>PASIVO</div>
              {[
                { l:'Cuentas por pagar', v: cxp.filter(c=>c.estado==='pendiente').reduce((a,c)=>a+Number(c.valor),0) },
                { l:'Cuota créditos (mes)', v:cuotaCreditosCP },
                { l:'Saldo créditos (largo plazo)', v:saldoCreditosLP },
              ].map((r,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:'12px' }}>
                  <span style={{ color:'#8B96A8' }}>{r.l}</span><span style={{ color:'#E8EDF5' }}>{fmtFull(r.v)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:'1px solid rgba(255,255,255,0.08)', marginTop:'6px' }}>
                <span style={{ fontSize:'13px', fontWeight:'700' }}>TOTAL PASIVO</span><span style={{ fontSize:'15px', fontWeight:'800', color:'#F05C5C' }}>{fmtFull(pasivoTotal)}</span>
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', marginTop:'12px', background:'rgba(245,166,35,0.06)', borderRadius:'8px', paddingLeft:'10px', paddingRight:'10px' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#F5A623' }}>PATRIMONIO</span><span style={{ fontSize:'18px', fontWeight:'900', color:'#F5A623' }}>{fmtFull(patrimonio)}</span>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'14px' }}>🚦 SEMÁFOROS DE SALUD FINANCIERA</div>
              {[
                { l:'Razón corriente', v:razonCorriente.toFixed(2), color:semLiq(razonCorriente), desc: razonCorriente>=1.5?'Liquidez sólida':razonCorriente>=1?'Liquidez ajustada':'Riesgo de iliquidez' },
                { l:'Capital de trabajo', v:fmtFull(capitalTrabajo), color: capitalTrabajo>=0?'#2DD4A0':'#F05C5C', desc: capitalTrabajo>=0?'Activo corriente cubre el pasivo':'Pasivo corriente supera el activo' },
                { l:'Patrimonio', v:fmtFull(patrimonio), color: patrimonio>=0?'#2DD4A0':'#F05C5C', desc: patrimonio>=0?'Empresa solvente':'Patrimonio negativo — alerta'},
              ].map((k,i) => (
                <div key={i} style={{ ...s, padding:'12px', marginBottom:'8px', borderLeft:`3px solid ${k.color}`, background:'#0A0D14' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'12px', color:'#8B96A8' }}>{k.l}</span>
                    <span style={{ fontSize:'15px', fontWeight:'800', color:k.color }}>{k.v}</span>
                  </div>
                  <div style={{ fontSize:'10px', color:k.color }}>{k.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ ...s, padding:'16px', fontSize:'11px', color:'#5A6478', lineHeight:'1.6' }}>
              📌 Balance parcial bajo NIIF para PYMES. No incluye patrimonio detallado por aportes societarios ni conciliación tributaria — DIZGO es herramienta de gestión operativa, no software contable certificado.
            </div>
          </div>
        </div>
      )}

      {tab === 'cxp' && (
        <div className="dz-grid-side" style={{ ['--side-w' as any]:'360px', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>📋 Cuentas por Pagar — Terceros</div>
            {cxp.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin cuentas por pagar registradas</div>
            ) : cxp.map(c => {
              const info = TIPO_TERCERO_INFO[c.tipo_tercero] || TIPO_TERCERO_INFO.otro
              const vencida = c.estado==='pendiente' && new Date(c.fecha_vencimiento) < new Date()
              return (
                <div key={c.id} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'18px' }}>{info.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'12px', fontWeight:'600' }}>{c.tercero} <span style={{ fontSize:'10px', color:info.c }}>· {info.l}</span></div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>{c.concepto} · vence {c.fecha_vencimiento}</div>
                  </div>
                  <div style={{ fontSize:'13px', fontWeight:'700' }}>{fmtFull(c.valor)}</div>
                  {c.estado==='pendiente' ? (
                    <button onClick={() => pagarCxp(c)} style={{ padding:'5px 10px', background: vencida?'rgba(240,92,92,0.15)':'rgba(245,166,35,0.15)', border:'none', borderRadius:'6px', color: vencida?'#F05C5C':'#F5A623', cursor:'pointer', fontSize:'10px', fontWeight:'700' }}>
                      {vencida?'⚠ Vencida — Pagar':'Pagar'}
                    </button>
                  ) : (
                    <span style={{ fontSize:'10px', padding:'3px 8px', borderRadius:'5px', background:'rgba(45,212,160,0.15)', color:'#2DD4A0', fontWeight:'700' }}>✓ Pagado</span>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'14px' }}>+ Nueva cuenta por pagar</div>
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Tercero</label>
              <input value={nuevaCxp.tercero} onChange={e=>setNuevaCxp(p=>({...p,tercero:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Tipo</label>
              <select value={nuevaCxp.tipo_tercero} onChange={e=>setNuevaCxp(p=>({...p,tipo_tercero:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px', outline:'none' }}>
                {Object.entries(TIPO_TERCERO_INFO).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Concepto</label>
              <input value={nuevaCxp.concepto} onChange={e=>setNuevaCxp(p=>({...p,concepto:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Valor</label>
              <input type="number" value={nuevaCxp.valor||''} onChange={e=>setNuevaCxp(p=>({...p,valor:Number(e.target.value)}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'14px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Fecha vencimiento</label>
              <input type="date" value={nuevaCxp.fecha_vencimiento} onChange={e=>setNuevaCxp(p=>({...p,fecha_vencimiento:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <button onClick={guardarCxp} style={{ width:'100%', padding:'10px', background:'#F5A623', border:'none', borderRadius:'9px', color:'#0A0D14', cursor:'pointer', fontSize:'13px', fontWeight:'700' }}>
              + Registrar
            </button>
          </div>
        </div>
      )}

      {tab === 'libro_caja' && (
        <div className="dz-grid-side" style={{ ['--side-w' as any]:'320px', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>📒 Libro de Caja — últimos 30 días</div>
            {movimientosCaja.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin movimientos registrados</div>
            ) : movimientosCaja.map(m => (
              <div key={m.id} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'10px', color:'#5A6478', width:'70px', flexShrink:0 }}>{m.fecha}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px' }}>{m.concepto}</div>
                  <div style={{ fontSize:'10px', color:'#5A6478' }}>{m.origen} · {m.categoria_flujo}</div>
                </div>
                <span style={{ fontSize:'13px', fontWeight:'700', color: m.tipo==='entrada'?'#2DD4A0':'#F05C5C' }}>
                  {m.tipo==='entrada'?'+':'-'}{fmtFull(m.valor)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'14px' }}>+ Movimiento manual</div>
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Concepto</label>
              <input value={nuevoMov.concepto} onChange={e=>setNuevoMov(p=>({...p,concepto:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:'6px', marginBottom:'10px', flexWrap:'wrap' }}>
              {(['entrada','salida'] as const).map(t => (
                <button key={t} onClick={()=>setNuevoMov(p=>({...p,tipo:t}))}
                  style={{ flex:1, padding:'7px', borderRadius:'7px', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                    border:`1px solid ${nuevoMov.tipo===t?(t==='entrada'?'#2DD4A0':'#F05C5C'):'rgba(255,255,255,0.1)'}`,
                    background: nuevoMov.tipo===t?(t==='entrada'?'rgba(45,212,160,0.1)':'rgba(240,92,92,0.1)'):'transparent',
                    color: nuevoMov.tipo===t?(t==='entrada'?'#2DD4A0':'#F05C5C'):'#8B96A8' }}>
                  {t==='entrada'?'+ Entrada':'- Salida'}
                </button>
              ))}
            </div>
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Valor</label>
              <input type="number" value={nuevoMov.valor||''} onChange={e=>setNuevoMov(p=>({...p,valor:Number(e.target.value)}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'14px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Categoría de flujo</label>
              <select value={nuevoMov.categoria_flujo} onChange={e=>setNuevoMov(p=>({...p,categoria_flujo:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px', outline:'none' }}>
                <option value="operativo">Operativo</option>
                <option value="inversion">Inversión</option>
                <option value="financiacion">Financiación</option>
              </select>
            </div>
            <button onClick={guardarMovimientoManual} style={{ width:'100%', padding:'10px', background:'#F5A623', border:'none', borderRadius:'9px', color:'#0A0D14', cursor:'pointer', fontSize:'13px', fontWeight:'700' }}>
              + Registrar movimiento
            </button>
            <div style={{ marginTop:'12px', fontSize:'10px', color:'#5A6478', lineHeight:'1.5' }}>
              Usa esto para registrar movimientos que el sistema no detecta automáticamente (ej. gastos en efectivo, retiros personales).
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
