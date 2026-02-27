import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { LangContext } from '../context/LangContext'
import LanguageToggle from '../components/LanguageToggle'

export default function LoginScreen() {
  const { login } = useContext(AuthContext)
  const { t, setLang } = useContext(LangContext)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/proportal-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(t('invalidCredentials'))
        return
      }
      login(data.token, data.user)
      setLang(data.user.language || 'en')
      navigate(data.user.role === 'supervisor' ? '/supervisor' : '/foreman', { replace: true })
    } catch {
      setError(t('invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#0f0f1a' }}>
      <div className="w-full max-w-sm">

        {/* Language toggle */}
        <div className="flex justify-end mb-10">
          <LanguageToggle />
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src="/logo.jpg" alt="TGR ProPortal" className="w-56 h-auto" style={{ borderRadius: '12px' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl text-white text-base focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              onFocus={e => (e.target.style.borderColor = '#C2865A')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl text-white text-base focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              onFocus={e => (e.target.style.borderColor = '#C2865A')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: '#f87171' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white text-base transition-opacity mt-2"
            style={{ backgroundColor: '#C2865A', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? t('loggingIn') : t('login')}
          </button>
        </form>

      </div>
    </div>
  )
}
