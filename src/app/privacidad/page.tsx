import Link from 'next/link'

const T = { bg: '#0D1E35', card: '#081426', accent: '#F58720', text: '#E8EDF5', muted: '#8FA5C2', border: '#152238' }

const sec: React.CSSProperties = { marginTop: '28px' }
const h2: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: T.accent, marginBottom: '10px' }
const p: React.CSSProperties = { fontSize: '14px', lineHeight: 1.7, color: T.text, marginBottom: '10px' }
const li: React.CSSProperties = { fontSize: '14px', lineHeight: 1.7, color: T.text, marginBottom: '6px' }

export const metadata = { title: 'Política de Privacidad — DIZGO' }

export default function PrivacidadPage() {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: '720px', width: '100%' }}>
        <Link href="/" style={{ fontSize: '13px', color: T.muted, textDecoration: 'none' }}>&larr; Volver a DIZGO</Link>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: T.text, margin: '16px 0 4px' }}>Política de Privacidad</h1>
        <p style={{ fontSize: '13px', color: T.muted, marginBottom: '20px' }}>Última actualización: 31 de julio de 2026</p>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '12px', padding: '28px 24px' }}>
          <p style={p}>
            DIZGO es una plataforma de gestión financiera y operativa para negocios de e-commerce y dropshipping
            en Latinoamérica. Esta política explica qué datos recopilamos, cómo los usamos y con quién los
            compartimos cuando usas nuestra aplicación (app.dizgo.app), nuestro sitio (www.dizgo.app) o te
            contactamos por WhatsApp.
          </p>

          <div style={sec}>
            <h2 style={h2}>1. Datos que recopilamos</h2>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              <li style={li}><strong>Datos de cuenta:</strong> nombre, correo, teléfono, país y datos de tu negocio al registrarte.</li>
              <li style={li}><strong>Datos operativos del negocio:</strong> pedidos, productos, costos, indicadores y demás información que ingresas para usar el dashboard.</li>
              <li style={li}><strong>Mensajes de WhatsApp:</strong> si nos escribes a nuestra línea de WhatsApp Business, guardamos la conversación para responderte y darte seguimiento.</li>
              <li style={li}><strong>Datos de pago:</strong> los procesan directamente Stripe o Wompi — DIZGO nunca almacena el número completo de tu tarjeta.</li>
              <li style={li}><strong>Datos de navegación:</strong> tu país aproximado (por IP, sin acceder a tu ubicación exacta) para mostrarte precios en tu moneda local.</li>
              <li style={li}><strong>Interacción con anuncios:</strong> si haces clic en un anuncio de DIZGO en Meta (Facebook/Instagram) que te dirige a WhatsApp, recibimos que llegaste por esa vía para medir qué campañas funcionan.</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2}>2. Para qué usamos tus datos</h2>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              <li style={li}>Darte acceso y soporte a la plataforma DIZGO.</li>
              <li style={li}>Responder tus mensajes y consultas por WhatsApp, incluyendo respuestas automáticas de nuestro agente de ventas.</li>
              <li style={li}>Procesar tu suscripción y facturación.</li>
              <li style={li}>Enviarte notificaciones operativas (colillas de pago, avisos de solicitudes, ajustes de registro).</li>
              <li style={li}>Medir el rendimiento de nuestras campañas publicitarias.</li>
              <li style={li}>Cumplir obligaciones legales y contables.</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2}>3. Con quién compartimos datos</h2>
            <p style={p}>No vendemos tus datos. Los compartimos únicamente con los proveedores que necesitamos para operar:</p>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              <li style={li}><strong>Meta</strong> (WhatsApp Business Platform y Marketing API), para enviar y recibir mensajes de WhatsApp y medir campañas.</li>
              <li style={li}><strong>Supabase</strong>, donde se almacena la base de datos de la plataforma, con acceso restringido por usuario.</li>
              <li style={li}><strong>Stripe y Wompi</strong>, para procesar pagos de forma segura.</li>
              <li style={li}><strong>Resend</strong>, para el envío de correos transaccionales (colillas, notificaciones).</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2}>4. Tus derechos</h2>
            <p style={p}>
              De acuerdo con la Ley 1581 de 2012 de Colombia (Habeas Data) y normativas equivalentes en otros
              países donde operamos, puedes en cualquier momento:
            </p>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              <li style={li}>Solicitar acceso a los datos que tenemos sobre ti.</li>
              <li style={li}>Pedir que corrijamos datos inexactos.</li>
              <li style={li}>Solicitar la eliminación de tus datos, salvo obligación legal de conservarlos.</li>
              <li style={li}>Revocar tu autorización para el tratamiento de tus datos.</li>
            </ul>
            <p style={{ ...p, marginTop: '10px' }}>
              Para ejercer cualquiera de estos derechos, escríbenos a{' '}
              <a href="mailto:joantorres9@gmail.com" style={{ color: T.accent }}>joantorres9@gmail.com</a>.
            </p>
          </div>

          <div style={sec}>
            <h2 style={h2}>5. Seguridad</h2>
            <p style={p}>
              Tus datos se almacenan cifrados y con políticas de acceso a nivel de fila (Row Level Security),
              de forma que cada negocio en DIZGO solo puede ver su propia información.
            </p>
          </div>

          <div style={sec}>
            <h2 style={h2}>6. Cambios a esta política</h2>
            <p style={p}>
              Podemos actualizar esta política ocasionalmente. Si hacemos cambios importantes, te avisaremos
              por correo o dentro de la plataforma.
            </p>
          </div>

          <div style={sec}>
            <h2 style={h2}>7. Contacto</h2>
            <p style={p}>
              Si tienes preguntas sobre esta política o sobre el tratamiento de tus datos, escríbenos a{' '}
              <a href="mailto:joantorres9@gmail.com" style={{ color: T.accent }}>joantorres9@gmail.com</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
