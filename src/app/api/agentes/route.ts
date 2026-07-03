import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prompt, max_tokens } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 })

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' }, { status: 500 })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: max_tokens || 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: JSON.stringify(data) }, { status: res.status })
    }

    const texto = data.content?.[0]?.text || ''
    const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)

    return NextResponse.json({ texto, tokens })
  } catch (err) {
    console.error('Error agente IA:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
