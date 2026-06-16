import { getStore } from '@netlify/blobs'

export default async (req, context) => {
  const store = getStore('golf-pool')
  const state = await store.get('draft-state', { type: 'json' })

  return Response.json(state ?? { status: 'not-initialized' }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export const config = { path: '/api/draft-state' }
