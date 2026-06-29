'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { group:'PLANEAR', color:'#3D8EF0', items:[
    { href:'/dashboard', icon:'⊞', label:'Inicio' },
    { href:'/dashboard/costos', icon:'📊', label:'Costos Fijos' },
    { href:'/dashboard/productos', icon:'🛍️', label:'Catálogo' },
    { href:'/dashboard/precio', icon:'💡', label:'Precio & Costeo' },
    { href:'/dashboard/inversion', icon:'💰', label:'Inversión' },
    { href:'/dashboard/equilibrio', icon:'⚖️', label:'Punto Equilibrio' },
    { href:'/dashboard/metas', icon:'🎯', label:'Metas' },
  ]},
  { group:'HACER', color:'#2DD4A0', items:[
    { href:'/dashboard/pedidos', icon:'📦', label:'Pedidos' },
    { href:'/dashboard/wallet', icon:'💳', label:'Wallet Dropi' },
  ]},
  { group:'VERIFICAR', color:'#F5A623', items:[
    { href:'/dashboard/pyg', icon:'🏛️', label:'P&G Dashboard' },
    { href:'/dashboard/embudo', icon:'🌀', label:'Embudo' },
    { href:'/dashboard/alertas', icon:'🚨', label:'Alertas' },
  ]},
  { group:'ACTUAR', color:'#9B6BFF', items:[
    { href:'/dashboard/formacion', icon:'🎓', label:'Formación' },
  ]},
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0A0D14', color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>
      <aside style={{ width:'220px', background:'#080B10', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, height:'100vh', overflowY:'auto', flexShrink:0 }}>
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
          {NAV.map(group => (
            <div key={group.group} style={{ marginBottom:'14px' }}>
              <div style={{ padding:'4px 10px 6px', fontSize:'9px', fontWeight:'800', letterSpacing:'1.5px', color:group.color }}>{group.group}</div>
              {group.items.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'8px', marginBottom:'2px', textDecoration:'none', background: active ? `${group.color}15` : 'transparent', borderLeft: active ? `2px solid ${group.color}` : '2px solid transparent', color: active ? group.color : '#8B96A8', fontSize:'13px', fontWeight: active ? '600' : '400' }}>
                    <span style={{ fontSize:'15px', width:'18px', textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:'11px', color:'#5A6478', marginBottom:'8px', textAlign:'center' }}>DIZGO v1.0 · Beta</div>
          <Link href="/auth/login" style={{ display:'block', textAlign:'center', padding:'7px', background:'rgba(255,255,255,0.04)', borderRadius:'8px', color:'#5A6478', textDecoration:'none', fontSize:'12px' }}>Cerrar sesión</Link>
        </div>
      </aside>
      <main style={{ flex:1, marginLeft:'220px', padding:'28px', minWidth:0 }}>{children}</main>
    </div>
  )
}
