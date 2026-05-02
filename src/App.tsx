import { useEffect, useRef, useState } from 'react'
import './App.css'
import { CardBoard } from './components/CardBoard'
import { EventCardDetail } from './components/EventCardDetail'
import {
  cardDefinitionMap,
  initialCards,
} from './game/cardData'
import { PRODUCTION_AUTO_REQUEUE_LEAD_MS, PRODUCTION_RING_SHRINK_MS } from './game/constants'
import {
  getProductionAnchor,
  consumeProductionCards,
  getProductionMatches,
  resolveCardDecay,
  spawnOutputCards,
} from './game/production'
import {
  bringCardToFront,
  clamp,
  clampCardPosition,
  detachCardFromParent,
  getDescendantIds,
  getSnappedCardPosition,
  mergeStackedResourceCards,
  updateStackRelationship,
} from './game/stacking'
import type { DragState, ProductionRun } from './game/types'
import {
  getNextStoryState,
  INITIAL_STORY_STATE,
  isSameStoryState,
  type StoryState,
  unlockStoryCards,
} from './game/story'

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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [storyState, setStoryState] = useState<StoryState>(INITIAL_STORY_STATE)
  const hasDecayingCards = cards.some((card) => typeof card.decayAtMs === 'number')

  useEffect(() => {
    if (productions.length === 0 && !hasDecayingCards) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 16)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hasDecayingCards, productions.length])

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
            inputCardIds: match.inputCards.map((card) => card.id),
            outputDefinitionIds: match.rule.outputDefinitionIds,
            outputCardOverrides: match.rule.outputCardOverrides,
            event: match.rule.event,
            durationMs: match.rule.durationMs,
            consumeInputIndexes: match.rule.consumeInputIndexes,
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
            inputCardIds: match.inputCards.map((card) => card.id),
            outputDefinitionIds: match.rule.outputDefinitionIds,
            outputCardOverrides: match.rule.outputCardOverrides,
            event: match.rule.event,
            durationMs: match.rule.durationMs,
            consumeInputIndexes: match.rule.consumeInputIndexes,
            startedAtMs: nowMs,
            status: 'active',
          })
        }

        return nextRuns
      })
      setCards((currentCards) => {
        let nextCards = currentCards

        for (const run of finishedRuns) {
          const anchor = getProductionAnchor(nextCards, run)
          nextCards = consumeProductionCards(nextCards, run)

          nextCards = spawnOutputCards(
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

  useEffect(() => {
    if (!hasDecayingCards) {
      return
    }

    const blockedCardIds = new Set(
      productions
        .filter((run) => run.status === 'active')
        .flatMap((run) => run.inputCardIds),
    )
    const boardBounds = boardRef.current?.getBoundingClientRect()
    const boardWidth = boardBounds?.width ?? 1200
    const boardHeight = boardBounds?.height ?? 800

    queueMicrotask(() => {
      setCards((currentCards) =>
        resolveCardDecay(
          currentCards,
          nowMs,
          boardWidth,
          boardHeight,
          instanceSequenceRef,
          blockedCardIds,
        ),
      )
    })
  }, [hasDecayingCards, nowMs, productions])

  useEffect(() => {
    const boardBounds = boardRef.current?.getBoundingClientRect()
    const boardWidth = boardBounds?.width ?? 1200
    const boardHeight = boardBounds?.height ?? 800
    const unlockResult = unlockStoryCards(
      cards,
      storyState,
      boardWidth,
      boardHeight,
      instanceSequenceRef,
    )
    const nextStoryState = {
      ...getNextStoryState(unlockResult.nextCards, storyState),
      unlockedDefinitionIds: unlockResult.nextUnlockedIds,
    }

    if (unlockResult.hasChanges) {
      setCards(unlockResult.nextCards)
    }

    if (!isSameStoryState(nextStoryState, storyState)) {
      setStoryState(nextStoryState)
    }
  }, [cards, storyState])

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
    setCards((currentCards) => mergeStackedResourceCards(currentCards, dragState.cardId))
  }

  const handleCardClick = (cardId: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    setSelectedCardId(cardId)
  }

  const selectedCard = selectedCardId
    ? cards.find((candidate) => candidate.id === selectedCardId) ?? null
    : null
  const selectedCardDefinition = selectedCard
    ? cardDefinitionMap.get(selectedCard.definitionId) ?? null
    : null

  return (
    <main className="playground">
      <CardBoard
        boardRef={boardRef}
        cards={cards}
        productions={productions}
        draggingId={draggingId}
        nowMs={nowMs}
        storyState={storyState}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onCardClick={handleCardClick}
      />

      {selectedCard && selectedCardDefinition ? (
        <EventCardDetail
          card={selectedCard}
          definition={selectedCardDefinition}
          nowMs={nowMs}
          onClose={() => setSelectedCardId(null)}
        />
      ) : null}
    </main>
  )
}

export default App
