import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/apiAuth'
import { enviarMensajeWhatsapp } from '@/lib/metaWhatsapp'
import { generarRespuestaAgente, requiereEscalamiento } from '@/lib/agenteVentas'

// Webhook de WhatsApp Cloud API para el CRM interno de ventas de DIZGO (no para tenants).
// Meta hace este GET una sola vez al configurar la URL del webhook, para verificar que le
// pertenece a quien dice tenerla.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Token de verificación inválido', { status: 403 })
}

function firmaValida(rawBody: string, firma: string | null): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret || !firma) return false
  const esperado = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(firma))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const firma = req.headers.get('x-hub-signature-256')
  if (!firmaValida(rawBody, firma)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let payload: any
  try { payload = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const supabase = getSupabaseAdmin()

  try {
    const value = payload?.entry?.[0]?.changes?.[0]?.value
    const mensajes = value?.messages
    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      // Eventos de "status" (entregado/leído) no traen `messages` -- se ignoran sin error
      return NextResponse.json({ ok: true })
    }

    for (const msg of mensajes) {
      const telefono = String(msg.from)
      const texto: string = msg.text?.body || `[mensaje tipo ${msg.type}]`
      const nombreContacto = value?.contacts?.[0]?.profile?.name || null
      const referral = msg.referral || null

      const { data: leadExistente } = await supabase.from('crm_leads').select('*').eq('whatsapp', telefono).maybeSingle()
      let lead = leadExistente
      if (!lead) {
        const { data: nuevo } = await supabase.from('crm_leads').insert({
          nombre: nombreContacto,
          whatsapp: telefono,
          origen_meta: referral,
          ultimo_mensaje_at: new Date().toISOString(),
        }).select().single()
        lead = nuevo
      } else {
        await supabase.from('crm_leads').update({
          ultimo_mensaje_at: new Date().toISOString(),
          ...(referral && !lead.origen_meta ? { origen_meta: referral } : {}),
          ...(nombreContacto && !lead.nombre ? { nombre: nombreContacto } : {}),
        }).eq('id', lead.id)
      }
      if (!lead) continue

      await supabase.from('crm_mensajes').insert({
        lead_id: lead.id, direccion: 'entrante', texto, generado_por: 'humano', whatsapp_message_id: msg.id,
      })

      if (requiereEscalamiento(texto) && lead.ia_modo_activo) {
        await supabase.from('crm_leads').update({ ia_modo_activo: false }).eq('id', lead.id)
        continue
      }

      if (lead.ia_modo_activo) {
        const respuesta = await generarRespuestaAgente(lead.id, texto)
        if (respuesta) {
          const envio = await enviarMensajeWhatsapp(telefono, respuesta)
          await supabase.from('crm_mensajes').insert({
            lead_id: lead.id, direccion: 'saliente', texto: respuesta, generado_por: 'ia',
            whatsapp_message_id: envio.ok ? envio.messageId : null,
          })
          if (lead.etapa === 'nuevo') await supabase.from('crm_leads').update({ etapa: 'conversando' }).eq('id', lead.id)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error procesando webhook de WhatsApp:', err)
    // Meta reintenta si la respuesta no es 200 -- devolvemos ok igual para evitar reintentos en
    // cascada; el error ya quedó en los logs de Vercel para revisar.
    return NextResponse.json({ ok: true })
  }
}
