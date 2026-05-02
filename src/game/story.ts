import type { MutableRefObject } from 'react'
import { cardDefinitionMap, createTableCardFromDefinition } from './cardData'
import type { TableCard } from './types'

export type StoryChapter = 'umbrella' | 'testimony' | 'missing-owner' | 'final-rain'

export type StoryState = {
  chapter: StoryChapter
  obsessionLevel: number
  distortionLevel: number
  unlockedDefinitionIds: string[]
}

export const INITIAL_STORY_STATE: StoryState = {
  chapter: 'umbrella',
  obsessionLevel: 0,
  distortionLevel: 0,
  unlockedDefinitionIds: [],
}

export const MAINLINE_CARD_DEFINITION_IDS = new Set([
  'blue-umbrella',
  'poor-clue',
  'vague-testimony',
  'contradictory-record',
  'old-radio-photo',
  'rainy-back',
  'missing-owner',
  'haruhi',
  'haruhi-obsession',
  'world-distortion',
  'kyon',
  'kyon-doubt',
  'reality-resistance',
  'imaginary-owner',
  'final-rain',
  'ending-return',
  'ending-imaginary',
  'ending-collapse',
  'event-card',
  'event-testimony',
  'event-missing-owner',
  'event-final-rain',
])

const STORY_UNLOCKS: Array<{
  id: string
  triggerDefinitionIds: string[]
  unlockDefinitionIds: string[]
}> = [
  {
    id: 'unlock-testimony-stage',
    triggerDefinitionIds: ['vague-testimony'],
    unlockDefinitionIds: ['haruhi', 'event-testimony'],
  },
  {
    id: 'unlock-missing-owner-stage',
    triggerDefinitionIds: ['world-distortion'],
    unlockDefinitionIds: ['kyon', 'event-missing-owner'],
  },
  {
    id: 'unlock-final-rain-stage',
    triggerDefinitionIds: ['rainy-back', 'reality-resistance', 'imaginary-owner'],
    unlockDefinitionIds: ['event-final-rain'],
  },
]

export function getStoryChapter(cards: TableCard[]): StoryChapter {
  const definitionIds = new Set(cards.map((card) => card.definitionId))

  if (definitionIds.has('final-rain') || definitionIds.has('event-final-rain')) {
    return 'final-rain'
  }

  if (definitionIds.has('missing-owner') || definitionIds.has('event-missing-owner')) {
    return 'missing-owner'
  }

  if (definitionIds.has('vague-testimony') || definitionIds.has('event-testimony')) {
    return 'testimony'
  }

  return 'umbrella'
}

export function countCardsByDefinition(cards: TableCard[], definitionIds: string[]) {
  return cards.reduce((total, card) => {
    if (!definitionIds.includes(card.definitionId)) {
      return total
    }

    return total + (card.quantity ?? 1)
  }, 0)
}

export function getNextStoryState(cards: TableCard[], currentState: StoryState): StoryState {
  const chapter = getStoryChapter(cards)
  const obsessionLevel = countCardsByDefinition(cards, ['haruhi-obsession'])
  const distortionLevel = countCardsByDefinition(cards, ['world-distortion'])

  return {
    chapter,
    obsessionLevel,
    distortionLevel,
    unlockedDefinitionIds: currentState.unlockedDefinitionIds,
  }
}

export function isSameStoryState(left: StoryState, right: StoryState) {
  return (
    left.chapter === right.chapter &&
    left.obsessionLevel === right.obsessionLevel &&
    left.distortionLevel === right.distortionLevel &&
    left.unlockedDefinitionIds.length === right.unlockedDefinitionIds.length &&
    left.unlockedDefinitionIds.every((id, index) => id === right.unlockedDefinitionIds[index])
  )
}

export function unlockStoryCards(
  cards: TableCard[],
  currentState: StoryState,
  boardWidth: number,
  boardHeight: number,
  instanceSequenceRef: MutableRefObject<number>,
) {
  const presentDefinitionIds = new Set(cards.map((card) => card.definitionId))
  const nextUnlockedIds = [...currentState.unlockedDefinitionIds]
  let nextCards = cards
  let hasChanges = false

  for (const unlock of STORY_UNLOCKS) {
    if (nextUnlockedIds.includes(unlock.id)) {
      continue
    }

    const shouldUnlock = unlock.triggerDefinitionIds.some((definitionId) =>
      presentDefinitionIds.has(definitionId),
    )

    if (!shouldUnlock) {
      continue
    }

    nextUnlockedIds.push(unlock.id)
    hasChanges = true

    for (const definitionId of unlock.unlockDefinitionIds) {
      if (presentDefinitionIds.has(definitionId)) {
        continue
      }

      const definition = cardDefinitionMap.get(definitionId)

      if (!definition) {
        continue
      }

      instanceSequenceRef.current += 1
      const offsetIndex = nextUnlockedIds.length + nextCards.length
      const x = Math.min(120 + (offsetIndex % 5) * 140, Math.max(boardWidth - 130, 0))
      const y =
        Math.min(360 + Math.floor(offsetIndex / 5) * 178, Math.max(boardHeight - 170, 0))

      nextCards = [
        ...nextCards,
        createTableCardFromDefinition(
          definition,
          `${definition.id}-${instanceSequenceRef.current}`,
          x,
          y,
          {
            spawnedAtMs: Date.now(),
            spawnOriginX: x,
            spawnOriginY: y - 36,
          },
        ),
      ]
      presentDefinitionIds.add(definitionId)
    }
  }

  return {
    nextCards,
    nextUnlockedIds,
    hasChanges,
  }
}
