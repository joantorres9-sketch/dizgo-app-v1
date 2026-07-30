import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperadmin } from '@/lib/apiAuth'

// Solo informa si cada integración externa tiene sus credenciales configuradas en el
// servidor — nunca devuelve el valor real de ninguna env var.
export async function GET(req: NextRequest) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    whatsapp: !!process.env.META_WHATSAPP_TOKEN && !!process.env.META_PHONE_NUMBER_ID,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    wompi: !!process.env.WOMPI_PRIVATE_KEY,
    claude: !!process.env.ANTHROPIC_API_KEY,
    resend: !!process.env.RESEND_API_KEY,
    facebookPagina: !!process.env.META_ACCESS_TOKEN && !!process.env.META_PAGE_ID,
    metaAds: !!process.env.META_ACCESS_TOKEN && !!process.env.META_AD_ACCOUNT_ID,
  })
}
