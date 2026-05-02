import { cardDefinitionMap, cardOutputRules, createTableCardFromDefinition } from './cardData'
import type { MutableRefObject } from 'react'
import {
  CARD_HEIGHT,
  CARD_SPAWN_DISTANCE_MAX,
  CARD_SPAWN_DISTANCE_MIN,
  CARD_WIDTH,
} from './constants'
import { clamp, updateStackRelationship } from './stacking'
import type { ProductionMatch, ProductionRun, TableCard } from './types'

function getLastDescendant(cards: TableCard[], rootCardId: string): TableCard | null {
  let currentId: string | null = rootCardId
  let lastCard: TableCard | null = null

  while (currentId) {
    const card = cards.find((c) => c.id === currentId)
    if (!card) break
    lastCard = card
    currentId = card.childCardId
  }

  return lastCard
}

export function getProductionMatches(cards: TableCard[]) {
  const matches: ProductionMatch[] = []

  for (const parentCard of cards) {
    if (!parentCard.childCardId) {
      continue
    }

    const childCard = getLastDescendant(cards, parentCard.childCardId)

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

export function tryQueueNextSibling(
  cards: TableCard[],
  finishedRun: ProductionRun,
): { nextCards: TableCard[]; queuedMatch: ProductionMatch | null } {
  const rule = cardOutputRules.find((r) => r.id === finishedRun.ruleId)

  if (!rule || rule.consumeParent) {
    return { nextCards: cards, queuedMatch: null }
  }

  const parentCard = cards.find((c) => c.id === finishedRun.parentCardId)

  if (!parentCard || !parentCard.childCardId) {
    return { nextCards: cards, queuedMatch: null }
  }

  const lastDescendant = getLastDescendant(cards, parentCard.childCardId)

  if (!lastDescendant || lastDescendant.id === finishedRun.childCardId) {
    return { nextCards: cards, queuedMatch: null }
  }

  return {
    nextCards: cards,
    queuedMatch: {
      pairKey: `${rule.id}:${parentCard.id}:${lastDescendant.id}`,
      parentCard,
      childCard: lastDescendant,
      rule,
    },
  }
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

function findOrphanParentForDefinition(cards: TableCard[], definitionId: string) {
  return cards.find(
    (card) => card.definitionId === definitionId && !card.childCardId,
  )
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

  const orphanParent = findOrphanParentForDefinition(cards, run.outputDefinitionId)

  if (orphanParent) {
    const spawnedCard = createTableCardFromDefinition(
      definition,
      `${definition.id}-${instanceSequenceRef.current}`,
      orphanParent.x,
      orphanParent.y + 31,
      {
        spawnedAtMs: Date.now(),
        spawnOriginX: centerX - CARD_WIDTH / 2,
        spawnOriginY: centerY - CARD_HEIGHT / 2,
      },
    )

    let nextCards = [...cards, spawnedCard]
    nextCards = updateStackRelationship(nextCards, spawnedCard.id, orphanParent.id)
    return nextCards
  }

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
  const idsToRemove = new Set<string>()

  if (run.consumeChild) {
    idsToRemove.add(run.childCardId)
  }

  if (run.consumeParent) {
    for (const id of getCardWithDescendants(cards, run.parentCardId)) {
      idsToRemove.add(id)
    }
  }

  if (idsToRemove.size === 0) {
    return cards
  }

  return cards
    .filter((card) => !idsToRemove.has(card.id))
    .map((card) => {
      if (card.childCardId && idsToRemove.has(card.childCardId)) {
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
