'use client'

export default function ThemedMain({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex-1 flex flex-col overflow-hidden min-w-0"
      style={{
        background: 'linear-gradient(160deg, var(--theme-primary) 0%, #313338 30%)',
      }}
    >
      {children}
    </main>
  )
}
