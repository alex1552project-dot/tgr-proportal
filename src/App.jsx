import { Routes, Route, Navigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthContext } from './context/AuthContext'
import LoginScreen from './screens/LoginScreen'
import ForemanHome from './screens/ForemanHome'
import SupervisorHome from './screens/SupervisorHome'

function ProtectedRoute({ role, children }) {
  const { isAuthenticated, user } = useContext(AuthContext)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user?.role !== role) {
    // Redirect to correct home for their actual role
    return <Navigate to={user?.role === 'supervisor' ? '/supervisor' : '/foreman'} replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        path="/foreman"
        element={
          <ProtectedRoute role="foreman">
            <ForemanHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor"
        element={
          <ProtectedRoute role="supervisor">
            <SupervisorHome />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
