import { cardDefinitionMap, cardOutputRules, createTableCardFromDefinition } from './cardData'
import type { MutableRefObject } from 'react'
import {
  CARD_HEIGHT,
  CARD_SPAWN_DISTANCE_MAX,
  CARD_SPAWN_DISTANCE_MIN,
  CARD_WIDTH,
} from './constants'
import { clamp } from './stacking'
import type { CardOutputRule, ProductionMatch, ProductionRun, TableCard } from './types'

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

export type CanProduceCheck = (
  rule: CardOutputRule,
  parentCard: TableCard,
  childCard: TableCard,
  allCards: TableCard[],
) => boolean

export function getProductionMatches(
  cards: TableCard[],
  canProduce?: CanProduceCheck,
) {
  const matches: ProductionMatch[] = []
  const matchedPairKeys = new Set<string>()

  for (const parentCard of cards) {
    if (!parentCard.childCardId) {
      continue
    }

    // For SOS room, check each member in the chain individually
    if (parentCard.isSOSRoom) {
      let currentMemberId: string | null = parentCard.childCardId
      while (currentMemberId) {
        const childCard = cards.find((c) => c.id === currentMemberId)
        if (!childCard) break

        const rule = cardOutputRules.find((candidate) => {
          const parentMatch = candidate.parentDefinitionId
            ? candidate.parentDefinitionId === parentCard.definitionId
            : candidate.parentKind
              ? candidate.parentKind === parentCard.kind
              : false

          const childMatch = candidate.childDefinitionId
            ? candidate.childDefinitionId === childCard.definitionId
            : candidate.childKind
              ? candidate.childKind === childCard.kind
              : false

          return parentMatch && childMatch
        })

        if (rule) {
          const pairKey = `${rule.id}:${parentCard.id}:${childCard.id}`
          if (!matchedPairKeys.has(pairKey)) {
            if (!canProduce || canProduce(rule, parentCard, childCard, cards)) {
              matches.push({ pairKey, parentCard, childCard, rule })
              matchedPairKeys.add(pairKey)
            }
          }
        }

        currentMemberId = childCard.childCardId
      }
      continue
    }

    // Normal chain: match parent with last descendant
    const childCard = getLastDescendant(cards, parentCard.childCardId)

    if (!childCard) {
      continue
    }

    const rule = cardOutputRules.find((candidate) => {
      const parentMatch = candidate.parentDefinitionId
        ? candidate.parentDefinitionId === parentCard.definitionId
        : candidate.parentKind
          ? candidate.parentKind === parentCard.kind
          : false

      const childMatch = candidate.childDefinitionId
        ? candidate.childDefinitionId === childCard.definitionId
        : candidate.childKind
          ? candidate.childKind === childCard.kind
          : false

      return parentMatch && childMatch
    })

    if (!rule) {
      continue
    }

    if (canProduce && !canProduce(rule, parentCard, childCard, cards)) {
      continue
    }

    const pairKey = `${rule.id}:${parentCard.id}:${childCard.id}`
    if (!matchedPairKeys.has(pairKey)) {
      matches.push({ pairKey, parentCard, childCard, rule })
      matchedPairKeys.add(pairKey)
    }
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

  // For SOS room, find the specific child card in the chain
  if (parentCard.isSOSRoom && run.childCardId) {
    const childCard = cards.find((c) => c.id === run.childCardId)
    if (childCard) {
      return {
        centerX: childCard.x + CARD_WIDTH / 2,
        centerY: childCard.y + CARD_HEIGHT / 2,
      }
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
  outputPool?: string[],
  spawnedLocations?: Set<string>,
) {
  // Determine output definition: use pool if provided, otherwise fixed output
  let outputDefId: string | null | undefined = run.outputDefinitionId
  if (outputPool && outputPool.length > 0) {
    // Filter out already spawned locations if dedup set is provided
    const availablePool = spawnedLocations
      ? outputPool.filter((id) => !spawnedLocations.has(id))
      : outputPool

    if (availablePool.length === 0) {
      // All locations spawned, don't spawn anything
      return cards
    }

    const randomIndex = Math.floor(Math.random() * availablePool.length)
    outputDefId = availablePool[randomIndex]
  }

  if (!outputDefId) {
    return cards
  }

  const definition = cardDefinitionMap.get(outputDefId)

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
