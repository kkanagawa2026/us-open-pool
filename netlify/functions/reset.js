import { getStore } from '@netlify/blobs'

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const store = getStore('golf-pool')
  await store.delete('draft-state')

  return Response.json({ status: 'reset' })
}

export const config = { path: '/api/reset' }
