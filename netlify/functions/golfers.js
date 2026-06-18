function parseRoundScore(displayValue) {
  if (!displayValue || displayValue === '-' || displayValue === '') return null
  if (displayValue === 'E') return 0
  const n = parseInt(displayValue, 10)
  return isNaN(n) ? null : n
}

export default async (req, context) => {
  let data
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    data = await res.json()
  } catch {
    return Response.json({ golfers: [], eventName: null, error: 'ESPN unavailable' })
  }

  const event = data?.events?.[0]
  if (!event) {
    return Response.json({ golfers: [], eventName: null })
  }

  const competitors = event?.competitions?.[0]?.competitors ?? []

  const golfers = competitors
    .map((c) => {
      // Per-round scores: linescore.displayValue contains the to-par score for each round
      // e.g. '+3', 'E', '-2'. linescore.value is an ESPN internal tracking number.
      const rawLinescores = c.linescores ?? []
      const roundScores = rawLinescores.slice(0, 4).map((l) => parseRoundScore(l.displayValue))
      while (roundScores.length < 4) roundScores.push(null)

      const scoreValue = roundScores.reduce((sum, r) => sum + (r ?? 0), 0)
      const statusName = c.status?.type?.name ?? ''

      return {
        id: c.athlete?.id ?? c.id ?? String(Math.random()),
        name: c.athlete?.displayName ?? 'Unknown',
        shortName: c.athlete?.shortName ?? '',
        country: c.athlete?.flag?.alt ?? c.athlete?.country ?? '',
        scoreValue,
        roundScores,
        position: c.status?.position?.displayName ?? '-',
        thru: c.status?.type?.shortDetail ?? c.status?.type?.detail ?? '',
        statusName,
        missedCut: statusName === 'STATUS_CUT' || statusName === 'STATUS_MISSED_CUT',
      }
    })
    .sort((a, b) => a.scoreValue - b.scoreValue)

  // currentRound = highest round index that has data for any player
  let currentRound = 0
  for (const g of golfers) {
    for (let r = 3; r >= 0; r--) {
      if (g.roundScores[r] !== null) {
        if (r + 1 > currentRound) currentRound = r + 1
        break
      }
    }
  }

  return Response.json({
    golfers,
    eventName: event.name ?? null,
    eventStatus: event.competitions?.[0]?.status?.type?.name ?? '',
    currentRound,
  })
}

export const config = { path: '/api/golfers' }
