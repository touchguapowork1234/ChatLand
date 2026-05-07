'use client'

export default function ThemedMain({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#313338]">
      {children}
    </main>
  )
}
