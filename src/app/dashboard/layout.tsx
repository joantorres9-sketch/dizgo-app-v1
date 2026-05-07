'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Perfil } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [tiendaNombre, setTiendaNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/auth/login'); return }
      setPerfil(profile as Perfil)

      if (profile.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('nombre, licencia')
          .eq('id', profile.tenant_id)
          .single()
        if (tenant) {
          setTiendaNombre(tenant.nombre)
          if (tenant.licencia === 'suspendida') {
            router.push('/suspendido')
          }
        }
      }
      setLoading(false)
    }
    loadUser()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0D14' }}>
        <div className="text-center">
          <div className="text-4xl font-bold mb-3">
            DI<span style={{ color: '#F5A623' }}>Z</span>GO
          </div>
          <div className="text-sm pulse-soft" style={{ color: '#5A6478' }}>Cargando tu tienda...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0A0D14' }}>
      <Sidebar perfil={perfil} tiendaNombre={tiendaNombre} />
      <main className="flex-1 min-w-0" style={{ marginLeft: 'var(--sidebar-w)' }}>
        <div className="p-6 fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
