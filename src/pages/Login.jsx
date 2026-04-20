import { useState } from 'react'
import { Baby, Eye, EyeOff } from 'lucide-react'
import { login, register } from '../services/authService'

/**
 * Auth screen: Sign In → POST /api/auth/login; Register → POST /api/auth/register (Mongo + bcrypt on server).
 * Successful register returns a JWT — brief success copy, then same entry path as sign-in.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LOGIN_BG = '/images/login-nursery-bg.jpg'

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-700 dark:text-white dark:ring-slate-600/80'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

function PasswordField({ id, label, value, onChange, autoComplete, placeholder, visible, onToggleVisible }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="w-full rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pl-3 pr-11 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:focus:ring-cyan-400/25"
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleVisible}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  )
}

export function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('signin')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showSignInPassword, setShowSignInPassword] = useState(false)

  const [parentName, setParentName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState('')
  const [registerNotice, setRegisterNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
    setRegisterNotice('')
    setPassword('')
    setRegPassword('')
    setConfirmPassword('')
    setShowSignInPassword(false)
    setShowRegPassword(false)
    setShowConfirmPassword(false)
  }

  function validateEmail(value) {
    const v = String(value).trim().toLowerCase()
    if (!v) return 'Email is required.'
    if (!EMAIL_RE.test(v)) return 'Enter a valid email address (example: name@domain.com).'
    return null
  }

  async function handleSignIn(e) {
    e.preventDefault()
    setRegisterNotice('')
    if (!String(email).trim()) {
      setError('Email is required.')
      return
    }
    const emailErr = validateEmail(email)
    if (emailErr) {
      setError(emailErr)
      return
    }
    if (!String(password).trim()) {
      setError('Password is required.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      onLoginSuccess?.(user)
    } catch (err) {
      setError(err?.message || 'Sign in failed. Check your email and password, then try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setRegisterNotice('')
    const name = String(parentName).trim()
    if (!name) {
      setError('Please enter your name (shown as the parent on this account).')
      return
    }
    const emailErr = validateEmail(regEmail)
    if (emailErr) {
      setError(emailErr)
      return
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters (server requirement).')
      return
    }
    if (regPassword !== confirmPassword) {
      setError('Passwords do not match. Re-type both fields carefully.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const user = await register({
        name,
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
      })
      setRegisterNotice('Account created successfully. Signing you in…')
      await new Promise((r) => setTimeout(r, 550))
      onLoginSuccess?.(user)
    } catch (err) {
      setRegisterNotice('')
      const msg = err?.message || ''
      if (/already registered|409|duplicate/i.test(msg) || msg.toLowerCase().includes('email')) {
        setError(
          msg.toLowerCase().includes('already')
            ? msg
            : 'This email is already registered. Sign in instead, or use a different email.',
        )
      } else {
        setError(msg || 'Registration could not be completed. Try again in a moment.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${LOGIN_BG})` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900/50 via-slate-800/40 to-stone-900/55"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-slate-900/20"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-white/70 bg-white/88 p-7 shadow-2xl shadow-slate-950/20 backdrop-blur-xl dark:border-slate-600/50 dark:bg-slate-900/88 dark:shadow-black/40 sm:p-8">
          <div className="mb-7 flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 ring-4 ring-white/50 dark:ring-cyan-400/20">
              <Baby className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Smart Baby Monitor
              </h1>
              <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                Secure parent access
              </p>
            </div>
          </div>

          <div className="mb-6 flex rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1 shadow-inner dark:border-slate-600/80 dark:bg-slate-800/80">
            <TabButton active={mode === 'signin'} onClick={() => switchMode('signin')}>
              Sign In
            </TabButton>
            <TabButton active={mode === 'register'} onClick={() => switchMode('register')}>
              Register
            </TabButton>
          </div>

          {registerNotice && (
            <p className="mb-4 rounded-xl border border-emerald-200/90 bg-emerald-50/95 px-3 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-100">
              {registerNotice}
            </p>
          )}
          {error && (
            <p className="mb-4 rounded-xl border border-red-200/90 bg-red-50/95 px-3 py-2.5 text-xs text-red-600 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </p>
          )}

          {mode === 'signin' ? (
            <form className="space-y-5" onSubmit={handleSignIn} noValidate>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:focus:ring-cyan-400/25"
                  placeholder="you@example.com"
                />
              </label>
              <PasswordField
                id="signin-password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Your password"
                visible={showSignInPassword}
                onToggleVisible={() => setShowSignInPassword((v) => !v)}
              />
              <button
                type="submit"
                disabled={submitting}
                className="mt-1 w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-cyan-900/20 transition hover:bg-cyan-600 disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
              <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                New parent here?{' '}
                <button
                  type="button"
                  className="font-semibold text-cyan-600 hover:underline dark:text-cyan-400"
                  onClick={() => switchMode('register')}
                >
                  Create your account
                </button>
              </p>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleRegister} noValidate>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Your name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:focus:ring-cyan-400/25"
                  placeholder="How we’ll greet you"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:focus:ring-cyan-400/25"
                  placeholder="you@example.com"
                />
              </label>
              <PasswordField
                id="reg-password"
                label="Password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                visible={showRegPassword}
                onToggleVisible={() => setShowRegPassword((v) => !v)}
              />
              <PasswordField
                id="reg-confirm"
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Same password again"
                visible={showConfirmPassword}
                onToggleVisible={() => setShowConfirmPassword((v) => !v)}
              />
              <button
                type="submit"
                disabled={submitting}
                className="mt-1 w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-cyan-900/20 transition hover:bg-cyan-600 disabled:opacity-60"
              >
                {submitting ? 'Please wait…' : 'Create account'}
              </button>
              <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                You&apos;ll be signed in automatically once your account is ready.
              </p>
              <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Already registered?{' '}
                <button
                  type="button"
                  className="font-semibold text-cyan-600 hover:underline dark:text-cyan-400"
                  onClick={() => switchMode('signin')}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
