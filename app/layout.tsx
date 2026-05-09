import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import RainbowSync from '@/components/RainbowSync'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ChatLand',
  description: 'A Discord-inspired chat platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#313338] text-[#dbdee1] antialiased`}>
        <RainbowSync />
        {children}
      </body>
    </html>
  )
}
