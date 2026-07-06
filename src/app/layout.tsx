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
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${jetbrains.variable}`}>
      <body className="bg-dizgo-bg text-dizgo-text font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
