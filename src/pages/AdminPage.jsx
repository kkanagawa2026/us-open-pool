import { useState, useEffect } from 'react'
import { ODDS } from '../odds'

const EMPTY_PARTICIPANTS = Array(13).fill('')

// Build the draft field from our static odds — one entry per player
const STATIC_FIELD = Object.keys(ODDS).map((name) => ({
  id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  name,
}))

export default function AdminPage() {
  const [participants, setParticipants] = useState(EMPTY_PARTICIPANTS)
  const [state, setState] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchState()
  }, [])

  async function fetchState() {
    const res = await fetch('/api/draft-state')
    const data = await res.json()
    setState(data)
    if (data.participants) setParticipants(data.participants)
  }

  function setParticipant(index, value) {
    const copy = [...participants]
    copy[index] = value
    setParticipants(copy)
  }

  async function handleSetup() {
    const names = participants.map((n) => n.trim())
    if (names.some((n) => !n)) {
      setMessage('All 13 participant names are required.')
      return
    }
    if (new Set(names).size !== 13) {
      setMessage('All names must be unique.')
      return
    }
    setLoading(true)
    setMessage('')
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: names, field: STATIC_FIELD }),
    })
    const data = await res.json()
    setState(data)
    setMessage('Draft initialized! Share the Draft link with all participants.')
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
            {' — '}{state.picks.length}/52 picks made
          </div>
          <button className="btn-danger" onClick={handleReset}>Reset Draft</button>
        </div>
      )}

      {lastPick && (
        <div className="undo-box">
          <div className="undo-info">
            <span className="undo-label">Last pick</span>
            <span className="undo-pick-detail">
              <strong>#{lastPick.pickNumber}</strong> — {lastPick.playerName}
              <span className="muted"> by {lastPick.participantName}</span>
            </span>
          </div>
          <button className="btn-undo" onClick={handleUndoPick}>Undo This Pick</button>
        </div>
      )}

      <section className="form-section">
        <h3>Participants (13)</h3>
        <p className="muted">Enter all 13 names before initializing.</p>
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
        <p className="event-label">2026 U.S. Open — Shinnecock Hills</p>
        <p className="muted">{STATIC_FIELD.length} players · sorted by Vegas odds in the draft room</p>
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
          <p className="muted">Rounds 2 and 4 go in reverse. 52 total picks.</p>
          <div className="draft-order-table">
            <div className="order-header">
              <span>#</span>
              <span>Participant</span>
              <span>R1</span>
              <span>R2</span>
              <span>R3</span>
              <span>R4</span>
            </div>
            {state.draftOrder.map((pIdx, slot) => (
              <div key={slot} className="order-row">
                <span className="slot-num">#{slot + 1}</span>
                <span>{state.participants[pIdx]}</span>
                <span className="pick-num">#{slot + 1}</span>
                <span className="pick-num">#{13 + (12 - slot) + 1}</span>
                <span className="pick-num">#{26 + slot + 1}</span>
                <span className="pick-num">#{39 + (12 - slot) + 1}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
