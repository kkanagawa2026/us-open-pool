import { useState, useEffect, useCallback } from 'react'
import { ODDS } from '../odds'

const TOTAL_PICKS = 40
const NUM_PARTICIPANTS = 10

// Always derive the field from the static odds — never from the blob
const STATIC_FIELD = Object.keys(ODDS).map((name) => ({
  id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  name,
  odds: ODDS[name],
}))

function getSlotInfo(slotIndex, draftOrder, participants) {
  const round = Math.floor(slotIndex / NUM_PARTICIPANTS)
  const posInRound = slotIndex % NUM_PARTICIPANTS
  const orderIndex = round % 2 === 0 ? posInRound : (NUM_PARTICIPANTS - 1) - posInRound
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
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('odds')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [message, setMessage] = useState('')
  const [picking, setPicking] = useState(false)

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/draft-state')
    const data = await res.json()
    setState(prev => {
      if (prev && data.picks?.length > (prev.picks?.length ?? 0)) {
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

  async function confirmPick() {
    if (!selectedPlayer || picking || !currentInfo) return
    setPicking(true)
    setMessage('')
    const res = await fetch('/api/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantName: currentInfo.participantName,
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
      }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage(data.error)
    } else {
      setState(data)
      setSelectedPlayer(null)
      setSearch('')
      setMessage(`✓ ${selectedPlayer.name} drafted by ${currentInfo.participantName}`)
    }
    setPicking(false)
  }

  if (!state) {
    return <div className="page"><div className="loading">Loading…</div></div>
  }

  if (state.status === 'not-initialized') {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">⛳</div>
          <p>Draft hasn't been set up yet.</p>
          <a href="#admin" className="btn-primary">Go to Admin</a>
        </div>
      </div>
    )
  }

  const draftComplete = state.status === 'complete' || state.picks.length >= TOTAL_PICKS
  const currentSlot = state.picks.length
  const currentInfo = draftComplete ? null : getSlotInfo(currentSlot, state.draftOrder, state.participants)

  const pickedIds = new Set(state.picks.map((p) => p.playerId))

  // Use static field — always current regardless of when draft was initialized
  const allPlayers = STATIC_FIELD.map((g) => ({
    ...g,
    isDrafted: pickedIds.has(g.id),
  }))

  // Sort: available players sorted by choice, drafted players at bottom
  const available = allPlayers.filter((g) => !g.isDrafted)
  const drafted = allPlayers.filter((g) => g.isDrafted)

  const sort = sortBy === 'name'
    ? (a, b) => a.name.localeCompare(b.name)
    : oddsSort

  const searchFn = (g) => g.name.toLowerCase().includes(search.toLowerCase())

  const availableSorted = available.filter(searchFn).sort(sort)
  const draftedSorted = drafted.filter(searchFn).sort(sort)
  const displayList = [...availableSorted, ...draftedSorted]

  // Build board slots
  const slots = Array.from({ length: TOTAL_PICKS }, (_, i) => {
    const info = getSlotInfo(i, state.draftOrder, state.participants)
    return { ...info, pick: state.picks[i], isCurrent: i === currentSlot && !draftComplete }
  })
  const rounds = Array.from({ length: 4 }, (_, r) =>
    slots.slice(r * NUM_PARTICIPANTS, (r + 1) * NUM_PARTICIPANTS)
  )

  // Group picks by participant for "My team" summaries
  const picksByParticipant = {}
  for (const pick of state.picks) {
    if (!picksByParticipant[pick.participantName]) picksByParticipant[pick.participantName] = []
    picksByParticipant[pick.participantName].push(pick)
  }

  return (
    <div className="page draft-page">

      {/* Clock bar */}
      {draftComplete ? (
        <div className="clock-bar complete">
          <span className="clock-icon">🏆</span>
          Draft Complete!
        </div>
      ) : (
        <div className="clock-bar on-the-clock">
          <div className="clock-left">
            <span className="clock-label">NOW PICKING</span>
            <span className="clock-name">{currentInfo?.participantName}</span>
          </div>
          <div className="clock-right">
            <span className="clock-pick">Pick {currentSlot + 1} of {TOTAL_PICKS}</span>
            <span className="clock-round">Round {currentInfo?.round} of 4</span>
          </div>
        </div>
      )}

      {message && <div className="banner">{message}</div>}

      <div className="draft-layout">

        {/* === PLAYER LIST === */}
        <div className="draft-main">

          {/* Confirm DRAFT bar */}
          {selectedPlayer && !draftComplete && (
            <div className="draft-confirm-bar">
              <div className="draft-confirm-name">
                <span className="confirm-check">✓</span>
                <span>{selectedPlayer.name}</span>
                {selectedPlayer.odds != null && (
                  <span className="confirm-odds">{formatOdds(selectedPlayer.odds)}</span>
                )}
              </div>
              <div className="draft-confirm-actions">
                <button className="btn-cancel-pick" onClick={() => setSelectedPlayer(null)}>
                  Cancel
                </button>
                <button className="btn-draft" onClick={confirmPick} disabled={picking}>
                  {picking ? 'Drafting…' : `DRAFT`}
                </button>
              </div>
            </div>
          )}

          <div className="player-picker">
            <div className="picker-controls">
              <input
                className="search-input"
                placeholder="Search players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="sort-toggle">
                <button
                  className={sortBy === 'odds' ? 'active' : ''}
                  onClick={() => setSortBy('odds')}
                >
                  Odds
                </button>
                <button
                  className={sortBy === 'name' ? 'active' : ''}
                  onClick={() => setSortBy('name')}
                >
                  A–Z
                </button>
              </div>
            </div>

            <div className="player-list-header">
              <span></span>
              <span>Player</span>
              <span className="col-right">Odds</span>
              <span className="col-right">Status</span>
            </div>

            <div className="player-list">
              {displayList.length === 0 && (
                <p className="muted no-results">No players found</p>
              )}
              {displayList.map((player) => {
                const isSelected = selectedPlayer?.id === player.id
                const draftedBy = player.isDrafted
                  ? state.picks.find((p) => p.playerId === player.id)?.participantName
                  : null
                return (
                  <button
                    key={player.id}
                    className={[
                      'player-row',
                      player.isDrafted ? 'drafted' : '',
                      isSelected ? 'selected' : '',
                    ].join(' ')}
                    onClick={() => !player.isDrafted && !draftComplete && setSelectedPlayer(
                      isSelected ? null : player
                    )}
                    disabled={player.isDrafted || draftComplete}
                  >
                    <span className={`player-radio ${isSelected ? 'checked' : ''}`} />
                    <span className="player-name">{player.name}</span>
                    <span className={`player-odds col-right ${player.odds != null && player.odds <= 1000 ? 'fav' : ''}`}>
                      {player.odds != null ? formatOdds(player.odds) : '—'}
                    </span>
                    <span className="player-status col-right">
                      {player.isDrafted ? (
                        <span className="drafted-tag">{draftedBy ?? 'Drafted'}</span>
                      ) : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* === DRAFT BOARD === */}
        <div className="draft-sidebar">
          <h3>Draft Board</h3>
          {rounds.map((round, rIdx) => (
            <div key={rIdx} className="round-block">
              <div className="round-label">Round {rIdx + 1}</div>
              {round.map((slot, sIdx) => (
                <div
                  key={sIdx}
                  className={[
                    'board-row',
                    slot.isCurrent ? 'current' : '',
                    slot.pick ? 'done' : '',
                  ].join(' ')}
                >
                  <span className="board-pick-num">#{rIdx * NUM_PARTICIPANTS + sIdx + 1}</span>
                  <span className="board-participant">{slot.participantName}</span>
                  <span className="board-player">
                    {slot.pick ? slot.pick.playerName : slot.isCurrent ? '← picking' : ''}
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
