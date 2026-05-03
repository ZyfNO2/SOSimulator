import { useCallback, useEffect, type Dispatch, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react'
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
import type { DragState, TableCard } from '../types'
import {
  isObservationEligibleDefinitionId,
  normalizeStoredObservationCards,
} from '../observation'

type UseDragControllerArgs = {
  boardRef: MutableRefObject<HTMLDivElement | null>
  trayRef: MutableRefObject<HTMLDivElement | null>
  cards: TableCard[]
  storedCards: TableCard[]
  dragRef: MutableRefObject<DragState | null>
  suppressClickRef: MutableRefObject<boolean>
  instanceSequenceRef: MutableRefObject<number>
  setCards: Dispatch<SetStateAction<TableCard[]>>
  setStoredCards: Dispatch<SetStateAction<TableCard[]>>
  setDraggingStackIds: Dispatch<SetStateAction<string[] | null>>
}

export function useDragController({
  boardRef,
  trayRef,
  cards,
  storedCards,
  dragRef,
  suppressClickRef,
  instanceSequenceRef,
  setCards,
  setStoredCards,
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

    const trayBounds = trayRef.current?.getBoundingClientRect() ?? null
    const isDroppedIntoTray =
      trayBounds !== null &&
      clientX >= trayBounds.left &&
      clientX <= trayBounds.right &&
      clientY >= trayBounds.top &&
      clientY <= trayBounds.bottom

    dragRef.current = null
    setDraggingStackIds(null)

    if (isDroppedIntoTray) {
      const draggedCards = dragState.stackCardIds
        .map((cardId) => cards.find((card) => card.id === cardId) ?? null)
        .filter((card): card is TableCard => card !== null)

      if (
        draggedCards.length > 0 &&
        draggedCards.every((card) => isObservationEligibleDefinitionId(card.definitionId))
      ) {
        const storedCardIds = new Set(draggedCards.map((card) => card.id))
        const storedCardsSnapshot = draggedCards.map((card) => ({
          ...card,
          parentCardId: null,
          childCardId: null,
        }))

        setCards((currentCards) =>
          currentCards.filter((card) => !storedCardIds.has(card.id)),
        )
        setStoredCards((currentCards) =>
          normalizeStoredObservationCards([...storedCardsSnapshot, ...currentCards]),
        )
        void logGameEvent('tray', 'Stored cards in observation tray', {
          cardIds: storedCardsSnapshot.map((card) => card.id),
          definitionIds: storedCardsSnapshot.map((card) => card.definitionId),
        })

        return
      }
    }

    setCards((currentCards) => {
      const mergedCards = mergeStackedResourceCards(currentCards, dragState.cardId)

      if (!mergedCards.some((card) => card.id === dragState.cardId)) {
        return mergedCards
      }

      return bringStackToFront(mergedCards, dragState.cardId)
    })
  }, [cards, dragRef, setCards, setDraggingStackIds, setStoredCards, trayRef])

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

  const handleObservationCardPointerDown = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    definitionId: string,
  ) => {
    const board = boardRef.current
    const storedCard = storedCards.find((card) => card.definitionId === definitionId)

    if (!board || cards.some((card) => card.definitionId === definitionId)) {
      return
    }

    const definition = cardDefinitionMap.get(definitionId)

    if (!storedCard && !definition) {
      return
    }

    const boardBounds = board.getBoundingClientRect()
    const nextPosition = clampCardPosition(
      boardBounds.width,
      boardBounds.height,
      event.clientX - boardBounds.left - 59,
      event.clientY - boardBounds.top - 78,
    )
    const restoredCard: TableCard = storedCard
      ? {
          ...storedCard,
          x: nextPosition.x,
          y: nextPosition.y,
          parentCardId: null,
          childCardId: null,
          spawnedAtMs: Date.now(),
          spawnOriginX: nextPosition.x,
          spawnOriginY: Math.max(nextPosition.y - 42, 0),
        }
      : createTableCardFromDefinition(
          definition!,
          `${definitionId}-${instanceSequenceRef.current + 1}`,
          nextPosition.x,
          nextPosition.y,
          {
            spawnedAtMs: Date.now(),
            spawnOriginX: nextPosition.x,
            spawnOriginY: Math.max(nextPosition.y - 42, 0),
          },
        )

    if (!storedCard) {
      instanceSequenceRef.current += 1
    }

    dragRef.current = {
      cardId: restoredCard.id,
      stackCardIds: [restoredCard.id],
      pointerId: event.pointerId,
      button: event.button,
      offsetX: 59,
      offsetY: 78,
      startClientX: event.clientX,
      startClientY: event.clientY,
      source: 'supply',
    }
    suppressClickRef.current = false

    event.currentTarget.setPointerCapture(event.pointerId)

    if (storedCard) {
      setStoredCards((currentCards) =>
        currentCards.filter((card) => card.definitionId !== definitionId),
      )
    }
    setCards((currentCards) => [...currentCards, restoredCard])
    setDraggingStackIds([restoredCard.id])
    void logGameEvent('tray', storedCard ? 'Restored stored card from observation tray' : 'Spawned observed card from tray record', {
      definitionId: restoredCard.definitionId,
      cardId: restoredCard.id,
    })
  }, [boardRef, cards, dragRef, instanceSequenceRef, setCards, setDraggingStackIds, setStoredCards, storedCards, suppressClickRef])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleObservationCardPointerDown,
  }
}
