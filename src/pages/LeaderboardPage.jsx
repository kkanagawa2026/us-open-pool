import { useState, useEffect } from 'react'

const ROUND_LABELS = ['R1', 'R2', 'R3', 'R4']
const CUT_PENALTY = 10

function normalizeName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function formatScore(val) {
  if (val === null || val === undefined) return '—'
  if (val === 0) return 'E'
  return val > 0 ? `+${val}` : `${val}`
}

function scoreClass(val) {
  if (val === null || val === undefined) return ''
  if (val < 0) return 'under'
  if (val > 0) return 'over'
  return 'even'
}

export default function LeaderboardPage() {
  const [state, setState] = useState(null)
  const [golfers, setGolfers] = useState({})
  const [eventStatus, setEventStatus] = useState('')
  const [currentRound, setCurrentRound] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    const [stateRes, golfersRes] = await Promise.all([
      fetch('/api/draft-state'),
      fetch('/api/golfers'),
    ])
    const stateData = await stateRes.json()
    const golfersData = await golfersRes.json()

    setState(stateData)
    setEventStatus(golfersData.eventStatus ?? '')
    setCurrentRound(golfersData.currentRound ?? 0)

    const index = {}
    for (const g of golfersData.golfers ?? []) {
      index[g.id] = g
      index[g.name] = g
      index[normalizeName(g.name)] = g
    }
    setGolfers(index)
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="page"><div className="loading">Loading…</div></div>
  }

  if (!state || state.status === 'not-initialized') {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">⛳</div>
          <p>Pool hasn't been set up yet.</p>
          <a href="#admin" className="btn-primary">Admin Setup</a>
        </div>
      </div>
    )
  }

  const tournamentLive = eventStatus === 'STATUS_IN_PROGRESS' ||
    Object.values(golfers).some((g) => g.scoreValue !== 0 || g.roundScores?.some((r) => r !== null))

  const weekendStarted = currentRound >= 3
  const draftComplete = state.status === 'complete' || state.picks.length >= 40

  const summaries = state.participants.map((name, idx) => {
    const picks = state.picks.filter((p) => p.participantIndex === idx)

    const players = picks.map((pick) => {
      const live = golfers[pick.playerId] ?? golfers[pick.playerName] ?? golfers[normalizeName(pick.playerName)] ?? null
      const missedCut = weekendStarted && (live?.missedCut ?? false)

      // Per-round scores: use actual round scores; cut players get null for R3/R4
      const roundScores = live
        ? live.roundScores.map((rs, r) => {
            if (missedCut && r >= 2) return null
            return rs
          })
        : [null, null, null, null]

      // Total contribution: cut players = +CUT_PENALTY, others = sum of round scores
      const total = live
        ? missedCut
          ? CUT_PENALTY
          : live.roundScores.reduce((s, r) => s + (r ?? 0), 0)
        : null

      return { pick, live, missedCut, roundScores, total }
    })

    // Per-round team totals (only sum rounds that have started; cut players contribute 0 to R3/R4)
    const roundTotals = ROUND_LABELS.map((_, r) => {
      const hasData = players.some((p) => p.roundScores[r] !== null)
      if (!hasData) return null
      return players.reduce((sum, p) => sum + (p.roundScores[r] ?? 0), 0)
    })

    // Overall total: sum of individual player totals (null players skip)
    const teamTotal = players.reduce((sum, p) => sum + (p.total ?? 0), 0)

    return { name, players, roundTotals, teamTotal, pickCount: picks.length }
  })

  summaries.sort((a, b) => {
    if (a.pickCount === 0 && b.pickCount === 0) return 0
    if (a.pickCount === 0) return 1
    if (b.pickCount === 0) return -1
    if (!tournamentLive) return 0
    return a.teamTotal - b.teamTotal
  })

  return (
    <div className="page leaderboard-page">

      <div className="lb-hero">
        <h1>
          <span className="lb-hero-main">Overall</span>{' '}
          <span className="lb-hero-accent">Leaderboard</span>
        </h1>
        <p className="lb-hero-sub">
          2026 U.S. Open · Shinnecock Hills · Lowest score takes the crown
        </p>
        <div className="lb-meta-row">
          {tournamentLive && (
            <span className="live-badge">
              <span className="live-dot" />
              LIVE
            </span>
          )}
          {!draftComplete && (
            <span className="tag">{state.picks.length}/40 picks made</span>
          )}
          {lastUpdated && (
            <span className="tag muted">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="lb-cards">
        {summaries.map((participant, rank) => (
          <div key={participant.name} className="lb-card">

            {/* Card header: rank + name + total */}
            <div className="lb-card-header">
              <span className={`lb-rank ${rank < 3 ? 'lb-rank-top' : ''}`}>
                {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
              </span>
              <span className="lb-participant-name">{participant.name}</span>
              <span className={`lb-total ${tournamentLive && participant.pickCount > 0 ? scoreClass(participant.teamTotal) : ''}`}>
                {tournamentLive && participant.pickCount > 0
                  ? formatScore(participant.teamTotal)
                  : participant.pickCount > 0
                  ? `${participant.pickCount}/4`
                  : '—'}
              </span>
            </div>

            {participant.pickCount > 0 && (
              <div className="lb-grid">
                {/* Column header row */}
                <div className="lb-grid-row lb-grid-header">
                  <span className="lb-col-name"></span>
                  {ROUND_LABELS.map((label) => (
                    <span key={label} className="lb-col-round">{label}</span>
                  ))}
                  <span className="lb-col-total">TOT</span>
                </div>

                {/* Player rows */}
                {participant.players.map(({ pick, live, missedCut, roundScores, total }) => (
                  <div key={pick.playerId} className={`lb-grid-row${missedCut ? ' cut' : ''}`}>
                    <span className="lb-col-name">
                      {pick.playerName}
                      {missedCut && <span className="cut-badge">CUT</span>}
                      {live && !missedCut && live.thru && (
                        <span className="lb-thru-inline">{live.thru}</span>
                      )}
                    </span>
                    {roundScores.map((rs, r) => (
                      <span key={r} className={`lb-col-round ${scoreClass(rs)}`}>
                        {formatScore(rs)}
                      </span>
                    ))}
                    <span className={`lb-col-total ${scoreClass(total)}`}>
                      {total !== null ? formatScore(total) : '—'}
                    </span>
                  </div>
                ))}

                {/* Round totals row */}
                {tournamentLive && (
                  <div className="lb-grid-row lb-grid-totals">
                    <span className="lb-col-name">Round Total</span>
                    {participant.roundTotals.map((rt, r) => (
                      <span key={r} className={`lb-col-round ${scoreClass(rt)}`}>
                        {formatScore(rt)}
                      </span>
                    ))}
                    <span className={`lb-col-total ${scoreClass(participant.teamTotal)}`}>
                      {formatScore(participant.teamTotal)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {participant.pickCount === 0 && (
              <div className="lb-no-picks">No picks yet</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
