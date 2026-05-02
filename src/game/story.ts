import type { MutableRefObject } from 'react'
import { cardDefinitionMap, createTableCardFromDefinition } from './cardData'
import type { CardDefinitionRecord, TableCard } from './types'

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
  'haruhi-0',
  'haruhi-1',
  'haruhi-2',
  'haruhi-3',
  'lost-and-found-room-0',
  'lost-and-found-room-1',
  'blue-umbrella-0',
  'blue-umbrella-1',
  'blue-umbrella-2',
  'testimony',
  'nagato-0',
  'nagato-1',
  'haruhi-obsession',
  'world-distortion',
  'missing-owner',
  'kyon-doubt',
  'conclusion',
  'reality-resistance',
  'imaginary-owner',
  'weather-cloudy',
  'weather-shower',
  'weather-rain',
  'weather-storm',
  'weather-downpour',
  'ending-return',
  'ending-imaginary',
  'ending-collapse',
])

function hasDefinition(cards: TableCard[], definitionId: string) {
  return cards.some((card) => card.definitionId === definitionId)
}

function countCardsByDefinition(cards: TableCard[], definitionIds: string[]) {
  return cards.reduce((total, card) => {
    if (!definitionIds.includes(card.definitionId)) {
      return total
    }

    return total + (card.quantity ?? 1)
  }, 0)
}

function createStorySpawnCard(
  definition: CardDefinitionRecord,
  boardWidth: number,
  boardHeight: number,
  offsetIndex: number,
  instanceSequenceRef: MutableRefObject<number>,
) {
  instanceSequenceRef.current += 1
  const x = Math.min(120 + (offsetIndex % 5) * 140, Math.max(boardWidth - 130, 0))
  const y = Math.min(360 + Math.floor(offsetIndex / 5) * 178, Math.max(boardHeight - 170, 0))

  return createTableCardFromDefinition(
    definition,
    `${definition.id}-${instanceSequenceRef.current}`,
    x,
    y,
    {
      spawnedAtMs: Date.now(),
      spawnOriginX: x,
      spawnOriginY: y - 36,
    },
  )
}

function spawnDefinitionOnce(
  cards: TableCard[],
  definitionId: string,
  boardWidth: number,
  boardHeight: number,
  offsetIndex: number,
  instanceSequenceRef: MutableRefObject<number>,
) {
  if (hasDefinition(cards, definitionId)) {
    return cards
  }

  const definition = cardDefinitionMap.get(definitionId)

  if (!definition) {
    return cards
  }

  return [
    ...cards,
    createStorySpawnCard(
      definition,
      boardWidth,
      boardHeight,
      offsetIndex,
      instanceSequenceRef,
    ),
  ]
}

export function getStoryChapter(cards: TableCard[]): StoryChapter {
  const definitionIds = new Set(cards.map((card) => card.definitionId))

  if (
    definitionIds.has('weather-downpour') ||
    definitionIds.has('weather-rain') ||
    definitionIds.has('weather-storm') ||
    definitionIds.has('ending-return') ||
    definitionIds.has('ending-imaginary') ||
    definitionIds.has('ending-collapse')
  ) {
    return 'final-rain'
  }

  if (
    definitionIds.has('world-distortion') ||
    definitionIds.has('missing-owner') ||
    definitionIds.has('kyon-doubt') ||
    definitionIds.has('conclusion') ||
    definitionIds.has('reality-resistance') ||
    definitionIds.has('imaginary-owner')
  ) {
    return 'missing-owner'
  }

  if (
    definitionIds.has('testimony') ||
    definitionIds.has('nagato-0') ||
    definitionIds.has('nagato-1') ||
    definitionIds.has('blue-umbrella-1') ||
    definitionIds.has('blue-umbrella-2') ||
    definitionIds.has('lost-and-found-room-1')
  ) {
    return 'testimony'
  }

  return 'umbrella'
}

export function getNextStoryState(cards: TableCard[], currentState: StoryState): StoryState {
  return {
    chapter: getStoryChapter(cards),
    obsessionLevel: countCardsByDefinition(cards, ['haruhi-obsession', 'haruhi-2', 'haruhi-3']),
    distortionLevel: countCardsByDefinition(cards, [
      'world-distortion',
      'missing-owner',
      'imaginary-owner',
      'weather-rain',
      'weather-storm',
      'weather-downpour',
    ]),
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
  let nextCards = cards
  const nextUnlockedIds = [...currentState.unlockedDefinitionIds]
  let hasChanges = false

  if (
    !nextUnlockedIds.includes('trigger-umbrella') &&
    ['blue-umbrella-0', 'blue-umbrella-1', 'blue-umbrella-2'].some((definitionId) =>
      hasDefinition(nextCards, definitionId),
    )
  ) {
    nextUnlockedIds.push('trigger-umbrella')
    hasChanges = true
  }

  if (!nextUnlockedIds.includes('trigger-testimony') && hasDefinition(nextCards, 'testimony')) {
    nextUnlockedIds.push('trigger-testimony')
    hasChanges = true

    nextCards = spawnDefinitionOnce(
      nextCards,
      'nagato-0',
      boardWidth,
      boardHeight,
      nextUnlockedIds.length + nextCards.length,
      instanceSequenceRef,
    )
  }

  return {
    nextCards,
    nextUnlockedIds,
    hasChanges:
      hasChanges ||
      nextUnlockedIds.length !== currentState.unlockedDefinitionIds.length ||
      nextCards !== cards,
  }
}
