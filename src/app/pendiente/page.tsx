'use client'
import Link from 'next/link'

const T = { bg:'#0D1E35',card:'#081426',accent:'#F58720',green:'#2DD4A0',yellow:'#F5A623',text:'#E8EDF5',muted:'#5A7A9A',border:'#152238' }

export default function PendientePage() {
  const radicado = `DIZGO-${Date.now().toString().slice(-6)}`
  return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ width:'440px', textAlign:'center' }}>
        <div style={{ width:'64px', height:'64px', background: T.accent, borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', fontSize:'22px', color: T.card, margin:'0 auto 16px' }}>DZ</div>
        <div style={{ fontWeight:'800', fontSize:'22px', color: T.text, marginBottom:'4px' }}>DI<span style={{ color: T.accent }}>Z</span>GO</div>
        <div style={{ fontSize:'12px', color: T.muted, marginBottom:'28px' }}>Hallazgo de dinero</div>

        <div style={{ background: T.card, border:`1px solid ${T.border}`, borderRadius:'16px', padding:'28px 24px' }}>
          <div style={{ width:'56px', height:'56px', background:`${T.yellow}18`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <span style={{ fontSize:'28px' }}>⏳</span>
          </div>
          <div style={{ fontSize:'16px', fontWeight:'700', color: T.text, marginBottom:'8px' }}>Solicitud enviada</div>
          <div style={{ fontSize:'13px', color: T.muted, lineHeight:1.7, marginBottom:'20px' }}>
            Tu solicitud está en revisión. El equipo DIZGO verificará tus documentos y activará tu cuenta en <strong style={{ color: T.text }}>1 a 2 días hábiles</strong>.
          </div>

          <div style={{ background:`${T.yellow}10`, border:`1px solid ${T.yellow}30`, borderRadius:'10px', padding:'12px 16px', marginBottom:'20px' }}>
            <div style={{ fontSize:'10px', color: T.muted, marginBottom:'4px' }}>Número de radicado</div>
            <div style={{ fontSize:'16px', fontWeight:'700', color: T.yellow, letterSpacing:'1px' }}>{radicado}</div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
            {[
              { n:'1', t:'Solicitud recibida', d:'Tu formulario y documentos han sido recibidos', done:true },
              { n:'2', t:'En revisión', d:'DIZGO verifica tus datos y documentos', done:false },
              { n:'3', t:'Activación', d:'Recibirás un email con acceso completo', done:false },
            ].map(s => (
              <div key={s.n} style={{ display:'flex', alignItems:'flex-start', gap:'10px', textAlign:'left' }}>
                <div style={{ width:'24px', height:'24px', borderRadius:'50%', background: s.done ? `${T.green}25` : `${T.yellow}20`, border:`1.5px solid ${s.done ? T.green : T.yellow}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>
                  <span style={{ fontSize:'11px', color: s.done ? T.green : T.yellow, fontWeight:'700' }}>{s.done ? '✓' : s.n}</span>
                </div>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:'600', color: T.text }}>{s.t}</div>
                  <div style={{ fontSize:'11px', color: T.muted }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize:'11px', color: T.muted, lineHeight:1.6 }}>
            ¿Tienes dudas? Escríbenos a{' '}
            <a href="mailto:joantorres9@gmail.com" style={{ color: T.accent }}>joantorres9@gmail.com</a>
          </div>
        </div>

        <div style={{ marginTop:'16px' }}>
          <Link href="/auth/login" style={{ fontSize:'11px', color: T.muted, textDecoration:'underline' }}>Volver al login</Link>
        </div>
      </div>
    </div>
  )
}
