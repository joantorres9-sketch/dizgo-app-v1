'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { CargaMasivaModal, BotonesPlantilla } from '@/components/CargaMasivaModal'
import { configInventarioInicial, configInventarioCompra, type FilaInventario } from '@/lib/plantillasConfig'
import type { FilaImportada } from '@/lib/plantillasExcel'
import { RequierePermiso } from '@/components/RequierePermiso'
import { usePermisos, logAccion } from '@/lib/permisos'
import { clavePermiso } from '@/lib/modulos'
import { useTema } from '@/lib/tema'

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

function fmt(n:number){ return `$${Math.round(n).toLocaleString('es-CO')}` }
function horasDesde(fecha:string){ return Math.round((Date.now()-new Date(fecha).getTime())/3600000) }

export default function BodegaPage() {
  const { T } = useTema()
  const s: React.CSSProperties = { background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px' }
  const supabase = createClient()
  const { puede, perfil, cargando: cargandoPermisos } = usePermisos()
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
  const [previewInventario, setPreviewInventario] = useState<{ filas: FilaImportada<FilaInventario>[]; tipoCarga:'carga_inicial'|'compra' } | null>(null)

  const loadData = useCallback(async (tid: string) => {
    setLoading(true)
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

  useEffect(() => {
    if (cargandoPermisos) return
    if (!perfil?.tenantId) { setLoading(false); return }
    loadData(perfil.tenantId)
  }, [cargandoPermisos, perfil, loadData])

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

  async function confirmarImportInventario() {
    if (!previewInventario || !tenantId) return
    const { filas: preview, tipoCarga } = previewInventario
    const mapaProductos = new Map(productos.map(p => [p.nombre.toLowerCase().trim(), p.id]))
    const mapaBodegas = new Map(bodegas.map(b => [b.nombre.toLowerCase().trim(), b.id]))
    const mapaInventario = new Map(inventario.map(i => [`${i.producto_id}_${i.bodega_id}`, i]))

    const noEncontrados: string[] = []
    const movimientos: Record<string, unknown>[] = []
    let ok = 0

    for (const f of preview) {
      if (!f.valido) continue
      const d = f.datos
      const productoId = mapaProductos.get((d.producto || '').toLowerCase().trim())
      const bodegaId = mapaBodegas.get((d.bodega || '').toLowerCase().trim())
      if (!productoId) { noEncontrados.push(`fila ${f.fila}: producto "${d.producto}" no existe`); continue }
      if (!bodegaId) { noEncontrados.push(`fila ${f.fila}: bodega "${d.bodega}" no existe (bodegas válidas: ${bodegas.map(b=>b.nombre).join(', ')})`); continue }

      const cantidad = Number(d.cantidad) || 0
      const key = `${productoId}_${bodegaId}`
      const existente = mapaInventario.get(key)
      if (existente) {
        await supabase.from('inventario').update({ cantidad_disponible: existente.cantidad_disponible + cantidad }).eq('id', existente.id)
        mapaInventario.set(key, { ...existente, cantidad_disponible: existente.cantidad_disponible + cantidad })
      } else {
        const { data } = await supabase.from('inventario').insert({
          tenant_id: tenantId, producto_id: productoId, bodega_id: bodegaId, cantidad_disponible: cantidad,
        }).select().single()
        if (data) mapaInventario.set(key, data as Inventario)
      }
      movimientos.push({
        tenant_id: tenantId, producto_id: productoId, bodega_id_destino: bodegaId,
        tipo: tipoCarga, cantidad, costo_unitario: d.costo_unitario || 0,
        motivo: tipoCarga === 'carga_inicial' ? 'Carga de inventario inicial' : 'Compra registrada por carga masiva',
      })
      ok++
    }

    if (movimientos.length) {
      for (let i = 0; i < movimientos.length; i += 100) {
        await supabase.from('movimientos_inventario').insert(movimientos.slice(i, i + 100))
      }
    }
    await supabase.from('uploads').insert({
      tenant_id: tenantId, tipo: `plantilla_${tipoCarga === 'carga_inicial' ? 'inventario_inicial' : 'inventario_compra'}`,
      nombre_archivo: (tipoCarga === 'carga_inicial' ? configInventarioInicial : configInventarioCompra).nombreArchivo,
      registros_total: preview.length, registros_ok: ok, registros_error: preview.length - ok,
      estado: ok === preview.length ? 'completado' : 'error',
      notas: noEncontrados.length ? noEncontrados.slice(0, 20).join(' | ') : null,
    })
    setPreviewInventario(null)
    if (noEncontrados.length) alert(`${ok} filas cargadas. ${noEncontrados.length} filas no se cargaron:\n\n${noEncontrados.slice(0,10).join('\n')}`)
    loadData(tenantId)
  }

  function exportarInventario() {
    const filas = inventario.map(i => ({
      Producto: nombreProd(i.producto_id), Bodega: nombreBod(i.bodega_id),
      'Cantidad disponible': i.cantidad_disponible, 'Cantidad reservada': i.cantidad_reservada,
      'En tránsito nacionalización': i.cantidad_en_transito_nacionaliz, 'Cantidad dañada': i.cantidad_dañada,
      'Stock mínimo': i.stock_minimo,
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
    XLSX.writeFile(wb, `inventario_${new Date().toISOString().slice(0,10)}.xlsx`)
    logAccion('bodega', 'descargar')
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
    loadData(tenantId)
  }

  async function toggleDropshippers(prodId:string, valor:boolean) {
    await supabase.from('productos').update({ disponible_dropshippers: valor }).eq('id', prodId)
    setProductos(prev => prev.map(p => p.id===prodId ? { ...p, disponible_dropshippers:valor } : p))
  }

  function nombreProd(id:string){ return productos.find(p=>p.id===id)?.nombre || 'Producto' }
  function nombreBod(id:string){ return bodegas.find(b=>b.id===id)?.nombre || 'Bodega' }

  const TABS = [
    { key:'stock', label:'📦 Stock por bodega' },
    { key:'importacion', label:'🚢 Flujo importación' },
    { key:'piscinas', label:'☁️ Piscinas dropshipping' },
    { key:'riesgo', label:`⚠️ Riesgo IA (${alertasRiesgo.length})` },
    { key:'proveedor', label:'🤝 Mi catálogo proveedor' },
  ]
  const TABS_VISIBLES = TABS.filter(t => puede(clavePermiso('bodega', t.key), 'ver'))

  // Si la sub-pestaña activa dejó de ser visible (permiso revocado o aún no otorgado),
  // salta automáticamente a la primera sub-pestaña visible. Solo actúa cuando el permiso
  // ya cargó, para no pisar el tab inicial mientras `puede()` todavía responde false por defecto.
  useEffect(() => {
    if (cargandoPermisos) return
    if (TABS_VISIBLES.length === 0) return
    if (!TABS_VISIBLES.some(t => t.key === tab)) setTab(TABS_VISIBLES[0].key as typeof tab)
  }, [cargandoPermisos, tab, TABS_VISIBLES.map(t => t.key).join(',')])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>
      Cargando bodega...
    </div>
  )

  return (
    <RequierePermiso modulo="bodega">
    <div style={{ color:T.text, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🏭 Bodega & Inventario</h1>
          <p style={{ fontSize:'13px', color:T.muted }}>Física + Virtual · Importación · Dropshipping · HACER</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          {puede('bodega','descargar') && (
            <button onClick={exportarInventario} style={{ padding:'9px 16px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:'9px', color:T.muted, fontWeight:'600', cursor:'pointer', fontSize:'12px' }}>📥 Exportar inventario</button>
          )}
          {puede('bodega','agregar') && (
            <button onClick={()=>setShowNuevaBodega(true)} style={{ padding:'9px 16px', background:T.yellow, border:'none', borderRadius:'9px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>+ Nueva bodega</button>
          )}
        </div>
      </div>

      {puede('bodega','agregar') && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'10px', marginBottom:'16px' }}>
          <div style={{ ...s, padding:'12px 14px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:T.yellow, marginBottom:'8px' }}>📦 Carga masiva — Inventario inicial</div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              <BotonesPlantilla config={configInventarioInicial} onArchivoValidado={(filas)=>setPreviewInventario({ filas, tipoCarga:'carga_inicial' })} theme={T} />
            </div>
          </div>
          <div style={{ ...s, padding:'12px 14px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:T.purple, marginBottom:'8px' }}>🛒 Carga masiva — Compras / movimientos posteriores</div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              <BotonesPlantilla config={configInventarioCompra} onArchivoValidado={(filas)=>setPreviewInventario({ filas, tipoCarga:'compra' })} theme={T} />
            </div>
          </div>
        </div>
      )}
      {previewInventario && (
        <CargaMasivaModal
          filas={previewInventario.filas}
          columnas={(previewInventario.tipoCarga === 'carga_inicial' ? configInventarioInicial : configInventarioCompra).columnas}
          onConfirm={confirmarImportInventario}
          onClose={()=>setPreviewInventario(null)}
          theme={T}
        />
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {[
          { l:'Bodegas activas', v:bodegas.filter(b=>b.activa).length, c:T.blue, icon:'🏭' },
          { l:'Productos bodega propia', v:prodsBodegaPropia.length, c:T.green, icon:'📦' },
          { l:'Productos dropshipping', v:prodsDropshipping.length, c:T.yellow, icon:'☁️' },
          { l:'Stock bajo / quiebre', v:stockBajo.length, c: stockBajo.length>0?T.red:T.green, icon:'🚨' },
          { l:'Alertas de riesgo', v:alertasRiesgo.length, c: alertasRiesgo.length>0?T.yellow:T.green, icon:'⚠️' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px', borderTop:`2px solid ${k.c}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:T.muted }}>{k.l}</span><span>{k.icon}</span>
            </div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {TABS_VISIBLES.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key as typeof tab)}
            style={{ padding:'8px 14px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              background: tab===t.key?T.yellow:'rgba(255,255,255,0.05)', color: tab===t.key?'#0A0D14':T.muted }}>
            {t.label}
          </button>
        ))}
      </div>

      {showNuevaBodega && (
        <div style={{ ...s, padding:'18px', marginBottom:'16px', border:'1px solid rgba(245,166,35,0.3)' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:T.yellow, marginBottom:'12px' }}>+ Nueva bodega</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', marginBottom:'10px' }}>
            <input placeholder="Nombre" value={nuevaBodega.nombre} onChange={e=>setNuevaBodega(p=>({...p,nombre:e.target.value}))}
              style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:'7px', color:T.text, padding:'7px 10px', fontSize:'12px' }} />
            <select value={nuevaBodega.tipo} onChange={e=>setNuevaBodega(p=>({...p,tipo:e.target.value}))}
              style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:'7px', color:T.text, padding:'7px 10px', fontSize:'12px' }}>
              {Object.entries(TIPO_BODEGA_INFO).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.l}</option>)}
            </select>
            <input placeholder="Ciudad" value={nuevaBodega.ciudad} onChange={e=>setNuevaBodega(p=>({...p,ciudad:e.target.value}))}
              style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:'7px', color:T.text, padding:'7px 10px', fontSize:'12px' }} />
            <select value={nuevaBodega.pais_codigo} onChange={e=>setNuevaBodega(p=>({...p,pais_codigo:e.target.value}))}
              style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:'7px', color:T.text, padding:'7px 10px', fontSize:'12px' }}>
              <option value="COL">Colombia</option><option value="ECU">Ecuador</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={crearBodega} style={{ padding:'8px 16px', background:T.yellow, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>Crear</button>
            <button onClick={()=>setShowNuevaBodega(false)} style={{ padding:'8px 16px', background:'rgba(255,255,255,0.05)', border:'none', borderRadius:'8px', color:T.muted, cursor:'pointer', fontSize:'12px' }}>Cancelar</button>
          </div>
        </div>
      )}

      {tab === 'stock' && (
        <div style={{ display:'grid', gridTemplateColumns: bodegaSel ? '1fr 1fr' : '1fr', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700' }}>📦 Bodegas y su flujo</div>
            {bodegas.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'13px' }}>Sin bodegas registradas — crea la primera arriba</div>
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
                    <div style={{ fontSize:'11px', color:T.muted }}>{b.ciudad}, {b.pais_codigo}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'16px', fontWeight:'800', color:info.c }}>{totalStock}</div>
                    <div style={{ fontSize:'10px', color:T.muted }}>unidades</div>
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
                  <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'13px' }}>Sin inventario registrado en esta bodega</div>
                ) : invBodega.map(item => {
                  const bajo = item.cantidad_disponible <= item.stock_minimo
                  return (
                    <div key={item.id} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:'12px', fontWeight:'600' }}>{nombreProd(item.producto_id)}</div>
                        <div style={{ fontSize:'10px', color:T.muted }}>Reservado: {item.cantidad_reservada} · Dañado: {item.cantidad_dañada}</div>
                      </div>
                      <span style={{ fontSize:'15px', fontWeight:'800', color: bajo?T.red:T.green }}>{item.cantidad_disponible}</span>
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
          <div style={{ fontSize:'12px', fontWeight:'700', color:T.purple, marginBottom:'16px' }}>🚢 FLUJO DE IMPORTACIÓN — Importación → Nacionalización → Disponible</div>
          {(() => {
            const enTransito = inventario.filter(i=>i.cantidad_en_transito_nacionaliz>0)
            return enTransito.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px', color:T.muted, fontSize:'13px' }}>Sin mercancía en proceso de nacionalización</div>
            ) : enTransito.map(item => (
              <div key={item.id} style={{ ...s, padding:'14px', marginBottom:'8px', borderLeft:`3px solid ${T.purple}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'600' }}>{nombreProd(item.producto_id)}</div>
                    <div style={{ fontSize:'11px', color:T.muted }}>{nombreBod(item.bodega_id)} · {item.cantidad_en_transito_nacionaliz} unidades en aduana</div>
                  </div>
                  <button onClick={()=>nacionalizarStock(item.id)} style={{ padding:'7px 14px', background:'rgba(155,107,255,0.15)', border:'none', borderRadius:'8px', color:T.purple, cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    ✅ Marcar nacionalizado
                  </button>
                </div>
              </div>
            ))
          })()}
          <div style={{ marginTop:'14px', padding:'12px', background:'rgba(155,107,255,0.06)', borderRadius:'10px', fontSize:'11px', color:T.muted }}>
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
                    <div key={p.id} style={{ padding:'8px', borderRadius:'7px', marginBottom:'6px', background: demorado?'rgba(240,92,92,0.08)':'rgba(255,255,255,0.02)', borderLeft:`3px solid ${demorado?T.red:pis.c}` }}>
                      <div style={{ fontSize:'10px', color:T.muted }}>Pedido #{p.pedido_id.slice(0,6)}</div>
                      <div style={{ fontSize:'11px', fontWeight:'700', color: demorado?T.red:T.text }}>{horas}h aquí</div>
                      {demorado && <div style={{ fontSize:'9px', color:T.red }}>⚠️ Esperado: {pis.horas}h</div>}
                    </div>
                  )
                })}
                {enEsta.length===0 && <div style={{ fontSize:'10px', color:T.muted, textAlign:'center', padding:'16px' }}>Vacío</div>}
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
              <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'13px' }}>✅ Sin alertas de riesgo activas</div>
            ) : alertasRiesgo.map(a => {
              const info = RIESGO_INFO[a.tipo_riesgo] || RIESGO_INFO.baja_rotacion
              return (
                <div key={a.id} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', borderLeft:`3px solid ${info.c}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'13px', fontWeight:'600' }}>{info.icon} {nombreProd(a.producto_id)}</span>
                    <span style={{ fontSize:'14px', fontWeight:'800', color:info.c }}>{a.score_riesgo}</span>
                  </div>
                  <div style={{ fontSize:'11px', color:info.c, marginBottom:'4px' }}>{info.l} · {a.dias_en_bodega} días en bodega</div>
                  <div style={{ fontSize:'11px', fontWeight:'700', color:T.yellow }}>→ Recomendación: {a.recomendacion}</div>
                </div>
              )
            })}
          </div>
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'12px' }}>🐢 Productos con baja rotación detectados</div>
            {(() => {
              const ahora = new Date()
              const sinRotar = productos.filter(p => !pedidosRecientes.some(pe => pe.producto_id===p.id))
              return sinRotar.length===0 ? (
                <div style={{ fontSize:'12px', color:T.muted, textAlign:'center', padding:'20px' }}>Todos los productos tienen ventas en los últimos 30 días</div>
              ) : sinRotar.map((p,i) => {
                const finTemp = p.temporada_fin ? Math.round((new Date(p.temporada_fin).getTime()-ahora.getTime())/86400000) : null
                return (
                  <div key={i} style={{ padding:'10px 12px', background:'rgba(91,100,120,0.06)', borderRadius:'8px', marginBottom:'6px' }}>
                    <div style={{ fontSize:'12px', fontWeight:'600' }}>{p.nombre}</div>
                    <div style={{ fontSize:'11px', color:T.muted }}>
                      Sin ventas en 30 días · Devolución {p.pct_devolucion}%
                      {finTemp!==null && finTemp>=0 && <span style={{ color: finTemp<30?T.yellow:T.muted }}> · Fin temporada en {finTemp}d</span>}
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
            <div style={{ fontSize:'11px', color:T.muted }}>Marca qué productos ofreces a otros dropshippers dentro de DIZGO</div>
          </div>
          {productos.length === 0 ? (
            <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'13px' }}>Sin productos activos</div>
          ) : productos.map(p => (
            <div key={p.id} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px' }}>
              <input type="checkbox" checked={p.disponible_dropshippers} onChange={e=>toggleDropshippers(p.id, e.target.checked)} style={{ accentColor:T.yellow }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'12px', fontWeight:'600' }}>{p.nombre}</div>
                <div style={{ fontSize:'10px', color:T.muted }}>Costo: {fmt(p.costo_proveedor)} · PVP: {fmt(p.pvp_final)}</div>
              </div>
              {p.disponible_dropshippers && (
                <span style={{ fontSize:'10px', padding:'3px 8px', borderRadius:'5px', background:'rgba(45,212,160,0.15)', color:T.green, fontWeight:'700' }}>✓ Disponible</span>
              )}
            </div>
          ))}
          <div style={{ padding:'14px 16px', fontSize:'11px', color:T.muted, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            💡 Los productos marcados aquí podrán ser vendidos por otros dropshippers de DIZGO usando tu inventario — la conexión completa entre tiendas se habilita en una etapa posterior.
          </div>
        </div>
      )}
    </div>
    </RequierePermiso>
  )
}
