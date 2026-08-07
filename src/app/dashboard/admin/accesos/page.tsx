'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MatrizPermisos } from '@/components/MatrizPermisos'
import { matrizTodoFalse, type MatrizPermisos as TMatriz } from '@/lib/modulos'
import { CONFIG_PAIS } from '@/lib/seedDemoTenant'

const T = { bg:'#0D1E35', card:'#111520', card2:'#0A0D14', accent:'#F5A623', blue:'#3D8EF0', green:'#2DD4A0', red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF', text:'#E8EDF5', muted:'#8B96A8', border:'rgba(255,255,255,0.08)' }

type ColabRow = { id: string; nombres: string; apellidos: string; cargo: string | null; email: string | null; correo_personal: string | null }
type ProfileRow = {
  id: string; email: string; nombre: string | null; rol: string; activo: boolean
  es_cortesia: boolean; colaborador_id: string | null; permisos: TMatriz
  horario_acceso: string; notificar_actividad_inusual: boolean; created_at: string
}
type CortesiaRow = {
  id: string; email: string; nombre: string | null; activo: boolean; created_at: string
  tenant: { id: string; nombre: string; plan: string; pais: string; slug: string } | null
}

const TABS = [
  { key: 'colaboradores', label: '🧑‍🤝‍🧑 Permisos de Colaboradores' },
  { key: 'usuarios', label: '📋 Todos los usuarios' },
  { key: 'cortesia', label: '🎁 Usuarios de cortesía' },
] as const

const FORM_CORTESIA_VACIO = { nombres: '', apellidos: '', tipo_doc: 'CC', numero_doc: '', celular: '', email: '', nombre_tienda: '', pais: 'COL' }

export default function AccesosPage() {
  const supabase = createClient()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [miRol, setMiRol] = useState('')
  const [tab, setTab] = useState<typeof TABS[number]['key']>('colaboradores')
  const [colaboradores, setColaboradores] = useState<ColabRow[]>([])
  const [perfiles, setPerfiles] = useState<ProfileRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [creandoAccesoId, setCreandoAccesoId] = useState<string | null>(null)
  const [emailNuevo, setEmailNuevo] = useState('')
  const [perfilEditando, setPerfilEditando] = useState<ProfileRow | null>(null)
  const [guardandoMatriz, setGuardandoMatriz] = useState(false)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  // ── Usuarios de cortesía (solo superadmin) ──
  const [cortesias, setCortesias] = useState<CortesiaRow[]>([])
  const [cargandoCortesias, setCargandoCortesias] = useState(false)
  const [mostrarFormCortesia, setMostrarFormCortesia] = useState(false)
  const [formCortesia, setFormCortesia] = useState(FORM_CORTESIA_VACIO)
  const [creandoCortesia, setCreandoCortesia] = useState(false)

  const cargar = useCallback(async (tid: string) => {
    setCargando(true)
    try {
      const [{ data: cols }, perfilesData] = await Promise.all([
        supabase.from('colaboradores').select('id,nombres,apellidos,cargo,email,correo_personal').eq('tenant_id', tid).eq('activo', true).order('nombres'),
        // profiles solo se puede leer vía ruta con service role — su RLS (profiles_self:
        // auth.uid() = id) filtra un SELECT directo del cliente a una sola fila (la propia).
        authFetch('/api/admin/listar-perfiles', { tenantId: tid }),
      ])
      setColaboradores((cols || []) as ColabRow[])
      const profs = (perfilesData.perfiles || []) as ProfileRow[]
      setPerfiles(profs)
      return profs
    } catch (err: any) {
      setMsg(`⚠️ No se pudieron cargar los usuarios: ${err.message}`)
      return [] as ProfileRow[]
    } finally {
      setCargando(false)
    }
  }, [supabase])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAutorizado(false); setCargando(false); return }
      const { data: profile } = await supabase.from('profiles').select('tenant_id, rol').eq('id', user.id).single()
      if (!profile?.tenant_id || !['owner', 'superadmin'].includes(profile.rol)) { setAutorizado(false); setCargando(false); return }
      setAutorizado(true)
      setTenantId(profile.tenant_id)
      setMiRol(profile.rol)
      await cargar(profile.tenant_id)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function authFetch(url: string, body: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error en la solicitud')
    return data
  }

  const cargarCortesias = useCallback(async () => {
    setCargandoCortesias(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/usuarios-cortesia', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      const data = await res.json()
      if (res.ok) setCortesias(data.usuarios || [])
    } finally { setCargandoCortesias(false) }
  }, [supabase])

  useEffect(() => {
    if (tab === 'cortesia' && miRol === 'superadmin') cargarCortesias()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, miRol])

  async function crearUsuarioCortesia() {
    if (!formCortesia.email.trim()) { alert('El correo es obligatorio'); return }
    setCreandoCortesia(true)
    try {
      const data = await authFetch('/api/admin/crear-usuario-cortesia', formCortesia)
      setMsg(
        data.correoEnviado
          ? `✅ Tenant de cortesía creado y correo enviado a ${formCortesia.email}`
          : `✅ Tenant creado — ${data.avisoCorreo || 'revisa el envío de correo'}. Contraseña temporal: ${data.passwordTemporal}`
      )
      setFormCortesia(FORM_CORTESIA_VACIO)
      setMostrarFormCortesia(false)
      await cargarCortesias()
    } catch (err: any) { alert(err.message) } finally { setCreandoCortesia(false) }
  }

  async function crearAcceso(colab: ColabRow) {
    const email = emailNuevo.trim() || colab.email || colab.correo_personal || ''
    if (!email) { alert('Necesitas un correo para crear el acceso'); return }
    setProcesando(colab.id)
    try {
      const data = await authFetch('/api/admin/crear-acceso-colaborador', { tenantId, colaboradorId: colab.id, email })
      setMsg(data.correoEnviado ? `✅ Acceso creado y correo enviado a ${email}` : `✅ Acceso creado — ${data.avisoCorreo || 'revisa el envío de correo'}`)
      setCreandoAccesoId(null); setEmailNuevo('')
      const nuevosPerfiles = await cargar(tenantId)
      const nuevoPerfil = nuevosPerfiles.find(p => p.id === data.profileId)
      if (nuevoPerfil) setPerfilEditando(nuevoPerfil)
    } catch (err: any) { alert(err.message) } finally { setProcesando(null) }
  }

  async function guardarMatriz(cambios: { permisos: TMatriz; horario_acceso: string; notificar_actividad_inusual: boolean; activo: boolean }) {
    if (!perfilEditando) return
    setGuardandoMatriz(true)
    try {
      await authFetch('/api/admin/actualizar-permisos', { tenantId, profileId: perfilEditando.id, ...cambios })
      setMsg('✅ Permisos actualizados')
      setPerfilEditando(null)
      await cargar(tenantId)
    } catch (err: any) { alert(err.message) } finally { setGuardandoMatriz(false) }
  }

  async function reenviarAcceso(p: ProfileRow) {
    if (!confirm(`¿Generar una nueva contraseña temporal y reenviar el acceso a ${p.email}?`)) return
    setProcesando(p.id)
    try {
      const data = await authFetch('/api/admin/reenviar-acceso', { tenantId, profileId: p.id })
      setMsg(data.correoEnviado ? `✅ Nuevo acceso enviado a ${p.email}` : `⚠️ Contraseña regenerada pero el correo falló: ${data.avisoCorreo}`)
    } catch (err: any) { alert(err.message) } finally { setProcesando(null) }
  }

  if (autorizado === null || cargando) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:T.muted, fontSize:'14px' }}>Cargando...</div>
  }
  if (!autorizado) {
    return <div style={{ padding:'40px', textAlign:'center', color:T.muted }}>No tienes acceso a esta sección.</div>
  }

  const mapaPerfilPorColab = new Map(perfiles.filter(p => p.colaborador_id).map(p => [p.colaborador_id as string, p]))

  return (
    <div style={{ color:T.text, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🔐 Gestión de Accesos</h1>
        <p style={{ fontSize:'13px', color:T.muted }}>Quién puede entrar a tu DIZGO y qué puede hacer en cada módulo</p>
      </div>

      {msg && (
        <div style={{ padding:'10px 14px', background:`${T.green}10`, border:`1px solid ${T.green}30`, borderRadius:'8px', fontSize:'12px', color:T.green, marginBottom:'14px' }}>
          {msg}
        </div>
      )}

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'8px 14px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
              background: tab === t.key ? T.accent : 'rgba(255,255,255,0.05)', color: tab === t.key ? '#0A0D14' : T.muted }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'colaboradores' && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontWeight:700, fontSize:'13px' }}>
            Colaboradores registrados en Nómina
          </div>
          {colaboradores.length === 0 ? (
            <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'12px' }}>
              No hay colaboradores activos en Nómina todavía.
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:T.card2, borderBottom:`1px solid ${T.border}` }}>
                  {['Colaborador', 'Cargo', 'Acceso', 'Acción'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colaboradores.map(c => {
                  const perfil = mapaPerfilPorColab.get(c.id)
                  return (
                    <tr key={c.id} style={{ borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>{c.nombres} {c.apellidos}</td>
                      <td style={{ padding:'10px 12px', color:T.muted }}>{c.cargo || '—'}</td>
                      <td style={{ padding:'10px 12px' }}>
                        {perfil ? (
                          <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:700, background: perfil.activo ? `${T.green}15` : `${T.red}15`, color: perfil.activo ? T.green : T.red }}>
                            {perfil.activo ? '✓ Activo' : '✕ Desactivado'}
                          </span>
                        ) : (
                          <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:700, background:'rgba(255,255,255,0.06)', color:T.muted }}>Sin acceso</span>
                        )}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {perfil ? (
                          <button onClick={() => setPerfilEditando(perfil)}
                            style={{ padding:'6px 12px', background:`${T.accent}15`, border:`1px solid ${T.accent}30`, borderRadius:'6px', color:T.accent, fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
                            🔐 Permisos
                          </button>
                        ) : creandoAccesoId === c.id ? (
                          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                            <input placeholder={c.email || c.correo_personal || 'correo@ejemplo.com'} value={emailNuevo} onChange={e => setEmailNuevo(e.target.value)}
                              style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'6px', color:T.text, padding:'5px 8px', fontSize:'11px', outline:'none', width:'170px' }} />
                            <button onClick={() => crearAcceso(c)} disabled={procesando === c.id}
                              style={{ padding:'6px 10px', background:T.green, border:'none', borderRadius:'6px', color:'#0A0D14', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
                              {procesando === c.id ? '...' : '✓'}
                            </button>
                            <button onClick={() => { setCreandoAccesoId(null); setEmailNuevo('') }}
                              style={{ padding:'6px 10px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:'6px', color:T.muted, fontSize:'11px', cursor:'pointer' }}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setCreandoAccesoId(c.id); setEmailNuevo(c.email || c.correo_personal || '') }}
                            style={{ padding:'6px 12px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'6px', color:T.blue, fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
                            + Crear acceso
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'usuarios' && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontWeight:700, fontSize:'13px' }}>
            Todos los usuarios de este tenant
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead>
              <tr style={{ background:T.card2, borderBottom:`1px solid ${T.border}` }}>
                {['Usuario', 'Rol', 'Tipo', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perfiles.map(p => (
                <tr key={p.id} style={{ borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ fontWeight:600 }}>{p.nombre || '—'}</div>
                    <div style={{ fontSize:'10.5px', color:T.muted }}>{p.email}</div>
                  </td>
                  <td style={{ padding:'10px 12px', color:T.muted, textTransform:'capitalize' }}>{p.rol}</td>
                  <td style={{ padding:'10px 12px' }}>
                    {p.es_cortesia && <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:700, background:`${T.purple}15`, color:T.purple }}>Cortesía</span>}
                    {p.colaborador_id && <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:700, background:`${T.blue}15`, color:T.blue }}>Nómina</span>}
                    {!p.es_cortesia && !p.colaborador_id && p.rol !== 'owner' && p.rol !== 'superadmin' && <span style={{ fontSize:'10px', color:T.muted }}>—</span>}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:700, background: p.activo ? `${T.green}15` : `${T.red}15`, color: p.activo ? T.green : T.red }}>
                      {p.activo ? '✓ Activo' : '✕ Desactivado'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {p.rol === 'colaborador' && (
                        <button onClick={() => setPerfilEditando(p)}
                          style={{ padding:'6px 10px', background:`${T.accent}15`, border:`1px solid ${T.accent}30`, borderRadius:'6px', color:T.accent, fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
                          🔐 Permisos
                        </button>
                      )}
                      {p.rol !== 'owner' && p.rol !== 'superadmin' && (
                        <button onClick={() => reenviarAcceso(p)} disabled={procesando === p.id}
                          style={{ padding:'6px 10px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:'6px', color:T.muted, fontSize:'11px', cursor:'pointer' }}>
                          🔁 Reenviar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cortesia' && (
        miRol !== 'superadmin' ? (
          <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'12px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px' }}>
            Solo un superadmin de DIZGO puede crear usuarios de cortesía.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: mostrarFormCortesia ? '14px' : 0 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:'13px' }}>Crear usuario de cortesía</div>
                  <div style={{ fontSize:'11px', color:T.muted, marginTop:'2px' }}>Un tenant propio, con datos demo pre-cargados y acceso a todos los módulos y países — solo el correo es obligatorio.</div>
                </div>
                <button onClick={() => setMostrarFormCortesia(v => !v)}
                  style={{ padding:'8px 14px', background: mostrarFormCortesia ? T.card2 : T.accent, border: mostrarFormCortesia ? `1px solid ${T.border}` : 'none', borderRadius:'8px', color: mostrarFormCortesia ? T.muted : '#0A0D14', fontWeight:700, fontSize:'12px', cursor:'pointer', flexShrink:0 }}>
                  {mostrarFormCortesia ? 'Cancelar' : '+ Nuevo usuario de cortesía'}
                </button>
              </div>

              {mostrarFormCortesia && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'10px' }}>
                  {([
                    ['nombres', 'Nombres'], ['apellidos', 'Apellidos'], ['numero_doc', 'Número de documento'],
                    ['celular', 'Celular'], ['nombre_tienda', 'Nombre de la tienda de prueba'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <div style={{ fontSize:'10.5px', color:T.muted, marginBottom:'4px' }}>{label}</div>
                      <input value={formCortesia[key]} onChange={e => setFormCortesia(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width:'100%', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.text, padding:'8px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize:'10.5px', color:T.muted, marginBottom:'4px' }}>Tipo de documento</div>
                    <select value={formCortesia.tipo_doc} onChange={e => setFormCortesia(f => ({ ...f, tipo_doc: e.target.value }))}
                      style={{ width:'100%', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.text, padding:'8px 10px', fontSize:'12px', outline:'none' }}>
                      {['CC', 'CE', 'Pasaporte', 'NIT', 'Otro'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:'10.5px', color:T.muted, marginBottom:'4px' }}>País (datos demo)</div>
                    <select value={formCortesia.pais} onChange={e => setFormCortesia(f => ({ ...f, pais: e.target.value }))}
                      style={{ width:'100%', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.text, padding:'8px 10px', fontSize:'12px', outline:'none' }}>
                      {Object.entries(CONFIG_PAIS).map(([code, c]) => <option key={code} value={code}>{c.nombre} ({c.moneda})</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:'10.5px', color:T.red, marginBottom:'4px' }}>Correo * (obligatorio)</div>
                    <input type="email" value={formCortesia.email} onChange={e => setFormCortesia(f => ({ ...f, email: e.target.value }))}
                      style={{ width:'100%', background:T.card2, border:`1.5px solid ${T.red}50`, borderRadius:'8px', color:T.text, padding:'8px 10px', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                  </div>
                  <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', marginTop:'4px' }}>
                    <button onClick={crearUsuarioCortesia} disabled={creandoCortesia}
                      style={{ padding:'10px 20px', background:T.green, border:'none', borderRadius:'8px', color:'#0A0D14', fontWeight:700, fontSize:'13px', cursor: creandoCortesia ? 'wait' : 'pointer' }}>
                      {creandoCortesia ? '⏳ Creando tenant + datos demo...' : '🎁 Crear usuario de cortesía'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontWeight:700, fontSize:'13px' }}>
                Usuarios de cortesía creados
              </div>
              {cargandoCortesias ? (
                <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'12px' }}>Cargando...</div>
              ) : cortesias.length === 0 ? (
                <div style={{ padding:'30px', textAlign:'center', color:T.muted, fontSize:'12px' }}>Todavía no has creado ningún usuario de cortesía.</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                  <thead>
                    <tr style={{ background:T.card2, borderBottom:`1px solid ${T.border}` }}>
                      {['Usuario', 'Tenant', 'País', 'Plan', 'Estado'].map(h => (
                        <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:T.muted, fontWeight:700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cortesias.map(c => (
                      <tr key={c.id} style={{ borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ fontWeight:600 }}>{c.nombre || '—'}</div>
                          <div style={{ fontSize:'10.5px', color:T.muted }}>{c.email}</div>
                        </td>
                        <td style={{ padding:'10px 12px', color:T.muted }}>{c.tenant?.nombre || '—'}</td>
                        <td style={{ padding:'10px 12px', color:T.muted }}>{c.tenant?.pais || '—'}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:700, background: c.tenant?.plan === 'cortesia' ? `${T.purple}15` : `${T.green}15`, color: c.tenant?.plan === 'cortesia' ? T.purple : T.green }}>
                            {c.tenant?.plan === 'cortesia' ? '🎁 Cortesía (demo)' : `✓ ${c.tenant?.plan || 'convertido'}`}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', fontWeight:700, background: c.activo ? `${T.green}15` : `${T.red}15`, color: c.activo ? T.green : T.red }}>
                            {c.activo ? '✓ Activo' : '✕ Desactivado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      )}

      {perfilEditando && (
        <MatrizPermisos
          nombre={perfilEditando.nombre || perfilEditando.email}
          permisosIniciales={perfilEditando.permisos || matrizTodoFalse()}
          horarioInicial={perfilEditando.horario_acceso || 'todos'}
          notificarInicial={perfilEditando.notificar_actividad_inusual}
          activoInicial={perfilEditando.activo}
          guardando={guardandoMatriz}
          onGuardar={guardarMatriz}
          onCerrar={() => setPerfilEditando(null)}
        />
      )}
    </div>
  )
}
