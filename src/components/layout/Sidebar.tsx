'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Perfil } from '@/lib/supabase'

const NAV_ITEMS = [
  // PLANEAR
  { group: 'PLANEAR', items: [
    { href: '/dashboard',          icon: '⊞', label: 'Inicio',          mod: 'dashboard' },
    { href: '/dashboard/costos',   icon: '📊', label: 'Costos Fijos',    mod: 'costos' },
    { href: '/dashboard/productos',icon: '🛍️', label: 'Catálogo',        mod: 'productos' },
    { href: '/dashboard/precio',   icon: '💡', label: 'Precio & Costeo', mod: 'precio' },
    { href: '/dashboard/inversion',icon: '💰', label: 'Inversión',       mod: 'costos' },
    { href: '/dashboard/metas',    icon: '🎯', label: 'Metas',           mod: 'metas' },
  ]},
  // HACER
  { group: 'HACER', items: [
    { href: '/dashboard/pedidos',  icon: '📦', label: 'Pedidos',         mod: 'pedidos' },
    { href: '/dashboard/whatsapp', icon: '💬', label: 'WhatsApp',        mod: 'whatsapp' },
    { href: '/dashboard/logistica',icon: '🚚', label: 'Logística',       mod: 'logistica' },
    { href: '/dashboard/pauta',    icon: '📢', label: 'Pauta',           mod: 'pauta' },
    { href: '/dashboard/wallet',   icon: '💳', label: 'Wallet Dropi',    mod: 'wallet' },
  ]},
  // VERIFICAR
  { group: 'VERIFICAR', items: [
    { href: '/dashboard/resultados',icon: '📈', label: 'P&G Resultados', mod: 'resultados' },
    { href: '/dashboard/embudo',   icon: '🔬', label: 'Embudo',          mod: 'resultados' },
    { href: '/dashboard/alertas',  icon: '🚨', label: 'Alertas',         mod: 'alertas' },
  ]},
  // ACTUAR
  { group: 'ACTUAR', items: [
    { href: '/dashboard/formacion',icon: '🎓', label: 'Formación',       mod: 'formacion' },
  ]},
]

const PHVA_COLORS: Record<string, string> = {
  PLANEAR: '#3D8EF0',
  HACER:   '#2DD4A0',
  VERIFICAR: '#F5A623',
  ACTUAR:  '#9B6BFF',
}

interface SidebarProps {
  perfil: Perfil | null
  tiendaNombre: string
}

export default function Sidebar({ perfil, tiendaNombre }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const canAccess = (mod: string) => {
    if (!perfil) return false
    if (perfil.rol === 'superadmin') return true
    return perfil.permisos?.[mod] !== false
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="fixed top-0 left-0 h-full z-50 flex flex-col overflow-y-auto"
           style={{ width: 'var(--sidebar-w)', background: '#080B10', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Brand */}
      <div className="p-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
               style={{ background: '#F5A623', color: '#0A0D14' }}>
            DZ
          </div>
          <div>
            <div className="font-bold text-base leading-none">
              DI<span style={{ color: '#F5A623' }}>Z</span>GO
            </div>
            <div className="text-xs mt-0.5 truncate max-w-[140px]"
                 style={{ color: '#5A6478' }}>
              {tiendaNombre || 'Mi Tienda'}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map(group => (
          <div key={group.group} className="mb-3">
            <div className="px-2 py-1.5 text-[9px] font-bold tracking-widest"
                 style={{ color: PHVA_COLORS[group.group] }}>
              {group.group}
            </div>
            {group.items.map(item => {
              if (!canAccess(item.mod)) return null
              const active = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all"
                      style={{
                        background: active ? 'rgba(245,166,35,0.12)' : 'transparent',
                        color: active ? '#F5A623' : '#8B96A8',
                        borderLeft: active ? '2px solid #F5A623' : '2px solid transparent',
                      }}>
                  <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}

        {/* Superadmin */}
        {perfil?.rol === 'superadmin' && (
          <div className="mb-3">
            <div className="px-2 py-1.5 text-[9px] font-bold tracking-widest" style={{ color: '#F05C5C' }}>
              ADMIN
            </div>
            <Link href="/admin"
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all"
                  style={{ color: '#F05C5C' }}>
              <span className="text-base w-5 text-center">👑</span>
              <span>Panel Admin</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer usuario */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
               style={{ background: '#1E2738', color: '#F5A623' }}>
            {perfil?.nombre?.[0]?.toUpperCase() || perfil?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">
              {perfil?.nombre || perfil?.email}
            </div>
            <div className="text-[10px] capitalize" style={{ color: '#5A6478' }}>
              {perfil?.rol?.replace('_', ' ')}
            </div>
          </div>
        </div>
        <button onClick={handleLogout}
                className="w-full text-xs py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#8B96A8' }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
