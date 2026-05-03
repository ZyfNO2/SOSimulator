import {
  cardDefinitionMap,
  createTableCardFromDefinition,
  getCardOutputRulesForLevel,
} from './cardData'
import type { MutableRefObject } from 'react'
import {
  CARD_HEIGHT,
  CARD_SPAWN_DISTANCE_MAX,
  CARD_SPAWN_DISTANCE_MIN,
  CARD_WIDTH,
} from './constants'
import { clamp } from './stacking'
import type {
  ProductionMatch,
  ProductionRun,
  TableCard,
} from './types'

const ANY_CHARACTER_INPUT = '__any-character__'
const SOS_FOUNDATION_RULE_ID = 'sos-foundation-kyon-haruhi'
const SOS_FOUNDATION_LAYOUT: Record<string, { x: number; y: number }> = {
  'sos-manifesto': { x: 520, y: 72 },
  'explore-campus': { x: 520, y: 270 },
  'lit-club-room': { x: 220, y: 72 },
  'class-2-room': { x: 370, y: 72 },
  'kitachu-gate': { x: 670, y: 72 },
  'kitachu-courtyard': { x: 820, y: 72 },
  'kitachu-hallway': { x: 970, y: 72 },
  'kitachu-rooftop': { x: 1120, y: 72 },
}

export function getProductionMatches(
  cards: TableCard[],
  currentLevelId: 'main' | 'level-1' | 'level-2' | 'level-3' | 'level-4' | null,
) {
  const matches: ProductionMatch[] = []
  const matchKeys = new Set<string>()
  const activeRules = getCardOutputRulesForLevel(currentLevelId)

  for (const startCard of cards) {
    for (const rule of activeRules) {
      if (
        rule.requiresMissingDefinitionIds &&
        rule.requiresMissingDefinitionIds.some((definitionId) =>
          cards.some((card) => card.definitionId === definitionId),
        )
      ) {
        continue
      }

      const matchedInputs = getMatchedInputCards(cards, startCard.id, rule)

      if (!matchedInputs) {
        continue
      }

      const inputCards = matchedInputs.cards
      const pairKey = `${rule.id}:${inputCards.map((card) => card.id).join(':')}`

      if (matchKeys.has(pairKey)) {
        continue
      }

      matchKeys.add(pairKey)
      matches.push({
        pairKey,
        inputCards,
        rule: matchedInputs.isReversed
          ? {
              ...rule,
              consumeInputIndexes: [...rule.consumeInputIndexes].reverse(),
            }
          : rule,
      })
    }
  }

  return matches
}

function getMatchedInputCards(
  cards: TableCard[],
  startCardId: string,
  rule: ProductionMatch['rule'],
) {
  const inputDefinitionIds = rule.inputDefinitionIds
  const directMatch = getMatchedInputCardsInOrder(cards, startCardId, inputDefinitionIds)

  if (directMatch) {
    return {
      cards: directMatch,
      isReversed: false,
    }
  }

  if (inputDefinitionIds.length === 2) {
    const reversedMatch = getMatchedInputCardsInOrder(
      cards,
      startCardId,
      [...inputDefinitionIds].reverse(),
    )

    if (reversedMatch) {
      return {
        cards: reversedMatch,
        isReversed: true,
      }
    }
  }

  if (inputDefinitionIds.length > 2) {
    const [fixedDefinitionId, ...tailDefinitionIds] = inputDefinitionIds
    const tailPermutations = getPermutations(tailDefinitionIds)

    for (const tailPermutation of tailPermutations) {
      const candidateOrder = [fixedDefinitionId, ...tailPermutation]

      if (candidateOrder.join('\u0000') === inputDefinitionIds.join('\u0000')) {
        continue
      }

      const permutationMatch = getMatchedInputCardsInOrder(cards, startCardId, candidateOrder)

      if (permutationMatch) {
        return {
          cards: permutationMatch,
          isReversed: false,
        }
      }
    }
  }

  return null
}

function getPermutations(values: string[]): string[][] {
  if (values.length <= 1) {
    return [values]
  }

  const permutations: string[][] = []

  values.forEach((value, index) => {
    const remainingValues = [...values.slice(0, index), ...values.slice(index + 1)]

    getPermutations(remainingValues).forEach((permutation) => {
      permutations.push([value, ...permutation])
    })
  })

  return permutations
}

function getMatchedInputCardsInOrder(
  cards: TableCard[],
  startCardId: string,
  inputDefinitionIds: string[],
) {
  const matchedCards: TableCard[] = []
  let currentId: string | null = startCardId

  for (const definitionId of inputDefinitionIds) {
    if (!currentId) {
      return null
    }

    const card = cards.find((candidate) => candidate.id === currentId)

    if (!card) {
      return null
    }

    const isMatch =
      definitionId === ANY_CHARACTER_INPUT
        ? card.kind === 'character'
        : card.definitionId === definitionId

    if (!isMatch) {
      return null
    }

    matchedCards.push(card)
    currentId = card.childCardId
  }

  return matchedCards
}

export function getProductionAnchor(cards: TableCard[], run: ProductionRun) {
  const anchorCard = cards.find((card) => card.id === run.inputCardIds[0])

  if (!anchorCard) {
    return {
      centerX: CARD_WIDTH / 2,
      centerY: CARD_HEIGHT / 2,
    }
  }

  return {
    centerX: anchorCard.x + CARD_WIDTH / 2,
    centerY: anchorCard.y + CARD_HEIGHT / 2,
  }
}

export function spawnOutputCards(
  cards: TableCard[],
  run: ProductionRun,
  centerX: number,
  centerY: number,
  boardWidth: number,
  boardHeight: number,
  instanceSequenceRef: MutableRefObject<number>,
) {
  let nextCards = cards

  for (let index = 0; index < run.outputDefinitionIds.length; index += 1) {
    const definitionId = run.outputDefinitionIds[index]
    const definition = cardDefinitionMap.get(definitionId)

    if (!definition) {
      continue
    }

    const override =
      run.outputCardOverrides?.find((candidate) => candidate.definitionId === definitionId) ??
      run.outputCardOverrides?.[index]

    instanceSequenceRef.current += 1

    const fixedLayoutPosition =
      run.ruleId === SOS_FOUNDATION_RULE_ID ? SOS_FOUNDATION_LAYOUT[definitionId] : undefined

    const angleSeed = (instanceSequenceRef.current + index) * 1.61803398875
    const angle = (angleSeed % 1) * Math.PI * 2
    const distance =
      CARD_SPAWN_DISTANCE_MIN +
      ((instanceSequenceRef.current * 17 + index * 13) %
        (CARD_SPAWN_DISTANCE_MAX - CARD_SPAWN_DISTANCE_MIN + 1))

    const targetX = clamp(
      fixedLayoutPosition
        ? fixedLayoutPosition.x
        : centerX - CARD_WIDTH / 2 + Math.cos(angle) * distance,
      0,
      Math.max(boardWidth - CARD_WIDTH, 0),
    )
    const targetY = clamp(
      fixedLayoutPosition
        ? fixedLayoutPosition.y
        : centerY - CARD_HEIGHT / 2 + Math.sin(angle) * distance,
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
        decayAtMs:
          typeof override?.decayMs === 'number' ? Date.now() + override.decayMs : null,
        decayOutputDefinitionIds: override?.decayOutputDefinitionIds,
      },
    )

    nextCards = [...nextCards, spawnedCard]
  }

  return nextCards
}

export function consumeProductionCards(cards: TableCard[], run: ProductionRun) {
  const removedIds = new Set<string>()
  const decrementedIds = new Set<string>()
  const cardMap = new Map(cards.map((card) => [card.id, card]))

  run.inputCardIds.forEach((cardId, index) => {
    if (!run.consumeInputIndexes[index]) {
      return
    }

    const card = cardMap.get(cardId)
    const quantity = card?.quantity ?? 1

    if (quantity > 1) {
      decrementedIds.add(cardId)
      return
    }

    removedIds.add(cardId)
  })

  if (removedIds.size === 0) {
    if (decrementedIds.size === 0) {
      return cards
    }

    return cards.map((card) =>
      decrementedIds.has(card.id)
        ? {
            ...card,
            quantity: Math.max((card.quantity ?? 1) - 1, 1),
          }
        : card,
    )
  }

  const findNearestRemainingParent = (parentCardId: string | null) => {
    let currentId = parentCardId

    while (currentId && removedIds.has(currentId)) {
      currentId = cardMap.get(currentId)?.parentCardId ?? null
    }

    return currentId
  }

  const findNearestRemainingChild = (childCardId: string | null) => {
    let currentId = childCardId

    while (currentId && removedIds.has(currentId)) {
      currentId = cardMap.get(currentId)?.childCardId ?? null
    }

    return currentId
  }

  return cards
    .filter((card) => !removedIds.has(card.id))
    .map((card) => {
      const nextCard = {
        ...card,
        parentCardId: findNearestRemainingParent(card.parentCardId),
        childCardId: findNearestRemainingChild(card.childCardId),
      }

      if (decrementedIds.has(card.id)) {
        return {
          ...nextCard,
          quantity: Math.max((card.quantity ?? 1) - 1, 1),
        }
      }

      return nextCard
    })
}

export function resolveCardDecay(
  cards: TableCard[],
  nowMs: number,
  boardWidth: number,
  boardHeight: number,
  instanceSequenceRef: MutableRefObject<number>,
  blockedCardIds?: Set<string>,
) {
  const decayingCards = cards.filter(
    (card) =>
      typeof card.decayAtMs === 'number' &&
      card.decayAtMs <= nowMs &&
      !blockedCardIds?.has(card.id),
  )

  if (decayingCards.length === 0) {
    return cards
  }

  let nextCards = cards

  for (const card of decayingCards) {
    const definitionIds = card.decayOutputDefinitionIds ?? []
    const centerX = card.x + CARD_WIDTH / 2
    const centerY = card.y + CARD_HEIGHT / 2

    nextCards = consumeDecayCard(nextCards, card.id)

    const decayRun: ProductionRun = {
      id: `decay-${card.id}`,
      ruleId: `decay-${card.definitionId}`,
      pairKey: `decay-${card.id}`,
      inputCardIds: [card.id],
      outputDefinitionIds: definitionIds,
      outputCardOverrides: undefined,
      event: '',
      durationMs: 0,
      consumeInputIndexes: [true],
      startedAtMs: nowMs,
      status: 'active',
    }

    nextCards = spawnOutputCards(
      nextCards,
      decayRun,
      centerX,
      centerY,
      boardWidth,
      boardHeight,
      instanceSequenceRef,
    )
  }

  return nextCards
}

function consumeDecayCard(cards: TableCard[], cardId: string) {
  const targetCard = cards.find((card) => card.id === cardId)

  if (!targetCard) {
    return cards
  }

  return cards
    .filter((card) => card.id !== cardId)
    .map((card) => {
      if (card.id === targetCard.parentCardId) {
        return {
          ...card,
          childCardId: targetCard.childCardId,
        }
      }

      if (card.id === targetCard.childCardId) {
        return {
          ...card,
          parentCardId: targetCard.parentCardId,
        }
      }

      return card
    })
}
