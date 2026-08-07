'use client'
import { useState } from 'react'
import { MODULOS, ACCIONES, ACCION_LABELS, HORARIOS_ACCESO, matrizTodoTrue, matrizTodoFalse, permisoVacio, type MatrizPermisos as TMatriz, type Accion } from '@/lib/modulos'

const T = { bg:'#0D1E35', card:'#111520', card2:'#0A0D14', accent:'#F5A623', blue:'#3D8EF0', green:'#2DD4A0', red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF', text:'#E8EDF5', muted:'#8B96A8', border:'rgba(255,255,255,0.08)' }

// Plantillas rápidas — mejora de UX pedida explícitamente: que conceder permisos sea ágil y dé
// sensación de control (un clic para el caso común, siempre editable después).
const PLANTILLAS: { key: string; label: string; icon: string; build: () => TMatriz }[] = [
  { key: 'solo_lectura', label: 'Solo lectura', icon: '👁️', build: () => {
    const m = matrizTodoFalse()
    for (const mod of MODULOS) m[mod.key].ver = true
    return m
  } },
  { key: 'editor', label: 'Editor completo', icon: '✏️', build: () => {
    const m = matrizTodoTrue()
    for (const mod of MODULOS) m[mod.key].eliminar = false
    return m
  } },
  { key: 'total', label: 'Acceso total', icon: '🔓', build: () => matrizTodoTrue() },
  { key: 'ninguno', label: 'Sin acceso', icon: '🚫', build: () => matrizTodoFalse() },
]

export function MatrizPermisos({
  nombre, permisosIniciales, horarioInicial, notificarInicial, activoInicial, guardando, onGuardar, onCerrar,
}: {
  nombre: string
  permisosIniciales: TMatriz
  horarioInicial: string
  notificarInicial: boolean
  activoInicial: boolean
  guardando: boolean
  onGuardar: (cambios: { permisos: TMatriz; horario_acceso: string; notificar_actividad_inusual: boolean; activo: boolean }) => void
  onCerrar: () => void
}) {
  const [permisos, setPermisos] = useState<TMatriz>(() => {
    // completa módulos que falten en la matriz guardada (ej. si se agregó un módulo nuevo después)
    const base = matrizTodoFalse()
    return { ...base, ...permisosIniciales }
  })
  const [horario, setHorario] = useState(horarioInicial)
  const [notificar, setNotificar] = useState(notificarInicial)
  const [activo, setActivo] = useState(activoInicial)

  const toggleCelda = (modulo: string, accion: Accion) => {
    setPermisos(p => ({ ...p, [modulo]: { ...(p[modulo] || permisoVacio()), [accion]: !p[modulo]?.[accion] } }))
  }
  const toggleColumna = (accion: Accion) => {
    const todosMarcados = MODULOS.every(m => permisos[m.key]?.[accion])
    setPermisos(p => {
      const n = { ...p }
      for (const m of MODULOS) n[m.key] = { ...(n[m.key] || permisoVacio()), [accion]: !todosMarcados }
      return n
    })
  }
  const toggleFila = (modulo: string) => {
    const actual = permisos[modulo] || permisoVacio()
    const todosMarcados = ACCIONES.every(a => actual[a])
    setPermisos(p => ({ ...p, [modulo]: ACCIONES.reduce((acc, a) => ({ ...acc, [a]: !todosMarcados }), {} as TMatriz[string]) }))
  }

  const nModulosVisibles = MODULOS.filter(m => permisos[m.key]?.ver).length
  const nEdicionCompleta = MODULOS.filter(m => permisos[m.key]?.modificar && permisos[m.key]?.agregar).length

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter:'blur(4px)' }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', width:'min(880px,100%)', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:T.text }}>🔐 Permisos — {nombre}</div>
            <div style={{ fontSize:'11px', color:T.muted, marginTop:'2px' }}>
              {nModulosVisibles}/{MODULOS.length} módulos visibles · {nEdicionCompleta} con edición completa
            </div>
          </div>
          <button onClick={onCerrar} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:'18px' }}>✕</button>
        </div>

        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ fontSize:'10.5px', color:T.muted, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.4px' }}>Plantillas rápidas</div>
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
              {MODULOS.map(mod => (
                <tr key={mod.key} style={{ borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
                  <td style={{ padding:'7px 12px', fontSize:'12px', color:T.text, cursor:'pointer' }}
                    onClick={() => toggleFila(mod.key)} title="Marcar/desmarcar todo este módulo">
                    <span style={{ marginRight:'6px' }}>{mod.icon}</span>{mod.label}
                  </td>
                  {ACCIONES.map(a => (
                    <td key={a} style={{ padding:'7px 10px', textAlign:'center' }}>
                      <input type="checkbox" checked={!!permisos[mod.key]?.[a]} onChange={() => toggleCelda(mod.key, a)}
                        style={{ width:'15px', height:'15px', cursor:'pointer', accentColor:T.accent }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

        <div style={{ padding:'14px 20px', borderTop:`1px solid ${T.border}`, display:'flex', gap:'8px', justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onCerrar} disabled={guardando}
            style={{ padding:'10px 16px', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.muted, cursor:'pointer', fontSize:'13px' }}>
            Cancelar
          </button>
          <button onClick={() => onGuardar({ permisos, horario_acceso: horario, notificar_actividad_inusual: notificar, activo })} disabled={guardando}
            style={{ padding:'10px 20px', background:T.accent, border:'none', borderRadius:'8px', color:T.card2, fontWeight:700, cursor: guardando ? 'wait' : 'pointer', fontSize:'13px' }}>
            {guardando ? 'Guardando...' : '✅ Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  )
}
