import { createContext, useState, useContext, useEffect } from 'react'
import { dict } from '../i18n/dict'
import { AuthContext } from './AuthContext'

export const LangContext = createContext(null)

export function LangProvider({ children }) {
  const { user, token } = useContext(AuthContext)
  const [lang, setLang] = useState('en')

  // Sync language from user profile on login/mount
  useEffect(() => {
    if (user?.language) setLang(user.language)
  }, [user])

  function t(key) {
    return dict[lang]?.[key] || dict.en[key] || key
  }

  async function toggleLang() {
    const newLang = lang === 'en' ? 'es' : 'en'
    setLang(newLang)
    if (token) {
      try {
        await fetch('/.netlify/functions/proportal-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'language', language: newLang })
        })
      } catch {
        // Silently fail — UI already updated
      }
    }
  }

  return (
    <LangContext.Provider value={{ lang, t, toggleLang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}
