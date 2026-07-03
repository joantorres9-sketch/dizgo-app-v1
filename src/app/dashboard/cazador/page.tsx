'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type ContextoNegocio = {
  cpa_promedio: number; tasa_entrega: number; tasa_devolucion: number
  margen_promedio: number; cf_mensual: number; saldo_wallet: number
  productos_activos: number; ventas_mes: number
}

const ROLES = [
  { num:1, icon:'📊', titulo:'Analista Financiero Estratégico', color:'#3D8EF0' },
  { num:2, icon:'🎯', titulo:'Evaluador de Proyectos', color:'#2DD4A0' },
  { num:3, icon:'🧾', titulo:'Contador Experto E-commerce', color:'#F5A623' },
  { num:4, icon:'⚙️', titulo:'Ingeniero de Procesos y Calidad', color:'#9B6BFF' },
  { num:5, icon:'🧑‍🤝‍🧑', titulo:'Antropólogo del Consumo', color:'#F05C5C' },
  { num:6, icon:'🧠', titulo:'Psicólogo del Consumidor', color:'#3D8EF0' },
  { num:7, icon:'📣', titulo:'Experto en Marketing y Publicidad', color:'#2DD4A0' },
  { num:8, icon:'📡', titulo:'Trafficker Digital', color:'#F5A623' },
  { num:9, icon:'🎨', titulo:'Diseñador Gráfico Estratégico', color:'#9B6BFF' },
  { num:10, icon:'🎬', titulo:'Experto en Video Marketing', color:'#F05C5C' },
  { num:11, icon:'🚢', titulo:'Experto en Logística e Importación', color:'#3D8EF0' },
  { num:12, icon:'⚖️', titulo:'Abogado en Comercio Electrónico', color:'#2DD4A0' },
  { num:13, icon:'🏛️', titulo:'Administrador Estratégico', color:'#F5A623' },
]

const s: React.CSSProperties = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }
function fmt(n:number){ return `$${Math.round(n).toLocaleString('es-CO')}` }

export default function CazadorProductosPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [analizando, setAnalizando] = useState(false)
  const [contexto, setContexto] = useState<ContextoNegocio|null>(null)
  const [informe, setInforme] = useState('')
  const [recomendacion, setRecomendacion] = useState<'INVERTIR'|'AJUSTAR'|'NO INVERTIR'|null>(null)

  // Formulario del producto
  const [producto, setProducto] = useState({
    nombre: '', descripcion: '', costo_proveedor: 0,
    precio_venta: 0, mercado: 'Colombia', plataforma: 'Meta Ads',
    categoria: '', temporada: 'todo el año', competencia: 'media',
  })

  const loadContexto = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

    const hoy = new Date()
    const iniMes = new Date(hoy.getFullYear(), hoy.getMonth()-2, 1).toISOString().slice(0,10)
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`

    const [{ data: peds }, { data: pauta }, { data: costos }, { data: wallet }, { data: prods }] = await Promise.all([
      supabase.from('pedidos').select('estado, ganancia, pvp').eq('tenant_id', tid).gte('fecha_pedido', iniMes),
      supabase.from('pauta').select('inversion, resultados').eq('tenant_id', tid).gte('fecha', iniMes),
      supabase.from('costos_fijos').select('total').eq('tenant_id', tid).eq('periodo', periodo).eq('activo', true),
      supabase.from('wallet_transacciones').select('tipo, monto').eq('tenant_id', tid),
      supabase.from('productos').select('id').eq('tenant_id', tid).eq('tipo','producto').eq('estado','activo'),
    ])

    const pedRows = (peds||[]) as {estado:string;ganancia:number;pvp:number}[]
    const total = pedRows.length
    const entregados = pedRows.filter(p=>['ENTREGADO','entregado'].includes(p.estado))
    const devueltos = pedRows.filter(p=>['DEVOLUCION','devolucion'].includes(p.estado)).length
    const ventas = entregados.reduce((a,p)=>a+Number(p.pvp||0),0)
    const ganancia = entregados.reduce((a,p)=>a+Number(p.ganancia||0),0)

    const inv_pauta = (pauta||[]).reduce((a:number,r:{inversion:number})=>a+Number(r?.inversion||0),0)
    const resultados = (pauta||[]).reduce((a:number,r:{resultados:number})=>a+Number(r?.resultados||0),0)
    const cf = (costos||[]).reduce((a:number,c:{total:number})=>a+Number(c?.total||0),0)

    const wRows = (wallet||[]) as {tipo:string;monto:number}[]
    const saldo = wRows.filter(w=>w.tipo==='ENTRADA').reduce((a,w)=>a+Number(w.monto),0)
              - wRows.filter(w=>w.tipo==='SALIDA').reduce((a,w)=>a+Number(w.monto),0)

    setContexto({
      cpa_promedio: resultados>0 ? Math.round(inv_pauta/resultados) : 18000,
      tasa_entrega: total>0 ? Math.round(entregados.length/total*100) : 72,
      tasa_devolucion: (entregados.length+devueltos)>0 ? Math.round(devueltos/(entregados.length+devueltos)*100) : 10,
      margen_promedio: ventas>0 ? Math.round(ganancia/ventas*100) : 0,
      cf_mensual: cf,
      saldo_wallet: saldo,
      productos_activos: (prods||[]).length,
      ventas_mes: ventas,
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadContexto() }, [loadContexto])

  async function ejecutarAnalisis() {
    if (!producto.nombre || !producto.costo_proveedor || !producto.precio_venta) return
    setAnalizando(true)
    setInforme('')
    setRecomendacion(null)

    const margenBruto = Math.round((producto.precio_venta - producto.costo_proveedor) / producto.precio_venta * 100)
    const gananciaPorPedido = Math.round(producto.precio_venta * (margenBruto/100) * 0.6)
    const pedidosMes = contexto ? Math.round(contexto.ventas_mes / producto.precio_venta) : 80
    const proyeccionMes = gananciaPorPedido * pedidosMes

    const prompt = `Actúa como un SISTEMA DE INTELIGENCIA MULTIDISCIPLINARIO para la evaluación, análisis y toma de decisiones en modelos de negocio de DROPSHIPPING.

Tu objetivo es analizar oportunidades de productos, estrategias de venta y escenarios financieros a partir de los datos suministrados (base de datos, métricas, costos, comportamiento del mercado), generando conclusiones claras sobre:
- Viabilidad del producto o estrategia
- Rentabilidad real
- Riesgos asociados
- Escalabilidad
- Recomendación final: INVERTIR / AJUSTAR / NO INVERTIR

Debes responder integrando simultáneamente los siguientes ROLES EXPERTOS:

🔷 1. ROL: ANALISTA FINANCIERO ESTRATÉGICO
Evalúa: Ingresos proyectados, Costos directos e indirectos, Margen bruto y neto, Flujo de caja, Capital de trabajo requerido, Punto de equilibrio.
Determina: Si el modelo genera valor o lo destruye.

🔷 2. ROL: EVALUADOR DE PROYECTOS
Aplica criterios de inversión: ROI, Payback, Riesgo vs retorno, Escenarios (optimista, medio, pesimista).
Entrega: Recomendación clara: INVERTIR / AJUSTAR / DESCARTAR

🔷 3. ROL: CONTADOR EXPERTO EN E-COMMERCE
Analiza: Estructura de costos reales, Costos ocultos (devoluciones, logística, reprocesos), Implicaciones tributarias, Margen real después de impuestos.

🔷 4. ROL: INGENIERO DE PROCESOS Y CALIDAD
Evalúa: Flujo operativo del dropshipping, Cuellos de botella, Tiempos de entrega, Riesgos operativos, Nivel de automatización.
Aplica: Mejora continua (PHVA), Optimización de procesos, Gestión de riesgos.

🔷 5. ROL: ANTROPÓLOGO DEL CONSUMO
Analiza: Comportamiento histórico del consumidor, Factores culturales, Necesidades profundas, Contexto social del producto.

🔷 6. ROL: PSICÓLOGO DEL CONSUMIDOR
Identifica: Gatillos de compra, Emociones asociadas al producto, Objeciones del cliente, Percepción de valor.

🔷 7. ROL: EXPERTO EN MARKETING Y PUBLICIDAD
Define: Ángulos de venta, Propuesta de valor, Mensajes clave, Estrategia de conversión.

🔷 8. ROL: TRAFFICKER DIGITAL
Evalúa: Viabilidad publicitaria, Costo por adquisición (CPA), CTR esperado, Escalabilidad en Meta / TikTok Ads.

🔷 9. ROL: DISEÑADOR GRÁFICO ESTRATÉGICO
Propone: Conceptos visuales de alto impacto, Creativos orientados a conversión, Diseño alineado con psicología del consumidor.

🔷 10. ROL: EXPERTO EN VIDEO MARKETING
Define: Tipo de video ideal (UGC, demostración, storytelling), Hooks de atención, Estructura de video que convierta.

🔷 11. ROL: EXPERTO EN LOGÍSTICA E IMPORTACIÓN
Analiza: Tiempos de entrega, Riesgos aduaneros, Costos logísticos reales, Viabilidad internacional (LATAM / Europa).

🔷 12. ROL: ABOGADO EN COMERCIO ELECTRÓNICO
Evalúa: Riesgos legales del producto, Restricciones por país, Cumplimiento normativo, Protección al consumidor.

🔷 13. ROL: ADMINISTRADOR ESTRATÉGICO
Optimiza: Uso de recursos, Priorización de inversiones, Estructura del negocio, Escalabilidad organizacional.

════════════════════════════════
📥 DATOS DEL PRODUCTO A EVALUAR:
════════════════════════════════
Nombre: ${producto.nombre}
Descripción: ${producto.descripcion || 'No especificada'}
Categoría: ${producto.categoria || 'No especificada'}
Costo proveedor: ${fmt(producto.costo_proveedor)}
Precio de venta propuesto: ${fmt(producto.precio_venta)}
Margen bruto estimado: ${margenBruto}%
Ganancia estimada por pedido entregado: ${fmt(gananciaPorPedido)}
Proyección mensual (ritmo actual del negocio): ${fmt(proyeccionMes)}
Mercado objetivo: ${producto.mercado}
Plataforma de pauta: ${producto.plataforma}
Temporada: ${producto.temporada}
Nivel de competencia percibida: ${producto.competencia}

════════════════════════════════
📊 CONTEXTO REAL DEL NEGOCIO — Datos DIZGO (últimos 90 días):
════════════════════════════════
CPA promedio real del negocio: ${fmt(contexto?.cpa_promedio||18000)}
Tasa de entrega real: ${contexto?.tasa_entrega||72}%
Tasa de devolución real: ${contexto?.tasa_devolucion||10}%
Margen promedio actual del catálogo: ${contexto?.margen_promedio||0}%
Costos fijos mensuales reales: ${fmt(contexto?.cf_mensual||934000)}
Saldo disponible en caja (capital de trabajo): ${fmt(contexto?.saldo_wallet||0)}
Productos activos en catálogo: ${contexto?.productos_activos||0}
Ventas mensuales actuales: ${fmt(contexto?.ventas_mes||0)}

NOTA: Estos datos son REALES del negocio, no benchmarks. Úsalos para calibrar cada análisis de rol. Un producto puede ser viable en un negocio con 15% de margen pero no en uno con 8%.

════════════════════════════════
📊 METODOLOGÍA DE RESPUESTA OBLIGATORIA:
════════════════════════════════

1. 🔍 ANÁLISIS INTEGRADO (por roles)
   Análisis específico por cada uno de los 13 roles usando los datos reales del negocio.

2. 💡 IDENTIFICACIÓN DE OPORTUNIDADES
   Máximo 4, con estimado de impacto económico en COP.

3. ⚠️ IDENTIFICACIÓN DE RIESGOS
   Máximo 4, con nivel (ALTO/MEDIO/BAJO) y plan de mitigación.

4. 📊 PROYECCIÓN FINANCIERA
   - Escenario ALTO (optimista): pedidos/mes, ingresos, ganancia neta
   - Escenario MEDIO (realista): pedidos/mes, ingresos, ganancia neta
   - Escenario BAJO (pesimista): pedidos/mes, ingresos, ganancia neta
   - Punto de equilibrio: ¿cuántos pedidos/mes para no perder?
   - Payback: ¿en cuántos meses se recupera la inversión inicial?

5. 🏁 CONCLUSIÓN ESTRATÉGICA
   Síntesis de 3-4 líneas con el veredicto integrado de los 13 roles.

6. 🚦 RECOMENDACIÓN FINAL
   Escribe exactamente una de estas tres opciones en mayúsculas al final:
   ✅ INVERTIR — si el producto es viable y rentable
   ⚠️ AJUSTAR — si requiere cambios antes de lanzar
   ❌ NO INVERTIR — si el riesgo supera el potencial

📌 IMPORTANTE:
- No des respuestas genéricas.
- Usa lógica financiera real con los datos del negocio.
- Conecta comportamiento humano con ventas.
- Identifica costos ocultos específicos de este producto.
- Prioriza claridad y toma de decisiones estratégicas para dropshipping en ${producto.mercado}.`

    try {
      const res = await fetch('/api/agentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 2000 }),
      })
      const data = await res.json()
      const texto = data.texto || ''
      setInforme(texto)

      // Detectar recomendación final
      if (texto.includes('✅ INVERTIR') || texto.includes('INVERTIR')) setRecomendacion('INVERTIR')
      else if (texto.includes('⚠️ AJUSTAR') || texto.includes('AJUSTAR')) setRecomendacion('AJUSTAR')
      else if (texto.includes('❌ NO INVERTIR') || texto.includes('NO INVERTIR')) setRecomendacion('NO INVERTIR')

      // Guardar log
      if (tenantId) {
        await supabase.from('agentes_ia_logs').insert({
          tenant_id: tenantId, agente: 'cazador_productos', trigger_tipo: 'manual',
          input_resumen: `${producto.nombre} | Costo: ${fmt(producto.costo_proveedor)} | PVP: ${fmt(producto.precio_venta)}`,
          output_texto: texto.slice(0, 500),
          tokens_usados: data.tokens || 0, estado: 'ok',
        })
      }
    } catch {
      setInforme('❌ Error al conectar con el agente. Verifica tu conexión.')
    }
    setAnalizando(false)
  }

  async function agregarAlCatalogo() {
    if (!tenantId || !producto.nombre) return
    await supabase.from('productos').insert({
      tenant_id: tenantId, nombre: producto.nombre, tipo: 'producto',
      estado: 'borrador', modelo_negocio: 'dropshipping',
      costo_proveedor: producto.costo_proveedor, pvp_final: producto.precio_venta,
      descripcion: producto.descripcion,
    })
    alert(`✅ "${producto.nombre}" agregado al catálogo en estado borrador. Completa los costos en el módulo Precio & Costeo.`)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8' }}>
      Cargando contexto del negocio...
    </div>
  )

  const recomColor = recomendacion === 'INVERTIR' ? '#2DD4A0' : recomendacion === 'AJUSTAR' ? '#F5A623' : '#F05C5C'

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🔍 Agente Cazador de Productos</h1>
        <p style={{ fontSize:'13px', color:'#8B96A8' }}>13 roles expertos · Metodología PHVA/PEF/ABC · Datos reales de tu negocio</p>
      </div>

      {/* Contexto del negocio */}
      {contexto && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px' }}>
          {[
            { l:'CPA promedio real', v:`${fmt(contexto.cpa_promedio)}`, c:'#F5A623' },
            { l:'Tasa entrega real', v:`${contexto.tasa_entrega}%`, c:'#2DD4A0' },
            { l:'Tasa devolución', v:`${contexto.tasa_devolucion}%`, c:'#F05C5C' },
            { l:'Caja disponible', v:fmt(contexto.saldo_wallet), c:'#3D8EF0' },
          ].map((k,i) => (
            <div key={i} style={{ ...s, padding:'10px 14px', borderLeft:`3px solid ${k.c}` }}>
              <div style={{ fontSize:'10px', color:'#8B96A8', marginBottom:'3px' }}>{k.l} (tu negocio)</div>
              <div style={{ fontSize:'16px', fontWeight:'800', color:k.c }}>{k.v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'400px 1fr', gap:'16px', alignItems:'start' }}>

        {/* Formulario */}
        <div style={{ ...s, padding:'20px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'16px' }}>📦 Datos del producto a evaluar</div>

          {[
            { label:'Nombre del producto *', key:'nombre', type:'text', placeholder:'Ej: Masajeador Cervical Pro' },
            { label:'Descripción (qué hace, para quién)', key:'descripcion', type:'text', placeholder:'Ej: Masajeador eléctrico con calor...' },
            { label:'Categoría', key:'categoria', type:'text', placeholder:'Ej: Salud y bienestar' },
          ].map((f,i) => (
            <div key={i} style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>{f.label}</label>
              <input value={(producto as Record<string,string|number>)[f.key] as string}
                onChange={e=>setProducto(p=>({...p,[f.key]:e.target.value}))}
                placeholder={f.placeholder}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'8px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
          ))}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
            <div>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Costo proveedor (COP) *</label>
              <input type="number" value={producto.costo_proveedor||''}
                onChange={e=>setProducto(p=>({...p,costo_proveedor:Number(e.target.value)}))}
                placeholder="28000"
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'8px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Precio de venta (COP) *</label>
              <input type="number" value={producto.precio_venta||''}
                onChange={e=>setProducto(p=>({...p,precio_venta:Number(e.target.value)}))}
                placeholder="89900"
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'8px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            </div>
          </div>

          {producto.costo_proveedor>0 && producto.precio_venta>0 && (
            <div style={{ padding:'8px 12px', background:'rgba(45,212,160,0.06)', borderRadius:'8px', marginBottom:'10px', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:'11px', color:'#8B96A8' }}>Margen bruto estimado</span>
              <span style={{ fontSize:'14px', fontWeight:'800', color:'#2DD4A0' }}>
                {Math.round((producto.precio_venta-producto.costo_proveedor)/producto.precio_venta*100)}%
              </span>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
            <div>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Mercado objetivo</label>
              <select value={producto.mercado} onChange={e=>setProducto(p=>({...p,mercado:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'8px 10px', fontSize:'12px', outline:'none' }}>
                {['Colombia','Ecuador','México','Perú','Chile','Argentina','Panamá'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Plataforma</label>
              <select value={producto.plataforma} onChange={e=>setProducto(p=>({...p,plataforma:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'8px 10px', fontSize:'12px', outline:'none' }}>
                {['Meta Ads','TikTok Ads','Ambas'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
            <div>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Temporada</label>
              <select value={producto.temporada} onChange={e=>setProducto(p=>({...p,temporada:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'8px 10px', fontSize:'12px', outline:'none' }}>
                {['todo el año','enero-marzo','abril-junio','julio-septiembre','octubre-diciembre','temporada navidad'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'11px', color:'#5A6478', display:'block', marginBottom:'4px' }}>Competencia percibida</label>
              <select value={producto.competencia} onChange={e=>setProducto(p=>({...p,competencia:e.target.value}))}
                style={{ width:'100%', background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'8px 10px', fontSize:'12px', outline:'none' }}>
                {['baja','media','alta','muy alta'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button onClick={ejecutarAnalisis} disabled={analizando || !producto.nombre || !producto.costo_proveedor || !producto.precio_venta}
            style={{ width:'100%', padding:'12px', background: analizando?'rgba(155,107,255,0.2)':'#9B6BFF', border:'none', borderRadius:'10px', color: analizando?'#9B6BFF':'#fff', fontWeight:'800', cursor:analizando||!producto.nombre?'not-allowed':'pointer', fontSize:'14px' }}>
            {analizando ? '🧠 Los 13 roles analizando...' : '🔍 Ejecutar análisis completo'}
          </button>

          {/* Roles incluidos */}
          <div style={{ marginTop:'14px' }}>
            <div style={{ fontSize:'10px', color:'#5A6478', marginBottom:'8px' }}>ROLES QUE PARTICIPAN EN EL ANÁLISIS:</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
              {ROLES.map(r => (
                <span key={r.num} style={{ fontSize:'9px', padding:'2px 7px', borderRadius:'4px', background:`${r.color}15`, color:r.color, fontWeight:'600' }}>
                  {r.icon} {r.num}. {r.titulo.split(' ').slice(0,2).join(' ')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {recomendacion && (
            <div style={{ ...s, padding:'20px', borderTop:`3px solid ${recomColor}`, textAlign:'center' }}>
              <div style={{ fontSize:'13px', color:'#8B96A8', marginBottom:'6px' }}>RECOMENDACIÓN FINAL DE LOS 13 ROLES</div>
              <div style={{ fontSize:'32px', fontWeight:'900', color:recomColor }}>
                {recomendacion === 'INVERTIR' ? '✅' : recomendacion === 'AJUSTAR' ? '⚠️' : '❌'} {recomendacion}
              </div>
              <div style={{ fontSize:'12px', color:'#8B96A8', marginTop:'6px' }}>{producto.nombre}</div>
              {recomendacion === 'INVERTIR' && (
                <button onClick={agregarAlCatalogo} style={{ marginTop:'12px', padding:'9px 20px', background:'rgba(45,212,160,0.15)', border:'1px solid rgba(45,212,160,0.3)', borderRadius:'8px', color:'#2DD4A0', cursor:'pointer', fontSize:'12px', fontWeight:'700' }}>
                  + Agregar al catálogo
                </button>
              )}
            </div>
          )}

          {informe ? (
            <div style={{ ...s, padding:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', marginBottom:'12px', display:'flex', justifyContent:'space-between' }}>
                <span>📋 INFORME ESTRATÉGICO COMPLETO</span>
                <button onClick={() => navigator.clipboard.writeText(informe)}
                  style={{ padding:'4px 10px', background:'rgba(155,107,255,0.1)', border:'none', borderRadius:'6px', color:'#9B6BFF', cursor:'pointer', fontSize:'10px', fontWeight:'700' }}>
                  📋 Copiar
                </button>
              </div>
              <div style={{ fontSize:'13px', lineHeight:'1.9', whiteSpace:'pre-wrap', color:'#E8EDF5', maxHeight:'600px', overflowY:'auto' }}>
                {informe}
              </div>
            </div>
          ) : (
            <div style={{ ...s, padding:'40px', textAlign:'center' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔍</div>
              <div style={{ fontSize:'14px', fontWeight:'700', marginBottom:'6px' }}>Sistema de Inteligencia DIZGO</div>
              <div style={{ fontSize:'12px', color:'#8B96A8', lineHeight:'1.7', maxWidth:'320px', margin:'0 auto' }}>
                Ingresa los datos del producto y ejecuta el análisis. Los 13 roles expertos evaluarán su viabilidad usando los datos reales de tu negocio — no benchmarks genéricos.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
