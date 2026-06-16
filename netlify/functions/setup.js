import { getStore } from '@netlify/blobs'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { participants, field } = await req.json()

  if (!participants || participants.length !== 10) {
    return new Response('Need exactly 10 participants', { status: 400 })
  }

  const draftOrder = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

  const state = {
    status: 'drafting',
    participants,
    draftOrder,
    picks: [],
    field: field || [],
    createdAt: new Date().toISOString(),
  }

  const store = getStore('golf-pool')
  await store.set('draft-state', JSON.stringify(state))

  return Response.json(state)
}

export const config = { path: '/api/setup' }
