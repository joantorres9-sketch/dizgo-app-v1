'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238'
}

type Producto = {
  id: string; nombre: string; tipo: 'producto'|'combo'
  estado: string; ciclo_vida: string; modelo_negocio: string
  pvp_final: number; costo_proveedor: number; costo_flete: number
  costo_flete_dev: number; costo_fulfillment: number; cf_pedido: number
  pct_devolucion: number; pct_publicidad: number; pct_desc_popup: number
  pct_com_plataforma: number; pct_pasarela: number; pct_com_pasarela: number
  pct_com_ventas: number; pct_com_admin: number; pef_categoria: string
  costos_extra: Record<string,number>; pct_extra: Record<string,number>
  imagen_url?: string; created_at: string
}

type ProductoCombo = {
  id: string; nombre: string
  costo_proveedor: number; costo_flete: number
  costo_flete_dev: number; costo_fulfillment: number; cf_pedido: number
}

function getPais() {
  if (typeof window === 'undefined') return 'COL'
  return localStorage.getItem('dizgo_pais') || 'COL'
}

function fmt(v: number) {
  const cfgs: Record<string,{locale:string;currency:string;dec:number}> = {
    COL:{locale:'es-CO',currency:'COP',dec:0}, ECU:{locale:'en-US',currency:'USD',dec:2},
    MEX:{locale:'es-MX',currency:'MXN',dec:2}, PER:{locale:'es-PE',currency:'PEN',dec:2},
    CHL:{locale:'es-CL',currency:'CLP',dec:0}, ARG:{locale:'es-AR',currency:'ARS',dec:2},
    CRI:{locale:'es-CR',currency:'CRC',dec:2}, PRY:{locale:'es-PY',currency:'PYG',dec:0},
    VEN:{locale:'es-VE',currency:'VES',dec:2}, ESP:{locale:'es-ES',currency:'EUR',dec:2},
    GTM:{locale:'es-GT',currency:'GTQ',dec:2}, PAN:{locale:'es-PA',currency:'USD',dec:2},
  }
  const c = cfgs[getPais()] || cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).format(v)
}

function calcMargen(p: Partial<Producto>) {
  const pvp = p.pvp_final || 0; if (!pvp) return 0
  const fijos = (p.costo_proveedor||0)+(p.costo_flete||0)+(p.costo_flete_dev||0)+(p.costo_fulfillment||0)+(p.cf_pedido||0)
  const pcts = ((p.pct_devolucion||0)+(p.pct_publicidad||0)+(p.pct_desc_popup||0)+(p.pct_com_plataforma||0)+(p.pct_pasarela||0)+(p.pct_com_pasarela||0)+(p.pct_com_ventas||0)+(p.pct_com_admin||0))/100
  return Math.round(((pvp-(fijos+pvp*pcts))/pvp)*1000)/10
}

function getSem(m: number) {
  if (m>=25) return {color:T.green, label:'✅ VERDE — Escalar',    bg:`${T.green}15`}
  if (m>=15) return {color:T.yellow,label:'⚠️ AMARILLO — Revisar', bg:`${T.yellow}15`}
  if (m>0)   return {color:T.red,   label:'❌ ROJO — Ajustar',     bg:`${T.red}15`}
  return {color:T.muted,label:'⬛ SIN DATOS',bg:`${T.muted}15`}
}

const inp: React.CSSProperties = {width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box'}
const lbl: React.CSSProperties = {fontSize:'11px',color:T.muted,marginBottom:'4px',display:'block'}
const fld: React.CSSProperties = {marginBottom:'10px'}
const row2: React.CSSProperties = {display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}

function Tooltip({text,children}:{text:string;children:React.ReactNode}) {
  const [show,setShow]=useState(false)
  return (
    <span style={{position:'relative',display:'inline-flex',alignItems:'center'}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show&&<div style={{position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',background:'#0A1628',border:`1px solid ${T.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'11px',color:T.text,width:'220px',zIndex:100,lineHeight:1.5,boxShadow:'0 4px 16px rgba(0,0,0,0.4)',whiteSpace:'pre-wrap'}}>{text}</div>}
    </span>
  )
}

// ── BUSCADOR DE PRODUCTOS PARA COMBO ─────────────────────
function BuscadorProductos({
  tenantId, seleccionados, onAgregar
}: {
  tenantId: string
  seleccionados: ProductoCombo[]
  onAgregar: (p: ProductoCombo) => void
}) {
  const supabase = createClient()
  const [buscar, setBuscar] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [buscando, setBuscando] = useState(false)

  async function buscarProductos(q: string) {
    if (!q.trim()) { setResultados([]); return }
    setBuscando(true)
    const { data } = await supabase.from('productos')
      .select('id,nombre,costo_proveedor,costo_flete,costo_flete_dev,costo_fulfillment,cf_pedido,pvp_final,estado')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'producto')
      .ilike('nombre', `%${q}%`)
      .limit(8)
    setResultados(data as Producto[] || [])
    setBuscando(false)
  }

  const idsSeleccionados = seleccionados.map(p => p.id)

  return (
    <div style={{ marginBottom:'14px' }}>
      <div style={{ fontSize:'11px', fontWeight:'700', color:T.purple, marginBottom:'8px' }}>
        🔍 BUSCAR Y AGREGAR PRODUCTOS AL COMBO
      </div>
      <div style={{ position:'relative' }}>
        <input
          style={inp}
          placeholder="Escribe el nombre del producto..."
          value={buscar}
          onChange={e => { setBuscar(e.target.value); buscarProductos(e.target.value) }}
        />
        {buscando && (
          <div style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', fontSize:'11px', color:T.muted }}>
            buscando...
          </div>
        )}
      </div>

      {/* Resultados */}
      {resultados.length > 0 && (
        <div style={{ background:'#060E1C', border:`1px solid ${T.border}`, borderRadius:'8px', marginTop:'6px', overflow:'hidden' }}>
          {resultados.map(p => {
            const yaAgregado = idsSeleccionados.includes(p.id)
            return (
              <div key={p.id} style={{
                display:'flex', alignItems:'center', gap:'10px',
                padding:'8px 12px', borderBottom:`1px solid ${T.border}`,
                background: yaAgregado ? `${T.green}08` : 'transparent'
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', color:T.text, fontWeight:'500' }}>{p.nombre}</div>
                  <div style={{ fontSize:'10px', color:T.muted }}>
                    Costo: {fmt(p.costo_proveedor||0)} · Flete: {fmt(p.costo_flete||0)}
                  </div>
                </div>
                <button
                  onClick={() => { if(!yaAgregado) onAgregar({ id:p.id, nombre:p.nombre, costo_proveedor:p.costo_proveedor||0, costo_flete:p.costo_flete||0, costo_flete_dev:p.costo_flete_dev||0, costo_fulfillment:p.costo_fulfillment||0, cf_pedido:p.cf_pedido||0 }); setBuscar(''); setResultados([]) }}
                  disabled={yaAgregado}
                  style={{
                    padding:'5px 12px', borderRadius:'6px', fontSize:'11px', fontWeight:'600', cursor: yaAgregado ? 'default' : 'pointer',
                    background: yaAgregado ? `${T.green}20` : `${T.purple}20`,
                    border: `1px solid ${yaAgregado ? T.green : T.purple}40`,
                    color: yaAgregado ? T.green : T.purple
                  }}>
                  {yaAgregado ? '✓ Agregado' : '+ Agregar'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {buscar && resultados.length === 0 && !buscando && (
        <div style={{ padding:'10px', fontSize:'12px', color:T.muted, textAlign:'center', background:'#060E1C', borderRadius:'8px', marginTop:'6px' }}>
          No se encontraron productos con ese nombre
        </div>
      )}
    </div>
  )
}

// ── LISTA DE PRODUCTOS DEL COMBO ──────────────────────────
function ListaCombo({
  productos, onChange, onRemove
}: {
  productos: ProductoCombo[]
  onChange: (id:string, campo:keyof ProductoCombo, valor:number) => void
  onRemove: (id:string) => void
}) {
  if (productos.length === 0) return (
    <div style={{ background:`${T.purple}10`, border:`1px dashed ${T.purple}40`, borderRadius:'8px', padding:'16px', textAlign:'center', fontSize:'12px', color:T.muted, marginBottom:'12px' }}>
      🎁 Busca y agrega productos para formar el combo
    </div>
  )

  return (
    <div style={{ marginBottom:'14px' }}>
      <div style={{ fontSize:'11px', fontWeight:'700', color:T.purple, marginBottom:'8px' }}>
        🎁 PRODUCTOS DEL COMBO ({productos.length})
      </div>
      {productos.map(p => (
        <div key={p.id} style={{ background:'#060E1C', border:`1px solid ${T.border}`, borderRadius:'8px', padding:'10px 12px', marginBottom:'6px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
            <div style={{ fontSize:'12px', fontWeight:'600', color:T.text }}>{p.nombre}</div>
            <button onClick={()=>onRemove(p.id)}
              style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'5px', color:T.red, cursor:'pointer', fontSize:'11px', padding:'2px 8px' }}>
              Quitar
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px' }}>
            {[
              ['Costo proveedor','costo_proveedor',p.costo_proveedor],
              ['Flete envío','costo_flete',p.costo_flete],
              ['Flete devolución','costo_flete_dev',p.costo_flete_dev],
              ['Fulfillment','costo_fulfillment',p.costo_fulfillment],
              ['CF por pedido','cf_pedido',p.cf_pedido],
            ].map(([label,campo,valor]) => (
              <div key={campo as string}>
                <div style={{ fontSize:'10px', color:T.muted, marginBottom:'3px' }}>{label}</div>
                <input
                  style={{ ...inp, fontSize:'11px', padding:'5px 8px' }}
                  type="number"
                  value={valor as number || ''}
                  onChange={e=>onChange(p.id, campo as keyof ProductoCombo, parseFloat(e.target.value)||0)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── MODAL FORMULARIO ──────────────────────────────────────
function ModalProducto({ onClose, onSave, tenantId, editData }: {
  onClose:()=>void; onSave:()=>void; tenantId:string; editData?:Producto|null
}) {
  const supabase = createClient()
  const [tipo, setTipo] = useState<'producto'|'combo'>(editData?.tipo||'producto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [costosExtra, setCostosExtra] = useState<{nombre:string;valor:number}[]>([])
  const [pctsExtra, setPctsExtra] = useState<{nombre:string;valor:number}[]>([])
  const [productosCombo, setProductosCombo] = useState<ProductoCombo[]>([])

  const [form, setForm] = useState({
    nombre: editData?.nombre||'',
    estado: editData?.estado||'borrador',
    ciclo_vida: editData?.ciclo_vida||'borrador',
    modelo_negocio: editData?.modelo_negocio||'dropshipping',
    pvp_final: editData?.pvp_final||0,
    costo_proveedor: editData?.costo_proveedor||0,
    costo_flete: editData?.costo_flete||0,
    costo_flete_dev: editData?.costo_flete_dev||0,
    costo_fulfillment: editData?.costo_fulfillment||0,
    cf_pedido: editData?.cf_pedido||0,
    pct_devolucion: editData?.pct_devolucion||20,
    pct_publicidad: editData?.pct_publicidad||20,
    pct_desc_popup: editData?.pct_desc_popup||5,
    pct_com_plataforma: editData?.pct_com_plataforma||3,
    pct_pasarela: editData?.pct_pasarela||0,
    pct_com_pasarela: editData?.pct_com_pasarela||0,
    pct_com_ventas: editData?.pct_com_ventas||2,
    pct_com_admin: editData?.pct_com_admin||1,
    pef_categoria: editData?.pef_categoria||'no_clasificado',
    imagen_url: editData?.imagen_url||'',
  })

  // Cuando cambia el tipo a combo, sumar costos de los productos seleccionados
  useEffect(() => {
    if (tipo === 'combo' && productosCombo.length > 0) {
      const totalProv = productosCombo.reduce((a,p)=>a+p.costo_proveedor,0)
      const totalFlete = productosCombo.reduce((a,p)=>a+p.costo_flete,0)
      const totalDev = productosCombo.reduce((a,p)=>a+p.costo_flete_dev,0)
      const totalFulfil = productosCombo.reduce((a,p)=>a+p.costo_fulfillment,0)
      const totalCf = productosCombo.reduce((a,p)=>a+p.cf_pedido,0)
      setForm(f=>({...f, costo_proveedor:totalProv, costo_flete:totalFlete, costo_flete_dev:totalDev, costo_fulfillment:totalFulfil, cf_pedido:totalCf}))
    }
  }, [productosCombo, tipo])

  const set = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
    const isNum = e.target.type==='number'
    const isText = ['estado','ciclo_vida','modelo_negocio','pef_categoria','imagen_url'].includes(k)
    setForm(f=>({...f,[k]: isNum ? parseFloat(e.target.value)||0 : isText ? e.target.value : e.target.value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}))
  }

  const margen = calcMargen(form)
  const sem = getSem(margen)

  function handleComboChange(id:string, campo:keyof ProductoCombo, valor:number) {
    setProductosCombo(prev=>prev.map(p=>p.id===id?{...p,[campo]:valor}:p))
  }

  async function handleSave() {
    if (!form.nombre) { setError('El nombre es obligatorio'); return }
    if (tipo==='combo' && productosCombo.length < 2) { setError('Un combo necesita al menos 2 productos'); return }
    setLoading(true); setError('')
    try {
      const costos_extra: Record<string,number> = {}
      costosExtra.forEach(c=>{ if(c.nombre) costos_extra[c.nombre]=c.valor })
      const pct_extra: Record<string,number> = {}
      pctsExtra.forEach(p=>{ if(p.nombre) pct_extra[p.nombre]=p.valor })
      const combo_productos_ids = tipo==='combo' ? productosCombo.map(p=>p.id) : []

      const payload = { ...form, tipo, tenant_id:tenantId, costos_extra, pct_extra, combo_productos_ids }

      if (editData?.id) {
        const { error:err } = await supabase.from('productos').update(payload).eq('id',editData.id)
        if (err) throw err
      } else {
        const { error:err } = await supabase.from('productos').insert(payload)
        if (err) throw err
      }
      onSave()
    } catch(e:any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(4px)' }}>
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:'14px',width:'660px',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div style={{ fontSize:'14px',fontWeight:'700',color:T.text }}>{editData?'Editar':'Agregar nuevo'}</div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px' }}>✕</button>
        </div>

        <div style={{ overflowY:'auto',flex:1,padding:'18px 20px' }}>

          {/* Tipo */}
          <div style={{ display:'flex',gap:'8px',marginBottom:'16px' }}>
            {(['producto','combo'] as const).map(t=>(
              <button key={t} onClick={()=>setTipo(t)}
                style={{ flex:1,padding:'10px',borderRadius:'9px',cursor:'pointer',fontWeight:'600',fontSize:'13px',border:`2px solid ${tipo===t?T.accent:T.border}`,background:tipo===t?`${T.accent}15`:T.card2,color:tipo===t?T.accent:T.muted }}>
                {t==='producto'?'📦 Producto':'🎁 Combo / Kit'}
              </button>
            ))}
          </div>

          {/* Semáforo */}
          <div style={{ background:sem.bg,border:`1px solid ${sem.color}30`,borderRadius:'9px',padding:'10px 14px',marginBottom:'16px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ fontSize:'12px',fontWeight:'600',color:sem.color }}>{sem.label}</div>
            <div style={{ fontSize:'13px',fontWeight:'700',color:sem.color }}>Margen: {margen>0?margen.toFixed(1)+'%':'--'}</div>
          </div>

          {/* BUSCADOR COMBO */}
          {tipo==='combo' && (
            <>
              <BuscadorProductos
                tenantId={tenantId}
                seleccionados={productosCombo}
                onAgregar={p=>setProductosCombo(prev=>[...prev,p])}
              />
              <ListaCombo
                productos={productosCombo}
                onChange={handleComboChange}
                onRemove={id=>setProductosCombo(prev=>prev.filter(p=>p.id!==id))}
              />
              <div style={{ height:'1px',background:T.border,margin:'14px 0' }} />
            </>
          )}

          {/* Identificación */}
          <div style={{ fontSize:'11px',fontWeight:'700',color:T.accent,marginBottom:'8px',letterSpacing:'0.05em' }}>🔖 IDENTIFICACIÓN</div>
          <div style={fld}>
            <label style={lbl}>Nombre * (mayúsculas automático)</label>
            <input style={inp} value={form.nombre} onChange={set('nombre')} placeholder={tipo==='combo'?"EJ: COMBO CUIDADO CAPILAR":"EJ: RELOJ LED MODA"} />
          </div>
          <div style={row2}>
            <div><label style={lbl}>Estado *</label>
              <select style={{...inp,appearance:'none' as any}} value={form.estado} onChange={set('estado')}>
                <option value="borrador">Borrador</option><option value="testeo">Testeo</option>
                <option value="activo">Activo</option><option value="temporada">Temporada</option><option value="inactivo">Inactivo</option>
              </select>
            </div>
            <div><label style={lbl}>Ciclo de vida</label>
              <select style={{...inp,appearance:'none' as any}} value={form.ciclo_vida} onChange={set('ciclo_vida')}>
                <option value="borrador">Borrador</option><option value="testeo">Testeo</option>
                <option value="activo">Activo</option><option value="temporada">Temporada</option><option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>Modelo negocio</label>
              <select style={{...inp,appearance:'none' as any}} value={form.modelo_negocio} onChange={set('modelo_negocio')}>
                <option value="dropshipping">Dropshipping</option><option value="importador">Importador</option>
                <option value="produccion_propia">Producción propia</option><option value="hibrido">Híbrido</option>
              </select>
            </div>
            <div><label style={lbl}>Clasificación PEF</label>
              <select style={{...inp,appearance:'none' as any}} value={form.pef_categoria} onChange={set('pef_categoria')}>
                <option value="no_clasificado">Sin clasificar</option><option value="prevencion">P — Prevención</option>
                <option value="evaluacion">E — Evaluación</option><option value="falla_interna">FI — Falla interna</option>
                <option value="falla_externa">FE — Falla externa</option>
              </select>
            </div>
          </div>
          <div style={fld}>
            <label style={lbl}>URL imagen</label>
            <input style={inp} value={form.imagen_url} onChange={e=>setForm(f=>({...f,imagen_url:e.target.value}))} placeholder="https://..." />
          </div>

          {/* Costos */}
          <div style={{ fontSize:'11px',fontWeight:'700',color:T.blue,marginBottom:'8px',marginTop:'16px',letterSpacing:'0.05em' }}>
            💰 COSTOS {tipo==='combo'?'DEL COMBO (editables)':'EN DINERO'}
          </div>
          <div style={fld}>
            <label style={lbl}><Tooltip text="Precio de venta al público.\nFórmula correcta: PVS = Costos / (1 - %pub - %com - %margen)">PVP Final * ℹ️</Tooltip></label>
            <input style={inp} type="number" value={form.pvp_final||''} onChange={set('pvp_final')} placeholder="0" />
          </div>
          <div style={row2}>
            <div><label style={lbl}>Costo proveedor *</label><input style={inp} type="number" value={form.costo_proveedor||''} onChange={set('costo_proveedor')} placeholder="0" /></div>
            <div><label style={lbl}><Tooltip text="Flete de envío al cliente. Variable por zona.">Flete envío * ℹ️</Tooltip></label><input style={inp} type="number" value={form.costo_flete||''} onChange={set('costo_flete')} placeholder="0" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}><Tooltip text="Costo cuando el pedido es devuelto. Costo oculto crítico.">Flete devolución ℹ️</Tooltip></label><input style={inp} type="number" value={form.costo_flete_dev||''} onChange={set('costo_flete_dev')} placeholder="0" /></div>
            <div><label style={lbl}>Fulfillment</label><input style={inp} type="number" value={form.costo_fulfillment||''} onChange={set('costo_fulfillment')} placeholder="0" /></div>
          </div>
          <div style={fld}>
            <label style={lbl}><Tooltip text="CF mensual ÷ pedidos entregados. Se toma del módulo Costos Fijos.">CF por pedido ℹ️</Tooltip></label>
            <input style={inp} type="number" value={form.cf_pedido||''} onChange={set('cf_pedido')} placeholder="0" />
          </div>

          {/* Costos extra */}
          <div style={{ marginBottom:'12px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px' }}>
              <label style={{...lbl,margin:0}}>Costos adicionales</label>
              <button onClick={()=>setCostosExtra(c=>[...c,{nombre:'',valor:0}])}
                style={{ fontSize:'11px',color:T.accent,background:'none',border:`1px solid ${T.accent}40`,borderRadius:'6px',padding:'3px 10px',cursor:'pointer' }}>+ Agregar</button>
            </div>
            {costosExtra.map((c,i)=>(
              <div key={i} style={{ display:'grid',gridTemplateColumns:'1fr 120px 32px',gap:'6px',marginBottom:'6px' }}>
                <input style={inp} placeholder="Nombre" value={c.nombre} onChange={e=>setCostosExtra(a=>a.map((x,j)=>j===i?{...x,nombre:e.target.value}:x))} />
                <input style={inp} type="number" placeholder="Valor" value={c.valor||''} onChange={e=>setCostosExtra(a=>a.map((x,j)=>j===i?{...x,valor:parseFloat(e.target.value)||0}:x))} />
                <button onClick={()=>setCostosExtra(a=>a.filter((_,j)=>j!==i))} style={{ background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'6px',color:T.red,cursor:'pointer',fontSize:'14px' }}>✕</button>
              </div>
            ))}
          </div>

          {/* Porcentajes */}
          <div style={{ fontSize:'11px',fontWeight:'700',color:T.green,marginBottom:'8px',marginTop:'16px',letterSpacing:'0.05em' }}>📊 PORCENTAJES (% sobre PVP)</div>
          <div style={row2}>
            <div><label style={lbl}><Tooltip text="% pedidos no entregados. Incluye doble flete.">% Devolución ℹ️</Tooltip></label><input style={inp} type="number" value={form.pct_devolucion||''} onChange={set('pct_devolucion')} placeholder="20" /></div>
            <div><label style={lbl}><Tooltip text="% del PVP para pauta Meta/TikTok. Máximo ideal 20%.">% Publicidad ℹ️</Tooltip></label><input style={inp} type="number" value={form.pct_publicidad||''} onChange={set('pct_publicidad')} placeholder="20" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}><Tooltip text="% descuento en popup de la landing para capturar el lead.">% Desc. popup ℹ️</Tooltip></label><input style={inp} type="number" value={form.pct_desc_popup||''} onChange={set('pct_desc_popup')} placeholder="5" /></div>
            <div><label style={lbl}>% Com. plataforma</label><input style={inp} type="number" value={form.pct_com_plataforma||''} onChange={set('pct_com_plataforma')} placeholder="3" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>% Pasarela</label><input style={inp} type="number" value={form.pct_pasarela||''} onChange={set('pct_pasarela')} placeholder="0" /></div>
            <div><label style={lbl}>% Com. pasarela</label><input style={inp} type="number" value={form.pct_com_pasarela||''} onChange={set('pct_com_pasarela')} placeholder="0" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>% Com. ventas</label><input style={inp} type="number" value={form.pct_com_ventas||''} onChange={set('pct_com_ventas')} placeholder="2" /></div>
            <div><label style={lbl}>% Com. admin</label><input style={inp} type="number" value={form.pct_com_admin||''} onChange={set('pct_com_admin')} placeholder="1" /></div>
          </div>

          {/* % extra */}
          <div style={{ marginBottom:'12px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px' }}>
              <label style={{...lbl,margin:0}}>% adicionales</label>
              <button onClick={()=>setPctsExtra(p=>[...p,{nombre:'',valor:0}])}
                style={{ fontSize:'11px',color:T.purple,background:'none',border:`1px solid ${T.purple}40`,borderRadius:'6px',padding:'3px 10px',cursor:'pointer' }}>+ Agregar %</button>
            </div>
            {pctsExtra.map((p,i)=>(
              <div key={i} style={{ display:'grid',gridTemplateColumns:'1fr 120px 32px',gap:'6px',marginBottom:'6px' }}>
                <input style={inp} placeholder="Nombre" value={p.nombre} onChange={e=>setPctsExtra(a=>a.map((x,j)=>j===i?{...x,nombre:e.target.value}:x))} />
                <input style={inp} type="number" placeholder="%" value={p.valor||''} onChange={e=>setPctsExtra(a=>a.map((x,j)=>j===i?{...x,valor:parseFloat(e.target.value)||0}:x))} />
                <button onClick={()=>setPctsExtra(a=>a.filter((_,j)=>j!==i))} style={{ background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'6px',color:T.red,cursor:'pointer',fontSize:'14px' }}>✕</button>
              </div>
            ))}
          </div>

          {/* Mini P&G */}
          <div style={{ background:`${T.blue}10`,border:`1px solid ${T.blue}20`,borderRadius:'9px',padding:'12px',marginTop:'8px' }}>
            <div style={{ fontSize:'11px',fontWeight:'700',color:T.blue,marginBottom:'8px' }}>📊 ESTADO DE RESULTADOS MINI</div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px' }}>
              {[
                ['PVP Final',fmt(form.pvp_final),T.text],
                ['Costos directos',fmt((form.costo_proveedor)+(form.costo_flete)+(form.costo_flete_dev)+(form.costo_fulfillment)+(form.cf_pedido)),T.red],
                ['Costos variables (%)',fmt(form.pvp_final*((form.pct_devolucion+form.pct_publicidad+form.pct_desc_popup+form.pct_com_plataforma+form.pct_pasarela+form.pct_com_pasarela+form.pct_com_ventas+form.pct_com_admin)/100)),T.yellow],
                ['Margen neto',`${margen.toFixed(1)}%`,margen>=25?T.green:margen>=15?T.yellow:T.red],
              ].map(([label,value,color])=>(
                <div key={label as string} style={{ display:'flex',justifyContent:'space-between',fontSize:'12px' }}>
                  <span style={{ color:T.muted }}>{label}</span>
                  <span style={{ color:color as string,fontWeight:'600' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {error && <div style={{ background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'8px',padding:'9px',fontSize:'12px',color:T.red,marginTop:'12px' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:'8px',flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1,padding:'10px',background:T.card2,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'13px' }}>Cancelar</button>
          <button onClick={handleSave} disabled={loading}
            style={{ flex:2,padding:'10px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:loading?'wait':'pointer',fontSize:'13px',opacity:loading?0.7:1 }}>
            {loading?'Guardando...':`${editData?'Guardar cambios':'Crear '+tipo}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL RESUMEN ─────────────────────────────────────────
function ModalResumen({producto,onClose,onEdit}:{producto:Producto;onClose:()=>void;onEdit:()=>void}) {
  const margen=calcMargen(producto); const sem=getSem(margen)
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(4px)' }}>
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:'14px',width:'500px',maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column' }}>
        <div style={{ padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <div style={{ fontSize:'13px',fontWeight:'700',color:T.text }}>{producto.nombre}</div>
            <div style={{ fontSize:'11px',color:T.muted,marginTop:'2px' }}>{producto.tipo==='combo'?'🎁 Combo':'📦 Producto'} · {producto.modelo_negocio}</div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px' }}>✕</button>
        </div>
        <div style={{ overflowY:'auto',flex:1,padding:'18px 20px' }}>
          <div style={{ background:sem.bg,border:`1px solid ${sem.color}30`,borderRadius:'9px',padding:'12px 16px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div style={{ fontSize:'13px',fontWeight:'600',color:sem.color }}>{sem.label}</div>
            <div style={{ fontSize:'20px',fontWeight:'800',color:sem.color }}>{margen.toFixed(1)}%</div>
          </div>
          <div style={{ background:T.card2,borderRadius:'9px',padding:'12px',marginBottom:'12px' }}>
            <div style={{ fontSize:'11px',fontWeight:'700',color:T.blue,marginBottom:'8px' }}>💰 ESTRUCTURA DE COSTOS</div>
            {[['PVP Final',fmt(producto.pvp_final)],['Costo proveedor',fmt(producto.costo_proveedor)],['Flete envío',fmt(producto.costo_flete)],['Flete devolución',fmt(producto.costo_flete_dev)],['Fulfillment',fmt(producto.costo_fulfillment)],['CF por pedido',fmt(producto.cf_pedido)]].map(([k,v])=>(
              <div key={k} style={{ display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'4px 0',borderBottom:`1px solid ${T.border}` }}>
                <span style={{ color:T.muted }}>{k}</span><span style={{ color:T.text,fontWeight:'500' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background:T.card2,borderRadius:'9px',padding:'12px' }}>
            <div style={{ fontSize:'11px',fontWeight:'700',color:T.green,marginBottom:'8px' }}>📊 PORCENTAJES</div>
            {[['% Devolución',producto.pct_devolucion+'%'],['% Publicidad',producto.pct_publicidad+'%'],['% Desc. popup',producto.pct_desc_popup+'%'],['% Com. plataforma',producto.pct_com_plataforma+'%'],['% Pasarela',producto.pct_pasarela+'%'],['% Com. ventas',producto.pct_com_ventas+'%'],['% Com. admin',producto.pct_com_admin+'%']].map(([k,v])=>(
              <div key={k} style={{ display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'4px 0',borderBottom:`1px solid ${T.border}` }}>
                <span style={{ color:T.muted }}>{k}</span><span style={{ color:T.text }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:'8px',flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1,padding:'10px',background:T.card2,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'13px' }}>Cerrar</button>
          <button onClick={onEdit} style={{ flex:2,padding:'10px',background:`${T.blue}20`,border:`1px solid ${T.blue}40`,borderRadius:'8px',color:T.blue,fontWeight:'600',cursor:'pointer',fontSize:'13px' }}>✏️ Modificar → Precio & Costeo</button>
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────
export default function ProductosPage() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showResumen, setShowResumen] = useState<Producto|null>(null)
  const [editData, setEditData] = useState<Producto|null>(null)
  const [filtro, setFiltro] = useState('todos')
  const [buscar, setBuscar] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadData() {
    setLoading(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const {data:profile} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    setTenantId(profile.tenant_id)
    const {data} = await supabase.from('productos').select('*').eq('tenant_id',profile.tenant_id).order('created_at',{ascending:false})
    setProductos((data||[]) as Producto[])
    setLoading(false)
  }

  useEffect(()=>{ loadData() },[])

  async function handleDelete(id:string) {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('productos').delete().eq('id',id)
    loadData()
  }

  const filtrados = productos.filter(p=>{
    const mf = filtro==='todos'||p.estado===filtro||p.tipo===filtro
    const mb = p.nombre.toLowerCase().includes(buscar.toLowerCase())
    return mf&&mb
  })

  const activos=productos.filter(p=>p.estado==='activo').length
  const testeo=productos.filter(p=>p.estado==='testeo').length
  const combos=productos.filter(p=>p.tipo==='combo').length
  const margenProm=productos.length>0?Math.round(productos.reduce((a,p)=>a+calcMargen(p),0)/productos.length*10)/10:0
  const semProm=getSem(margenProm)

  const ESTADOS=[{v:'todos',l:'Todos',c:T.muted},{v:'activo',l:'Activos',c:T.green},{v:'testeo',l:'Testeo',c:T.yellow},{v:'borrador',l:'Borrador',c:T.muted},{v:'inactivo',l:'Inactivos',c:T.red},{v:'combo',l:'Combos',c:T.purple}]

  return (
    <div style={{ color:T.text,fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      {showModal&&<ModalProducto onClose={()=>{setShowModal(false);setEditData(null)}} onSave={()=>{setShowModal(false);setEditData(null);loadData()}} tenantId={tenantId} editData={editData} />}
      {showResumen&&<ModalResumen producto={showResumen} onClose={()=>setShowResumen(null)} onEdit={()=>{setEditData(showResumen);setShowResumen(null);setShowModal(true)}} />}

      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'22px',fontWeight:'700',color:T.text,marginBottom:'4px' }}>🛍️ Catálogo de Productos</h1>
          <p style={{ fontSize:'12px',color:T.muted }}>Sin productos no hay magia — el corazón de tu tienda</p>
        </div>
        <div style={{ display:'flex',gap:'8px' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display:'none' }} />
          <button onClick={()=>fileRef.current?.click()} style={{ padding:'9px 14px',background:T.card,border:`1px solid ${T.border}`,borderRadius:'9px',color:T.muted,cursor:'pointer',fontSize:'12px' }}>📤 Carga masiva</button>
          <button onClick={()=>{setEditData(null);setShowModal(true)}} style={{ padding:'9px 18px',background:T.accent,border:'none',borderRadius:'9px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'13px' }}>+ Agregar producto</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:'10px',marginBottom:'20px' }}>
        <div style={{ background:semProm.bg,border:`1px solid ${semProm.color}30`,borderRadius:'10px',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'11px',color:semProm.color,fontWeight:'600',marginBottom:'2px' }}>Semáforo margen promedio</div>
            <div style={{ fontSize:'12px',color:T.muted }}>🟢 ≥25% · 🟡 15-24% · 🔴 &lt;15%</div>
          </div>
          <div style={{ fontSize:'24px',fontWeight:'800',color:semProm.color }}>{margenProm>0?margenProm+'%':'--'}</div>
        </div>
        {[{n:productos.length,l:'Total',c:T.text},{n:activos,l:'Activos',c:T.green},{n:testeo,l:'Testeo',c:T.yellow},{n:combos,l:'Combos',c:T.purple}].map(k=>(
          <div key={k.l} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'12px 16px',textAlign:'center' }}>
            <div style={{ fontSize:'22px',fontWeight:'700',color:k.c }}>{k.n}</div>
            <div style={{ fontSize:'11px',color:T.muted,marginTop:'2px' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap' }}>
        {ESTADOS.map(e=>(
          <button key={e.v} onClick={()=>setFiltro(e.v)}
            style={{ padding:'6px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'12px',border:`1px solid ${filtro===e.v?e.c:T.border}`,background:filtro===e.v?`${e.c}15`:'transparent',color:filtro===e.v?e.c:T.muted,fontWeight:filtro===e.v?'600':'400' }}>
            {e.l}
          </button>
        ))}
        <input style={{...inp,width:'200px',marginLeft:'auto'}} placeholder="🔍 Buscar..." value={buscar} onChange={e=>setBuscar(e.target.value)} />
      </div>

      {/* Tabla */}
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:'12px',overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#060E1C' }}>
                {['#','Tipo','Nombre','Estado','PVP','Costo total','Margen','Semáforo','Modelo','Acciones'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px',textAlign:'left',fontSize:'11px',color:T.muted,fontWeight:'600',whiteSpace:'nowrap',borderBottom:`1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading?(
                <tr><td colSpan={10} style={{ textAlign:'center',padding:'40px',color:T.muted,fontSize:'13px' }}>Cargando...</td></tr>
              ):filtrados.length===0?(
                <tr>
                  <td colSpan={10} style={{ textAlign:'center',padding:'48px' }}>
                    <div style={{ fontSize:'36px',marginBottom:'12px' }}>🛍️</div>
                    <div style={{ fontSize:'14px',fontWeight:'600',color:T.text,marginBottom:'6px' }}>No hay productos aún</div>
                    <div style={{ fontSize:'12px',color:T.muted,marginBottom:'16px' }}>Agrega tu primer producto o usa la carga masiva</div>
                    <button onClick={()=>setShowModal(true)} style={{ padding:'9px 20px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'13px' }}>+ Agregar primer producto</button>
                  </td>
                </tr>
              ):filtrados.map((p,idx)=>{
                const m=calcMargen(p); const s=getSem(m)
                const ct=p.costo_proveedor+p.costo_flete+p.costo_flete_dev+p.costo_fulfillment+p.cf_pedido
                const ec: Record<string,string>={activo:T.green,testeo:T.yellow,borrador:T.muted,inactivo:T.red,temporada:T.purple}
                return (
                  <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`,background:idx%2===0?'transparent':'#080F1C' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='#0F1E32')}
                    onMouseLeave={e=>(e.currentTarget.style.background=idx%2===0?'transparent':'#080F1C')}>
                    <td style={{ padding:'10px 12px',fontSize:'12px',color:T.muted,fontWeight:'600' }}>#{String(idx+1).padStart(4,'0')}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:'10px',fontWeight:'600',padding:'2px 8px',borderRadius:'4px',background:p.tipo==='combo'?`${T.purple}20`:`${T.blue}20`,color:p.tipo==='combo'?T.purple:T.blue }}>
                        {p.tipo==='combo'?'🎁 Combo':'📦 Prod.'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px',fontSize:'13px',color:T.text,fontWeight:'500',maxWidth:'200px' }}>
                      <div style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.nombre}</div>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:'10px',fontWeight:'600',padding:'2px 8px',borderRadius:'4px',background:`${ec[p.estado]||T.muted}20`,color:ec[p.estado]||T.muted }}>{p.estado}</span>
                    </td>
                    <td style={{ padding:'10px 12px',fontSize:'12px',color:T.text,fontWeight:'600' }}>{fmt(p.pvp_final)}</td>
                    <td style={{ padding:'10px 12px',fontSize:'12px',color:T.red }}>{fmt(ct)}</td>
                    <td style={{ padding:'10px 12px',fontSize:'13px',fontWeight:'700',color:s.color }}>{m>0?m.toFixed(1)+'%':'--'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:'10px',fontWeight:'600',padding:'2px 8px',borderRadius:'4px',background:s.bg,color:s.color }}>
                        {m>=25?'✅ Escalar':m>=15?'⚠️ Revisar':m>0?'❌ Ajustar':'⬛ Sin datos'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px',fontSize:'11px',color:T.muted }}>{p.modelo_negocio}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex',gap:'6px' }}>
                        <button onClick={()=>setShowResumen(p)} style={{ padding:'5px 10px',background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'6px',color:T.blue,cursor:'pointer',fontSize:'11px',fontWeight:'600' }}>Ver resumen</button>
                        <button onClick={()=>handleDelete(p.id)} style={{ padding:'5px 8px',background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'6px',color:T.red,cursor:'pointer',fontSize:'11px' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {filtrados.length>0&&<div style={{ textAlign:'center',marginTop:'12px',fontSize:'12px',color:T.muted }}>Mostrando {filtrados.length} de {productos.length} productos</div>}
    </div>
  )
}
