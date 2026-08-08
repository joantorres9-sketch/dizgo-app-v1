'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MODULOS, GRUPOS } from '@/lib/modulos'
import { usePermisos, logAccion } from '@/lib/permisos'
import { PAISES } from '@/lib/paises'

const ITEMS_FIJOS = {
  inicio: { href: '/dashboard', icon: '⊞', label: 'Inicio' },
  superadmin: [
    { href: '/dashboard/admin', icon: '⚙️', label: 'Superadmin' },
    { href: '/dashboard/admin/accesos', icon: '🔐', label: 'Gestión de Accesos' },
    { href: '/dashboard/admin/empresa', icon: '🏢', label: 'Centro DIZGO' },
  ],
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const { perfil, cargando, puede, puedePais, enHorario } = usePermisos()

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    if (!cargando && perfil && !enHorario) logAccion('sistema', 'fuera_horario')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, enHorario])

  // Precio/Productos/Pedidos/Costos/Centro Contacto usan localStorage('dizgo_pais') como selector
  // de país operativo — si DIZGO restringió los países del tenant y el valor guardado ya no está
  // permitido (por ejemplo, quedó de una sesión anterior sin restricción), lo corrige al primer
  // país habilitado en vez de dejar esos módulos mostrando datos de un país al que no tiene acceso.
  useEffect(() => {
    if (cargando || !perfil || typeof window === 'undefined') return
    const actual = localStorage.getItem('dizgo_pais')
    if (actual && puedePais(actual)) return
    const primero = PAISES.find(p => puedePais(p.code))
    if (primero) localStorage.setItem('dizgo_pais', primero.code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, perfil])

  async function cerrarSesion() {
    setSaliendo(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const esAdmin = perfil?.rol === 'owner' || perfil?.rol === 'superadmin'
  // Un usuario de cortesía es rol='colaborador' (queda sujeto a la matriz de permisos como
  // cualquier otro) pero SÍ necesita administrar el acceso de sus propios colaboradores, igual
  // que un comprador de plan (rol='owner') — por eso también ve Gestión de Accesos, además de su
  // botón de "Borrar datos de prueba". Centro DIZGO (CRM interno de ventas) sigue siendo de
  // verdad superadmin-only, nunca visible para cortesía.
  const itemsSuperadmin = esAdmin
    ? ITEMS_FIJOS.superadmin
    : perfil?.esCortesia
      ? ITEMS_FIJOS.superadmin.filter(i => i.href === '/dashboard/admin' || i.href === '/dashboard/admin/accesos')
      : []
  const gruposConItems = GRUPOS.map(g => ({
    ...g,
    items: MODULOS.filter(m => m.grupo === g.key && puede(m.key, 'ver')),
  })).filter(g => g.items.length > 0)

  if (!cargando && perfil && !enHorario) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0A0D14', color: '#E8EDF5', fontFamily: 'system-ui,sans-serif', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '10px' }}>⏰ Fuera de horario</div>
          <div style={{ fontSize: '13px', color: '#8B96A8', lineHeight: 1.6, marginBottom: '18px' }}>
            Tu horario de acceso configurado no permite entrar a DIZGO en este momento. Contacta al administrador de tu cuenta si necesitas ajustarlo.
          </div>
          <button onClick={cerrarSesion} style={{ padding: '9px 18px', background: 'rgba(240,92,92,0.1)', border: '1px solid rgba(240,92,92,0.3)', borderRadius: '8px', color: '#F05C5C', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0A0D14', color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>
      <div className={`dz-overlay${menuOpen?' open':''}`} onClick={()=>setMenuOpen(false)} />

      <aside className={`dz-sidebar${menuOpen?' open':''}`} style={{ width:'220px', background:'#080B10', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, height:'100vh', overflowY:'auto', flexShrink:0 }}>
        <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/dashboard" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', background:'#F5A623', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', fontSize:'13px', color:'#0A0D14', flexShrink:0 }}>DZ</div>
            <div>
              <div style={{ fontWeight:'800', fontSize:'16px', color:'#E8EDF5' }}>DI<span style={{ color:'#F5A623' }}>Z</span>GO</div>
              <div style={{ fontSize:'9px', color:'#5A6478' }}>Hallazgo de dinero</div>
            </div>
          </Link>
        </div>
        <nav style={{ flex:1, padding:'8px 6px' }}>
          <div style={{ marginBottom:'14px' }}>
            {(() => {
              const item = ITEMS_FIJOS.inicio
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'8px', marginBottom:'2px', textDecoration:'none', background: active ? '#3D8EF015' : 'transparent', borderLeft: active ? '2px solid #3D8EF0' : '2px solid transparent', color: active ? '#3D8EF0' : '#8B96A8', fontSize:'13px', fontWeight: active ? '600' : '400' }}>
                  <span style={{ fontSize:'15px', width:'18px', textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })()}
          </div>
          {gruposConItems.map(group => (
            <div key={group.key} style={{ marginBottom:'14px' }}>
              <div style={{ padding:'4px 10px 6px', fontSize:'9px', fontWeight:'800', letterSpacing:'1.5px', color:group.color }}>{group.key}</div>
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'8px', marginBottom:'2px', textDecoration:'none', background: active ? `${group.color}15` : 'transparent', borderLeft: active ? `2px solid ${group.color}` : '2px solid transparent', color: active ? group.color : '#8B96A8', fontSize:'13px', fontWeight: active ? '600' : '400' }}>
                    <span style={{ fontSize:'15px', width:'18px', textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
          {itemsSuperadmin.length > 0 && (
            <div style={{ marginBottom:'14px' }}>
              <div style={{ padding:'4px 10px 6px', fontSize:'9px', fontWeight:'800', letterSpacing:'1.5px', color:'#9B6BFF' }}>ACTUAR</div>
              {itemsSuperadmin.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'8px', marginBottom:'2px', textDecoration:'none', background: active ? '#9B6BFF15' : 'transparent', borderLeft: active ? '2px solid #9B6BFF' : '2px solid transparent', color: active ? '#9B6BFF' : '#8B96A8', fontSize:'13px', fontWeight: active ? '600' : '400' }}>
                    <span style={{ fontSize:'15px', width:'18px', textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </nav>
        <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:'11px', color:'#5A6478', marginBottom:'8px', textAlign:'center' }}>DIZGO v2.0 · COP</div>
          <button onClick={cerrarSesion} disabled={saliendo} style={{ width:'100%', display:'block', textAlign:'center', padding:'8px', background:'rgba(240,92,92,0.1)', border:'1px solid rgba(240,92,92,0.3)', borderRadius:'8px', color:'#F05C5C', fontWeight:'600', fontSize:'12px', cursor: saliendo ? 'wait' : 'pointer' }}>
            {saliendo ? 'Cerrando sesión...' : '🚪 Cerrar sesión'}
          </button>
        </div>
      </aside>
      <div className="dz-main" style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <div
          style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', alignItems:'center', gap:'10px', position:'sticky', top:0, background:'#0A0D14', zIndex:30 }}
          className="dz-hamburger"
        >
          <button onClick={()=>setMenuOpen(o=>!o)} aria-label="Abrir menú"
            style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:'8px', width:'36px', height:'36px', color:'#E8EDF5', fontSize:'18px', cursor:'pointer', flexShrink:0 }}>
            ☰
          </button>
          <div style={{ fontWeight:'800', fontSize:'15px' }}>DI<span style={{ color:'#F5A623' }}>Z</span>GO</div>
        </div>
        <main style={{ flex:1, padding:'28px', minWidth:0 }}>{children}</main>
      </div>
    </div>
  )
}
