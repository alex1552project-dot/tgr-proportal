import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { LangContext } from '../context/LangContext'
import StatusBadge from '../components/StatusBadge'
import BottomNav from '../components/BottomNav'
import { Icons } from '../components/Icons'

// ── Default delivery date (3 days from today) ──────────────────────────────
function defaultDelivery() {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.toISOString().split('T')[0]
}

// ── Material card ──────────────────────────────────────────────────────────
function MaterialCard({ material, lang, t, onAdd, inCart }) {
  const [qty, setQty] = useState(15)
  const [error, setError] = useState('')

  const isOut = material.available === 0

  function handleAdd() {
    if (isOut) {
      setError(t('materialUnavailable'))
      setTimeout(() => setError(''), 3000)
      return
    }
    const already = inCart ? inCart.qty : 0
    if (qty + already > material.available) {
      setError(`${t('unavailable')} ${material.available} ${t('tons')} ${t('available')}.`)
      setTimeout(() => setError(''), 4000)
      return
    }
    setError('')
    onAdd(material, qty)
  }

  return (
    <div style={{
      background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 8,
      border: inCart ? '1px solid #C2865A' : '1px solid #2a2a2a',
      opacity: isOut ? 0.5 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: error ? 8 : 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
          {lang === 'es' ? material.nameEs : material.name}
        </div>
        {inCart && (
          <span style={{ fontSize: 10, background: '#C2865A', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
            ✓ {inCart.qty}t
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: '#7F1D1D', border: '1px solid #991B1B', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#FCA5A5', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setQty(Math.max(1, qty - 5))}
          style={{ width: 36, height: 36, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icons.Minus />
        </button>
        <input
          type="number"
          value={qty}
          onChange={e => setQty(Math.max(1, Number(e.target.value)))}
          style={{ flex: 1, textAlign: 'center', background: '#111', border: '1px solid #333', borderRadius: 8, padding: 8, color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
        />
        <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('tons')}</span>
        <button
          onClick={() => setQty(qty + 5)}
          style={{ width: 36, height: 36, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icons.Plus />
        </button>
        <button
          onClick={handleAdd}
          disabled={isOut}
          style={{
            padding: '8px 14px', border: 'none', borderRadius: 8, color: '#fff',
            background: isOut ? '#333' : '#C2865A',
            fontSize: 12, fontWeight: 700, cursor: isOut ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
          }}
        >
          {isOut ? (lang === 'es' ? 'No Disponible' : 'Unavailable') : t('addToOrder')}
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ForemanHome() {
  const { token, user, logout } = useContext(AuthContext)
  const { t, lang, setLang } = useContext(LangContext)
  const navigate = useNavigate()

  const [screen, setScreen] = useState('home')

  // Projects
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  // Materials
  const [materials, setMaterials] = useState([])
  const [materialsLoading, setMaterialsLoading] = useState(false)

  // Cart
  const [cart, setCart] = useState([])
  const [deliveryDate, setDeliveryDate] = useState(defaultDelivery)
  const [notes, setNotes] = useState('')

  // Order history
  const [orderHistory, setOrderHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── Fetch projects on mount ──────────────────────────────────────────────
  useEffect(() => {
    fetch('/.netlify/functions/proportal-projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setProjects(d.projects || []); setProjectsLoading(false) })
      .catch(() => setProjectsLoading(false))
  }, [token])

  // ── Fetch materials when navigating to materials screen ──────────────────
  useEffect(() => {
    if (screen === 'materials' && materials.length === 0) {
      setMaterialsLoading(true)
      fetch('/.netlify/functions/proportal-materials', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => { setMaterials(d.materials || []); setMaterialsLoading(false) })
        .catch(() => setMaterialsLoading(false))
    }
  }, [screen, token, materials.length])

  // ── Fetch order history when navigating to orders screen ─────────────────
  useEffect(() => {
    if (screen === 'orders') {
      setHistoryLoading(true)
      fetch('/.netlify/functions/proportal-orders?view=foreman', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => { setOrderHistory(d.orders || []); setHistoryLoading(false) })
        .catch(() => setHistoryLoading(false))
    }
  }, [screen, token])

  // ── Cart helpers ──────────────────────────────────────────────────────────
  function addToCart(material, qty) {
    const existing = cart.find(c => c.id === material.id)
    if (existing) {
      setCart(cart.map(c => c.id === material.id ? { ...c, qty: c.qty + qty } : c))
    } else {
      setCart([...cart, { ...material, qty }])
    }
  }

  function removeFromCart(id) {
    setCart(cart.filter(c => c.id !== id))
  }

  // ── Submit order ──────────────────────────────────────────────────────────
  async function placeOrder() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/.netlify/functions/proportal-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'submit',
          projectId: selectedProjectId,
          items: cart.map(c => ({ materialId: c.id, name: c.name, nameEs: c.nameEs, qty: c.qty })),
          deliveryDate,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error || 'Error'); return }
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false); setCart([]); setSelectedProjectId(null)
        setNotes(''); setDeliveryDate(defaultDelivery()); setScreen('home')
      }, 3000)
    } catch {
      setSubmitError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleLogout() { logout(); navigate('/login', { replace: true }) }

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #1a1a1a 0%, #2d1f14 100%)', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>{t('orderSubmitted')}</div>
        <div style={{ fontSize: 14, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('awaitingApproval')}</div>
      </div>
    )
  }

  // ── Review screen ─────────────────────────────────────────────────────────
  if (screen === 'review') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setScreen('materials')} style={{ background: 'none', border: 'none', color: '#C2865A', cursor: 'pointer', padding: 0 }}><Icons.Back /></button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('orderSummary')}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Project */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{t('project')}</div>
            <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{selectedProject?.name}</div>
            <div style={{ fontSize: 13, color: '#C2865A', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{selectedProject?.po}</div>
          </div>

          {/* Delivery date */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{t('requestedDelivery')}</div>
            <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{deliveryDate}</div>
          </div>

          {/* Cart items */}
          {cart.map(item => (
            <div key={item.id} style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 8, border: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{lang === 'es' ? item.nameEs : item.name}</div>
                <div style={{ fontSize: 13, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{item.qty} {t('tons')}</div>
              </div>
              <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>{t('removeItem')}</button>
            </div>
          ))}

          {/* Notes */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginTop: 12, border: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>{t('notes')}</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }}
            />
          </div>

          {submitError && (
            <div style={{ marginTop: 12, background: '#7F1D1D', border: '1px solid #991B1B', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#FCA5A5', fontFamily: "'DM Sans', sans-serif" }}>
              {submitError}
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #2a2a2a' }}>
          <button
            onClick={placeOrder}
            disabled={submitting}
            style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg, #C2865A, #A0694A)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? t('placing') : t('placeOrder')}
          </button>
        </div>
      </div>
    )
  }

  // ── Materials screen ──────────────────────────────────────────────────────
  if (screen === 'materials') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => { setScreen('home'); setSelectedProjectId(null) }} style={{ background: 'none', border: 'none', color: '#C2865A', cursor: 'pointer', padding: 0 }}><Icons.Back /></button>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('selectMaterial')}</span>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setScreen('review')} style={{ background: '#C2865A', border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif" }}>
              <Icons.Cart /> {cart.length}
            </button>
          )}
        </div>

        {/* Project / PO */}
        <div style={{ padding: '8px 16px', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>
            {selectedProject?.name} • {selectedProject?.po}
          </div>
        </div>

        {/* Delivery date */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{t('requestedDelivery')}</div>
          <input
            type="date"
            value={deliveryDate}
            onChange={e => setDeliveryDate(e.target.value)}
            style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, fontFamily: "'DM Sans', sans-serif", width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
          {materialsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>{t('loading')}</div>
          ) : (
            materials.map(mat => (
              <MaterialCard
                key={mat.id}
                material={mat}
                lang={lang}
                t={t}
                onAdd={addToCart}
                inCart={cart.find(c => c.id === mat.id)}
              />
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: 16, borderTop: '1px solid #2a2a2a' }}>
            <button
              onClick={() => setScreen('review')}
              style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #C2865A, #A0694A)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              {t('cart')} ({cart.length} {t('itemsInCart')})
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Orders screen ─────────────────────────────────────────────────────────
  if (screen === 'orders') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('orderHistory')}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>{t('loading')}</div>
          ) : orderHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 15 }}>{t('noOrders')}</div>
            </div>
          ) : (
            orderHistory.map(o => (
              <div key={o.id} style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 8, border: '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif", flex: 1, marginRight: 8 }}>{o.projectName}</div>
                  <StatusBadge status={o.status} />
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>
                  {o.createdAt?.slice(0, 10)} • {o.items?.length} {t('materials').toLowerCase()}
                </div>
                {o.deliveryDate && (
                  <div style={{ fontSize: 12, color: '#C2865A', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                    {t('estDelivery')}: {o.deliveryDate?.slice(0, 10)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <BottomNav screen={screen} setScreen={setScreen} t={t} />
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
        <div style={{ flex: 1, padding: 16 }}>
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, border: '1px solid #2a2a2a', marginBottom: 12 }}>
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
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
      <div style={{ padding: '20px 16px 16px', background: 'linear-gradient(180deg, #2d1f14 0%, #111 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('welcome')},</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{user?.name}</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#C2865A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: "'DM Sans', sans-serif" }}>
            {initials}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
          {t('selectProject')}
        </div>

        {projectsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>{t('loading')}</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏗️</div>
            <div style={{ fontSize: 15 }}>No active projects</div>
          </div>
        ) : (
          projects.map(proj => (
            <button
              key={proj.id}
              onClick={() => { setSelectedProjectId(proj.id); setScreen('materials') }}
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16, marginBottom: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{proj.name}</div>
                <div style={{ fontSize: 12, color: '#C2865A', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{proj.po}</div>
              </div>
              <span style={{ color: '#6B7280' }}><Icons.ChevronRight /></span>
            </button>
          ))
        )}
      </div>

      <BottomNav screen={screen} setScreen={setScreen} t={t} />
    </div>
  )
}
