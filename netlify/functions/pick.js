import { getStore } from '@netlify/blobs'

function getSlotParticipantIndex(slotIndex, draftOrder) {
  const round = Math.floor(slotIndex / 12)
  const posInRound = slotIndex % 12
  const orderIndex = round % 2 === 0 ? posInRound : 11 - posInRound
  return draftOrder[orderIndex]
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { participantName, playerId, playerName } = await req.json()

  const store = getStore('golf-pool')
  const state = await store.get('draft-state', { type: 'json' })

  if (!state || state.status !== 'drafting') {
    return new Response('Draft is not active', { status: 400 })
  }

  if (state.picks.length >= 48) {
    return new Response('Draft is complete', { status: 400 })
  }

  const currentSlot = state.picks.length
  const currentParticipantIndex = getSlotParticipantIndex(currentSlot, state.draftOrder)
  const currentParticipantName = state.participants[currentParticipantIndex]

  if (participantName !== currentParticipantName) {
    return Response.json(
      { error: `It's ${currentParticipantName}'s turn, not yours` },
      { status: 403 }
    )
  }

  if (state.picks.some((p) => p.playerId === playerId)) {
    return Response.json({ error: 'Player already drafted' }, { status: 400 })
  }

  state.picks.push({
    slot: currentSlot,
    pickNumber: currentSlot + 1,
    participantIndex: currentParticipantIndex,
    participantName,
    playerId,
    playerName,
    timestamp: new Date().toISOString(),
  })

  if (state.picks.length === 48) {
    state.status = 'complete'
  }

  await store.set('draft-state', JSON.stringify(state))

  return Response.json(state)
}

export const config = { path: '/api/pick' }
