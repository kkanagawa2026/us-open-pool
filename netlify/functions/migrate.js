import { getStore } from '@netlify/blobs'

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 })
  }

  const store = getStore('golf-pool')
  const state = await store.get('draft-state', { type: 'json' })
  if (!state) return new Response('No state', { status: 404 })

  // Remove: Todd (4), Josh (11), Kelan (12). Rename: Andrew (10) → Macky.
  const removedIndices = new Set([4, 11, 12])
  const oldToNew = { 0:0, 1:1, 2:2, 3:3, 5:4, 6:5, 7:6, 8:7, 9:8, 10:9 }

  const newState = {
    ...state,
    participants: ['Jordan','Kane','Matt','Pat Z','Fusco','Zack','Kyle','Pat M','Connor','Macky'],
    draftOrder: state.draftOrder
      .filter(i => !removedIndices.has(i))
      .map(i => oldToNew[i]),
    picks: state.picks
      .filter(p => !removedIndices.has(p.participantIndex))
      .map(p => ({ ...p, participantIndex: oldToNew[p.participantIndex] })),
  }

  await store.set('draft-state', JSON.stringify(newState))
  return Response.json({ ok: true, participants: newState.participants, draftOrder: newState.draftOrder, picks: newState.picks.length })
}

export const config = { path: '/api/migrate' }
