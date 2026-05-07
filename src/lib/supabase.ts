import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Perfil = {
  id: string
  tenant_id: string | null
  email: string
  nombre: string | null
  rol: 'superadmin' | 'owner' | 'gestor_pedidos' | 'trafficker' | 'tesorero' | 'logistica' | 'readonly'
  permisos: Record<string, boolean>
  activo: boolean
}

export const formatMoney = (amount: number, moneda: string = 'COP') => {
  if (moneda === 'COP') return '$ ' + Math.round(amount).toLocaleString('es-CO')
  return '$ ' + amount.toFixed(2)
}

export const fmtPct = (n: number) => n.toFixed(1) + '%'
