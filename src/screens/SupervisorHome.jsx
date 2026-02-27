import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { LangContext } from '../context/LangContext'
import StatusBadge from '../components/StatusBadge'
import BottomNav from '../components/BottomNav'
import { Icons } from '../components/Icons'

export default function SupervisorHome() {
  const { token, user, logout } = useContext(AuthContext)
  const { t, lang, setLang } = useContext(LangContext)
  const navigate = useNavigate()

  const [screen, setScreen] = useState('home')
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Availability toggle — initialized from user profile
  const [isUnavailable, setIsUnavailable] = useState(user?.isAvailable === false)

  // ── Fetch orders ──────────────────────────────────────────────────────────
  function fetchOrders() {
    setOrdersLoading(true)
    fetch('/.netlify/functions/proportal-orders?view=supervisor', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setOrders(d.orders || []); setOrdersLoading(false) })
      .catch(() => setOrdersLoading(false))
  }

  useEffect(() => { fetchOrders() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Approve / reject ──────────────────────────────────────────────────────
  async function handleAction(orderId, action) {
    setActionLoading(true)
    try {
      const res = await fetch('/.netlify/functions/proportal-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, orderId }),
      })
      if (res.ok) {
        setOrders(orders.map(o =>
          o.id === orderId
            ? { ...o, status: action === 'approve' ? 'approved' : 'rejected', statusUpdatedBy: user?.name }
            : o
        ))
        setSelectedOrderId(null)
      }
    } finally {
      setActionLoading(false)
    }
  }

  // ── Availability toggle ───────────────────────────────────────────────────
  async function toggleAvailability() {
    const newVal = !isUnavailable
    setIsUnavailable(newVal)
    try {
      await fetch('/.netlify/functions/proportal-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'availability', isAvailable: !newVal }),
      })
    } catch {
      setIsUnavailable(!newVal) // revert on error
    }
  }

  function handleLogout() { logout(); navigate('/login', { replace: true }) }

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const resolvedOrders = orders.filter(o => o.status !== 'pending')
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  // ── Order detail view ─────────────────────────────────────────────────────
  if (selectedOrderId) {
    const order = orders.find(o => o.id === selectedOrderId)
    if (!order) { setSelectedOrderId(null); return null }

    const materialTotal = (order.items || []).reduce((s, i) => s + (i.qty * (i.pricePerTon || 0)), 0)
    const deliveryCost = order.deliveryCostEstimate || 0
    const total = materialTotal + deliveryCost

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelectedOrderId(null)} style={{ background: 'none', border: 'none', color: '#C2865A', cursor: 'pointer', padding: 0 }}>
            <Icons.Back />
          </button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('orderDetails')}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Header card */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ flex: 1, marginRight: 12 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>{t('project')}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{order.projectName}</div>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>{t('po')}</div>
                <div style={{ fontSize: 13, color: '#C2865A', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{order.po}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>{t('submittedBy')}</div>
                <div style={{ fontSize: 13, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{order.foremanName}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>{t('date')}</div>
                <div style={{ fontSize: 13, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{order.createdAt?.slice(0, 10)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>{t('estDelivery')}</div>
                <div style={{ fontSize: 13, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{order.deliveryDate?.slice(0, 10)}</div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>{t('materials')}</div>
          {(order.items || []).map((item, i) => (
            <div key={i} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 6, border: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
                  {lang === 'es' ? item.nameEs : item.name}
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>
                  {item.qty} {t('tons')}
                  {item.pricePerTon ? ` × $${item.pricePerTon.toFixed(2)}/ton` : ''}
                </div>
              </div>
              {item.pricePerTon ? (
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
                  ${(item.qty * item.pricePerTon).toLocaleString()}
                </div>
              ) : null}
            </div>
          ))}

          {/* Notes */}
          {order.notes && (
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #2a2a2a', marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Notes</div>
              <div style={{ fontSize: 13, color: '#fff', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>{order.notes}</div>
            </div>
          )}

          {/* Cost summary */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginTop: 4, border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('materialCost')}</span>
              <span style={{ fontSize: 13, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>${materialTotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('deliveryCost')} (est.)</span>
              <span style={{ fontSize: 13, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>${deliveryCost.toLocaleString()}</span>
            </div>
            <div style={{ borderTop: '1px solid #333', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('totalCost')}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#C2865A', fontFamily: "'DM Sans', sans-serif" }}>${total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Action buttons — only for pending orders */}
        {order.status === 'pending' && (
          <div style={{ padding: 16, borderTop: '1px solid #2a2a2a', display: 'flex', gap: 10 }}>
            <button
              onClick={() => handleAction(order.id, 'reject')}
              disabled={actionLoading}
              style={{ flex: 1, padding: 14, background: 'none', border: '2px solid #EF4444', borderRadius: 12, color: '#EF4444', fontSize: 15, fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif", opacity: actionLoading ? 0.6 : 1 }}
            >
              <Icons.X /> {t('reject')}
            </button>
            <button
              onClick={() => handleAction(order.id, 'approve')}
              disabled={actionLoading}
              style={{ flex: 2, padding: 14, background: '#10B981', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif", opacity: actionLoading ? 0.6 : 1 }}
            >
              <Icons.Check /> {t('approve')}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Settings screen ───────────────────────────────────────────────────────
  if (screen === 'settings') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('settings')}</span>
        </div>
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Availability toggle */}
          <div style={{ background: isUnavailable ? '#7F1D1D' : '#1a1a1a', borderRadius: 12, padding: 16, border: isUnavailable ? '1px solid #991B1B' : '1px solid #2a2a2a', transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{t('markUnavailable')}</div>
                <div style={{ fontSize: 12, color: isUnavailable ? '#FCA5A5' : '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>
                  {isUnavailable ? t('youAreUnavailable') : t('unavailableDesc')}
                </div>
              </div>
              <div
                onClick={toggleAvailability}
                style={{ width: 48, height: 26, borderRadius: 13, cursor: 'pointer', position: 'relative', background: isUnavailable ? '#EF4444' : '#333', transition: 'background 0.3s', flexShrink: 0, marginLeft: 16 }}
              >
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: isUnavailable ? 24 : 2, transition: 'left 0.3s' }} />
              </div>
            </div>
          </div>

          {/* Language */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, border: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>{t('language')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['en', 'es'].map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, cursor: 'pointer',
                    border: lang === l ? '2px solid #C2865A' : '1px solid #333',
                    background: lang === l ? 'rgba(194,134,90,0.15)' : '#111',
                    color: lang === l ? '#C2865A' : '#9CA3AF',
                    fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {l === 'en' ? '🇺🇸 English' : '🇲🇽 Español'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{ width: '100%', padding: 14, background: 'none', border: '1px solid #333', borderRadius: 12, color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            {t('logout')}
          </button>
        </div>
        <BottomNav screen={screen} setScreen={setScreen} t={t} />
      </div>
    )
  }

  // ── Home screen ───────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
      <div style={{ padding: '20px 16px 16px', background: 'linear-gradient(180deg, #2d1f14 0%, #111 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('welcome')},</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{user?.name}</div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#C2865A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: "'DM Sans', sans-serif" }}>
              {initials}
            </div>
            {pendingOrders.length > 0 && (
              <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pendingOrders.length}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {/* Unavailable banner */}
        {isUnavailable && (
          <div style={{ background: '#7F1D1D', border: '1px solid #991B1B', borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#FCA5A5', fontFamily: "'DM Sans', sans-serif" }}>{t('youAreUnavailable')}</div>
          </div>
        )}

        {ordersLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>{t('loading')}</div>
        ) : (
          <>
            {/* Pending orders */}
            {pendingOrders.length > 0 ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif" }}>
                  <Icons.Bell /> {t('pendingOrders')} ({pendingOrders.length})
                </div>
                {pendingOrders.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    style={{ width: '100%', background: '#1a1a1a', border: '1px solid rgba(194,134,90,0.2)', borderRadius: 12, padding: 16, marginBottom: 8, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif", flex: 1, marginRight: 8 }}>{o.projectName}</div>
                      <span style={{ color: '#6B7280' }}><Icons.ChevronRight /></span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>
                      {o.foremanName} • {(o.items || []).length} {t('materials').toLowerCase()} • {o.createdAt?.slice(0, 10)}
                    </div>
                    {(o.deliveryCostEstimate || 0) + (o.items || []).reduce((s, i) => s + i.qty * (i.pricePerTon || 0), 0) > 0 && (
                      <div style={{ fontSize: 13, color: '#C2865A', fontWeight: 600, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                        ${((o.deliveryCostEstimate || 0) + (o.items || []).reduce((s, i) => s + i.qty * (i.pricePerTon || 0), 0)).toLocaleString()}
                      </div>
                    )}
                  </button>
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{t('allClear')}</div>
              </div>
            )}

            {/* Resolved orders */}
            {resolvedOrders.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 16, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>
                  {t('approvedOrders')}
                </div>
                {resolvedOrders.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16, marginBottom: 8, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif", flex: 1, marginRight: 8 }}>{o.projectName}</div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>
                      {o.foremanName} • {o.createdAt?.slice(0, 10)}
                    </div>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <BottomNav screen={screen} setScreen={setScreen} t={t} />
    </div>
  )
}
