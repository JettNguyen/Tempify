import { useNavigate } from 'react-router-dom'

export default function BackButton({ className, fallbackTo = '/', children = '← Back' }) {
  const navigate = useNavigate()

  function handleBack() {
    if (window.history.state?.idx > 0) {
      navigate(-1)
      return
    }

    navigate(fallbackTo, { replace: true })
  }

  return (
    <button type="button" onClick={handleBack} className={className}>
      {children}
    </button>
  )
}