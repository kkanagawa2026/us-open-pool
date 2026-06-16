import { useState, useEffect } from 'react'

const EMPTY_PARTICIPANTS = Array(12).fill('')

export default function AdminPage() {
  const [participants, setParticipants] = useState(EMPTY_PARTICIPANTS)
  const [golferInfo, setGolferInfo] = useState({ golfers: [], eventName: '' })
  const [state, setState] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchState()
    fetchGolfers()
  }, [])

  async function fetchState() {
    const res = await fetch('/api/draft-state')
    const data = await res.json()
    setState(data)
    if (data.participants) setParticipants(data.participants)
  }

  async function fetchGolfers() {
    const res = await fetch('/api/golfers')
    const data = await res.json()
    setGolferInfo(data)
  }

  function setParticipant(index, value) {
    const copy = [...participants]
    copy[index] = value
    setParticipants(copy)
  }

  async function handleSetup() {
    const names = participants.map((n) => n.trim())
    if (names.some((n) => !n)) {
      setMessage('All 12 participant names are required.')
      return
    }
    if (new Set(names).size !== 12) {
      setMessage('All names must be unique.')
      return
    }
    setLoading(true)
    setMessage('')
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: names, field: golferInfo.golfers }),
    })
    const data = await res.json()
    setState(data)
    setMessage('Draft initialized! Share the Draft Room link with all participants.')
    setLoading(false)
  }

  async function handleReset() {
    if (!confirm('Reset the entire draft? All picks will be lost.')) return
    await fetch('/api/reset', { method: 'POST' })
    setState({ status: 'not-initialized' })
    setParticipants(EMPTY_PARTICIPANTS)
    setMessage('Draft has been reset.')
  }

  async function handleUndoPick() {
    const lastPick = state.picks[state.picks.length - 1]
    if (!confirm(`Undo pick #${lastPick.pickNumber}: ${lastPick.playerName} (${lastPick.participantName})?`)) return
    const res = await fetch('/api/undo-pick', { method: 'POST' })
    const data = await res.json()
    if (data.state) {
      setState(data.state)
      setMessage(`Undid pick #${lastPick.pickNumber}: ${lastPick.playerName} returned to the pool.`)
    } else {
      setMessage('Failed to undo pick.')
    }
  }

  const draftActive = state?.status === 'drafting' || state?.status === 'complete'
  const lastPick = state?.picks?.length > 0 ? state.picks[state.picks.length - 1] : null

  return (
    <div className="page admin-page">
      <h2>Admin Setup</h2>

      {message && <div className="banner">{message}</div>}

      {draftActive && (
        <div className="info-box">
          <div>
            <strong>Draft {state.status === 'complete' ? 'complete' : 'active'}</strong>
            {' — '}{state.picks.length}/48 picks made
          </div>
          <button className="btn-danger" onClick={handleReset}>
            Reset Draft
          </button>
        </div>
      )}

      {/* Undo last pick */}
      {lastPick && (
        <div className="undo-box">
          <div className="undo-info">
            <span className="undo-label">Last pick</span>
            <span className="undo-pick-detail">
              <strong>#{lastPick.pickNumber}</strong> — {lastPick.playerName}
              <span className="muted"> by {lastPick.participantName}</span>
            </span>
          </div>
          <button className="btn-undo" onClick={handleUndoPick}>
            Undo This Pick
          </button>
        </div>
      )}

      <section className="form-section">
        <h3>Participants</h3>
        <p className="muted">Enter all 12 names before initializing.</p>
        <div className="participant-grid">
          {participants.map((name, i) => (
            <div key={i} className="participant-row">
              <span className="slot-num">{i + 1}</span>
              <input
                value={name}
                onChange={(e) => setParticipant(i, e.target.value)}
                placeholder={`Participant ${i + 1}`}
                disabled={draftActive}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h3>Golf Field</h3>
        {golferInfo.eventName && (
          <p className="event-label">{golferInfo.eventName}</p>
        )}
        {golferInfo.golfers.length === 0 ? (
          <p className="muted">Fetching player field from ESPN…</p>
        ) : (
          <p className="muted">{golferInfo.golfers.length} players loaded from ESPN</p>
        )}
      </section>

      {!draftActive && (
        <div className="action-row">
          <button className="btn-primary" onClick={handleSetup} disabled={loading}>
            {loading ? 'Initializing…' : 'Initialize Draft & Randomize Order'}
          </button>
        </div>
      )}

      {draftActive && (
        <section className="form-section">
          <h3>Snake Draft Order</h3>
          <p className="muted">Round 2 and 4 go in reverse order.</p>
          <div className="draft-order-table">
            <div className="order-header">
              <span>Slot</span>
              <span>Participant</span>
              <span>Round 1</span>
              <span>Round 2</span>
              <span>Round 3</span>
              <span>Round 4</span>
            </div>
            {state.draftOrder.map((pIdx, slot) => (
              <div key={slot} className="order-row">
                <span className="slot-num">#{slot + 1}</span>
                <span>{state.participants[pIdx]}</span>
                <span className="pick-num">#{slot + 1}</span>
                <span className="pick-num">#{12 + (11 - slot) + 1}</span>
                <span className="pick-num">#{24 + slot + 1}</span>
                <span className="pick-num">#{36 + (11 - slot) + 1}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
