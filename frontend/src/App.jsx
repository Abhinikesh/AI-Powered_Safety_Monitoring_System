import { useState } from 'react'
import WebcamMonitor from './components/WebcamMonitor'
import ViolationsDashboard from './components/ViolationsDashboard'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('monitor')

  return (
    <div className="app-shell">
      {/* Top Security Command Navbar */}
      <header className="navbar">
        <div className="navbar-container">
          <div className="brand">
            <div className="brand-icon">🛡️</div>
            <div>
              <span className="brand-name">SAFEGUARD AI</span>
              <span className="brand-sub">Safety Monitoring System</span>
            </div>
          </div>

          <nav className="nav-tabs">
            <button
              className={`nav-btn ${activeTab === 'monitor' ? 'active' : ''}`}
              onClick={() => setActiveTab('monitor')}
            >
              📹 Live Monitor
            </button>
            <button
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Violations Dashboard
            </button>
          </nav>

          <div className="system-status-indicator">
            <span className="pulse-dot"></span>
            <span className="status-text">SYSTEM ONLINE</span>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="main-content">
        <div className="container">
          {activeTab === 'monitor' ? <WebcamMonitor /> : <ViolationsDashboard />}
        </div>
      </main>
    </div>
  )
}

export default App
