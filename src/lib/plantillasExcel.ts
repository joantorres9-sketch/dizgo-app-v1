// Núcleo compartido para "Generar plantilla actualizada" + "Cargar Masivamente" en los
// módulos del dashboard. La plantilla se genera en el momento a partir de la configuración
// de columnas vigente (nunca un archivo estático), así que siempre refleja el módulo actual.

export type TipoCol = 'texto' | 'numero' | 'porcentaje' | 'moneda' | 'fecha' | 'select'

export interface ColumnaPlantilla<T = Record<string, unknown>> {
  key: keyof T & string
  header: string
  tipo: TipoCol
  requerido: boolean
  ayuda: string
  ejemplo: string | number
  opciones?: string[]
  default?: unknown
  parse?: (raw: unknown) => unknown
  validar?: (valor: unknown, fila: Record<string, unknown>) => string | null
}

export interface ConfigPlantilla<T = Record<string, unknown>> {
  moduloKey: string
  nombreHoja: string
  nombreArchivo: string
  columnas: ColumnaPlantilla<T>[]
}

export interface FilaImportada<T = Record<string, unknown>> {
  fila: number
  datos: Partial<T>
  valido: boolean
  errores: string[]
}

function parsePorTipo(raw: unknown, tipo: TipoCol): unknown {
  if (raw === undefined || raw === null || raw === '') return undefined
  const s = String(raw).trim()
  switch (tipo) {
    case 'numero':
      return parseFloat(s.replace(/[^\d.-]/g, '')) || 0
    case 'moneda':
      return parseFloat(s.replace(/[^\d.-]/g, '')) || 0
    case 'porcentaje':
      return parseFloat(s.replace(/[%\s]/g, '')) || 0
    case 'fecha': {
      const iso = /^\d{4}-\d{2}-\d{2}/.exec(s)
      if (iso) return s.slice(0, 10)
      const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
      // Excel a veces entrega fechas como número de serie
      if (typeof raw === 'number') {
        const epoch = new Date(Date.UTC(1899, 11, 30))
        const d = new Date(epoch.getTime() + raw * 86400000)
        return d.toISOString().slice(0, 10)
      }
      return s
    }
    case 'select':
      return s
    default:
      return s
  }
}

export async function generarPlantilla<T>(config: ConfigPlantilla<T>): Promise<void> {
  const XLSX = await import('xlsx')

  const headers = config.columnas.map((c) => c.header)
  const filasEjemplo = [0, 1].map(() => config.columnas.map((c) => c.ejemplo))
  const wsDatos = XLSX.utils.aoa_to_sheet([headers, ...filasEjemplo])

  const instrucciones = [
    ['Campo', 'Obligatorio', 'Tipo', 'Cómo diligenciar', 'Ejemplo'],
    ...config.columnas.map((c) => [
      c.header,
      c.requerido ? 'Sí' : 'No',
      c.tipo === 'select' && c.opciones ? `Uno de: ${c.opciones.join(' / ')}` : c.tipo,
      c.ayuda,
      String(c.ejemplo),
    ]),
    [],
    ['No cambies el texto de los encabezados de la hoja de datos — DIZGO los usa para ubicar cada columna al cargar el archivo.'],
  ]
  const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones)
  wsInstrucciones['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 22 }, { wch: 50 }, { wch: 18 }]
  wsDatos['!cols'] = headers.map(() => ({ wch: 22 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones')
  XLSX.utils.book_append_sheet(wb, wsDatos, config.nombreHoja)

  XLSX.writeFile(wb, config.nombreArchivo)
}

export async function parsearArchivo<T>(file: File, config: ConfigPlantilla<T>): Promise<FilaImportada<T>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)
  const ws = wb.Sheets[config.nombreHoja] || wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
  if (!rows.length) throw new Error('El archivo está vacío')

  const headerRow = (rows[0] as unknown[]).map((h) => String(h ?? '').trim())
  const faltantes = config.columnas.filter((c) => c.requerido && !headerRow.includes(c.header))
  if (faltantes.length) {
    throw new Error(
      `Falta la columna "${faltantes[0].header}" — no edites los encabezados de la plantilla. Descarga la plantilla actualizada si el módulo cambió.`
    )
  }

  const dataRows = rows.slice(1).filter((r) => (r as unknown[]).some((v) => v !== undefined && v !== null && v !== ''))

  return dataRows.map((row, idx) => {
    const r = row as unknown[]
    const datos: Record<string, unknown> = {}
    const errores: string[] = []

    for (const col of config.columnas) {
      const i = headerRow.indexOf(col.header)
      const raw = i >= 0 ? r[i] : undefined
      let valor = col.parse ? col.parse(raw) : parsePorTipo(raw, col.tipo)

      if ((valor === undefined || valor === '') && col.default !== undefined) valor = col.default

      if (col.requerido && (valor === undefined || valor === '')) {
        errores.push(`Falta "${col.header}"`)
      }
      if (col.tipo === 'select' && col.opciones && valor !== undefined && valor !== '' && !col.opciones.includes(String(valor))) {
        errores.push(`"${col.header}" debe ser uno de: ${col.opciones.join(', ')}`)
      }
      const errorValidar = col.validar ? col.validar(valor, datos) : null
      if (errorValidar) errores.push(errorValidar)

      datos[col.key] = valor
    }

    return { fila: idx + 2, datos: datos as Partial<T>, valido: errores.length === 0, errores }
  })
}
