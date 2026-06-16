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
      const rounds = (c.linescores ?? []).map((l) =>
        l.displayValue != null ? l.displayValue : l.value != null ? String(l.value) : '-'
      )
      const statusName = c.status?.type?.name ?? ''
      return {
        id: c.athlete?.id ?? c.id ?? String(Math.random()),
        name: c.athlete?.displayName ?? 'Unknown',
        shortName: c.athlete?.shortName ?? '',
        country: c.athlete?.flag?.alt ?? c.athlete?.country ?? '',
        score: c.score?.displayValue ?? 'E',
        scoreValue: typeof c.score?.value === 'number' ? c.score.value : 0,
        position: c.status?.position?.displayName ?? '-',
        thru: c.status?.type?.shortDetail ?? c.status?.type?.detail ?? '',
        statusName,
        missedCut: statusName === 'STATUS_CUT' || statusName === 'STATUS_MISSED_CUT',
        rounds,
      }
    })
    .sort((a, b) => a.scoreValue - b.scoreValue)

  const currentRound = Math.max(0, ...competitors.map((c) => c.linescores?.length ?? 0))

  return Response.json({
    golfers,
    eventName: event.name ?? null,
    eventStatus: event.competitions?.[0]?.status?.type?.name ?? '',
    currentRound,
  })
}

export const config = { path: '/api/golfers' }
