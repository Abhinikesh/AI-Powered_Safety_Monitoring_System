import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid
} from 'recharts'
import './ViolationsDashboard.css'

const API_URL = 'http://localhost:8000'

// Visual color map for violation categories
const CHART_COLORS = {
  'no-helmet': '#ef4444',
  'no-vest': '#f59e0b',
  'restricted-zone-entry': '#f97316',
  'NO-Hardhat': '#ef4444',
  'NO-Safety Vest': '#f59e0b',
  'NO-Mask': '#ec4899',
}
const DEFAULT_BAR_COLOR = '#6366f1'

export default function ViolationsDashboard() {
  const [violations, setViolations] = useState([])
  const [stats, setStats] = useState({})
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  // Filter state
  const [selectedType, setSelectedType] = useState('all')
  const [selectedDate, setSelectedDate] = useState('')

  // Lightbox modal state for snapshot preview
  const [activeSnapshot, setActiveSnapshot] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(false)
    try {
      const [vRes, sRes, tRes] = await Promise.all([
        axios.get(`${API_URL}/violations`),
        axios.get(`${API_URL}/violations/stats`),
        axios.get(`${API_URL}/violations/today`),
      ])
      setViolations(vRes.data || [])
      setStats(sRes.data || {})
      setTodayCount(Array.isArray(tRes.data) ? tRes.data.length : 0)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Client-side filtering
  const filteredViolations = violations.filter(v => {
    const matchType = selectedType === 'all' || v.violation_type === selectedType
    const matchDate = !selectedDate || (v.timestamp || '').startsWith(selectedDate)
    return matchType && matchDate
  })

  // Chart data
  const chartData = Object.entries(stats).map(([name, count]) => ({ name, count }))

  // Most common violation type
  const mostCommonType = chartData.length > 0
    ? chartData.reduce((best, curr) => (curr.count > best.count ? curr : best), chartData[0]).name
    : '—'

  // Construct snapshot URL
  const getSnapshotUrl = (snapshotPath) => {
    if (!snapshotPath) return ''
    const filename = snapshotPath.includes('/') || snapshotPath.includes('\\')
      ? snapshotPath.split(/[/\\]/).pop()
      : snapshotPath
    return `${API_URL}/snapshots/${filename}`
  }

  const clearFilters = () => {
    setSelectedType('all')
    setSelectedDate('')
  }

  // Get icon for badge
  const getViolationBadgeInfo = (type) => {
    switch (type) {
      case 'NO-Hardhat':
      case 'no-helmet':
        return { icon: '⛑️', label: type, className: 'badge-hardhat' }
      case 'NO-Safety Vest':
      case 'no-vest':
        return { icon: '🦺', label: type, className: 'badge-vest' }
      case 'NO-Mask':
      case 'no-mask':
        return { icon: '😷', label: type, className: 'badge-mask' }
      case 'restricted-zone-entry':
        return { icon: '🚨', label: 'Zone Breach', className: 'badge-zone' }
      default:
        return { icon: '⚠️', label: type || 'Violation', className: 'badge-default' }
    }
  }

  return (
    <div className="dashboard-container">

      {/* Snapshot Lightbox Modal */}
      {activeSnapshot && (
        <div className="lightbox-overlay" onClick={() => setActiveSnapshot(null)}>
          <div className="lightbox-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <div className="lightbox-title">
                <strong>Incident Snapshot Preview</strong>
                <span>{new Date(activeSnapshot.timestamp).toLocaleString()}</span>
              </div>
              <button
                className="lightbox-close-btn"
                onClick={() => setActiveSnapshot(null)}
                aria-label="Close image preview"
              >
                ✕
              </button>
            </div>
            <div className="lightbox-body">
              <img
                src={getSnapshotUrl(activeSnapshot.snapshot_path)}
                alt={`Incident: ${activeSnapshot.violation_type}`}
                className="lightbox-img"
              />
            </div>
            <div className="lightbox-footer">
              <span className={`badge-type ${getViolationBadgeInfo(activeSnapshot.violation_type).className}`}>
                {getViolationBadgeInfo(activeSnapshot.violation_type).icon} {activeSnapshot.violation_type}
              </span>
              <span className="lightbox-meta">
                Confidence: <strong>{(activeSnapshot.confidence * 100).toFixed(1)}%</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Backend Connection Error */}
      {fetchError && (
        <div className="fetch-error-banner">
          <span>⚠️ Could not fetch incident data. Ensure the backend API is running on port 8000.</span>
          <button onClick={fetchData} className="retry-fetch-btn">Retry Connection</button>
        </div>
      )}

      {/* Top 3 Summary Metric Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Violations Today</span>
            <div className="stat-icon-wrapper calendar">🕒</div>
          </div>
          <span className={`stat-value ${todayCount > 0 ? 'highlight' : ''}`}>
            {loading ? '—' : todayCount}
          </span>
          <span className="stat-subtext">Since 00:00 UTC</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Most Common Category</span>
            <div className="stat-icon-wrapper warning">⚠️</div>
          </div>
          <span className="stat-value warning">
            {loading ? '—' : mostCommonType}
          </span>
          <span className="stat-subtext">Highest recorded frequency</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Logged (All-Time)</span>
            <div className="stat-icon-wrapper archive">🗄️</div>
          </div>
          <span className="stat-value">
            {loading ? '—' : violations.length}
          </span>
          <span className="stat-subtext">Persistent MongoDB records</span>
        </div>
      </div>

      {/* Violations by Type Analytical Chart */}
      <div className="chart-card">
        <div className="chart-header">
          <h3>Incident Breakdown by Category</h3>
          <span className="chart-subtitle">Aggregated distribution of logged non-compliance events</span>
        </div>

        {loading ? (
          <div className="skeleton-chart">
            <div className="spinner" aria-label="Loading chart" />
            <span>Loading category metrics...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📊</span>
            <p>No violation data recorded yet. Incidents detected in the live monitor will appear here.</p>
          </div>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 24, left: -10, bottom: 8 }}
                barCategoryGap="25%"
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#475569"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                  tick={{ fill: '#94a3b8', fontWeight: 500 }}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                  allowDecimals={false}
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[entry.name] || DEFAULT_BAR_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Historical Violations Log Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Security Incidents Log</h3>
            <span className="table-subtitle">Auditable record of captured violations with snapshots</span>
          </div>

          <div className="filter-controls">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="filter-select"
              aria-label="Filter by violation type"
            >
              <option value="all">All Categories</option>
              <option value="NO-Hardhat">NO-Hardhat</option>
              <option value="NO-Safety Vest">NO-Safety Vest</option>
              <option value="NO-Mask">NO-Mask</option>
              <option value="restricted-zone-entry">restricted-zone-entry</option>
              <option value="no-helmet">no-helmet</option>
              <option value="no-vest">no-vest</option>
            </select>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="filter-date"
              aria-label="Filter by date"
            />

            {(selectedType !== 'all' || selectedDate !== '') && (
              <button onClick={clearFilters} className="clear-filters-btn">
                ✕ Clear
              </button>
            )}

            <button onClick={fetchData} className="refresh-btn" aria-label="Refresh data">
              ↺ Refresh Log
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton-table">
            <div className="spinner" aria-label="Loading records" />
            <span>Retrieving incident logs...</span>
          </div>
        ) : filteredViolations.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🛡️</span>
            <p>
              {violations.length === 0
                ? 'No safety violations logged yet. The monitor is running with full compliance.'
                : 'No incidents match your current category or date filters.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Snapshot</th>
                  <th>Timestamp (UTC)</th>
                  <th>Violation Category</th>
                  <th>Model Confidence</th>
                  <th>Resolution</th>
                </tr>
              </thead>
              <tbody>
                {filteredViolations.map((v, idx) => {
                  const badge = getViolationBadgeInfo(v.violation_type)
                  return (
                    <tr key={v.id || idx}>
                      <td>
                        {v.snapshot_path ? (
                          <div
                            className="thumbnail-wrapper"
                            onClick={() => setActiveSnapshot(v)}
                            title="Click to view full snapshot"
                          >
                            <img
                              src={getSnapshotUrl(v.snapshot_path)}
                              alt={`Incident: ${v.violation_type}`}
                              className="thumbnail"
                              loading="lazy"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'inline'
                              }}
                            />
                            <span className="no-img" style={{ display: 'none' }}>
                              No Preview
                            </span>
                            <span className="thumb-zoom-hint">🔍</span>
                          </div>
                        ) : (
                          <span className="no-img">No Image</span>
                        )}
                      </td>
                      <td className="ts-cell">
                        {v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}
                      </td>
                      <td>
                        <span className={`badge-type ${badge.className}`}>
                          <span className="badge-icon">{badge.icon}</span>
                          {badge.label}
                        </span>
                      </td>
                      <td className="conf-cell">
                        <span className="conf-value">
                          {v.confidence != null ? `${(v.confidence * 100).toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="res-cell">
                        <span className="res-tag">
                          {v.frame_width ? `${v.frame_width}×${v.frame_height}` : '640×480'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
