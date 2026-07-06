'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Bodega = { id:string; nombre:string; tipo:string; pais_codigo:string; ciudad:string; orden_flujo:number; activa:boolean }
type Inventario = { id:string; producto_id:string; bodega_id:string; cantidad_disponible:number; cantidad_reservada:number; cantidad_en_transito_nacionaliz:number; cantidad_dañada:number; stock_minimo:number }
type Producto = { id:string; nombre:string; modelo_negocio:string; temporada_fin:string|null; pct_devolucion:number; costo_proveedor:number; pvp_final:number; disponible_dropshippers:boolean }
type Pedido = { id:string; producto_id:string; cliente_ciudad:string; estado:string; pvp:number; created_at:string }
type Piscina = { id:string; pedido_id:string; piscina:string; fecha_entrada_piscina:string; tiempo_esperado_horas:number }
type AlertaRiesgo = { id:string; producto_id:string; tipo_riesgo:string; score_riesgo:number; dias_en_bodega:number; recomendacion:string }

const TIPO_BODEGA_INFO: Record<string,{l:string;c:string;icon:string}> = {
  importacion: { l:'Importación', c:'#9B6BFF', icon:'🚢' },
  general: { l:'General', c:'#3D8EF0', icon:'🏭' },
  ciudad: { l:'Ciudad', c:'#2DD4A0', icon:'🏙️' },
  virtual_dropshipping: { l:'Virtual Dropshipping', c:'#F5A623', icon:'☁️' },
}
const PISCINAS_INFO: { v:string; l:string; c:string; horas:number }[] = [
  { v:'confirmado', l:'✅ Confirmado', c:'#3D8EF0', horas:12 },
  { v:'bodega_proveedor', l:'📦 Bodega proveedor', c:'#9B6BFF', horas:24 },
  { v:'recolectado', l:'🚚 Recolectado', c:'#F5A623', horas:12 },
  { v:'en_transito', l:'📍 En tránsito', c:'#3D8EF0', horas:72 },
  { v:'entregado', l:'✅ Entregado', c:'#2DD4A0', horas:0 },
  { v:'devuelto', l:'🔄 Devuelto', c:'#F05C5C', horas:0 },
]
const RIESGO_INFO: Record<string,{l:string;c:string;icon:string}> = {
  alta_oferta: { l:'Alta oferta de mercado', c:'#F5A623', icon:'📉' },
  fin_temporada: { l:'Fin de temporada', c:'#9B6BFF', icon:'🍂' },
  baja_calidad: { l:'Baja calidad / alta devolución', c:'#F05C5C', icon:'⚠️' },
  baja_rotacion: { l:'Baja rotación', c:'#5A6478', icon:'🐢' },
}

const s:React.CSSProperties = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }
function fmt(n:number){ return `$${Math.round(n).toLocaleString('es-CO')}` }
function horasDesde(fecha:string){ return Math.round((Date.now()-new Date(fecha).getTime())/3600000) }

export default function BodegaPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock'|'importacion'|'piscinas'|'riesgo'|'proveedor'>('stock')

  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [inventario, setInventario] = useState<Inventario[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [pedidosRecientes, setPedidosRecientes] = useState<Pedido[]>([])
  const [piscinas, setPiscinas] = useState<Piscina[]>([])
  const [alertasRiesgo, setAlertasRiesgo] = useState<AlertaRiesgo[]>([])

  const [showNuevaBodega, setShowNuevaBodega] = useState(false)
  const [nuevaBodega, setNuevaBodega] = useState({ nombre:'', tipo:'ciudad', ciudad:'', pais_codigo:'COL' })
  const [bodegaSel, setBodegaSel] = useState<string|null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

    const hoy = new Date()
    const ini30 = new Date(hoy.getTime()-30*86400000).toISOString()

    const [{ data: bodData }, { data: invData }, { data: prodsData }, { data: pedData }, { data: piscData }, { data: riesgoData }] = await Promise.all([
      supabase.from('bodegas').select('*').eq('tenant_id', tid).order('orden_flujo'),
      supabase.from('inventario').select('*').eq('tenant_id', tid),
      supabase.from('productos').select('id, nombre, modelo_negocio, temporada_fin, pct_devolucion, costo_proveedor, pvp_final, disponible_dropshippers').eq('tenant_id', tid).eq('tipo','producto').eq('estado','activo'),
      supabase.from('pedidos').select('id, producto_id, cliente_ciudad, estado, pvp, created_at').eq('tenant_id', tid).gte('fecha_pedido', ini30),
      supabase.from('pedido_piscinas').select('*').eq('tenant_id', tid),
      supabase.from('alertas_riesgo_producto').select('*').eq('tenant_id', tid).eq('resuelta', false),
    ])

    setBodegas((bodData||[]) as Bodega[])
    setInventario((invData||[]) as Inventario[])
    setProductos((prodsData||[]) as Producto[])
    setPedidosRecientes((pedData||[]) as Pedido[])
    setPiscinas((piscData||[]) as Piscina[])
    setAlertasRiesgo((riesgoData||[]) as AlertaRiesgo[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const prodsBodegaPropia = productos.filter(p => p.modelo_negocio === 'bodega_propia' || p.modelo_negocio === 'hibrido')
  const prodsDropshipping = productos.filter(p => p.modelo_negocio === 'dropshipping' || !p.modelo_negocio)
  const stockBajo = inventario.filter(i => i.cantidad_disponible <= i.stock_minimo)

  async function crearBodega() {
    if (!nuevaBodega.nombre || !tenantId) return
    const ordenFlujo = nuevaBodega.tipo === 'importacion' ? 1 : nuevaBodega.tipo === 'general' ? 2 : nuevaBodega.tipo === 'virtual_dropshipping' ? 0 : 3
    const { data } = await supabase.from('bodegas').insert({
      tenant_id: tenantId, nombre: nuevaBodega.nombre, tipo: nuevaBodega.tipo,
      ciudad: nuevaBodega.ciudad, pais_codigo: nuevaBodega.pais_codigo, orden_flujo: ordenFlujo, activa: true,
    }).select().single()
    if (data) setBodegas(prev => [...prev, data as Bodega])
    setNuevaBodega({ nombre:'', tipo:'ciudad', ciudad:'', pais_codigo:'COL' })
    setShowNuevaBodega(false)
  }

  async function nacionalizarStock(invId:string) {
    const item = inventario.find(i=>i.id===invId)
    if (!item || item.cantidad_en_transito_nacionaliz<=0) return
    await supabase.from('inventario').update({
      cantidad_disponible: item.cantidad_disponible+item.cantidad_en_transito_nacionaliz,
      cantidad_en_transito_nacionaliz: 0,
    }).eq('id', item.id)
    await supabase.from('movimientos_inventario').insert({
      tenant_id: tenantId, producto_id: item.producto_id, bodega_id_origen: item.bodega_id,
      tipo: 'nacionalizacion', cantidad: item.cantidad_en_transito_nacionaliz, motivo: 'Nacionalización completada',
    })
    loadData()
  }

  async function toggleDropshippers(prodId:string, valor:boolean) {
    await supabase.from('productos').update({ disponible_dropshippers: valor }).eq('id', prodId)
    setProductos(prev => prev.map(p => p.id===prodId ? { ...p, disponible_dropshippers:valor } : p))
  }

  function nombreProd(id:string){ return productos.find(p=>p.id===id)?.nombre || 'Producto' }
  function nombreBod(id:string){ return bodegas.find(b=>b.id===id)?.nombre || 'Bodega' }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Cargando bodega...
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🏭 Bodega & Inventario</h1>
          <p style={{ fontSize:'13px', color:'#8B96A8' }}>Física + Virtual · Importación · Dropshipping · HACER</p>
        </div>
        <button onClick={()=>setShowNuevaBodega(true)} style={{ padding:'9px 16px', background:'#F5A623', border:'none', borderRadius:'9px', color:'#0A0D14', fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>+ Nueva bodega</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {[
          { l:'Bodegas activas', v:bodegas.filter(b=>b.activa).length, c:'#3D8EF0', icon:'🏭' },
          { l:'Productos bodega propia', v:prodsBodegaPropia.length, c:'#2DD4A0', icon:'📦' },
          { l:'Productos dropshipping', v:prodsDropshipping.length, c:'#F5A623', icon:'☁️' },
          { l:'Stock bajo / quiebre', v:stockBajo.length, c: stockBajo.length>0?'#F05C5C':'#2DD4A0', icon:'🚨' },
          { l:'Alertas de riesgo', v:alertasRiesgo.length, c: alertasRiesgo.length>0?'#F5A623':'#2DD4A0', icon:'⚠️' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px', borderTop:`2px solid ${k.c}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:'#8B96A8' }}>{k.l}</span><span>{k.icon}</span>
            </div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { key:'stock', label:'📦 Stock por bodega' },
          { key:'importacion', label:'🚢 Flujo importación' },
          { key:'piscinas', label:'☁️ Piscinas dropshipping' },
          { key:'riesgo', label:`⚠️ Riesgo IA (${alertasRiesgo.length})` },
          { key:'proveedor', label:'🤝 Mi catálogo proveedor' },
        ].map(t => (
          <button key={t.key} onClick={()=>setTab(t.key as typeof tab)}
            style={{ padding:'8px 14px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              background: tab===t.key?'#F5A623':'rgba(255,255,255,0.05)', color: tab===t.key?'#0A0D14':'#8B96A8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {showNuevaBodega && (
        <div style={{ ...s, padding:'18px', marginBottom:'16px', border:'1px solid rgba(245,166,35,0.3)' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'12px' }}>+ Nueva bodega</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', marginBottom:'10px' }}>
            <input placeholder="Nombre" value={nuevaBodega.nombre} onChange={e=>setNuevaBodega(p=>({...p,nombre:e.target.value}))}
              style={{ background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px' }} />
            <select value={nuevaBodega.tipo} onChange={e=>setNuevaBodega(p=>({...p,tipo:e.target.value}))}
              style={{ background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px' }}>
              {Object.entries(TIPO_BODEGA_INFO).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.l}</option>)}
            </select>
            <input placeholder="Ciudad" value={nuevaBodega.ciudad} onChange={e=>setNuevaBodega(p=>({...p,ciudad:e.target.value}))}
              style={{ background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px' }} />
            <select value={nuevaBodega.pais_codigo} onChange={e=>setNuevaBodega(p=>({...p,pais_codigo:e.target.value}))}
              style={{ background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'12px' }}>
              <option value="COL">Colombia</option><option value="ECU">Ecuador</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={crearBodega} style={{ padding:'8px 16px', background:'#F5A623', border:'none', borderRadius:'8px', color:'#0A0D14', fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>Crear</button>
            <button onClick={()=>setShowNuevaBodega(false)} style={{ padding:'8px 16px', background:'rgba(255,255,255,0.05)', border:'none', borderRadius:'8px', color:'#8B96A8', cursor:'pointer', fontSize:'12px' }}>Cancelar</button>
          </div>
        </div>
      )}

      {tab === 'stock' && (
        <div style={{ display:'grid', gridTemplateColumns: bodegaSel ? '1fr 1fr' : '1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>📦 Bodegas y su flujo</div>
            {bodegas.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin bodegas registradas — crea la primera arriba</div>
            ) : bodegas.map(b => {
              const info = TIPO_BODEGA_INFO[b.tipo] || TIPO_BODEGA_INFO.general
              const invBodega = inventario.filter(i=>i.bodega_id===b.id)
              const totalStock = invBodega.reduce((a,i)=>a+i.cantidad_disponible,0)
              const activa = bodegaSel === b.id
              return (
                <div key={b.id} onClick={()=>setBodegaSel(activa?null:b.id)}
                  style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px',
                    background: activa?`${info.c}06`:'transparent' }}>
                  <span style={{ fontSize:'20px' }}>{info.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:'600' }}>{b.nombre} <span style={{ fontSize:'10px', color:info.c }}>· {info.l}</span></div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>{b.ciudad}, {b.pais_codigo}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'16px', fontWeight:'800', color:info.c }}>{totalStock}</div>
                    <div style={{ fontSize:'10px', color:'#5A6478' }}>unidades</div>
                  </div>
                </div>
              )
            })}
          </div>

          {bodegaSel && (() => {
            const invBodega = inventario.filter(i=>i.bodega_id===bodegaSel)
            return (
              <div style={{ ...s, overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>Stock detallado — {nombreBod(bodegaSel)}</div>
                {invBodega.length === 0 ? (
                  <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin inventario registrado en esta bodega</div>
                ) : invBodega.map(item => {
                  const bajo = item.cantidad_disponible <= item.stock_minimo
                  return (
                    <div key={item.id} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:'12px', fontWeight:'600' }}>{nombreProd(item.producto_id)}</div>
                        <div style={{ fontSize:'10px', color:'#5A6478' }}>Reservado: {item.cantidad_reservada} · Dañado: {item.cantidad_dañada}</div>
                      </div>
                      <span style={{ fontSize:'15px', fontWeight:'800', color: bajo?'#F05C5C':'#2DD4A0' }}>{item.cantidad_disponible}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'importacion' && (
        <div style={{ ...s, padding:'20px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', marginBottom:'16px' }}>🚢 FLUJO DE IMPORTACIÓN — Importación → Nacionalización → Disponible</div>
          {(() => {
            const enTransito = inventario.filter(i=>i.cantidad_en_transito_nacionaliz>0)
            return enTransito.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px', color:'#5A6478', fontSize:'13px' }}>Sin mercancía en proceso de nacionalización</div>
            ) : enTransito.map(item => (
              <div key={item.id} style={{ ...s, padding:'14px', marginBottom:'8px', borderLeft:'3px solid #9B6BFF' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'600' }}>{nombreProd(item.producto_id)}</div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>{nombreBod(item.bodega_id)} · {item.cantidad_en_transito_nacionaliz} unidades en aduana</div>
                  </div>
                  <button onClick={()=>nacionalizarStock(item.id)} style={{ padding:'7px 14px', background:'rgba(155,107,255,0.15)', border:'none', borderRadius:'8px', color:'#9B6BFF', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    ✅ Marcar nacionalizado
                  </button>
                </div>
              </div>
            ))
          })()}
          <div style={{ marginTop:'14px', padding:'12px', background:'rgba(155,107,255,0.06)', borderRadius:'10px', fontSize:'11px', color:'#8B96A8' }}>
            Flujo: producto comprado entra como &quot;en tránsito nacionalización&quot; en una bodega tipo Importación. Al nacionalizar, pasa a disponible para venta o dispersión a bodegas de ciudad.
          </div>
        </div>
      )}

      {tab === 'piscinas' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'10px' }}>
          {PISCINAS_INFO.map(pis => {
            const enEsta = piscinas.filter(p=>p.piscina===pis.v)
            return (
              <div key={pis.v} style={{ ...s, padding:'10px', minHeight:'300px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:pis.c, marginBottom:'10px', borderBottom:`2px solid ${pis.c}30`, paddingBottom:'6px' }}>
                  {pis.l} ({enEsta.length})
                </div>
                {enEsta.map(p => {
                  const horas = horasDesde(p.fecha_entrada_piscina)
                  const demorado = pis.horas>0 && horas > pis.horas
                  return (
                    <div key={p.id} style={{ padding:'8px', borderRadius:'7px', marginBottom:'6px', background: demorado?'rgba(240,92,92,0.08)':'rgba(255,255,255,0.02)', borderLeft:`3px solid ${demorado?'#F05C5C':pis.c}` }}>
                      <div style={{ fontSize:'10px', color:'#8B96A8' }}>Pedido #{p.pedido_id.slice(0,6)}</div>
                      <div style={{ fontSize:'11px', fontWeight:'700', color: demorado?'#F05C5C':'#E8EDF5' }}>{horas}h aquí</div>
                      {demorado && <div style={{ fontSize:'9px', color:'#F05C5C' }}>⚠️ Esperado: {pis.horas}h</div>}
                    </div>
                  )
                })}
                {enEsta.length===0 && <div style={{ fontSize:'10px', color:'#5A6478', textAlign:'center', padding:'16px' }}>Vacío</div>}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'riesgo' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>⚠️ Alertas de riesgo por producto</div>
            {alertasRiesgo.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>✅ Sin alertas de riesgo activas</div>
            ) : alertasRiesgo.map(a => {
              const info = RIESGO_INFO[a.tipo_riesgo] || RIESGO_INFO.baja_rotacion
              return (
                <div key={a.id} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', borderLeft:`3px solid ${info.c}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'13px', fontWeight:'600' }}>{info.icon} {nombreProd(a.producto_id)}</span>
                    <span style={{ fontSize:'14px', fontWeight:'800', color:info.c }}>{a.score_riesgo}</span>
                  </div>
                  <div style={{ fontSize:'11px', color:info.c, marginBottom:'4px' }}>{info.l} · {a.dias_en_bodega} días en bodega</div>
                  <div style={{ fontSize:'11px', fontWeight:'700', color:'#F5A623' }}>→ Recomendación: {a.recomendacion}</div>
                </div>
              )
            })}
          </div>
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'12px' }}>🐢 Productos con baja rotación detectados</div>
            {(() => {
              const ahora = new Date()
              const sinRotar = productos.filter(p => !pedidosRecientes.some(pe => pe.producto_id===p.id))
              return sinRotar.length===0 ? (
                <div style={{ fontSize:'12px', color:'#5A6478', textAlign:'center', padding:'20px' }}>Todos los productos tienen ventas en los últimos 30 días</div>
              ) : sinRotar.map((p,i) => {
                const finTemp = p.temporada_fin ? Math.round((new Date(p.temporada_fin).getTime()-ahora.getTime())/86400000) : null
                return (
                  <div key={i} style={{ padding:'10px 12px', background:'rgba(91,100,120,0.06)', borderRadius:'8px', marginBottom:'6px' }}>
                    <div style={{ fontSize:'12px', fontWeight:'600' }}>{p.nombre}</div>
                    <div style={{ fontSize:'11px', color:'#5A6478' }}>
                      Sin ventas en 30 días · Devolución {p.pct_devolucion}%
                      {finTemp!==null && finTemp>=0 && <span style={{ color: finTemp<30?'#F5A623':'#5A6478' }}> · Fin temporada en {finTemp}d</span>}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {tab === 'proveedor' && (
        <div style={{ ...s, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight:'700', marginBottom:'4px' }}>🤝 Mi catálogo como proveedor</div>
            <div style={{ fontSize:'11px', color:'#8B96A8' }}>Marca qué productos ofreces a otros dropshippers dentro de DIZGO</div>
          </div>
          {productos.length === 0 ? (
            <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin productos activos</div>
          ) : productos.map(p => (
            <div key={p.id} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px' }}>
              <input type="checkbox" checked={p.disponible_dropshippers} onChange={e=>toggleDropshippers(p.id, e.target.checked)} style={{ accentColor:'#F5A623' }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'12px', fontWeight:'600' }}>{p.nombre}</div>
                <div style={{ fontSize:'10px', color:'#5A6478' }}>Costo: {fmt(p.costo_proveedor)} · PVP: {fmt(p.pvp_final)}</div>
              </div>
              {p.disponible_dropshippers && (
                <span style={{ fontSize:'10px', padding:'3px 8px', borderRadius:'5px', background:'rgba(45,212,160,0.15)', color:'#2DD4A0', fontWeight:'700' }}>✓ Disponible</span>
              )}
            </div>
          ))}
          <div style={{ padding:'14px 16px', fontSize:'11px', color:'#5A6478', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            💡 Los productos marcados aquí podrán ser vendidos por otros dropshippers de DIZGO usando tu inventario — la conexión completa entre tiendas se habilita en una etapa posterior.
          </div>
        </div>
      )}
    </div>
  )
}
