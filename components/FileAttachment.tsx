import AudioPlayer from './AudioPlayer'

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
    return <AudioPlayer url={url} name={name} />
  }
  return null
}
