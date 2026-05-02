import {
  CARD_HEIGHT,
  CARD_SNAP_EDGE_THRESHOLD,
  CARD_SNAP_THRESHOLD,
  CARD_TITLE_LINE_OFFSET,
  CARD_UNSNAP_EXTRA_THRESHOLD,
  CARD_WIDTH,
} from './constants'
import type { TableCard } from './types'

export function bringCardToFront(cards: TableCard[], cardId: string) {
  const nextCards = [...cards]
  const targetIndex = nextCards.findIndex((card) => card.id === cardId)

  if (targetIndex === -1) {
    return nextCards
  }

  const [targetCard] = nextCards.splice(targetIndex, 1)
  nextCards.push(targetCard)
  return nextCards
}

export function bringStackToFront(cards: TableCard[], rootCardId: string) {
  const stackIds = new Set<string>([rootCardId, ...getDescendantIds(cards, rootCardId)])
  const stackCards = cards.filter((card) => stackIds.has(card.id))
  const remainingCards = cards.filter((card) => !stackIds.has(card.id))

  return [...remainingCards, ...stackCards]
}

export function detachCardFromParent(cards: TableCard[], cardId: string) {
  const movingCard = cards.find((card) => card.id === cardId)

  if (!movingCard?.parentCardId) {
    return cards
  }

  return cards.map((card) => {
    if (card.id === cardId) {
      return {
        ...card,
        parentCardId: null,
      }
    }

    if (card.id === movingCard.parentCardId) {
      return {
        ...card,
        childCardId: null,
      }
    }

    return card
  })
}

export function getSnappedCardPosition(
  cards: TableCard[],
  movingCardId: string,
  rawX: number,
  rawY: number,
) {
  const movingCard = cards.find((card) => card.id === movingCardId)
  const blockedTargetIds = getDescendantIds(cards, movingCardId)
  let snappedX = rawX
  let snappedY = rawY
  let snappedParentCardId: string | null = null
  let bestScore = Number.POSITIVE_INFINITY

  if (!movingCard) {
    return { x: rawX, y: rawY, parentCardId: null }
  }

  if (movingCard.isMother) {
    return { x: movingCard.x, y: movingCard.y, parentCardId: null }
  }

  for (const targetCard of cards) {
    if (
      targetCard.id === movingCardId ||
      blockedTargetIds.has(targetCard.id) ||
      targetCard.isMother
    ) {
      continue
    }

    if (targetCard.childCardId && targetCard.childCardId !== movingCardId) {
      continue
    }

    const targetLineY = targetCard.y + CARD_TITLE_LINE_OFFSET
    const lineDistance = Math.abs(rawY - targetLineY)
    const leftEdgeDistance = Math.abs(rawX - targetCard.x)
    const rightEdgeDistance = Math.abs(
      rawX + CARD_WIDTH - (targetCard.x + CARD_WIDTH),
    )

    const isCurrentParent = movingCard.parentCardId === targetCard.id
    const lineThreshold = isCurrentParent
      ? CARD_SNAP_THRESHOLD + CARD_UNSNAP_EXTRA_THRESHOLD
      : CARD_SNAP_THRESHOLD
    const edgeThreshold = isCurrentParent
      ? CARD_SNAP_EDGE_THRESHOLD + CARD_UNSNAP_EXTRA_THRESHOLD
      : CARD_SNAP_EDGE_THRESHOLD

    const meetsLineSnap = lineDistance <= lineThreshold
    const meetsLeftEdgeSnap = leftEdgeDistance <= edgeThreshold
    const meetsRightEdgeSnap = rightEdgeDistance <= edgeThreshold

    if (meetsLineSnap && meetsLeftEdgeSnap && meetsRightEdgeSnap) {
      const snapScore = lineDistance + leftEdgeDistance + rightEdgeDistance

      if (snapScore >= bestScore) {
        continue
      }

      snappedX = targetCard.x
      snappedY = targetLineY
      snappedParentCardId = targetCard.id
      bestScore = snapScore
    }
  }

  return { x: snappedX, y: snappedY, parentCardId: snappedParentCardId }
}

export function getDescendantIds(cards: TableCard[], rootCardId: string) {
  const descendants = new Set<string>()
  let currentChildId =
    cards.find((card) => card.id === rootCardId)?.childCardId ?? null

  while (currentChildId) {
    descendants.add(currentChildId)
    currentChildId =
      cards.find((card) => card.id === currentChildId)?.childCardId ?? null
  }

  return descendants
}

export function updateStackRelationship(
  cards: TableCard[],
  movingCardId: string,
  nextParentCardId: string | null,
) {
  const movingCard = cards.find((card) => card.id === movingCardId)

  if (!movingCard) {
    return cards
  }

  const previousParentCardId = movingCard.parentCardId

  if (previousParentCardId === nextParentCardId) {
    return cards
  }

  const nextParentCard = nextParentCardId
    ? cards.find((card) => card.id === nextParentCardId)
    : null

  return cards.map((card) => {
    if (card.id === previousParentCardId) {
      return {
        ...card,
        childCardId: null,
      }
    }

    if (card.id === movingCardId) {
      return {
        ...card,
        parentCardId: nextParentCardId,
      }
    }

    if (card.id === nextParentCardId) {
      return {
        ...card,
        childCardId: movingCardId,
      }
    }

    if (card.id === nextParentCard?.childCardId) {
      return {
        ...card,
        parentCardId: null,
      }
    }

    return card
  })
}

export function mergeStackedResourceCards(cards: TableCard[], movingCardId: string) {
  const movingCard = cards.find((card) => card.id === movingCardId)

  if (
    !movingCard ||
    !movingCard.parentCardId ||
    movingCard.kind !== 'resource' ||
    movingCard.childCardId ||
    movingCard.isMother
  ) {
    return cards
  }

  const parentCard = cards.find((card) => card.id === movingCard.parentCardId)

  if (
    !parentCard ||
    parentCard.kind !== 'resource' ||
    parentCard.definitionId !== movingCard.definitionId ||
    parentCard.isMother
  ) {
    return cards
  }

  const movingQuantity = movingCard.quantity ?? 1
  const parentQuantity = parentCard.quantity ?? 1

  return cards
    .filter((card) => card.id !== movingCard.id)
    .map((card) => {
      if (card.id === parentCard.id) {
        return {
          ...card,
          quantity: parentQuantity + movingQuantity,
          childCardId: null,
        }
      }

      return card
    })
}

export function getCardZIndex(
  cards: TableCard[],
  cardId: string,
  draggingStackIds: string[] | null,
  fallbackIndex: number,
) {
  const depth = getStackDepth(cards, cardId)
  const activeStackIds = draggingStackIds ? new Set(draggingStackIds) : null

  if (activeStackIds?.has(cardId)) {
    const dragDepth = draggingStackIds?.indexOf(cardId) ?? depth
    return 1000 + Math.max(dragDepth, 0)
  }

  const rootCardId = getRootCardId(cards, cardId)
  const rootIndex = cards.findIndex((card) => card.id === rootCardId)
  const groupIndex = rootIndex === -1 ? fallbackIndex : rootIndex

  return groupIndex * 10 + depth + 1
}

export function getRootCardId(cards: TableCard[], cardId: string) {
  let currentCard = cards.find((card) => card.id === cardId)

  while (currentCard?.parentCardId) {
    currentCard = cards.find((card) => card.id === currentCard?.parentCardId)
  }

  return currentCard?.id ?? cardId
}

export function getStackDepth(cards: TableCard[], cardId: string) {
  let depth = 0
  let currentCard = cards.find((card) => card.id === cardId)

  while (currentCard?.parentCardId) {
    depth += 1
    currentCard = cards.find((card) => card.id === currentCard?.parentCardId)
  }

  return depth
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function clampCardPosition(
  boardWidth: number,
  boardHeight: number,
  x: number,
  y: number,
) {
  return {
    x: clamp(x, 0, Math.max(boardWidth - CARD_WIDTH, 0)),
    y: clamp(y, 0, Math.max(boardHeight - CARD_HEIGHT, 0)),
  }
}
