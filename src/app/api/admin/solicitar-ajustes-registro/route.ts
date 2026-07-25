import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/apiAuth'

async function requiereSuperadmin(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false as const, error: 'No autenticado', status: 401 }
  const supabase = getSupabaseAdmin()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { ok: false as const, error: 'Sesión inválida', status: 401 }
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'superadmin') return { ok: false as const, error: 'Solo superadmin puede solicitar ajustes', status: 403 }
  return { ok: true as const }
}

export async function POST(req: Request) {
  const auth = await requiereSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { solicitudId, nota } = await req.json()
  if (!solicitudId || !nota?.trim()) {
    return NextResponse.json({ error: 'solicitudId y nota son requeridos' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: solicitud, error: solErr } = await supabase.from('solicitudes_registro').select('email_personal, nombres').eq('id', solicitudId).single()
  if (solErr || !solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  await supabase.from('solicitudes_registro').update({ notas_admin: nota }).eq('id', solicitudId)

  if (process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: solicitud.email_personal,
        subject: 'DIZGO — Necesitamos un ajuste en tu solicitud',
        html: `<p>Hola ${solicitud.nombres || ''},</p><p>Revisamos tu solicitud de registro y necesitamos que ajustes lo siguiente antes de aprobarla:</p><p style="background:#f5f5f5;padding:12px;border-radius:8px">${nota.replace(/\n/g, '<br>')}</p><p>Responde a este correo o escríbenos a joantorres9@gmail.com con la corrección.</p>`,
      }),
    })
  }

  return NextResponse.json({ ok: true })
}
