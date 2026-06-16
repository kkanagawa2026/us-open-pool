import { useState, useEffect } from 'react'

function formatScore(val) {
  if (val === 0) return 'E'
  return val > 0 ? `+${val}` : `${val}`
}

function scoreClass(val) {
  if (val < 0) return 'under'
  if (val > 0) return 'over'
  return 'even'
}

export default function LeaderboardPage() {
  const [state, setState] = useState(null)
  const [golfers, setGolfers] = useState({})
  const [eventName, setEventName] = useState('')
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
    setEventName(golfersData.eventName ?? '')
    setEventStatus(golfersData.eventStatus ?? '')
    setCurrentRound(golfersData.currentRound ?? 0)

    const index = {}
    for (const g of golfersData.golfers ?? []) {
      index[g.id] = g
      index[g.name] = g
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
    Object.values(golfers).some((g) => g.scoreValue !== 0)

  const weekendStarted = currentRound >= 3

  const summaries = state.participants.map((name, idx) => {
    const picks = state.picks.filter((p) => p.participantIndex === idx)
    let total = 0
    const players = picks.map((pick) => {
      const live = golfers[pick.playerId] ?? golfers[pick.playerName] ?? null
      const missedCut = weekendStarted && live?.missedCut
      const scoreContribution = missedCut ? 10 : (live?.scoreValue ?? 0)
      if (live) total += scoreContribution
      return { pick, live, missedCut, scoreContribution }
    })
    return { name, players, total, pickCount: picks.length }
  })

  summaries.sort((a, b) => {
    if (a.pickCount === 0 && b.pickCount === 0) return 0
    if (a.pickCount === 0) return 1
    if (b.pickCount === 0) return -1
    if (!tournamentLive) return 0
    return a.total - b.total
  })

  const draftComplete = state.status === 'complete' || state.picks.length >= 40

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

      <div className="lb-table">
        <div className="lb-table-header">
          <span>Rank</span>
          <span>Team</span>
          <span className="col-right">Score</span>
        </div>

        {summaries.map((participant, rank) => (
          <div key={participant.name} className="lb-card">
            <div className="lb-card-header">
              <span className={`lb-rank ${rank < 3 ? 'lb-rank-top' : ''}`}>
                {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
              </span>
              <span className="lb-participant-name">{participant.name}</span>
              <span className={`lb-total ${scoreClass(participant.total)}`}>
                {tournamentLive && participant.pickCount > 0
                  ? formatScore(participant.total)
                  : participant.pickCount > 0
                  ? `${participant.pickCount}/4`
                  : '—'}
              </span>
            </div>

            {participant.players.length > 0 && (
              <div className="lb-players">
                {participant.players.map(({ pick, live, missedCut, scoreContribution }) => (
                  <div key={pick.playerId} className={`lb-player-row${missedCut ? ' cut' : ''}`}>
                    <span className="lb-player-name">{pick.playerName}</span>
                    {live ? (
                      <div className="lb-player-stats">
                        {missedCut ? (
                          <>
                            <span className="cut-badge">CUT</span>
                            <span className="lb-score over">+10</span>
                          </>
                        ) : (
                          <>
                            {live.position && live.position !== '-' && (
                              <span className="lb-pos">T{live.position}</span>
                            )}
                            <span className={`lb-score ${scoreClass(live.scoreValue)}`}>
                              {formatScore(live.scoreValue)}
                            </span>
                            {live.thru && (
                              <span className="lb-thru">{live.thru}</span>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </div>
                ))}
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
