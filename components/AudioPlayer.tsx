'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react'

interface Props {
  url: string
  name: string
}

export default function AudioPlayer({ url, name }: Props) {
  const audioRef   = useRef<HTMLAudioElement>(null)
  const trackRef   = useRef<HTMLDivElement>(null)
  const [playing, setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]   = useState(0)
  const [muted, setMuted]         = useState(false)
  const [dragging, setDragging]   = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime   = () => setCurrentTime(audio.currentTime)
    const onLoaded = () => setDuration(audio.duration || 0)
    const onEnded  = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('durationchange', onLoaded)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('durationchange', onLoaded)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      await audio.play()
      setPlaying(true)
    }
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !muted
    setMuted(m => !m)
  }

  const getPct = (clientX: number): number | null => {
    const track = trackRef.current
    if (!track || !duration) return null
    const rect = track.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  const seekTo = (pct: number) => {
    const audio = audioRef.current
    if (!audio) return
    const t = pct * duration
    audio.currentTime = t
    setCurrentTime(t)
  }

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    const pct = getPct(e.clientX)
    if (pct !== null) seekTo(pct)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const pct = getPct(e.clientX)
      if (pct !== null) seekTo(pct)
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, duration])

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="
      mt-1.5 rounded-xl p-3 w-72 select-none
      bg-white border border-gray-200 shadow-sm
      dark:bg-[#1e1f22] dark:border-[#2e3035] dark:shadow-none
    ">
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* File name row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0
          bg-[#5865f2]/15 dark:bg-[#5865f2]/20">
          <Music className="w-3.5 h-3.5 text-[#5865f2]" />
        </div>
        <p className="text-xs font-semibold truncate flex-1
          text-gray-800 dark:text-[#dbdee1]">
          {name}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2.5">

        {/* Play / pause */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors
            bg-[#5865f2] hover:bg-[#4752c4]"
        >
          {playing
            ? <Pause  className="w-3.5 h-3.5 text-white fill-white" />
            : <Play   className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
          }
        </button>

        {/* Progress track */}
        <div
          ref={trackRef}
          onMouseDown={handleTrackMouseDown}
          className="flex-1 h-1.5 rounded-full relative cursor-pointer group
            bg-gray-200 dark:bg-[#3f4147]"
        >
          {/* Fill */}
          <div
            className="h-full rounded-full bg-[#5865f2] relative transition-none"
            style={{ width: `${pct}%` }}
          >
            {/* Thumb */}
            <div className="
              absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
              w-3 h-3 rounded-full shadow
              bg-[#5865f2]
              scale-0 group-hover:scale-100 transition-transform origin-center
            " />
          </div>
        </div>

        {/* Time */}
        <span className="text-[10px] tabular-nums shrink-0
          text-gray-500 dark:text-[#949ba4]">
          {fmt(currentTime)}<span className="opacity-50"> / </span>{fmt(duration)}
        </span>

        {/* Mute */}
        <button
          onClick={toggleMute}
          className="p-1 rounded-md transition-colors shrink-0
            text-gray-400 hover:text-gray-700 hover:bg-gray-100
            dark:text-[#949ba4] dark:hover:text-[#dbdee1] dark:hover:bg-[#383a40]"
        >
          {muted
            ? <VolumeX className="w-3.5 h-3.5" />
            : <Volume2 className="w-3.5 h-3.5" />
          }
        </button>
      </div>
    </div>
  )
}
