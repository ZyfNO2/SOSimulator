import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'
import { EventCardDetail } from './components/EventCardDetail'
import { ProductionEffect } from './components/ProductionEffect'
import { cardDefinitionMap, initialCards } from './game/cardData'
import {
  CARD_SPAWN_ANIMATION_MS,
  PRODUCTION_AUTO_REQUEUE_LEAD_MS,
  PRODUCTION_RING_SHRINK_MS,
} from './game/constants'
import {
  getProductionAnchor,
  consumeChildCard,
  getProductionMatches,
  spawnOutputCard,
} from './game/production'
import {
  bringCardToFront,
  clamp,
  clampCardPosition,
  detachCardFromParent,
  getCardZIndex,
  getDescendantIds,
  getSnappedCardPosition,
  updateStackRelationship,
} from './game/stacking'
import type { DragState, ProductionRun } from './game/types'

function App() {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const productionSequenceRef = useRef(0)
  const instanceSequenceRef = useRef(0)
  const [cards, setCards] = useState(initialCards)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [productions, setProductions] = useState<ProductionRun[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [selectedEventDefinitionId, setSelectedEventDefinitionId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (productions.length === 0) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 16)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [productions.length])

  useEffect(() => {
    const matches = getProductionMatches(cards)
    const matchMap = new Map(matches.map((match) => [match.pairKey, match]))

    queueMicrotask(() => {
      setProductions((currentRuns) => {
        const nextRuns = currentRuns.map((run) => {
          if (run.status === 'shrinking') {
            return run
          }

          if (matchMap.has(run.pairKey)) {
            return run
          }

          return {
            ...run,
            status: 'shrinking' as const,
            shrinkStartedAtMs: Date.now(),
            cancelProgress: clamp((Date.now() - run.startedAtMs) / run.durationMs, 0, 1),
          }
        })

        const activeKeys = new Set(
          nextRuns
            .filter((run) => run.status === 'active')
            .map((run) => run.pairKey),
        )

        for (const match of matches) {
          if (activeKeys.has(match.pairKey)) {
            continue
          }

          productionSequenceRef.current += 1
          nextRuns.push({
            id: `production-${productionSequenceRef.current}`,
            ruleId: match.rule.id,
            pairKey: match.pairKey,
            parentCardId: match.parentCard.id,
            childCardId: match.childCard.id,
            outputDefinitionId: match.rule.outputDefinitionId,
            event: match.rule.event,
            durationMs: match.rule.durationMs,
            consumeChild: match.rule.consumeChild,
            startedAtMs: Date.now(),
            status: 'active',
          })
        }

        return nextRuns
      })
    })
  }, [cards])

  useEffect(() => {
    if (productions.length === 0) {
      return
    }

    const finishedRuns = productions.filter(
      (run) => run.status === 'active' && nowMs - run.startedAtMs >= run.durationMs,
    )

    const requeueRuns = productions.filter(
      (run) =>
        run.status === 'active' &&
        !run.nextQueued &&
        nowMs - run.startedAtMs >= run.durationMs - PRODUCTION_AUTO_REQUEUE_LEAD_MS,
    )

    const shrinkFinishedIds = new Set(
      productions
        .filter(
          (run) =>
            run.status === 'shrinking' &&
            typeof run.shrinkStartedAtMs === 'number' &&
            nowMs - run.shrinkStartedAtMs >= PRODUCTION_RING_SHRINK_MS,
        )
        .map((run) => run.id),
    )

    if (
      finishedRuns.length === 0 &&
      requeueRuns.length === 0 &&
      shrinkFinishedIds.size === 0
    ) {
      return
    }

    const finishedIds = new Set(finishedRuns.map((run) => run.id))
    const boardBounds = boardRef.current?.getBoundingClientRect()
    const boardWidth = boardBounds?.width ?? 1200
    const boardHeight = boardBounds?.height ?? 800
    const activeMatchMap = new Map(
      getProductionMatches(cards).map((match) => [match.pairKey, match]),
    )

    queueMicrotask(() => {
      setProductions((currentRuns) => {
        const nextRuns = currentRuns
          .filter((run) => !finishedIds.has(run.id) && !shrinkFinishedIds.has(run.id))
          .map((run) => {
            const needsRequeue =
              run.status === 'active' &&
              !run.nextQueued &&
              nowMs - run.startedAtMs >= run.durationMs - PRODUCTION_AUTO_REQUEUE_LEAD_MS &&
              activeMatchMap.has(run.pairKey)

            if (needsRequeue) {
              return {
                ...run,
                nextQueued: true,
              }
            }

            return run
          })

        for (const run of requeueRuns) {
          const match = activeMatchMap.get(run.pairKey)

          if (!match) {
            continue
          }

          productionSequenceRef.current += 1
          nextRuns.push({
            id: `production-${productionSequenceRef.current}`,
            ruleId: match.rule.id,
            pairKey: match.pairKey,
            parentCardId: match.parentCard.id,
            childCardId: match.childCard.id,
            outputDefinitionId: match.rule.outputDefinitionId,
            event: match.rule.event,
            durationMs: match.rule.durationMs,
            consumeChild: match.rule.consumeChild,
            startedAtMs: nowMs,
            status: 'active',
          })
        }

        return nextRuns
      })
      setCards((currentCards) => {
        let nextCards = currentCards

        for (const run of finishedRuns) {
          nextCards = consumeChildCard(nextCards, run)
          const anchor = getProductionAnchor(nextCards, run)

          nextCards = spawnOutputCard(
            nextCards,
            run,
            anchor.centerX,
            anchor.centerY,
            boardWidth,
            boardHeight,
            instanceSequenceRef,
          )
        }

        return nextCards
      })
    })
  }, [cards, nowMs, productions])

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    const board = boardRef.current
    const cardBounds = event.currentTarget.getBoundingClientRect()

    if (!board) {
      return
    }

    const boardBounds = board.getBoundingClientRect()
    const cardX = cardBounds.left - boardBounds.left
    const cardY = cardBounds.top - boardBounds.top

    dragRef.current = {
      cardId,
      pointerId: event.pointerId,
      offsetX: event.clientX - cardBounds.left,
      offsetY: event.clientY - cardBounds.top,
      startClientX: event.clientX,
      startClientY: event.clientY,
    }
    suppressClickRef.current = false

    event.currentTarget.setPointerCapture(event.pointerId)

    setCards((currentCards) => {
      const detachedCards = detachCardFromParent(currentCards, cardId)

      return bringCardToFront(detachedCards, cardId).map((card) =>
        card.id === cardId ? { ...card, x: cardX, y: cardY } : card,
      )
    })
    setDraggingId(cardId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current
    const board = boardRef.current

    if (!dragState || !board || dragState.pointerId !== event.pointerId) {
      return
    }

    if ((event.buttons & 1) === 0) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      dragRef.current = null
      setDraggingId(null)
      return
    }

    if (
      Math.abs(event.clientX - dragState.startClientX) > 4 ||
      Math.abs(event.clientY - dragState.startClientY) > 4
    ) {
      suppressClickRef.current = true
    }

    const bounds = board.getBoundingClientRect()
    const nextPosition = clampCardPosition(
      bounds.width,
      bounds.height,
      event.clientX - bounds.left - dragState.offsetX,
      event.clientY - bounds.top - dragState.offsetY,
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

      const descendantIds = getDescendantIds(currentCards, dragState.cardId)
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
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = null
    setDraggingId(null)
  }

  const handleCardClick = (cardId: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    const card = cards.find((candidate) => candidate.id === cardId)

    if (!card || card.kind !== 'event') {
      return
    }

    setSelectedEventDefinitionId(card.definitionId)
  }

  const selectedEventDefinition = selectedEventDefinitionId
    ? cardDefinitionMap.get(selectedEventDefinitionId) ?? null
    : null

  return (
    <main className="playground">
      <section ref={boardRef} className="table" aria-label="游戏桌面空地">
        <div className="table-noise" aria-hidden="true" />

        {productions.map((run) => (
          <ProductionEffect key={run.id} run={run} nowMs={nowMs} cards={cards} />
        ))}

        {cards.map((card, index) => {
          const isDragging = draggingId === card.id
          const isSpawning =
            typeof card.spawnedAtMs === 'number' &&
            nowMs - card.spawnedAtMs < CARD_SPAWN_ANIMATION_MS

          return (
            <button
              key={card.id}
              type="button"
              className={`card card-${card.accent}${isDragging ? ' is-dragging' : ''}${
                isSpawning ? ' is-spawning' : ''
              }`}
              style={{
                '--card-x': `${card.x}px`,
                '--card-y': `${card.y}px`,
                '--spawn-origin-x': `${card.spawnOriginX ?? card.x}px`,
                '--spawn-origin-y': `${card.spawnOriginY ?? card.y}px`,
                zIndex: getCardZIndex(cards, card.id, draggingId, index),
              } as CSSProperties}
              onPointerDown={(event) => handlePointerDown(event, card.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={() => handleCardClick(card.id)}
            >
              <strong className="card-name">{card.name}</strong>
              <span className="card-kind-band">
                <span className="card-kind">{card.kindLabel}</span>
              </span>
              <span className="card-note">{card.note}</span>
            </button>
          )
        })}
      </section>

      {selectedEventDefinition ? (
        <EventCardDetail
          definition={selectedEventDefinition}
          onClose={() => setSelectedEventDefinitionId(null)}
        />
      ) : null}
    </main>
  )
}

export default App
