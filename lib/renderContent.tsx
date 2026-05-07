import React from 'react'

// Splits on URLs and @mentions, renders each appropriately.
// validMentions / currentUsername are optional — omit them for plain link-only rendering.
const TOKEN_RE = /(@\w+|https?:\/\/[^\s<>"']+)/g

export function renderContent(
  text: string,
  validMentions?: Set<string>,
  currentUsername?: string,
): React.ReactNode {
  const parts = text.split(TOKEN_RE)
  return parts.map((part, idx) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline break-all"
          onClick={e => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    if (/^@\w+$/.test(part) && validMentions) {
      const username = part.slice(1)
      if (!validMentions.has(username)) return part
      const isMe = !!currentUsername && username === currentUsername
      return (
        <span
          key={idx}
          className={`font-medium rounded-sm px-0.5 ${isMe ? 'text-[#f0b132] bg-[#f0b132]/10' : 'text-[#5865f2] bg-[#5865f2]/10'}`}
        >
          {part}
        </span>
      )
    }
    return part
  })
}
