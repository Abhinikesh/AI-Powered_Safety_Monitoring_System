import { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import './WebcamMonitor.css'

const API_URL = 'http://localhost:8000'
const CAPTURE_INTERVAL_MS = 1000
const ALERT_SOUND_COOLDOWN_MS = 5000

export default function WebcamMonitor() {
  const videoRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const captureCanvasRef = useRef(null)

  const [hasViolation, setHasViolation] = useState(false)
  const [violations, setViolations] = useState([])
  const [detections, setDetections] = useState([])
  const [camError, setCamError] = useState(null)
  const [serverError, setServerError] = useState(false)
  const [reconnected, setReconnected] = useState(false)

  // Settings and zone state
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.50)
  const [showSettings, setShowSettings] = useState(false)
  const [zonePoints, setZonePoints] = useState([])
  const [isSettingZone, setIsSettingZone] = useState(false)

  // Toast notification
  const [toast, setToast] = useState(null)
  const lastAlertTime = useRef(0)

  // Keep latest values accessible inside callbacks without stale closures
  const zonePointsRef = useRef(zonePoints)
  const confidenceRef = useRef(confidenceThreshold)
  const serverErrorRef = useRef(serverError)

  useEffect(() => { zonePointsRef.current = zonePoints }, [zonePoints])
  useEffect(() => { confidenceRef.current = confidenceThreshold }, [confidenceThreshold])
  useEffect(() => { serverErrorRef.current = serverError }, [serverError])

  // ── Camera Setup ────────────────────────────────────────────────────────────
  const setupCamera = useCallback(async () => {
    try {
      setCamError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Webcam access error:', err)
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings and refresh.'
        : err.name === 'NotFoundError'
        ? 'No camera detected. Connect a webcam and refresh the page.'
        : 'Camera unavailable — it may be in use by another application.'
      setCamError(msg)
    }
  }, [])

  useEffect(() => {
    setupCamera()
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [setupCamera])

  // ── Audio & Toast Alert ──────────────────────────────────────────────────────
  const triggerAlerts = useCallback((newViolations) => {
    const now = Date.now()
    if (now - lastAlertTime.current < ALERT_SOUND_COOLDOWN_MS) return

    lastAlertTime.current = now

    try {
      const audio = new Audio('/alert.wav')
      audio.volume = 0.6
      audio.play().catch(() => {})
    } catch (_) {}

    const firstViol = newViolations[0]
    const typeLabel = firstViol ? firstViol.class_name : 'Compliance Warning'
    const isZone = firstViol?.class_name === 'restricted-zone-entry'

    setToast({
      title: isZone ? '🚨 Zone Breach Detected' : '⚠️ Safety Violation Logged',
      message: `${typeLabel} at ${new Date().toLocaleTimeString()}`,
      type: isZone ? 'zone' : 'ppe',
    })

    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Zone Drawing Click Handler ───────────────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    if (!isSettingZone) return
    const canvas = overlayCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)

    setZonePoints(prev => {
      const updated = [...prev, [x, y]]
      if (updated.length >= 4) setIsSettingZone(false)
      return updated
    })
  }, [isSettingZone])

  const clearZone = () => {
    setZonePoints([])
    setIsSettingZone(false)
  }

  // ── Bounding Box & Zone Drawing ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = overlayCanvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    canvas.width = vw
    canvas.height = vh

    ctx.clearRect(0, 0, vw, vh)

    // Draw restricted zone polygon
    if (zonePoints.length > 0) {
      ctx.beginPath()
      ctx.moveTo(zonePoints[0][0], zonePoints[0][1])
      for (let i = 1; i < zonePoints.length; i++) {
        ctx.lineTo(zonePoints[i][0], zonePoints[i][1])
      }
      if (zonePoints.length >= 4) {
        ctx.closePath()
        ctx.fillStyle = 'rgba(239, 68, 68, 0.18)'
        ctx.fill()
      }
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 2.5
      ctx.setLineDash([8, 6])
      ctx.stroke()
      ctx.setLineDash([])

      // Draw numbered vertex markers
      zonePoints.forEach(([px, py], idx) => {
        ctx.beginPath()
        ctx.arc(px, py, 6, 0, 2 * Math.PI)
        ctx.fillStyle = '#f97316'
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Point label
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 11px Inter, sans-serif'
        ctx.fillText(`P${idx + 1}`, px + 9, py + 4)
      })
    }

    // Draw detection bounding boxes with modern rounded pill labels
    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.box
      const isZoneEntry = violations.some(
        v => v.class_name === 'restricted-zone-entry' && v.box?.join() === det.box?.join()
      )
      const isPPEViolation = det.class_name.toLowerCase().startsWith('no-')

      let stroke = '#10b981' // Green — Compliant
      let fill = 'rgba(16, 185, 129, 0.12)'

      if (isZoneEntry) {
        stroke = '#f97316' // Orange — Zone Entry
        fill = 'rgba(249, 115, 22, 0.22)'
      } else if (isPPEViolation) {
        stroke = '#ef4444' // Red — Violation
        fill = 'rgba(239, 68, 68, 0.2)'
      }

      const boxW = x2 - x1
      const boxH = y2 - y1

      // Semi-transparent box fill
      ctx.fillStyle = fill
      ctx.fillRect(x1, y1, boxW, boxH)

      // Box outline
      ctx.strokeStyle = stroke
      ctx.lineWidth = 2.5
      ctx.strokeRect(x1, y1, boxW, boxH)

      // Label text
      const labelText = isZoneEntry
        ? `ZONE ENTRY ${(det.confidence * 100).toFixed(0)}%`
        : `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`

      ctx.font = '600 12px Inter, sans-serif'
      const textW = ctx.measureText(labelText).width

      const pillPadding = 8
      const pillH = 22
      const pillW = textW + pillPadding * 2 + 10
      const pillX = x1
      const pillY = Math.max(4, y1 - pillH - 4)

      // Draw glassmorphism tag backdrop
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(pillX, pillY, pillW, pillH, 5)
      } else {
        ctx.rect(pillX, pillY, pillW, pillH)
      }
      ctx.fillStyle = 'rgba(11, 16, 28, 0.88)'
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.lineWidth = 1.2
      ctx.stroke()

      // Small colored indicator circle
      ctx.beginPath()
      ctx.arc(pillX + 8, pillY + pillH / 2, 3.5, 0, 2 * Math.PI)
      ctx.fillStyle = stroke
      ctx.fill()

      // Crisp label typography
      ctx.fillStyle = '#f8fafc'
      ctx.fillText(labelText, pillX + 16, pillY + 15)
    })
  }, [detections, violations, zonePoints])

  // ── Frame Capture & Detection (interval) ─────────────────────────────────────
  const captureAndDetect = useCallback(async () => {
    const video = videoRef.current
    const captureCanvas = captureCanvasRef.current
    if (!video || !captureCanvas || video.readyState < 4) return

    const ctx = captureCanvas.getContext('2d')
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    captureCanvas.width = vw
    captureCanvas.height = vh
    ctx.drawImage(video, 0, 0, vw, vh)

    captureCanvas.toBlob(async (blob) => {
      if (!blob) return

      const formData = new FormData()
      formData.append('file', blob, 'frame.jpg')
      formData.append('threshold', String(confidenceRef.current))
      if (zonePointsRef.current.length >= 4) {
        formData.append('zone', JSON.stringify(zonePointsRef.current))
      }

      try {
        const res = await axios.post(`${API_URL}/detect`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 4500,
        })

        const resViolations = res.data.violations || []
        const isViol = res.data.has_violation || false

        setDetections(res.data.detections || [])
        setViolations(resViolations)
        setHasViolation(isViol)

        if (serverErrorRef.current) {
          setServerError(false)
          setReconnected(true)
          setTimeout(() => setReconnected(false), 3500)
        }

        if (isViol) triggerAlerts(resViolations)
      } catch {
        setServerError(true)
      }
    }, 'image/jpeg', 0.82)
  }, [triggerAlerts])

  useEffect(() => {
    const id = setInterval(captureAndDetect, CAPTURE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [captureAndDetect])

  // ── Derived State ──────────────────────────────────────────────────────────
  const hasZoneEntry = violations.some(v => v.class_name === 'restricted-zone-entry')

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="webcam-container">

      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <div className="toast-header">
            <strong>{toast.title}</strong>
            <button onClick={() => setToast(null)} aria-label="Dismiss">✕</button>
          </div>
          <p>{toast.message}</p>
        </div>
      )}

      {/* Reconnection / Error Notifications */}
      {reconnected && (
        <div className="error-banner success" role="status">
          ✓ Backend stream re-established.
        </div>
      )}
      {serverError && (
        <div className="error-banner warning" role="alert">
          ⚠ Backend disconnected. Retrying stream automatically every 5s...
        </div>
      )}
      {camError && (
        <div className="error-banner card" role="alert">
          <p>{camError}</p>
          <button onClick={setupCamera} className="retry-cam-btn">🔄 Retry Camera</button>
        </div>
      )}

      {/* Unified Surveillance Control Bar */}
      <div className="control-bar">
        <div className="control-bar-left">
          <div className="status-badge-container">
            <span className="live-dot" aria-hidden="true" />
            <span className="live-text">CAM-01 LIVE</span>
          </div>

          <div className="control-divider" />

          <button
            className={`action-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(s => !s)}
            aria-expanded={showSettings}
          >
            ⚙️ Threshold: <strong>{Math.round(confidenceThreshold * 100)}%</strong>
          </button>

          {zonePoints.length < 4 && (
            <button
              className={`action-btn zone ${isSettingZone ? 'active' : ''}`}
              onClick={() => setIsSettingZone(s => !s)}
            >
              {isSettingZone ? `🎯 Click Vertex (${zonePoints.length}/4)` : '➕ Define Hazard Zone'}
            </button>
          )}

          {zonePoints.length > 0 && (
            <button className="action-btn clear" onClick={clearZone}>
              ✕ Reset Zone
            </button>
          )}
        </div>

        <div className="control-bar-right">
          <div
            className={`compliance-indicator ${
              hasZoneEntry ? 'zone-flash' : hasViolation ? 'violation-flash' : 'all-clear'
            }`}
            role="status"
            aria-live="polite"
          >
            {hasZoneEntry
              ? '🚨 ZONE BREACH'
              : hasViolation
              ? '⚠️ PPE VIOLATION'
              : '✓ ALL CLEAR'}
          </div>
        </div>
      </div>

      {/* Dynamic Confidence Slider Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="threshold-slider">
                Model Confidence Sensitivity: <strong>{(confidenceThreshold * 100).toFixed(0)}%</strong>
              </label>
              <span className="setting-desc">
                Lower = More Detections | Higher = Stricter Filtering
              </span>
            </div>
            <input
              id="threshold-slider"
              type="range"
              min="0.10"
              max="0.95"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Main Surveillance Video Panel */}
      <div
        className={`video-wrapper ${
          hasZoneEntry ? 'has-zone' : hasViolation ? 'has-violation' : ''
        }`}
      >
        {/* Targeting Reticle Corner Brackets */}
        <div className="corner-bracket top-left" aria-hidden="true" />
        <div className="corner-bracket top-right" aria-hidden="true" />
        <div className="corner-bracket bottom-left" aria-hidden="true" />
        <div className="corner-bracket bottom-right" aria-hidden="true" />

        {/* On-Screen Display (OSD) HUD Banner for Zone Setting Mode */}
        {isSettingZone && (
          <div className="osd-hud-banner">
            <span className="hud-pulse">●</span>
            Click on video to place vertex point <strong>#{zonePoints.length + 1}</strong> of 4
          </div>
        )}

        {/* Video Feed and HTML5 Canvas Overlay */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="webcam-video"
          aria-label="Live security video feed"
        />
        <canvas
          ref={overlayCanvasRef}
          className={`overlay-canvas ${isSettingZone ? 'interactive' : ''}`}
          onClick={handleCanvasClick}
          aria-hidden="true"
        />
        <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
