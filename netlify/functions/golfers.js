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
      return {
        id: c.athlete?.id ?? c.id ?? String(Math.random()),
        name: c.athlete?.displayName ?? 'Unknown',
        shortName: c.athlete?.shortName ?? '',
        country: c.athlete?.flag?.alt ?? c.athlete?.country ?? '',
        score: c.score?.displayValue ?? 'E',
        scoreValue: typeof c.score?.value === 'number' ? c.score.value : 0,
        position: c.status?.position?.displayName ?? '-',
        thru: c.status?.type?.shortDetail ?? c.status?.type?.detail ?? '',
        statusName: c.status?.type?.name ?? '',
        rounds,
      }
    })
    .sort((a, b) => a.scoreValue - b.scoreValue)

  return Response.json({
    golfers,
    eventName: event.name ?? null,
    eventStatus: event.competitions?.[0]?.status?.type?.name ?? '',
  })
}

export const config = { path: '/api/golfers' }
