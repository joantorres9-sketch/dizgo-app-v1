'use client'

const T = { bg:'#0D1E35', card:'#081426', accent:'#F58720', blue:'#3D8EF0', text:'#E8EDF5', muted:'#5A7A9A', border:'#152238' }

export default function FormacionPage() {
  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
        <span style={{ fontSize:'22px' }}>🎓</span>
        <h1 style={{ fontSize:'20px', fontWeight:'800', margin:0 }}>Formación</h1>
      </div>
      <p style={{ fontSize:'13px', color:T.muted, marginBottom:'24px' }}>
        Cursos y mentoría para sacarle el máximo provecho a DIZGO.
      </p>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'40px 28px', textAlign:'center', maxWidth:'520px' }}>
        <div style={{ fontSize:'36px', marginBottom:'14px' }}>🚧</div>
        <div style={{ fontSize:'15px', fontWeight:'700', marginBottom:'8px' }}>Próximamente</div>
        <div style={{ fontSize:'13px', color:T.muted, lineHeight:1.6 }}>
          Estamos preparando los cursos y la mentoría de DIZGO.
        </div>
      </div>
    </div>
  )
}
