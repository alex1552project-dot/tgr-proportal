import { Icons } from './Icons'

export default function BottomNav({ screen, setScreen, t }) {
  const tabs = [
    { id: 'home',     icon: <Icons.Home />,     label: t('home') },
    { id: 'orders',   icon: <Icons.Orders />,   label: t('orders') },
    { id: 'settings', icon: <Icons.Settings />, label: t('settings') },
  ]

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', borderTop: '1px solid #2a2a2a', background: '#111', paddingTop: 8, paddingLeft: 0, paddingRight: 0, paddingBottom: 'max(20px, env(safe-area-inset-bottom))', zIndex: 100 }}>
      {tabs.map(nav => (
        <button
          key={nav.id}
          onClick={() => setScreen(nav.id)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
            color: screen === nav.id ? '#C2865A' : '#6B7280',
            fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {nav.icon}
          {nav.label}
        </button>
      ))}
    </div>
  )
}
