'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [tiendas, setTiendas] = useState<any[]>([])
  const [users, setUsers]     = useState<any[]>([])
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (p?.rol !== 'superadmin') { router.push('/dashboard'); return }
      const { data: t } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
      if (t) setTiendas(t)
      const { data: u } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (u) setUsers(u)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen p-8" style={{ background: '#0A0D14', color: '#E8EDF5' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
               style={{ background: '#F5A623', color: '#0A0D14' }}>DZ</div>
          <div>
            <h1 className="text-2xl font-bold">Panel Superadmin</h1>
            <p className="text-sm" style={{ color: '#8B96A8' }}>DIZGO · Control total de la plataforma</p>
          </div>
          <a href="/dashboard" className="ml-auto text-sm px-4 py-2 rounded-xl"
             style={{ background: 'rgba(255,255,255,0.05)', color: '#8B96A8' }}>
            ← Volver al dashboard
          </a>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Tiendas activas', value: tiendas.filter(t => t.licencia === 'activa').length, color: '#2DD4A0' },
            { label: 'Total tiendas', value: tiendas.length, color: '#3D8EF0' },
            { label: 'Total usuarios', value: users.length, color: '#F5A623' },
          ].map((k, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-xs mb-2" style={{ color: '#8B96A8' }}>{k.label}</div>
              <div className="text-3xl font-bold" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h2 className="font-semibold">Tiendas registradas</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Nombre','País','Moneda','Licencia','Creada'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#5A6478' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiendas.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs" style={{ color: '#5A6478' }}>Sin tiendas registradas</td></tr>
              ) : tiendas.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td className="px-4 py-3 font-medium">{t.nombre}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8B96A8' }}>{t.pais}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8B96A8' }}>{t.moneda}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            background: t.licencia === 'activa' ? 'rgba(45,212,160,0.1)' : 'rgba(240,92,92,0.1)',
                            color: t.licencia === 'activa' ? '#2DD4A0' : '#F05C5C'
                          }}>
                      {t.licencia}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8B96A8' }}>
                    {new Date(t.created_at).toLocaleDateString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
