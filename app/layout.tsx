import type { Metadata } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-jost',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Soulmate Tattoo | Realism & Surrealism',
  description:
    'Bespoke tattoo artistry by Camo. Specializing in realism and surrealism tattoos. Book your session today — a €50 reservation secures your date.',
  keywords: ['tattoo', 'realism tattoo', 'surrealism tattoo', 'Camo', 'Soulmate Tattoo', 'custom tattoo'],
  authors: [{ name: 'Camo', url: 'https://soulmatetattoo.com' }],
  openGraph: {
    title: 'Soulmate Tattoo | Realism & Surrealism',
    description: 'Bespoke tattoo artistry by Camo. Specializing in realism and surrealism tattoos.',
    type: 'website',
    locale: 'en_IE',
    siteName: 'Soulmate Tattoo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soulmate Tattoo | Realism & Surrealism',
    description: 'Bespoke tattoo artistry by Camo. Specializing in realism and surrealism tattoos.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable}`}>
      <body className="bg-[#080808] text-[#DADADA] font-jost antialiased">
        {children}
      </body>
    </html>
  )
}
