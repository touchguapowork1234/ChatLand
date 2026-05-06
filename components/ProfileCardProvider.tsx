'use client'

import { createContext, useContext, useState } from 'react'
import ProfileCard from './ProfileCard'

interface Ctx {
  openProfile: (userId: string) => void
}

const ProfileCardContext = createContext<Ctx>({ openProfile: () => {} })

export const useProfileCard = () => useContext(ProfileCardContext)

export default function ProfileCardProvider({
  children,
  currentUserId,
}: {
  children: React.ReactNode
  currentUserId: string
}) {
  const [targetId, setTargetId] = useState<string | null>(null)

  return (
    <ProfileCardContext.Provider value={{ openProfile: setTargetId }}>
      {children}
      {targetId && (
        <ProfileCard
          userId={targetId}
          currentUserId={currentUserId}
          onClose={() => setTargetId(null)}
        />
      )}
    </ProfileCardContext.Provider>
  )
}
