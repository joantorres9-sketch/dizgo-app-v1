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
    CRI:{locale:'es-CR',currency:'CRC',dec:2}, PRY:{locale:'es-PY',currency:'PYG',dec:0},
    VEN:{locale:'es-VE',currency:'VES',dec:2}, ESP:{locale:'es-ES',currency:'EUR',dec:2},
    GTM:{locale:'es-GT',currency:'GTQ',dec:2}, PAN:{locale:'es-PA',currency:'USD',dec:2},
  }
  const c = cfgs[getPais()] || cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).format(v)
}

type CostoFijo = {
  id: string; concepto: string; categoria: string
  cantidad: number; valor_unitario: number; total: number
  pef_cat: string; activo: boolean
}

type CostoVar = {
  id: string; concepto: string; tipo: string
  modelo: string; valor: number; pct_sobre_pvp: number
  pef_cat: string; activo: boolean
}

const inp: React.CSSProperties = {width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'7px',padding:'7px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box'}
const lbl: React.CSSProperties = {fontSize:'11px',color:T.muted,marginBottom:'3px',display:'block'}

const CATEGORIAS_CF = ['Personal Operativo','Gastos Administrativos','Honorarios','Servicios & Arriendo','Plataformas & Apps','Testeos','Formación & Mentoría','Otros']
const CATEGORIAS_CV = ['Pauta Publicitaria','Logística / Flete','Producto / Proveedor','Fulfillment','Pasarela de Pago','Comisiones','Devoluciones','Otros']
const PEF_CATS = [
  {v:'prevencion',l:'P — Prevención',c:T.green},
  {v:'evaluacion',l:'E — Evaluación',c:T.blue},
  {v:'falla_interna',l:'FI — Falla Interna',c:T.yellow},
  {v:'falla_externa',l:'FE — Falla Externa',c:T.red},
  {v:'no_clasificado',l:'Sin clasificar',c:T.muted},
]

function getPefColor(cat: string) {
  return PEF_CATS.find(p=>p.v===cat)?.c || T.muted
}

export default function CostosPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'cf'|'cv'|'pef'>('cf')
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)

  // Costos Fijos
  const [costosFijos, setCostosFijos] = useState<CostoFijo[]>([])
  const [nominalNomina, setNominalNomina] = useState(0)

  // Costos Variables
  const [costosVar, setCostosVar] = useState<CostoVar[]>([])

  // Formulario CF
  const [formCF, setFormCF] = useState({ concepto:'', categoria:'Personal Operativo', cantidad:1, valor_unitario:0, pef_cat:'no_clasificado' })
  const [editCF, setEditCF] = useState<string|null>(null)
  const [showFormCF, setShowFormCF] = useState(false)

  // Formulario CV
  const [formCV, setFormCV] = useState({ concepto:'', tipo:'Pauta Publicitaria', modelo:'dropshipping', valor:0, pct_sobre_pvp:0, pef_cat:'no_clasificado' })
  const [editCV, setEditCV] = useState<string|null>(null)
  const [showFormCV, setShowFormCV] = useState(false)

  // Pedidos para calcular CF/pedido
  const [pedidosMes, setPedidosMes] = useState(0)

  async function loadData() {
    setLoading(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const {data:profile} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    setTenantId(profile.tenant_id)

    // Costos fijos
    const {data:cf} = await supabase.from('costos_fijos').select('*')
      .eq('tenant_id',profile.tenant_id).eq('activo',true).order('categoria')
    setCostosFijos((cf||[]) as CostoFijo[])

    // Costos variables
    const {data:cv} = await supabase.from('costos_variables').select('*')
      .eq('tenant_id',profile.tenant_id).eq('activo',true).order('tipo')
    setCostosVar((cv||[]) as CostoVar[])

    // Nómina: traer total de carga prestacional
    const {data:colaboradores} = await supabase.from('colaboradores')
      .select('carga_total_mes').eq('tenant_id',profile.tenant_id).eq('activo',true)
    const totalNomina = colaboradores?.reduce((a:number,c:any)=>a+(c.carga_total_mes||0),0) || 0
    setNominalNomina(totalNomina)

    // Pedidos entregados del mes actual
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
    const {count} = await supabase.from('pedidos')
      .select('*',{count:'exact',head:true})
      .eq('tenant_id',profile.tenant_id)
      .eq('estado','ENTREGADO')
      .gte('fecha_pedido',inicioMes.toISOString())
    setPedidosMes(count||0)

    setLoading(false)
  }

  useEffect(()=>{ loadData() },[])

  // Totales
  const totalCF = costosFijos.reduce((a,c)=>a+(c.total||c.cantidad*c.valor_unitario),0) + nominalNomina
  const totalCV = costosVar.reduce((a,c)=>a+c.valor,0)
  const cfPorPedido = pedidosMes > 0 ? Math.round(totalCF/pedidosMes) : 0

  // PEF totales
  const pefTotals = PEF_CATS.reduce((acc,cat) => {
    const sumCF = costosFijos.filter(c=>c.pef_cat===cat.v).reduce((a,c)=>a+c.total,0)
    const sumCV = costosVar.filter(c=>c.pef_cat===cat.v).reduce((a,c)=>a+c.valor,0)
    acc[cat.v] = sumCF + sumCV
    return acc
  }, {} as Record<string,number>)

  const totalCalidad = (pefTotals['prevencion']||0) + (pefTotals['evaluacion']||0)
  const totalNoCalidad = (pefTotals['falla_interna']||0) + (pefTotals['falla_externa']||0)

  async function saveCF() {
    if (!formCF.concepto) return
    const total = formCF.cantidad * formCF.valor_unitario
    const payload = { ...formCF, total, tenant_id:tenantId, activo:true, periodo:new Date().toISOString().slice(0,7)+'-01' }
    if (editCF) {
      await supabase.from('costos_fijos').update(payload).eq('id',editCF)
    } else {
      await supabase.from('costos_fijos').insert(payload)
    }
    setFormCF({concepto:'',categoria:'Personal Operativo',cantidad:1,valor_unitario:0,pef_cat:'no_clasificado'})
    setEditCF(null); setShowFormCF(false); loadData()
  }

  async function deleteCF(id: string) {
    if (!confirm('¿Eliminar este costo?')) return
    await supabase.from('costos_fijos').update({activo:false}).eq('id',id)
    loadData()
  }

  async function saveCV() {
    if (!formCV.concepto) return
    const payload = { ...formCV, tenant_id:tenantId, activo:true, periodo:new Date().toISOString().slice(0,7)+'-01' }
    if (editCV) {
      await supabase.from('costos_variables').update(payload).eq('id',editCV)
    } else {
      await supabase.from('costos_variables').insert(payload)
    }
    setFormCV({concepto:'',tipo:'Pauta Publicitaria',modelo:'dropshipping',valor:0,pct_sobre_pvp:0,pef_cat:'no_clasificado'})
    setEditCV(null); setShowFormCV(false); loadData()
  }

  async function deleteCV(id: string) {
    if (!confirm('¿Eliminar este costo?')) return
    await supabase.from('costos_variables').update({activo:false}).eq('id',id)
    loadData()
  }

  const TABS = [
    {v:'cf',l:'💰 Costos Fijos',     c:T.blue},
    {v:'cv',l:'📊 Costos Variables', c:T.green},
    {v:'pef',l:'🔍 Análisis PEF',    c:T.accent},
  ]

  return (
    <div style={{color:T.text,fontFamily:'"DM Sans", system-ui, sans-serif'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'700',color:T.text,marginBottom:'4px'}}>📊 Estructura de Costos</h1>
          <p style={{fontSize:'12px',color:T.muted}}>CF · CV · PEF — Lo que no se mide, no se controla</p>
        </div>
      </div>

      {/* KPIs conectados */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'20px'}}>
        {[
          {l:'Total CF mensual',   v:fmt(totalCF),           sub:'Nómina + operación',    c:T.blue},
          {l:'Total CV mensual',   v:fmt(totalCV),           sub:'Variables por venta',   c:T.green},
          {l:'CF por pedido',      v:fmt(cfPorPedido),       sub:`${pedidosMes} pedidos entregados`, c:T.accent},
          {l:'Costo total real',   v:fmt(totalCF+totalCV),   sub:'CF + CV del mes',       c:T.text},
        ].map(k=>(
          <div key={k.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'12px 16px',borderTop:`3px solid ${k.c}`}}>
            <div style={{fontSize:'11px',color:T.muted,marginBottom:'4px'}}>{k.l}</div>
            <div style={{fontSize:'18px',fontWeight:'700',color:k.c,marginBottom:'2px'}}>{k.v}</div>
            <div style={{fontSize:'10px',color:T.muted}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Alerta nómina conectada */}
      {nominalNomina > 0 && (
        <div style={{background:`${T.green}10`,border:`1px solid ${T.green}30`,borderRadius:'9px',padding:'10px 14px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'10px',fontSize:'12px',color:T.green}}>
          <span>👥</span>
          <span>Nómina conectada automáticamente: <strong>{fmt(nominalNomina)}</strong> de carga prestacional incluidos en CF</span>
          <a href="/dashboard/nomina" style={{marginLeft:'auto',color:T.green,fontSize:'11px',textDecoration:'underline'}}>Ver nómina →</a>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:'6px',marginBottom:'16px'}}>
        {TABS.map(t=>(
          <button key={t.v} onClick={()=>setTab(t.v as any)}
            style={{padding:'8px 16px',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:tab===t.v?'600':'400',border:`1px solid ${tab===t.v?t.c:T.border}`,background:tab===t.v?`${t.c}15`:'transparent',color:tab===t.v?t.c:T.muted}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── TAB: COSTOS FIJOS ── */}
      {tab==='cf' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'12px'}}>
            <button onClick={()=>{setShowFormCF(true);setEditCF(null);setFormCF({concepto:'',categoria:'Personal Operativo',cantidad:1,valor_unitario:0,pef_cat:'no_clasificado'})}}
              style={{padding:'8px 16px',background:T.blue,border:'none',borderRadius:'8px',color:'#fff',fontWeight:'600',cursor:'pointer',fontSize:'13px'}}>
              + Agregar CF
            </button>
          </div>

          {/* Formulario CF */}
          {showFormCF && (
            <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px',marginBottom:'16px'}}>
              <div style={{fontSize:'12px',fontWeight:'600',color:T.blue,marginBottom:'12px'}}>{editCF?'Editar':'Nuevo'} Costo Fijo</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                <div><label style={lbl}>Concepto *</label><input style={inp} value={formCF.concepto} onChange={e=>setFormCF(f=>({...f,concepto:e.target.value}))} placeholder="Ej: Arriendo oficina" /></div>
                <div><label style={lbl}>Categoría</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCF.categoria} onChange={e=>setFormCF(f=>({...f,categoria:e.target.value}))}>
                    {CATEGORIAS_CF.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Cantidad</label><input style={inp} type="number" value={formCF.cantidad||''} onChange={e=>setFormCF(f=>({...f,cantidad:parseFloat(e.target.value)||1}))} /></div>
                <div><label style={lbl}>Valor unitario</label><input style={inp} type="number" value={formCF.valor_unitario||''} onChange={e=>setFormCF(f=>({...f,valor_unitario:parseFloat(e.target.value)||0}))} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:'8px',marginBottom:'12px'}}>
                <div><label style={lbl}>Clasificación PEF</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCF.pef_cat} onChange={e=>setFormCF(f=>({...f,pef_cat:e.target.value}))}>
                    {PEF_CATS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',alignItems:'flex-end',gap:'6px'}}>
                  <div style={{flex:1,background:`${T.blue}15`,borderRadius:'7px',padding:'8px 12px',fontSize:'12px',color:T.blue}}>
                    Total: <strong>{fmt(formCF.cantidad * formCF.valor_unitario)}</strong>
                  </div>
                  <button onClick={saveCF} style={{padding:'8px 16px',background:T.accent,border:'none',borderRadius:'7px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'12px'}}>Guardar</button>
                  <button onClick={()=>setShowFormCF(false)} style={{padding:'8px 12px',background:'transparent',border:`1px solid ${T.border}`,borderRadius:'7px',color:T.muted,cursor:'pointer',fontSize:'12px'}}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* Tabla CF por categoría */}
          {CATEGORIAS_CF.map(cat => {
            const items = costosFijos.filter(c=>c.categoria===cat)
            if (items.length===0 && cat!=='Personal Operativo') return null
            const subtotal = items.reduce((a,c)=>a+c.total,0)
            return (
              <div key={cat} style={{marginBottom:'12px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'#060E1C',borderRadius:'8px 8px 0 0',borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontSize:'12px',fontWeight:'600',color:T.blue}}>{cat}</div>
                  <div style={{fontSize:'12px',fontWeight:'700',color:T.text}}>{fmt(subtotal + (cat==='Personal Operativo'?nominalNomina:0))}</div>
                </div>
                {cat==='Personal Operativo' && nominalNomina>0 && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:`${T.green}08`,borderBottom:`1px solid ${T.border}`}}>
                    <div style={{fontSize:'11px',color:T.green}}>👥 Nómina (automático desde módulo Nómina)</div>
                    <div style={{fontSize:'12px',fontWeight:'600',color:T.green}}>{fmt(nominalNomina)}</div>
                  </div>
                )}
                {items.map(c=>(
                  <div key={c.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:T.card,borderBottom:`1px solid ${T.border}`}}>
                    <div style={{flex:1,fontSize:'12px',color:T.text}}>{c.concepto}</div>
                    <div style={{fontSize:'11px',color:T.muted,width:'80px',textAlign:'right'}}>{c.cantidad} × {fmt(c.valor_unitario)}</div>
                    <div style={{fontSize:'12px',fontWeight:'600',color:T.text,width:'100px',textAlign:'right'}}>{fmt(c.total)}</div>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:getPefColor(c.pef_cat),flexShrink:0}} title={c.pef_cat} />
                    <button onClick={()=>{setFormCF({concepto:c.concepto,categoria:c.categoria,cantidad:c.cantidad,valor_unitario:c.valor_unitario,pef_cat:c.pef_cat});setEditCF(c.id);setShowFormCF(true)}}
                      style={{padding:'3px 8px',background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'5px',color:T.blue,cursor:'pointer',fontSize:'10px'}}>✏️</button>
                    <button onClick={()=>deleteCF(c.id)}
                      style={{padding:'3px 8px',background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'5px',color:T.red,cursor:'pointer',fontSize:'10px'}}>🗑</button>
                  </div>
                ))}
                {items.length===0 && cat!=='Personal Operativo' && (
                  <div style={{padding:'10px 12px',background:T.card,fontSize:'11px',color:T.muted}}>Sin registros en esta categoría</div>
                )}
              </div>
            )
          })}

          <div style={{display:'flex',justifyContent:'flex-end',marginTop:'8px'}}>
            <div style={{background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'9px',padding:'10px 20px',fontSize:'13px',color:T.blue,fontWeight:'700'}}>
              TOTAL CF: {fmt(totalCF)}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: COSTOS VARIABLES ── */}
      {tab==='cv' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'12px'}}>
            <button onClick={()=>{setShowFormCV(true);setEditCV(null)}}
              style={{padding:'8px 16px',background:T.green,border:'none',borderRadius:'8px',color:T.card,fontWeight:'600',cursor:'pointer',fontSize:'13px'}}>
              + Agregar CV
            </button>
          </div>

          {showFormCV && (
            <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px',marginBottom:'16px'}}>
              <div style={{fontSize:'12px',fontWeight:'600',color:T.green,marginBottom:'12px'}}>{editCV?'Editar':'Nuevo'} Costo Variable</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                <div><label style={lbl}>Concepto *</label><input style={inp} value={formCV.concepto} onChange={e=>setFormCV(f=>({...f,concepto:e.target.value}))} placeholder="Ej: Flete envío promedio" /></div>
                <div><label style={lbl}>Tipo</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCV.tipo} onChange={e=>setFormCV(f=>({...f,tipo:e.target.value}))}>
                    {CATEGORIAS_CV.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Valor ($)</label><input style={inp} type="number" value={formCV.valor||''} onChange={e=>setFormCV(f=>({...f,valor:parseFloat(e.target.value)||0}))} /></div>
                <div><label style={lbl}>% sobre PVP</label><input style={inp} type="number" value={formCV.pct_sobre_pvp||''} onChange={e=>setFormCV(f=>({...f,pct_sobre_pvp:parseFloat(e.target.value)||0}))} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:'8px',marginBottom:'12px'}}>
                <div><label style={lbl}>Modelo negocio</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCV.modelo} onChange={e=>setFormCV(f=>({...f,modelo:e.target.value}))}>
                    <option value="dropshipping">Dropshipping</option>
                    <option value="importador">Importador</option>
                    <option value="produccion_propia">Producción propia</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="todos">Todos</option>
                  </select>
                </div>
                <div><label style={lbl}>Clasificación PEF</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCV.pef_cat} onChange={e=>setFormCV(f=>({...f,pef_cat:e.target.value}))}>
                    {PEF_CATS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',alignItems:'flex-end',gap:'6px'}}>
                  <button onClick={saveCV} style={{padding:'8px 16px',background:T.accent,border:'none',borderRadius:'7px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'12px'}}>Guardar</button>
                  <button onClick={()=>setShowFormCV(false)} style={{padding:'8px 12px',background:'transparent',border:`1px solid ${T.border}`,borderRadius:'7px',color:T.muted,cursor:'pointer',fontSize:'12px'}}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#060E1C'}}>
                  {['Concepto','Tipo','Modelo','Valor ($)','% PVP','PEF','Acciones'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:'11px',color:T.muted,fontWeight:'600',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costosVar.length===0?(
                  <tr><td colSpan={7} style={{textAlign:'center',padding:'30px',color:T.muted,fontSize:'12px'}}>No hay costos variables registrados</td></tr>
                ):costosVar.map((c,i)=>(
                  <tr key={c.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':'#080F1C'}}>
                    <td style={{padding:'8px 12px',fontSize:'12px',color:T.text}}>{c.concepto}</td>
                    <td style={{padding:'8px 12px',fontSize:'11px',color:T.muted}}>{c.tipo}</td>
                    <td style={{padding:'8px 12px',fontSize:'11px',color:T.muted}}>{c.modelo}</td>
                    <td style={{padding:'8px 12px',fontSize:'12px',color:T.green,fontWeight:'600'}}>{fmt(c.valor)}</td>
                    <td style={{padding:'8px 12px',fontSize:'12px',color:T.muted}}>{c.pct_sobre_pvp>0?c.pct_sobre_pvp+'%':'—'}</td>
                    <td style={{padding:'8px 12px'}}>
                      <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 8px',borderRadius:'4px',background:`${getPefColor(c.pef_cat)}20`,color:getPefColor(c.pef_cat)}}>
                        {PEF_CATS.find(p=>p.v===c.pef_cat)?.l||'Sin clasificar'}
                      </span>
                    </td>
                    <td style={{padding:'8px 12px'}}>
                      <div style={{display:'flex',gap:'4px'}}>
                        <button onClick={()=>{setFormCV({concepto:c.concepto,tipo:c.tipo,modelo:c.modelo,valor:c.valor,pct_sobre_pvp:c.pct_sobre_pvp,pef_cat:c.pef_cat});setEditCV(c.id);setShowFormCV(true)}}
                          style={{padding:'3px 8px',background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'5px',color:T.blue,cursor:'pointer',fontSize:'10px'}}>✏️</button>
                        <button onClick={()=>deleteCV(c.id)}
                          style={{padding:'3px 8px',background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'5px',color:T.red,cursor:'pointer',fontSize:'10px'}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{display:'flex',justifyContent:'flex-end',marginTop:'8px'}}>
            <div style={{background:`${T.green}15`,border:`1px solid ${T.green}30`,borderRadius:'9px',padding:'10px 20px',fontSize:'13px',color:T.green,fontWeight:'700'}}>
              TOTAL CV: {fmt(totalCV)}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PEF ── */}
      {tab==='pef' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px',marginBottom:'20px'}}>
            {/* Calidad vs No Calidad */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px'}}>
              <div style={{fontSize:'12px',fontWeight:'700',color:T.green,marginBottom:'12px'}}>✅ Costos de CALIDAD (Inversión)</div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                <span style={{fontSize:'12px',color:T.muted}}>Prevención (P)</span>
                <span style={{fontSize:'12px',fontWeight:'600',color:T.green}}>{fmt(pefTotals['prevencion']||0)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}>
                <span style={{fontSize:'12px',color:T.muted}}>Evaluación (E)</span>
                <span style={{fontSize:'12px',fontWeight:'600',color:T.blue}}>{fmt(pefTotals['evaluacion']||0)}</span>
              </div>
              <div style={{height:'1px',background:T.border,marginBottom:'8px'}} />
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:'13px',fontWeight:'700',color:T.green}}>Total calidad</span>
                <span style={{fontSize:'13px',fontWeight:'700',color:T.green}}>{fmt(totalCalidad)}</span>
              </div>
            </div>

            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px'}}>
              <div style={{fontSize:'12px',fontWeight:'700',color:T.red,marginBottom:'12px'}}>❌ Costos de NO CALIDAD (Pérdida)</div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                <span style={{fontSize:'12px',color:T.muted}}>Fallas Internas (FI)</span>
                <span style={{fontSize:'12px',fontWeight:'600',color:T.yellow}}>{fmt(pefTotals['falla_interna']||0)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}>
                <span style={{fontSize:'12px',color:T.muted}}>Fallas Externas (FE)</span>
                <span style={{fontSize:'12px',fontWeight:'600',color:T.red}}>{fmt(pefTotals['falla_externa']||0)}</span>
              </div>
              <div style={{height:'1px',background:T.border,marginBottom:'8px'}} />
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:'13px',fontWeight:'700',color:T.red}}>Total no calidad</span>
                <span style={{fontSize:'13px',fontWeight:'700',color:T.red}}>{fmt(totalNoCalidad)}</span>
              </div>
            </div>
          </div>

          {/* Alerta PEF */}
          {totalNoCalidad > totalCalidad ? (
            <div style={{background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'9px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:T.red}}>
              <strong>⚠️ ALERTA PEF:</strong> Estás gastando más en fallas ({fmt(totalNoCalidad)}) que en prevención ({fmt(totalCalidad)}). 
              Invierte en prevención para reducir las pérdidas por fallas.
            </div>
          ) : (
            <div style={{background:`${T.green}15`,border:`1px solid ${T.green}30`,borderRadius:'9px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:T.green}}>
              <strong>✅ PEF SALUDABLE:</strong> Tu inversión en calidad ({fmt(totalCalidad)}) supera los costos de fallas ({fmt(totalNoCalidad)}). ¡Sigue así!
            </div>
          )}

          {/* Barras visuales */}
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:'700',color:T.text,marginBottom:'14px'}}>Distribución PEF</div>
            {PEF_CATS.filter(p=>p.v!=='no_clasificado').map(cat => {
              const total = pefTotals[cat.v]||0
              const totalGeneral = Object.values(pefTotals).reduce((a,v)=>a+v,0)
              const pct = totalGeneral>0 ? Math.round(total/totalGeneral*100) : 0
              return (
                <div key={cat.v} style={{marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                    <span style={{fontSize:'11px',color:cat.c,fontWeight:'600'}}>{cat.l}</span>
                    <span style={{fontSize:'11px',color:T.text,fontWeight:'600'}}>{fmt(total)} ({pct}%)</span>
                  </div>
                  <div style={{background:T.border,borderRadius:'4px',height:'8px'}}>
                    <div style={{background:cat.c,borderRadius:'4px',height:'8px',width:`${pct}%`,transition:'width 0.3s'}} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
