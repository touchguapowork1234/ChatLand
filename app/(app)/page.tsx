export default function AppHome() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 bg-[#404249] rounded-full flex items-center justify-center mb-6">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#949ba4">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-[#dbdee1] mb-2">Welcome to ChatLand</h2>
      <p className="text-[#949ba4] max-w-xs">
        Select a server from the left sidebar, or create one with the <span className="text-[#dbdee1]">+</span> button.
      </p>
    </div>
  )
}
