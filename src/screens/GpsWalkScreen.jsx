import { useState, useEffect, useRef, useContext } from 'react'
import turfArea from '@turf/area'
import { AuthContext } from '../context/AuthContext'
import { LangContext } from '../context/LangContext'
import { Icons } from '../components/Icons'

// ── Accuracy helpers ───────────────────────────────────────────────────────
function formatAccuracy(m) { return `${Math.round(m)}m` }

function getAccuracyColor(m) {
  if (m == null) return '#6B7280'
  if (m <= 5)  return '#10B981'
  if (m <= 15) return '#F59E0B'
  return '#EF4444'
}

function getAccuracyLabel(m, t) {
  if (m == null) return t('gpsSearching')
  if (m <= 5)  return t('gpsExcellent')
  if (m <= 15) return t('gpsFair')
  return t('gpsPoor')
}

// ── Polygon math ───────────────────────────────────────────────────────────
function calcArea(coords) {
  if (coords.length < 3) return { sqFt: 0, sqM: 0 }
  const ring = coords.map(c => [c.lng, c.lat])
  ring.push(ring[0])
  try {
    const sqM = turfArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } })
    return { sqFt: sqM * 10.7639, sqM }
  } catch {
    return { sqFt: 0, sqM: 0 }
  }
}

function calcQty(sqFt, depthInches, tonsPerCY) {
  const cubicYards = (sqFt * depthInches) / 324
  return { cubicYards, tons: cubicYards * tonsPerCY }
}

// ── SVG polygon renderer ───────────────────────────────────────────────────
function normToSVG(coords, W, H, pad = 20) {
  if (coords.length === 0) return []
  const lats = coords.map(c => c.lat), lngs = coords.map(c => c.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const scale = Math.min(
    (W - pad * 2) / (maxLng - minLng || 1e-5),
    (H - pad * 2) / (maxLat - minLat || 1e-5)
  )
  const offX = (W - (maxLng - minLng) * scale) / 2
  const offY = (H - (maxLat - minLat) * scale) / 2
  return coords.map(c => ({
    x: offX + (c.lng - minLng) * scale,
    y: offY + (maxLat - c.lat) * scale,
  }))
}

// ── Density matcher ────────────────────────────────────────────────────────
function matchDensity(material, densities) {
  if (!material || !densities.length) return null
  const name = material.name.toLowerCase()
  return densities.find(d => {
    const dn = d.materialName.toLowerCase()
    return dn.includes(name.split(' ')[0]) || name.includes(dn.split(' ')[0])
  }) || null
}

// ── Main component ─────────────────────────────────────────────────────────
export default function GpsWalkScreen({ projectId, selectedProject, token, onSave, onCancel }) {
  const { user } = useContext(AuthContext)
  const { t, lang } = useContext(LangContext)

  const [step, setStep] = useState('mode') // mode | pre | walking | review | configure
  const [accuracy, setAccuracy] = useState(null)
  const [coords, setCoords] = useState([])
  const [selectedVertex, setSelectedVertex] = useState(null)

  // Configure step state
  const [label, setLabel] = useState('')
  const [materials, setMaterials] = useState([])
  const [densities, setDensities] = useState([])
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [depthInches, setDepthInches] = useState(3)
  const [manualTons, setManualTons] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const watchRef = useRef(null)
  const SVG_W = 280, SVG_H = 220

  // Clear GPS watch on unmount
  useEffect(() => () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current) }, [])

  // Start/stop GPS watch based on step
  useEffect(() => {
    if (step === 'pre' || step === 'walking') {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setAccuracy(pos.coords.accuracy)
          if (step === 'walking' && pos.coords.accuracy <= 30) {
            setCoords(prev => [...prev, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
            }])
          }
        },
        (err) => console.warn('GPS error:', err.message),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      )
    } else {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
      }
    }
  }, [step])

  // Load materials + densities when entering configure step
  useEffect(() => {
    if (step !== 'configure' || materials.length > 0) return
    Promise.all([
      fetch('/.netlify/functions/proportal-materials', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/.netlify/functions/proportal-materials?densities=true', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([mData, dData]) => {
      const mats = mData.materials || []
      const dens = dData.densities || []
      setMaterials(mats)
      setDensities(dens)
      if (mats.length > 0) {
        setSelectedMaterialId(mats[0].id)
        const den = matchDensity(mats[0], dens)
        setDepthInches(den?.defaultDepthIn || 3)
      }
    }).catch(console.error)
  }, [step, token, materials.length])

  const area = calcArea(coords)
  const selectedMaterial = materials.find(m => m.id === selectedMaterialId)
  const selectedDensity = matchDensity(selectedMaterial, densities)
  const tonsPerCY = selectedDensity?.tonsPerCubicYard || 1.35
  const calcResult = calcQty(area.sqFt, depthInches, tonsPerCY)
  const effectiveTons = manualTons !== null ? manualTons : calcResult.tons

  function handleMaterialChange(matId) {
    setSelectedMaterialId(matId)
    setManualTons(null)
    const mat = materials.find(m => m.id === matId)
    const den = matchDensity(mat, densities)
    if (den) setDepthInches(den.defaultDepthIn)
  }

  function handleDepthChange(delta) {
    setDepthInches(prev => Math.max(1, Math.min(24, prev + delta)))
    setManualTons(null)
  }

  function removeVertex(idx) {
    if (coords.length <= 4) return
    setCoords(prev => prev.filter((_, i) => i !== idx))
    setSelectedVertex(null)
  }

  function closePolygon() {
    if (coords.length < 3) return
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    setStep('review')
  }

  async function handleSave() {
    if (!label.trim()) { setSaveError(t('labelRequired')); return }
    if (!selectedMaterialId) { setSaveError(t('materialRequired')); return }
    setSaving(true)
    setSaveError('')
    try {
      const qty = {
        cubicYards: parseFloat(calcResult.cubicYards.toFixed(2)),
        tons: parseFloat(effectiveTons.toFixed(2)),
      }
      const res = await fetch('/.netlify/functions/proportal-measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          label: label.trim(),
          projectId,
          mode: 'gps_walk',
          coordinates: coords,
          areaSqFt: parseFloat(area.sqFt.toFixed(1)),
          areaSqM: parseFloat(area.sqM.toFixed(2)),
          depthInches,
          materialId: selectedMaterialId,
          materialName: lang === 'es' ? (selectedMaterial?.nameEs || selectedMaterial?.name) : selectedMaterial?.name,
          calculatedQty: qty,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || 'Error saving'); return }
      setSaved(true)
      setTimeout(onSave, 1800)
    } catch {
      setSaveError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const svgPts = normToSVG(coords, SVG_W, SVG_H)
  const polyPts = svgPts.map(p => `${p.x},${p.y}`).join(' ')

  // ── SAVED ──────────────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Icons.Check />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{t('measurementSaved')}</div>
        <div style={{ fontSize: 13, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
        <div style={{ fontSize: 12, color: '#C2865A', marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>
          {Math.round(area.sqFt).toLocaleString()} ft² · {effectiveTons.toFixed(1)}T
        </div>
      </div>
    )
  }

  // ── STEP: MODE ─────────────────────────────────────────────────────────────
  if (step === 'mode') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#C2865A', cursor: 'pointer', padding: 0 }}>
            <Icons.Back />
          </button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('measureArea')}</span>
        </div>
        <div style={{ padding: '10px 16px 4px' }}>
          <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{selectedProject?.name}</div>
        </div>
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Walk Perimeter — active */}
          <button
            onClick={() => setStep('pre')}
            style={{ background: '#1a1a1a', border: '2px solid #C2865A', borderRadius: 14, padding: '18px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(194,134,90,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#C2865A' }}>
              <Icons.MapPin />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{t('walkPerimeter')}</div>
              <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{t('walkPerimeterDesc')}</div>
            </div>
            <div style={{ color: '#C2865A', alignSelf: 'center' }}><Icons.ChevronRight /></div>
          </button>

          {/* Draw on Map — coming soon */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14, opacity: 0.42 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#6B7280' }}>
              <Icons.Ruler />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('drawOnMap')}</div>
                <span style={{ fontSize: 10, background: '#333', color: '#9CA3AF', padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{t('comingSoon')}</span>
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{t('drawOnMapDesc')}</div>
            </div>
          </div>

        </div>
      </div>
    )
  }

  // ── STEP: PRE-WALK ─────────────────────────────────────────────────────────
  if (step === 'pre') {
    const accColor = getAccuracyColor(accuracy)
    const accLabel = getAccuracyLabel(accuracy, t)
    const hasReading = accuracy !== null
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setStep('mode')} style={{ background: 'none', border: 'none', color: '#C2865A', cursor: 'pointer', padding: 0 }}>
            <Icons.Back />
          </button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('walkPerimeter')}</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: 32 }}>

          {/* Accuracy rings */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 16px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${accColor}`, opacity: 0.15 }} />
              <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: `2px solid ${accColor}`, opacity: 0.3 }} />
              <div style={{ position: 'absolute', inset: 32, borderRadius: '50%', background: accColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: accColor, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
              {hasReading ? formatAccuracy(accuracy) : '—'}
            </div>
            <div style={{ fontSize: 14, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{accLabel}</div>
          </div>

          {/* Tips */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, width: '100%', border: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{t('forBestResults')}</div>
            {[t('tipOutside'), t('tipWait'), t('tipPace')].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < 2 ? 8 : 0 }}>
                <span style={{ color: '#C2865A', marginTop: 1, flexShrink: 0 }}>•</span>
                <span style={{ fontSize: 13, color: '#D1D5DB', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>{tip}</span>
              </div>
            ))}
          </div>

        </div>

        <div style={{ padding: '16px', borderTop: '1px solid #2a2a2a' }}>
          <button
            onClick={() => { setCoords([]); setStep('walking') }}
            disabled={!hasReading}
            style={{ width: '100%', padding: 16, background: hasReading ? 'linear-gradient(135deg, #C2865A, #A0694A)' : '#333', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: hasReading ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif", opacity: hasReading ? 1 : 0.5 }}
          >
            {hasReading ? t('startWalking') : t('gpsSearching')}
          </button>
        </div>
      </div>
    )
  }

  // ── STEP: WALKING ──────────────────────────────────────────────────────────
  if (step === 'walking') {
    const accColor = getAccuracyColor(accuracy)
    const liveArea = area
    const canClose = coords.length >= 3
    const needMore = Math.max(0, 3 - coords.length)

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>

        {/* Status bar */}
        <div style={{ padding: '10px 16px', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
            <span style={{ fontSize: 13, color: '#D1D5DB', fontFamily: "'DM Sans', sans-serif" }}>
              {coords.length} {t('points')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: accColor }} />
            <span style={{ fontSize: 13, color: accColor, fontFamily: "'DM Sans', sans-serif" }}>
              {accuracy != null ? formatAccuracy(accuracy) : '…'}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: 24, textAlign: 'center' }}>

          {/* Recording indicator */}
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EF4444' }} />
          </div>

          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{t('walkingInstructions')}</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5, maxWidth: 260, fontFamily: "'DM Sans', sans-serif" }}>{t('walkingInstructions2')}</div>
          </div>

          {liveArea.sqFt > 0 && (
            <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '12px 24px', border: '1px solid #2a2a2a' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#C2865A', fontFamily: "'DM Sans', sans-serif" }}>
                ≈ {Math.round(liveArea.sqFt).toLocaleString()} ft²
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{t('estimatedArea')}</div>
            </div>
          )}

        </div>

        <div style={{ padding: '16px', borderTop: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={closePolygon}
            disabled={!canClose}
            style={{ width: '100%', padding: 15, background: canClose ? 'linear-gradient(135deg, #C2865A, #A0694A)' : '#333', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: canClose ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif", opacity: canClose ? 1 : 0.55 }}
          >
            {canClose
              ? t('closePolygon')
              : t('needPoints').replace('{n}', needMore)}
          </button>
          <button
            onClick={() => { setCoords([]); onCancel() }}
            style={{ width: '100%', padding: 12, background: 'none', border: '1px solid #333', borderRadius: 12, color: '#9CA3AF', fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            {t('cancelWalk')}
          </button>
        </div>
      </div>
    )
  }

  // ── STEP: REVIEW ───────────────────────────────────────────────────────────
  if (step === 'review') {
    const smallArea = area.sqFt > 0 && area.sqFt < 200

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setCoords([]); setStep('walking') }} style={{ background: 'none', border: 'none', color: '#C2865A', cursor: 'pointer', padding: 0 }}>
            <Icons.Back />
          </button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('reviewPolygon')}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* SVG polygon */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 12, marginBottom: 16, border: '1px solid #2a2a2a', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: SVG_H + 24 }}>
            <svg width={SVG_W} height={SVG_H}>
              {svgPts.length >= 3 && (
                <polygon points={polyPts} fill="rgba(194,134,90,0.12)" stroke="#C2865A" strokeWidth="1.5" />
              )}
              {svgPts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x} cy={p.y}
                  r={selectedVertex === i ? 9 : 6}
                  fill={selectedVertex === i ? '#EF4444' : '#C2865A'}
                  stroke={selectedVertex === i ? '#FCA5A5' : 'rgba(255,255,255,0.6)'}
                  strokeWidth="2"
                  onClick={() => setSelectedVertex(selectedVertex === i ? null : i)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </svg>
          </div>

          {/* Area stats */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
                {Math.round(area.sqFt).toLocaleString()} ft²
              </span>
              <span style={{ fontSize: 14, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>
                {area.sqM.toFixed(1)} m²
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>
              {coords.length} {t('vertices')} · {t('tapToRemove')}
            </div>
          </div>

          {/* Selected vertex action */}
          {selectedVertex !== null && (
            <div style={{ background: '#1C0A0A', border: '1px solid #7F1D1D', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#FCA5A5', fontFamily: "'DM Sans', sans-serif" }}>
                {t('vertex')} #{selectedVertex + 1} {t('selected')}
              </span>
              <button
                onClick={() => removeVertex(selectedVertex)}
                disabled={coords.length <= 4}
                style={{ padding: '7px 14px', background: coords.length > 4 ? '#EF4444' : '#333', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: coords.length > 4 ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif" }}
              >
                {t('removeVertex')}
              </button>
            </div>
          )}

          {/* Small area warning */}
          {smallArea && (
            <div style={{ background: '#1C1A0A', border: '1px solid #78350F', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8 }}>
              <span style={{ color: '#F59E0B', flexShrink: 0 }}>⚠</span>
              <span style={{ fontSize: 13, color: '#FCD34D', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{t('smallAreaWarning')}</span>
            </div>
          )}

        </div>

        <div style={{ padding: '16px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setCoords([]); setStep('walking') }}
            style={{ flex: 1, padding: 14, background: 'none', border: '1px solid #333', borderRadius: 12, color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            {t('retake')}
          </button>
          <button
            onClick={() => setStep('configure')}
            style={{ flex: 2, padding: 14, background: 'linear-gradient(135deg, #C2865A, #A0694A)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            {t('continue')} →
          </button>
        </div>
      </div>
    )
  }

  // ── STEP: CONFIGURE ────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setStep('review')} style={{ background: 'none', border: 'none', color: '#C2865A', cursor: 'pointer', padding: 0 }}>
          <Icons.Back />
        </button>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{t('configureArea')}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Area summary chip */}
        <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '10px 14px', marginBottom: 20, border: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('measuredArea')}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#C2865A', fontFamily: "'DM Sans', sans-serif" }}>
            {Math.round(area.sqFt).toLocaleString()} ft²
          </span>
        </div>

        {/* Label */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
            {t('areaLabel')} *
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={t('areaLabelPlaceholder')}
            style={{ width: '100%', background: '#1a1a1a', border: `1.5px solid ${label.trim() ? '#C2865A' : '#333'}`, borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 15, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* Material */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
            {t('material')} *
          </label>
          {materials.length === 0 ? (
            <div style={{ padding: '12px 14px', color: '#6B7280', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{t('loading')}</div>
          ) : (
            <select
              value={selectedMaterialId}
              onChange={e => handleMaterialChange(e.target.value)}
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 15, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}
            >
              {materials.map(m => (
                <option key={m.id} value={m.id}>
                  {lang === 'es' ? m.nameEs : m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Depth stepper */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
            {t('depth')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => handleDepthChange(-1)} style={{ width: 42, height: 42, borderRadius: 8, background: '#1a1a1a', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Minus />
            </button>
            <div style={{ flex: 1, textAlign: 'center', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              {depthInches}" {lang === 'es' ? 'pulgadas' : 'inches'}
            </div>
            <button onClick={() => handleDepthChange(1)} style={{ width: 42, height: 42, borderRadius: 8, background: '#1a1a1a', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Plus />
            </button>
          </div>
        </div>

        {/* Calculated quantity */}
        <div style={{ background: 'rgba(194,134,90,0.08)', border: '1px solid rgba(194,134,90,0.25)', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C2865A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>{t('calculatedQty')}</div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{calcResult.cubicYards.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>CY</div>
            </div>
            <div style={{ width: 1, background: '#2a2a2a' }} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{calcResult.tons.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>{t('tons')}</div>
            </div>
          </div>

          {/* Manual tons adjust */}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>{t('adjustQty')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setManualTons(prev => Math.max(0.5, parseFloat(((prev ?? calcResult.tons) - 0.5).toFixed(1))))}
              style={{ width: 36, height: 36, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icons.Minus />
            </button>
            <div style={{ flex: 1, textAlign: 'center', background: '#111', border: '1px solid #333', borderRadius: 8, padding: '8px', color: manualTons !== null ? '#F59E0B' : '#fff', fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
              {effectiveTons.toFixed(1)} T
            </div>
            <button
              onClick={() => setManualTons(prev => parseFloat(((prev ?? calcResult.tons) + 0.5).toFixed(1)))}
              style={{ width: 36, height: 36, borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icons.Plus />
            </button>
            {manualTons !== null && (
              <button
                onClick={() => setManualTons(null)}
                style={{ padding: '6px 10px', background: 'none', border: '1px solid #333', borderRadius: 8, color: '#9CA3AF', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                {t('reset')}
              </button>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ background: '#161410', border: '1px solid #3D2E0F', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8 }}>
          <span style={{ color: '#F59E0B', flexShrink: 0 }}>ℹ</span>
          <span style={{ fontSize: 12, color: '#D4A843', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{t('gpsDisclaimer')}</span>
        </div>

        {saveError && (
          <div style={{ background: '#7F1D1D', border: '1px solid #991B1B', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13, color: '#FCA5A5', fontFamily: "'DM Sans', sans-serif" }}>
            {saveError}
          </div>
        )}

      </div>

      <div style={{ padding: '16px', borderTop: '1px solid #2a2a2a' }}>
        <button
          onClick={handleSave}
          disabled={saving || !label.trim()}
          style={{ width: '100%', padding: 16, background: label.trim() ? 'linear-gradient(135deg, #C2865A, #A0694A)' : '#333', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: label.trim() ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? t('saving') : t('saveMeasurement')}
        </button>
      </div>
    </div>
  )
}
