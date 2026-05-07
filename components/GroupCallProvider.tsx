'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { displayName } from '@/lib/types'
import type { Profile } from '@/lib/types'

type IncomingGroupCall = {
  callId: string
  groupId: string
  groupName: string
  starterName: string
  starterAvatar: string | null
}

interface GroupCallCtx {
  gcInCall: boolean
  gcGroupId: string | null
  gcGroupName: string | null
  gcMuted: boolean
  startGroupCall: (groupId: string, groupName: string) => Promise<void>
  joinGroupCall: (callId: string, groupId: string, groupName: string) => Promise<void>
  leaveGroupCall: () => Promise<void>
  toggleGcMute: () => void
}

const GroupCallContext = createContext<GroupCallCtx>({
  gcInCall: false,
  gcGroupId: null,
  gcGroupName: null,
  gcMuted: false,
  startGroupCall: async () => {},
  joinGroupCall: async () => {},
  leaveGroupCall: async () => {},
  toggleGcMute: () => {},
})

export const useGroupCall = () => useContext(GroupCallContext)

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
]

export default function GroupCallProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = createClient()

  const [gcInCall, setGcInCall]       = useState(false)
  const [gcGroupId, setGcGroupId]     = useState<string | null>(null)
  const [gcGroupName, setGcGroupName] = useState<string | null>(null)
  const [gcMuted, setGcMuted]         = useState(false)

  // incoming ring state
  const [gcRinging, setGcRinging]           = useState(false)
  const [gcIncoming, setGcIncomingState]    = useState<IncomingGroupCall | null>(null)
  const gcIncomingRef  = useRef<IncomingGroupCall | null>(null)
  const gcInCallRef    = useRef(false)
  const ringRef        = useRef<HTMLAudioElement | null>(null)

  const setGcIncoming = (v: IncomingGroupCall | null) => {
    gcIncomingRef.current = v
    setGcIncomingState(v)
  }

  // keep gcInCallRef in sync
  useEffect(() => { gcInCallRef.current = gcInCall }, [gcInCall])

  // ring sound
  useEffect(() => {
    if (gcRinging) {
      const audio = new Audio('/incoming_ring_new.wav')
      audio.loop = true
      audio.play().catch(() => {})
      ringRef.current = audio
    } else {
      if (ringRef.current) {
        ringRef.current.pause()
        ringRef.current.currentTime = 0
        ringRef.current = null
      }
    }
    return () => {
      if (ringRef.current) {
        ringRef.current.pause()
        ringRef.current = null
      }
    }
  }, [gcRinging])

  // listen for incoming group call notifications on personal channel
  useEffect(() => {
    const ch = supabase.channel(`gcnotify:${userId}`)
      .on('broadcast', { event: 'incoming_group_call' }, ({ payload }) => {
        if (gcInCallRef.current) return
        setGcIncoming({
          callId:      payload.callId,
          groupId:     payload.groupId,
          groupName:   payload.groupName,
          starterName: payload.starterName,
          starterAvatar: payload.starterAvatar ?? null,
        })
        setGcRinging(true)
      })
      .on('broadcast', { event: 'group_call_ended' }, ({ payload }) => {
        if (gcIncomingRef.current?.callId === payload.callId) {
          setGcRinging(false)
          setGcIncoming(null)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [userId])

  // refs — persist across renders without triggering re-renders
  const gcCallIdRef  = useRef<string | null>(null)
  const gcGroupIdRef = useRef<string | null>(null)
  const gcLocal      = useRef<MediaStream | null>(null)
  const gcChannel    = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // peer connections map: targetUserId -> RTCPeerConnection
  const gcPeers = useRef<Map<string, RTCPeerConnection>>(new Map())
  // audio elements map: targetUserId -> HTMLAudioElement
  const gcAudios = useRef<Map<string, HTMLAudioElement>>(new Map())
  // local ICE buffers (before answer arrives): targetUserId -> candidates[]
  const localIceBuffers = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  // remote ICE buffers (before remote desc set): targetUserId -> candidates[]
  const remoteIceBuffers = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  // track which peers have switched to live ICE
  const liveIcePeers = useRef<Set<string>>(new Set())

  // ─── notifyGroupMembers ─────────────────────────────────────────────────────
  const notifyGroupMembers = async (
    groupId: string,
    event: string,
    payload: Record<string, unknown>
  ) => {
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)

    if (!members) return

    for (const { user_id } of members) {
      if (user_id === userId) continue
      const ch = supabase.channel(`gcnotify:${user_id}`)
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event, payload })
          setTimeout(() => supabase.removeChannel(ch), 1500)
        }
      })
    }
  }

  // ─── makeGcPeer ─────────────────────────────────────────────────────────────
  const makeGcPeer = (targetUserId: string): RTCPeerConnection => {
    const existing = gcPeers.current.get(targetUserId)
    if (existing) return existing

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.ontrack = (e) => {
      let audio = gcAudios.current.get(targetUserId)
      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        gcAudios.current.set(targetUserId, audio)
      }
      audio.srcObject = e.streams[0]
      audio.play().catch(() => {})
    }

    gcPeers.current.set(targetUserId, pc)
    return pc
  }

  // ─── _doJoin ────────────────────────────────────────────────────────────────
  const _doJoin = async (callId: string, groupId: string, groupName: string) => {
    // 1. Get microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    gcLocal.current = stream

    // 2. Store refs
    gcCallIdRef.current  = callId
    gcGroupIdRef.current = groupId

    // 3. Upsert own participant row
    await supabase
      .from('group_call_participants')
      .upsert({ call_id: callId, user_id: userId }, { onConflict: 'call_id,user_id' })

    // 4. Get own profile (for broadcasting with join event)
    const { data: ownProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // 5. Subscribe to broadcast channel
    const ch = supabase.channel(`gcall:${callId}`)
    gcChannel.current = ch

    // ── join: someone else joined — I should send them an offer ──
    ch.on('broadcast', { event: 'join' }, async ({ payload }) => {
      const fromId: string = payload.from
      if (fromId === userId) return

      const pc = makeGcPeer(fromId)

      // Add local tracks
      gcLocal.current?.getTracks().forEach(t => {
        pc.getSenders().find(s => s.track === t) || pc.addTrack(t, gcLocal.current!)
      })

      // Buffer local ICE until answer arrives
      const iceBuffer: RTCIceCandidateInit[] = []
      localIceBuffers.current.set(fromId, iceBuffer)

      pc.onicecandidate = ({ candidate }) => {
        if (!candidate) return
        if (liveIcePeers.current.has(fromId)) {
          ch.send({
            type: 'broadcast', event: 'ice',
            payload: { from: userId, to: fromId, candidate: candidate.toJSON() },
          })
        } else {
          iceBuffer.push(candidate.toJSON())
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      ch.send({
        type: 'broadcast', event: 'offer',
        payload: { from: userId, to: fromId, sdp: offer.sdp, type: offer.type },
      })
    })

    // ── offer: I'm the new joiner — someone sent me an offer ──
    ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (payload.to !== userId) return

      const fromId: string = payload.from
      const pc = makeGcPeer(fromId)

      // Add local tracks if not already added
      gcLocal.current?.getTracks().forEach(t => {
        pc.getSenders().find(s => s.track === t) || pc.addTrack(t, gcLocal.current!)
      })

      // Buffer local ICE until we flush after setLocalDescription
      const iceBuffer: RTCIceCandidateInit[] = []
      localIceBuffers.current.set(fromId, iceBuffer)

      pc.onicecandidate = ({ candidate }) => {
        if (!candidate) return
        if (liveIcePeers.current.has(fromId)) {
          ch.send({
            type: 'broadcast', event: 'ice',
            payload: { from: userId, to: fromId, candidate: candidate.toJSON() },
          })
        } else {
          iceBuffer.push(candidate.toJSON())
        }
      }

      await pc.setRemoteDescription({ type: payload.type, sdp: payload.sdp })

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      ch.send({
        type: 'broadcast', event: 'answer',
        payload: { from: userId, to: fromId, sdp: answer.sdp, type: answer.type },
      })

      // Flush local ICE buffer
      const buffered = localIceBuffers.current.get(fromId) ?? []
      for (const c of buffered) {
        ch.send({
          type: 'broadcast', event: 'ice',
          payload: { from: userId, to: fromId, candidate: c },
        })
      }
      localIceBuffers.current.delete(fromId)
      liveIcePeers.current.add(fromId)

      // Flush remote ICE buffer
      const remBuf = remoteIceBuffers.current.get(fromId) ?? []
      for (const c of remBuf) {
        pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
      }
      remoteIceBuffers.current.delete(fromId)
    })

    // ── answer: they responded to my offer ──
    ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (payload.to !== userId) return

      const fromId: string = payload.from
      const pc = gcPeers.current.get(fromId)
      if (!pc) return

      await pc.setRemoteDescription({ type: payload.type, sdp: payload.sdp })

      // Flush local ICE buffer
      const buffered = localIceBuffers.current.get(fromId) ?? []
      for (const c of buffered) {
        ch.send({
          type: 'broadcast', event: 'ice',
          payload: { from: userId, to: fromId, candidate: c },
        })
      }
      localIceBuffers.current.delete(fromId)
      liveIcePeers.current.add(fromId)

      // Flush remote ICE buffer
      const remBuf = remoteIceBuffers.current.get(fromId) ?? []
      for (const c of remBuf) {
        pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
      }
      remoteIceBuffers.current.delete(fromId)
    })

    // ── ice: targeted ICE candidate ──
    ch.on('broadcast', { event: 'ice' }, ({ payload }) => {
      if (payload.to !== userId) return

      const fromId: string = payload.from
      const pc = gcPeers.current.get(fromId)
      if (!pc) return

      if (!pc.remoteDescription) {
        const buf = remoteIceBuffers.current.get(fromId) ?? []
        buf.push(payload.candidate)
        remoteIceBuffers.current.set(fromId, buf)
      } else {
        pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
      }
    })

    // ── leave: someone left ──
    ch.on('broadcast', { event: 'leave' }, ({ payload }) => {
      const fromId: string = payload.from
      const pc = gcPeers.current.get(fromId)
      if (pc) {
        pc.close()
        gcPeers.current.delete(fromId)
      }
      const audio = gcAudios.current.get(fromId)
      if (audio) {
        audio.pause()
        audio.srcObject = null
        gcAudios.current.delete(fromId)
      }
      localIceBuffers.current.delete(fromId)
      remoteIceBuffers.current.delete(fromId)
      liveIcePeers.current.delete(fromId)
    })

    // 6. Subscribe — once subscribed, broadcast join and update state
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast', event: 'join',
          payload: { from: userId, profile: ownProfile },
        })
        setGcInCall(true)
        setGcGroupId(groupId)
        setGcGroupName(groupName)
      }
    })
  }

  // ─── startGroupCall ──────────────────────────────────────────────────────────
  const startGroupCall = async (groupId: string, groupName: string) => {
    if (gcInCall) return

    const { data: ownProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Insert call record
    const { data: call } = await supabase
      .from('group_calls')
      .insert({ group_id: groupId, started_by: userId, status: 'active' })
      .select()
      .single()

    if (!call) return

    // Insert system message
    const myName = displayName(ownProfile as Profile)
    await supabase.from('group_messages').insert({
      group_id: groupId,
      sender_id: userId,
      content: `${myName} started a voice call`,
      type: 'system',
    })

    // Notify all group members so they get an incoming ring
    await notifyGroupMembers(groupId, 'incoming_group_call', {
      callId:       call.id,
      groupId,
      groupName,
      starterName:  myName,
      starterAvatar: (ownProfile as Profile)?.avatar_url ?? null,
    })

    await _doJoin(call.id, groupId, groupName)
  }

  // ─── joinGroupCall ───────────────────────────────────────────────────────────
  const joinGroupCall = async (callId: string, groupId: string, groupName: string) => {
    if (gcInCall) return
    await _doJoin(callId, groupId, groupName)
  }

  // ─── leaveGroupCall ──────────────────────────────────────────────────────────
  const leaveGroupCall = async () => {
    const callId  = gcCallIdRef.current
    const groupId = gcGroupIdRef.current

    // Broadcast leave
    if (gcChannel.current && callId) {
      gcChannel.current.send({
        type: 'broadcast', event: 'leave',
        payload: { from: userId },
      })
    }

    // Delete own participant row
    if (callId) {
      await supabase
        .from('group_call_participants')
        .delete()
        .eq('call_id', callId)
        .eq('user_id', userId)
    }

    // Close all peer connections and stop local audio
    gcPeers.current.forEach(pc => pc.close())
    gcPeers.current.clear()

    gcAudios.current.forEach(a => { a.pause(); a.srcObject = null })
    gcAudios.current.clear()

    gcLocal.current?.getTracks().forEach(t => t.stop())
    gcLocal.current = null

    if (gcChannel.current) {
      supabase.removeChannel(gcChannel.current)
      gcChannel.current = null
    }

    localIceBuffers.current.clear()
    remoteIceBuffers.current.clear()
    liveIcePeers.current.clear()

    // Check if anyone else remains — if not, mark call ended
    if (callId && groupId) {
      const { data: remaining } = await supabase
        .from('group_call_participants')
        .select('id')
        .eq('call_id', callId)

      if (!remaining || remaining.length === 0) {
        await supabase
          .from('group_calls')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', callId)

        // Dismiss ringing modals for anyone who hasn't answered yet
        await notifyGroupMembers(groupId, 'group_call_ended', { callId })

        const { data: ownProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        const myName = displayName(ownProfile as Profile)
        await supabase.from('group_messages').insert({
          group_id: groupId,
          sender_id: userId,
          content: `${myName} ended the voice call`,
          type: 'system',
        })
      }
    }

    gcCallIdRef.current  = null
    gcGroupIdRef.current = null
    setGcInCall(false)
    setGcGroupId(null)
    setGcGroupName(null)
    setGcMuted(false)
  }

  // ─── acceptGroupCall ─────────────────────────────────────────────────────────
  const acceptGroupCall = async () => {
    const inc = gcIncomingRef.current
    if (!inc) return

    // Verify call is still active before joining
    const { data: callData } = await supabase
      .from('group_calls')
      .select('status')
      .eq('id', inc.callId)
      .single()

    setGcRinging(false)
    setGcIncoming(null)

    if (!callData || callData.status !== 'active') return

    await joinGroupCall(inc.callId, inc.groupId, inc.groupName)
  }

  // ─── declineGroupCall ────────────────────────────────────────────────────────
  const declineGroupCall = () => {
    setGcRinging(false)
    setGcIncoming(null)
  }

  // ─── toggleGcMute ───────────────────────────────────────────────────────────
  const toggleGcMute = () => {
    gcLocal.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setGcMuted(v => !v)
  }

  // ─── beforeunload cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    const onUnload = () => {
      const callId = gcCallIdRef.current
      if (!callId) return

      if (gcChannel.current) {
        gcChannel.current.send({
          type: 'broadcast', event: 'leave',
          payload: { from: userId },
        })
      }
      supabase
        .from('group_call_participants')
        .delete()
        .eq('call_id', callId)
        .eq('user_id', userId)
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [userId])

  return (
    <GroupCallContext.Provider value={{
      gcInCall, gcGroupId, gcGroupName, gcMuted,
      startGroupCall, joinGroupCall, leaveGroupCall, toggleGcMute,
    }}>
      {children}

      {/* Incoming group call modal */}
      {gcRinging && gcIncoming && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2b2d31] rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-20 h-20 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center mx-auto mb-4">
              {gcIncoming.starterAvatar
                ? <img src={gcIncoming.starterAvatar} alt="" className="w-full h-full object-cover rounded-full" />
                : <Users className="w-8 h-8 text-white" />}
            </div>
            <p className="text-[#949ba4] text-sm mb-1">Incoming group call</p>
            <p className="text-xl font-bold text-[#dbdee1] mb-1">{gcIncoming.groupName}</p>
            <p className="text-sm text-[#949ba4] mb-8">Started by {gcIncoming.starterName}</p>
            <div className="flex gap-6 justify-center">
              <button
                onClick={declineGroupCall}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <button
                onClick={acceptGroupCall}
                className="w-14 h-14 rounded-full bg-[#23a55a] hover:bg-[#1e8f4e] flex items-center justify-center text-white transition-colors"
              >
                <Phone className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating overlay for active call */}
      {gcInCall && gcGroupName && (
        <div className="fixed bottom-6 right-6 bg-[#232428] border border-[#3f4147] rounded-2xl p-4 shadow-2xl z-40 w-60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#23a55a] animate-pulse shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#dbdee1] text-sm truncate">{gcGroupName}</p>
              <p className="text-xs text-[#949ba4]">Voice Call</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleGcMute}
              className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                gcMuted
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-[#383a40] text-[#dbdee1] hover:bg-[#404249]'
              }`}
            >
              {gcMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {gcMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={leaveGroupCall}
              className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-1 transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />Leave
            </button>
          </div>
        </div>
      )}
    </GroupCallContext.Provider>
  )
}
