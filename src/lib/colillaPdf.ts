import { jsPDF } from 'jspdf'

export interface LineaColilla { concepto: string; valor: number }

export interface DatosColilla {
  empresaNombre: string
  empresaNit: string | null
  colaboradorNombre: string
  colaboradorDoc: string
  cargo: string
  periodo: string
  esquema: 'mensual' | 'quincenal'
  devengado: LineaColilla[]
  totalDevengado: number
  deducciones: LineaColilla[]
  totalDeducciones: number
  neto: number
  banco: string
  tipoCuenta: string
  numCuenta: string
  moneda: string
}

function formatMoneda(v: number, moneda: string) {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda || 'COP', minimumFractionDigits: 0 }).format(v)
  } catch {
    return `$${Math.round(v).toLocaleString('es-CO')}`
  }
}

function enmascararCuenta(num: string): string {
  if (!num) return '—'
  const limpio = num.replace(/\s/g, '')
  if (limpio.length <= 4) return limpio
  return `${'*'.repeat(limpio.length - 4)}${limpio.slice(-4)}`
}

// Estructura fija exacta pedida en el documento de mejoras del módulo de nómina: encabezado
// (empresa, NIT, colaborador, cargo, periodo), Devengados, Deducciones, Neto a pagar, datos de
// pago. Se genera SIEMPRE desde un `DatosColilla` ya calculado por calcularLiquidacion — nunca
// recalcula nada por su cuenta, para que la colilla nunca pueda divergir del cálculo aprobado.
export function construirColillaPDF(d: DatosColilla): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const left = 48
  let y = 56

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(d.empresaNombre || 'Empresa', left, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  y += 16
  doc.text(`NIT: ${d.empresaNit || 'No registrado'}`, left, y)
  y += 22

  doc.setDrawColor(200)
  doc.line(left, y, 564, y)
  y += 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('COMPROBANTE DE PAGO DE NÓMINA', left, y)
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Colaborador: ${d.colaboradorNombre}`, left, y); y += 14
  doc.text(`Documento: ${d.colaboradorDoc}`, left, y); y += 14
  doc.text(`Cargo: ${d.cargo}`, left, y); y += 14
  doc.text(`Periodo: ${d.periodo} (${d.esquema === 'quincenal' ? 'quincenal' : 'mensual'})`, left, y); y += 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('DEVENGADO', left, y); y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const l of d.devengado) {
    doc.text(l.concepto, left, y)
    doc.text(formatMoneda(l.valor, d.moneda), 564, y, { align: 'right' })
    y += 14
  }
  doc.setFont('helvetica', 'bold')
  doc.text('Total devengado', left, y)
  doc.text(formatMoneda(d.totalDevengado, d.moneda), 564, y, { align: 'right' })
  y += 24

  doc.setFontSize(11)
  doc.text('DEDUCCIONES', left, y); y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  if (d.deducciones.length === 0) { doc.text('Sin deducciones', left, y); y += 14 }
  for (const l of d.deducciones) {
    doc.text(l.concepto, left, y)
    doc.text(`-${formatMoneda(l.valor, d.moneda)}`, 564, y, { align: 'right' })
    y += 14
  }
  doc.setFont('helvetica', 'bold')
  doc.text('Total deducciones', left, y)
  doc.text(`-${formatMoneda(d.totalDeducciones, d.moneda)}`, 564, y, { align: 'right' })
  y += 28

  doc.setDrawColor(0)
  doc.line(left, y, 564, y)
  y += 18
  doc.setFontSize(13)
  doc.text('NETO A PAGAR', left, y)
  doc.text(formatMoneda(d.neto, d.moneda), 564, y, { align: 'right' })
  y += 32

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('DATOS DE PAGO', left, y); y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Banco: ${d.banco || '—'}`, left, y); y += 14
  doc.text(`Tipo de cuenta: ${d.tipoCuenta || '—'}`, left, y); y += 14
  doc.text(`Número de cuenta: ${enmascararCuenta(d.numCuenta)}`, left, y); y += 14

  return doc
}
