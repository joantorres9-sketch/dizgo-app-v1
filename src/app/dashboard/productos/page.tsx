'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238'
}

// ── TIPOS ─────────────────────────────────────────────────
type Producto = {
  id: string; sku?: string; nombre: string; tipo: 'producto'|'combo'
  estado: string; ciclo_vida: string; modelo_negocio: string
  pvp_final: number; costo_proveedor: number; costo_flete: number
  costo_flete_dev: number; costo_fulfillment: number; cf_pedido: number
  pct_devolucion: number; pct_publicidad: number; pct_desc_popup: number
  pct_com_plataforma: number; pct_pasarela: number; pct_com_pasarela: number
  pct_com_ventas: number; pct_com_admin: number; pef_categoria: string
  costos_extra: Record<string,number>; pct_extra: Record<string,number>
  imagen_url?: string; pvp_historial?: any[]; combo_productos_ids?: string[]
  created_at: string
}
type ProductoCombo = {
  id:string; nombre:string; costo_proveedor:number; costo_flete:number
  costo_flete_dev:number; costo_fulfillment:number; cf_pedido:number
}

// ── HELPERS ───────────────────────────────────────────────
function getPais() {
  if (typeof window==='undefined') return 'COL'
  return localStorage.getItem('dizgo_pais')||'COL'
}
function fmt(v:number) {
  const cfgs:Record<string,{locale:string;currency:string;dec:number}> = {
    COL:{locale:'es-CO',currency:'COP',dec:0},ECU:{locale:'en-US',currency:'USD',dec:2},
    MEX:{locale:'es-MX',currency:'MXN',dec:2},PER:{locale:'es-PE',currency:'PEN',dec:2},
    CHL:{locale:'es-CL',currency:'CLP',dec:0},ARG:{locale:'es-AR',currency:'ARS',dec:2},
    CRI:{locale:'es-CR',currency:'CRC',dec:2},PRY:{locale:'es-PY',currency:'PYG',dec:0},
    VEN:{locale:'es-VE',currency:'VES',dec:2},ESP:{locale:'es-ES',currency:'EUR',dec:2},
    GTM:{locale:'es-GT',currency:'GTQ',dec:2},PAN:{locale:'es-PA',currency:'USD',dec:2},
  }
  const c=cfgs[getPais()]||cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).format(v)
}
function calcMargen(p:Partial<Producto>) {
  const pvp=p.pvp_final||0; if(!pvp) return 0
  const f=(p.costo_proveedor||0)+(p.costo_flete||0)+(p.costo_flete_dev||0)+(p.costo_fulfillment||0)+(p.cf_pedido||0)
  const pcts=((p.pct_devolucion||0)+(p.pct_publicidad||0)+(p.pct_desc_popup||0)+(p.pct_com_plataforma||0)+(p.pct_pasarela||0)+(p.pct_com_pasarela||0)+(p.pct_com_ventas||0)+(p.pct_com_admin||0))/100
  return Math.round(((pvp-(f+pvp*pcts))/pvp)*1000)/10
}
function getSem(m:number) {
  if (m>=25) return {color:T.green,label:'✅ VERDE — Escalar',bg:`${T.green}15`}
  if (m>=15) return {color:T.yellow,label:'⚠️ AMARILLO — Revisar',bg:`${T.yellow}15`}
  if (m>0)   return {color:T.red,label:'❌ ROJO — Ajustar',bg:`${T.red}15`}
  return {color:T.muted,label:'⬛ SIN DATOS',bg:`${T.muted}15`}
}

// ── SKU AUTO-GENERADO ──────────────────────────────────────
function generarSKU(nombre:string, tipo:string, index:number):string {
  const pais = getPais()
  const prefijo = tipo==='combo' ? 'CMB' : 'PRD'
  const palabras = nombre.replace(/[^A-Z0-9\s]/g,'').split(' ').filter(Boolean)
  const codigo = palabras.slice(0,3).map(p=>p.slice(0,3)).join('')||'XXX'
  const num = String(index).padStart(4,'0')
  return `${pais}-${prefijo}-${codigo}-${num}`
}

// ── IA: SUGERENCIA DE MARGEN Y BENCHMARKS ─────────────────
type IAAnalisis = {
  margen_sugerido: number
  benchmark_pais: string
  alerta: string
  recomendacion: string
  saturacion: 'baja'|'media'|'alta'
}
function analizarProductoIA(nombre:string, costo:number, pvp:number, pais:string): IAAnalisis {
  const m = pvp>0 ? calcMargen({pvp_final:pvp,costo_proveedor:costo,pct_devolucion:20,pct_publicidad:20,pct_desc_popup:5,pct_com_plataforma:3,pct_pasarela:0,pct_com_pasarela:0,pct_com_ventas:2,pct_com_admin:1,costo_flete:0,costo_flete_dev:0,costo_fulfillment:0,cf_pedido:0}) : 0
  const n = nombre.toLowerCase()
  
  const categorias: Record<string,{margen:number;sat:'baja'|'media'|'alta';bench:string}> = {
    'reloj|watch|clock':    {margen:28,sat:'alta', bench:'28-35% en COL/ECU'},
    'collar|joya|pulsera':  {margen:32,sat:'media',bench:'30-40% en LATAM'},
    'cuidado|crema|serum':  {margen:35,sat:'media',bench:'32-42% en COL'},
    'mascotas|perro|gato':  {margen:30,sat:'baja', bench:'28-38% en COL/MEX'},
    'cocina|hogar|casa':    {margen:25,sat:'media',bench:'22-30% en LATAM'},
    'tecnologia|usb|cable': {margen:22,sat:'alta', bench:'18-28% en COL'},
    'ropa|camisa|zapato':   {margen:30,sat:'alta', bench:'25-35% en COL'},
    'deporte|gym|fitness':  {margen:28,sat:'media',bench:'25-33% en COL/MEX'},
  }
  
  let cat = Object.entries(categorias).find(([k])=>new RegExp(k).test(n))
  const info = cat?.[1] || {margen:25,sat:'media' as const,bench:'20-30% promedio LATAM'}
  
  const alertas = []
  if (m<15) alertas.push('Margen muy bajo — alto riesgo de pérdida')
  if (m>=25) alertas.push('Margen óptimo — listo para escalar')
  if (info.sat==='alta') alertas.push(`Mercado saturado en ${pais} — diferencia tu propuesta de valor`)
  if (pvp>0 && costo>pvp*0.5) alertas.push('Costo del proveedor supera el 50% del PVP')

  return {
    margen_sugerido: info.margen,
    benchmark_pais: info.bench,
    alerta: alertas.join(' · ') || 'Producto sin alertas detectadas',
    recomendacion: m < info.margen ? `Sube el PVP a ${fmt(Math.round(costo/(1-info.margen/100)))} para margen óptimo` : 'PVP competitivo según benchmarks',
    saturacion: info.sat,
  }
}

// ── CARGA MASIVA — PREVIEW ────────────────────────────────
type FilaPreview = {
  nombre:string; pvp_final:number; costo_proveedor:number; costo_flete:number
  pct_publicidad:number; pct_devolucion:number; margen:number; estado:string
  valido:boolean; error?:string
}
function ModalPreviewMasiva({filas,onConfirm,onClose}:{filas:FilaPreview[];onConfirm:()=>void;onClose:()=>void}) {
  const validas = filas.filter(f=>f.valido).length
  const invalidas = filas.filter(f=>!f.valido).length
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(4px)'}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'14px',width:'780px',maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{fontSize:'14px',fontWeight:'700',color:T.text}}>👁️ Vista previa — Carga masiva</div>
            <div style={{fontSize:'11px',color:T.muted,marginTop:'2px'}}>{filas.length} filas detectadas · <span style={{color:T.green}}>{validas} válidas</span> · <span style={{color:T.red}}>{invalidas} con error</span></div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px'}}>✕</button>
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#060E1C',position:'sticky',top:0}}>
                {['#','Nombre','PVP','Costo Prov.','% Pub.','% Dev.','Margen','Estado','✓'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:'11px',color:T.muted,borderBottom:`1px solid ${T.border}`,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f,i)=>{
                const sem=getSem(f.margen)
                return (
                  <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:!f.valido?`${T.red}08`:i%2===0?'transparent':'#080F1C'}}>
                    <td style={{padding:'7px 12px',fontSize:'11px',color:T.muted}}>{i+1}</td>
                    <td style={{padding:'7px 12px',fontSize:'12px',color:f.valido?T.text:T.red,maxWidth:'160px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.nombre||<em>Sin nombre</em>}</td>
                    <td style={{padding:'7px 12px',fontSize:'12px',color:T.text}}>{fmt(f.pvp_final)}</td>
                    <td style={{padding:'7px 12px',fontSize:'12px',color:T.text}}>{fmt(f.costo_proveedor)}</td>
                    <td style={{padding:'7px 12px',fontSize:'12px',color:T.text}}>{f.pct_publicidad}%</td>
                    <td style={{padding:'7px 12px',fontSize:'12px',color:T.text}}>{f.pct_devolucion}%</td>
                    <td style={{padding:'7px 12px',fontSize:'12px',fontWeight:'700',color:sem.color}}>{f.margen>0?f.margen.toFixed(1)+'%':'--'}</td>
                    <td style={{padding:'7px 12px'}}>
                      <span style={{fontSize:'10px',padding:'1px 6px',borderRadius:'4px',background:`${T.muted}20`,color:T.muted}}>{f.estado}</span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'center'}}>
                      {f.valido
                        ? <span style={{color:T.green,fontSize:'14px'}}>✓</span>
                        : <span style={{color:T.red,fontSize:'10px'}} title={f.error}>✗</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:'8px',alignItems:'center',flexShrink:0}}>
          <div style={{flex:1,fontSize:'12px',color:T.muted}}>Se importarán solo las {validas} filas válidas</div>
          <button onClick={onClose} style={{padding:'10px 16px',background:T.card2,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'13px'}}>Cancelar</button>
          <button onClick={onConfirm} disabled={validas===0}
            style={{padding:'10px 20px',background:validas>0?T.accent:'#333',border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:validas>0?'pointer':'not-allowed',fontSize:'13px'}}>
            ✅ Importar {validas} productos
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PANEL IA CHAT ─────────────────────────────────────────
function PanelIAChat({onClose}:{onClose:()=>void}) {
  const [input,setInput]=useState('')
  const [msgs,setMsgs]=useState<{role:'user'|'ia';text:string}[]>([
    {role:'ia',text:`¡Hola! Soy el asistente de catálogo DIZGO 🤖. Puedo ayudarte con:\n• Tendencias de productos por país\n• Benchmarks de margen por categoría\n• Alertas de saturación de mercado\n• Recomendaciones de precio\n\n¿Qué quieres saber?`}
  ])
  const [loading,setLoading]=useState(false)
  const ref=useRef<HTMLDivElement>(null)

  async function enviar() {
    if(!input.trim()) return
    const pregunta=input; setInput('')
    setMsgs(m=>[...m,{role:'user',text:pregunta}])
    setLoading(true)
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:500,
          messages:[{role:'user',content:`Eres un experto en e-commerce y dropshipping para LATAM (Colombia, Ecuador, México, Perú, Chile, Argentina). 
El usuario pregunta: "${pregunta}"
Contexto: módulo de catálogo de productos DIZGO.APP - plataforma financiera para dropshippers.
Responde en español, de forma concisa (máximo 150 palabras), con datos específicos de LATAM cuando sea posible.
Incluye benchmarks de margen, niveles de saturación, oportunidades o riesgos según corresponda.`}]
        })
      })
      const data=await resp.json()
      const texto=data.content?.[0]?.text||'No pude analizar eso. Intenta de nuevo.'
      setMsgs(m=>[...m,{role:'ia',text:texto}])
    } catch {
      setMsgs(m=>[...m,{role:'ia',text:'Error de conexión. Intenta de nuevo.'}])
    }
    setLoading(false)
    setTimeout(()=>ref.current?.scrollTo(0,ref.current.scrollHeight),100)
  }

  const SUGERENCIAS=['¿Qué productos tendencia en Ecuador?','Benchmarks de margen en Colombia 2025','¿Saturación de relojes en LATAM?','Mejores categorías para importar','¿Cuándo retirar un producto del catálogo?']

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(4px)'}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'14px',width:'520px',height:'580px',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'14px 18px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div style={{width:'32px',height:'32px',background:`${T.purple}20`,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px'}}>🤖</div>
            <div>
              <div style={{fontSize:'13px',fontWeight:'700',color:T.text}}>IA Catálogo DIZGO</div>
              <div style={{fontSize:'10px',color:T.green}}>● En línea</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px'}}>✕</button>
        </div>

        {/* Mensajes */}
        <div ref={ref} style={{flex:1,overflowY:'auto',padding:'14px',display:'flex',flexDirection:'column',gap:'10px'}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{maxWidth:'85%',padding:'10px 12px',borderRadius:m.role==='user'?'12px 12px 2px 12px':'12px 12px 12px 2px',background:m.role==='user'?`${T.accent}20`:T.card2,border:`1px solid ${m.role==='user'?T.accent:T.border}`,fontSize:'12px',color:T.text,lineHeight:1.6,whiteSpace:'pre-wrap'}}>
                {m.text}
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              <div style={{padding:'10px 14px',borderRadius:'12px',background:T.card2,border:`1px solid ${T.border}`,fontSize:'12px',color:T.muted}}>
                🤖 Analizando...
              </div>
            </div>
          )}
        </div>

        {/* Sugerencias */}
        {msgs.length<=1&&(
          <div style={{padding:'0 14px 10px',display:'flex',flexWrap:'wrap',gap:'5px'}}>
            {SUGERENCIAS.map(s=>(
              <button key={s} onClick={()=>{setInput(s)}}
                style={{padding:'4px 10px',borderRadius:'12px',cursor:'pointer',fontSize:'10px',border:`1px solid ${T.purple}40`,background:`${T.purple}10`,color:T.purple}}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{padding:'12px 14px',borderTop:`1px solid ${T.border}`,display:'flex',gap:'8px',flexShrink:0}}>
          <input
            style={{...{width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'7px',padding:'8px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box' as any},flex:1}}
            placeholder="Pregunta sobre tendencias, benchmarks, saturación..."
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&enviar()}
          />
          <button onClick={enviar} disabled={loading||!input.trim()}
            style={{padding:'8px 14px',background:T.accent,border:'none',borderRadius:'7px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'12px',flexShrink:0}}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TOOLTIP ───────────────────────────────────────────────
function Tooltip({text,children}:{text:string;children:React.ReactNode}) {
  const [s,setS]=useState(false)
  return (
    <span style={{position:'relative',display:'inline-flex',alignItems:'center'}}
      onMouseEnter={()=>setS(true)} onMouseLeave={()=>setS(false)}>
      {children}
      {s&&<div style={{position:'absolute',bottom:'calc(100%+6px)',left:'50%',transform:'translateX(-50%)',background:'#060E1C',border:`1px solid ${T.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'11px',color:T.text,width:'220px',zIndex:100,lineHeight:1.5,boxShadow:'0 4px 16px rgba(0,0,0,.4)',whiteSpace:'pre-wrap',pointerEvents:'none'}}>{text}</div>}
    </span>
  )
}

// ── BUSCADOR COMBO ────────────────────────────────────────
function BuscadorProductos({tenantId,seleccionados,onAgregar}:{tenantId:string;seleccionados:ProductoCombo[];onAgregar:(p:ProductoCombo)=>void}) {
  const supabase=createClient()
  const [buscar,setBuscar]=useState('')
  const [resultados,setResultados]=useState<any[]>([])
  const [buscando,setBuscando]=useState(false)

  async function buscarP(q:string) {
    if(!q.trim()){setResultados([]);return}
    setBuscando(true)
    const {data}=await supabase.from('productos').select('id,nombre,costo_proveedor,costo_flete,costo_flete_dev,costo_fulfillment,cf_pedido').eq('tenant_id',tenantId).eq('tipo','producto').ilike('nombre',`%${q}%`).limit(8)
    setResultados(data||[])
    setBuscando(false)
  }
  const ids=seleccionados.map(p=>p.id)
  return (
    <div style={{marginBottom:'14px'}}>
      <div style={{fontSize:'11px',fontWeight:'700',color:T.purple,marginBottom:'8px'}}>🔍 BUSCAR PRODUCTOS PARA EL COMBO</div>
      <div style={{position:'relative'}}>
        <input style={{width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'7px',padding:'8px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box' as any}} placeholder="Escribe el nombre..." value={buscar} onChange={e=>{setBuscar(e.target.value);buscarP(e.target.value)}} />
        {buscando&&<div style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',fontSize:'11px',color:T.muted}}>buscando...</div>}
      </div>
      {resultados.length>0&&(
        <div style={{background:'#060E1C',border:`1px solid ${T.border}`,borderRadius:'8px',marginTop:'6px',overflow:'hidden'}}>
          {resultados.map(p=>{
            const ya=ids.includes(p.id)
            return (
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',borderBottom:`1px solid ${T.border}`,background:ya?`${T.green}08`:'transparent'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',color:T.text,fontWeight:'500'}}>{p.nombre}</div>
                  <div style={{fontSize:'10px',color:T.muted}}>Costo: {fmt(p.costo_proveedor||0)} · Flete: {fmt(p.costo_flete||0)}</div>
                </div>
                <button onClick={()=>{if(!ya){onAgregar({id:p.id,nombre:p.nombre,costo_proveedor:p.costo_proveedor||0,costo_flete:p.costo_flete||0,costo_flete_dev:p.costo_flete_dev||0,costo_fulfillment:p.costo_fulfillment||0,cf_pedido:p.cf_pedido||0});setBuscar('');setResultados([])}}} disabled={ya}
                  style={{padding:'5px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'600',cursor:ya?'default':'pointer',background:ya?`${T.green}20`:`${T.purple}20`,border:`1px solid ${ya?T.green:T.purple}40`,color:ya?T.green:T.purple}}>
                  {ya?'✓ Agregado':'+ Agregar'}
                </button>
              </div>
            )
          })}
        </div>
      )}
      {buscar&&resultados.length===0&&!buscando&&<div style={{padding:'10px',fontSize:'12px',color:T.muted,textAlign:'center',background:'#060E1C',borderRadius:'8px',marginTop:'6px'}}>No encontrado</div>}
    </div>
  )
}

function ListaCombo({productos,onChange,onRemove}:{productos:ProductoCombo[];onChange:(id:string,campo:keyof ProductoCombo,valor:number)=>void;onRemove:(id:string)=>void}) {
  if(!productos.length) return <div style={{background:`${T.purple}10`,border:`1px dashed ${T.purple}40`,borderRadius:'8px',padding:'16px',textAlign:'center',fontSize:'12px',color:T.muted,marginBottom:'12px'}}>🎁 Busca y agrega productos para el combo</div>
  return (
    <div style={{marginBottom:'14px'}}>
      <div style={{fontSize:'11px',fontWeight:'700',color:T.purple,marginBottom:'8px'}}>🎁 PRODUCTOS DEL COMBO ({productos.length})</div>
      {productos.map(p=>(
        <div key={p.id} style={{background:'#060E1C',border:`1px solid ${T.border}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'6px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:T.text}}>{p.nombre}</div>
            <button onClick={()=>onRemove(p.id)} style={{background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'5px',color:T.red,cursor:'pointer',fontSize:'11px',padding:'2px 8px'}}>Quitar</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'6px'}}>
            {[['Costo prov.','costo_proveedor',p.costo_proveedor],['Flete envío','costo_flete',p.costo_flete],['Flete dev.','costo_flete_dev',p.costo_flete_dev],['Fulfillment','costo_fulfillment',p.costo_fulfillment],['CF pedido','cf_pedido',p.cf_pedido]].map(([l,campo,val])=>(
              <div key={campo as string}>
                <div style={{fontSize:'10px',color:T.muted,marginBottom:'3px'}}>{l}</div>
                <input style={{width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'6px',padding:'5px 6px',fontSize:'11px',color:T.text,outline:'none',boxSizing:'border-box' as any}} type="number" value={val as number||''} onChange={e=>onChange(p.id,campo as keyof ProductoCombo,parseFloat(e.target.value)||0)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── MODAL FORMULARIO ──────────────────────────────────────
function ModalProducto({onClose,onSave,tenantId,editData,totalProductos}:{
  onClose:()=>void;onSave:()=>void;tenantId:string;editData?:Producto|null;totalProductos:number
}) {
  const supabase=createClient()
  const [tipo,setTipo]=useState<'producto'|'combo'>(editData?.tipo||'producto')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [costosExtra,setCostosExtra]=useState<{nombre:string;valor:number}[]>([])
  const [pctsExtra,setPctsExtra]=useState<{nombre:string;valor:number}[]>([])
  const [productosCombo,setProductosCombo]=useState<ProductoCombo[]>([])
  const [iaAnalisis,setIaAnalisis]=useState<IAAnalisis|null>(null)

  const [form,setForm]=useState({
    nombre:editData?.nombre||'',estado:editData?.estado||'borrador',
    ciclo_vida:editData?.ciclo_vida||'borrador',modelo_negocio:editData?.modelo_negocio||'dropshipping',
    pvp_final:editData?.pvp_final||0,costo_proveedor:editData?.costo_proveedor||0,
    costo_flete:editData?.costo_flete||0,costo_flete_dev:editData?.costo_flete_dev||0,
    costo_fulfillment:editData?.costo_fulfillment||0,cf_pedido:editData?.cf_pedido||0,
    pct_devolucion:editData?.pct_devolucion||20,pct_publicidad:editData?.pct_publicidad||20,
    pct_desc_popup:editData?.pct_desc_popup||5,pct_com_plataforma:editData?.pct_com_plataforma||3,
    pct_pasarela:editData?.pct_pasarela||0,pct_com_pasarela:editData?.pct_com_pasarela||0,
    pct_com_ventas:editData?.pct_com_ventas||2,pct_com_admin:editData?.pct_com_admin||1,
    pef_categoria:editData?.pef_categoria||'no_clasificado',imagen_url:editData?.imagen_url||'',
  })

  useEffect(()=>{
    if(tipo==='combo'&&productosCombo.length>0) {
      setForm(f=>({...f,
        costo_proveedor:productosCombo.reduce((a,p)=>a+p.costo_proveedor,0),
        costo_flete:productosCombo.reduce((a,p)=>a+p.costo_flete,0),
        costo_flete_dev:productosCombo.reduce((a,p)=>a+p.costo_flete_dev,0),
        costo_fulfillment:productosCombo.reduce((a,p)=>a+p.costo_fulfillment,0),
        cf_pedido:productosCombo.reduce((a,p)=>a+p.cf_pedido,0),
      }))
    }
  },[productosCombo,tipo])

  // IA analiza cuando cambia nombre o costo principal
  useEffect(()=>{
    if(form.nombre.length>4) {
      const ia=analizarProductoIA(form.nombre,form.costo_proveedor,form.pvp_final,getPais())
      setIaAnalisis(ia)
    }
  },[form.nombre,form.costo_proveedor,form.pvp_final])

  const set=(k:string)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>{
    const isNum=e.target.type==='number'
    const isText=['estado','ciclo_vida','modelo_negocio','pef_categoria','imagen_url'].includes(k)
    setForm(f=>({...f,[k]:isNum?parseFloat(e.target.value)||0:isText?e.target.value:e.target.value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}))
  }

  const margen=calcMargen(form)
  const sem=getSem(margen)
  const inp2:React.CSSProperties={width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box'}
  const lbl2:React.CSSProperties={fontSize:'11px',color:T.muted,marginBottom:'4px',display:'block'}

  async function handleSave() {
    if(!form.nombre){setError('El nombre es obligatorio');return}
    if(tipo==='combo'&&productosCombo.length<2){setError('Un combo necesita al menos 2 productos');return}
    setLoading(true);setError('')
    try {
      const costos_extra:Record<string,number>={}; costosExtra.forEach(c=>{if(c.nombre)costos_extra[c.nombre]=c.valor})
      const pct_extra:Record<string,number>={}; pctsExtra.forEach(p=>{if(p.nombre)pct_extra[p.nombre]=p.valor})
      const combo_productos_ids=tipo==='combo'?productosCombo.map(p=>p.id):[]
      // SKU auto-generado
      const sku=editData?.sku||generarSKU(form.nombre,tipo,totalProductos+1)
      // Snapshot del precio
      const pvp_historial=[...(editData?.pvp_historial||[]),{
        fecha:new Date().toISOString(),pvp:form.pvp_final,
        margen,motivo:editData?'actualizacion':'creacion'
      }]
      const payload={...form,tipo,tenant_id:tenantId,costos_extra,pct_extra,combo_productos_ids,sku,pvp_historial}
      if(editData?.id){
        const{error:err}=await supabase.from('productos').update(payload).eq('id',editData.id)
        if(err)throw err
      } else {
        const{error:err}=await supabase.from('productos').insert(payload)
        if(err)throw err
      }
      onSave()
    } catch(e:any){setError(e.message)}
    finally{setLoading(false)}
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(4px)'}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'14px',width:'680px',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'700',color:T.text}}>{editData?'Editar producto':'Agregar nuevo'}</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px'}}>✕</button>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'18px 20px'}}>

          {/* Tipo */}
          <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
            {(['producto','combo'] as const).map(t=>(
              <button key={t} onClick={()=>setTipo(t)}
                style={{flex:1,padding:'10px',borderRadius:'9px',cursor:'pointer',fontWeight:'600',fontSize:'13px',border:`2px solid ${tipo===t?T.accent:T.border}`,background:tipo===t?`${T.accent}15`:T.card2,color:tipo===t?T.accent:T.muted}}>
                {t==='producto'?'📦 Producto':'🎁 Combo / Kit'}
              </button>
            ))}
          </div>

          {/* Semáforo */}
          <div style={{background:sem.bg,border:`1px solid ${sem.color}30`,borderRadius:'9px',padding:'10px 14px',marginBottom:'12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:sem.color}}>{sem.label}</div>
            <div style={{fontSize:'13px',fontWeight:'700',color:sem.color}}>Margen: {margen>0?margen.toFixed(1)+'%':'--'}</div>
          </div>

          {/* IA Análisis — aparece al escribir nombre */}
          {iaAnalisis&&form.nombre.length>4&&(
            <div style={{background:`${T.purple}10`,border:`1px solid ${T.purple}30`,borderRadius:'9px',padding:'10px 14px',marginBottom:'12px',fontSize:'11px'}}>
              <div style={{fontWeight:'700',color:T.purple,marginBottom:'6px'}}>🤖 IA Análisis de mercado</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                <div><span style={{color:T.muted}}>Margen sugerido: </span><strong style={{color:T.green}}>{iaAnalisis.margen_sugerido}%</strong></div>
                <div><span style={{color:T.muted}}>Benchmark {getPais()}: </span><strong style={{color:T.text}}>{iaAnalisis.benchmark_pais}</strong></div>
                <div style={{gridColumn:'1/-1'}}><span style={{color:T.muted}}>Saturación: </span>
                  <strong style={{color:iaAnalisis.saturacion==='alta'?T.red:iaAnalisis.saturacion==='media'?T.yellow:T.green}}>
                    {iaAnalisis.saturacion==='alta'?'🔴 Alta':iaAnalisis.saturacion==='media'?'🟡 Media':'🟢 Baja'}
                  </strong>
                </div>
                <div style={{gridColumn:'1/-1',color:T.yellow}}>{iaAnalisis.alerta}</div>
                {iaAnalisis.recomendacion&&<div style={{gridColumn:'1/-1',color:T.green}}>💡 {iaAnalisis.recomendacion}</div>}
              </div>
            </div>
          )}

          {/* Buscador Combo */}
          {tipo==='combo'&&(
            <>
              <BuscadorProductos tenantId={tenantId} seleccionados={productosCombo} onAgregar={p=>setProductosCombo(prev=>[...prev,p])} />
              <ListaCombo productos={productosCombo} onChange={(id,campo,val)=>setProductosCombo(prev=>prev.map(p=>p.id===id?{...p,[campo]:val}:p))} onRemove={id=>setProductosCombo(prev=>prev.filter(p=>p.id!==id))} />
              <div style={{height:'1px',background:T.border,margin:'12px 0'}} />
            </>
          )}

          {/* Identificación */}
          <div style={{fontSize:'11px',fontWeight:'700',color:T.accent,marginBottom:'8px'}}>🔖 IDENTIFICACIÓN</div>
          <div style={{marginBottom:'10px'}}>
            <label style={{fontSize:'11px',color:T.muted,marginBottom:'4px',display:'block'}}>Nombre * (mayúsculas automático)</label>
            <input style={inp2} value={form.nombre} onChange={set('nombre')} placeholder={tipo==='combo'?'EJ: COMBO CUIDADO CAPILAR':'EJ: RELOJ LED MODA'} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl2}>Estado *</label>
              <select style={{...inp2,appearance:'none' as any}} value={form.estado} onChange={set('estado')}>
                {['borrador','testeo','activo','temporada','inactivo'].map(v=><option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
              </select>
            </div>
            <div><label style={lbl2}>Ciclo de vida</label>
              <select style={{...inp2,appearance:'none' as any}} value={form.ciclo_vida} onChange={set('ciclo_vida')}>
                {['borrador','testeo','activo','temporada','inactivo'].map(v=><option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl2}>Modelo negocio</label>
              <select style={{...inp2,appearance:'none' as any}} value={form.modelo_negocio} onChange={set('modelo_negocio')}>
                {['dropshipping','importador','produccion_propia','hibrido'].map(v=><option key={v} value={v}>{v.replace('_',' ')}</option>)}
              </select>
            </div>
            <div><label style={lbl2}>Clasificación PEF</label>
              <select style={{...inp2,appearance:'none' as any}} value={form.pef_categoria} onChange={set('pef_categoria')}>
                <option value="no_clasificado">Sin clasificar</option>
                <option value="prevencion">P — Prevención</option>
                <option value="evaluacion">E — Evaluación</option>
                <option value="falla_interna">FI — Falla interna</option>
                <option value="falla_externa">FE — Falla externa</option>
              </select>
            </div>
          </div>
          <div style={{marginBottom:'10px'}}>
            <label style={lbl2}>URL imagen del producto</label>
            <input style={inp2} value={form.imagen_url} onChange={e=>setForm(f=>({...f,imagen_url:e.target.value}))} placeholder="https://..." />
          </div>

          {/* Costos */}
          <div style={{fontSize:'11px',fontWeight:'700',color:T.blue,marginBottom:'8px',marginTop:'14px'}}>💰 COSTOS EN DINERO</div>
          <div style={{marginBottom:'10px'}}>
            <label style={lbl2}><Tooltip text="Fórmula correcta:\nPVS = Costos / (1 - %pub - %com - %margen)\nNO uses PVS = Costos × (1 + %)">PVP Final * ℹ️</Tooltip></label>
            <input style={inp2} type="number" value={form.pvp_final||''} onChange={set('pvp_final')} placeholder="0" />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl2}>Costo proveedor *</label><input style={inp2} type="number" value={form.costo_proveedor||''} onChange={set('costo_proveedor')} placeholder="0" /></div>
            <div><label style={lbl2}><Tooltip text="Flete de envío al cliente.\nVariable por zona del país.">Flete envío * ℹ️</Tooltip></label><input style={inp2} type="number" value={form.costo_flete||''} onChange={set('costo_flete')} placeholder="0" /></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl2}><Tooltip text="Costo cuando el pedido vuelve.\nCosto oculto crítico en dropshipping.">Flete devolución ℹ️</Tooltip></label><input style={inp2} type="number" value={form.costo_flete_dev||''} onChange={set('costo_flete_dev')} placeholder="0" /></div>
            <div><label style={lbl2}>Fulfillment</label><input style={inp2} type="number" value={form.costo_fulfillment||''} onChange={set('costo_fulfillment')} placeholder="0" /></div>
          </div>
          <div style={{marginBottom:'10px'}}>
            <label style={lbl2}><Tooltip text="CF mensual ÷ pedidos entregados del mes.\nSe toma automáticamente del módulo Costos.">CF por pedido ℹ️</Tooltip></label>
            <input style={inp2} type="number" value={form.cf_pedido||''} onChange={set('cf_pedido')} placeholder="0" />
          </div>

          {/* Costos extra */}
          <div style={{marginBottom:'12px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
              <label style={{fontSize:'11px',color:T.muted}}>Costos adicionales</label>
              <button onClick={()=>setCostosExtra(c=>[...c,{nombre:'',valor:0}])} style={{fontSize:'11px',color:T.accent,background:'none',border:`1px solid ${T.accent}40`,borderRadius:'6px',padding:'3px 10px',cursor:'pointer'}}>+ Agregar</button>
            </div>
            {costosExtra.map((c,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 120px 32px',gap:'6px',marginBottom:'6px'}}>
                <input style={inp2} placeholder="Nombre" value={c.nombre} onChange={e=>setCostosExtra(a=>a.map((x,j)=>j===i?{...x,nombre:e.target.value}:x))} />
                <input style={inp2} type="number" placeholder="Valor" value={c.valor||''} onChange={e=>setCostosExtra(a=>a.map((x,j)=>j===i?{...x,valor:parseFloat(e.target.value)||0}:x))} />
                <button onClick={()=>setCostosExtra(a=>a.filter((_,j)=>j!==i))} style={{background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'6px',color:T.red,cursor:'pointer',fontSize:'14px'}}>✕</button>
              </div>
            ))}
          </div>

          {/* % */}
          <div style={{fontSize:'11px',fontWeight:'700',color:T.green,marginBottom:'8px',marginTop:'14px'}}>📊 PORCENTAJES (% sobre PVP)</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl2}><Tooltip text="% pedidos que no se entregan.\nIncluye doble costo de flete.">% Devolución ℹ️</Tooltip></label><input style={inp2} type="number" value={form.pct_devolucion||''} onChange={set('pct_devolucion')} placeholder="20" /></div>
            <div><label style={lbl2}><Tooltip text="% del PVP para Meta/TikTok Ads.\nMáximo recomendado: 20%.">% Publicidad ℹ️</Tooltip></label><input style={inp2} type="number" value={form.pct_publicidad||''} onChange={set('pct_publicidad')} placeholder="20" /></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl2}>% Desc. popup</label><input style={inp2} type="number" value={form.pct_desc_popup||''} onChange={set('pct_desc_popup')} placeholder="5" /></div>
            <div><label style={lbl2}>% Com. plataforma</label><input style={inp2} type="number" value={form.pct_com_plataforma||''} onChange={set('pct_com_plataforma')} placeholder="3" /></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl2}>% Pasarela</label><input style={inp2} type="number" value={form.pct_pasarela||''} onChange={set('pct_pasarela')} placeholder="0" /></div>
            <div><label style={lbl2}>% Com. ventas</label><input style={inp2} type="number" value={form.pct_com_ventas||''} onChange={set('pct_com_ventas')} placeholder="2" /></div>
          </div>
          <div style={{marginBottom:'10px'}}>
            <label style={lbl2}>% Com. admin</label><input style={inp2} type="number" value={form.pct_com_admin||''} onChange={set('pct_com_admin')} placeholder="1" />
          </div>

          {/* % extra */}
          <div style={{marginBottom:'12px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
              <label style={{fontSize:'11px',color:T.muted}}>% adicionales</label>
              <button onClick={()=>setPctsExtra(p=>[...p,{nombre:'',valor:0}])} style={{fontSize:'11px',color:T.purple,background:'none',border:`1px solid ${T.purple}40`,borderRadius:'6px',padding:'3px 10px',cursor:'pointer'}}>+ Agregar %</button>
            </div>
            {pctsExtra.map((p,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 120px 32px',gap:'6px',marginBottom:'6px'}}>
                <input style={inp2} placeholder="Nombre" value={p.nombre} onChange={e=>setPctsExtra(a=>a.map((x,j)=>j===i?{...x,nombre:e.target.value}:x))} />
                <input style={inp2} type="number" placeholder="%" value={p.valor||''} onChange={e=>setPctsExtra(a=>a.map((x,j)=>j===i?{...x,valor:parseFloat(e.target.value)||0}:x))} />
                <button onClick={()=>setPctsExtra(a=>a.filter((_,j)=>j!==i))} style={{background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'6px',color:T.red,cursor:'pointer',fontSize:'14px'}}>✕</button>
              </div>
            ))}
          </div>

          {/* Mini P&G */}
          <div style={{background:`${T.blue}10`,border:`1px solid ${T.blue}20`,borderRadius:'9px',padding:'12px',marginTop:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:T.blue,marginBottom:'8px'}}>📊 ESTADO DE RESULTADOS MINI</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
              {[
                ['PVP Final',fmt(form.pvp_final),T.text],
                ['Costos directos',fmt((form.costo_proveedor)+(form.costo_flete)+(form.costo_flete_dev)+(form.costo_fulfillment)+(form.cf_pedido)),T.red],
                ['Costos variables (%)',fmt(form.pvp_final*((form.pct_devolucion+form.pct_publicidad+form.pct_desc_popup+form.pct_com_plataforma+form.pct_pasarela+form.pct_com_pasarela+form.pct_com_ventas+form.pct_com_admin)/100)),T.yellow],
                ['Margen neto',`${margen.toFixed(1)}%`,margen>=25?T.green:margen>=15?T.yellow:T.red],
              ].map(([l,v,c])=>(
                <div key={l as string} style={{display:'flex',justifyContent:'space-between',fontSize:'12px'}}>
                  <span style={{color:T.muted}}>{l}</span>
                  <span style={{color:c as string,fontWeight:'600'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {error&&<div style={{background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'8px',padding:'9px',fontSize:'12px',color:T.red,marginTop:'12px'}}>{error}</div>}
        </div>

        <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:'8px',flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:'10px',background:T.card2,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'13px'}}>Cancelar</button>
          <button onClick={handleSave} disabled={loading} style={{flex:2,padding:'10px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:loading?'wait':'pointer',fontSize:'13px',opacity:loading?0.7:1}}>
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
  const router_href = `/dashboard/precio?sku=${producto.sku||producto.id}`
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(4px)'}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'14px',width:'520px',maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:'700',color:T.text}}>{producto.nombre}</div>
            <div style={{display:'flex',gap:'8px',marginTop:'4px',alignItems:'center'}}>
              <div style={{fontSize:'11px',color:T.muted}}>{producto.tipo==='combo'?'🎁 Combo':'📦 Producto'} · {producto.modelo_negocio}</div>
              {producto.sku&&<div style={{fontSize:'10px',color:T.accent,padding:'1px 6px',borderRadius:'4px',background:`${T.accent}15`,fontFamily:'monospace'}}>{producto.sku}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px'}}>✕</button>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'18px 20px'}}>
          <div style={{background:sem.bg,border:`1px solid ${sem.color}30`,borderRadius:'9px',padding:'12px 16px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:'13px',fontWeight:'600',color:sem.color}}>{sem.label}</div>
            <div style={{fontSize:'20px',fontWeight:'800',color:sem.color}}>{margen.toFixed(1)}%</div>
          </div>
          {/* Costos */}
          <div style={{background:T.card2,borderRadius:'9px',padding:'12px',marginBottom:'12px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:T.blue,marginBottom:'8px'}}>💰 ESTRUCTURA DE COSTOS</div>
            {[['PVP Final',fmt(producto.pvp_final)],['Costo proveedor',fmt(producto.costo_proveedor)],['Flete envío',fmt(producto.costo_flete)],['Flete devolución',fmt(producto.costo_flete_dev)],['Fulfillment',fmt(producto.costo_fulfillment)],['CF por pedido',fmt(producto.cf_pedido)]].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'4px 0',borderBottom:`1px solid ${T.border}`}}>
                <span style={{color:T.muted}}>{k}</span><span style={{color:T.text,fontWeight:'500'}}>{v}</span>
              </div>
            ))}
          </div>
          {/* Historial precios */}
          {producto.pvp_historial&&producto.pvp_historial.length>0&&(
            <div style={{background:T.card2,borderRadius:'9px',padding:'12px',marginBottom:'12px'}}>
              <div style={{fontSize:'11px',fontWeight:'700',color:T.yellow,marginBottom:'8px'}}>📋 HISTORIAL DE PRECIOS</div>
              {[...producto.pvp_historial].reverse().slice(0,4).map((h,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',padding:'4px 0',borderBottom:`1px solid ${T.border}`}}>
                  <span style={{color:T.muted}}>{new Date(h.fecha).toLocaleDateString('es-CO')}</span>
                  <span style={{color:T.text}}>{fmt(h.pvp)}</span>
                  <span style={{color:h.margen>=25?T.green:h.margen>=15?T.yellow:T.red}}>{h.margen?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
          {/* Porcentajes */}
          <div style={{background:T.card2,borderRadius:'9px',padding:'12px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:T.green,marginBottom:'8px'}}>📊 PORCENTAJES</div>
            {[['% Devolución',producto.pct_devolucion+'%'],['% Publicidad',producto.pct_publicidad+'%'],['% Desc. popup',producto.pct_desc_popup+'%'],['% Com. plataforma',producto.pct_com_plataforma+'%'],['% Pasarela',producto.pct_pasarela+'%'],['% Com. ventas',producto.pct_com_ventas+'%'],['% Com. admin',producto.pct_com_admin+'%']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'4px 0',borderBottom:`1px solid ${T.border}`}}>
                <span style={{color:T.muted}}>{k}</span><span style={{color:T.text}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:'8px',flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:'10px',background:T.card2,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'13px'}}>Cerrar</button>
          <a href={router_href} style={{flex:2,display:'block',textAlign:'center',padding:'10px',background:`${T.blue}20`,border:`1px solid ${T.blue}40`,borderRadius:'8px',color:T.blue,fontWeight:'600',cursor:'pointer',fontSize:'13px',textDecoration:'none'}}>
            ✏️ Modificar → Precio & Costeo
          </a>
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────
export default function ProductosPage() {
  const supabase=createClient()
  const [productos,setProductos]=useState<Producto[]>([])
  const [loading,setLoading]=useState(true)
  const [tenantId,setTenantId]=useState('')
  const [showModal,setShowModal]=useState(false)
  const [showResumen,setShowResumen]=useState<Producto|null>(null)
  const [editData,setEditData]=useState<Producto|null>(null)
  const [filtro,setFiltro]=useState('todos')
  const [buscar,setBuscar]=useState('')
  const [showIA,setShowIA]=useState(false)
  const [previewFilas,setPreviewFilas]=useState<FilaPreview[]|null>(null)
  const fileRef=useRef<HTMLInputElement>(null)

  async function loadData() {
    setLoading(true)
    const{data:{user}}=await supabase.auth.getUser()
    if(!user){setLoading(false);return}
    const{data:profile}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
    if(!profile?.tenant_id){setLoading(false);return}
    setTenantId(profile.tenant_id)
    const{data}=await supabase.from('productos').select('*').eq('tenant_id',profile.tenant_id).order('created_at',{ascending:false})
    setProductos((data||[]) as Producto[])
    setLoading(false)
  }

  useEffect(()=>{loadData()},[])

  async function handleDelete(id:string) {
    if(!confirm('¿Eliminar este producto?'))return
    await supabase.from('productos').delete().eq('id',id)
    loadData()
  }

  // Carga masiva — leer XLSX
  async function handleFileMasiva(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file) return
    const XLSX=await import('xlsx')
    const data=await file.arrayBuffer()
    const wb=XLSX.read(data)
    const ws=wb.Sheets['Productos']||wb.Sheets[wb.SheetNames[0]]
    const rows=XLSX.utils.sheet_to_json(ws,{header:1}) as any[][]
    const headers=rows[0] as string[]
    const filas:FilaPreview[]=rows.slice(1).filter(r=>r.some(Boolean)).map(r=>{
      const get=(col:string)=>{const i=headers.findIndex(h=>h?.toLowerCase().includes(col.toLowerCase()));return i>=0?r[i]:undefined}
      const nombre=String(get('nombre')||'').toUpperCase().trim()
      const pvp=parseFloat(get('pvp')||get('precio')||0)||0
      const costo=parseFloat(get('costo')||get('proveedor')||0)||0
      const pct_pub=parseFloat(get('public')||20)||20
      const pct_dev=parseFloat(get('devol')||20)||20
      const margen=pvp>0?calcMargen({pvp_final:pvp,costo_proveedor:costo,pct_devolucion:pct_dev,pct_publicidad:pct_pub,pct_desc_popup:5,pct_com_plataforma:3,pct_pasarela:0,pct_com_pasarela:0,pct_com_ventas:2,pct_com_admin:1,costo_flete:0,costo_flete_dev:0,costo_fulfillment:0,cf_pedido:0}):0
      const valido=!!nombre&&pvp>0
      return {nombre,pvp_final:pvp,costo_proveedor:costo,pct_publicidad:pct_pub,pct_devolucion:pct_dev,margen,estado:'borrador',valido,error:!nombre?'Sin nombre':!pvp?'Sin PVP':undefined}
    })
    setPreviewFilas(filas)
    if(fileRef.current)fileRef.current.value=''
  }

  async function confirmarMasiva() {
    if(!previewFilas)return
    const validas=previewFilas.filter(f=>f.valido)
    for(const[i,f] of validas.entries()) {
      const sku=generarSKU(f.nombre,'producto',productos.length+i+1)
      await supabase.from('productos').insert({
        nombre:f.nombre,tipo:'producto',estado:f.estado,
        pvp_final:f.pvp_final,costo_proveedor:f.costo_proveedor,
        pct_publicidad:f.pct_publicidad,pct_devolucion:f.pct_devolucion,
        pct_desc_popup:5,pct_com_plataforma:3,pct_pasarela:0,pct_com_pasarela:0,
        pct_com_ventas:2,pct_com_admin:1,sku,tenant_id:tenantId,
        ciclo_vida:'borrador',modelo_negocio:'dropshipping',
        pvp_historial:[{fecha:new Date().toISOString(),pvp:f.pvp_final,margen:f.margen,motivo:'carga_masiva'}]
      })
    }
    setPreviewFilas(null); loadData()
  }

  const filtrados=productos.filter(p=>{
    const mf=filtro==='todos'||p.estado===filtro||p.tipo===filtro
    const mb=!buscar||p.nombre.toLowerCase().includes(buscar.toLowerCase())
    return mf&&mb
  })

  const activos=productos.filter(p=>p.estado==='activo').length
  const testeo=productos.filter(p=>p.estado==='testeo').length
  const combos=productos.filter(p=>p.tipo==='combo').length
  const margenProm=productos.length>0?Math.round(productos.reduce((a,p)=>a+calcMargen(p),0)/productos.length*10)/10:0
  const semProm=getSem(margenProm)

  const ESTADOS=[{v:'todos',l:'Todos',c:T.muted},{v:'activo',l:'Activos',c:T.green},{v:'testeo',l:'Testeo',c:T.yellow},{v:'borrador',l:'Borrador',c:T.muted},{v:'inactivo',l:'Inactivos',c:T.red},{v:'combo',l:'Combos',c:T.purple}]

  return (
    <div style={{color:T.text,fontFamily:'"DM Sans", system-ui, sans-serif'}}>
      {showModal&&<ModalProducto onClose={()=>{setShowModal(false);setEditData(null)}} onSave={()=>{setShowModal(false);setEditData(null);loadData()}} tenantId={tenantId} editData={editData} totalProductos={productos.length} />}
      {showResumen&&<ModalResumen producto={showResumen} onClose={()=>setShowResumen(null)} onEdit={()=>{setEditData(showResumen);setShowResumen(null);setShowModal(true)}} />}
      {showIA&&<PanelIAChat onClose={()=>setShowIA(false)} />}
      {previewFilas&&<ModalPreviewMasiva filas={previewFilas} onConfirm={confirmarMasiva} onClose={()=>setPreviewFilas(null)} />}

      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'700',color:T.text,marginBottom:'4px'}}>🛍️ Catálogo de Productos</h1>
          <p style={{fontSize:'12px',color:T.muted}}>Sin productos no hay magia — el corazón de tu tienda</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'flex-end'}}>
          <button onClick={()=>setShowIA(true)}
            style={{padding:'8px 14px',background:`${T.purple}15`,border:`1px solid ${T.purple}40`,borderRadius:'8px',color:T.purple,cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>
            🤖 IA Catálogo
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{display:'none'}} onChange={handleFileMasiva} />
          <button onClick={()=>fileRef.current?.click()} style={{padding:'8px 14px',background:T.card,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'12px'}}>
            📤 Carga masiva
          </button>
          <a href="/api/plantilla-productos" download
            style={{padding:'8px 14px',background:T.card,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'12px',textDecoration:'none'}}>
            📥 Plantilla
          </a>
          <button onClick={()=>{setEditData(null);setShowModal(true)}}
            style={{padding:'8px 18px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'13px'}}>
            + Agregar producto
          </button>
        </div>
      </div>

      {/* KPIs con semáforo global en parte SUPERIOR */}
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:'10px',marginBottom:'20px'}}>
        <div style={{background:semProm.bg,border:`1px solid ${semProm.color}30`,borderRadius:'10px',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:'11px',color:semProm.color,fontWeight:'600',marginBottom:'2px'}}>🚦 SEMÁFORO GLOBAL — Margen promedio</div>
            <div style={{fontSize:'11px',color:T.muted}}>🟢 ≥25% Escalar · 🟡 15-24% Revisar · 🔴 &lt;15% Ajustar</div>
          </div>
          <div style={{fontSize:'26px',fontWeight:'800',color:semProm.color}}>{margenProm>0?margenProm+'%':'--'}</div>
        </div>
        {[{n:productos.length,l:'Total',c:T.text},{n:activos,l:'Activos',c:T.green},{n:testeo,l:'Testeo',c:T.yellow},{n:combos,l:'Combos',c:T.purple}].map(k=>(
          <div key={k.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'12px 16px',textAlign:'center'}}>
            <div style={{fontSize:'22px',fontWeight:'700',color:k.c}}>{k.n}</div>
            <div style={{fontSize:'11px',color:T.muted,marginTop:'2px'}}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:'6px',marginBottom:'14px',flexWrap:'wrap',alignItems:'center'}}>
        {ESTADOS.map(e=>(
          <button key={e.v} onClick={()=>setFiltro(e.v)}
            style={{padding:'5px 12px',borderRadius:'16px',cursor:'pointer',fontSize:'12px',border:`1px solid ${filtro===e.v?e.c:T.border}`,background:filtro===e.v?`${e.c}15`:'transparent',color:filtro===e.v?e.c:T.muted,fontWeight:filtro===e.v?'600':'400'}}>
            {e.l}
          </button>
        ))}
        <input style={{...{width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'7px',padding:'7px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box' as any},width:'200px',marginLeft:'auto'}} placeholder="🔍 Buscar producto..." value={buscar} onChange={e=>setBuscar(e.target.value)} />
      </div>

      {/* Tabla */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'12px',overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#060E1C'}}>
                {[
                  ['#','ID autogenerado del producto'],
                  ['SKU','Código único del producto (auto-generado al guardar)'],
                  ['Tipo','Producto individual o combo/kit'],
                  ['Nombre','Nombre en MAYÚSCULAS sin tildes'],
                  ['Estado','Ciclo de vida del producto'],
                  ['PVP','Precio de venta al público final'],
                  ['Costo total','Suma de todos los costos directos'],
                  ['Margen','(PVP - Costos totales) / PVP — fórmula correcta'],
                  ['Semáforo','≥25% Verde · 15-24% Amarillo · <15% Rojo'],
                  ['Acciones',''],
                ].map(([h,tip])=>(
                  <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:'11px',color:T.muted,fontWeight:'600',whiteSpace:'nowrap',borderBottom:`1px solid ${T.border}`}}>
                    <Tooltip text={tip}><span style={{cursor:'help'}}>{h} {tip?'ℹ️':''}</span></Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading?(
                <tr><td colSpan={10} style={{textAlign:'center',padding:'40px',color:T.muted,fontSize:'13px'}}>Cargando...</td></tr>
              ):filtrados.length===0?(
                <tr>
                  <td colSpan={10} style={{textAlign:'center',padding:'48px'}}>
                    <div style={{fontSize:'36px',marginBottom:'12px'}}>🛍️</div>
                    <div style={{fontSize:'14px',fontWeight:'600',color:T.text,marginBottom:'6px'}}>No hay productos aún</div>
                    <div style={{fontSize:'12px',color:T.muted,marginBottom:'16px'}}>Agrega tu primer producto o usa la carga masiva</div>
                    <button onClick={()=>setShowModal(true)} style={{padding:'9px 20px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'13px'}}>+ Agregar primer producto</button>
                  </td>
                </tr>
              ):filtrados.map((p,idx)=>{
                const m=calcMargen(p); const s=getSem(m)
                const ct=p.costo_proveedor+p.costo_flete+p.costo_flete_dev+p.costo_fulfillment+p.cf_pedido
                const ec:Record<string,string>={activo:T.green,testeo:T.yellow,borrador:T.muted,inactivo:T.red,temporada:T.purple}
                return (
                  <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,background:idx%2===0?'transparent':'#080F1C',cursor:'pointer'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='#0F1E32')}
                    onMouseLeave={e=>(e.currentTarget.style.background=idx%2===0?'transparent':'#080F1C')}>
                    <td style={{padding:'10px 12px',fontSize:'11px',color:T.muted,fontWeight:'600'}}>#{String(idx+1).padStart(4,'0')}</td>
                    <td style={{padding:'10px 12px',fontSize:'10px',color:T.accent,fontFamily:'monospace',whiteSpace:'nowrap'}}>{p.sku||'—'}</td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 8px',borderRadius:'4px',background:p.tipo==='combo'?`${T.purple}20`:`${T.blue}20`,color:p.tipo==='combo'?T.purple:T.blue}}>
                        {p.tipo==='combo'?'🎁 Combo':'📦 Prod.'}
                      </span>
                    </td>
                    <td style={{padding:'10px 12px',fontSize:'13px',color:T.text,fontWeight:'500',maxWidth:'180px'}}>
                      <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nombre}</div>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 8px',borderRadius:'4px',background:`${ec[p.estado]||T.muted}20`,color:ec[p.estado]||T.muted}}>{p.estado}</span>
                    </td>
                    <td style={{padding:'10px 12px',fontSize:'12px',color:T.text,fontWeight:'600'}}>{fmt(p.pvp_final)}</td>
                    <td style={{padding:'10px 12px',fontSize:'12px',color:T.red}}>{fmt(ct)}</td>
                    <td style={{padding:'10px 12px',fontSize:'13px',fontWeight:'700',color:s.color}}>{m>0?m.toFixed(1)+'%':'--'}</td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 8px',borderRadius:'4px',background:s.bg,color:s.color}}>
                        {m>=25?'✅ Escalar':m>=15?'⚠️ Revisar':m>0?'❌ Ajustar':'⬛ Sin datos'}
                      </span>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',gap:'6px'}}>
                        <button onClick={()=>setShowResumen(p)} style={{padding:'5px 10px',background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'6px',color:T.blue,cursor:'pointer',fontSize:'11px',fontWeight:'600',whiteSpace:'nowrap'}}>Ver resumen</button>
                        <button onClick={()=>handleDelete(p.id)} style={{padding:'5px 8px',background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'6px',color:T.red,cursor:'pointer',fontSize:'11px'}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtrados.length>0&&(
        <div style={{textAlign:'center',marginTop:'12px',fontSize:'12px',color:T.muted}}>
          Mostrando {filtrados.length} de {productos.length} productos
        </div>
      )}
    </div>
  )
}
