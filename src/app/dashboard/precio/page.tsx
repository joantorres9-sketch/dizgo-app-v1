'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238'
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
  }
  const c = cfgs[getPais()] || cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).format(v)
}

type Producto = {
  id: string; nombre: string; tipo: string; estado: string
  pvp_final: number; costo_proveedor: number; costo_flete: number
  costo_flete_dev: number; costo_fulfillment: number; cf_pedido: number
  pct_devolucion: number; pct_publicidad: number; pct_desc_popup: number
  pct_com_plataforma: number; pct_pasarela: number; pct_com_pasarela: number
  pct_com_ventas: number; pct_com_admin: number; pvp_historial: any[]
}

const inp: React.CSSProperties = {width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'7px',padding:'8px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box'}
const lbl: React.CSSProperties = {fontSize:'11px',color:T.muted,marginBottom:'4px',display:'block'}

export default function PrecioPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [prodSel, setProdSel] = useState<Producto|null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pvpHumano, setPvpHumano] = useState(0)
  const [margenDeseado, setMargenDeseado] = useState(25)
  const [motivo, setMotivo] = useState('ajuste')
  const [tab, setTab] = useState<'costeo'|'historia'|'volumen'>('costeo')

  async function loadData() {
    setLoading(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const {data:profile} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    setTenantId(profile.tenant_id)
    const {data} = await supabase.from('productos').select('*')
      .eq('tenant_id',profile.tenant_id).eq('tipo','producto').order('nombre')
    setProductos((data||[]) as Producto[])
    setLoading(false)
  }

  useEffect(()=>{ loadData() },[])

  function selProducto(p: Producto) {
    setProdSel(p)
    setPvpHumano(p.pvp_final||0)
    setTab('costeo')
  }

  // ── FÓRMULA CORRECTA DE COSTEO INVERSO ──
  // PVS = Costos totales / (1 - suma_pcts)
  function calcPVS(p: Producto, margen: number) {
    if (!p) return 0
    const costosFijos = p.costo_proveedor + p.costo_flete + p.costo_flete_dev + p.costo_fulfillment + p.cf_pedido
    const sumPcts = (p.pct_devolucion + p.pct_publicidad + p.pct_desc_popup + p.pct_com_plataforma + p.pct_pasarela + p.pct_com_pasarela + p.pct_com_ventas + p.pct_com_admin + margen) / 100
    if (sumPcts >= 1) return 0
    return Math.round(costosFijos / (1 - sumPcts))
  }

  function calcMargenReal(p: Producto, pvp: number) {
    if (!p || !pvp) return 0
    const costosFijos = p.costo_proveedor + p.costo_flete + p.costo_flete_dev + p.costo_fulfillment + p.cf_pedido
    const sumPcts = (p.pct_devolucion + p.pct_publicidad + p.pct_desc_popup + p.pct_com_plataforma + p.pct_pasarela + p.pct_com_pasarela + p.pct_com_ventas + p.pct_com_admin) / 100
    const costoTotal = costosFijos + (pvp * sumPcts)
    return Math.round(((pvp - costoTotal) / pvp) * 1000) / 10
  }

  function getCalificacion(margen: number) {
    if (margen >= 25) return { label:'✅ ÓPTIMA', color:T.green, desc:'Producto rentable y escalable' }
    if (margen >= 15) return { label:'⚠️ RIESGOSA', color:T.yellow, desc:'Margen bajo — revisar costos' }
    return { label:'❌ PELIGROSA', color:T.red, desc:'Operando en zona de pérdida' }
  }

  const pvsSugerido = prodSel ? calcPVS(prodSel, margenDeseado) : 0
  const margenReal = prodSel ? calcMargenReal(prodSel, pvpHumano) : 0
  const calif = getCalificacion(margenReal)

  // Psicología del precio
  const redondeosComunes = pvpHumano > 0 ? [
    Math.floor(pvpHumano/1000)*1000,
    Math.ceil(pvpHumano/1000)*1000 - 100,
    Math.ceil(pvpHumano/5000)*5000 - 1,
    Math.floor(pvpHumano/10000)*10000 + 9900,
  ].filter((v,i,a)=>v>0&&a.indexOf(v)===i).sort((a,b)=>a-b) : []

  // PVP x2 y x3
  const pvpX2 = pvpHumano > 0 ? Math.round(pvpHumano*1.9) : 0
  const pvpX3 = pvpHumano > 0 ? Math.round(pvpHumano*2.7) : 0

  async function guardarPVP() {
    if (!prodSel || !pvpHumano) return
    setSaving(true)
    const historial = [...(prodSel.pvp_historial||[]), {
      fecha: new Date().toISOString(),
      pvp_anterior: prodSel.pvp_final,
      pvp_nuevo: pvpHumano,
      motivo, margen_anterior: calcMargenReal(prodSel, prodSel.pvp_final),
      margen_nuevo: margenReal
    }]
    await supabase.from('productos').update({
      pvp_final: pvpHumano,
      pvp_historial: historial,
      precio_motivo: motivo,
      pvp_x2_final: pvpX2,
      pvp_x3_final: pvpX3,
    }).eq('id',prodSel.id)
    setProdSel({...prodSel, pvp_final:pvpHumano, pvp_historial:historial})
    setSaving(false)
    loadData()
  }

  const costosFijosTotal = prodSel
    ? prodSel.costo_proveedor + prodSel.costo_flete + prodSel.costo_flete_dev + prodSel.costo_fulfillment + prodSel.cf_pedido
    : 0
  const costosVarTotal = prodSel && pvpHumano
    ? pvpHumano * ((prodSel.pct_devolucion + prodSel.pct_publicidad + prodSel.pct_desc_popup + prodSel.pct_com_plataforma + prodSel.pct_pasarela + prodSel.pct_com_pasarela + prodSel.pct_com_ventas + prodSel.pct_com_admin) / 100)
    : 0

  return (
    <div style={{color:T.text,fontFamily:'"DM Sans", system-ui, sans-serif'}}>
      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'22px',fontWeight:'700',color:T.text,marginBottom:'4px'}}>💡 Precio & Costeo Inverso</h1>
        <p style={{fontSize:'12px',color:T.muted}}>La fórmula correcta: PVS = Costos / (1 - %pub - %com - %margen)</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:'16px'}}>

        {/* Lista de productos */}
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',overflow:'hidden',height:'fit-content'}}>
          <div style={{padding:'12px 14px',borderBottom:`1px solid ${T.border}`,fontSize:'12px',fontWeight:'600',color:T.muted}}>
            Selecciona un producto
          </div>
          {loading ? (
            <div style={{padding:'20px',textAlign:'center',fontSize:'12px',color:T.muted}}>Cargando...</div>
          ) : productos.length===0 ? (
            <div style={{padding:'20px',textAlign:'center'}}>
              <div style={{fontSize:'12px',color:T.muted,marginBottom:'8px'}}>No hay productos</div>
              <a href="/dashboard/productos" style={{fontSize:'11px',color:T.accent}}>Ir al catálogo →</a>
            </div>
          ) : productos.map(p=>{
            const m = calcMargenReal(p, p.pvp_final)
            const sc = m>=25?T.green:m>=15?T.yellow:T.red
            return (
              <div key={p.id} onClick={()=>selProducto(p)}
                style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`,cursor:'pointer',background:prodSel?.id===p.id?`${T.accent}10`:'transparent',borderLeft:`3px solid ${prodSel?.id===p.id?T.accent:'transparent'}`}}>
                <div style={{fontSize:'12px',fontWeight:'600',color:T.text,marginBottom:'3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nombre}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'11px',color:T.muted}}>{fmt(p.pvp_final)}</span>
                  <span style={{fontSize:'11px',fontWeight:'700',color:sc}}>{m>0?m.toFixed(1)+'%':'--'}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Panel derecho */}
        {!prodSel ? (
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',padding:'60px',textAlign:'center'}}>
            <div>
              <div style={{fontSize:'40px',marginBottom:'12px'}}>💡</div>
              <div style={{fontSize:'14px',fontWeight:'600',color:T.text,marginBottom:'6px'}}>Selecciona un producto</div>
              <div style={{fontSize:'12px',color:T.muted}}>Elige un producto de la lista para calcular su precio óptimo</div>
            </div>
          </div>
        ) : (
          <div>
            {/* Nombre del producto */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'14px 16px',marginBottom:'12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:'700',color:T.text}}>{prodSel.nombre}</div>
                <div style={{fontSize:'11px',color:T.muted,marginTop:'2px'}}>{prodSel.tipo} · {prodSel.estado}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'11px',color:T.muted}}>Calificación IA</div>
                <div style={{fontSize:'13px',fontWeight:'700',color:calif.color}}>{calif.label}</div>
                <div style={{fontSize:'10px',color:T.muted}}>{calif.desc}</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
              {[{v:'costeo',l:'📊 Costeo Inverso'},{v:'historia',l:'📋 Historial'},{v:'volumen',l:'🎯 Volumen x2/x3'}].map(t=>(
                <button key={t.v} onClick={()=>setTab(t.v as any)}
                  style={{padding:'7px 14px',borderRadius:'7px',cursor:'pointer',fontSize:'12px',fontWeight:tab===t.v?'600':'400',border:`1px solid ${tab===t.v?T.accent:T.border}`,background:tab===t.v?`${T.accent}15`:'transparent',color:tab===t.v?T.accent:T.muted}}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* TAB: COSTEO INVERSO */}
            {tab==='costeo' && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>

                {/* Columna 1: Estructura de costos */}
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'14px'}}>
                  <div style={{fontSize:'12px',fontWeight:'700',color:T.blue,marginBottom:'12px'}}>💰 ESTRUCTURA DE COSTOS</div>

                  {/* Costos fijos */}
                  <div style={{fontSize:'11px',fontWeight:'600',color:T.muted,marginBottom:'6px'}}>COSTOS DIRECTOS ($)</div>
                  {[
                    ['Proveedor',prodSel.costo_proveedor],
                    ['Flete envío',prodSel.costo_flete],
                    ['Flete devolución',prodSel.costo_flete_dev],
                    ['Fulfillment',prodSel.costo_fulfillment],
                    ['CF por pedido',prodSel.cf_pedido],
                  ].map(([k,v])=>(
                    <div key={k as string} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:'12px',borderBottom:`1px solid ${T.border}`}}>
                      <span style={{color:T.muted}}>{k}</span>
                      <span style={{color:T.text,fontWeight:'500'}}>{fmt(v as number)}</span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:'12px',fontWeight:'700'}}>
                    <span style={{color:T.text}}>Subtotal directo</span>
                    <span style={{color:T.red}}>{fmt(costosFijosTotal)}</span>
                  </div>

                  <div style={{height:'1px',background:T.border,margin:'8px 0'}} />

                  {/* Porcentajes */}
                  <div style={{fontSize:'11px',fontWeight:'600',color:T.muted,marginBottom:'6px'}}>PORCENTAJES (% del PVP)</div>
                  {[
                    ['Devolución',prodSel.pct_devolucion],
                    ['Publicidad',prodSel.pct_publicidad],
                    ['Desc. popup',prodSel.pct_desc_popup],
                    ['Com. plataforma',prodSel.pct_com_plataforma],
                    ['Pasarela',prodSel.pct_pasarela],
                    ['Com. ventas',prodSel.pct_com_ventas],
                    ['Com. admin',prodSel.pct_com_admin],
                  ].map(([k,v])=>(
                    <div key={k as string} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:'12px',borderBottom:`1px solid ${T.border}`}}>
                      <span style={{color:T.muted}}>{k}</span>
                      <span style={{color:T.text}}>{v}%</span>
                    </div>
                  ))}
                </div>

                {/* Columna 2: Calculadora */}
                <div>
                  {/* PVS Sugerido */}
                  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
                    <div style={{fontSize:'12px',fontWeight:'700',color:T.green,marginBottom:'12px'}}>🎯 PVS SUGERIDO POR EL SISTEMA</div>
                    <div style={{marginBottom:'10px'}}>
                      <label style={lbl}>Margen deseado (%)</label>
                      <input style={inp} type="number" value={margenDeseado} onChange={e=>setMargenDeseado(parseFloat(e.target.value)||25)} min="5" max="60" />
                    </div>
                    <div style={{background:`${T.green}15`,border:`1px solid ${T.green}30`,borderRadius:'8px',padding:'12px',textAlign:'center',marginBottom:'10px'}}>
                      <div style={{fontSize:'11px',color:T.muted,marginBottom:'4px'}}>PVS mínimo para margen de {margenDeseado}%</div>
                      <div style={{fontSize:'26px',fontWeight:'800',color:T.green}}>{fmt(pvsSugerido)}</div>
                      <div style={{fontSize:'10px',color:T.muted,marginTop:'4px'}}>
                        Fórmula: Costos / (1 - {((prodSel.pct_devolucion+prodSel.pct_publicidad+prodSel.pct_desc_popup+prodSel.pct_com_plataforma+prodSel.pct_pasarela+prodSel.pct_com_ventas+prodSel.pct_com_admin+margenDeseado)/100*100).toFixed(0)}%)
                      </div>
                    </div>

                    {/* Redondeados */}
                    {redondeosComunes.length > 0 && (
                      <div>
                        <div style={{fontSize:'11px',color:T.muted,marginBottom:'6px'}}>💡 Sugerencias de precio psicológico</div>
                        <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                          {redondeosComunes.slice(0,4).map(v=>(
                            <button key={v} onClick={()=>setPvpHumano(v)}
                              style={{padding:'5px 10px',background:`${T.purple}15`,border:`1px solid ${T.purple}30`,borderRadius:'6px',color:T.purple,cursor:'pointer',fontSize:'11px',fontWeight:'600'}}>
                              {fmt(v)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PVP definido por el humano */}
                  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'14px'}}>
                    <div style={{fontSize:'12px',fontWeight:'700',color:T.accent,marginBottom:'12px'}}>👤 PVP DEFINIDO POR TI</div>
                    <div style={{marginBottom:'10px'}}>
                      <label style={lbl}>Precio de venta final ({getPais()==='COL'?'COP':getPais()==='ECU'?'USD':'moneda local'})</label>
                      <input style={{...inp,fontSize:'16px',padding:'10px',fontWeight:'700',borderColor:T.accent}} type="number" value={pvpHumano||''} onChange={e=>setPvpHumano(parseFloat(e.target.value)||0)} />
                    </div>

                    {/* Impacto en tiempo real */}
                    {pvpHumano > 0 && (
                      <div style={{marginBottom:'12px'}}>
                        <div style={{background:calif.color==='#2DD4A0'?`${T.green}12`:calif.color==='#F5A623'?`${T.yellow}12`:`${T.red}12`,border:`1px solid ${calif.color}30`,borderRadius:'8px',padding:'10px',marginBottom:'8px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                            <span style={{fontSize:'12px',color:T.muted}}>Costos directos</span>
                            <span style={{fontSize:'12px',color:T.red,fontWeight:'600'}}>{fmt(costosFijosTotal)}</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                            <span style={{fontSize:'12px',color:T.muted}}>Costos variables</span>
                            <span style={{fontSize:'12px',color:T.yellow,fontWeight:'600'}}>{fmt(costosVarTotal)}</span>
                          </div>
                          <div style={{height:'1px',background:T.border,margin:'6px 0'}} />
                          <div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{fontSize:'13px',fontWeight:'700',color:T.text}}>Margen neto real</span>
                            <span style={{fontSize:'16px',fontWeight:'800',color:calif.color}}>{margenReal.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{fontSize:'12px',fontWeight:'600',color:calif.color,textAlign:'center'}}>{calif.label} — {calif.desc}</div>
                      </div>
                    )}

                    {/* Motivo */}
                    <div style={{marginBottom:'10px'}}>
                      <label style={lbl}>Motivo del precio</label>
                      <select style={{...inp,appearance:'none' as any}} value={motivo} onChange={e=>setMotivo(e.target.value)}>
                        <option value="ajuste">Ajuste de margen</option>
                        <option value="oportunidad">Oportunidad de mercado</option>
                        <option value="remate">Remate / Liquidación</option>
                        <option value="estrategico">Precio estratégico</option>
                        <option value="temporada">Temporada / Oferta</option>
                      </select>
                    </div>

                    <button onClick={guardarPVP} disabled={saving||!pvpHumano}
                      style={{width:'100%',padding:'11px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:saving||!pvpHumano?'not-allowed':'pointer',fontSize:'13px',opacity:saving||!pvpHumano?0.6:1}}>
                      {saving?'Guardando...':'💾 Guardar PVP — Aplicar a toda la app'}
                    </button>
                    <div style={{fontSize:'10px',color:T.muted,textAlign:'center',marginTop:'6px'}}>
                      Este precio se aplicará al catálogo, costos, publicidad y logística
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: HISTORIAL */}
            {tab==='historia' && (
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`,fontSize:'12px',fontWeight:'600',color:T.text}}>
                  Historial de precios — {prodSel.nombre}
                </div>
                {!prodSel.pvp_historial || prodSel.pvp_historial.length===0 ? (
                  <div style={{padding:'30px',textAlign:'center',fontSize:'12px',color:T.muted}}>
                    No hay cambios de precio registrados aún
                  </div>
                ) : [...prodSel.pvp_historial].reverse().map((h,i)=>(
                  <div key={i} style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:'12px'}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'12px',color:T.muted,marginBottom:'2px'}}>
                        {new Date(h.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </div>
                      <div style={{fontSize:'11px',color:T.muted,textTransform:'capitalize'}}>{h.motivo}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'11px',color:T.muted,textDecoration:'line-through'}}>{fmt(h.pvp_anterior)}</div>
                      <div style={{fontSize:'13px',fontWeight:'700',color:T.text}}>→ {fmt(h.pvp_nuevo)}</div>
                    </div>
                    <div style={{textAlign:'right',minWidth:'60px'}}>
                      <div style={{fontSize:'11px',color:T.muted}}>{h.margen_anterior?.toFixed(1)}%</div>
                      <div style={{fontSize:'13px',fontWeight:'700',color:h.margen_nuevo>=25?T.green:h.margen_nuevo>=15?T.yellow:T.red}}>→ {h.margen_nuevo?.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: VOLUMEN */}
            {tab==='volumen' && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                {[
                  {label:'Precio x2 (combo de 2)',pvp:pvpX2,desc:'-10% vs precio individual',ahorro:pvpHumano*2-pvpX2},
                  {label:'Precio x3 (combo de 3)',pvp:pvpX3,desc:'-15% vs precio individual',ahorro:pvpHumano*3-pvpX3},
                ].map(v=>{
                  const m = prodSel ? calcMargenReal({...prodSel,costo_proveedor:prodSel.costo_proveedor*(v.pvp===pvpX2?2:3),costo_flete:prodSel.costo_flete},v.pvp) : 0
                  return (
                    <div key={v.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px'}}>
                      <div style={{fontSize:'12px',fontWeight:'700',color:T.purple,marginBottom:'12px'}}>{v.label}</div>
                      <div style={{fontSize:'28px',fontWeight:'800',color:T.text,marginBottom:'4px'}}>{fmt(v.pvp)}</div>
                      <div style={{fontSize:'11px',color:T.muted,marginBottom:'8px'}}>{v.desc}</div>
                      <div style={{fontSize:'12px',color:T.green,marginBottom:'8px'}}>Ahorro cliente: {fmt(v.ahorro)}</div>
                      <div style={{fontSize:'13px',fontWeight:'700',color:m>=25?T.green:m>=15?T.yellow:T.red}}>Margen: {m.toFixed(1)}%</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
