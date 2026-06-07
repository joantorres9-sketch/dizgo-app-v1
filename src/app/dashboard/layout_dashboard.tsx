'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

// ── PALETA TEMA C — Navy + Naranja Dorado ─────────────────
const T = {
  bg:        '#0D1E35',
  sidebar:   '#081426',
  card:      '#0A1628',
  accent:    '#F58720',
  blue:      '#3D8EF0',
  green:     '#2DD4A0',
  red:       '#F05C5C',
  purple:    '#9B6BFF',
  amber:     '#F5A623',
  text:      '#E8EDF5',
  muted:     '#5A7A9A',
  border:    '#152238',
}

// ── NAVEGACIÓN COMPLETA PHVA ───────────────────────────────
const NAV = [
  { group:'PLANEAR', color: T.blue, items:[
    { href:'/dashboard',                icon:'⊞',  label:'Inicio / ISO' },
    { href:'/dashboard/nomina',         icon:'👥',  label:'Nómina' },
    { href:'/dashboard/costos',         icon:'📊',  label:'Costos' },
    { href:'/dashboard/productos',      icon:'🛍️',  label:'Catálogo' },
    { href:'/dashboard/precio',         icon:'💡',  label:'Precio & Costeo' },
    { href:'/dashboard/inversion',      icon:'💰',  label:'Inversión' },
    { href:'/dashboard/equilibrio',     icon:'⚖️',  label:'Punto Equilibrio' },
    { href:'/dashboard/metas',          icon:'🎯',  label:'Metas' },
  ]},
  { group:'HACER', color: T.green, items:[
    { href:'/dashboard/pedidos',        icon:'📦',  label:'Pedidos' },
    { href:'/dashboard/contacto',       icon:'🛠️',  label:'Centro Contacto' },
    { href:'/dashboard/logistica',      icon:'🚚',  label:'Logística' },
    { href:'/dashboard/pauta',          icon:'📡',  label:'Pauta' },
    { href:'/dashboard/wallet',         icon:'💳',  label:'Wallet' },
    { href:'/dashboard/pqrsf',          icon:'📬',  label:'PQRSF' },
  ]},
  { group:'VERIFICAR', color: T.amber, items:[
    { href:'/dashboard/pyg',            icon:'📈',  label:'P&G Dashboard' },
    { href:'/dashboard/resultados',     icon:'📊',  label:'P&G Resultados' },
    { href:'/dashboard/embudo',         icon:'🌀',  label:'Embudo' },
    { href:'/dashboard/alertas',        icon:'🚨',  label:'Alertas' },
  ]},
  { group:'ACTUAR', color: T.purple, items:[
    { href:'/dashboard/formacion',      icon:'🎓',  label:'Formación' },
    { href:'/dashboard/crm',            icon:'🏪',  label:'CRM Clientes' },
    { href:'/dashboard/bodega',         icon:'🏭',  label:'Bodega' },
    { href:'/dashboard/admin',          icon:'⚙️',  label:'Superadmin' },
  ]},
]

// ── PAÍSES (12) ───────────────────────────────────────────
const PAISES = [
  { code:'COL', nombre:'Colombia',    moneda:'COP', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/co.svg' },
  { code:'ECU', nombre:'Ecuador',     moneda:'USD', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ec.svg' },
  { code:'MEX', nombre:'México',      moneda:'MXN', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/mx.svg' },
  { code:'PER', nombre:'Perú',        moneda:'PEN', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pe.svg' },
  { code:'CHL', nombre:'Chile',       moneda:'CLP', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cl.svg' },
  { code:'ARG', nombre:'Argentina',   moneda:'ARS', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ar.svg' },
  { code:'CRI', nombre:'Costa Rica',  moneda:'CRC', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cr.svg' },
  { code:'PRY', nombre:'Paraguay',    moneda:'PYG', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/py.svg' },
  { code:'VEN', nombre:'Venezuela',   moneda:'VES', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ve.svg' },
  { code:'ESP', nombre:'España',      moneda:'EUR', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/es.svg' },
  { code:'GTM', nombre:'Guatemala',   moneda:'GTQ', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/gt.svg' },
  { code:'PAN', nombre:'Panamá',      moneda:'USD', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pa.svg' },
]

// ── FORMATEO DE MONEDA POR PAÍS ────────────────────────────
export function formatMoney(valor: number, paisCode: string = 'COL'): string {
  const configs: Record<string, { moneda: string; decimales: number; locale: string }> = {
    COL: { moneda:'COP', decimales:0,  locale:'es-CO' },
    ECU: { moneda:'USD', decimales:2,  locale:'en-US' },
    MEX: { moneda:'MXN', decimales:2,  locale:'es-MX' },
    PER: { moneda:'PEN', decimales:2,  locale:'es-PE' },
    CHL: { moneda:'CLP', decimales:0,  locale:'es-CL' },
    ARG: { moneda:'ARS', decimales:2,  locale:'es-AR' },
    CRI: { moneda:'CRC', decimales:2,  locale:'es-CR' },
    PRY: { moneda:'PYG', decimales:0,  locale:'es-PY' },
    VEN: { moneda:'VES', decimales:2,  locale:'es-VE' },
    ESP: { moneda:'EUR', decimales:2,  locale:'es-ES' },
    GTM: { moneda:'GTQ', decimales:2,  locale:'es-GT' },
    PAN: { moneda:'USD', decimales:2,  locale:'es-PA' },
  }
  const cfg = configs[paisCode] || configs.COL
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.moneda,
    minimumFractionDigits: cfg.decimales,
    maximumFractionDigits: cfg.decimales,
  }).format(valor)
}

// ── COMPONENTE SELECTOR DE PAÍS ────────────────────────────
function PaisSelector({ paisActual, onChange }: { paisActual: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const pais = PAISES.find(p => p.code === paisActual) || PAISES[0]
  return (
    <div style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display:'flex', alignItems:'center', gap:'6px',
          background: T.card, border:`1px solid ${T.border}`,
          borderRadius:'8px', padding:'6px 10px', cursor:'pointer',
          color: T.text, fontSize:'12px', width:'100%'
        }}
      >
        <img src={pais.flag} alt={pais.nombre} style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover' }} />
        <span style={{ flex:1, textAlign:'left' }}>{pais.nombre}</span>
        <span style={{ color: T.muted, fontSize:'10px' }}>{pais.moneda}</span>
        <span style={{ color: T.muted, fontSize:'10px' }}>▾</span>
      </button>
      {open && (
        <div style={{
          position:'absolute', bottom:'calc(100% + 6px)', left:0, right:0,
          background: T.sidebar, border:`1px solid ${T.border}`,
          borderRadius:'10px', zIndex:100, maxHeight:'280px', overflowY:'auto',
          boxShadow:'0 8px 24px rgba(0,0,0,0.4)'
        }}>
          {PAISES.map(p => (
            <button
              key={p.code}
              onClick={() => { onChange(p.code); setOpen(false) }}
              style={{
                display:'flex', alignItems:'center', gap:'8px',
                width:'100%', padding:'8px 12px', background:'transparent',
                border:'none', cursor:'pointer', color: T.text, fontSize:'12px',
                borderBottom:`1px solid ${T.border}`,
                background: p.code === paisActual ? `${T.accent}12` : 'transparent',
              }}
            >
              <img src={p.flag} alt={p.nombre} style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover' }} />
              <span style={{ flex:1, textAlign:'left' }}>{p.nombre}</span>
              <span style={{ color: T.muted, fontSize:'10px' }}>{p.moneda}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── LAYOUT PRINCIPAL ───────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [paisActual, setPaisActual] = useState('COL')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isoScore, setIsoScore] = useState(73)

  // Guardar país en localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dizgo_pais')
    if (saved) setPaisActual(saved)
  }, [])
  const handlePaisChange = (code: string) => {
    setPaisActual(code)
    localStorage.setItem('dizgo_pais', code)
  }

  const isoColor = isoScore >= 80 ? T.green : isoScore >= 60 ? T.amber : T.red

  return (
    <div style={{
      display:'flex', minHeight:'100vh',
      background: T.bg, color: T.text,
      fontFamily:'"DM Sans", system-ui, sans-serif'
    }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: sidebarOpen ? '220px' : '56px',
        background: T.sidebar,
        borderRight: `1px solid ${T.border}`,
        display:'flex', flexDirection:'column',
        position:'fixed', top:0, left:0, height:'100vh',
        overflowY:'auto', overflowX:'hidden',
        flexShrink:0, transition:'width 0.2s ease',
        zIndex:50
      }}>

        {/* Logo */}
        <div style={{ padding: sidebarOpen ? '16px' : '12px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{
              width:'34px', height:'34px', background: T.accent,
              borderRadius:'8px', display:'flex', alignItems:'center',
              justifyContent:'center', fontWeight:'800', fontSize:'12px',
              color: T.sidebar, flexShrink:0
            }}>DZ</div>
            {sidebarOpen && (
              <div>
                <div style={{ fontWeight:'800', fontSize:'15px', color: T.text, lineHeight:1 }}>
                  DI<span style={{ color: T.accent }}>Z</span>GO
                </div>
                <div style={{ fontSize:'9px', color: T.muted, marginTop:'2px' }}>Hallazgo de dinero</div>
              </div>
            )}
          </div>
        </div>

        {/* ISO Badge */}
        {sidebarOpen && (
          <div style={{
            margin:'10px 10px 4px', padding:'8px 10px',
            background:`${isoColor}12`, border:`1px solid ${isoColor}30`,
            borderRadius:'8px', display:'flex', alignItems:'center', gap:'8px'
          }}>
            <div style={{
              width:'32px', height:'32px', borderRadius:'50%',
              border:`2px solid ${isoColor}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'11px', fontWeight:'700', color: isoColor, flexShrink:0
            }}>{isoScore}%</div>
            <div>
              <div style={{ fontSize:'10px', fontWeight:'600', color: isoColor }}>ISO Salud</div>
              <div style={{ fontSize:'9px', color: T.muted }}>
                {isoScore >= 80 ? 'Tienda saludable ✓' : isoScore >= 60 ? 'Optimizar antes' : 'En riesgo — actuar'}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex:1, padding:'6px 6px 0', overflowY:'auto' }}>
          {NAV.map(group => (
            <div key={group.group} style={{ marginBottom:'8px' }}>
              {sidebarOpen && (
                <div style={{
                  padding:'4px 10px 5px', fontSize:'9px', fontWeight:'800',
                  letterSpacing:'1.5px', color: group.color, opacity:0.8
                }}>{group.group}</div>
              )}
              {group.items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!sidebarOpen ? item.label : undefined}
                    style={{
                      display:'flex', alignItems:'center',
                      gap: sidebarOpen ? '8px' : '0',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      padding: sidebarOpen ? '7px 10px' : '9px 0',
                      borderRadius:'8px', marginBottom:'1px',
                      textDecoration:'none',
                      background: active ? `${group.color}15` : 'transparent',
                      borderLeft: sidebarOpen
                        ? (active ? `2px solid ${group.color}` : `2px solid transparent`)
                        : 'none',
                      color: active ? group.color : T.muted,
                      fontSize:'13px', fontWeight: active ? '600' : '400',
                      transition:'all 0.15s'
                    }}
                  >
                    <span style={{ fontSize:'16px', width:'18px', textAlign:'center', flexShrink:0 }}>
                      {item.icon}
                    </span>
                    {sidebarOpen && <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.label}</span>}
                  </Link>
                )
              })}
              {sidebarOpen && (
                <div style={{ height:'1px', background: T.border, margin:'6px 8px' }} />
              )}
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding: sidebarOpen ? '10px' : '8px', borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
          {sidebarOpen && (
            <PaisSelector paisActual={paisActual} onChange={handlePaisChange} />
          )}
          <div style={{ marginTop:'8px', display:'flex', gap:'6px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                flex:1, padding:'6px', background:`${T.accent}15`,
                border:`1px solid ${T.accent}30`, borderRadius:'7px',
                color: T.accent, cursor:'pointer', fontSize:'12px'
              }}
              title={sidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
            {sidebarOpen && (
              <Link
                href="/auth/login"
                style={{
                  flex:2, display:'block', textAlign:'center',
                  padding:'6px', background:`rgba(255,255,255,0.04)`,
                  borderRadius:'7px', color: T.muted,
                  textDecoration:'none', fontSize:'12px'
                }}
              >
                Salir
              </Link>
            )}
          </div>
          {sidebarOpen && (
            <div style={{ fontSize:'9px', color: T.muted, textAlign:'center', marginTop:'8px' }}>
              DIZGO v2.0 · {PAISES.find(p=>p.code===paisActual)?.moneda}
            </div>
          )}
        </div>
      </aside>

      {/* ── TOPBAR ── */}
      <div style={{
        position:'fixed', top:0,
        left: sidebarOpen ? '220px' : '56px',
        right:0, height:'52px',
        background:`${T.sidebar}EE`,
        borderBottom:`1px solid ${T.border}`,
        backdropFilter:'blur(8px)',
        display:'flex', alignItems:'center',
        padding:'0 24px', gap:'16px', zIndex:40,
        transition:'left 0.2s ease'
      }}>
        {/* Breadcrumb */}
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ fontSize:'12px', color: T.muted }}>DIZGO</span>
          <span style={{ fontSize:'12px', color: T.border }}>›</span>
          <span style={{ fontSize:'12px', color: T.text, fontWeight:'500' }}>
            {NAV.flatMap(g=>g.items).find(i=>pathname===i.href||(i.href!=='/dashboard'&&pathname.startsWith(i.href)))?.label || 'Dashboard'}
          </span>
        </div>

        {/* Meta rápida del día */}
        <div style={{
          display:'flex', alignItems:'center', gap:'16px',
          fontSize:'12px', color: T.muted
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ color: T.green }}>●</span>
            <span>ISO: <strong style={{ color: T.green }}>{isoScore}%</strong></span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ color: T.amber }}>●</span>
            <span>Meta: <strong style={{ color: T.text }}>187/294</strong></span>
          </div>
          <div style={{
            background:`${T.accent}18`, border:`1px solid ${T.accent}30`,
            borderRadius:'6px', padding:'4px 10px',
            display:'flex', alignItems:'center', gap:'6px'
          }}>
            <img
              src={PAISES.find(p=>p.code===paisActual)?.flag}
              alt={paisActual}
              style={{ width:'16px', height:'11px', borderRadius:'2px', objectFit:'cover' }}
            />
            <span style={{ color: T.accent, fontWeight:'600', fontSize:'11px' }}>
              {PAISES.find(p=>p.code===paisActual)?.moneda}
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main style={{
        flex:1,
        marginLeft: sidebarOpen ? '220px' : '56px',
        marginTop:'52px',
        padding:'24px',
        minWidth:0,
        transition:'margin-left 0.2s ease',
        minHeight:'calc(100vh - 52px)'
      }}>
        {children}
      </main>
    </div>
  )
}

// ── EXPORT HELPER: Acceso al país actual desde cualquier módulo ──
export function usePaisActual(): string {
  if (typeof window === 'undefined') return 'COL'
  return localStorage.getItem('dizgo_pais') || 'COL'
}
