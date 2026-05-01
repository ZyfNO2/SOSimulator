import { cardDefinitionMap, cardOutputRules, createTableCardFromDefinition } from './cardData'
import type { MutableRefObject } from 'react'
import {
  CARD_HEIGHT,
  CARD_SPAWN_DISTANCE_MAX,
  CARD_SPAWN_DISTANCE_MIN,
  CARD_WIDTH,
} from './constants'
import { clamp } from './stacking'
import type { ProductionMatch, ProductionRun, TableCard } from './types'

export function getProductionMatches(cards: TableCard[]) {
  const matches: ProductionMatch[] = []

  for (const parentCard of cards) {
    if (!parentCard.childCardId) {
      continue
    }

    const childCard = cards.find((card) => card.id === parentCard.childCardId)

    if (!childCard) {
      continue
    }

    const rule = cardOutputRules.find(
      (candidate) =>
        candidate.parentDefinitionId === parentCard.definitionId &&
        candidate.childDefinitionId === childCard.definitionId,
    )

    if (!rule) {
      continue
    }

    matches.push({
      pairKey: `${rule.id}:${parentCard.id}:${childCard.id}`,
      parentCard,
      childCard,
      rule,
    })
  }

  return matches
}

export function getProductionAnchor(cards: TableCard[], run: ProductionRun) {
  const parentCard = cards.find((card) => card.id === run.parentCardId)

  if (!parentCard) {
    return {
      centerX: CARD_WIDTH / 2,
      centerY: CARD_HEIGHT / 2,
    }
  }

  return {
    centerX: parentCard.x + CARD_WIDTH / 2,
    centerY: parentCard.y + CARD_HEIGHT / 2,
  }
}

export function spawnOutputCard(
  cards: TableCard[],
  run: ProductionRun,
  centerX: number,
  centerY: number,
  boardWidth: number,
  boardHeight: number,
  instanceSequenceRef: MutableRefObject<number>,
) {
  if (!run.outputDefinitionId) {
    return cards
  }

  const definition = cardDefinitionMap.get(run.outputDefinitionId)

  if (!definition) {
    return cards
  }

  instanceSequenceRef.current += 1

  const angleSeed = instanceSequenceRef.current * 1.61803398875
  const angle = (angleSeed % 1) * Math.PI * 2
  const distance =
    CARD_SPAWN_DISTANCE_MIN +
    ((instanceSequenceRef.current * 17) %
      (CARD_SPAWN_DISTANCE_MAX - CARD_SPAWN_DISTANCE_MIN + 1))

  const targetX = clamp(
    centerX - CARD_WIDTH / 2 + Math.cos(angle) * distance,
    0,
    Math.max(boardWidth - CARD_WIDTH, 0),
  )
  const targetY = clamp(
    centerY - CARD_HEIGHT / 2 + Math.sin(angle) * distance,
    0,
    Math.max(boardHeight - CARD_HEIGHT, 0),
  )

  const spawnedCard = createTableCardFromDefinition(
    definition,
    `${definition.id}-${instanceSequenceRef.current}`,
    targetX,
    targetY,
    {
      spawnedAtMs: Date.now(),
      spawnOriginX: centerX - CARD_WIDTH / 2,
      spawnOriginY: centerY - CARD_HEIGHT / 2,
    },
  )

  return [...cards, spawnedCard]
}

export function consumeChildCard(cards: TableCard[], run: ProductionRun) {
  if (!run.consumeChild) {
    return cards
  }

  const childIdsToRemove = getCardWithDescendants(cards, run.childCardId)

  return cards
    .filter((card) => !childIdsToRemove.has(card.id))
    .map((card) => {
      if (card.id === run.parentCardId) {
        return {
          ...card,
          childCardId: null,
        }
      }

      return card
    })
}

function getCardWithDescendants(cards: TableCard[], rootCardId: string) {
  const ids = new Set<string>()
  let currentId: string | null = rootCardId

  while (currentId) {
    ids.add(currentId)
    currentId = cards.find((card) => card.id === currentId)?.childCardId ?? null
  }

  return ids
}
