'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

const T = { bg:'#0D1E35', card:'#081426', accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0', red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF', text:'#E8EDF5', muted:'#5A7A9A', border:'#152238' }

const PAISES = [
  { code:'COL', nombre:'Colombia',  moneda:'COP', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/co.svg' },
  { code:'ECU', nombre:'Ecuador',   moneda:'USD', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ec.svg' },
  { code:'MEX', nombre:'México',    moneda:'MXN', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/mx.svg' },
  { code:'PER', nombre:'Perú',      moneda:'PEN', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pe.svg' },
  { code:'CHL', nombre:'Chile',     moneda:'CLP', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cl.svg' },
  { code:'ARG', nombre:'Argentina', moneda:'ARS', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ar.svg' },
  { code:'CRI', nombre:'Costa Rica',moneda:'CRC', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cr.svg' },
  { code:'PAN', nombre:'Panamá',    moneda:'USD', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pa.svg' },
  { code:'ESP', nombre:'España',    moneda:'EUR', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/es.svg' },
]

const WA_JOAN = '573206348574'

const inp: React.CSSProperties = { width:'100%', background:'#0A1628', border:'1.5px solid #1E3050', borderRadius:'8px', padding:'9px 10px', fontSize:'13px', color:'#E8EDF5', outline:'none', boxSizing:'border-box' }
const lbl: React.CSSProperties = { fontSize:'11px', color:'#5A7A9A', marginBottom:'4px', display:'block' }
const fld: React.CSSProperties = { marginBottom:'12px' }
const row2: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'10px', marginBottom:'12px' }
const sectionH: React.CSSProperties = { fontSize:'12px', fontWeight:700, color: T.accent, textTransform:'uppercase', letterSpacing:'.4px', margin:'18px 0 10px' }

function n(v: string) { const x = parseFloat(v.replace(/,/g,'.')); return isNaN(x) ? 0 : x }

export default function SimuladorPage() {
  const [pais, setPais] = useState('COL')
  const moneda = PAISES.find(p => p.code === pais)?.moneda || 'USD'

  const [producto, setProducto] = useState('')
  const [costoProveedor, setCostoProveedor] = useState('')
  const [fleteEnvio, setFleteEnvio] = useState('')
  const [fleteDevolucion, setFleteDevolucion] = useState('')
  const [fulfillmentEnvio, setFulfillmentEnvio] = useState('')
  const [fulfillmentDevolucion, setFulfillmentDevolucion] = useState('')
  const [adminPedido, setAdminPedido] = useState('')
  const [pctDevolucion, setPctDevolucion] = useState('')
  const [pctCancelacion, setPctCancelacion] = useState('')
  const [pctPublicidad, setPctPublicidad] = useState('')
  const [pctComisiones, setPctComisiones] = useState('')
  const [pctMargen, setPctMargen] = useState('')

  const [costosExtra, setCostosExtra] = useState<{ id: number; label: string; valor: string }[]>([])
  const [pctExtra, setPctExtra] = useState<{ id: number; label: string; valor: string }[]>([])
  const extraIdRef = useState(() => ({ n: 0 }))[0]
  const nuevoId = () => ++extraIdRef.n

  const agregarCostoExtra = () => setCostosExtra(c => [...c, { id: nuevoId(), label: '', valor: '' }])
  const quitarCostoExtra = (id: number) => setCostosExtra(c => c.filter(x => x.id !== id))
  const agregarPctExtra = () => setPctExtra(c => [...c, { id: nuevoId(), label: '', valor: '' }])
  const quitarPctExtra = (id: number) => setPctExtra(c => c.filter(x => x.id !== id))

  const [resultado, setResultado] = useState<{ costos: number; pvp: number; utilidad: number; costosExtraVals: { label: string; valor: number }[]; pctExtraVals: { label: string; valor: number }[] } | null>(null)
  const [leadId, setLeadId] = useState<string | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [errorCalc, setErrorCalc] = useState('')

  const [mostrarContacto, setMostrarContacto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [emailLead, setEmailLead] = useState('')
  const [enviandoContacto, setEnviandoContacto] = useState(false)
  const [contactoOk, setContactoOk] = useState(false)

  const fmt = useMemo(() => new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }), [moneda])

  async function calcular(e: React.FormEvent) {
    e.preventDefault()
    setErrorCalc('')
    const cProv = n(costoProveedor), cFleteE = n(fleteEnvio), cFleteD = n(fleteDevolucion)
    const cFullE = n(fulfillmentEnvio), cFullD = n(fulfillmentDevolucion), cAdmin = n(adminPedido)
    const pDev = n(pctDevolucion), pCanc = n(pctCancelacion), pPub = n(pctPublicidad), pCom = n(pctComisiones), pMar = n(pctMargen)

    const costosExtraVals = costosExtra.map(c => ({ label: c.label || 'Costo extra', valor: n(c.valor) }))
    const pctExtraVals = pctExtra.map(p => ({ label: p.label || 'Porcentaje extra', valor: n(p.valor) }))
    const sumaCostosExtra = costosExtraVals.reduce((s, c) => s + c.valor, 0)
    const sumaPctExtra = pctExtraVals.reduce((s, p) => s + p.valor, 0)

    const costos = cProv + cFleteE + cFleteD * (pDev / 100) + cFullE + cFullD * (pDev / 100) + cAdmin + sumaCostosExtra
    const denom = 1 - (pPub + pCom + pMar + sumaPctExtra) / 100
    if (denom <= 0.01) {
      setErrorCalc('La suma de tus porcentajes de publicidad, comisión, margen y extras es demasiado alta — no queda espacio para cubrir tus costos. Ajusta los valores.')
      setResultado(null)
      return
    }
    const pvp = costos / denom
    const utilidad = pvp * (pMar / 100)
    setResultado({ costos, pvp, utilidad, costosExtraVals, pctExtraVals })
    setContactoOk(false)
    setMostrarContacto(false)

    setCalculando(true)
    try {
      const res = await fetch('/api/simulador/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pais, moneda, nombre_producto: producto || null,
          costo_proveedor: cProv, flete_envio: cFleteE, flete_devolucion: cFleteD, costo_admin_pedido: cAdmin,
          pct_devolucion: pDev, pct_cancelacion: pCanc, pct_publicidad: pPub, pct_comisiones: pCom, pct_margen_deseado: pMar,
          costos_extra: costosExtraVals, porcentajes_extra: pctExtraVals,
          costos_totales: costos, pvp_sugerido: pvp,
        }),
      })
      const data = await res.json()
      if (data.id) setLeadId(data.id)
    } catch { /* el resultado ya se muestra igual, el registro es secundario para el usuario */ }
    finally { setCalculando(false) }
  }

  async function enviarPorWhatsapp(e: React.FormEvent) {
    e.preventDefault()
    if (!whatsapp || !resultado) return
    setEnviandoContacto(true)
    try {
      if (leadId) {
        await fetch('/api/simulador/registrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: leadId, nombre, whatsapp, email: emailLead, contacto_solicitado: true }),
        })
      }
      const pNombre = producto || 'tu producto'
      const extrasTxt = [
        ...resultado.costosExtraVals.filter(c=>c.valor).map(c=>`${c.label}: ${fmt.format(c.valor)}`),
        ...resultado.pctExtraVals.filter(p=>p.valor).map(p=>`${p.label}: ${p.valor}%`),
      ].join('\n')
      const txt = `Hola! Usé la calculadora de precios de DIZGO para *${pNombre}*.\n\nCostos totales por pedido: ${fmt.format(resultado.costos)}\nPrecio de venta sugerido: ${fmt.format(resultado.pvp)}\nUtilidad neta esperada: ${fmt.format(resultado.utilidad)}${extrasTxt ? `\n\nExtras que agregué:\n${extrasTxt}` : ''}\n\nNombre: ${nombre}\nQuiero que me ayuden a aplicar esto en mi tienda.`
      window.open(`https://wa.me/${WA_JOAN}?text=${encodeURIComponent(txt)}`, '_blank')
      setContactoOk(true)
    } finally { setEnviandoContacto(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background: T.bg, fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'28px 18px 60px' }}>

        <div style={{ textAlign:'center', marginBottom:'22px' }}>
          <Link href="https://app.dizgo.app" style={{ display:'inline-flex', alignItems:'center', gap:'8px', textDecoration:'none' }}>
            <div style={{ width:'36px', height:'36px', background: T.accent, borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'14px', color: T.card }}>DZ</div>
            <div style={{ fontWeight:800, fontSize:'16px', color: T.text }}>DI<span style={{ color: T.accent }}>Z</span>GO</div>
          </Link>
          <h1 style={{ fontSize:'22px', fontWeight:800, color: T.text, margin:'16px 0 8px' }}>Calculadora de Precios para E-commerce</h1>
          <p style={{ fontSize:'13px', color: T.muted, lineHeight:1.6, maxWidth:'480px', margin:'0 auto' }}>
            Ingresa los costos reales de tu producto y te ayudamos a tomar la decisión de a cuánto venderlo,
            sin adivinar y sin dejar plata sobre la mesa.
          </p>
        </div>

        <form onSubmit={calcular} style={{ background: T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'20px' }}>

          <div style={{ ...lbl, marginBottom:'8px' }}>País — define la moneda de tus cálculos</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:'6px', marginBottom:'14px' }}>
            {PAISES.map(p => (
              <button type="button" key={p.code} onClick={() => setPais(p.code)}
                style={{ background: pais===p.code ? `${T.accent}15` : '#0A1628', border:`1.5px solid ${pais===p.code ? T.accent : '#1E3050'}`, borderRadius:'8px', padding:'6px 5px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                <img src={p.flag} alt={p.nombre} style={{ width:'18px', height:'13px', borderRadius:'2px', objectFit:'cover', flexShrink:0 }} />
                <div style={{ fontSize:'10px', color: T.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
              </button>
            ))}
          </div>

          <div style={fld}>
            <label style={lbl}>Nombre del producto</label>
            <input style={inp} value={producto} onChange={e=>setProducto(e.target.value)} placeholder="Ej: Audífonos inalámbricos" />
          </div>

          <div style={sectionH}>Costos por pedido ({moneda})</div>
          <div style={row2}>
            <div><label style={lbl}>Costo del producto (proveedor)</label><input style={inp} inputMode="decimal" value={costoProveedor} onChange={e=>setCostoProveedor(e.target.value)} placeholder="0" /></div>
            <div><label style={lbl}>Costo administrativo por pedido</label><input style={inp} inputMode="decimal" value={adminPedido} onChange={e=>setAdminPedido(e.target.value)} placeholder="0" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>Flete de envío</label><input style={inp} inputMode="decimal" value={fleteEnvio} onChange={e=>setFleteEnvio(e.target.value)} placeholder="0" /></div>
            <div><label style={lbl}>Flete de devolución</label><input style={inp} inputMode="decimal" value={fleteDevolucion} onChange={e=>setFleteDevolucion(e.target.value)} placeholder="0" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>Fulfillment de envío</label><input style={inp} inputMode="decimal" value={fulfillmentEnvio} onChange={e=>setFulfillmentEnvio(e.target.value)} placeholder="0" /></div>
            <div><label style={lbl}>Fulfillment de devolución</label><input style={inp} inputMode="decimal" value={fulfillmentDevolucion} onChange={e=>setFulfillmentDevolucion(e.target.value)} placeholder="0" /></div>
          </div>

          {costosExtra.map(c => (
            <div key={c.id} style={{ display:'grid', gridTemplateColumns:'1fr 140px auto', gap:'8px', marginBottom:'10px', alignItems:'end' }}>
              <div><label style={lbl}>Nombre del costo</label><input style={inp} value={c.label} onChange={e=>setCostosExtra(cs=>cs.map(x=>x.id===c.id?{...x,label:e.target.value}:x))} placeholder="Ej: Empaque especial" /></div>
              <div><label style={lbl}>Valor ({moneda})</label><input style={inp} inputMode="decimal" value={c.valor} onChange={e=>setCostosExtra(cs=>cs.map(x=>x.id===c.id?{...x,valor:e.target.value}:x))} placeholder="0" /></div>
              <button type="button" onClick={()=>quitarCostoExtra(c.id)} title="Quitar" style={{ background:'#0A1628', border:`1.5px solid ${T.red}40`, borderRadius:'8px', color: T.red, width:'34px', height:'34px', cursor:'pointer', fontSize:'14px' }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={agregarCostoExtra}
            style={{ width:'100%', background:'transparent', border:`1.5px dashed ${T.border}`, borderRadius:'8px', padding:'9px', fontSize:'12px', color: T.blue, cursor:'pointer', marginBottom:'14px' }}>
            + Agregar costo extra
          </button>

          <div style={sectionH}>Porcentajes de tu operación</div>
          <div style={row2}>
            <div><label style={lbl}>% de devolución de pedidos</label><input style={inp} inputMode="decimal" value={pctDevolucion} onChange={e=>setPctDevolucion(e.target.value)} placeholder="0" /></div>
            <div><label style={lbl}>% de cancelación de pedidos</label><input style={inp} inputMode="decimal" value={pctCancelacion} onChange={e=>setPctCancelacion(e.target.value)} placeholder="0" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>% que gastas en publicidad/pauta</label><input style={inp} inputMode="decimal" value={pctPublicidad} onChange={e=>setPctPublicidad(e.target.value)} placeholder="0" /></div>
            <div><label style={lbl}>% de comisión (plataforma/pasarela)</label><input style={inp} inputMode="decimal" value={pctComisiones} onChange={e=>setPctComisiones(e.target.value)} placeholder="0" /></div>
          </div>
          <div style={fld}>
            <label style={lbl}>% de margen que quieres ganar</label>
            <input style={inp} inputMode="decimal" value={pctMargen} onChange={e=>setPctMargen(e.target.value)} placeholder="0" />
          </div>

          {pctExtra.map(p => (
            <div key={p.id} style={{ display:'grid', gridTemplateColumns:'1fr 140px auto', gap:'8px', marginBottom:'10px', alignItems:'end' }}>
              <div><label style={lbl}>Nombre del porcentaje</label><input style={inp} value={p.label} onChange={e=>setPctExtra(ps=>ps.map(x=>x.id===p.id?{...x,label:e.target.value}:x))} placeholder="Ej: Impuesto local" /></div>
              <div><label style={lbl}>Valor (%)</label><input style={inp} inputMode="decimal" value={p.valor} onChange={e=>setPctExtra(ps=>ps.map(x=>x.id===p.id?{...x,valor:e.target.value}:x))} placeholder="0" /></div>
              <button type="button" onClick={()=>quitarPctExtra(p.id)} title="Quitar" style={{ background:'#0A1628', border:`1.5px solid ${T.red}40`, borderRadius:'8px', color: T.red, width:'34px', height:'34px', cursor:'pointer', fontSize:'14px' }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={agregarPctExtra}
            style={{ width:'100%', background:'transparent', border:`1.5px dashed ${T.border}`, borderRadius:'8px', padding:'9px', fontSize:'12px', color: T.blue, cursor:'pointer', marginBottom:'14px' }}>
            + Agregar % extra
          </button>

          {errorCalc && (
            <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'9px 12px', fontSize:'12px', color: T.red, marginBottom:'12px' }}>{errorCalc}</div>
          )}

          <button type="submit" style={{ width:'100%', background: T.accent, border:'none', borderRadius:'9px', padding:'13px', fontSize:'14px', fontWeight:700, color: T.card, cursor:'pointer' }}>
            Calcular mi precio de venta
          </button>
        </form>

        {resultado && (
          <div style={{ marginTop:'18px', background: T.card, border:`1px solid ${T.green}40`, borderRadius:'14px', padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color: T.green, textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'14px' }}>Resultado de tu cálculo</div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px', marginBottom:'14px' }}>
              <div style={{ background:'#0A1828', border:`1px solid ${T.border}`, borderRadius:'10px', padding:'12px' }}>
                <div style={{ fontSize:'10px', color: T.muted, marginBottom:'4px' }}>Costos totales por pedido</div>
                <div style={{ fontSize:'17px', fontWeight:800, color: T.text }}>{fmt.format(resultado.costos)}</div>
              </div>
              <div style={{ background:`${T.accent}12`, border:`1px solid ${T.accent}40`, borderRadius:'10px', padding:'12px' }}>
                <div style={{ fontSize:'10px', color: T.accent, marginBottom:'4px' }}>Precio de venta sugerido</div>
                <div style={{ fontSize:'19px', fontWeight:800, color: T.accent }}>{fmt.format(resultado.pvp)}</div>
              </div>
              <div style={{ background:'#0A1828', border:`1px solid ${T.border}`, borderRadius:'10px', padding:'12px' }}>
                <div style={{ fontSize:'10px', color: T.muted, marginBottom:'4px' }}>Utilidad neta esperada</div>
                <div style={{ fontSize:'17px', fontWeight:800, color: T.green }}>{fmt.format(resultado.utilidad)}</div>
              </div>
            </div>

            {(resultado.costosExtraVals.length > 0 || resultado.pctExtraVals.length > 0) && (
              <div style={{ background:'#0A1828', border:`1px solid ${T.border}`, borderRadius:'8px', padding:'10px 12px', marginBottom:'14px' }}>
                <div style={{ fontSize:'10px', color: T.muted, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.4px' }}>Extras incluidos en el cálculo</div>
                {resultado.costosExtraVals.map((c,i) => (
                  <div key={`ce-${i}`} style={{ display:'flex', justifyContent:'space-between', fontSize:'11.5px', color: T.text, padding:'2px 0' }}>
                    <span>{c.label}</span><span>{fmt.format(c.valor)}</span>
                  </div>
                ))}
                {resultado.pctExtraVals.map((p,i) => (
                  <div key={`pe-${i}`} style={{ display:'flex', justifyContent:'space-between', fontSize:'11.5px', color: T.text, padding:'2px 0' }}>
                    <span>{p.label}</span><span>{p.valor}%</span>
                  </div>
                ))}
              </div>
            )}

            {(n(pctCancelacion) > 0) && (
              <div style={{ fontSize:'11.5px', color: T.yellow, background:`${T.yellow}10`, border:`1px solid ${T.yellow}30`, borderRadius:'8px', padding:'9px 12px', marginBottom:'14px', lineHeight:1.6 }}>
                Tienes una tasa de cancelación del {pctCancelacion}% — esos pedidos no facturan pero sí consumen tiempo operativo. Vale la pena que lo tengas en el radar aunque no esté en el número de arriba.
              </div>
            )}

            {!contactoOk ? (
              <>
                {!mostrarContacto ? (
                  <button type="button" onClick={() => setMostrarContacto(true)}
                    style={{ width:'100%', background:'#25D366', border:'none', borderRadius:'9px', padding:'12px', fontSize:'13px', fontWeight:700, color:'#04140A', cursor:'pointer' }}>
                    📄 Recibir este resultado en mi WhatsApp
                  </button>
                ) : (
                  <form onSubmit={enviarPorWhatsapp} style={{ borderTop:`1px solid ${T.border}`, paddingTop:'14px' }}>
                    <div style={row2}>
                      <div><label style={lbl}>Tu nombre</label><input style={inp} value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre" required /></div>
                      <div><label style={lbl}>Tu WhatsApp</label><input style={inp} value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="320 634 8574" required /></div>
                    </div>
                    <div style={fld}><label style={lbl}>Email (opcional)</label><input style={inp} type="email" value={emailLead} onChange={e=>setEmailLead(e.target.value)} placeholder="tu@correo.com" /></div>
                    <button type="submit" disabled={enviandoContacto}
                      style={{ width:'100%', background:'#25D366', border:'none', borderRadius:'9px', padding:'12px', fontSize:'13px', fontWeight:700, color:'#04140A', cursor: enviandoContacto?'wait':'pointer', opacity: enviandoContacto?0.7:1 }}>
                      {enviandoContacto ? 'Abriendo WhatsApp...' : '💬 Enviarme el resultado por WhatsApp'}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div style={{ background:`${T.green}12`, border:`1px solid ${T.green}30`, borderRadius:'9px', padding:'14px' }}>
                <div style={{ fontSize:'12.5px', color: T.green, fontWeight:600, marginBottom:'8px' }}>✓ Listo, revisa tu chat de WhatsApp</div>
                <a href={`https://wa.me/${WA_JOAN}?text=${encodeURIComponent('Hola Joan, quiero unirme a la comunidad DIZGO')}`} target="_blank" rel="noopener"
                  style={{ display:'block', textAlign:'center', background:'#25D366', border:'none', borderRadius:'9px', padding:'11px', fontSize:'12.5px', fontWeight:700, color:'#04140A', textDecoration:'none' }}>
                  📲 Unirme a la comunidad DIZGO en WhatsApp
                </a>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop:'18px', textAlign:'center', fontSize:'11.5px', color: T.muted, lineHeight:1.7 }}>
          Esta calculadora te da una referencia rápida. Para llevar el control completo de tu operación —costos,
          punto de equilibrio, inventario y flujo de caja en un solo lugar— {' '}
          <a href="https://app.dizgo.app" style={{ color: T.accent }}>conoce DIZGO</a>.
        </div>
      </div>
    </div>
  )
}
