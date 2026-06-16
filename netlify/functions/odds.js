// Fetches US Open outright winner odds from The Odds API.
// Set ODDS_API_KEY in Netlify environment variables to enable.
// Sport key to use: golf_us_open_winner
// Free tier: 500 requests/month — cache aggressively.

export default async (req, context) => {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) {
    return Response.json({ odds: {}, error: 'ODDS_API_KEY not set' })
  }

  let data
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/golf_us_open_winner/odds?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) {
      return Response.json({ odds: {}, error: `Odds API returned ${res.status}` })
    }
    data = await res.json()
  } catch (e) {
    return Response.json({ odds: {}, error: String(e) })
  }

  // Pick the first bookmaker available, prefer DraftKings or FanDuel
  const event = Array.isArray(data) ? data[0] : null
  if (!event) return Response.json({ odds: {} })

  const preferred = ['draftkings', 'fanduel', 'betmgm']
  const bookmaker =
    event.bookmakers?.find((b) => preferred.includes(b.key)) ??
    event.bookmakers?.[0]

  if (!bookmaker) return Response.json({ odds: {} })

  const outrightMarket = bookmaker.markets?.find((m) => m.key === 'outrights')
  if (!outrightMarket) return Response.json({ odds: {} })

  // Build name → american odds map
  const odds = {}
  for (const outcome of outrightMarket.outcomes ?? []) {
    if (outcome.name) {
      odds[outcome.name] = outcome.price
    }
  }

  return Response.json({ odds, bookmaker: bookmaker.title }, {
    headers: { 'Cache-Control': 'public, max-age=900' }, // cache 15 min
  })
}

export const config = { path: '/api/odds' }
