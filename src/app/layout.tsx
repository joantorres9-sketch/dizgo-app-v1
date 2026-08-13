import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '600'],
})

export const metadata: Metadata = {
  title: 'DIZGO — Hallazgo de dinero',
  description: 'Plataforma de gestión financiera y operativa para e-commerce y dropshipping en LATAM',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// Deja el atributo data-theme puesto ANTES del primer pintado (localStorage no está disponible
// en el server) -- sin esto, la página siempre arranca oscura y "salta" a claro un frame
// después si el usuario ya eligió modo claro, un parpadeo molesto (FOUC de tema).
const SCRIPT_TEMA_INICIAL = `
(function(){
  try {
    var t = localStorage.getItem('dizgo_tema');
    if (t !== 'claro' && t !== 'oscuro') {
      t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning es a propósito: el script de abajo reescribe data-theme antes de
    // que React hidrate (localStorage/prefers-color-scheme no existen en el server), así que un
    // mismatch entre el "oscuro" del server y lo que el script ya puso es esperado, no un bug.
    <html lang="es" className={`${spaceGrotesk.variable} ${jetbrains.variable}`} data-theme="oscuro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
