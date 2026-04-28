// Re-export from context so all existing imports continue to work unchanged.
// The context is the single source of truth for auth state across the whole app.
export { useAuth } from '../context/AuthContext'
