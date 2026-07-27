import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'
import { enviarMensajeWhatsapp } from '@/lib/metaWhatsapp'

// Envío manual de un mensaje de WhatsApp desde el Kanban del CRM de ventas de DIZGO
// (Joan escribiendo directo, cuando ia_modo_activo está apagado o quiere intervenir).
export async function POST(req: NextRequest) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { leadId, texto } = await req.json()
  if (!leadId || !texto) return NextResponse.json({ error: 'Faltan leadId o texto' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: lead } = await supabase.from('crm_leads').select('whatsapp').eq('id', leadId).single()
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  const envio = await enviarMensajeWhatsapp(lead.whatsapp, texto)
  if (!envio.ok) return NextResponse.json({ error: envio.error }, { status: 502 })

  await supabase.from('crm_mensajes').insert({
    lead_id: leadId, direccion: 'saliente', texto, generado_por: 'humano', whatsapp_message_id: envio.messageId,
  })
  await supabase.from('crm_leads').update({ ultimo_mensaje_at: new Date().toISOString() }).eq('id', leadId)

  return NextResponse.json({ ok: true })
}
