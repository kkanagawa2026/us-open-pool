import { useState, useEffect, useCallback, useRef } from 'react'

function getSlotInfo(slotIndex, draftOrder, participants) {
  const round = Math.floor(slotIndex / 12)
  const posInRound = slotIndex % 12
  const orderIndex = round % 2 === 0 ? posInRound : 11 - posInRound
  const participantIndex = draftOrder[orderIndex]
  return {
    round: round + 1,
    participantIndex,
    participantName: participants[participantIndex],
  }
}

function formatOdds(val) {
  if (val == null) return null
  return val > 0 ? `+${val}` : `${val}`
}

// Lower = bigger favorite. Negatives sort before positives.
function oddsSort(a, b) {
  const aHas = a.odds != null
  const bHas = b.odds != null
  if (aHas && !bHas) return -1
  if (!aHas && bHas) return 1
  if (!aHas && !bHas) return a.name.localeCompare(b.name)
  return a.odds - b.odds
}

export default function DraftPage() {
  const [state, setState] = useState(null)
  const [myName, setMyName] = useState(() => localStorage.getItem('myDraftName') || '')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('odds') // 'odds' | 'name'
  const [oddsMap, setOddsMap] = useState({})
  const [oddsSource, setOddsSource] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [message, setMessage] = useState('')
  const [picking, setPicking] = useState(false)
  const selectedRef = useRef(null)

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/draft-state')
    const data = await res.json()
    setState((prev) => {
      // If a new pick came in and our selectedPlayer was taken, clear selection
      if (prev && data.picks?.length > prev.picks?.length) {
        setSelectedPlayer(null)
      }
      return data
    })
  }, [])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 8000)
    return () => clearInterval(interval)
  }, [fetchState])

  useEffect(() => {
    fetch('/api/odds')
      .then((r) => r.json())
      .then((data) => {
        setOddsMap(data.odds ?? {})
        if (data.bookmaker) setOddsSource(data.bookmaker)
      })
      .catch(() => {})
  }, [])

  function chooseName(name) {
    setMyName(name)
    localStorage.setItem('myDraftName', name)
  }

  function togglePlayer(player) {
    setSelectedPlayer((prev) => (prev?.id === player.id ? null : player))
    setMessage('')
  }

  async function confirmPick() {
    if (!selectedPlayer || picking) return
    setPicking(true)
    setMessage('')
    const res = await fetch('/api/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantName: myName,
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
      }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage(data.error)
      setPicking(false)
    } else {
      setState(data)
      setSelectedPlayer(null)
      setSearch('')
      setMessage(`Drafted ${selectedPlayer.name}!`)
      setPicking(false)
    }
  }

  if (!state) {
    return <div className="page"><div className="loading">Loading…</div></div>
  }

  if (state.status === 'not-initialized') {
    return (
      <div className="page">
        <div className="empty-state">
          <p>Draft hasn't been set up yet.</p>
          <a href="#admin" className="btn-primary">Go to Admin</a>
        </div>
      </div>
    )
  }

  const draftComplete = state.status === 'complete' || state.picks.length >= 48
  const currentSlot = state.picks.length
  const currentInfo = draftComplete ? null : getSlotInfo(currentSlot, state.draftOrder, state.participants)
  const isMyTurn = !draftComplete && currentInfo?.participantName === myName

  const pickedIds = new Set(state.picks.map((p) => p.playerId))

  // Merge odds into field, filter picked players, apply search
  const available = (state.field || [])
    .filter((g) => !pickedIds.has(g.id))
    .map((g) => {
      // Try exact name match first, then first/last name partial match
      const odds = oddsMap[g.name] ??
        Object.entries(oddsMap).find(([k]) =>
          k.toLowerCase() === g.name.toLowerCase()
        )?.[1] ?? null
      return { ...g, odds }
    })

  const searched = search
    ? available.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : available

  const sorted = [...searched].sort(
    sortBy === 'name'
      ? (a, b) => a.name.localeCompare(b.name)
      : oddsSort
  )

  // Build all 48 board slots
  const slots = Array.from({ length: 48 }, (_, i) => {
    const info = getSlotInfo(i, state.draftOrder, state.participants)
    return { ...info, pick: state.picks[i], isCurrent: i === currentSlot && !draftComplete }
  })
  const rounds = [slots.slice(0, 12), slots.slice(12, 24), slots.slice(24, 36), slots.slice(36, 48)]

  const myPicks = state.picks.filter((p) => p.participantName === myName)
  const hasOdds = Object.keys(oddsMap).length > 0

  return (
    <div className="page draft-page">
      <div className="draft-layout">

        {/* === LEFT PANEL === */}
        <div className="draft-main">

          {/* Status bar */}
          {draftComplete ? (
            <div className="clock-bar complete">Draft Complete!</div>
          ) : (
            <div className={`clock-bar ${isMyTurn ? 'my-turn' : ''}`}>
              {isMyTurn
                ? `YOUR TURN — Pick ${currentSlot + 1} of 48`
                : `On the clock: ${currentInfo?.participantName} (Pick ${currentSlot + 1}/48 · Round ${currentInfo?.round})`}
            </div>
          )}

          {/* Name selector */}
          {!myName ? (
            <div className="name-selector">
              <label>Who are you?</label>
              <select defaultValue="" onChange={(e) => chooseName(e.target.value)}>
                <option value="" disabled>Select your name…</option>
                {state.participants.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="my-name-bar">
              You: <strong>{myName}</strong>
              <button className="btn-link" onClick={() => chooseName('')}>change</button>
              {myPicks.length > 0 && (
                <span className="my-picks-count">{myPicks.length}/4 picks made</span>
              )}
            </div>
          )}

          {message && <div className="banner">{message}</div>}

          {/* Player picker — only shown on your turn */}
          {isMyTurn && (
            <div className="player-picker">

              {/* Confirm DRAFT button — sticky at top when a player is selected */}
              {selectedPlayer && (
                <div className="draft-confirm-bar" ref={selectedRef}>
                  <div className="draft-confirm-name">
                    <span className="confirm-check">✓</span>
                    {selectedPlayer.name}
                    {selectedPlayer.odds != null && (
                      <span className="confirm-odds">{formatOdds(selectedPlayer.odds)}</span>
                    )}
                  </div>
                  <div className="draft-confirm-actions">
                    <button className="btn-cancel-pick" onClick={() => setSelectedPlayer(null)}>
                      Cancel
                    </button>
                    <button className="btn-draft" onClick={confirmPick} disabled={picking}>
                      {picking ? 'Drafting…' : 'DRAFT'}
                    </button>
                  </div>
                </div>
              )}

              {/* Search + sort controls */}
              <div className="picker-controls">
                <input
                  className="search-input"
                  placeholder="Search players…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus={!selectedPlayer}
                />
                <div className="sort-toggle">
                  <button
                    className={sortBy === 'odds' ? 'active' : ''}
                    onClick={() => setSortBy('odds')}
                    disabled={!hasOdds}
                    title={!hasOdds ? 'Set ODDS_API_KEY to enable' : ''}
                  >
                    Odds
                  </button>
                  <button
                    className={sortBy === 'name' ? 'active' : ''}
                    onClick={() => setSortBy('name')}
                  >
                    Name
                  </button>
                </div>
              </div>

              {/* Column headers */}
              <div className="player-list-header">
                <span></span>
                <span>Player</span>
                <span className="col-right">
                  {sortBy === 'odds' && hasOdds
                    ? `Odds${oddsSource ? ` (${oddsSource})` : ''}`
                    : ''}
                </span>
              </div>

              <div className="player-list">
                {sorted.length === 0 && (
                  <p className="muted no-results">No players found</p>
                )}
                {sorted.map((player) => {
                  const isSelected = selectedPlayer?.id === player.id
                  return (
                    <button
                      key={player.id}
                      className={`player-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => togglePlayer(player)}
                    >
                      <span className={`player-radio ${isSelected ? 'checked' : ''}`} />
                      <span className="player-name">{player.name}</span>
                      <span className={`player-odds col-right ${player.odds != null ? (player.odds <= 0 ? 'fav' : '') : 'muted'}`}>
                        {player.odds != null ? formatOdds(player.odds) : '—'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!draftComplete && !isMyTurn && myName && (
            <div className="waiting-msg">
              Waiting for <strong>{currentInfo?.participantName}</strong> to pick.
              Page auto-refreshes every 8 seconds.
            </div>
          )}

          {/* My picks */}
          {myPicks.length > 0 && (
            <div className="my-picks-box">
              <h4>Your picks</h4>
              {myPicks.map((p) => (
                <div key={p.playerId} className="my-pick-row">
                  <span className="pick-badge">#{p.pickNumber}</span>
                  <span>{p.playerName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* === RIGHT PANEL: Draft Board === */}
        <div className="draft-sidebar">
          <h3>Draft Board</h3>
          {rounds.map((round, rIdx) => (
            <div key={rIdx} className="round-block">
              <div className="round-label">Round {rIdx + 1}</div>
              {round.map((slot, sIdx) => (
                <div
                  key={sIdx}
                  className={`board-row${slot.isCurrent ? ' current' : ''}${slot.pick ? ' done' : ''}`}
                >
                  <span className="board-pick-num">#{rIdx * 12 + sIdx + 1}</span>
                  <span className="board-participant">{slot.participantName}</span>
                  <span className="board-player">
                    {slot.pick ? slot.pick.playerName : slot.isCurrent ? '← on the clock' : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
