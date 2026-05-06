'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Call, Profile } from '@/lib/types'
import { userTag } from '@/lib/types'

type CallState = 'idle' | 'calling' | 'ringing' | 'active'

interface CallCtx {
  callState: CallState
  callingUserId: string | null
  incomingCallerId: string | null
  isMuted: boolean
  duration: number
  startCall: (receiverId: string, receiverProfile: Profile) => Promise<void>
  endCall: () => Promise<void>
  acceptCall: () => Promise<void>
  declineCall: () => Promise<void>
  toggleMute: () => void
}

const CallContext = createContext<CallCtx>({
  callState: 'idle', callingUserId: null, incomingCallerId: null,
  isMuted: false, duration: 0,
  startCall: async () => {}, endCall: async () => {}, acceptCall: async () => {},
  declineCall: async () => {}, toggleMute: () => {},
})
export const useCall = () => useContext(CallContext)

const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export default function CallProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = createClient()

  const [callState, setCallState]         = useState<CallState>('idle')
  const [otherUser, setOtherUser]         = useState<Profile | null>(null)
  const [callingUserId, setCallingUserId] = useState<string | null>(null)
  const [incomingCallerId, setIncomingCallerId] = useState<string | null>(null)
  const [incomingData, setIncomingData]   = useState<{ call: Call; caller: Profile } | null>(null)
  const [showModal, setShowModal]         = useState(false)
  const [isMuted, setIsMuted]             = useState(false)
  const [duration, setDuration]           = useState(0)

  const pcRef       = useRef<RTCPeerConnection | null>(null)
  const localRef    = useRef<MediaStream | null>(null)
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const callIdRef   = useRef<string | null>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  // Only call-specific subs — incoming call sub is tracked separately
  const callSubsRef = useRef<ReturnType<typeof supabase.channel>[]>([])

  const removeSubs = () => {
    callSubsRef.current.forEach(c => supabase.removeChannel(c))
    callSubsRef.current = []
  }

  const cleanup = () => {
    localRef.current?.getTracks().forEach(t => t.stop())
    localRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    removeSubs()
    callIdRef.current = null
    setCallState('idle')
    setOtherUser(null)
    setCallingUserId(null)
    setIncomingCallerId(null)
    setIsMuted(false)
    setDuration(0)
  }

  // Persistent incoming-call subscription — never in callSubsRef, so cleanup() won't kill it
  useEffect(() => {
    const ch = supabase
      .channel(`incoming_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'calls',
        filter: `receiver_id=eq.${userId}`,
      }, async payload => {
        const call = payload.new as Call
        if (call.status !== 'ringing') return
        const { data: caller } = await supabase.from('profiles').select('*').eq('id', call.caller_id).single()
        setIncomingData({ call, caller: caller as Profile })
        setIncomingCallerId(call.caller_id)
        setCallState('ringing')
        setShowModal(true)
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const makePC = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE })
    pc.ontrack = e => { if (audioRef.current) audioRef.current.srcObject = e.streams[0] }
    pcRef.current = pc
    return pc
  }

  const setupIce = (callId: string, pc: RTCPeerConnection, buffered: RTCIceCandidate[]) => {
    // Flush any ICE candidates that arrived before we had the call ID
    buffered.forEach(c =>
      supabase.from('ice_candidates').insert({ call_id: callId, from_user: userId, candidate: c })
    )

    pc.onicecandidate = ({ candidate }) => {
      if (candidate)
        supabase.from('ice_candidates').insert({ call_id: callId, from_user: userId, candidate })
    }

    const ch = supabase.channel(`ice_${callId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'ice_candidates',
        filter: `call_id=eq.${callId}`,
      }, payload => {
        const row = payload.new as { from_user: string; candidate: RTCIceCandidateInit }
        if (row.from_user !== userId)
          pc.addIceCandidate(new RTCIceCandidate(row.candidate)).catch(() => {})
      })
      .subscribe()
    callSubsRef.current.push(ch)
  }

  const startCall = async (receiverId: string, receiverProfile: Profile) => {
    if (callState !== 'idle') return
    setCallState('calling')
    setOtherUser(receiverProfile)
    setCallingUserId(receiverId)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localRef.current = stream
      const pc = makePC()
      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      // Buffer ICE candidates that fire before we have the call ID
      const iceBuffer: RTCIceCandidate[] = []
      pc.onicecandidate = ({ candidate }) => { if (candidate) iceBuffer.push(candidate) }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const { data: call } = await supabase
        .from('calls')
        .insert({ caller_id: userId, receiver_id: receiverId, offer, status: 'ringing' })
        .select().single()

      if (!call) { cleanup(); return }
      callIdRef.current = call.id
      setupIce(call.id, pc, iceBuffer)

      const updCh = supabase.channel(`callupd_${call.id}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'calls',
          filter: `id=eq.${call.id}`,
        }, async payload => {
          const upd = payload.new as Call
          if (upd.status === 'active' && upd.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(upd.answer))
            setCallState('active')
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
          }
          if (['ended', 'declined', 'missed'].includes(upd.status)) cleanup()
        })
        .subscribe()
      callSubsRef.current.push(updCh)

    } catch { cleanup() }
  }

  const acceptCall = async () => {
    if (!incomingData) return
    const { call, caller } = incomingData
    setIncomingData(null)
    setShowModal(false)
    setCallState('active')
    setOtherUser(caller)
    callIdRef.current = call.id

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localRef.current = stream
      const pc = makePC()
      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      // Read ICE candidates already stored by caller
      const { data: stored } = await supabase
        .from('ice_candidates').select('*').eq('call_id', call.id).neq('from_user', userId)

      // Set up persistent ICE handler (no buffered candidates from our side yet)
      setupIce(call.id, pc, [])

      await pc.setRemoteDescription(new RTCSessionDescription(call.offer!))
      stored?.forEach(r => pc.addIceCandidate(new RTCIceCandidate(r.candidate)).catch(() => {}))

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await supabase.from('calls').update({ status: 'active', answer }).eq('id', call.id)

      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch { cleanup() }
  }

  const declineCall = async () => {
    if (!incomingData) return
    await supabase.from('calls')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', incomingData.call.id)
    setIncomingData(null)
    setShowModal(false)
    setIncomingCallerId(null)
    setCallState('idle')
  }

  const endCall = async () => {
    if (callIdRef.current)
      await supabase.from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', callIdRef.current)
    cleanup()
  }

  const toggleMute = () => {
    localRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(v => !v)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <CallContext.Provider value={{
      callState, callingUserId, incomingCallerId, isMuted, duration,
      startCall, endCall, acceptCall, declineCall, toggleMute,
    }}>
      {children}
      <audio ref={audioRef} autoPlay />

      {/* Full-screen incoming call modal — shown when NOT in that DM */}
      {showModal && incomingData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2b2d31] rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center relative">
            <button onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-[#949ba4] hover:text-[#dbdee1]">
              <X className="w-4 h-4" />
            </button>
            <div className="w-20 h-20 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
              {incomingData.caller.username.charAt(0).toUpperCase()}
            </div>
            <p className="text-[#949ba4] text-sm mb-1">Incoming voice call</p>
            <p className="text-xl font-bold text-[#dbdee1] mb-8">{userTag(incomingData.caller)}</p>
            <div className="flex gap-6 justify-center">
              <button onClick={declineCall}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors">
                <PhoneOff className="w-6 h-6" />
              </button>
              <button onClick={acceptCall}
                className="w-14 h-14 rounded-full bg-[#23a55a] hover:bg-[#1e8f4e] flex items-center justify-center text-white transition-colors">
                <Phone className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating overlay for calls NOT in the current DM view */}
      {(callState === 'calling' || callState === 'active') && otherUser && (
        <div className="fixed bottom-6 right-6 bg-[#232428] border border-[#3f4147] rounded-2xl p-4 shadow-2xl z-40 w-60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white font-bold shrink-0 text-sm select-none">
              {otherUser.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[#dbdee1] text-sm truncate">{userTag(otherUser)}</p>
              <p className="text-xs text-[#949ba4]">
                {callState === 'calling' ? 'Calling…' : fmt(duration)}
              </p>
            </div>
            {callState === 'active' && (
              <div className="ml-auto w-2 h-2 rounded-full bg-[#23a55a] animate-pulse shrink-0" />
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={toggleMute}
              className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                isMuted ? 'bg-red-500/20 text-red-400' : 'bg-[#383a40] text-[#dbdee1] hover:bg-[#404249]'
              }`}>
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={endCall}
              className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-1 transition-colors">
              <PhoneOff className="w-3.5 h-3.5" />End
            </button>
          </div>
        </div>
      )}
    </CallContext.Provider>
  )
}
