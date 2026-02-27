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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: '#0f0f1a',
      padding: '24px 24px 40px',
    }}>

      {/* Logo + Language toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <img src="/logo.jpg" alt="TGR ProPortal" style={{ width: '100%', height: 'auto', borderRadius: '20px' }} />
        <LanguageToggle />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.75)', fontSize: '20px' }}>
            {t('email')}
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.09)',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: '16px',
              fontSize: '20px',
              padding: '20px 22px',
              color: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = '#C2865A')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.75)', fontSize: '20px' }}>
            {t('password')}
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.09)',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: '16px',
              fontSize: '20px',
              padding: '20px 22px',
              color: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = '#C2865A')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
          />
        </div>

        {error && (
          <p style={{ textAlign: 'center', color: '#f87171', fontSize: '18px', fontWeight: '600', margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: '#C2865A',
            opacity: loading ? 0.6 : 1,
            border: 'none',
            borderRadius: '16px',
            fontSize: '22px',
            fontWeight: '800',
            color: '#fff',
            padding: '22px',
            letterSpacing: '0.03em',
            cursor: 'pointer',
          }}
        >
          {loading ? t('loggingIn') : t('login')}
        </button>
      </form>

    </div>
  )
}
