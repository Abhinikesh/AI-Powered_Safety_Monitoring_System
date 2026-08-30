import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import './ViolationsDashboard.css'

const API_URL = 'http://localhost:8000'

// Color map for chart bars — consistent with the UI badge colors
const CHART_COLORS = {
  'no-helmet': '#ef4444',
  'no-vest': '#f59e0b',
  'restricted-zone-entry': '#f97316',
  'NO-Hardhat': '#ef4444',
  'NO-Safety Vest': '#f59e0b',
}
const DEFAULT_BAR_COLOR = '#818cf8'

export default function ViolationsDashboard() {
  const [violations, setViolations] = useState([])
  const [stats, setStats] = useState({})
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  // Filter state
  const [selectedType, setSelectedType] = useState('all')
  const [selectedDate, setSelectedDate] = useState('')

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

  // Client-side filtering — fast enough for a dataset of this size
  const filteredViolations = violations.filter(v => {
    const matchType = selectedType === 'all' || v.violation_type === selectedType
    const matchDate = !selectedDate || (v.timestamp || '').startsWith(selectedDate)
    return matchType && matchDate
  })

  // Build chart data from stats object
  const chartData = Object.entries(stats).map(([name, count]) => ({ name, count }))

  // Find the type with the highest count — fixed reduce bug from original
  const mostCommonType = chartData.length > 0
    ? chartData.reduce((best, curr) => (curr.count > best.count ? curr : best), chartData[0]).name
    : '—'

  // Build snapshot URL from stored filename
  const getSnapshotUrl = (snapshotPath) => {
    if (!snapshotPath) return ''
    // snapshot_path stores only the filename now — directly construct URL
    const filename = snapshotPath.includes('/') || snapshotPath.includes('\\')
      ? snapshotPath.split(/[/\\]/).pop()  // Handle legacy full-path entries
      : snapshotPath
    return `${API_URL}/snapshots/${filename}`
  }

  const clearFilters = () => {
    setSelectedType('all')
    setSelectedDate('')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-container">

      {/* Backend connection error */}
      {fetchError && (
        <div className="fetch-error-banner">
          <span>⚠ Could not load dashboard data — make sure the backend is running.</span>
          <button onClick={fetchData} className="retry-fetch-btn">Retry</button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Violations Today</span>
          <span className={`stat-value ${todayCount > 0 ? 'highlight' : ''}`}>
            {loading ? '—' : todayCount}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Most Common Type</span>
          <span className="stat-value warning">
            {loading ? '—' : mostCommonType}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Logged (All Time)</span>
          <span className="stat-value">
            {loading ? '—' : violations.length}
          </span>
        </div>
      </div>

      {/* Violation Breakdown Chart */}
      <div className="chart-card">
        <h3>Violations by Type</h3>
        {loading ? (
          <div className="skeleton-chart">
            <div className="spinner" aria-label="Loading chart" />
            <span>Loading analytics...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📊</span>
            <p>No violation data yet. Run the live monitor to start logging.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 16, right: 16, left: -20, bottom: 4 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    background: '#111726',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
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

      {/* Violations Log Table */}
      <div className="table-card">
        <div className="table-header">
          <h3>Violations Log</h3>
          <div className="filter-controls">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="filter-select"
              aria-label="Filter by violation type"
            >
              <option value="all">All Types</option>
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
                Clear
              </button>
            )}

            <button onClick={fetchData} className="refresh-btn" aria-label="Refresh data">
              ↺ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton-table">
            <div className="spinner" aria-label="Loading records" />
            <span>Fetching violation records...</span>
          </div>
        ) : filteredViolations.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🛡️</span>
            <p>
              {violations.length === 0
                ? 'No violations have been recorded yet. Once the live monitor detects issues, they appear here.'
                : 'No violations match the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Snapshot</th>
                  <th>Timestamp</th>
                  <th>Violation Type</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredViolations.map((v, idx) => (
                  <tr key={v.id || idx}>
                    <td>
                      {v.snapshot_path ? (
                        <img
                          src={getSnapshotUrl(v.snapshot_path)}
                          alt={`Snapshot: ${v.violation_type}`}
                          className="thumbnail"
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'inline'
                          }}
                        />
                      ) : null}
                      <span className="no-img" style={{ display: v.snapshot_path ? 'none' : 'inline' }}>
                        No Image
                      </span>
                    </td>
                    <td className="ts-cell">
                      {v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge-type ${
                          v.violation_type === 'restricted-zone-entry'
                            ? 'zone'
                            : v.violation_type?.startsWith('NO-')
                            ? 'no-class'
                            : ''
                        }`}
                      >
                        {v.violation_type || 'unknown'}
                      </span>
                    </td>
                    <td className="conf-text">
                      {v.confidence != null ? `${(v.confidence * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
