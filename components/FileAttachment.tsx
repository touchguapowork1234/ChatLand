interface Props {
  url: string
  name: string
  type: string
}

export default function FileAttachment({ url, name, type }: Props) {
  if (type.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={name}
        className="mt-1.5 rounded-md max-w-xs max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity block"
        onClick={() => window.open(url, '_blank')}
      />
    )
  }
  if (type.startsWith('audio/')) {
    return (
      <div className="mt-1.5 bg-[#1e1f22] rounded-md p-3 max-w-xs">
        <p className="text-xs text-[#949ba4] mb-2 truncate">{name}</p>
        <audio controls src={url} className="w-full h-8" />
      </div>
    )
  }
  return null
}
