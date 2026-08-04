'use client'
import { useRef } from 'react'
import { formatMoneda } from '@/lib/paises'
import { generarPlantilla, parsearArchivo, type ColumnaPlantilla, type ConfigPlantilla, type FilaImportada } from '@/lib/plantillasExcel'

// Primera pieza de UI compartida entre módulos del dashboard — generaliza el ModalPreview
// que ya existía solo en productos/page.tsx, para que Costos, Metas, etc. reutilicen el
// mismo modal de vista previa en vez de reimplementarlo cada uno.

type Tema = { bg: string; card: string; card2: string; accent: string; text: string; muted: string; border: string; green: string; red: string; [k: string]: string }

function getPais(): string {
  if (typeof window === 'undefined') return 'COL'
  return localStorage.getItem('dizgo_pais') || 'COL'
}

function renderValor(valor: unknown, tipo: ColumnaPlantilla['tipo']): string {
  if (valor === undefined || valor === null || valor === '') return '—'
  if (tipo === 'moneda') return formatMoneda(Number(valor), getPais())
  if (tipo === 'porcentaje') return `${valor}%`
  return String(valor)
}

export function CargaMasivaModal<T>({
  filas, columnas, onConfirm, onClose, theme,
}: {
  filas: FilaImportada<T>[]
  columnas: ColumnaPlantilla<T>[]
  onConfirm: () => void
  onClose: () => void
  theme: Tema
}) {
  const T = theme
  const validas = filas.filter((f) => f.valido).length
  const invalidas = filas.length - validas

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '14px', width: 'min(820px,100%)', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: T.text }}>👁️ Vista previa — Carga masiva</div>
            <div style={{ fontSize: '11px', color: T.muted, marginTop: '2px' }}>
              {filas.length} filas · <span style={{ color: T.green }}>{validas} válidas</span> · <span style={{ color: T.red }}>{invalidas} con error</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#060E1C', position: 'sticky', top: 0 }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: T.muted, borderBottom: `1px solid ${T.border}` }}>Fila</th>
                {columnas.map((c) => (
                  <th key={c.key} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: T.muted, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>{c.header}</th>
                ))}
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: T.muted, borderBottom: `1px solid ${T.border}` }}>✓</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.fila} style={{ borderBottom: `1px solid ${T.border}`, background: !f.valido ? `${T.red}08` : 'transparent' }}>
                  <td style={{ padding: '7px 12px', fontSize: '11px', color: T.muted }}>{f.fila}</td>
                  {columnas.map((c) => (
                    <td key={c.key} style={{ padding: '7px 12px', fontSize: '12px', color: f.valido ? T.text : T.red, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {renderValor((f.datos as Record<string, unknown>)[c.key], c.tipo)}
                    </td>
                  ))}
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    {f.valido
                      ? <span style={{ color: T.green }}>✓</span>
                      : <span style={{ color: T.red }} title={f.errores.join(', ')}>✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: '12px', color: T.muted }}>Se importarán solo las {validas} filas válidas</div>
          <button onClick={onClose} style={{ padding: '10px 16px', background: T.card2, border: `1px solid ${T.border}`, borderRadius: '8px', color: T.muted, cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={validas === 0}
            style={{ padding: '10px 20px', background: validas > 0 ? T.accent : T.border, border: 'none', borderRadius: '8px', color: T.card, fontWeight: 700, cursor: validas > 0 ? 'pointer' : 'not-allowed', fontSize: '13px' }}
          >
            ✅ Importar {validas}
          </button>
        </div>
      </div>
    </div>
  )
}

export function BotonesPlantilla<T>({
  config, onArchivoValidado, theme,
}: {
  config: ConfigPlantilla<T>
  onArchivoValidado: (filas: FilaImportada<T>[]) => void
  theme: Tema
}) {
  const T = theme
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const filas = await parsearArchivo(file, config)
      onArchivoValidado(filas)
    } catch (err: any) {
      alert(err.message || 'Error al leer el archivo')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={onFile} />
      <button
        onClick={() => generarPlantilla(config)}
        style={{ padding: '8px 14px', background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', color: T.muted, cursor: 'pointer', fontSize: '12px' }}
      >
        📄 Generar plantilla actualizada
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        style={{ padding: '8px 14px', background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', color: T.muted, cursor: 'pointer', fontSize: '12px' }}
      >
        📤 Cargar Masivamente
      </button>
    </>
  )
}
