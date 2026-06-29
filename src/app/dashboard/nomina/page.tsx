'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── TEMA ──────────────────────────────────────────────────
const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238',
}

// ── TIPOS ─────────────────────────────────────────────────
interface Colaborador {
  id: string; tenant_id: string; nombres: string; apellidos: string
  tipo_doc: string; num_doc: string; foto_url: string
  fecha_nacimiento: string; genero: string; estado_civil: string
  tiene_conyuge: boolean; datos_conyuge: Record<string, string>
  tiene_hijos: boolean; datos_hijos: Array<Record<string, string>>
  pais_code: string; departamento: string; ciudad: string
  direccion: string; codigo_tel: string; celular: string; email: string
  contacto_emergencia: Record<string, string>
  nivel_formacion: string; cargo: string; proceso_id: string
  tipo_contrato: string; fecha_ingreso: string; fecha_fin: string
  jornada: string; lugar_ejecucion: string; sede: string
  salario_base: number; aux_transporte: number; tipo_salario: string
  nivel_arl: number; es_pensionado: boolean; aplica_ley1607: boolean
  tipo_cotizante: string; eps: string; pension: string; arl: string
  caja_comp: string; cesantias: string; banco: string
  tipo_cuenta: string; num_cuenta: string
  docs_urls: Record<string, string>; activo: boolean
  carga_total_mes: number
}
interface Proceso {
  id: string; nombre: string; descripcion: string; orden: number; activo: boolean
}
interface TasaHistorico {
  id: string; pais_code: string; anio_fiscal: number
  vigencia_inicio: string; vigencia_fin: string; estado: string
  salario_minimo: number; aux_transporte: number
  salud_emp: number; pension_emp: number
  arl_nivel1: number; arl_nivel2: number; arl_nivel3: number
  arl_nivel4: number; arl_nivel5: number
  sena: number; icbf: number; caja_comp: number
  cesantias: number; intereses_ces: number; prima: number; vacaciones: number
  salud_trab: number; pension_trab: number; tope_exoneracion: number
}

// ── CONSTANTES POR PAÍS ───────────────────────────────────
const PAISES_CONFIG: Record<string, {
  nombre: string; moneda: string; doc_id: string
  entidades: { eps: string[]; pension: string[]; arl: string[]; banco: string[] }
  niveles_formacion: string[]
  semanas_mat: number; dias_pat: number; dias_luto: number
}> = {
  COL: {
    nombre: 'Colombia', moneda: 'COP', doc_id: 'CC/CE',
    entidades: {
      eps: ['Sura','Compensar','Nueva EPS','Sanitas','Coomeva','Famisanar','Salud Total','Coosalud'],
      pension: ['Protección','Porvenir','Colfondos','Colpensiones','Skandia'],
      arl: ['Sura','Positiva','Colmena','Bolívar','Liberty'],
      banco: ['Bancolombia','Davivienda','Banco de Bogotá','BBVA','Nequi','Daviplata','Banco Agrario'],
    },
    niveles_formacion: ['Primaria','Bachillerato','Técnico','Tecnólogo','Profesional','Especialización','Maestría','Doctorado'],
    semanas_mat: 18, dias_pat: 14, dias_luto: 5,
  },
  ECU: {
    nombre: 'Ecuador', moneda: 'USD', doc_id: 'CI',
    entidades: {
      eps: ['IESS','Salud S.A.','Humana','Colonial'],
      pension: ['IESS Pensión'],
      arl: ['IESS Riesgos del Trabajo'],
      banco: ['Banco Pichincha','Produbanco','Banco Guayaquil','Banco del Pacífico','Banco Internacional'],
    },
    niveles_formacion: ['Primaria','Secundaria','Bachillerato','Técnico','Tecnólogo','Tercer Nivel','Cuarto Nivel'],
    semanas_mat: 12, dias_pat: 10, dias_luto: 3,
  },
  MEX: {
    nombre: 'México', moneda: 'MXN', doc_id: 'CURP',
    entidades: {
      eps: ['IMSS','ISSSTE'],
      pension: ['AFORE XXI Banorte','AFORE SURA','Profuturo','Citibanamex AFORE'],
      arl: ['IMSS RT'],
      banco: ['BBVA México','Santander','Banorte','HSBC','Scotiabank'],
    },
    niveles_formacion: ['Primaria','Secundaria','Preparatoria','Técnico','Licenciatura','Especialidad','Maestría','Doctorado'],
    semanas_mat: 12, dias_pat: 5, dias_luto: 3,
  },
  PER: {
    nombre: 'Perú', moneda: 'PEN', doc_id: 'DNI',
    entidades: {
      eps: ['EsSalud','Pacífico Salud','Rímac'],
      pension: ['ONP','AFP Integra','Prima AFP','Habitat','Profuturo'],
      arl: ['La Positiva','Rímac','MAPFRE'],
      banco: ['BCP','Scotiabank','BBVA Perú','Interbank','BanBif'],
    },
    niveles_formacion: ['Primaria','Secundaria','Técnico','Universitario','Posgrado'],
    semanas_mat: 14, dias_pat: 10, dias_luto: 5,
  },
}
const PAIS_DEFAULT = PAISES_CONFIG.COL

const TIPOS_NOVEDAD = [
  { cat: 'A. Incapacidades y Licencias', items: [
    { v:'inc_enfermedad',   l:'Incapacidad Enfermedad Común',      campos:['fecha_inicio','fecha_fin','dias','radicado'] },
    { v:'inc_at',           l:'Incapacidad Accidente Trabajo/EL',  campos:['fecha_inicio','fecha_fin','dias','radicado'] },
    { v:'lic_maternidad',   l:'Licencia Maternidad',               campos:['fecha_inicio','fecha_fin','dias'] },
    { v:'lic_paternidad',   l:'Licencia Paternidad',               campos:['fecha_inicio','fecha_fin','dias'] },
    { v:'lic_luto',         l:'Licencia por Luto (5 días hábiles)',campos:['fecha_inicio'] },
    { v:'lic_calamidad',    l:'Licencia Grave Calamidad',          campos:['fecha_inicio','fecha_fin','dias','descripcion'] },
    { v:'lic_remunerada',   l:'Licencia Remunerada',               campos:['fecha_inicio','fecha_fin','dias','descripcion'] },
    { v:'lic_no_remun',     l:'Licencia NO Remunerada',            campos:['fecha_inicio','fecha_fin','dias'] },
  ]},
  { cat: 'B. Disciplinarias', items: [
    { v:'suspension',       l:'Suspensión Disciplinaria',          campos:['fecha_inicio','dias','descripcion'] },
    { v:'sancion_impunt',   l:'Sanción por Impuntualidad',         campos:['fecha','valor','descripcion'] },
  ]},
  { cat: 'C. Descuentos', items: [
    { v:'prestamo',         l:'Préstamo Empresa',                  campos:['monto_total','valor_cuota','num_cuota'] },
    { v:'deduccion_daños',  l:'Deducción por Daños/Pérdidas',      campos:['valor','descripcion'] },
    { v:'anticipo',         l:'Anticipo de Nómina',                campos:['valor'] },
    { v:'libranza',         l:'Libranza Entidad Externa',          campos:['valor','entidad','descripcion'] },
    { v:'embargo',          l:'Embargo Judicial',                  campos:['valor','descripcion'] },
  ]},
  { cat: 'D. Adiciones y Devengos', items: [
    { v:'he_diurna',        l:'Hora Extra Diurna (+25%)',          campos:['cantidad_horas'] },
    { v:'he_nocturna',      l:'Hora Extra Nocturna (+75%)',        campos:['cantidad_horas'] },
    { v:'he_dom_diurna',    l:'HE Dominical Diurna (+100%)',       campos:['cantidad_horas'] },
    { v:'he_dom_nocturna',  l:'HE Dominical Nocturna (+150%)',     campos:['cantidad_horas'] },
    { v:'recargo_noc',      l:'Recargo Nocturno (+35%)',           campos:['cantidad_horas'] },
    { v:'recargo_dom',      l:'Recargo Dominical/Festivo (+75%)',  campos:['cantidad_horas'] },
    { v:'bonif_habitual',   l:'Bonificación Habitual (suma SS)',   campos:['valor'] },
    { v:'bonif_no_hab',     l:'Bonificación NO Habitual',         campos:['valor'] },
    { v:'comision',         l:'Comisiones por Ventas',             campos:['valor'] },
    { v:'aux_rodamiento',   l:'Auxilio de Rodamiento/Herramientas',campos:['valor'] },
  ]},
]

const TASAS_COL_2025: Partial<TasaHistorico> = {
  pais_code:'COL', anio_fiscal:2025, estado:'activo',
  salario_minimo:1300000, aux_transporte:162000,
  salud_emp:8.5, pension_emp:12,
  arl_nivel1:0.522, arl_nivel2:1.044, arl_nivel3:2.436, arl_nivel4:4.350, arl_nivel5:6.960,
  sena:2, icbf:3, caja_comp:4,
  cesantias:8.33, intereses_ces:1, prima:8.33, vacaciones:4.17,
  salud_trab:4, pension_trab:4, tope_exoneracion:10,
}

// ── ESTILOS BASE ──────────────────────────────────────────
const inp: React.CSSProperties = {
  width:'100%', background:'#0A1628', border:`1.5px solid ${T.border}`,
  borderRadius:'8px', padding:'8px 10px', fontSize:'12px',
  color:T.text, outline:'none', boxSizing:'border-box',
}
const lbl: React.CSSProperties = { fontSize:'11px', color:T.muted, marginBottom:'4px', display:'block' }
const row2: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }
const row3: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'10px' }
const sec: React.CSSProperties = { fontSize:'11px', fontWeight:'700', letterSpacing:'0.05em', marginBottom:'8px', marginTop:'16px' }

function fmt(v: number, pais = 'COL'): string {
  const cfgs: Record<string,{locale:string;currency:string;dec:number}> = {
    COL:{locale:'es-CO',currency:'COP',dec:0}, ECU:{locale:'en-US',currency:'USD',dec:2},
    MEX:{locale:'es-MX',currency:'MXN',dec:2}, PER:{locale:'es-PE',currency:'PEN',dec:2},
    CHL:{locale:'es-CL',currency:'CLP',dec:0}, ARG:{locale:'es-AR',currency:'ARS',dec:2},
  }
  const c = cfgs[pais] || cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec}).format(v)
}

function calcCarga(colab: Partial<Colaborador>, tasas: Partial<TasaHistorico>): number {
  const s = colab.salario_base || 0
  const arl_pcts = [tasas.arl_nivel1||0.522,tasas.arl_nivel2||1.044,tasas.arl_nivel3||2.436,tasas.arl_nivel4||4.350,tasas.arl_nivel5||6.960]
  const nivel = (colab.nivel_arl || 1) - 1
  const smmlv10 = (tasas.salario_minimo||1300000) * (tasas.tope_exoneracion||10)
  const exonera = s < smmlv10 && colab.aplica_ley1607
  const sena = exonera ? 0 : (tasas.sena||2)/100
  const icbf = exonera ? 0 : (tasas.icbf||3)/100
  const carga = s * (
    (tasas.salud_emp||8.5)/100 + (tasas.pension_emp||12)/100 +
    arl_pcts[nivel]/100 + sena + icbf + (tasas.caja_comp||4)/100 +
    (tasas.cesantias||8.33)/100 + (tasas.intereses_ces||1)/100 +
    (tasas.prima||8.33)/100 + (tasas.vacaciones||4.17)/100
  )
  return Math.round(s + carga)
}

// ── MODAL COLABORADOR (Formulario completo) ───────────────
function ModalColaborador({
  onClose, onSave, tenantId, editData, procesos, tasas,
}: {
  onClose: () => void; onSave: () => void; tenantId: string
  editData: Colaborador | null; procesos: Proceso[]
  tasas: Partial<TasaHistorico>
}) {
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState<Record<string,boolean>>({})
  const [docUrls, setDocUrls] = useState<Record<string,string>>(editData?.docs_urls || {})

  const [f, setF] = useState({
    nombres: editData?.nombres || '', apellidos: editData?.apellidos || '',
    tipo_doc: editData?.tipo_doc || 'CC', num_doc: editData?.num_doc || '',
    foto_url: editData?.foto_url || '', fecha_nacimiento: editData?.fecha_nacimiento || '',
    genero: editData?.genero || 'M', estado_civil: editData?.estado_civil || 'Soltero',
    tiene_conyuge: editData?.tiene_conyuge || false, datos_conyuge: editData?.datos_conyuge || {},
    tiene_hijos: editData?.tiene_hijos || false, datos_hijos: editData?.datos_hijos || [],
    pais_code: editData?.pais_code || 'COL', departamento: editData?.departamento || '',
    ciudad: editData?.ciudad || '', direccion: editData?.direccion || '',
    codigo_tel: editData?.codigo_tel || '+57', celular: editData?.celular || '',
    email: editData?.email || '',
    contacto_emergencia: editData?.contacto_emergencia || { nombre:'', parentesco:'', celular:'' },
    nivel_formacion: editData?.nivel_formacion || '',
    cargo: editData?.cargo || '', proceso_id: editData?.proceso_id || '',
    tipo_contrato: editData?.tipo_contrato || 'Empleado',
    fecha_ingreso: editData?.fecha_ingreso || '', fecha_fin: editData?.fecha_fin || '',
    jornada: editData?.jornada || 'Tiempo completo',
    lugar_ejecucion: editData?.lugar_ejecucion || '', sede: editData?.sede || '',
    salario_base: editData?.salario_base || 0, aux_transporte: editData?.aux_transporte || 0,
    tipo_salario: editData?.tipo_salario || 'Fijo',
    nivel_arl: editData?.nivel_arl || 1, es_pensionado: editData?.es_pensionado || false,
    aplica_ley1607: editData?.aplica_ley1607 || false, tipo_cotizante: editData?.tipo_cotizante || '1',
    eps: editData?.eps || '', pension: editData?.pension || '', arl: editData?.arl || '',
    caja_comp: editData?.caja_comp || '', cesantias: editData?.cesantias || '',
    banco: editData?.banco || '', tipo_cuenta: editData?.tipo_cuenta || 'Ahorros',
    num_cuenta: editData?.num_cuenta || '',
  })

  const paisConfig = PAISES_CONFIG[f.pais_code] || PAIS_DEFAULT
  const cargaTotal = calcCarga(f as Partial<Colaborador>, tasas)

  // Alerta contrato término fijo
  const diasAlerta = f.fecha_fin ? Math.ceil((new Date(f.fecha_fin).getTime() - Date.now()) / 86400000) : null

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
    setF(prev => ({ ...prev, [k]: v }))
  }

  async function uploadDoc(id: string, file: File | null) {
    if (!file) return
    setUploading(u => ({ ...u, [id]: true }))
    try {
      const path = `nomina/${tenantId}/${Date.now()}_${id}_${file.name}`
      const { error: err } = await supabase.storage.from('documentos-nomina').upload(path, file)
      if (err) throw err
      const { data: { publicUrl } } = supabase.storage.from('documentos-nomina').getPublicUrl(path)
      setDocUrls(d => ({ ...d, [id]: publicUrl }))
    } catch { alert('Error al subir archivo') }
    finally { setUploading(u => ({ ...u, [id]: false })) }
  }

  async function guardar() {
    if (!f.nombres || !f.num_doc || !f.cargo) { setError('Nombres, documento y cargo son obligatorios'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...f, tenant_id: tenantId, activo: true, docs_urls: docUrls,
        carga_total_mes: cargaTotal,
      }
      if (editData?.id) {
        const { error: err } = await supabase.from('colaboradores').update(payload).eq('id', editData.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('colaboradores').insert(payload)
        if (err) throw err
      }
      onSave()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const STEPS = ['👤 Info Básica', '🔐 Seguridad Social', '💼 Info Laboral', '📄 Documentos']

  const fileBtn = (id: string, label: string, req = false) => (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
        <label style={lbl}>{label}{req ? ' *' : ''}</label>
        {req && <span style={{ fontSize:'9px', color:T.red, padding:'1px 5px', borderRadius:'3px', background:`${T.red}15` }}>Obligatorio</span>}
      </div>
      <label style={{
        display:'block', width:'100%', padding:'10px', textAlign:'center',
        background:'#0A1628', border:`1.5px dashed ${docUrls[id] ? T.green : T.border}`,
        borderRadius:'8px', cursor:'pointer', fontSize:'11px',
        color: docUrls[id] ? T.green : T.muted, boxSizing:'border-box',
      }}>
        {uploading[id] ? 'Subiendo...' : docUrls[id] ? '✓ Archivo cargado' : '+ Subir PDF · máx. 5MB'}
        <input type="file" accept="application/pdf" style={{ display:'none' }} onChange={e => uploadDoc(id, e.target.files?.[0] || null)} />
      </label>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter:'blur(4px)' }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', width:'700px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>

        {/* Header + stepper */}
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ fontSize:'14px', fontWeight:'700', color:T.text }}>{editData ? 'Editar colaborador' : 'Nuevo colaborador'}</div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:'18px' }}>✕</button>
          </div>
          {/* Barra de progreso */}
          <div style={{ display:'flex', gap:'0' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', width:'100%' }}>
                  {i > 0 && <div style={{ flex:1, height:'2px', background: i <= step ? T.accent : T.border }} />}
                  <button
                    onClick={() => setStep(i)}
                    style={{
                      width:'28px', height:'28px', borderRadius:'50%', flexShrink:0, border:'none',
                      background: i < step ? T.green : i === step ? T.accent : T.border,
                      color: i <= step ? T.card : T.muted, fontSize:'11px', fontWeight:'700', cursor:'pointer',
                    }}
                  >{i < step ? '✓' : i + 1}</button>
                  {i < 3 && <div style={{ flex:1, height:'2px', background: i < step ? T.accent : T.border }} />}
                </div>
                <div style={{ fontSize:'9px', color: i === step ? T.accent : T.muted, marginTop:'4px', whiteSpace:'nowrap' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ overflowY:'auto', flex:1, padding:'18px 20px' }}>

          {/* Carga total preview */}
          <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}20`, borderRadius:'8px', padding:'8px 14px', marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'12px' }}>
            <span style={{ color:T.muted }}>Carga prestacional total estimada</span>
            <strong style={{ color:T.blue, fontSize:'14px' }}>{fmt(cargaTotal, f.pais_code)}/mes</strong>
          </div>

          {/* Alerta contrato fijo venciendo */}
          {diasAlerta !== null && diasAlerta <= 40 && (
            <div style={{ background:diasAlerta <= 0 ? `${T.red}15` : `${T.yellow}15`, border:`1px solid ${diasAlerta <= 0 ? T.red : T.yellow}30`, borderRadius:'8px', padding:'8px 14px', marginBottom:'12px', fontSize:'12px', color: diasAlerta <= 0 ? T.red : T.yellow }}>
              {diasAlerta <= 0 ? '🔴 Contrato VENCIDO' : `⚠️ Contrato vence en ${diasAlerta} días`} — {new Date(f.fecha_fin).toLocaleDateString('es-CO')}
            </div>
          )}

          {/* STEP 0: Info básica */}
          {step === 0 && (
            <div>
              <div style={{ ...sec, color:T.accent }}>📋 DATOS PERSONALES</div>
              {/* Foto */}
              <div style={{ marginBottom:'10px', textAlign:'center' }}>
                <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:`${T.blue}20`, border:`2px dashed ${T.border}`, margin:'0 auto 6px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', overflow:'hidden' }}>
                  {f.foto_url ? <img src={f.foto_url} alt="foto" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '👤'}
                </div>
                <label style={{ fontSize:'11px', color:T.accent, cursor:'pointer', textDecoration:'underline' }}>
                  Subir foto
                  <input type="file" accept="image/*" style={{ display:'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return
                    setUploading(u => ({ ...u, foto: true }))
                    const path = `nomina/${tenantId}/foto_${Date.now()}_${file.name}`
                    const { error: err } = await supabase.storage.from('documentos-nomina').upload(path, file)
                    if (!err) {
                      const { data: { publicUrl } } = supabase.storage.from('documentos-nomina').getPublicUrl(path)
                      setF(prev => ({ ...prev, foto_url: publicUrl }))
                    }
                    setUploading(u => ({ ...u, foto: false }))
                  }} />
                </label>
              </div>

              <div style={row2}>
                <div><label style={lbl}>Nombres *</label><input style={inp} value={f.nombres} onChange={set('nombres')} placeholder="Joan Alexander" /></div>
                <div><label style={lbl}>Apellidos *</label><input style={inp} value={f.apellidos} onChange={set('apellidos')} placeholder="Torres Marín" /></div>
              </div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Tipo documento</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_doc} onChange={set('tipo_doc')}>
                    {['CC','CE','Pasaporte','CI','DNI','CURP','NIF','DPI','TI','RUC'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Número documento *</label><input style={inp} value={f.num_doc} onChange={set('num_doc')} /></div>
              </div>
              <div style={row2}>
                <div><label style={lbl}>Fecha nacimiento</label><input style={inp} type="date" value={f.fecha_nacimiento} onChange={set('fecha_nacimiento')} /></div>
                <div>
                  <label style={lbl}>Género</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.genero} onChange={set('genero')}>
                    {['M','F','Otro'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={row3}>
                <div>
                  <label style={lbl}>País</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.pais_code} onChange={set('pais_code')}>
                    {Object.entries(PAISES_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.nombre}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Departamento</label><input style={inp} value={f.departamento} onChange={set('departamento')} /></div>
                <div><label style={lbl}>Ciudad</label><input style={inp} value={f.ciudad} onChange={set('ciudad')} /></div>
              </div>
              <div style={{ marginBottom:'10px' }}><label style={lbl}>Dirección</label><input style={inp} value={f.direccion} onChange={set('direccion')} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'100px 1fr', gap:'8px', marginBottom:'10px' }}>
                <div>
                  <label style={lbl}>Código</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.codigo_tel} onChange={set('codigo_tel')}>
                    {['+57','+593','+52','+51','+56','+54','+506','+595','+58','+34','+502','+507'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Celular</label><input style={inp} value={f.celular} onChange={set('celular')} /></div>
              </div>
              <div style={{ marginBottom:'10px' }}><label style={lbl}>Email</label><input style={inp} type="email" value={f.email} onChange={set('email')} /></div>
              <div>
                <label style={lbl}>Nivel de formación</label>
                <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.nivel_formacion} onChange={set('nivel_formacion')}>
                  <option value="">Seleccionar...</option>
                  {(PAISES_CONFIG[f.pais_code]?.niveles_formacion || PAIS_DEFAULT.niveles_formacion).map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              {/* Estado civil → cónyuge */}
              <div style={{ ...sec, color:T.blue }}>👨‍👩‍👧 ESTADO CIVIL Y FAMILIA</div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Estado civil</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.estado_civil} onChange={set('estado_civil')}>
                    {['Soltero','Casado','Unión libre','Divorciado','Viudo','Otro'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', paddingTop:'20px' }}>
                  <input type="checkbox" checked={f.tiene_conyuge} onChange={set('tiene_conyuge')} id="conyuge" />
                  <label htmlFor="conyuge" style={{ fontSize:'12px', color:T.text, cursor:'pointer' }}>¿Tiene cónyuge/pareja?</label>
                </div>
              </div>

              {f.tiene_conyuge && (
                <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'12px', marginBottom:'10px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'600', color:T.blue, marginBottom:'8px' }}>Datos del cónyuge</div>
                  <div style={row2}>
                    <div><label style={lbl}>Nombres completos</label><input style={inp} value={f.datos_conyuge.nombres || ''} onChange={e => setF(p => ({ ...p, datos_conyuge: { ...p.datos_conyuge, nombres: e.target.value } }))} /></div>
                    <div><label style={lbl}>Celular</label><input style={inp} value={f.datos_conyuge.celular || ''} onChange={e => setF(p => ({ ...p, datos_conyuge: { ...p.datos_conyuge, celular: e.target.value } }))} /></div>
                  </div>
                  <div style={row2}>
                    <div><label style={lbl}>Fecha nacimiento</label><input style={inp} type="date" value={f.datos_conyuge.fecha_nac || ''} onChange={e => setF(p => ({ ...p, datos_conyuge: { ...p.datos_conyuge, fecha_nac: e.target.value } }))} /></div>
                    <div><label style={lbl}>Ocupación</label><input style={inp} value={f.datos_conyuge.ocupacion || ''} onChange={e => setF(p => ({ ...p, datos_conyuge: { ...p.datos_conyuge, ocupacion: e.target.value } }))} /></div>
                  </div>
                </div>
              )}

              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                <input type="checkbox" checked={f.tiene_hijos} onChange={set('tiene_hijos')} id="hijos" />
                <label htmlFor="hijos" style={{ fontSize:'12px', color:T.text, cursor:'pointer' }}>¿Tiene hijos? (útil para Caja Compensación)</label>
              </div>

              {f.tiene_hijos && (
                <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'12px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                    <div style={{ fontSize:'11px', fontWeight:'600', color:T.blue }}>Datos de hijos ({f.datos_hijos.length})</div>
                    <button onClick={() => setF(p => ({ ...p, datos_hijos: [...p.datos_hijos, { nombre:'', fecha_nac:'', celular:'' }] }))}
                      style={{ fontSize:'11px', color:T.green, background:'none', border:`1px solid ${T.green}40`, borderRadius:'6px', padding:'3px 10px', cursor:'pointer' }}>+ Agregar hijo</button>
                  </div>
                  {f.datos_hijos.map((h, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 32px', gap:'6px', marginBottom:'6px' }}>
                      <input style={inp} placeholder="Nombre" value={h.nombre || ''} onChange={e => setF(p => ({ ...p, datos_hijos: p.datos_hijos.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x) }))} />
                      <input style={inp} type="date" value={h.fecha_nac || ''} onChange={e => setF(p => ({ ...p, datos_hijos: p.datos_hijos.map((x, j) => j === i ? { ...x, fecha_nac: e.target.value } : x) }))} />
                      <input style={inp} placeholder="Celular" value={h.celular || ''} onChange={e => setF(p => ({ ...p, datos_hijos: p.datos_hijos.map((x, j) => j === i ? { ...x, celular: e.target.value } : x) }))} />
                      <button onClick={() => setF(p => ({ ...p, datos_hijos: p.datos_hijos.filter((_, j) => j !== i) }))} style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'6px', color:T.red, cursor:'pointer', fontSize:'12px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Contacto emergencia */}
              <div style={{ ...sec, color:T.red }}>🚨 CONTACTO DE EMERGENCIA</div>
              <div style={row3}>
                <div><label style={lbl}>Nombre</label><input style={inp} value={f.contacto_emergencia.nombre || ''} onChange={e => setF(p => ({ ...p, contacto_emergencia: { ...p.contacto_emergencia, nombre: e.target.value } }))} /></div>
                <div><label style={lbl}>Parentesco</label><input style={inp} value={f.contacto_emergencia.parentesco || ''} onChange={e => setF(p => ({ ...p, contacto_emergencia: { ...p.contacto_emergencia, parentesco: e.target.value } }))} /></div>
                <div><label style={lbl}>Celular</label><input style={inp} value={f.contacto_emergencia.celular || ''} onChange={e => setF(p => ({ ...p, contacto_emergencia: { ...p.contacto_emergencia, celular: e.target.value } }))} /></div>
              </div>
            </div>
          )}

          {/* STEP 1: Seguridad Social */}
          {step === 1 && (
            <div>
              <div style={{ ...sec, color:T.green }}>🔐 SEGURIDAD SOCIAL — {paisConfig.nombre}</div>
              <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}20`, borderRadius:'8px', padding:'10px 14px', marginBottom:'14px', fontSize:'11px', color:T.muted }}>
                Las entidades se filtran según el país del colaborador: <strong style={{ color:T.blue }}>{paisConfig.nombre}</strong>
              </div>

              {[
                { key:'eps', label:'EPS / Seguro Médico *', lista: paisConfig.entidades.eps, docKey:'cert_eps' },
                { key:'pension', label:'Fondo de Pensiones *', lista: paisConfig.entidades.pension, docKey:'cert_pension' },
                { key:'arl', label:'ARL / Riesgos Laborales', lista: paisConfig.entidades.arl, docKey:'cert_arl' },
                { key:'caja_comp', label:'Caja de Compensación', lista: ['Comfama','Comfenalco','Compensar','Cafam','Comfandi'], docKey:'cert_caja' },
                { key:'cesantias', label:'Fondo de Cesantías', lista: ['Protección','Porvenir','Colfondos','Skandia'], docKey:'cert_cesantias' },
                { key:'banco', label:'Banco para pago nómina *', lista: paisConfig.entidades.banco, docKey:'cert_banco' },
              ].map(item => (
                <div key={item.key} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px', alignItems:'start' }}>
                  <div>
                    <label style={lbl}>{item.label}</label>
                    <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={(f as unknown as Record<string,string>)[item.key] || ''} onChange={set(item.key)}>
                      <option value="">Seleccionar...</option>
                      {item.lista.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div style={{ paddingTop:'2px' }}>
                    {fileBtn(item.docKey, 'Certificado PDF')}
                  </div>
                </div>
              ))}

              <div style={{ ...sec, color:T.yellow }}>⚙️ CONFIGURACIÓN ARL</div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Nivel de riesgo ARL</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.nivel_arl} onChange={set('nivel_arl')}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>Nivel {n} — {[0.522,1.044,2.436,4.350,6.960][n-1]}%</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Tipo de cuenta bancaria</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_cuenta} onChange={set('tipo_cuenta')}>
                    {['Ahorros','Corriente','Nequi','Daviplata'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:'10px' }}><label style={lbl}>Número de cuenta</label><input style={inp} value={f.num_cuenta} onChange={set('num_cuenta')} /></div>
              <div style={{ marginBottom:'10px' }}>
                {fileBtn('examen_medico', 'Examen médico de ingreso (obligatorio por ley)', true)}
              </div>

              <div style={{ display:'flex', gap:'16px', marginBottom:'10px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'12px', color:T.text }}>
                  <input type="checkbox" checked={f.es_pensionado} onChange={set('es_pensionado')} />
                  ¿Es pensionado? (no aplica aporte pensión)
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: Info Laboral */}
          {step === 2 && (
            <div>
              <div style={{ ...sec, color:T.purple }}>💼 INFORMACIÓN LABORAL</div>
              <div style={row2}>
                <div><label style={lbl}>Cargo *</label><input style={inp} value={f.cargo} onChange={set('cargo')} placeholder="Confirmador de pedidos" /></div>
                <div>
                  <label style={lbl}>Proceso/Área</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.proceso_id} onChange={set('proceso_id')}>
                    <option value="">Sin proceso</option>
                    {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Tipo contrato *</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_contrato} onChange={set('tipo_contrato')}>
                    {['Empleado','Término fijo','Obra o labor','Contratista','Honorarios','Aprendiz SENA'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Jornada</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.jornada} onChange={set('jornada')}>
                    {['Tiempo completo','Medio tiempo','Por horas','Turnos rotativos','Teletrabajo'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={row2}>
                <div><label style={lbl}>Fecha ingreso *</label><input style={inp} type="date" value={f.fecha_ingreso} onChange={set('fecha_ingreso')} /></div>
                {f.tipo_contrato.includes('fijo') || f.tipo_contrato === 'Obra o labor' ? (
                  <div>
                    <label style={lbl}>Fecha fin contrato</label>
                    <input style={{ ...inp, borderColor: diasAlerta !== null && diasAlerta <= 40 ? T.yellow : T.border }} type="date" value={f.fecha_fin} onChange={set('fecha_fin')} />
                    {diasAlerta !== null && diasAlerta <= 40 && <div style={{ fontSize:'10px', color:T.yellow, marginTop:'2px' }}>⚠️ Vence en {diasAlerta} días</div>}
                  </div>
                ) : <div />}
              </div>
              <div style={{ marginBottom:'10px' }}><label style={lbl}>Lugar de ejecución del contrato (requerido para ARL/teletrabajo)</label><input style={inp} value={f.lugar_ejecucion} onChange={set('lugar_ejecucion')} placeholder="Sede principal Medellín / Domicilio: Cra 70 #45-30" /></div>
              <div style={{ marginBottom:'10px' }}><label style={lbl}>Sede</label><input style={inp} value={f.sede} onChange={set('sede')} placeholder="Medellín / Remoto / Bogotá" /></div>

              <div style={{ ...sec, color:T.accent }}>💰 CONDICIONES SALARIALES</div>
              <div style={row2}>
                <div><label style={lbl}>Salario base *</label><input style={inp} type="number" value={f.salario_base || ''} onChange={set('salario_base')} /></div>
                <div><label style={lbl}>Auxilio de transporte</label><input style={inp} type="number" value={f.aux_transporte || ''} onChange={set('aux_transporte')} /></div>
              </div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Tipo de salario</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_salario} onChange={set('tipo_salario')}>
                    {['Fijo','Variable','Integral'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Tipo cotizante SS</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_cotizante} onChange={set('tipo_cotizante')}>
                    {['1','2','3','51','12','15'].map(v => <option key={v} value={v}>Tipo {v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:'16px', marginBottom:'10px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'12px', color:T.text }}>
                  <input type="checkbox" checked={f.aplica_ley1607} onChange={set('aplica_ley1607')} />
                  Aplica Ley 1607 (exoneración parafiscal &lt; 10 SMMLV)
                </label>
              </div>

              {/* Carga prestacional detallada */}
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'12px', marginTop:'4px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:T.blue, marginBottom:'8px' }}>📊 Carga prestacional calculada</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px' }}>
                  {[
                    ['Salario base', f.salario_base],
                    ['Salud empleador', Math.round(f.salario_base * (tasas.salud_emp||8.5)/100)],
                    ['Pensión empleador', Math.round(f.salario_base * (tasas.pension_emp||12)/100)],
                    ['ARL nivel '+f.nivel_arl, Math.round(f.salario_base * ([tasas.arl_nivel1||0.522,tasas.arl_nivel2||1.044,tasas.arl_nivel3||2.436,tasas.arl_nivel4||4.350,tasas.arl_nivel5||6.960][f.nivel_arl-1])/100)],
                    ['Cesantías', Math.round(f.salario_base * (tasas.cesantias||8.33)/100)],
                    ['Prima', Math.round(f.salario_base * (tasas.prima||8.33)/100)],
                    ['Vacaciones', Math.round(f.salario_base * (tasas.vacaciones||4.17)/100)],
                    ['SENA+ICBF+Caja', f.aplica_ley1607 ? 0 : Math.round(f.salario_base * ((tasas.sena||2)+(tasas.icbf||3)+(tasas.caja_comp||4))/100)],
                  ].map(([l, v]) => (
                    <div key={l as string} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'3px 0', borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ color:T.muted }}>{l}</span>
                      <span style={{ color:T.text }}>{fmt(v as number, f.pais_code)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'8px', fontSize:'13px', fontWeight:'700' }}>
                  <span style={{ color:T.text }}>CARGA TOTAL</span>
                  <span style={{ color:T.blue }}>{fmt(cargaTotal, f.pais_code)}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Documentos */}
          {step === 3 && (
            <div>
              <div style={{ ...sec, color:T.yellow }}>📄 DOCUMENTOS REQUERIDOS</div>
              <div style={{ background:`${T.yellow}10`, border:`1px solid ${T.yellow}20`, borderRadius:'8px', padding:'9px 12px', marginBottom:'14px', fontSize:'11px', color:T.yellow }}>
                Todos en formato PDF · máximo 5MB por archivo
              </div>
              {fileBtn('id_a', 'Documento identidad — Lado A (Frontal)', true)}
              {fileBtn('id_b', 'Documento identidad — Lado B (Posterior)', true)}
              {fileBtn('hoja_vida', 'Hoja de vida laboral', true)}
              <div style={{ ...sec, color:T.muted, marginTop:'14px' }}>Opcionales</div>
              {fileBtn('contrato', 'Contrato de trabajo firmado')}
              {fileBtn('cert_estudio', 'Certificado de estudio / título')}
              {fileBtn('carnet_eps', 'Carnet EPS')}
            </div>
          )}

          {error && <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'9px', fontSize:'12px', color:T.red, marginTop:'12px' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:`1px solid ${T.border}`, display:'flex', gap:'8px', flexShrink:0 }}>
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ padding:'10px 16px', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.muted, cursor:'pointer', fontSize:'13px' }}>← Anterior</button>}
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} style={{ flex:1, padding:'10px', background:T.blue, border:'none', borderRadius:'8px', color:'#fff', fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>
              Siguiente →
            </button>
          ) : (
            <button onClick={guardar} disabled={saving} style={{ flex:1, padding:'10px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:saving?'wait':'pointer', fontSize:'13px', opacity:saving?0.7:1 }}>
              {saving ? 'Guardando...' : editData ? 'Guardar cambios' : '✅ Crear colaborador'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────
export default function NominaPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'organigrama'|'colaboradores'|'novedades'|'liquidacion'|'tasas'>('colaboradores')
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [tasas, setTasas] = useState<Partial<TasaHistorico>>(TASAS_COL_2025)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<Colaborador | null>(null)
  const [buscar, setBuscar] = useState('')
  const [anioFiscal, setAnioFiscal] = useState(2025)

  // Organigrama
  const [nuevoProceso, setNuevoProceso] = useState('')
  const [showNuevoProceso, setShowNuevoProceso] = useState(false)

  // Novedades
  const [novedad, setNovedad] = useState({ empleado_id:'', tipo:'', campos:{} as Record<string,string|number> })
  const [novedades, setNovedades] = useState<Array<Record<string,unknown>>>([])

  // Tasas edición
  const [editTasa, setEditTasa] = useState(false)
  const [pagandoNomina, setPagandoNomina] = useState(false)
  const [formTasa, setFormTasa] = useState<Partial<TasaHistorico>>(TASAS_COL_2025)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    setTenantId(profile.tenant_id)

    const [{ data: cols }, { data: procs }, { data: novs }, { data: tasa }] = await Promise.all([
      supabase.from('colaboradores').select('*').eq('tenant_id', profile.tenant_id).eq('activo', true).order('nombres'),
      supabase.from('nomina_procesos').select('*').eq('tenant_id', profile.tenant_id).eq('activo', true).order('orden'),
      supabase.from('nomina_novedades_tipos').select('*').eq('activo', true),
      supabase.from('nomina_tasas_historico').select('*').eq('tenant_id', profile.tenant_id).eq('anio_fiscal', anioFiscal).eq('estado', 'activo').single(),
    ])

    setColaboradores((cols || []) as Colaborador[])
    setProcesos((procs || []) as Proceso[])
    setNovedades(novs || [])
    if (tasa) { setTasas(tasa as TasaHistorico); setFormTasa(tasa as TasaHistorico) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [anioFiscal])

  async function crearProceso() {
    if (!nuevoProceso.trim()) return
    await supabase.from('nomina_procesos').insert({ nombre: nuevoProceso, tenant_id: tenantId, orden: procesos.length + 1, activo: true })
    setNuevoProceso(''); setShowNuevoProceso(false); loadData()
  }

  async function eliminarColaborador(id: string) {
    if (!confirm('¿Desactivar este colaborador?')) return
    await supabase.from('colaboradores').update({ activo: false }).eq('id', id)
    loadData()
  }

  async function guardarTasas() {
    await supabase.from('nomina_tasas_historico').upsert(
      { ...formTasa, tenant_id: tenantId, anio_fiscal: anioFiscal, estado: 'activo', vigencia_inicio: `${anioFiscal}-01-01` },
      { onConflict: 'tenant_id,pais_code,anio_fiscal' }
    )
    setEditTasa(false); loadData()
  }

  // Conexión real → Libro de Caja (módulo P&G) — registro agregado de la nómina pagada
  async function pagarNominaDelMes() {
    if (!tenantId || colaboradores.length === 0) return
    setPagandoNomina(true)
    const totalNeto = colaboradores.reduce((acc, c) => {
      const salud_trab = Math.round(c.salario_base * (Number(tasas.salud_trab) || 4) / 100)
      const pension_trab = Math.round(c.salario_base * (Number(tasas.pension_trab) || 4) / 100)
      const heExtra = (novedades as Array<Record<string,unknown>>)
        .filter(n => n.colaborador_id === c.id && String(n.tipo || '').startsWith('he_'))
        .reduce((a, n) => a + Number(n.valor || 0), 0)
      const deducciones = salud_trab + pension_trab
      return acc + c.salario_base + (c.aux_transporte || 0) + heExtra - deducciones
    }, 0)
    const hoy = new Date().toISOString().slice(0,10)
    await supabase.from('libro_caja').insert({
      tenant_id: tenantId, fecha: hoy,
      concepto: `Nómina del mes — ${colaboradores.length} colaborador(es)`,
      tipo: 'salida', valor: Math.round(totalNeto), origen: 'nomina',
      categoria_flujo: 'operativo',
    })
    setPagandoNomina(false)
    alert(`Nómina registrada: ${fmt(Math.round(totalNeto))} en Libro de Caja (módulo P&G)`)
  }

  const colsFiltrados = colaboradores.filter(c =>
    !buscar || `${c.nombres} ${c.apellidos} ${c.cargo}`.toLowerCase().includes(buscar.toLowerCase())
  )

  const totalNomina = colaboradores.reduce((a, c) => a + (c.carga_total_mes || 0), 0)
  const alertasVencimiento = colaboradores.filter(c => {
    if (!c.fecha_fin) return false
    const dias = Math.ceil((new Date(c.fecha_fin).getTime() - Date.now()) / 86400000)
    return dias <= 40
  })

  // Por proceso: agrupar colaboradores
  const porProceso = procesos.map(p => ({
    ...p,
    colaboradores: colaboradores.filter(c => c.proceso_id === p.id),
    carga: colaboradores.filter(c => c.proceso_id === p.id).reduce((a, c) => a + (c.carga_total_mes || 0), 0),
  }))

  const TABS = [
    { v:'organigrama',   l:'🗂️ Organigrama',  c:T.purple },
    { v:'colaboradores', l:'👥 Colaboradores', c:T.blue },
    { v:'novedades',     l:'📋 Novedades',     c:T.yellow },
    { v:'liquidacion',   l:'💵 Liquidación',   c:T.green },
    { v:'tasas',         l:'⚙️ Tasas',         c:T.accent },
  ]

  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      {showModal && (
        <ModalColaborador
          onClose={() => { setShowModal(false); setEditData(null) }}
          onSave={() => { setShowModal(false); setEditData(null); loadData() }}
          tenantId={tenantId}
          editData={editData}
          procesos={procesos}
          tasas={tasas}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:T.text, marginBottom:'4px' }}>👥 Gestión de Nómina</h1>
          <p style={{ fontSize:'12px', color:T.muted }}>Tu equipo es tu mayor activo — gestiona con precisión</p>
        </div>
        <button onClick={() => { setEditData(null); setShowModal(true) }}
          style={{ padding:'9px 18px', background:T.accent, border:'none', borderRadius:'9px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>
          + Nuevo colaborador
        </button>
      </div>

      {/* Alertas contratos */}
      {alertasVencimiento.length > 0 && (
        <div style={{ background:`${T.yellow}12`, border:`1px solid ${T.yellow}30`, borderRadius:'9px', padding:'10px 16px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'10px', fontSize:'12px', color:T.yellow }}>
          <span style={{ fontSize:'18px' }}>⚠️</span>
          <span>{alertasVencimiento.length} contrato(s) a término fijo vencen en los próximos 40 días: <strong>{alertasVencimiento.map(c => `${c.nombres} ${c.apellidos}`).join(', ')}</strong></span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'20px' }}>
        {[
          { l:'Total colaboradores', v:colaboradores.length, sub:'Activos', c:T.blue },
          { l:'Carga nómina total', v:fmt(totalNomina), sub:'Costo empleador mes', c:T.accent },
          { l:'Carga por área Admin', v:fmt(porProceso.find(p=>p.nombre.toLowerCase().includes('admin'))?.carga||0), sub:'CF corporativo', c:T.green },
          { l:'Carga área Ventas', v:fmt(porProceso.find(p=>p.nombre.toLowerCase().includes('vent')||p.nombre.toLowerCase().includes('comerc'))?.carga||0), sub:'Absorbe en CAC', c:T.purple },
        ].map(k => (
          <div key={k.l} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'12px 16px', borderTop:`3px solid ${k.c}` }}>
            <div style={{ fontSize:'11px', color:T.muted, marginBottom:'4px' }}>{k.l}</div>
            <div style={{ fontSize:'18px', fontWeight:'700', color:k.c, marginBottom:'2px' }}>{k.v}</div>
            <div style={{ fontSize:'10px', color:T.muted }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v as typeof tab)}
            style={{ padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:tab===t.v?'600':'400', border:`1px solid ${tab===t.v?t.c:T.border}`, background:tab===t.v?`${t.c}15`:'transparent', color:tab===t.v?t.c:T.muted }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══ ORGANIGRAMA ══ */}
      {tab === 'organigrama' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px', gap:'8px' }}>
            {showNuevoProceso ? (
              <div style={{ display:'flex', gap:'6px' }}>
                <input style={{ ...inp, width:'200px' }} placeholder="Nombre del proceso/área" value={nuevoProceso} onChange={e => setNuevoProceso(e.target.value)} />
                <button onClick={crearProceso} style={{ padding:'7px 14px', background:T.green, border:'none', borderRadius:'7px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>Crear</button>
                <button onClick={() => setShowNuevoProceso(false)} style={{ padding:'7px 12px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:'7px', color:T.muted, cursor:'pointer', fontSize:'12px' }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowNuevoProceso(true)} style={{ padding:'8px 14px', background:`${T.purple}15`, border:`1px solid ${T.purple}40`, borderRadius:'8px', color:T.purple, cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>+ Nuevo proceso/área</button>
            )}
          </div>

          {/* Organigrama visual */}
          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
            {porProceso.map(p => (
              <div key={p.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px', minWidth:'220px', flex:'1' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                  <div style={{ fontSize:'13px', fontWeight:'700', color:T.purple }}>{p.nombre}</div>
                  <div style={{ fontSize:'11px', color:T.muted }}>{p.colaboradores.length} personas</div>
                </div>
                <div style={{ fontSize:'12px', color:T.accent, fontWeight:'600', marginBottom:'10px' }}>{fmt(p.carga)}/mes</div>
                {p.colaboradores.map(c => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 0', borderTop:`1px solid ${T.border}` }}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:`${T.blue}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', flexShrink:0, overflow:'hidden' }}>
                      {c.foto_url ? <img src={c.foto_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : '👤'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', color:T.text, fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nombres} {c.apellidos}</div>
                      <div style={{ fontSize:'10px', color:T.muted }}>{c.cargo} · {c.tipo_contrato}</div>
                    </div>
                  </div>
                ))}
                {p.colaboradores.length === 0 && <div style={{ fontSize:'11px', color:T.muted, textAlign:'center', padding:'10px 0' }}>Sin colaboradores</div>}
              </div>
            ))}
            {/* Sin proceso */}
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px', minWidth:'220px', flex:'1' }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color:T.muted, marginBottom:'10px' }}>Sin proceso asignado</div>
              {colaboradores.filter(c => !c.proceso_id).map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 0', borderTop:`1px solid ${T.border}` }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:`${T.muted}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px' }}>👤</div>
                  <div><div style={{ fontSize:'12px', color:T.text }}>{c.nombres} {c.apellidos}</div><div style={{ fontSize:'10px', color:T.muted }}>{c.cargo}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ COLABORADORES ══ */}
      {tab === 'colaboradores' && (
        <div>
          <div style={{ marginBottom:'12px' }}>
            <input style={{ ...inp, width:'280px' }} placeholder="🔍 Buscar por nombre o cargo..." value={buscar} onChange={e => setBuscar(e.target.value)} />
          </div>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#060E1C' }}>
                    {['#','Colaborador','Cargo','Área','Tipo','Salario','Carga Total','SS','Acciones'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:'11px', color:T.muted, fontWeight:'600', whiteSpace:'nowrap', borderBottom:`1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} style={{ textAlign:'center', padding:'40px', color:T.muted }}>Cargando...</td></tr>
                  ) : colsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign:'center', padding:'48px' }}>
                        <div style={{ fontSize:'32px', marginBottom:'10px' }}>👥</div>
                        <div style={{ fontSize:'14px', fontWeight:'600', color:T.text, marginBottom:'6px' }}>No hay colaboradores aún</div>
                        <button onClick={() => setShowModal(true)} style={{ padding:'9px 20px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>+ Agregar primer colaborador</button>
                      </td>
                    </tr>
                  ) : colsFiltrados.map((c, i) => {
                    const proc = procesos.find(p => p.id === c.proceso_id)
                    const vence = c.fecha_fin ? Math.ceil((new Date(c.fecha_fin).getTime() - Date.now()) / 86400000) : null
                    return (
                      <tr key={c.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?'transparent':'#080F1C' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0F1E32'}
                        onMouseLeave={e => e.currentTarget.style.background = i%2===0?'transparent':'#080F1C'}>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:T.muted }}>#{String(i+1).padStart(3,'0')}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:`${T.blue}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', flexShrink:0, overflow:'hidden' }}>
                              {c.foto_url ? <img src={c.foto_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : '👤'}
                            </div>
                            <div>
                              <div style={{ fontSize:'12px', fontWeight:'600', color:T.text }}>{c.nombres} {c.apellidos}</div>
                              <div style={{ fontSize:'10px', color:T.muted }}>{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text }}>{c.cargo}</td>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:T.purple }}>{proc?.nombre || '—'}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:`${T.blue}20`, color:T.blue }}>
                            {c.tipo_contrato}
                          </span>
                          {vence !== null && vence <= 40 && (
                            <div style={{ fontSize:'9px', color:T.yellow, marginTop:'2px' }}>⚠️ Vence {vence}d</div>
                          )}
                        </td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text }}>{fmt(c.salario_base, c.pais_code)}</td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', fontWeight:'700', color:T.accent }}>{fmt(c.carga_total_mes || 0, c.pais_code)}</td>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:T.muted, whiteSpace:'nowrap' }}>
                          <div>{c.eps || '—'}</div>
                          <div style={{ fontSize:'10px' }}>{c.pension || '—'}</div>
                        </td>
                        <td style={{ padding:'8px 12px' }}>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button onClick={() => { setEditData(c); setShowModal(true) }} style={{ padding:'4px 8px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'5px', color:T.blue, cursor:'pointer', fontSize:'10px' }}>✏️</button>
                            <button onClick={() => eliminarColaborador(c.id)} style={{ padding:'4px 8px', background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'5px', color:T.red, cursor:'pointer', fontSize:'10px' }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {colsFiltrados.length > 0 && <div style={{ textAlign:'center', marginTop:'10px', fontSize:'12px', color:T.muted }}>Total carga nómina: <strong style={{ color:T.accent }}>{fmt(totalNomina)}</strong></div>}
        </div>
      )}

      {/* ══ NOVEDADES ══ */}
      {tab === 'novedades' && (
        <div>
          <div style={{ marginBottom:'16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:'10px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'16px' }}>
              <div>
                <label style={lbl}>Colaborador</label>
                <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={novedad.empleado_id} onChange={e => setNovedad(n => ({ ...n, empleado_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Tipo de novedad</label>
                <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={novedad.tipo} onChange={e => setNovedad(n => ({ ...n, tipo: e.target.value, campos: {} }))}>
                  <option value="">Seleccionar...</option>
                  {TIPOS_NOVEDAD.map(cat => (
                    <optgroup key={cat.cat} label={cat.cat}>
                      {cat.items.map(it => <option key={it.v} value={it.v}>{it.l}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>


            {/* Campos dinámicos según tipo */}
            {novedad.tipo && (
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px', marginTop:'10px' }}>
                <div style={{ fontSize:'12px', fontWeight:'600', color:T.accent, marginBottom:'10px' }}>
                  {TIPOS_NOVEDAD.flatMap(c => c.items).find(i => i.v === novedad.tipo)?.l}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
                  {(TIPOS_NOVEDAD.flatMap(c => c.items).find(i => i.v === novedad.tipo)?.campos || []).map(campo => (
                    <div key={campo}>
                      <label style={lbl}>{campo.replace(/_/g,' ')}</label>
                      <input
                        style={inp}
                        type={campo.includes('fecha') ? 'date' : campo.includes('monto') || campo.includes('valor') || campo.includes('horas') || campo.includes('cuota') || campo.includes('dias') || campo.includes('num') ? 'number' : 'text'}
                        value={(novedad.campos[campo] as string) || ''}
                        onChange={e => setNovedad(n => ({ ...n, campos: { ...n.campos, [campo]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    if (!novedad.empleado_id || !novedad.tipo) return
                    const col = colaboradores.find(c => c.id === novedad.empleado_id)
                    if (!col) return
                    let valor = 0
                    const horas = parseFloat(String(novedad.campos.cantidad_horas || 0))
                    const valHora = col.salario_base / 240
                    const pcts: Record<string,number> = { he_diurna:1.25, he_nocturna:1.75, he_dom_diurna:2, he_dom_nocturna:2.5, recargo_noc:1.35, recargo_dom:1.75 }
                    if (horas > 0 && pcts[novedad.tipo]) valor = Math.round(horas * valHora * pcts[novedad.tipo])
                    else valor = parseFloat(String(novedad.campos.valor || novedad.campos.valor_monto || 0))
                    await supabase.from('nomina_novedades').insert({
                      tenant_id: tenantId,
                      colaborador_id: novedad.empleado_id,
                      tipo: novedad.tipo,
                      campos: novedad.campos,
                      valor,
                      fecha: new Date().toISOString().slice(0,10),
                      estado: 'pendiente',
                    })
                    setNovedad({ empleado_id:'', tipo:'', campos:{} })
                    loadData()
                  }}
                  style={{ marginTop:'12px', padding:'9px 20px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'13px' }}
                >
                  ✅ Registrar novedad
                </button>
              </div>
            )}
          </div>

          {/* Historial de novedades */}
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.border}`, fontSize:'13px', fontWeight:'600', color:T.yellow }}>
              📋 Historial de novedades registradas
            </div>
            {(novedades as Array<Record<string,unknown>>).length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', color:T.muted, fontSize:'13px' }}>
                No hay novedades registradas aún
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#060E1C' }}>
                      {['Colaborador','Tipo','Valor','Fecha','Estado'].map(h => (
                        <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'11px', color:T.muted, fontWeight:'600', borderBottom:`1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(novedades as Array<Record<string,unknown>>).map((n, i) => {
                      const col = colaboradores.find(c => c.id === n.colaborador_id)
                      return (
                        <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
                          <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text }}>{col ? `${col.nombres} ${col.apellidos}` : '—'}</td>
                          <td style={{ padding:'8px 12px', fontSize:'11px', color:T.yellow }}>{String(n.tipo || '—')}</td>
                          <td style={{ padding:'8px 12px', fontSize:'12px', color:T.accent, fontWeight:'600' }}>{fmt(Number(n.valor || 0))}</td>
                          <td style={{ padding:'8px 12px', fontSize:'11px', color:T.muted }}>{String(n.fecha || '—')}</td>
                          <td style={{ padding:'8px 12px' }}>
                            <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:`${T.green}20`, color:T.green }}>
                              {String(n.estado || 'pendiente')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ LIQUIDACIÓN ══ */}
      {tab === 'liquidacion' && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'700', color:T.green }}>💵 LIQUIDACIÓN DE NÓMINA</div>
            {colaboradores.length > 0 && (
              <button onClick={pagarNominaDelMes} disabled={pagandoNomina}
                style={{ padding:'8px 16px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor: pagandoNomina?'not-allowed':'pointer', fontSize:'12px', opacity: pagandoNomina?0.6:1 }}>
                {pagandoNomina ? 'Registrando...' : '💰 Pagar nómina del mes'}
              </button>
            )}
          </div>
          {colaboradores.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:T.muted }}>No hay colaboradores para liquidar</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#060E1C' }}>
                    {['Colaborador','Salario Base','Aux. Transporte','Horas Extra','Deducciones','NETO A PAGAR'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:'11px', color:T.muted, fontWeight:'600', borderBottom:`1px solid ${T.border}`, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {colaboradores.map((c, i) => {
                    const salud_trab = Math.round(c.salario_base * (Number(tasas.salud_trab) || 4) / 100)
                    const pension_trab = Math.round(c.salario_base * (Number(tasas.pension_trab) || 4) / 100)
                    const heExtra = (novedades as Array<Record<string,unknown>>)
                      .filter(n => n.colaborador_id === c.id && String(n.tipo || '').startsWith('he_'))
                      .reduce((a, n) => a + Number(n.valor || 0), 0)
                    const deducciones = salud_trab + pension_trab
                    const neto = c.salario_base + (c.aux_transporte || 0) + heExtra - deducciones
                    return (
                      <tr key={c.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?'transparent':'#080F1C' }}>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text, fontWeight:'500' }}>{c.nombres} {c.apellidos}</td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text }}>{fmt(c.salario_base, c.pais_code)}</td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.muted }}>{fmt(c.aux_transporte || 0, c.pais_code)}</td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.yellow }}>{fmt(heExtra, c.pais_code)}</td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.red }}>-{fmt(deducciones, c.pais_code)}</td>
                        <td style={{ padding:'8px 12px', fontSize:'13px', fontWeight:'700', color:T.green }}>{fmt(neto, c.pais_code)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{ marginTop:'10px', fontSize:'11px', color:T.muted }}>
                Al pagar, se registra como salida en el Libro de Caja (módulo P&G) — categoría operativo.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TASAS ══ */}
      {tab === 'tasas' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent }}>⚙️ TASAS {anioFiscal} — COLOMBIA</div>
              <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                <select style={{ ...inp, width:'90px', padding:'4px 8px' }} value={anioFiscal} onChange={e => setAnioFiscal(Number(e.target.value))}>
                  {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={() => setEditTasa(!editTasa)} style={{ padding:'6px 12px', background:editTasa?`${T.red}15`:`${T.blue}15`, border:`1px solid ${editTasa?T.red:T.blue}30`, borderRadius:'7px', color:editTasa?T.red:T.blue, cursor:'pointer', fontSize:'11px' }}>
                  {editTasa ? '✕ Cancelar' : '✏️ Editar'}
                </button>
                {editTasa && (
                  <button onClick={guardarTasas} style={{ padding:'6px 12px', background:T.accent, border:'none', borderRadius:'7px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'11px' }}>
                    💾 Guardar
                  </button>
                )}
              </div>
            </div>
            {[
              { l:'Salud empleador %', k:'salud_emp' as keyof typeof formTasa },
              { l:'Pensión empleador %', k:'pension_emp' as keyof typeof formTasa },
              { l:'Salud trabajador %', k:'salud' as keyof typeof formTasa },
              { l:'Pensión trabajador %', k:'pension' as keyof typeof formTasa },
              { l:'SENA %', k:'sena' as keyof typeof formTasa },
              { l:'ICBF %', k:'icbf' as keyof typeof formTasa },
              { l:'Caja compensación %', k:'caja_comp' as keyof typeof formTasa },
              { l:'Cesantías %', k:'cesantias' as keyof typeof formTasa },
              { l:'Intereses cesantías %', k:'intereses_ces' as keyof typeof formTasa },
              { l:'Prima %', k:'prima' as keyof typeof formTasa },
              { l:'Vacaciones %', k:'vacaciones' as keyof typeof formTasa },
            ].map(({ l, k }) => (
              <div key={String(k)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:'12px', color:T.muted }}>{l}</span>
                {editTasa ? (
                  <input
                    type="number"
                    step="0.01"
                    style={{ ...inp, width:'80px', padding:'4px 8px', textAlign:'right' }}
                    value={Number(formTasa[k] || 0)}
                    onChange={e => setFormTasa(f => ({ ...f, [k]: parseFloat(e.target.value) }))}
                  />
                ) : (
                  <span style={{ fontSize:'12px', fontWeight:'700', color:T.accent }}>{Number(tasas[k] || 0).toFixed(2)}%</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'12px' }}>📊 RESUMEN CARGA EMPLEADOR</div>
            {[
              { grupo:'Seguridad Social', items:[
                { l:'Salud emp', v:Number(tasas.salud_emp||8.5) },
                { l:'Pensión emp', v:Number(tasas.pension_emp||12) },
              ], color:T.red },
              { grupo:'Parafiscales', items:[
                { l:'SENA', v:Number(tasas.sena||2) },
                { l:'ICBF', v:Number(tasas.icbf||3) },
                { l:'Caja', v:Number(tasas.caja_comp||4) },
              ], color:T.purple },
              { grupo:'Prestaciones', items:[
                { l:'Cesantías', v:Number(tasas.cesantias||8.33) },
                { l:'Int. Ces.', v:Number(tasas.intereses_ces||1) },
                { l:'Prima', v:Number(tasas.prima||8.33) },
                { l:'Vacaciones', v:Number(tasas.vacaciones||4.17) },
              ], color:T.blue },
            ].map((g, i) => (
              <div key={i} style={{ marginBottom:'14px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:g.color, marginBottom:'6px' }}>{g.grupo}</div>
                {g.items.map((it, j) => (
                  <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:`1px solid ${T.border}`, fontSize:'12px' }}>
                    <span style={{ color:T.muted }}>{it.l}</span>
                    <span style={{ color:g.color, fontWeight:'700' }}>{it.v.toFixed(2)}%</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:'12px', fontWeight:'700' }}>
                  <span style={{ color:T.muted }}>Subtotal</span>
                  <span style={{ color:g.color }}>{g.items.reduce((a,it)=>a+it.v,0).toFixed(2)}%</span>
                </div>
              </div>
            ))}
            <div style={{ padding:'10px 12px', background:`${T.red}08`, borderRadius:'8px', border:`1px solid ${T.red}20`, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:'12px', fontWeight:'700' }}>CARGA TOTAL EMPLEADOR</span>
              <span style={{ fontSize:'16px', fontWeight:'900', color:T.red }}>
                {(Number(tasas.salud_emp||8.5)+Number(tasas.pension_emp||12)+Number(tasas.sena||2)+Number(tasas.icbf||3)+Number(tasas.caja_comp||4)+Number(tasas.cesantias||8.33)+Number(tasas.intereses_ces||1)+Number(tasas.prima||8.33)+Number(tasas.vacaciones||4.17)).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
