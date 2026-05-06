'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const emailFromUsername = (u: string) => `${u.toLowerCase().trim()}@chatland.app`

  const validateUsername = (u: string) => {
    if (u.length < 3 || u.length > 20) return 'Username must be 3–20 characters'
    if (!/^[a-zA-Z0-9_-]+$/.test(u)) return 'Only letters, numbers, _ and - allowed'
    return null
  }

  const handleSignUp = async () => {
    const err = validateUsername(username)
    if (err) { setError(err); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    setError('')

    const { error: signUpError } = await supabase.auth.signUp({
      email: emailFromUsername(username),
      password,
    })

    if (signUpError) {
      setError(signUpError.message.includes('already registered') ? 'Username already taken' : signUpError.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  const handleLogIn = async () => {
    if (!username.trim() || !password) { setError('Please fill in all fields'); return }

    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: emailFromUsername(username),
      password,
    })

    if (signInError) {
      setError('Invalid username or password')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  const handleSubmit = tab === 'signup' ? handleSignUp : handleLogIn

  const inputClass = 'w-full bg-[#1e1f22] text-[#dbdee1] px-3 py-2.5 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] placeholder-[#4e5058] text-sm'
  const labelClass = 'block text-xs font-semibold uppercase text-[#b5bac1] mb-1.5'

  return (
    <div className="min-h-screen bg-[#313338] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white tracking-tight">ChatLand</h1>
          <p className="text-[#949ba4] mt-1 text-sm">
            {tab === 'login' ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

        <div className="bg-[#2b2d31] rounded-xl p-8 shadow-2xl">
          <div className="flex bg-[#1e1f22] rounded-lg p-1 mb-6">
            {(['login', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t ? 'bg-[#5865f2] text-white' : 'text-[#949ba4] hover:text-[#dbdee1]'
                }`}
              >
                {t === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="your_username"
                autoFocus
                autoComplete="username"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••"
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                className={inputClass}
              />
            </div>

            {tab === 'signup' && (
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-2.5 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm mt-1"
            >
              {loading
                ? (tab === 'signup' ? 'Creating account…' : 'Logging in…')
                : (tab === 'signup' ? 'Create Account' : 'Log In')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
