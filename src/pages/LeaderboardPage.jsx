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

    // Index by both id and name for robust matching
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
          <p>Pool hasn't been set up yet.</p>
          <a href="#admin" className="btn-primary">Admin Setup</a>
        </div>
      </div>
    )
  }

  const tournamentLive = eventStatus === 'STATUS_IN_PROGRESS' ||
    Object.values(golfers).some((g) => g.scoreValue !== 0)

  // Build participant summaries
  const summaries = state.participants.map((name, index) => {
    const picks = state.picks.filter((p) => p.participantIndex === index)
    let total = 0
    const players = picks.map((pick) => {
      const live = golfers[pick.playerId] ?? golfers[pick.playerName] ?? null
      if (live) total += live.scoreValue
      return { pick, live }
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

  const draftComplete = state.status === 'complete' || state.picks.length >= 48

  return (
    <div className="page leaderboard-page">
      <div className="lb-meta">
        <div>
          {eventName && <span className="event-name">{eventName}</span>}
          {!draftComplete && (
            <span className="muted"> · Draft in progress ({state.picks.length}/48 picks)</span>
          )}
          {draftComplete && !tournamentLive && (
            <span className="muted"> · Tournament hasn't started yet</span>
          )}
        </div>
        {lastUpdated && (
          <span className="last-updated">
            Live scores refresh every 60s · Last: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="lb-list">
        {summaries.map((participant, rank) => (
          <div key={participant.name} className="lb-card">
            <div className="lb-card-header">
              <div className="lb-rank-name">
                <span className="lb-rank">#{rank + 1}</span>
                <span className="lb-participant-name">{participant.name}</span>
              </div>
              <div className="lb-card-right">
                {tournamentLive && participant.pickCount > 0 && (
                  <span className={`lb-total ${scoreClass(participant.total)}`}>
                    {formatScore(participant.total)}
                  </span>
                )}
                {!tournamentLive && (
                  <span className="muted">{participant.pickCount}/4 picks</span>
                )}
              </div>
            </div>

            {participant.players.length > 0 && (
              <div className="lb-players">
                {participant.players.map(({ pick, live }) => (
                  <div key={pick.playerId} className="lb-player-row">
                    <span className="lb-player-name">{pick.playerName}</span>
                    {live ? (
                      <div className="lb-player-stats">
                        {live.position && live.position !== '-' && (
                          <span className="lb-pos">T{live.position}</span>
                        )}
                        <span className={`lb-score ${scoreClass(live.scoreValue)}`}>
                          {formatScore(live.scoreValue)}
                        </span>
                        {live.thru && (
                          <span className="lb-thru">{live.thru}</span>
                        )}
                      </div>
                    ) : (
                      <span className="muted lb-no-score">–</span>
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
