'use client'
import { useState, useEffect } from 'react'
import { createClient, formatMoney } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type Tx = {
  dropi_id: number; fecha: string; tipo: string; monto: number;
  monto_previo: number; orden_id: number | null; numero_guia: string | null;
  descripcion: string; concepto_retiro: string | null; categoria: string;
}

function clasificar(tx: any): string {
  const desc = (tx.DESCRIPCIÓN || tx.descripcion || '').toUpperCase()
  const concepto = (tx['CONCEPTO DE RETIRO'] || tx.concepto_retiro || '').toUpperCase()
  if (desc.includes('GANANCIA')) return 'ganancia_dropshipper'
  if (desc.includes('FLETE')) return 'flete'
  if (concepto.includes('PUBLICIDAD') || concepto.includes('FB') || concepto.includes('META')) return 'publicidad'
  if (desc.includes('RETIRO')) return 'retiro'
  return 'otro'
}

export default function WalletPage() {
  const [txs, setTxs]       = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [moneda, setMoneda]   = useState('COP')
  const [filter, setFilter]   = useState('TODO')
  const [uploadMsg, setUploadMsg] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!p?.tenant_id) { setLoading(false); return }
      setTenantId(p.tenant_id)
      const { data: t } = await supabase.from('tenants').select('moneda').eq('id', p.tenant_id).single()
      if (t) setMoneda(t.moneda)
      await fetchTxs(p.tenant_id)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchTxs(tid: string) {
    const { data } = await supabase.from('wallet_transacciones')
      .select('*').eq('tenant_id', tid).order('fecha', { ascending: false }).limit(200)
    if (data) setTxs(data as Tx[])
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    setUploading(true)
    setUploadMsg('Procesando archivo...')

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null })

      let ok = 0, skipped = 0
      const batchId = crypto.randomUUID()

      for (const row of rows) {
        const dropi_id = row['ID'] || row['id']
        if (!dropi_id) continue

        const monto_raw = row['MONTO'] || row['monto'] || 0
        const fecha_str = row['FECHA'] || row['fecha'] || ''

        // Parsear fecha DD-MM-YYYY HH:MM o similar
        let fechaISO = new Date().toISOString()
        try {
          const parts = String(fecha_str).split(' ')
          const dateParts = parts[0].split('-')
          if (dateParts.length === 3) {
            const [d, m, y] = dateParts
            fechaISO = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')} ${parts[1] || '00:00'}`).toISOString()
          }
        } catch(_) {}

        const record = {
          tenant_id:       tenantId,
          dropi_id:        Number(dropi_id),
          fecha:           fechaISO,
          tipo:            row['TIPO'] || row['tipo'] || 'ENTRADA',
          monto:           Math.abs(Number(monto_raw)),
          monto_previo:    Number(row['MONTO PREVIO'] || row['monto_previo'] || 0),
          orden_id:        row['ORDEN ID'] || row['orden_id'] || null,
          numero_guia:     String(row['NUMERO DE GUIA'] || row['numero_guia'] || '').trim() || null,
          descripcion:     row['DESCRIPCIÓN'] || row['descripcion'] || '',
          cuenta:          String(row['CUENTA'] || row['cuenta'] || '') || null,
          concepto_retiro: String(row['CONCEPTO DE RETIRO'] || row['concepto_retiro'] || '') || null,
          categoria:       clasificar(row),
          fuente:          'excel_upload',
          upload_batch_id: batchId,
        }

        const { error } = await supabase.from('wallet_transacciones')
          .upsert(record, { onConflict: 'dropi_id' })
        if (!error) ok++; else skipped++
      }

      await supabase.from('uploads').insert({
        tenant_id: tenantId, tipo: 'wallet_dropi',
        nombre_archivo: file.name, registros_total: rows.length,
        registros_ok: ok, registros_error: skipped, estado: 'completado'
      })

      setUploadMsg(`✅ ${ok} transacciones cargadas · ${skipped} duplicadas omitidas`)
      await fetchTxs(tenantId)
      setUploading(false)
    }
    reader.readAsArrayBuffer(file)
  }

  const filtered = filter === 'TODO' ? txs : txs.filter(t => t.tipo === filter)
  const entradas = txs.filter(t => t.tipo === 'ENTRADA').reduce((a, t) => a + t.monto, 0)
  const salidas  = txs.filter(t => t.tipo === 'SALIDA').reduce((a, t) => a + t.monto, 0)
  const saldo    = entradas - salidas

  const catColors: Record<string, string> = {
    ganancia_dropshipper: '#2DD4A0',
    flete: '#F5A623',
    publicidad: '#9B6BFF',
    retiro: '#F05C5C',
    otro: '#8B96A8',
  }

  if (loading) return <div className="text-center py-16 pulse-soft" style={{ color: '#5A6478' }}>Cargando wallet...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">💳 Wallet Dropi</h1>
          <p className="text-sm mt-1" style={{ color: '#8B96A8' }}>Historial de transacciones · Cargar Excel exportado de Dropi</p>
        </div>
        <label className="cursor-pointer px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
               style={{ background: '#F5A623', color: '#0A0D14' }}>
          📤 Cargar Excel Dropi
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>

      {uploadMsg && (
        <div className="p-3 rounded-xl text-sm" style={{
          background: uploadMsg.startsWith('✅') ? 'rgba(45,212,160,0.1)' : 'rgba(245,166,35,0.1)',
          color: uploadMsg.startsWith('✅') ? '#2DD4A0' : '#F5A623',
          border: `1px solid ${uploadMsg.startsWith('✅') ? 'rgba(45,212,160,0.2)' : 'rgba(245,166,35,0.2)'}`
        }}>
          {uploadMsg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Entradas', value: formatMoney(entradas, moneda), color: '#2DD4A0', icon: '⬆️' },
          { label: 'Total Salidas',  value: formatMoney(salidas, moneda),  color: '#F05C5C', icon: '⬇️' },
          { label: 'Saldo Actual',   value: formatMoney(saldo, moneda),    color: saldo >= 0 ? '#2DD4A0' : '#F05C5C', icon: '💰' },
        ].map((k, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: '#111520', border: `1px solid ${k.color}22`, borderTop: `2px solid ${k.color}` }}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs" style={{ color: '#8B96A8' }}>{k.label}</span>
              <span>{k.icon}</span>
            </div>
            <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs mt-1" style={{ color: '#5A6478' }}>{txs.length} transacciones</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {['TODO', 'ENTRADA', 'SALIDA'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: filter === f ? '#F5A623' : 'rgba(255,255,255,0.04)',
                    color: filter === f ? '#0A0D14' : '#8B96A8',
                  }}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs self-center" style={{ color: '#5A6478' }}>
          {filtered.length} registros
        </span>
      </div>

      {/* Tabla */}
      {txs.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#111520', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div className="text-4xl mb-3">📂</div>
          <h3 className="font-semibold mb-2">Sin datos de wallet</h3>
          <p className="text-sm" style={{ color: '#8B96A8' }}>
            Exporta tu historial de cartera desde Dropi (botón "Descargar en Excel") y cárgalo aquí.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0A0D14', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Fecha','Tipo','Monto','Monto Previo','Descripción','Categoría'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold"
                        style={{ color: '#5A6478' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((tx, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#8B96A8' }}>
                      {new Date(tx.fecha).toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                      <span className="ml-1 text-[10px]" style={{ color: '#5A6478' }}>
                        {new Date(tx.fecha).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              background: tx.tipo === 'ENTRADA' ? 'rgba(45,212,160,0.1)' : 'rgba(240,92,92,0.1)',
                              color: tx.tipo === 'ENTRADA' ? '#2DD4A0' : '#F05C5C',
                            }}>
                        {tx.tipo === 'ENTRADA' ? '↑' : '↓'} {tx.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums"
                        style={{ color: tx.tipo === 'ENTRADA' ? '#2DD4A0' : '#F05C5C' }}>
                      {tx.tipo === 'SALIDA' ? '-' : '+'}{formatMoney(tx.monto, moneda)}
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#8B96A8' }}>
                      {formatMoney(tx.monto_previo || 0, moneda)}
                    </td>
                    <td className="px-4 py-2.5 text-xs max-w-xs truncate" style={{ color: '#8B96A8' }}
                        title={tx.descripcion}>
                      {tx.descripcion}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: `${catColors[tx.categoria] || '#8B96A8'}18`, color: catColors[tx.categoria] || '#8B96A8' }}>
                        {tx.categoria?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <div className="p-3 text-center text-xs" style={{ color: '#5A6478' }}>
              Mostrando 100 de {filtered.length} registros
            </div>
          )}
        </div>
      )}
    </div>
  )
}
