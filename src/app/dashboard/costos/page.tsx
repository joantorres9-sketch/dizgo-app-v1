'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238'
}

// ── HELPERS ───────────────────────────────────────────────
function getPais() {
  if (typeof window === 'undefined') return 'COL'
  return localStorage.getItem('dizgo_pais') || 'COL'
}
function fmt(v: number) {
  const cfgs: Record<string,{locale:string;currency:string;dec:number}> = {
    COL:{locale:'es-CO',currency:'COP',dec:0},ECU:{locale:'en-US',currency:'USD',dec:2},
    MEX:{locale:'es-MX',currency:'MXN',dec:2},PER:{locale:'es-PE',currency:'PEN',dec:2},
    CHL:{locale:'es-CL',currency:'CLP',dec:0},ARG:{locale:'es-AR',currency:'ARS',dec:2},
    CRI:{locale:'es-CR',currency:'CRC',dec:2},PRY:{locale:'es-PY',currency:'PYG',dec:0},
    VEN:{locale:'es-VE',currency:'VES',dec:2},ESP:{locale:'es-ES',currency:'EUR',dec:2},
    GTM:{locale:'es-GT',currency:'GTQ',dec:2},PAN:{locale:'es-PA',currency:'USD',dec:2},
  }
  const c = cfgs[getPais()]||cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).format(v)
}

// ── TIPOS ─────────────────────────────────────────────────
type CF = {
  id:string; concepto:string; categoria:string; cantidad:number
  valor_unitario:number; total:number; pef_cat:string; activo:boolean
  tipo_registro:'historico'|'predeterminado'; notas?:string
}
type CV = {
  id:string; concepto:string; tipo:string; modelo:string
  valor:number; pct_sobre_pvp:number; pef_cat:string; activo:boolean
}
type Producto = { id:string; nombre:string; estado:string; ciclo_vida:string }

// ── CONSTANTES ────────────────────────────────────────────
const CATS_CF_BASE = [
  '👥 Personal Operativo','🏢 Gastos Administrativos','⚖️ Honorarios',
  '🔌 Servicios & Arriendo','💻 Plataformas & Apps',
  '🧪 Testeos de Productos','🎓 Formación & Mentoría','📦 Otros'
]
const CATS_CV = [
  'Pauta Publicitaria','Logística / Flete','Flete Devolución',
  'Costo Producto / Proveedor','Fulfillment','Pasarela de Pago',
  'Comisiones','Empaque / Etiquetado','Aranceles / Aduana','Otros'
]
const MODELOS = ['dropshipping','importador','produccion_propia','hibrido','todos']
const PEF = [
  {v:'prevencion',    l:'P — Prevención',    c:T.green,  icon:'🛡️',
   desc:'Inversión para evitar errores: capacitación, mantenimiento, diseño de procesos, homologación proveedores'},
  {v:'evaluacion',   l:'E — Evaluación',    c:T.blue,   icon:'🔍',
   desc:'Medir y auditar: control de calidad, inspecciones, auditorías, seguimiento de indicadores'},
  {v:'falla_interna',l:'FI — Falla Interna',c:T.yellow, icon:'⚙️',
   desc:'Errores antes del cliente: reprocesos, pedidos mal tomados, tiempos muertos, errores de despacho'},
  {v:'falla_externa', l:'FE — Falla Externa',c:T.red,   icon:'😤',
   desc:'Detectados por el cliente: devoluciones, reclamos, reenvíos por error, pérdida de reputación'},
  {v:'no_clasificado',l:'Sin clasificar',    c:T.muted,  icon:'❓', desc:''},
]

// Sugerencia IA de PEF basada en palabras clave
function sugerirPEF(concepto: string): string {
  const c = concepto.toLowerCase()
  if (/capacitac|formac|mentoría|entrena|curso|certific|prevencion|mantenim|homolog|diseño proceso|auditor|control calidad|inspección|seguimiento|indicador/.test(c)) {
    if (/auditor|control|inspect|seguimiento|indicador/.test(c)) return 'evaluacion'
    return 'prevencion'
  }
  if (/devoluc|reclam|reenvío|garantía|reemplazo|falla ext|cliente inconforme/.test(c)) return 'falla_externa'
  if (/reproceso|error despacho|tiempo muerto|pedido mal|cancelac|error intern/.test(c)) return 'falla_interna'
  return 'no_clasificado'
}

const inp: React.CSSProperties = {
  width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,
  borderRadius:'7px',padding:'7px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box'
}
const lbl: React.CSSProperties = {fontSize:'11px',color:T.muted,marginBottom:'3px',display:'block'}

// ── TOOLTIP ───────────────────────────────────────────────
function Tip({text,children}:{text:string;children:React.ReactNode}) {
  const [s,setS]=useState(false)
  return (
    <span style={{position:'relative',display:'inline-flex',alignItems:'center',cursor:'help'}}
      onMouseEnter={()=>setS(true)} onMouseLeave={()=>setS(false)}>
      {children}
      {s&&<div style={{position:'absolute',bottom:'calc(100%+6px)',left:'50%',transform:'translateX(-50%)',background:'#060E1C',border:`1px solid ${T.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'11px',color:T.text,width:'240px',zIndex:300,lineHeight:1.6,boxShadow:'0 4px 16px rgba(0,0,0,.5)',whiteSpace:'pre-wrap',pointerEvents:'none'}}>{text}</div>}
    </span>
  )
}

// ── GRÁFICO TORTA SVG ─────────────────────────────────────
function TortaChart({datos}:{datos:{label:string;valor:number;color:string}[]}) {
  const total = datos.reduce((a,d)=>a+d.valor,0)
  if (!total) return <div style={{textAlign:'center',padding:'40px',fontSize:'12px',color:T.muted}}>Sin datos</div>
  let acum = 0
  const cx=80, cy=80, r=65, ri=40
  const segs = datos.filter(d=>d.valor>0).map(d=>{
    const pct = d.valor/total
    const ang = pct*360
    const start = acum; acum+=ang
    const s1 = (start-90)*Math.PI/180, e1=(start+ang-90)*Math.PI/180
    const x1=cx+r*Math.cos(s1), y1=cy+r*Math.sin(s1)
    const x2=cx+r*Math.cos(e1), y2=cy+r*Math.sin(e1)
    const xi1=cx+ri*Math.cos(s1),yi1=cy+ri*Math.sin(s1)
    const xi2=cx+ri*Math.cos(e1),yi2=cy+ri*Math.sin(e1)
    const large = ang>180?1:0
    return {path:`M${xi1},${yi1} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${large},0 ${xi1},${yi1}Z`,...d,pct:Math.round(pct*100)}
  })
  return (
    <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        {segs.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke={T.card} strokeWidth="2"/>)}
        <text x="80" y="75" textAnchor="middle" fill={T.text} fontSize="11" fontWeight="600">CF Total</text>
        <text x="80" y="91" textAnchor="middle" fill={T.accent} fontSize="10">{fmt(total)}</text>
      </svg>
      <div style={{flex:1}}>
        {segs.map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'5px'}}>
            <div style={{width:'10px',height:'10px',borderRadius:'2px',background:s.color,flexShrink:0}}/>
            <div style={{flex:1,fontSize:'11px',color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.label}</div>
            <div style={{fontSize:'11px',color:T.muted,flexShrink:0}}>{s.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MODAL TESTEO PRODUCTOS ────────────────────────────────
function ModalTesteo({tenantId,onClose,onSave}:{tenantId:string;onClose:()=>void;onSave:(items:{concepto:string;valor:number}[],productoId:string,pef_cat:string)=>void}) {
  const supabase=createClient()
  const [productos,setProductos]=useState<Producto[]>([])
  const [prodSel,setProdSel]=useState<Producto|null>(null)
  const [filtro,setFiltro]=useState<'todos'|'testeo'|'activo'>('todos')
  const [items,setItems]=useState([
    {concepto:'Creativos (imágenes/video)',valor:0},
    {concepto:'Landing de testeo',valor:0},
    {concepto:'Pauta para testeo',valor:0},
    {concepto:'Muestra de producto',valor:0},
  ])

  useEffect(()=>{
    supabase.from('productos').select('id,nombre,estado,ciclo_vida')
      .eq('tenant_id',tenantId).eq('tipo','producto')
      .then(({data})=>setProductos((data||[]) as Producto[]))
  },[tenantId])

  const filtrados = productos.filter(p=>filtro==='todos'||(filtro==='testeo'&&p.estado==='testeo')||(filtro==='activo'&&p.estado==='activo'))

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(4px)'}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'14px',width:'min(600px,100%)',maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'700',color:T.text}}>🧪 Costos de Testeo por Producto</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px'}}>✕</button>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'16px 20px'}}>
          {/* Filtros */}
          <div style={{display:'flex',gap:'6px',marginBottom:'12px',flexWrap:'wrap'}}>
            {[{v:'todos',l:'Todos'},{v:'testeo',l:'En testeo'},{v:'activo',l:'Activos'}].map(f=>(
              <button key={f.v} onClick={()=>setFiltro(f.v as any)}
                style={{padding:'5px 12px',borderRadius:'16px',cursor:'pointer',fontSize:'11px',border:`1px solid ${filtro===f.v?T.yellow:T.border}`,background:filtro===f.v?`${T.yellow}15`:'transparent',color:filtro===f.v?T.yellow:T.muted}}>
                {f.l}
              </button>
            ))}
          </div>
          {/* Lista productos */}
          <div style={{marginBottom:'14px'}}>
            <label style={lbl}>Selecciona el producto *</label>
            <div style={{maxHeight:'150px',overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:'8px'}}>
              {filtrados.map(p=>(
                <div key={p.id} onClick={()=>setProdSel(p)}
                  style={{padding:'8px 12px',cursor:'pointer',borderBottom:`1px solid ${T.border}`,background:prodSel?.id===p.id?`${T.yellow}12`:'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:'12px',color:T.text}}>{p.nombre}</span>
                  <span style={{fontSize:'10px',padding:'2px 6px',borderRadius:'4px',background:`${T.yellow}20`,color:T.yellow}}>{p.estado}</span>
                </div>
              ))}
              {filtrados.length===0&&<div style={{padding:'16px',textAlign:'center',fontSize:'12px',color:T.muted}}>No hay productos con este filtro</div>}
            </div>
          </div>
          {/* Items de testeo */}
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
              <label style={{...lbl,margin:0}}>Items del testeo</label>
              <button onClick={()=>setItems(i=>[...i,{concepto:'',valor:0}])}
                style={{fontSize:'11px',color:T.yellow,background:'none',border:`1px solid ${T.yellow}40`,borderRadius:'6px',padding:'3px 10px',cursor:'pointer'}}>+ Agregar ítem</button>
            </div>
            {items.map((it,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 120px 32px',gap:'6px',marginBottom:'6px'}}>
                <input style={inp} placeholder="Nombre del ítem" value={it.concepto} onChange={e=>setItems(a=>a.map((x,j)=>j===i?{...x,concepto:e.target.value}:x))} />
                <input style={inp} type="number" placeholder="Valor" value={it.valor||''} onChange={e=>setItems(a=>a.map((x,j)=>j===i?{...x,valor:parseFloat(e.target.value)||0}:x))} />
                <button onClick={()=>setItems(a=>a.filter((_,j)=>j!==i))} style={{background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'6px',color:T.red,cursor:'pointer',fontSize:'14px'}}>✕</button>
              </div>
            ))}
            <div style={{marginTop:'10px',padding:'8px 12px',background:`${T.yellow}12`,borderRadius:'7px',fontSize:'12px',color:T.yellow}}>
              Total testeo: <strong>{fmt(items.reduce((a,i)=>a+i.valor,0))}</strong>
            </div>
          </div>
        </div>
        <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:'8px',flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:'10px',background:T.card2,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'13px'}}>Cancelar</button>
          <button onClick={()=>{if(!prodSel){alert('Selecciona un producto');return};onSave(items.filter(i=>i.concepto&&i.valor>0),prodSel.id,'prevencion')}}
            style={{flex:2,padding:'10px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'13px'}}>
            💾 Guardar costos de testeo
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────
export default function CostosPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'dashboard'|'cf'|'cv'|'pef'|'historico'>('dashboard')
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [costosFijos, setCostosFijos] = useState<CF[]>([])
  const [costosVar, setCostosVar] = useState<CV[]>([])
  const [nominalNomina, setNominalNomina] = useState(0)
  const [pedidosMes, setPedidosMes] = useState(0)
  const [modeloTienda, setModeloTienda] = useState('dropshipping')
  const [catPersonalizadas, setCatPersonalizadas] = useState<string[]>([])
  const [showTesteo, setShowTesteo] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])
  const [simulPedidos, setSimulPedidos] = useState(300)

  // Formularios
  const [showFormCF, setShowFormCF] = useState(false)
  const [formCF, setFormCF] = useState({concepto:'',categoria:'👥 Personal Operativo',cantidad:1,valor_unitario:0,pef_cat:'no_clasificado',tipo_registro:'historico',notas:''})
  const [editCF, setEditCF] = useState<string|null>(null)
  const [pefSugerido, setPefSugerido] = useState('')

  const [showFormCV, setShowFormCV] = useState(false)
  const [formCV, setFormCV] = useState({concepto:'',tipo:'Pauta Publicitaria',modelo:'dropshipping',valor:0,pct_sobre_pvp:0,pef_cat:'no_clasificado'})
  const [editCV, setEditCV] = useState<string|null>(null)

  const [nuevaCat, setNuevaCat] = useState('')
  const [showNuevaCat, setShowNuevaCat] = useState(false)

  const CATS_CF = [...CATS_CF_BASE, ...catPersonalizadas]
  const coloresCat: Record<string,string> = {
    '👥 Personal Operativo':T.blue,'🏢 Gastos Administrativos':T.muted,
    '⚖️ Honorarios':T.purple,'🔌 Servicios & Arriendo':T.yellow,
    '💻 Plataformas & Apps':T.blue,'🧪 Testeos de Productos':T.green,
    '🎓 Formación & Mentoría':T.accent,'📦 Otros':T.muted,
  }

  async function loadData() {
    setLoading(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const {data:profile} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    setTenantId(profile.tenant_id)

    // Tenant modelo tienda
    const {data:tenant} = await supabase.from('tenants').select('dropi_pais').eq('id',profile.tenant_id).single()

    // CF
    const {data:cf} = await supabase.from('costos_fijos').select('*').eq('tenant_id',profile.tenant_id).eq('activo',true).order('categoria')
    setCostosFijos((cf||[]) as CF[])

    // CV
    const {data:cv} = await supabase.from('costos_variables').select('*').eq('tenant_id',profile.tenant_id).eq('activo',true).order('tipo')
    setCostosVar((cv||[]) as CV[])

    // Nómina
    const {data:colab} = await supabase.from('colaboradores').select('carga_total_mes').eq('tenant_id',profile.tenant_id).eq('activo',true)
    setNominalNomina(colab?.reduce((a:number,c:any)=>a+(c.carga_total_mes||0),0)||0)

    // Pedidos mes
    const ini = new Date(); ini.setDate(1); ini.setHours(0,0,0,0)
    const {count} = await supabase.from('pedidos').select('*',{count:'exact',head:true}).eq('tenant_id',profile.tenant_id).eq('estado','entregado').gte('fecha_pedido',ini.toISOString())
    setPedidosMes(count||0)

    // Histórico snapshots
    const {data:hist} = await supabase.from('costos_fijos_historico').select('*').eq('tenant_id',profile.tenant_id).order('periodo',{ascending:false}).limit(6)
    setHistorico(hist||[])

    setLoading(false)
  }

  useEffect(()=>{ loadData() },[])

  // Totales
  const totalCF = costosFijos.reduce((a,c)=>a+(c.total||c.cantidad*c.valor_unitario),0) + nominalNomina
  const totalCV = costosVar.reduce((a,c)=>a+c.valor,0)
  const cfPorPedido = pedidosMes>0 ? Math.round(totalCF/pedidosMes) : 0
  const cfSimulado  = simulPedidos>0 ? Math.round(totalCF/simulPedidos) : 0
  const costoRealPedido = cfSimulado + (totalCV/Math.max(simulPedidos,1))

  // PEF
  const pefTotals = PEF.reduce((acc,cat)=>{
    acc[cat.v]=(costosFijos.filter(c=>c.pef_cat===cat.v).reduce((a,c)=>a+c.total,0))+(costosVar.filter(c=>c.pef_cat===cat.v).reduce((a,c)=>a+c.valor,0))
    return acc
  },{} as Record<string,number>)
  const totalCalidad=(pefTotals.prevencion||0)+(pefTotals.evaluacion||0)
  const totalNoCalidad=(pefTotals.falla_interna||0)+(pefTotals.falla_externa||0)

  // Datos torta CF por categoría
  const tortaData = CATS_CF.map((cat,i)=>{
    const sub = costosFijos.filter(c=>c.categoria===cat).reduce((a,c)=>a+c.total,0)+(cat==='👥 Personal Operativo'?nominalNomina:0)
    const colores=[T.blue,T.muted,T.purple,T.yellow,T.accent,T.green,T.red,'#60A5FA','#A78BFA']
    return {label:cat.replace(/^[^\s]+\s/,''),valor:sub,color:coloresCat[cat]||colores[i%colores.length]}
  }).filter(d=>d.valor>0)

  // Alerta CF crecimiento vs mes anterior
  const cfMesAnterior = historico[0]?.total_cf||0
  const crecimientoCF = cfMesAnterior>0 ? ((totalCF-cfMesAnterior)/cfMesAnterior*100) : 0

  async function saveCF() {
    if (!formCF.concepto) return
    const total = formCF.cantidad * formCF.valor_unitario
    const periodo = new Date().toISOString().slice(0,7)+'-01'
    const payload = {...formCF, total, tenant_id:tenantId, activo:true, periodo}
    if (editCF) await supabase.from('costos_fijos').update(payload).eq('id',editCF)
    else await supabase.from('costos_fijos').insert(payload)
    setFormCF({concepto:'',categoria:'👥 Personal Operativo',cantidad:1,valor_unitario:0,pef_cat:'no_clasificado',tipo_registro:'historico',notas:''})
    setEditCF(null); setShowFormCF(false); setPefSugerido(''); loadData()
  }

  async function deleteCF(id:string) {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('costos_fijos').update({activo:false}).eq('id',id); loadData()
  }

  async function saveCV() {
    if (!formCV.concepto) return
    const periodo = new Date().toISOString().slice(0,7)+'-01'
    const payload = {...formCV, tenant_id:tenantId, activo:true, periodo}
    if (editCV) await supabase.from('costos_variables').update(payload).eq('id',editCV)
    else await supabase.from('costos_variables').insert(payload)
    setFormCV({concepto:'',tipo:'Pauta Publicitaria',modelo:'dropshipping',valor:0,pct_sobre_pvp:0,pef_cat:'no_clasificado'})
    setEditCV(null); setShowFormCV(false); loadData()
  }

  async function deleteCV(id:string) {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('costos_variables').update({activo:false}).eq('id',id); loadData()
  }

  async function saveTesteo(items:{concepto:string;valor:number}[], productoId:string, pef:string) {
    const periodo = new Date().toISOString().slice(0,7)+'-01'
    for (const it of items) {
      await supabase.from('costos_fijos').insert({
        concepto:`Testeo: ${it.concepto}`, categoria:'🧪 Testeos de Productos',
        cantidad:1, valor_unitario:it.valor, total:it.valor,
        pef_cat:pef, tenant_id:tenantId, activo:true, periodo,
        tipo_registro:'historico', notas:`Producto ID: ${productoId}`
      })
    }
    setShowTesteo(false); loadData()
  }

  async function guardarSnapshot() {
    const periodo = new Date().toISOString().slice(0,7)+'-01'
    await supabase.from('costos_fijos_historico').upsert({
      tenant_id:tenantId, periodo,
      snapshot:{costos_fijos:costosFijos,costos_variables:costosVar},
      total_cf:totalCF, total_cv:totalCV,
      total_pef:totalCalidad+totalNoCalidad, cf_pedido:cfPorPedido
    },{onConflict:'tenant_id,periodo'})
    alert('✅ Snapshot del mes guardado correctamente')
    loadData()
  }

  const TABS = [
    {v:'dashboard',l:'📊 Dashboard',     c:T.accent},
    {v:'cf',       l:'💰 Costos Fijos',  c:T.blue},
    {v:'cv',       l:'📈 Costos Variables',c:T.green},
    {v:'pef',      l:'🔍 Análisis PEF',  c:T.yellow},
    {v:'historico',l:'📋 Histórico',     c:T.purple},
  ]

  return (
    <div style={{color:T.text,fontFamily:'"DM Sans", system-ui, sans-serif'}}>
      {showTesteo && <ModalTesteo tenantId={tenantId} onClose={()=>setShowTesteo(false)} onSave={saveTesteo} />}

      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'10px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'700',color:T.text,marginBottom:'4px'}}>📊 Estructura de Costos</h1>
          <p style={{fontSize:'12px',color:T.muted}}>CF · CV · PEF — Lo que no se mide, no se controla</p>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={guardarSnapshot} style={{padding:'8px 14px',background:`${T.purple}15`,border:`1px solid ${T.purple}40`,borderRadius:'8px',color:T.purple,cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>
            💾 Guardar snapshot mes
          </button>
        </div>
      </div>

      {/* Alerta IA — crecimiento CF */}
      {crecimientoCF > 15 && (
        <div style={{background:`${T.red}12`,border:`1px solid ${T.red}30`,borderRadius:'9px',padding:'10px 16px',marginBottom:'14px',display:'flex',alignItems:'center',gap:'10px',fontSize:'12px',color:T.red}}>
          <span style={{fontSize:'18px'}}>🤖</span>
          <div>
            <strong>IA Alerta:</strong> Los costos fijos subieron un {crecimientoCF.toFixed(1)}% vs el mes anterior (de {fmt(cfMesAnterior)} a {fmt(totalCF)}).
            Revisa qué categoría creció más.
          </div>
        </div>
      )}

      {/* Alerta nómina conectada */}
      {nominalNomina > 0 && (
        <div style={{background:`${T.green}10`,border:`1px solid ${T.green}30`,borderRadius:'9px',padding:'9px 14px',marginBottom:'12px',display:'flex',alignItems:'center',gap:'10px',fontSize:'12px',color:T.green}}>
          <span>👥</span>
          <span>Nómina conectada: <strong>{fmt(nominalNomina)}</strong> incluidos en CF Personal</span>
          <a href="/dashboard/nomina" style={{marginLeft:'auto',color:T.green,fontSize:'11px',textDecoration:'underline'}}>Ver nómina →</a>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:'6px',marginBottom:'16px',flexWrap:'wrap'}}>
        {TABS.map(t=>(
          <button key={t.v} onClick={()=>setTab(t.v as any)}
            style={{padding:'8px 14px',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:tab===t.v?'600':'400',border:`1px solid ${tab===t.v?t.c:T.border}`,background:tab===t.v?`${t.c}15`:'transparent',color:tab===t.v?t.c:T.muted}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══ DASHBOARD ══ */}
      {tab==='dashboard' && (
        <div>
          {/* 4 KPI Cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'10px',marginBottom:'20px'}}>
            {[
              {l:'Total CF mensual',   v:fmt(totalCF),          sub:'Nómina + operación',     c:T.blue,   tip:'Suma de todos los costos fijos del mes incluyendo nómina.\nFórmula: Σ(CF por categoría) + Nómina total'},
              {l:'Total CV mensual',   v:fmt(totalCV),          sub:'Variables por venta',    c:T.green,  tip:'Costos que varían según el volumen de ventas.\nEjemplo: pauta, fletes, fulfillment'},
              {l:'CF por pedido real', v:fmt(cfPorPedido),      sub:`${pedidosMes} entregados`,c:T.accent, tip:`CF por pedido = CF total / Pedidos entregados del mes.\nActual: ${fmt(totalCF)} / ${pedidosMes} = ${fmt(cfPorPedido)}`},
              {l:'Costo total real',   v:fmt(totalCF+totalCV),  sub:'CF + CV del mes',        c:T.text,   tip:'Costo total de operación del mes.\nNO incluye margen ni publicidad por producto.'},
            ].map(k=>(
              <Tip key={k.l} text={k.tip}>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'12px 16px',borderTop:`3px solid ${k.c}`,width:'100%',cursor:'help'}}>
                  <div style={{fontSize:'11px',color:T.muted,marginBottom:'4px'}}>{k.l} ℹ️</div>
                  <div style={{fontSize:'18px',fontWeight:'700',color:k.c,marginBottom:'2px'}}>{k.v}</div>
                  <div style={{fontSize:'10px',color:T.muted}}>{k.sub}</div>
                </div>
              </Tip>
            ))}
          </div>

          {/* Simulador + Torta */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'14px',marginBottom:'16px'}}>
            {/* Simulador sin límite */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px'}}>
              <div style={{fontSize:'12px',fontWeight:'700',color:T.accent,marginBottom:'12px'}}>
                🎯 Simulador CF por pedido
                <Tip text="Simula cuánto costarían los CF si entregas X pedidos al mes.\nMueve el número para ver cómo baja el costo por pedido.">
                  <span style={{fontSize:'11px',marginLeft:'6px',cursor:'help'}}>ℹ️</span>
                </Tip>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={lbl}>Pedidos a simular (sin límite)</label>
                <input style={inp} type="number" value={simulPedidos||''} onChange={e=>setSimulPedidos(parseInt(e.target.value)||0)} min="1" />
                <div style={{display:'flex',gap:'6px',marginTop:'6px',flexWrap:'wrap'}}>
                  {[100,300,500,1000,5000,10000].map(n=>(
                    <button key={n} onClick={()=>setSimulPedidos(n)}
                      style={{padding:'4px 10px',borderRadius:'16px',cursor:'pointer',fontSize:'11px',border:`1px solid ${simulPedidos===n?T.accent:T.border}`,background:simulPedidos===n?`${T.accent}15`:'transparent',color:simulPedidos===n?T.accent:T.muted}}>
                      {n>=1000?`${n/1000}K`:n}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'8px'}}>
                <div style={{background:`${T.blue}12`,borderRadius:'8px',padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:'10px',color:T.muted,marginBottom:'4px'}}>CF por pedido</div>
                  <div style={{fontSize:'20px',fontWeight:'800',color:T.blue}}>{fmt(cfSimulado)}</div>
                </div>
                <div style={{background:`${T.green}12`,borderRadius:'8px',padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:'10px',color:T.muted,marginBottom:'4px'}}>Costo total/pedido</div>
                  <div style={{fontSize:'20px',fontWeight:'800',color:T.green}}>{fmt(costoRealPedido)}</div>
                </div>
              </div>
              <div style={{marginTop:'10px',fontSize:'11px',color:T.muted,padding:'8px',background:'#060E1C',borderRadius:'7px',lineHeight:1.6}}>
                🤖 IA: A {simulPedidos.toLocaleString()} pedidos, tu CF por pedido es <strong style={{color:T.blue}}>{fmt(cfSimulado)}</strong>. 
                {cfSimulado > 5000 ? ' Aún alto — escala para reducirlo.' : ' Eficiente para este volumen.'}
              </div>
            </div>

            {/* Torta distribución */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px'}}>
              <div style={{fontSize:'12px',fontWeight:'700',color:T.text,marginBottom:'12px'}}>🥧 Distribución CF por categoría</div>
              <TortaChart datos={tortaData} />
            </div>
          </div>

          {/* Mini-dashboard 4 vistas */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'10px'}}>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'12px',cursor:'pointer'}} onClick={()=>setTab('cf')}>
              <div style={{fontSize:'10px',fontWeight:'700',color:T.blue,marginBottom:'8px'}}>VISTA 1 — CF TOTALES</div>
              {CATS_CF.slice(0,4).map(cat=>{
                const sub=costosFijos.filter(c=>c.categoria===cat).reduce((a,c)=>a+c.total,0)+(cat==='👥 Personal Operativo'?nominalNomina:0)
                return sub>0?(
                  <div key={cat} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:'3px'}}>
                    <span style={{color:T.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px'}}>{cat.replace(/^[^\s]+\s/,'')}</span>
                    <span style={{color:T.text,fontWeight:'600',flexShrink:0}}>{fmt(sub)}</span>
                  </div>
                ):null
              })}
              <div style={{marginTop:'6px',paddingTop:'6px',borderTop:`1px solid ${T.border}`,fontSize:'12px',fontWeight:'700',color:T.blue,textAlign:'right'}}>{fmt(totalCF)}</div>
            </div>

            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'12px',cursor:'pointer'}} onClick={()=>setTab('cv')}>
              <div style={{fontSize:'10px',fontWeight:'700',color:T.green,marginBottom:'8px'}}>VISTA 2 — CV POR UNIDAD</div>
              {costosVar.slice(0,4).map(c=>(
                <div key={c.id} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:'3px'}}>
                  <span style={{color:T.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px'}}>{c.tipo}</span>
                  <span style={{color:T.text,fontWeight:'600',flexShrink:0}}>{fmt(c.valor)}</span>
                </div>
              ))}
              <div style={{marginTop:'6px',paddingTop:'6px',borderTop:`1px solid ${T.border}`,fontSize:'12px',fontWeight:'700',color:T.green,textAlign:'right'}}>{fmt(totalCV)}</div>
            </div>

            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'12px',cursor:'pointer'}} onClick={()=>setTab('pef')}>
              <div style={{fontSize:'10px',fontWeight:'700',color:T.yellow,marginBottom:'8px'}}>VISTA 3 — PEF SEMÁFORO</div>
              {PEF.filter(p=>p.v!=='no_clasificado').map(p=>(
                <div key={p.v} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:'3px'}}>
                  <span style={{color:p.c}}>{p.icon} {p.l.split('—')[0].trim()}</span>
                  <span style={{color:T.text,fontWeight:'600'}}>{fmt(pefTotals[p.v]||0)}</span>
                </div>
              ))}
              <div style={{marginTop:'6px',paddingTop:'6px',borderTop:`1px solid ${T.border}`,fontSize:'11px',color:totalNoCalidad>totalCalidad?T.red:T.green,fontWeight:'700',textAlign:'center'}}>
                {totalNoCalidad>totalCalidad?'⚠️ Fallas > Calidad':'✅ Calidad > Fallas'}
              </div>
            </div>

            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'12px'}}>
              <div style={{fontSize:'10px',fontWeight:'700',color:T.accent,marginBottom:'8px'}}>VISTA 4 — COSTO REAL/PEDIDO</div>
              {[
                ['CF por pedido',cfPorPedido,T.blue],
                ['CV por pedido',Math.round(totalCV/Math.max(pedidosMes,1)),T.green],
                ['PEF estimado',Math.round((totalCalidad+totalNoCalidad)/Math.max(pedidosMes,1)),T.yellow],
              ].map(([l,v,c])=>(
                <div key={l as string} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:'3px'}}>
                  <span style={{color:T.muted}}>{l}</span>
                  <span style={{color:c as string,fontWeight:'600'}}>{fmt(v as number)}</span>
                </div>
              ))}
              <div style={{marginTop:'6px',paddingTop:'6px',borderTop:`1px solid ${T.border}`,fontSize:'12px',fontWeight:'800',color:T.accent,textAlign:'right'}}>{fmt(cfPorPedido+Math.round(totalCV/Math.max(pedidosMes,1)))}</div>
            </div>
          </div>
        </div>
      )}

      {/* ══ COSTOS FIJOS ══ */}
      {tab==='cf' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {/* Nueva categoría */}
              {showNuevaCat ? (
                <div style={{display:'flex',gap:'6px'}}>
                  <input style={{...inp,width:'180px'}} placeholder="Nombre nueva categoría" value={nuevaCat} onChange={e=>setNuevaCat(e.target.value)} />
                  <button onClick={()=>{if(nuevaCat){setCatPersonalizadas(c=>[...c,'📌 '+nuevaCat]);setNuevaCat('');setShowNuevaCat(false)}}}
                    style={{padding:'6px 12px',background:T.green,border:'none',borderRadius:'6px',color:T.card,cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>✓</button>
                  <button onClick={()=>setShowNuevaCat(false)}
                    style={{padding:'6px 10px',background:'transparent',border:`1px solid ${T.border}`,borderRadius:'6px',color:T.muted,cursor:'pointer',fontSize:'12px'}}>✕</button>
                </div>
              ) : (
                <button onClick={()=>setShowNuevaCat(true)}
                  style={{padding:'7px 12px',background:'transparent',border:`1px solid ${T.border}`,borderRadius:'7px',color:T.muted,cursor:'pointer',fontSize:'12px'}}>
                  + Nueva categoría
                </button>
              )}
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setShowTesteo(true)}
                style={{padding:'8px 14px',background:`${T.yellow}15`,border:`1px solid ${T.yellow}40`,borderRadius:'8px',color:T.yellow,cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>
                🧪 Agregar Testeo
              </button>
              <button onClick={()=>{setShowFormCF(true);setEditCF(null);setFormCF({concepto:'',categoria:'👥 Personal Operativo',cantidad:1,valor_unitario:0,pef_cat:'no_clasificado',tipo_registro:'historico',notas:''})}}
                style={{padding:'8px 16px',background:T.blue,border:'none',borderRadius:'8px',color:'#fff',fontWeight:'600',cursor:'pointer',fontSize:'13px'}}>
                + Agregar CF
              </button>
            </div>
          </div>

          {/* Formulario CF */}
          {showFormCF && (
            <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px',marginBottom:'16px'}}>
              <div style={{fontSize:'12px',fontWeight:'600',color:T.blue,marginBottom:'12px'}}>{editCF?'Editar':'Nuevo'} Costo Fijo</div>
              <div className="dz-grid-2-1" style={{gap:'8px',marginBottom:'8px'}}>
                <div>
                  <label style={lbl}>Concepto * — IA sugerirá la clasificación PEF</label>
                  <input style={inp} value={formCF.concepto}
                    onChange={e=>{
                      const v=e.target.value; setFormCF(f=>({...f,concepto:v}))
                      const sug=sugerirPEF(v); setPefSugerido(sug)
                      if(sug!=='no_clasificado') setFormCF(f=>({...f,concepto:v,pef_cat:sug}))
                    }}
                    placeholder="Ej: Capacitación equipo de ventas" />
                  {pefSugerido && pefSugerido!=='no_clasificado' && (
                    <div style={{fontSize:'10px',color:T.green,marginTop:'3px'}}>
                      🤖 IA sugiere: {PEF.find(p=>p.v===pefSugerido)?.l}
                    </div>
                  )}
                </div>
                <div>
                  <label style={lbl}>Tipo de registro</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCF.tipo_registro} onChange={e=>setFormCF(f=>({...f,tipo_registro:e.target.value as any}))}>
                    <option value="historico">📊 Histórico (real)</option>
                    <option value="predeterminado">📋 Predeterminado (presupuesto)</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'8px',marginBottom:'8px'}}>
                <div>
                  <label style={lbl}>Categoría</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCF.categoria} onChange={e=>setFormCF(f=>({...f,categoria:e.target.value}))}>
                    {CATS_CF.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Cantidad</label><input style={inp} type="number" value={formCF.cantidad||''} onChange={e=>setFormCF(f=>({...f,cantidad:parseFloat(e.target.value)||1}))} /></div>
                <div><label style={lbl}>Valor unitario</label><input style={inp} type="number" value={formCF.valor_unitario||''} onChange={e=>setFormCF(f=>({...f,valor_unitario:parseFloat(e.target.value)||0}))} /></div>
                <div>
                  <label style={lbl}>Clasificación PEF</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCF.pef_cat} onChange={e=>setFormCF(f=>({...f,pef_cat:e.target.value}))}>
                    {PEF.map(p=><option key={p.v} value={p.v}>{p.icon} {p.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="dz-grid-2-1" style={{gap:'8px',marginBottom:'10px'}}>
                <div><label style={lbl}>Notas opcionales</label><input style={inp} value={formCF.notas} onChange={e=>setFormCF(f=>({...f,notas:e.target.value}))} placeholder="Detalle adicional..." /></div>
                <div style={{display:'flex',alignItems:'flex-end',gap:'6px'}}>
                  <div style={{flex:1,background:`${T.blue}15`,borderRadius:'7px',padding:'8px 12px',fontSize:'12px',color:T.blue,textAlign:'center'}}>
                    Total: <strong>{fmt(formCF.cantidad*formCF.valor_unitario)}</strong>
                  </div>
                  <button onClick={saveCF} style={{padding:'8px 16px',background:T.accent,border:'none',borderRadius:'7px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'12px'}}>Guardar</button>
                  <button onClick={()=>{setShowFormCF(false);setPefSugerido('')}} style={{padding:'8px 10px',background:'transparent',border:`1px solid ${T.border}`,borderRadius:'7px',color:T.muted,cursor:'pointer',fontSize:'12px'}}>✕</button>
                </div>
              </div>
            </div>
          )}

          {/* Tabla por categoría */}
          {CATS_CF.map(cat=>{
            const items=costosFijos.filter(c=>c.categoria===cat)
            const subtotal=items.reduce((a,c)=>a+c.total,0)+(cat==='👥 Personal Operativo'?nominalNomina:0)
            const colCat=coloresCat[cat]||T.muted
            return (
              <div key={cat} style={{marginBottom:'10px',border:`1px solid ${T.border}`,borderRadius:'10px',overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 14px',background:'#060E1C',borderBottom:items.length>0||cat==='👥 Personal Operativo'?`1px solid ${T.border}`:'none'}}>
                  <div style={{fontSize:'12px',fontWeight:'600',color:colCat}}>{cat}</div>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    {formCF.tipo_registro==='predeterminado'&&<span style={{fontSize:'10px',color:T.purple,padding:'1px 6px',borderRadius:'4px',background:`${T.purple}15`}}>Presupuesto</span>}
                    <div style={{fontSize:'12px',fontWeight:'700',color:T.text}}>{fmt(subtotal)}</div>
                  </div>
                </div>
                {cat==='👥 Personal Operativo'&&nominalNomina>0&&(
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 14px',background:`${T.green}06`,borderBottom:`1px solid ${T.border}`}}>
                    <div style={{fontSize:'11px',color:T.green}}>👥 Nómina — automático desde módulo Nómina</div>
                    <div style={{fontSize:'12px',fontWeight:'600',color:T.green}}>{fmt(nominalNomina)}</div>
                  </div>
                )}
                {items.map(c=>(
                  <div key={c.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 14px',background:T.card,borderBottom:`1px solid ${T.border}`}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:PEF.find(p=>p.v===c.pef_cat)?.c||T.muted,flexShrink:0}} />
                    <div style={{flex:1,fontSize:'12px',color:T.text}}>{c.concepto}</div>
                    {c.tipo_registro==='predeterminado'&&<span style={{fontSize:'9px',color:T.purple,padding:'1px 5px',borderRadius:'3px',background:`${T.purple}15`}}>presup.</span>}
                    {c.notas&&<span style={{fontSize:'10px',color:T.muted,maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.notas}</span>}
                    <div style={{fontSize:'11px',color:T.muted,width:'110px',textAlign:'right',flexShrink:0}}>{c.cantidad}×{fmt(c.valor_unitario)}</div>
                    <div style={{fontSize:'12px',fontWeight:'600',color:T.text,width:'90px',textAlign:'right',flexShrink:0}}>{fmt(c.total)}</div>
                    <button onClick={()=>{setFormCF({concepto:c.concepto,categoria:c.categoria,cantidad:c.cantidad,valor_unitario:c.valor_unitario,pef_cat:c.pef_cat,tipo_registro:c.tipo_registro||'historico',notas:c.notas||''});setEditCF(c.id);setShowFormCF(true)}}
                      style={{padding:'3px 7px',background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'5px',color:T.blue,cursor:'pointer',fontSize:'10px',flexShrink:0}}>✏️</button>
                    <button onClick={()=>deleteCF(c.id)}
                      style={{padding:'3px 7px',background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'5px',color:T.red,cursor:'pointer',fontSize:'10px',flexShrink:0}}>🗑</button>
                  </div>
                ))}
                {items.length===0&&cat!=='👥 Personal Operativo'&&(
                  <div style={{padding:'8px 14px',background:T.card,fontSize:'11px',color:T.muted}}>Sin registros — <button onClick={()=>{setFormCF(f=>({...f,categoria:cat}));setShowFormCF(true)}} style={{background:'none',border:'none',color:T.accent,cursor:'pointer',fontSize:'11px',textDecoration:'underline'}}>agregar</button></div>
                )}
              </div>
            )
          })}

          <div style={{display:'flex',justifyContent:'flex-end',marginTop:'10px',gap:'10px',alignItems:'center'}}>
            <div style={{fontSize:'12px',color:T.muted}}>Mes actual · {pedidosMes} pedidos entregados</div>
            <div style={{background:`${T.blue}18`,border:`1px solid ${T.blue}30`,borderRadius:'9px',padding:'10px 20px',fontSize:'14px',color:T.blue,fontWeight:'800'}}>
              TOTAL CF: {fmt(totalCF)}
            </div>
          </div>
        </div>
      )}

      {/* ══ COSTOS VARIABLES ══ */}
      {tab==='cv' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
            <div style={{fontSize:'12px',color:T.muted}}>
              Tipo de tienda:
              <select style={{...inp,width:'180px',display:'inline-block',marginLeft:'8px'}} value={modeloTienda} onChange={e=>setModeloTienda(e.target.value)}>
                {MODELOS.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <button onClick={()=>{setShowFormCV(true);setEditCV(null)}}
              style={{padding:'8px 16px',background:T.green,border:'none',borderRadius:'8px',color:T.card,fontWeight:'600',cursor:'pointer',fontSize:'13px'}}>
              + Agregar CV
            </button>
          </div>

          {showFormCV && (
            <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px',marginBottom:'16px'}}>
              <div style={{fontSize:'12px',fontWeight:'600',color:T.green,marginBottom:'12px'}}>{editCV?'Editar':'Nuevo'} Costo Variable</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'8px',marginBottom:'8px'}}>
                <div><label style={lbl}>Concepto *</label><input style={inp} value={formCV.concepto} onChange={e=>setFormCV(f=>({...f,concepto:e.target.value}))} placeholder="Ej: Flete envío ENVIA zona 1" /></div>
                <div><label style={lbl}>Tipo</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCV.tipo} onChange={e=>setFormCV(f=>({...f,tipo:e.target.value}))}>
                    {CATS_CV.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Valor ($)</label><input style={inp} type="number" value={formCV.valor||''} onChange={e=>setFormCV(f=>({...f,valor:parseFloat(e.target.value)||0}))} /></div>
                <div><label style={lbl}>% sobre PVP</label><input style={inp} type="number" value={formCV.pct_sobre_pvp||''} onChange={e=>setFormCV(f=>({...f,pct_sobre_pvp:parseFloat(e.target.value)||0}))} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'8px',marginBottom:'10px'}}>
                <div><label style={lbl}>Modelo negocio</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCV.modelo} onChange={e=>setFormCV(f=>({...f,modelo:e.target.value}))}>
                    {MODELOS.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Clasificación PEF</label>
                  <select style={{...inp,appearance:'none' as any}} value={formCV.pef_cat} onChange={e=>setFormCV(f=>({...f,pef_cat:e.target.value}))}>
                    {PEF.map(p=><option key={p.v} value={p.v}>{p.icon} {p.l}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',alignItems:'flex-end',gap:'6px'}}>
                  <button onClick={saveCV} style={{flex:1,padding:'8px',background:T.accent,border:'none',borderRadius:'7px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'12px'}}>Guardar</button>
                  <button onClick={()=>setShowFormCV(false)} style={{padding:'8px 10px',background:'transparent',border:`1px solid ${T.border}`,borderRadius:'7px',color:T.muted,cursor:'pointer',fontSize:'12px'}}>✕</button>
                </div>
              </div>
            </div>
          )}

          {/* Tabla por tipo */}
          {CATS_CV.map(tipo=>{
            const items=costosVar.filter(c=>c.tipo===tipo&&(modeloTienda==='todos'||c.modelo===modeloTienda||c.modelo==='todos'))
            if(items.length===0) return null
            const sub=items.reduce((a,c)=>a+c.valor,0)
            return (
              <div key={tipo} style={{marginBottom:'10px',border:`1px solid ${T.border}`,borderRadius:'10px',overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 14px',background:'#060E1C',borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontSize:'12px',fontWeight:'600',color:T.green}}>{tipo}</div>
                  <div style={{fontSize:'12px',fontWeight:'700',color:T.text}}>{fmt(sub)}</div>
                </div>
                {items.map((c,i)=>(
                  <div key={c.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 14px',background:i%2===0?T.card:'#080F1C',borderBottom:`1px solid ${T.border}`}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:PEF.find(p=>p.v===c.pef_cat)?.c||T.muted,flexShrink:0}} />
                    <div style={{flex:1,fontSize:'12px',color:T.text}}>{c.concepto}</div>
                    <div style={{fontSize:'10px',color:T.muted,padding:'1px 6px',borderRadius:'4px',background:`${T.blue}15`}}>{c.modelo}</div>
                    {c.pct_sobre_pvp>0&&<div style={{fontSize:'11px',color:T.muted}}>{c.pct_sobre_pvp}% PVP</div>}
                    <div style={{fontSize:'12px',fontWeight:'600',color:T.green,width:'90px',textAlign:'right',flexShrink:0}}>{fmt(c.valor)}</div>
                    <button onClick={()=>{setFormCV({concepto:c.concepto,tipo:c.tipo,modelo:c.modelo,valor:c.valor,pct_sobre_pvp:c.pct_sobre_pvp,pef_cat:c.pef_cat});setEditCV(c.id);setShowFormCV(true)}}
                      style={{padding:'3px 7px',background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'5px',color:T.blue,cursor:'pointer',fontSize:'10px',flexShrink:0}}>✏️</button>
                    <button onClick={()=>deleteCV(c.id)}
                      style={{padding:'3px 7px',background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'5px',color:T.red,cursor:'pointer',fontSize:'10px',flexShrink:0}}>🗑</button>
                  </div>
                ))}
              </div>
            )
          })}

          {costosVar.length===0&&<div style={{textAlign:'center',padding:'40px',fontSize:'12px',color:T.muted}}>No hay costos variables registrados</div>}

          <div style={{display:'flex',justifyContent:'flex-end',marginTop:'10px'}}>
            <div style={{background:`${T.green}18`,border:`1px solid ${T.green}30`,borderRadius:'9px',padding:'10px 20px',fontSize:'14px',color:T.green,fontWeight:'800'}}>
              TOTAL CV: {fmt(totalCV)}
            </div>
          </div>
        </div>
      )}

      {/* ══ PEF ══ */}
      {tab==='pef' && (
        <div>
          {/* Alerta principal */}
          {totalNoCalidad>totalCalidad ? (
            <div style={{background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'9px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:T.red}}>
              <strong>⚠️ ALERTA PEF CRÍTICA:</strong> Gastas más en fallas ({fmt(totalNoCalidad)}) que en prevención ({fmt(totalCalidad)}).
              Cada peso en prevención evita {Math.round(totalNoCalidad/Math.max(totalCalidad,1))}x en fallas. Invierte en P+E ahora.
            </div>
          ) : (
            <div style={{background:`${T.green}15`,border:`1px solid ${T.green}30`,borderRadius:'9px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:T.green}}>
              <strong>✅ PEF SALUDABLE:</strong> Inversión en calidad ({fmt(totalCalidad)}) &gt; Costos de fallas ({fmt(totalNoCalidad)}). ¡Continúa así!
            </div>
          )}

          {/* 4 bloques PEF */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'12px',marginBottom:'16px'}}>
            {PEF.filter(p=>p.v!=='no_clasificado').map(cat=>{
              const total=pefTotals[cat.v]||0
              const totalGeneral=Object.values(pefTotals).reduce((a,v)=>a+v,0)
              const pct=totalGeneral>0?Math.round(total/totalGeneral*100):0
              const items=[...costosFijos,...costosVar.map(c=>({...c,total:c.valor}))].filter(c=>c.pef_cat===cat.v)
              return (
                <div key={cat.v} style={{background:T.card,border:`1px solid ${cat.c}30`,borderRadius:'10px',padding:'14px',borderTop:`3px solid ${cat.c}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <span style={{fontSize:'18px'}}>{cat.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'12px',fontWeight:'700',color:cat.c}}>{cat.l}</div>
                      <div style={{fontSize:'10px',color:T.muted,lineHeight:1.4}}>{cat.desc}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'16px',fontWeight:'800',color:cat.c}}>{fmt(total)}</div>
                      <div style={{fontSize:'10px',color:T.muted}}>{pct}% del total</div>
                    </div>
                  </div>
                  {/* Barra */}
                  <div style={{background:T.border,borderRadius:'4px',height:'6px',marginBottom:'10px'}}>
                    <div style={{background:cat.c,borderRadius:'4px',height:'6px',width:`${pct}%`,transition:'width .3s'}} />
                  </div>
                  {/* Top items */}
                  {items.slice(0,3).map((it,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',padding:'3px 0',borderBottom:`1px solid ${T.border}`}}>
                      <span style={{color:T.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'160px'}}>{it.concepto}</span>
                      <span style={{color:T.text,fontWeight:'500',flexShrink:0}}>{fmt('total' in it?it.total:0)}</span>
                    </div>
                  ))}
                  {items.length>3&&<div style={{fontSize:'10px',color:T.muted,marginTop:'4px'}}>+{items.length-3} más</div>}
                </div>
              )
            })}
          </div>

          {/* Comparativa Calidad vs No Calidad */}
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:'700',color:T.text,marginBottom:'12px'}}>🏆 Calidad vs No Calidad</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'12px'}}>
              <div style={{textAlign:'center',padding:'16px',background:`${T.green}10`,borderRadius:'8px',border:`1px solid ${T.green}30`}}>
                <div style={{fontSize:'11px',color:T.green,marginBottom:'4px'}}>✅ INVERSIÓN EN CALIDAD (P+E)</div>
                <div style={{fontSize:'24px',fontWeight:'800',color:T.green}}>{fmt(totalCalidad)}</div>
                <div style={{fontSize:'11px',color:T.muted,marginTop:'4px'}}>Prevención: {fmt(pefTotals.prevencion||0)}</div>
                <div style={{fontSize:'11px',color:T.muted}}>Evaluación: {fmt(pefTotals.evaluacion||0)}</div>
              </div>
              <div style={{textAlign:'center',padding:'16px',background:`${T.red}10`,borderRadius:'8px',border:`1px solid ${T.red}30`}}>
                <div style={{fontSize:'11px',color:T.red,marginBottom:'4px'}}>❌ COSTO DE NO CALIDAD (FI+FE)</div>
                <div style={{fontSize:'24px',fontWeight:'800',color:T.red}}>{fmt(totalNoCalidad)}</div>
                <div style={{fontSize:'11px',color:T.muted,marginTop:'4px'}}>Fallas internas: {fmt(pefTotals.falla_interna||0)}</div>
                <div style={{fontSize:'11px',color:T.muted}}>Fallas externas: {fmt(pefTotals.falla_externa||0)}</div>
              </div>
            </div>
            <div style={{marginTop:'12px',padding:'10px 14px',background:`${totalNoCalidad>totalCalidad?T.red:T.green}10`,borderRadius:'8px',fontSize:'12px',color:totalNoCalidad>totalCalidad?T.red:T.green,textAlign:'center'}}>
              🤖 IA: {totalNoCalidad>totalCalidad
                ?`Si inviertes ${fmt(totalCalidad*0.5)} más en prevención, podrías reducir las fallas en hasta un 30%`
                :`Tu ratio calidad/no-calidad es saludable. Mantén la inversión en P+E.`}
            </div>
          </div>
        </div>
      )}

      {/* ══ HISTÓRICO ══ */}
      {tab==='historico' && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
            <div style={{fontSize:'12px',color:T.muted}}>Snapshots mensuales guardados · Útiles para tendencias y proyecciones</div>
            <button onClick={guardarSnapshot} style={{padding:'8px 14px',background:`${T.purple}15`,border:`1px solid ${T.purple}40`,borderRadius:'8px',color:T.purple,cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>
              💾 Guardar mes actual
            </button>
          </div>
          {historico.length===0 ? (
            <div style={{textAlign:'center',padding:'48px',background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px'}}>
              <div style={{fontSize:'32px',marginBottom:'12px'}}>📋</div>
              <div style={{fontSize:'14px',fontWeight:'600',color:T.text,marginBottom:'6px'}}>Sin histórico aún</div>
              <div style={{fontSize:'12px',color:T.muted,marginBottom:'16px'}}>Guarda el snapshot del mes actual para empezar a construir el historial</div>
              <button onClick={guardarSnapshot} style={{padding:'9px 20px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'13px'}}>💾 Guardar snapshot ahora</button>
            </div>
          ) : (
            <div>
              {/* Tabla histórico */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',overflow:'hidden',marginBottom:'16px'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#060E1C'}}>
                      {['Período','Total CF','Total CV','CF/Pedido','PEF Total','vs Mes Anterior'].map(h=>(
                        <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',color:T.muted,fontWeight:'600',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h,i)=>{
                      const prev=historico[i+1]
                      const diff=prev?((h.total_cf-prev.total_cf)/prev.total_cf*100):0
                      return (
                        <tr key={h.id||i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':'#080F1C'}}>
                          <td style={{padding:'10px 14px',fontSize:'12px',fontWeight:'600',color:T.text}}>{h.periodo?.slice(0,7)}</td>
                          <td style={{padding:'10px 14px',fontSize:'12px',color:T.blue,fontWeight:'600'}}>{fmt(h.total_cf||0)}</td>
                          <td style={{padding:'10px 14px',fontSize:'12px',color:T.green,fontWeight:'600'}}>{fmt(h.total_cv||0)}</td>
                          <td style={{padding:'10px 14px',fontSize:'12px',color:T.accent,fontWeight:'600'}}>{fmt(h.cf_pedido||0)}</td>
                          <td style={{padding:'10px 14px',fontSize:'12px',color:T.yellow}}>{fmt(h.total_pef||0)}</td>
                          <td style={{padding:'10px 14px'}}>
                            {prev ? (
                              <span style={{fontSize:'11px',fontWeight:'600',color:diff>15?T.red:diff>0?T.yellow:T.green}}>
                                {diff>0?'↑':diff<0?'↓':'='}{Math.abs(diff).toFixed(1)}%
                                {diff>15&&' ⚠️'}
                              </span>
                            ) : <span style={{fontSize:'11px',color:T.muted}}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Proyección IA 3 meses */}
              {historico.length >= 2 && (
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'16px'}}>
                  <div style={{fontSize:'12px',fontWeight:'700',color:T.purple,marginBottom:'12px'}}>🤖 IA — Proyección CF próximos 3 meses</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:'10px'}}>
                    {[1,2,3].map(n=>{
                      const base=historico[0]?.total_cf||totalCF
                      const tendencia=historico.length>=2?(historico[0].total_cf-historico[1].total_cf)/historico[1].total_cf:0
                      const proyectado=Math.round(base*(1+tendencia*n))
                      const fecha=new Date(); fecha.setMonth(fecha.getMonth()+n)
                      return (
                        <div key={n} style={{background:`${T.purple}10`,border:`1px solid ${T.purple}30`,borderRadius:'8px',padding:'12px',textAlign:'center'}}>
                          <div style={{fontSize:'11px',color:T.muted,marginBottom:'4px'}}>{fecha.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</div>
                          <div style={{fontSize:'18px',fontWeight:'700',color:T.purple}}>{fmt(proyectado)}</div>
                          <div style={{fontSize:'10px',color:tendencia>0?T.yellow:T.green,marginTop:'4px'}}>
                            {tendencia>0?`↑ ${(tendencia*100).toFixed(1)}% tendencia`:`↓ ${Math.abs(tendencia*100).toFixed(1)}% tendencia`}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
