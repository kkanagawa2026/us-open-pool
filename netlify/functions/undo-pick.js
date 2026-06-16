import { getStore } from '@netlify/blobs'

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const store = getStore('golf-pool')
  const state = await store.get('draft-state', { type: 'json' })

  if (!state || state.status === 'not-initialized') {
    return new Response('No draft in progress', { status: 400 })
  }

  if (state.picks.length === 0) {
    return new Response('No picks to undo', { status: 400 })
  }

  const removed = state.picks.pop()
  if (state.status === 'complete') {
    state.status = 'drafting'
  }

  await store.set('draft-state', JSON.stringify(state))

  return Response.json({ state, removed })
}

export const config = { path: '/api/undo-pick' }
