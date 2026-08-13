'use client'
import { useState, Fragment } from 'react'
import { MODULOS, SUBTABS, ACCIONES, ACCION_LABELS, HORARIOS_ACCESO, matrizTodoTrue, matrizTodoFalse, permisoVacio, todasLasClaves, clavePermiso, type MatrizPermisos as TMatriz, type Accion } from '@/lib/modulos'
import { PAISES } from '@/lib/paises'
import { useTema } from '@/lib/tema'

// Plantillas rápidas — mejora de UX pedida explícitamente: que conceder permisos sea ágil y dé
// sensación de control (un clic para el caso común, siempre editable después). Cubren también las
// filas de sub-pestaña, no solo el módulo.
const PLANTILLAS: { key: string; label: string; icon: string; build: () => TMatriz }[] = [
  { key: 'solo_lectura', label: 'Solo lectura', icon: '👁️', build: () => {
    const m = matrizTodoFalse()
    for (const clave of todasLasClaves()) m[clave].ver = true
    return m
  } },
  { key: 'editor', label: 'Editor completo', icon: '✏️', build: () => {
    const m = matrizTodoTrue()
    for (const clave of todasLasClaves()) m[clave].eliminar = false
    return m
  } },
  { key: 'total', label: 'Acceso total', icon: '🔓', build: () => matrizTodoTrue() },
  { key: 'ninguno', label: 'Sin acceso', icon: '🚫', build: () => matrizTodoFalse() },
]

export function MatrizPermisos({
  nombre, permisosIniciales, horarioInicial, notificarInicial, activoInicial, guardando, onGuardar, onCerrar, modoTenant, paisesIniciales,
}: {
  nombre: string
  permisosIniciales: TMatriz
  horarioInicial?: string
  notificarInicial?: boolean
  activoInicial?: boolean
  guardando: boolean
  onGuardar: (cambios: { permisos: TMatriz; horario_acceso: string; notificar_actividad_inusual: boolean; activo: boolean; paises?: string[] }) => void
  onCerrar: () => void
  // true cuando esta matriz es el TECHO de módulos de un tenant completo (lo edita el superadmin
  // de DIZGO), no la matriz de un colaborador puntual — horario/notificar/activo son conceptos de
  // persona, no de tenant, así que ese bloque del footer se oculta en este modo.
  modoTenant?: boolean
  // Solo aplica con modoTenant — qué países puede operar el tenant. null/undefined = sin
  // restricción (los 11 países), igual que hoy.
  paisesIniciales?: string[] | null
}) {
  const { T } = useTema()
  const [permisos, setPermisos] = useState<TMatriz>(() => {
    // completa módulos que falten en la matriz guardada (ej. si se agregó un módulo nuevo después)
    const base = matrizTodoFalse()
    return { ...base, ...permisosIniciales }
  })
  const [horario, setHorario] = useState(horarioInicial || 'todos')
  const [notificar, setNotificar] = useState(notificarInicial ?? true)
  const [activo, setActivo] = useState(activoInicial ?? true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [paises, setPaises] = useState<string[]>(() => paisesIniciales ?? PAISES.map(p => p.code))
  const togglePais = (code: string) => {
    setPaises(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code])
  }

  const toggleCelda = (clave: string, accion: Accion) => {
    setPermisos(p => ({ ...p, [clave]: { ...(p[clave] || permisoVacio()), [accion]: !p[clave]?.[accion] } }))
  }
  const toggleColumna = (accion: Accion) => {
    const claves = todasLasClaves()
    const todosMarcados = claves.every(c => permisos[c]?.[accion])
    setPermisos(p => {
      const n = { ...p }
      for (const c of claves) n[c] = { ...(n[c] || permisoVacio()), [accion]: !todosMarcados }
      return n
    })
  }
  const toggleFila = (clave: string) => {
    const actual = permisos[clave] || permisoVacio()
    const todosMarcados = ACCIONES.every(a => actual[a])
    setPermisos(p => ({ ...p, [clave]: ACCIONES.reduce((acc, a) => ({ ...acc, [a]: !todosMarcados }), {} as TMatriz[string]) }))
  }
  const toggleExpandido = (moduloKey: string) => {
    setExpandidos(s => {
      const n = new Set(s)
      if (n.has(moduloKey)) n.delete(moduloKey); else n.add(moduloKey)
      return n
    })
  }
  const modulosConSubtabs = MODULOS.filter(m => (SUBTABS[m.key] || []).length > 0)
  const expandirTodo = () => setExpandidos(new Set(modulosConSubtabs.map(m => m.key)))
  const colapsarTodo = () => setExpandidos(new Set())

  const nModulosVisibles = MODULOS.filter(m => permisos[m.key]?.ver).length
  const nEdicionCompleta = MODULOS.filter(m => permisos[m.key]?.modificar && permisos[m.key]?.agregar).length

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter:'blur(4px)' }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', width:'min(880px,100%)', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:T.text }}>{modoTenant ? '🏢 Techo de módulos — ' : '🔐 Permisos — '}{nombre}</div>
            <div style={{ fontSize:'11px', color:T.muted, marginTop:'2px' }}>
              {modoTenant
                ? `${nModulosVisibles}/${MODULOS.length} módulos habilitados para este tenant — si apagas uno aquí, nadie en el tenant lo puede usar, ni siquiera el dueño`
                : `${nModulosVisibles}/${MODULOS.length} módulos visibles · ${nEdicionCompleta} con edición completa`}
            </div>
          </div>
          <button onClick={onCerrar} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:'18px' }}>✕</button>
        </div>

        {modoTenant && (
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
              <div style={{ fontSize:'10.5px', color:T.muted, textTransform:'uppercase', letterSpacing:'.4px' }}>
                Países habilitados ({paises.length}/{PAISES.length})
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={() => setPaises(PAISES.map(p => p.code))} style={{ background:'none', border:'none', color:T.blue, fontSize:'11px', cursor:'pointer', fontWeight:600 }}>Todos</button>
                <button onClick={() => setPaises([])} style={{ background:'none', border:'none', color:T.muted, fontSize:'11px', cursor:'pointer', fontWeight:600 }}>Ninguno</button>
              </div>
            </div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {PAISES.map(p => {
                const activo = paises.includes(p.code)
                return (
                  <button key={p.code} onClick={() => togglePais(p.code)}
                    style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 10px', background: activo ? `${T.green}15` : T.card2, border:`1px solid ${activo ? T.green + '40' : T.border}`, borderRadius:'8px', color: activo ? T.green : T.muted, fontSize:'11px', fontWeight:600, cursor:'pointer' }}>
                    <img src={p.flag} alt="" style={{ width:'14px', height:'10px', objectFit:'cover', borderRadius:'2px' }} />
                    {p.nombre}
                  </button>
                )
              })}
            </div>
            {paises.length === 0 && (
              <div style={{ marginTop:'8px', fontSize:'11px', color:T.red }}>⚠️ Sin ningún país habilitado, nadie en este tenant puede operar — probablemente no es lo que quieres.</div>
            )}
          </div>
        )}

        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
            <div style={{ fontSize:'10.5px', color:T.muted, textTransform:'uppercase', letterSpacing:'.4px' }}>Plantillas rápidas</div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={expandirTodo} style={{ background:'none', border:'none', color:T.blue, fontSize:'11px', cursor:'pointer', fontWeight:600 }}>▾ Expandir sub-pestañas</button>
              <button onClick={colapsarTodo} style={{ background:'none', border:'none', color:T.muted, fontSize:'11px', cursor:'pointer', fontWeight:600 }}>▸ Colapsar</button>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {PLANTILLAS.map(pl => (
              <button key={pl.key} onClick={() => setPermisos(pl.build())}
                style={{ padding:'7px 14px', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.text, fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
                {pl.icon} {pl.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowY:'auto', flex:1 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:T.card2, position:'sticky', top:0 }}>
                <th style={{ padding:'8px 12px', textAlign:'left', fontSize:'11px', color:T.muted, borderBottom:`1px solid ${T.border}` }}>Módulo</th>
                {ACCIONES.map(a => (
                  <th key={a} style={{ padding:'8px 10px', textAlign:'center', fontSize:'10.5px', color:T.muted, borderBottom:`1px solid ${T.border}`, cursor:'pointer', whiteSpace:'nowrap' }}
                    onClick={() => toggleColumna(a)} title={`Marcar/desmarcar "${ACCION_LABELS[a]}" en todos los módulos`}>
                    {ACCION_LABELS[a].replace('Puede ', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULOS.map(mod => {
                const subtabs = SUBTABS[mod.key] || []
                const tieneSubtabs = subtabs.length > 0
                const expandido = expandidos.has(mod.key)
                return (
                  <Fragment key={mod.key}>
                    <tr style={{ borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
                      <td style={{ padding:'7px 12px', fontSize:'12px', color:T.text, cursor:'pointer' }}
                        onClick={() => toggleFila(mod.key)} title="Marcar/desmarcar todo este módulo">
                        {tieneSubtabs && (
                          <button onClick={e => { e.stopPropagation(); toggleExpandido(mod.key) }}
                            style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:'10px', width:'16px', display:'inline-block' }}
                            title={expandido ? 'Colapsar sub-pestañas' : `Ver ${subtabs.length} sub-pestañas`}>
                            {expandido ? '▾' : '▸'}
                          </button>
                        )}
                        <span style={{ marginRight:'6px' }}>{mod.icon}</span>{mod.label}
                        {tieneSubtabs && <span style={{ marginLeft:'6px', fontSize:'10px', color:T.muted }}>({subtabs.length})</span>}
                      </td>
                      {ACCIONES.map(a => (
                        <td key={a} style={{ padding:'7px 10px', textAlign:'center' }}>
                          <input type="checkbox" checked={!!permisos[mod.key]?.[a]} onChange={() => toggleCelda(mod.key, a)}
                            style={{ width:'15px', height:'15px', cursor:'pointer', accentColor:T.accent }} />
                        </td>
                      ))}
                    </tr>
                    {tieneSubtabs && expandido && subtabs.map(sub => {
                      const clave = clavePermiso(mod.key, sub.key)
                      return (
                        <tr key={clave} style={{ borderBottom:`1px solid rgba(255,255,255,0.03)`, background:'rgba(255,255,255,0.015)' }}>
                          <td style={{ padding:'6px 12px 6px 34px', fontSize:'11px', color:T.muted, cursor:'pointer' }}
                            onClick={() => toggleFila(clave)} title="Marcar/desmarcar esta sub-pestaña">
                            {sub.label}
                          </td>
                          {ACCIONES.map(a => (
                            <td key={a} style={{ padding:'6px 10px', textAlign:'center' }}>
                              <input type="checkbox" checked={!!permisos[clave]?.[a]} onChange={() => toggleCelda(clave, a)}
                                style={{ width:'13px', height:'13px', cursor:'pointer', accentColor:T.blue }} />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {!modoTenant && (
          <div style={{ padding:'14px 20px', borderTop:`1px solid ${T.border}`, display:'flex', flexWrap:'wrap', gap:'14px', alignItems:'center', flexShrink:0 }}>
            <div style={{ flex:'1 1 220px' }}>
              <div style={{ fontSize:'10.5px', color:T.muted, marginBottom:'4px' }}>Horario de acceso</div>
              <select value={horario} onChange={e => setHorario(e.target.value)}
                style={{ width:'100%', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.text, padding:'7px 10px', fontSize:'12px', outline:'none' }}>
                {HORARIOS_ACCESO.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:T.text, cursor:'pointer' }}>
              <input type="checkbox" checked={notificar} onChange={e => setNotificar(e.target.checked)} style={{ width:'15px', height:'15px', accentColor:T.accent }} />
              🔔 Notificar actividad inusual
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:activo ? T.text : T.red, cursor:'pointer' }}>
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} style={{ width:'15px', height:'15px', accentColor:T.green }} />
              {activo ? '✅ Usuario activo' : '🚫 Usuario desactivado (sin acceso)'}
            </label>
          </div>
        )}

        <div style={{ padding:'14px 20px', borderTop:`1px solid ${T.border}`, display:'flex', gap:'8px', justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onCerrar} disabled={guardando}
            style={{ padding:'10px 16px', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.muted, cursor:'pointer', fontSize:'13px' }}>
            Cancelar
          </button>
          <button onClick={() => onGuardar({ permisos, horario_acceso: horario, notificar_actividad_inusual: notificar, activo, ...(modoTenant ? { paises } : {}) })} disabled={guardando}
            style={{ padding:'10px 20px', background:T.accent, border:'none', borderRadius:'8px', color:T.card2, fontWeight:700, cursor: guardando ? 'wait' : 'pointer', fontSize:'13px' }}>
            {guardando ? 'Guardando...' : '✅ Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  )
}
