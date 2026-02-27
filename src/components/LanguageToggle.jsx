import { useContext } from 'react'
import { LangContext } from '../context/LangContext'

export default function LanguageToggle() {
  const { lang, toggleLang } = useContext(LangContext)

  return (
    <div className="flex gap-1">
      <button
        onClick={lang !== 'en' ? toggleLang : undefined}
        className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
          lang === 'en'
            ? 'text-white'
            : 'text-white/50 hover:text-white/80'
        }`}
        style={lang === 'en' ? { backgroundColor: '#C2865A' } : {}}
      >
        EN
      </button>
      <button
        onClick={lang !== 'es' ? toggleLang : undefined}
        className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
          lang === 'es'
            ? 'text-white'
            : 'text-white/50 hover:text-white/80'
        }`}
        style={lang === 'es' ? { backgroundColor: '#C2865A' } : {}}
      >
        ES
      </button>
    </div>
  )
}
