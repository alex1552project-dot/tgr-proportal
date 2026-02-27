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
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#0f0f1a' }}>
      <div className="w-full max-w-md">

        {/* Language toggle */}
        <div className="flex justify-end mb-10">
          <LanguageToggle />
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-12">
          <img src="/logo.jpg" alt="TGR ProPortal" style={{ width: '80%', maxWidth: '320px', height: 'auto', borderRadius: '16px' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block mb-2 font-semibold" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '17px' }}>
              {t('email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-2xl text-white focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.09)',
                border: '2px solid rgba(255,255,255,0.15)',
                fontSize: '18px',
                padding: '16px 20px',
              }}
              onFocus={e => (e.target.style.borderColor = '#C2865A')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '17px' }}>
              {t('password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-2xl text-white focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.09)',
                border: '2px solid rgba(255,255,255,0.15)',
                fontSize: '18px',
                padding: '16px 20px',
              }}
              onFocus={e => (e.target.style.borderColor = '#C2865A')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          {error && (
            <p className="text-center font-medium" style={{ color: '#f87171', fontSize: '16px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl font-bold text-white transition-opacity"
            style={{
              backgroundColor: '#C2865A',
              opacity: loading ? 0.6 : 1,
              fontSize: '20px',
              padding: '18px',
              marginTop: '8px',
              letterSpacing: '0.02em',
            }}
          >
            {loading ? t('loggingIn') : t('login')}
          </button>
        </form>

      </div>
    </div>
  )
}
