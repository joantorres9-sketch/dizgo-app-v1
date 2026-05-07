'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'radial-gradient(ellipse at 30% 50%, #161C2E 0%, #0A0D14 70%)' }}>

      {/* Glow decorativo */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl"
           style={{ background: '#F5A623' }} />

      <div className="relative w-full max-w-md fade-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl"
                 style={{ background: '#F5A623', color: '#0A0D14' }}>
              DZ
            </div>
            <div className="text-left">
              <div className="text-3xl font-bold tracking-tight">
                DI<span style={{ color: '#F5A623' }}>Z</span>GO
              </div>
              <div className="text-xs" style={{ color: '#5A6478' }}>
                Hallazgo de dinero
              </div>
            </div>
          </div>
          <p className="text-sm" style={{ color: '#8B96A8' }}>
            Gestión financiera para e-commerce en LATAM
          </p>
        </div>

        {/* Card de login */}
        <div className="rounded-2xl p-8 border"
             style={{ background: '#111520', borderColor: 'rgba(255,255,255,0.07)' }}>

          <h2 className="text-xl font-semibold mb-1">Iniciar sesión</h2>
          <p className="text-sm mb-6" style={{ color: '#8B96A8' }}>
            Ingresa tus datos para acceder a tu tienda
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm"
                 style={{ background: 'rgba(240,92,92,0.1)', color: '#F05C5C', border: '1px solid rgba(240,92,92,0.2)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B96A8' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@tienda.com"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: '#161C2E',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#E8EDF5',
                }}
                onFocus={e => e.target.style.borderColor = '#F5A623'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B96A8' }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all pr-12"
                  style={{
                    background: '#161C2E',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#E8EDF5',
                  }}
                  onFocus={e => e.target.style.borderColor = '#F5A623'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lg"
                  style={{ color: '#5A6478' }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all mt-2"
              style={{
                background: loading ? '#8B6D1A' : '#F5A623',
                color: '#0A0D14',
                opacity: loading ? 0.7 : 1,
              }}>
              {loading ? '⏳ Ingresando...' : 'Ingresar a DIZGO'}
            </button>
          </form>

          <div className="mt-6 pt-4 text-center text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#5A6478' }}>
            ¿Problemas para ingresar? Contacta al administrador de tu tienda.
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#5A6478' }}>
          DIZGO v1.0 · Colombia · Ecuador · México
        </p>
      </div>
    </div>
  )
}
