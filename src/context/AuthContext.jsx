import { createContext, useState, useEffect } from 'react'

export const AuthContext = createContext(null)

function parseJWT(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('pp_token')
    const storedUser = localStorage.getItem('pp_user')
    if (storedToken && storedUser) {
      const decoded = parseJWT(storedToken)
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } else {
        localStorage.removeItem('pp_token')
        localStorage.removeItem('pp_user')
      }
    }
  }, [])

  function login(newToken, newUser) {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('pp_token', newToken)
    localStorage.setItem('pp_user', JSON.stringify(newUser))
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('pp_token')
    localStorage.removeItem('pp_user')
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
