import { useCallback, useEffect, type Dispatch, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from 'react'
import {
  cardDefinitionMap,
  createTableCardFromDefinition,
} from '../cardData'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  RESOURCE_MOTHER_MIN_QUANTITY,
} from '../constants'
import { logGameEvent } from '../log'
import {
  bringStackToFront,
  clampCardPosition,
  detachCardFromParent,
  getDescendantIds,
  getSnappedCardPosition,
  mergeStackedResourceCards,
  updateStackRelationship,
} from '../stacking'
import { MAINLINE_CARD_DEFINITION_IDS } from '../story'
import type { DragState, TableCard } from '../types'

type UseDragControllerArgs = {
  boardRef: MutableRefObject<HTMLDivElement | null>
  trayRef: RefObject<HTMLDivElement | null>
  cards: TableCard[]
  archivedCards: TableCard[]
  dragRef: MutableRefObject<DragState | null>
  suppressClickRef: MutableRefObject<boolean>
  instanceSequenceRef: MutableRefObject<number>
  setCards: Dispatch<SetStateAction<TableCard[]>>
  setArchivedCards: Dispatch<SetStateAction<TableCard[]>>
  setDraggingStackIds: Dispatch<SetStateAction<string[] | null>>
}

function removeCardPreservingChain(currentCards: TableCard[], cardId: string) {
  const targetCard = currentCards.find((card) => card.id === cardId)

  if (!targetCard) {
    return currentCards
  }

  return currentCards
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

export function useDragController({
  boardRef,
  trayRef,
  cards,
  archivedCards,
  dragRef,
  suppressClickRef,
  instanceSequenceRef,
  setCards,
  setArchivedCards,
  setDraggingStackIds,
}: UseDragControllerArgs) {
  const moveDraggedCard = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const dragState = dragRef.current
    const board = boardRef.current

    if (!dragState || !board || dragState.pointerId !== pointerId) {
      return
    }

    if (
      Math.abs(clientX - dragState.startClientX) > 4 ||
      Math.abs(clientY - dragState.startClientY) > 4
    ) {
      suppressClickRef.current = true
    }

    const bounds = board.getBoundingClientRect()
    const nextPosition = clampCardPosition(
      bounds.width,
      bounds.height,
      clientX - bounds.left - dragState.offsetX,
      clientY - bounds.top - dragState.offsetY,
    )

    setCards((currentCards) => {
      const snapResult = getSnappedCardPosition(
        currentCards,
        dragState.cardId,
        nextPosition.x,
        nextPosition.y,
      )
      const movingCard = currentCards.find((card) => card.id === dragState.cardId)

      if (!movingCard) {
        return currentCards
      }

      const descendantIds = new Set(dragState.stackCardIds.slice(1))
      const deltaX = snapResult.x - movingCard.x
      const deltaY = snapResult.y - movingCard.y

      let nextCards = currentCards.map((card) => {
        if (card.id === dragState.cardId) {
          return {
            ...card,
            x: snapResult.x,
            y: snapResult.y,
          }
        }

        if (descendantIds.has(card.id)) {
          return {
            ...card,
            x: card.x + deltaX,
            y: card.y + deltaY,
          }
        }

        return card
      })

      nextCards = updateStackRelationship(
        nextCards,
        dragState.cardId,
        snapResult.parentCardId,
      )

      return nextCards
    })
  }, [boardRef, dragRef, setCards, suppressClickRef])

  const finishDraggedCard = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const dragState = dragRef.current

    if (!dragState || dragState.pointerId !== pointerId) {
      return
    }

    dragRef.current = null
    setDraggingStackIds(null)

    const trayBounds = trayRef.current?.getBoundingClientRect()
    const droppedInTray =
      trayBounds &&
      clientX >= trayBounds.left &&
      clientX <= trayBounds.right &&
      clientY >= trayBounds.top &&
      clientY <= trayBounds.bottom

    const movingCardSnapshot = cards.find((card) => card.id === dragState.cardId) ?? null
    const archivedCard =
      droppedInTray &&
      movingCardSnapshot &&
      MAINLINE_CARD_DEFINITION_IDS.has(movingCardSnapshot.definitionId) &&
      !movingCardSnapshot.childCardId
        ? {
            ...movingCardSnapshot,
            parentCardId: null,
            childCardId: null,
          }
        : null

    setCards((currentCards) => {
      if (archivedCard) {
        return removeCardPreservingChain(currentCards, archivedCard.id)
      }

      const mergedCards = mergeStackedResourceCards(currentCards, dragState.cardId)

      if (!mergedCards.some((card) => card.id === dragState.cardId)) {
        return mergedCards
      }

      return bringStackToFront(mergedCards, dragState.cardId)
    })

    if (archivedCard !== null) {
      setArchivedCards((currentArchived) => [...currentArchived, archivedCard])
      void logGameEvent('tray', 'Archived mainline card', {
        definitionId: archivedCard.definitionId,
      })
    }
  }, [cards, dragRef, setArchivedCards, setCards, setDraggingStackIds, trayRef])

  useEffect(() => {
    const handleWindowPointerMove = (event: PointerEvent) => {
      moveDraggedCard(event.pointerId, event.clientX, event.clientY)
    }

    const handleWindowPointerUp = (event: PointerEvent) => {
      finishDraggedCard(event.pointerId, event.clientX, event.clientY)
    }

    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
    }
  }, [finishDraggedCard, moveDraggedCard])

  const handlePointerDown = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    const board = boardRef.current
    const targetCard = cards.find((card) => card.id === cardId)
    const cardBounds = event.currentTarget.getBoundingClientRect()

    if (!board || !targetCard) {
      return
    }

    const boardBounds = board.getBoundingClientRect()
    const cardX = cardBounds.left - boardBounds.left
    const cardY = cardBounds.top - boardBounds.top

    if (targetCard.isMother) {
      if (event.button !== 0 || (targetCard.quantity ?? 0) <= RESOURCE_MOTHER_MIN_QUANTITY) {
        return
      }

      suppressClickRef.current = true
      instanceSequenceRef.current += 1
      const splitCardId = `${targetCard.definitionId}-${instanceSequenceRef.current}`
      const nextPosition = clampCardPosition(
        boardBounds.width,
        boardBounds.height,
        event.clientX - boardBounds.left - CARD_WIDTH / 2,
        event.clientY - boardBounds.top - CARD_HEIGHT / 2,
      )
      const definition = cardDefinitionMap.get(targetCard.definitionId)

      if (!definition) {
        return
      }

      const splitCard = createTableCardFromDefinition(
        definition,
        splitCardId,
        nextPosition.x,
        nextPosition.y,
      )

      dragRef.current = {
        cardId: splitCardId,
        stackCardIds: [splitCardId],
        pointerId: event.pointerId,
        button: event.button,
        offsetX: CARD_WIDTH / 2,
        offsetY: CARD_HEIGHT / 2,
        startClientX: event.clientX,
        startClientY: event.clientY,
        source: 'mother',
      }

      event.currentTarget.setPointerCapture(event.pointerId)

      setCards((currentCards) => {
        const nextCards = currentCards.map((card) => {
          if (card.id !== targetCard.id) {
            return card
          }

          return {
            ...card,
            quantity: Math.max((card.quantity ?? 0) - 1, RESOURCE_MOTHER_MIN_QUANTITY),
            refillStartedAtMs: null,
            refillDurationMs: null,
          }
        })

        return [...nextCards, splitCard]
      })
      setDraggingStackIds([splitCardId])
      void logGameEvent('resource', 'Split child card from mother card', {
        definitionId: targetCard.definitionId,
        remainingQuantity: Math.max((targetCard.quantity ?? 0) - 1, RESOURCE_MOTHER_MIN_QUANTITY),
      })
      return
    }

    const stackCardIds = [cardId, ...getDescendantIds(cards, cardId)]

    dragRef.current = {
      cardId,
      stackCardIds,
      pointerId: event.pointerId,
      button: event.button,
      offsetX: event.clientX - cardBounds.left,
      offsetY: event.clientY - cardBounds.top,
      startClientX: event.clientX,
      startClientY: event.clientY,
      source: 'board',
    }
    suppressClickRef.current = false

    event.currentTarget.setPointerCapture(event.pointerId)

    setCards((currentCards) => {
      const detachedCards = detachCardFromParent(currentCards, cardId)

      return detachedCards.map((card) =>
        card.id === cardId ? { ...card, x: cardX, y: cardY } : card,
      )
    })
    setDraggingStackIds(stackCardIds)
  }, [boardRef, cards, dragRef, instanceSequenceRef, setCards, setDraggingStackIds, suppressClickRef])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current
    const pointerMask = dragState?.button === 0 ? 1 : 2

    if ((event.buttons & pointerMask) === 0) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      finishDraggedCard(event.pointerId, event.clientX, event.clientY)
      return
    }
    moveDraggedCard(event.pointerId, event.clientX, event.clientY)
  }, [dragRef, finishDraggedCard, moveDraggedCard])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    finishDraggedCard(event.pointerId, event.clientX, event.clientY)
  }, [dragRef, finishDraggedCard])

  const handleStoredCardPointerDown = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    const board = boardRef.current
    const storedCard = archivedCards.find((card) => card.id === cardId)

    if (!board || !storedCard) {
      return
    }

    const boardBounds = board.getBoundingClientRect()
    const nextX = clampCardPosition(
      boardBounds.width,
      boardBounds.height,
      event.clientX - boardBounds.left - 59,
      event.clientY - boardBounds.top - 78,
    ).x
    const nextY = clampCardPosition(
      boardBounds.width,
      boardBounds.height,
      event.clientX - boardBounds.left - 59,
      event.clientY - boardBounds.top - 78,
    ).y

    dragRef.current = {
      cardId,
      stackCardIds: [cardId],
      pointerId: event.pointerId,
      button: event.button,
      offsetX: 59,
      offsetY: 78,
      startClientX: event.clientX,
      startClientY: event.clientY,
      source: 'tray',
    }
    suppressClickRef.current = false

    setArchivedCards((currentArchived) => currentArchived.filter((card) => card.id !== cardId))
    setCards((currentCards) => [
      ...currentCards,
      {
        ...storedCard,
        x: nextX,
        y: nextY,
        parentCardId: null,
        childCardId: null,
      },
    ])
    setDraggingStackIds([cardId])
    void logGameEvent('tray', 'Restored mainline card to board', {
      definitionId: storedCard.definitionId,
    })
  }, [archivedCards, boardRef, dragRef, setArchivedCards, setCards, setDraggingStackIds, suppressClickRef])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleStoredCardPointerDown,
  }
}
