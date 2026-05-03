import type { TableCard } from './types'

const OBSERVATION_EXCLUDED_DEFINITION_IDS = new Set([
  'energy',
  'time',
  'money',
  'chapter4-intel-time',
  'chapter4-intel-loop',
  'chapter4-intel-world',
])

export function isObservationEligibleDefinitionId(definitionId: string) {
  return !OBSERVATION_EXCLUDED_DEFINITION_IDS.has(definitionId)
}

export function getObservedDefinitionIds(seenDefinitionIds: string[]) {
  const observedDefinitionIds: string[] = []

  for (const definitionId of seenDefinitionIds) {
    if (
      !isObservationEligibleDefinitionId(definitionId) ||
      observedDefinitionIds.includes(definitionId)
    ) {
      continue
    }

    observedDefinitionIds.push(definitionId)
  }

  return observedDefinitionIds
}

export function normalizeStoredObservationCards(cards: TableCard[]) {
  const seenDefinitionIds = new Set<string>()

  return cards.filter((card) => {
    if (!isObservationEligibleDefinitionId(card.definitionId)) {
      return false
    }

    if (seenDefinitionIds.has(card.definitionId)) {
      return false
    }

    seenDefinitionIds.add(card.definitionId)
    return true
  })
}
