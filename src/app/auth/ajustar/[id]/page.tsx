'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTema } from '@/lib/tema'

const upfile: React.CSSProperties = { width:'100%', background:'#0A1628', border:`1.5px dashed #1E3050`, borderRadius:'8px', padding:'12px 10px', fontSize:'11px', color:'#5A7A9A', textAlign:'center', cursor:'pointer', boxSizing:'border-box' }

const DOC_LABELS: Record<string, string> = { id_a: 'Identidad — Lado A', id_b: 'Identidad — Lado B', doc_legal: 'Documento legal de la tienda' }

export default function AjustarSolicitudPage() {
  const { T } = useTema()
  const params = useParams()
  const id = String(params.id || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [datos, setDatos] = useState<{ nombres: string; nombre_tienda: string; notas_admin: string | null } | null>(null)
  const [archivos, setArchivos] = useState<Record<string, File | null>>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    fetch(`/api/registro/ajustar/${id}`).then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setError(data.error || 'No se pudo cargar la solicitud'); return }
        setDatos(data)
      })
      .catch(() => setError('No se pudo cargar la solicitud'))
      .finally(() => setLoading(false))
  }, [id])

  async function enviarAjustes(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      const form = new FormData()
      Object.entries(archivos).forEach(([k, f]) => { if (f) form.set(k, f) })
      const res = await fetch(`/api/registro/ajustar/${id}`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar los ajustes')
      setEnviado(true)
    } catch (err: any) {
      setError(err.message || 'Error al enviar los ajustes')
    } finally { setEnviando(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ width:'min(480px, calc(100vw - 32px))' }}>
        <div style={{ textAlign:'center', marginBottom:'20px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/dizgo-icon.png" alt="DIZGO" width={44} height={44} style={{ borderRadius:'12px', margin:'0 auto 10px', display:'block' }} />
          <div style={{ fontWeight:'800', fontSize:'18px', color: T.text }}>d<span style={{ color: T.accent }}>i</span>zgo</div>
          <div style={{ fontSize:'11px', color: T.muted }}>Ajustar solicitud de registro</div>
        </div>

        <div style={{ background: T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'22px 24px' }}>
          {loading ? (
            <div style={{ textAlign:'center', color: T.muted, fontSize:'13px', padding:'20px 0' }}>Cargando...</div>
          ) : enviado ? (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>✅</div>
              <div style={{ fontSize:'15px', fontWeight:'700', color: T.text, marginBottom:'6px' }}>¡Ajustes enviados!</div>
              <div style={{ fontSize:'12px', color: T.muted, lineHeight:1.6 }}>DIZGO revisará tu solicitud de nuevo en 1-2 días hábiles.</div>
            </div>
          ) : error && !datos ? (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>⚠️</div>
              <div style={{ fontSize:'13px', color: T.red }}>{error}</div>
            </div>
          ) : datos && (
            <form onSubmit={enviarAjustes}>
              <div style={{ fontSize:'14px', fontWeight:'700', color: T.text, marginBottom:'4px' }}>Hola {datos.nombres?.split(' ')[0] || ''} 👋</div>
              <div style={{ fontSize:'12px', color: T.muted, marginBottom:'16px' }}>Solicitud de <strong style={{ color: T.text }}>{datos.nombre_tienda}</strong></div>

              {datos.notas_admin && (
                <div style={{ background:`${T.yellow}12`, border:`1px solid ${T.yellow}30`, borderRadius:'10px', padding:'12px 14px', marginBottom:'18px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'700', color: T.yellow, marginBottom:'4px' }}>DIZGO te pide ajustar:</div>
                  <div style={{ fontSize:'12.5px', color: T.text, lineHeight:1.6 }}>{datos.notas_admin}</div>
                </div>
              )}

              <div style={{ fontSize:'11px', color: T.muted, marginBottom:'10px' }}>Sube de nuevo solo los documentos que necesites corregir — deja el resto vacío.</div>

              {Object.entries(DOC_LABELS).map(([key, label]) => (
                <div key={key} style={{ marginBottom:'10px' }}>
                  <label style={{ fontSize:'11px', color: T.muted, marginBottom:'4px', display:'block' }}>{label}</label>
                  <label style={{ ...upfile, display:'block', ...(archivos[key] ? { borderColor: T.green, borderStyle:'solid', color: T.green } : {}) }}>
                    {archivos[key] ? `✓ ${archivos[key]!.name}` : '+ Subir PDF nuevo · máx. 5 MB'}
                    <input type="file" accept="application/pdf" style={{ display:'none' }}
                      onChange={e => setArchivos(a => ({ ...a, [key]: e.target.files?.[0] || null }))} />
                  </label>
                </div>
              ))}

              {error && (
                <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'9px 12px', fontSize:'12px', color: T.red, margin:'10px 0' }}>{error}</div>
              )}

              <button type="submit" disabled={enviando}
                style={{ width:'100%', background: T.accent, border:'none', borderRadius:'9px', padding:'12px', fontSize:'14px', fontWeight:'700', color: T.card, cursor: enviando ? 'wait' : 'pointer', opacity: enviando ? 0.7 : 1, marginTop:'8px' }}>
                {enviando ? 'Enviando...' : '✉ Enviar ajustes'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign:'center', marginTop:'14px', fontSize:'11px', color: T.muted }}>
          ¿Dudas? Escríbenos a <a href="mailto:joantorres9@gmail.com" style={{ color: T.accent }}>joantorres9@gmail.com</a>
        </div>
        <div style={{ textAlign:'center', marginTop:'8px' }}>
          <Link href="/auth/login" style={{ fontSize:'11px', color: T.muted, textDecoration:'underline' }}>Volver al login</Link>
        </div>
      </div>
    </div>
  )
}
