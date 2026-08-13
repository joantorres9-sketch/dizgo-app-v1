import { NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'

function emailAjustesHtml(nombres: string, nota: string, linkAjuste: string, origin: string) {
  const notaHtml = nota.replace(/</g, '&lt;').replace(/\n/g, '<br>')
  return `
<div style="background:#0D1E35;padding:32px 16px;font-family:'DM Sans',Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;border-collapse:collapse">
    <tr><td style="text-align:center;padding-bottom:20px">
      <table role="presentation" style="margin:0 auto"><tr>
        <td style="vertical-align:middle"><img src="${origin}/brand/dizgo-icon.png" alt="DIZGO" width="40" height="40" style="border-radius:10px;display:block"></td>
        <td style="padding-left:10px;font-weight:800;font-size:18px;color:#E8EDF5">d<span style="color:#F58720">i</span>zgo</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#081426;border:1px solid #152238;border-radius:14px;padding:28px 26px">
      <p style="color:#E8EDF5;font-size:15px;font-weight:700;margin:0 0 4px">Hola ${nombres || ''},</p>
      <p style="color:#9FB0C8;font-size:13px;line-height:1.6;margin:0 0 18px">
        Revisamos tu solicitud de registro en DIZGO y necesitamos que ajustes lo siguiente antes de poder aprobarla:
      </p>
      <div style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);border-radius:10px;padding:14px 16px;margin-bottom:22px">
        <p style="color:#F5A623;font-size:11px;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.4px">Qué necesitamos que corrijas</p>
        <p style="color:#E8EDF5;font-size:13px;line-height:1.6;margin:0">${notaHtml}</p>
      </div>
      <table role="presentation" width="100%"><tr><td align="center">
        <a href="${linkAjuste}" style="display:inline-block;background:#F58720;color:#081426;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:9px">Corregir mi solicitud →</a>
      </td></tr></table>
      <p style="color:#5A7A9A;font-size:11px;line-height:1.6;margin:20px 0 0;text-align:center">
        Si el botón no funciona, copia y pega este link:<br>
        <a href="${linkAjuste}" style="color:#3D8EF0">${linkAjuste}</a>
      </p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:22px">
      <p style="color:#5A7A9A;font-size:11px;line-height:1.7;margin:0">
        DIZGO — Hallazgo de dinero para tu tienda<br>
        ¿Dudas? Escríbenos a <a href="mailto:joantorres9@gmail.com" style="color:#5A7A9A">joantorres9@gmail.com</a> · +57 320 634 8574<br>
        Recibiste este correo porque hay una solicitud de registro asociada a esta dirección en dizgo.app
      </p>
    </td></tr>
  </table>
</div>`.trim()
}

export async function POST(req: Request) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { solicitudId, nota } = await req.json()
  if (!solicitudId || !nota?.trim()) {
    return NextResponse.json({ error: 'solicitudId y nota son requeridos' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: solicitud, error: solErr } = await supabase.from('solicitudes_registro').select('email_personal, nombres').eq('id', solicitudId).single()
  if (solErr || !solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  await supabase.from('solicitudes_registro').update({ notas_admin: nota }).eq('id', solicitudId)

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, aviso: 'Nota guardada, pero RESEND_API_KEY no está configurada — no se envió correo.' })
  }

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.dizgo.app'
  const linkAjuste = `${origin}/auth/ajustar/${solicitudId}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: solicitud.email_personal,
      subject: 'DIZGO — Necesitamos un ajuste en tu solicitud de registro',
      html: emailAjustesHtml(solicitud.nombres, nota, linkAjuste, origin),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: `La nota se guardó, pero el correo no se pudo enviar: ${data.message || res.statusText}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
