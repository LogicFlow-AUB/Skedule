import { useState } from 'react'
import { CalendarDays, Loader2, LogIn, MailCheck, Sparkles } from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

type Mode = 'login' | 'register'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [major, setMajor] = useState('')
  const [level, setLevel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmEmailAddress, setConfirmEmailAddress] = useState<string | null>(null)

  function backToSignIn() {
    setConfirmEmailAddress(null)
    setMode('login')
    setPassword('')
    setConfirmPassword('')
    setFirstName('')
    setLastName('')
    setMajor('')
    setLevel('')
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        const profile = (firstName.trim() || lastName.trim() || major.trim() || level.trim())
          ? { firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined, major: major.trim() || undefined, level: level.trim() || undefined }
          : undefined
        const response = await register(email, password, confirmPassword, profile)
        if (!response.tokens) {
          setConfirmEmailAddress(email)
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center overflow-hidden"
      style={{ background: '#F8FAFC', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      <div className="absolute" style={{ width: 420, height: 420, top: -120, right: -80, background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 70%)' }} />
      <div className="absolute" style={{ width: 420, height: 420, bottom: -120, left: -80, background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0) 70%)' }} />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="rounded-xl p-2.5" style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', boxShadow: '0 4px 16px rgba(67,56,202,0.35)' }}>
            <CalendarDays size={22} color="white" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>Skedule</span>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 8px 32px rgba(15,23,42,0.08)' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 24 }}>
            {mode === 'login'
              ? 'Sign in to build your perfect semester.'
              : 'Only @mail.aub.edu email addresses are allowed.'}
          </p>

          <div className="flex rounded-xl p-1 mb-6" style={{ background: '#F1F5F9' }}>
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                className="flex-1 py-2 rounded-lg font-bold transition-all"
                style={{
                  background: mode === m ? '#FFFFFF' : 'transparent',
                  color: mode === m ? '#4338CA' : '#64748B',
                  fontSize: 13,
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>AUB Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mail.aub.edu"
                className="w-full mt-1 rounded-xl px-3.5 py-2.5 outline-none"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full mt-1 rounded-xl px-3.5 py-2.5 outline-none"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A' }}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full mt-1 rounded-xl px-3.5 py-2.5 outline-none"
                  style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A' }}
                />
              </div>
            )}

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full mt-1 rounded-xl px-3.5 py-2.5 outline-none"
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full mt-1 rounded-xl px-3.5 py-2.5 outline-none"
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Major</label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full mt-1 rounded-xl px-3.5 py-2.5 outline-none"
                    style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Year / Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full mt-1 rounded-xl px-3.5 py-2.5 outline-none"
                    style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A' }}
                  >
                    <option value="">Select level...</option>
                    <option value="Freshman">Freshman</option>
                    <option value="Sophomore">Sophomore</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                    <option value="Graduate">Graduate</option>
                  </select>
                </div>
              </>
            )}

            {error && (
              <div className="rounded-xl px-3.5 py-2.5" style={{ background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 font-bold transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', color: '#FFFFFF', fontSize: 14, boxShadow: '0 4px 16px rgba(67,56,202,0.3)' }}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'login' ? (
                <LogIn size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6" style={{ fontSize: 12, color: '#94A3B8' }}>
          Plan courses · Read reviews · Share schedules with friends
        </p>
      </div>

      {confirmEmailAddress && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) backToSignIn() }}
        >
          <div className="w-full rounded-2xl p-8 text-center" style={{ maxWidth: 400, background: '#FFFFFF', boxShadow: '0 24px 64px rgba(15,23,42,0.25)' }}>
            <div className="flex justify-center mb-4">
              <div className="rounded-full p-3.5" style={{ background: '#EEF2FF' }}>
                <MailCheck size={28} color="#4338CA" />
              </div>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Check your email</h2>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 8, lineHeight: 1.5 }}>
              We've sent a confirmation link to your email address. Please confirm your email before signing in.
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#4338CA', marginTop: 12 }}>
              A confirmation link was sent to {confirmEmailAddress}.
            </p>
            <button
              onClick={backToSignIn}
              className="w-full rounded-xl py-3 mt-6 font-bold"
              style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', color: '#FFFFFF', fontSize: 14, boxShadow: '0 4px 16px rgba(67,56,202,0.3)' }}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
