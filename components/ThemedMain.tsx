'use client'

export default function ThemedMain({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex-1 flex flex-col overflow-hidden min-w-0"
      style={{
        background: [
          'linear-gradient(135deg,',
          'color-mix(in srgb, var(--theme-primary) 18%, #313338),',
          'color-mix(in srgb, var(--theme-secondary) 12%, #313338)',
          ')',
        ].join(' '),
      }}
    >
      {children}
    </main>
  )
}
