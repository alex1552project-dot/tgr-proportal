import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { LangContext } from '../context/LangContext'
import LanguageToggle from '../components/LanguageToggle'

export default function ForemanHome() {
  const { user, logout } = useContext(AuthContext)
  const { t } = useContext(LangContext)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#0f0f1a' }}>
      <header
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h1 className="font-bold text-lg" style={{ color: '#C2865A' }}>
          {t('appName')}
        </h1>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <button
            onClick={handleLogout}
            className="text-sm transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseOver={e => (e.target.style.color = '#fff')}
            onMouseOut={e => (e.target.style.color = 'rgba(255,255,255,0.5)')}
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="px-4 py-8">
        <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {t('welcome')},
        </p>
        <h2 className="text-2xl font-bold mb-8">{user?.name}</h2>

        <div
          className="rounded-2xl p-6 text-center"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <h3 className="text-xl font-semibold mb-2">{t('foremanHome')}</h3>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {t('comingSoon')}
          </p>
        </div>
      </main>
    </div>
  )
}
