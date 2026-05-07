'use client'
import { useEffect, useState } from 'react'
import { createClient, formatMoney } from '@/lib/supabase'

type KPI = { label: string; value: string; sub: string; color: string; icon: string }
type Alert = { tipo: string; titulo: string; mensaje: string; color: string; icono: string }

export default function DashboardPage() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [moneda, setMoneda]     = useState('COP')
  const [kpis, setKpis]         = useState<KPI[]>([])
  const [alertas, setAlertas]   = useState<Alert[]>([])
  const [stats, setStats]       = useState({
    totalEntradas: 0, totalSalidas: 0, saldoWallet: 0,
    totalPedidos: 0, pedidosEntregados: 0, pedidosCancelados: 0,
    tasaEntrega: 0
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles')
        .select('tenant_id').eq('id', user.id).single()
      if (!profile?.tenant_id) { setLoading(false); return }
      setTenantId(profile.tenant_id)

      const { data: tenant } = await supabase.from('tenants')
        .select('moneda').eq('id', profile.tenant_id).single()
      if (tenant) setMoneda(tenant.moneda)

      // Wallet stats
      const { data: walletData } = await supabase.from('wallet_transacciones')
        .select('tipo, monto').eq('tenant_id', profile.tenant_id)

      let entradas = 0, salidas = 0
      walletData?.forEach(tx => {
        if (tx.tipo === 'ENTRADA') entradas += tx.monto
        else salidas += tx.monto
      })

      // Pedidos stats
      const { data: pedidosData } = await supabase.from('pedidos')
        .select('estado').eq('tenant_id', profile.tenant_id)

      const totPed = pedidosData?.length || 0
      const entregados = pedidosData?.filter(p => p.estado === 'ENTREGADO').length || 0
      const cancelados = pedidosData?.filter(p => p.estado === 'CANCELADO').length || 0
      const tasaE = totPed > 0 ? (entregados / totPed * 100) : 0

      setStats({
        totalEntradas: entradas, totalSalidas: salidas,
        saldoWallet: entradas - salidas,
        totalPedidos: totPed, pedidosEntregados: entregados,
        pedidosCancelados: cancelados, tasaEntrega: tasaE
      })

      // Alertas
      const { data: alertasData } = await supabase.from('alertas')
        .select('*').or(`tenant_id.eq.${profile.tenant_id},tenant_id.is.null`)
        .eq('activa', true).order('created_at', { ascending: false }).limit(5)

      if (alertasData) {
        setAlertas(alertasData.map(a => ({
          tipo: a.tipo, titulo: a.titulo, mensaje: a.mensaje,
          color: a.tipo === 'critico' ? '#F05C5C' : a.tipo === 'atencion' ? '#F5A623' : '#2DD4A0',
          icono: a.icono || '⚠️'
        })))
      }

      setLoading(false)
    }
    load()
  }, [])

  const saldo = stats.saldoWallet
  const color_saldo = saldo >= 0 ? '#2DD4A0' : '#F05C5C'

  const kpiCards: KPI[] = [
    { label: 'Saldo Wallet Dropi', value: formatMoney(saldo, moneda), sub: 'Entradas - Salidas', color: color_saldo, icon: '💳' },
    { label: 'Total Entradas', value: formatMoney(stats.totalEntradas, moneda), sub: 'Ganancias como dropshipper', color: '#2DD4A0', icon: '⬆️' },
    { label: 'Total Salidas', value: formatMoney(stats.totalSalidas, moneda), sub: 'Fletes, publicidad, retiros', color: '#F05C5C', icon: '⬇️' },
    { label: 'Total Pedidos', value: stats.totalPedidos.toLocaleString('es-CO'), sub: 'Registrados en el sistema', color: '#3D8EF0', icon: '📦' },
    { label: 'Pedidos Entregados', value: stats.pedidosEntregados.toLocaleString('es-CO'), sub: `${stats.tasaEntrega.toFixed(1)}% tasa de entrega`, color: '#2DD4A0', icon: '✅' },
    { label: 'Pedidos Cancelados', value: stats.pedidosCancelados.toLocaleString('es-CO'), sub: 'Verificar motivos', color: '#F05C5C', icon: '❌' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm pulse-soft" style={{ color: '#5A6478' }}>Cargando dashboard...</div>
      </div>
    )
  }

  if (!tenantId) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="text-5xl mb-4">🏪</div>
        <h2 className="text-xl font-semibold mb-2">Configura tu tienda</h2>
        <p className="text-sm mb-6" style={{ color: '#8B96A8' }}>
          Tu cuenta aún no tiene una tienda asociada. El administrador debe asignarte a una tienda para comenzar.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', color: '#8B96A8' }}>
          Contacta a tu administrador DIZGO para que active tu acceso.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Di<span style={{ color: '#F5A623' }}>Z</span>GO Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8B96A8' }}>
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/dashboard/wallet"
             className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
             style={{ background: 'rgba(245,166,35,0.1)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.2)' }}>
            📤 Cargar Wallet
          </a>
          <a href="/dashboard/pedidos"
             className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
             style={{ background: '#F5A623', color: '#0A0D14' }}>
            📦 Ver Pedidos
          </a>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={i} className="rounded-2xl p-5 relative overflow-hidden"
               style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="absolute top-0 left-0 w-0.5 h-full rounded-l-2xl"
                 style={{ background: kpi.color }} />
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm" style={{ color: '#8B96A8' }}>{kpi.label}</span>
              <span className="text-xl">{kpi.icon}</span>
            </div>
            <div className="text-2xl font-bold mb-1" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div className="text-xs" style={{ color: '#5A6478' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Estado de datos */}
      {stats.totalPedidos === 0 && stats.totalEntradas === 0 && (
        <div className="rounded-2xl p-8 text-center"
             style={{ background: '#111520', border: '1px dashed rgba(245,166,35,0.3)' }}>
          <div className="text-4xl mb-3">📂</div>
          <h3 className="font-semibold mb-2">Aún no hay datos cargados</h3>
          <p className="text-sm mb-4" style={{ color: '#8B96A8' }}>
            Comienza cargando tu historial de cartera de Dropi o tus pedidos.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/dashboard/wallet"
               className="px-5 py-2.5 rounded-xl text-sm font-semibold"
               style={{ background: '#F5A623', color: '#0A0D14' }}>
              💳 Cargar Wallet Dropi
            </a>
            <a href="/dashboard/pedidos"
               className="px-5 py-2.5 rounded-xl text-sm font-semibold"
               style={{ background: 'rgba(255,255,255,0.05)', color: '#E8EDF5', border: '1px solid rgba(255,255,255,0.1)' }}>
              📦 Cargar Pedidos
            </a>
          </div>
        </div>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>🚨</span> Alertas activas
          </h3>
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                   style={{ background: '#0A0D14', borderLeft: `3px solid ${a.color}` }}>
                <span>{a.icono}</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: a.color }}>{a.titulo}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#8B96A8' }}>{a.mensaje}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accesos rápidos PHVA */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { phase: 'PLANEAR', color: '#3D8EF0', items: ['Costos Fijos', 'Catálogo', 'Precios'], href: '/dashboard/costos' },
          { phase: 'HACER',   color: '#2DD4A0', items: ['Pedidos', 'WhatsApp', 'Wallet'],       href: '/dashboard/pedidos' },
          { phase: 'VERIFICAR', color: '#F5A623', items: ['P&G', 'Embudo', 'Alertas'],          href: '/dashboard/resultados' },
          { phase: 'ACTUAR',  color: '#9B6BFF', items: ['Formación', 'Estrategias'],            href: '/dashboard/formacion' },
        ].map(p => (
          <a key={p.phase} href={p.href}
             className="rounded-xl p-4 transition-all hover:scale-105"
             style={{ background: '#111520', border: `1px solid ${p.color}22`, borderTop: `3px solid ${p.color}` }}>
            <div className="text-xs font-bold mb-2" style={{ color: p.color }}>{p.phase}</div>
            {p.items.map(item => (
              <div key={item} className="text-xs mb-1" style={{ color: '#8B96A8' }}>· {item}</div>
            ))}
          </a>
        ))}
      </div>
    </div>
  )
}
