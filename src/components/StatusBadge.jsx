import { useContext } from 'react'
import { LangContext } from '../context/LangContext'

export default function StatusBadge({ status }) {
  const { t } = useContext(LangContext)

  const config = {
    pending:    { label: t('pendingApproval'), bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
    approved:   { label: t('approved'),        bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
    rejected:   { label: t('rejected'),        bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
    dispatched: { label: t('dispatched'),      bg: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE' },
  }

  const c = config[status] || config.pending

  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {c.label}
    </span>
  )
}
