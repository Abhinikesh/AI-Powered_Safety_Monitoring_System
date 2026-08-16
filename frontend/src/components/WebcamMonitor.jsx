import { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import './WebcamMonitor.css'

const API_URL = 'http://localhost:8000'
// Retry interval when backend is unreachable (ms)
const RETRY_INTERVAL_MS = 5000
// How often to capture and send a frame (ms)
const CAPTURE_INTERVAL_MS = 1000
// Minimum time between alert sounds (ms)
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

  // Keep latest values accessible inside setInterval callbacks without stale closures
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
        video: { width: { ideal: 640 }, height: { ideal: 480 } }
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
      // Stop all camera tracks on component unmount
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

    // Play the alert sound (blocked by browsers until user interacts with the page)
    try {
      const audio = new Audio('/alert.wav')
      audio.volume = 0.6
      audio.play().catch(() => {
        // Autoplay blocked — common on first load, fine to ignore
      })
    } catch (_) {}

    const firstViol = newViolations[0]
    const typeLabel = firstViol ? firstViol.class_name : 'Compliance Warning'
    const isZone = firstViol?.class_name === 'restricted-zone-entry'

    setToast({
      title: isZone ? '🚨 Zone Breach Detected' : '⚠️ Safety Violation Logged',
      message: `${typeLabel} at ${new Date().toLocaleTimeString()}`,
      type: isZone ? 'zone' : 'ppe',
    })

    // Auto-dismiss the toast after 4 seconds
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
    // Always sync canvas dimensions to actual video resolution
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
      ctx.lineWidth = 2
      ctx.setLineDash([7, 5])
      ctx.stroke()
      ctx.setLineDash([])

      zonePoints.forEach(([px, py], idx) => {
        ctx.beginPath()
        ctx.arc(px, py, 5, 0, 2 * Math.PI)
        ctx.fillStyle = '#f97316'
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px Inter, sans-serif'
        ctx.fillText(`P${idx + 1}`, px + 8, py + 4)
      })
    }

    // Draw detection bounding boxes
    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.box
      const isZoneEntry = violations.some(
        v => v.class_name === 'restricted-zone-entry' && v.box?.join() === det.box?.join()
      )
      const isPPEViolation = det.class_name.toLowerCase().startsWith('no-')

      let stroke = '#10b981' // green — compliant
      let fill = 'rgba(16, 185, 129, 0.15)'

      if (isZoneEntry) {
        stroke = '#f97316' // orange — zone entry
        fill = 'rgba(249, 115, 22, 0.2)'
      } else if (isPPEViolation) {
        stroke = '#ef4444' // red — PPE violation
        fill = 'rgba(239, 68, 68, 0.2)'
      }

      // Box fill
      ctx.fillStyle = fill
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1)

      // Box border
      ctx.strokeStyle = stroke
      ctx.lineWidth = 2.5
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      // Label text
      const label = isZoneEntry
        ? `⚠ ZONE ENTRY ${(det.confidence * 100).toFixed(0)}%`
        : `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`

      ctx.font = '600 12px Inter, sans-serif'
      const textW = ctx.measureText(label).width
      const labelY = Math.max(0, y1 - 22)

      ctx.fillStyle = stroke
      ctx.fillRect(x1, labelY, textW + 10, 20)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, x1 + 5, labelY + 14)
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

        // Show reconnected banner when server comes back after being offline
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

      {/* Control Bar */}
      <div className="control-bar">
        <div className="status-badge-container">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-text">LIVE MONITORING</span>
        </div>

        <div className="control-group">
          <button
            className="settings-toggle-btn"
            onClick={() => setShowSettings(s => !s)}
            aria-expanded={showSettings}
          >
            ⚙ Threshold ({Math.round(confidenceThreshold * 100)}%)
          </button>

          {zonePoints.length < 4 && (
            <button
              className={`zone-btn ${isSettingZone ? 'active' : ''}`}
              onClick={() => setIsSettingZone(s => !s)}
            >
              {isSettingZone ? `Click (${zonePoints.length}/4)` : '➕ Set Zone'}
            </button>
          )}
          {zonePoints.length > 0 && (
            <button className="zone-btn clear" onClick={clearZone}>
              ✕ Clear Zone
            </button>
          )}
        </div>

        <div
          className={`compliance-indicator ${
            hasZoneEntry ? 'zone-flash' : hasViolation ? 'violation-flash' : 'all-clear'
          }`}
          role="status"
          aria-live="polite"
        >
          {hasZoneEntry
            ? '🚨 PERSON IN RESTRICTED ZONE'
            : hasViolation
            ? '⚠ PPE VIOLATION DETECTED'
            : '✓ ALL CLEAR'}
        </div>
      </div>

      {/* Confidence Threshold Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="setting-item">
            <label htmlFor="threshold-slider">
              Confidence Threshold: <strong>{(confidenceThreshold * 100).toFixed(0)}%</strong>
            </label>
            <input
              id="threshold-slider"
              type="range"
              min="0.10"
              max="0.95"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            />
            <span className="setting-desc">
              Lower = more sensitive (more detections). Higher = stricter (fewer false alarms).
            </span>
          </div>
        </div>
      )}

      {/* Status Banners */}
      {reconnected && (
        <div className="error-banner success" role="status">
          ✓ Reconnected to the backend server successfully.
        </div>
      )}
      {serverError && (
        <div className="error-banner warning" role="alert">
          ⚠ Cannot reach the backend. Retrying automatically every 5 seconds...
        </div>
      )}
      {isSettingZone && (
        <div className="guide-banner">
          Click {4 - zonePoints.length} more point{4 - zonePoints.length !== 1 ? 's' : ''} on the video to define your restricted zone.
        </div>
      )}
      {camError && (
        <div className="error-banner card" role="alert">
          <p>{camError}</p>
          <button onClick={setupCamera} className="retry-cam-btn">🔄 Retry Camera</button>
        </div>
      )}

      {/* Video Feed with Canvas Overlay */}
      <div
        className={`video-wrapper ${
          hasZoneEntry ? 'has-zone' : hasViolation ? 'has-violation' : ''
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="webcam-video"
          aria-label="Live webcam feed"
        />
        <canvas
          ref={overlayCanvasRef}
          className={`overlay-canvas ${isSettingZone ? 'interactive' : ''}`}
          onClick={handleCanvasClick}
          aria-hidden="true"
        />
        {/* Hidden canvas for frame capture — never visible to the user */}
        <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
