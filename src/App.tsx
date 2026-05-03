import { useEffect, useRef, useState } from 'react'
import './App.css'
import { CardBoard } from './components/CardBoard'
import { EventCardDetail } from './components/EventCardDetail'
import { MainlineTray } from './components/MainlineTray'
import {
  cardDefinitionMap,
  createTableCardFromDefinition,
} from './game/cardData'
import {
  CARD_HEIGHT,
  CARD_SPAWN_ANIMATION_MS,
  CARD_WIDTH,
  PRODUCTION_RING_SHRINK_MS,
  RESOURCE_MOTHER_GAP,
  RESOURCE_MOTHER_MAX_QUANTITY,
  RESOURCE_MOTHER_MIN_QUANTITY,
  RESOURCE_MOTHER_PADDING_BOTTOM,
  RESOURCE_MOTHER_PADDING_LEFT,
  RESOURCE_MOTHER_REFILL_MS,
  WEATHER_STAGE_ADVANCE_MS,
} from './game/constants'
import { allLevels, getLevelConfig, type LevelId } from './game/levels'
import {
  getProductionAnchor,
  consumeProductionCards,
  getProductionMatches,
  resolveCardDecay,
  spawnOutputCards,
} from './game/production'
import { logGameEvent } from './game/log'
import {
  bringStackToFront,
  clamp,
  clampCardPosition,
  detachCardFromParent,
  getDescendantIds,
  getSnappedCardPosition,
  mergeStackedResourceCards,
  updateStackRelationship,
} from './game/stacking'
import type { DragState, ProductionRun, TableCard } from './game/types'
import {
  MAINLINE_CARD_DEFINITION_IDS,
  getNextStoryState,
  INITIAL_STORY_STATE,
  isSameStoryState,
  type StoryState,
  unlockStoryCards,
} from './game/story'

const MOTHER_CARD_DEFINITION_IDS = ['energy', 'time'] as const
const WEATHER_DEFINITION_IDS = [
  'weather-sunny',
  'weather-cloudy',
  'weather-shower',
  'weather-rain',
  'weather-storm',
  'weather-downpour',
] as const
const WEATHER_DISCOVERY_TRIGGER_ID = 'trigger-umbrella'
const FORCED_WEATHER_ENDING_DEFINITION_ID = 'ending-imaginary'

function isWeatherDefinitionId(definitionId: string) {
  return WEATHER_DEFINITION_IDS.includes(
    definitionId as (typeof WEATHER_DEFINITION_IDS)[number],
  )
}

function getNextWeatherDefinitionId(definitionId: string) {
  const currentIndex = WEATHER_DEFINITION_IDS.indexOf(
    definitionId as (typeof WEATHER_DEFINITION_IDS)[number],
  )

  if (currentIndex === -1 || currentIndex >= WEATHER_DEFINITION_IDS.length - 1) {
    return null
  }

  return WEATHER_DEFINITION_IDS[currentIndex + 1]
}

function syncCardToDefinition(card: TableCard, definitionId: string) {
  const definition = cardDefinitionMap.get(definitionId)

  if (!definition) {
    return card
  }

  return {
    ...card,
    definitionId: definition.id,
    name: definition.name,
    kind: definition.kind,
    kindLabel: definition.kindLabel,
    note: definition.note,
    accent: definition.accent,
  }
}

function getMotherCardPosition(
  definitionId: (typeof MOTHER_CARD_DEFINITION_IDS)[number],
  boardWidth: number,
  boardHeight: number,
) {
  const index = MOTHER_CARD_DEFINITION_IDS.indexOf(definitionId)
  const x = RESOURCE_MOTHER_PADDING_LEFT + index * (CARD_WIDTH + RESOURCE_MOTHER_GAP)
  const y = Math.max(boardHeight - CARD_HEIGHT - RESOURCE_MOTHER_PADDING_BOTTOM, 0)

  return {
    x: clamp(x, 0, Math.max(boardWidth - CARD_WIDTH, 0)),
    y,
  }
}

function getTotalCopiesOnTable(cards: TableCard[], definitionId: string) {
  return cards.reduce((total, card) => {
    if (card.definitionId !== definitionId) {
      return total
    }

    return total + (card.quantity ?? 1)
  }, 0)
}

function App() {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const trayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const productionSequenceRef = useRef(0)
  const instanceSequenceRef = useRef(0)
  const settledProductionIdsRef = useRef<Set<string>>(new Set())
  const settledWeatherTimerKeysRef = useRef<Set<string>>(new Set())
  const startOverlayTimeoutRef = useRef<number | null>(null)
  const [currentLevelId, setCurrentLevelId] = useState<LevelId | null>(null)
  const levelConfig = currentLevelId ? getLevelConfig(currentLevelId) : null
  const initialLevelCards = levelConfig?.initialCards ?? []
  const [cards, setCards] = useState<TableCard[]>(initialLevelCards)
  const [archivedCards, setArchivedCards] = useState<TableCard[]>([])
  const [isTrayOpen, setIsTrayOpen] = useState(false)
  const [draggingStackIds, setDraggingStackIds] = useState<string[] | null>(null)
  const [productions, setProductions] = useState<ProductionRun[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [storyState, setStoryState] = useState<StoryState>(INITIAL_STORY_STATE)
  const [hasStarted, setHasStarted] = useState(false)
  const [isStartOverlayVisible, setIsStartOverlayVisible] = useState(true)
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [seenDefinitionIds, setSeenDefinitionIds] = useState<string[]>(() => [
    ...new Set(initialLevelCards.map((card) => card.definitionId)),
  ])
  const hasDecayingCards = cards.some((card) => typeof card.decayAtMs === 'number')
  const hasSpawningCards = cards.some(
    (card) =>
      typeof card.spawnedAtMs === 'number' &&
      nowMs - card.spawnedAtMs < CARD_SPAWN_ANIMATION_MS,
  )
  const hasCountdownCards = cards.some(
    (card) =>
      typeof card.refillStartedAtMs === 'number' &&
      typeof card.refillDurationMs === 'number',
  )

  useEffect(() => {
    void logGameEvent('app', 'Application started', {
      initialCards: cards.map((card) => ({
        definitionId: card.definitionId,
        quantity: card.quantity ?? 1,
      })),
    })
  }, [])

  useEffect(() => {
    if (currentLevelId) {
      const config = getLevelConfig(currentLevelId)
      setCards(config.initialCards)
      setSeenDefinitionIds([
        ...new Set(config.initialCards.map((card) => card.definitionId)),
      ])
      setStoryState(INITIAL_STORY_STATE)
      setArchivedCards([])
      setProductions([])
      setSelectedCardId(null)
      setDraggingStackIds(null)
      setHasStarted(false)
      setIsStartOverlayVisible(true)
      setIsStartingGame(false)
      settledProductionIdsRef.current.clear()
      settledWeatherTimerKeysRef.current.clear()
      productionSequenceRef.current = 0
      instanceSequenceRef.current = 0
      dragRef.current = null
      suppressClickRef.current = false
    }
  }, [currentLevelId])

  useEffect(() => {
    return () => {
      if (startOverlayTimeoutRef.current !== null) {
        window.clearTimeout(startOverlayTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (
      productions.length === 0 &&
      !hasDecayingCards &&
      !hasSpawningCards &&
      !hasCountdownCards
    ) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 16)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hasCountdownCards, hasDecayingCards, hasSpawningCards, productions.length])

  useEffect(() => {
    const presentDefinitionIds = [
      ...cards.map((card) => card.definitionId),
      ...archivedCards.map((card) => card.definitionId),
    ]

    setSeenDefinitionIds((currentIds) => {
      const nextIds = [...currentIds]
      let hasChanges = false

      for (const definitionId of presentDefinitionIds) {
        if (nextIds.includes(definitionId)) {
          continue
        }

        nextIds.push(definitionId)
        hasChanges = true
      }

      return hasChanges ? nextIds : currentIds
    })
  }, [archivedCards, cards])

  useEffect(() => {
    const boardBounds = boardRef.current?.getBoundingClientRect()

    if (!boardBounds) {
      return
    }

    setCards((currentCards) => {
      let hasChanges = false

      const nextCards = currentCards.map((card) => {
        if (!card.isMother || (card.definitionId !== 'energy' && card.definitionId !== 'time')) {
          return card
        }

        const nextPosition = getMotherCardPosition(
          card.definitionId,
          boardBounds.width,
          boardBounds.height,
        )

        if (card.x === nextPosition.x && card.y === nextPosition.y) {
          return card
        }

        hasChanges = true
        return {
          ...card,
          x: nextPosition.x,
          y: nextPosition.y,
          parentCardId: null,
          childCardId: null,
        }
      })

      return hasChanges ? nextCards : currentCards
    })
  }, [hasStarted])

  useEffect(() => {
    const handleResize = () => {
      const boardBounds = boardRef.current?.getBoundingClientRect()

      if (!boardBounds) {
        return
      }

      setCards((currentCards) => {
        let hasChanges = false

        const nextCards = currentCards.map((card) => {
          if (!card.isMother || (card.definitionId !== 'energy' && card.definitionId !== 'time')) {
            return card
          }

          const nextPosition = getMotherCardPosition(
            card.definitionId,
            boardBounds.width,
            boardBounds.height,
          )

          if (card.x === nextPosition.x && card.y === nextPosition.y) {
            return card
          }

          hasChanges = true
          return {
            ...card,
            x: nextPosition.x,
            y: nextPosition.y,
            parentCardId: null,
            childCardId: null,
          }
        })

        return hasChanges ? nextCards : currentCards
      })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    setCards((currentCards) => {
      let hasChanges = false

      const nextCards = currentCards.map((card) => {
        if (!card.isMother) {
          return card
        }

        const totalCopies = getTotalCopiesOnTable(currentCards, card.definitionId)

        if (totalCopies >= RESOURCE_MOTHER_MAX_QUANTITY) {
          if (
            typeof card.refillStartedAtMs !== 'number' &&
            typeof card.refillDurationMs !== 'number'
          ) {
            return card
          }

          hasChanges = true
          return {
            ...card,
            refillStartedAtMs: null,
            refillDurationMs: null,
          }
        }

        if (
          typeof card.refillStartedAtMs === 'number' &&
          typeof card.refillDurationMs === 'number'
        ) {
          return card
        }

        hasChanges = true
        return {
          ...card,
          refillStartedAtMs: Date.now(),
          refillDurationMs: RESOURCE_MOTHER_REFILL_MS,
        }
      })

      return hasChanges ? nextCards : currentCards
    })
  }, [cards])

  useEffect(() => {
    if (!hasCountdownCards) {
      return
    }

    setCards((currentCards) => {
      let hasChanges = false

      const nextCards = currentCards.map((card) => {
        if (!card.isMother) {
          return card
        }

        const totalCopies = getTotalCopiesOnTable(currentCards, card.definitionId)

        if (
          typeof card.refillStartedAtMs !== 'number' ||
          typeof card.refillDurationMs !== 'number' ||
          nowMs - card.refillStartedAtMs < card.refillDurationMs
        ) {
          return card
        }

        hasChanges = true

        if (totalCopies >= RESOURCE_MOTHER_MAX_QUANTITY) {
          return {
            ...card,
            refillStartedAtMs: null,
            refillDurationMs: null,
          }
        }

        return {
          ...card,
          quantity: Math.min((card.quantity ?? 0) + 1, RESOURCE_MOTHER_MAX_QUANTITY),
          refillStartedAtMs: null,
          refillDurationMs: null,
        }
      })

      return hasChanges ? nextCards : currentCards
    })
  }, [hasCountdownCards, nowMs])

  useEffect(() => {
    const hasUnlockedUmbrella = storyState.unlockedDefinitionIds.includes(
      WEATHER_DISCOVERY_TRIGGER_ID,
    )
    const hasResolvedEnding = cards.some((card) => card.kind === 'ending')

    setCards((currentCards) => {
      let hasChanges = false

      const nextCards = currentCards.map((card) => {
        if (!isWeatherDefinitionId(card.definitionId)) {
          return card
        }

        const shouldCountDown = hasStarted && hasUnlockedUmbrella && !hasResolvedEnding

        if (!shouldCountDown) {
          if (
            typeof card.refillStartedAtMs !== 'number' &&
            typeof card.refillDurationMs !== 'number'
          ) {
            return card
          }

          hasChanges = true
          return {
            ...card,
            refillStartedAtMs: null,
            refillDurationMs: null,
          }
        }

        if (
          typeof card.refillStartedAtMs === 'number' &&
          typeof card.refillDurationMs === 'number'
        ) {
          return card
        }

        hasChanges = true
        return {
          ...card,
          refillStartedAtMs: Date.now(),
          refillDurationMs: WEATHER_STAGE_ADVANCE_MS,
        }
      })

      return hasChanges ? nextCards : currentCards
    })
  }, [cards, hasStarted, storyState.unlockedDefinitionIds])

  useEffect(() => {
    const activeWeatherCard = cards.find(
      (card) =>
        isWeatherDefinitionId(card.definitionId) &&
        typeof card.refillStartedAtMs === 'number' &&
        typeof card.refillDurationMs === 'number',
    )
    const weatherTimerStartedAtMs = activeWeatherCard?.refillStartedAtMs
    const weatherTimerDurationMs = activeWeatherCard?.refillDurationMs

    if (
      !activeWeatherCard ||
      typeof weatherTimerStartedAtMs !== 'number' ||
      typeof weatherTimerDurationMs !== 'number' ||
      nowMs - weatherTimerStartedAtMs < weatherTimerDurationMs
    ) {
      return
    }

    const weatherTimerKey = `${activeWeatherCard.id}:${activeWeatherCard.definitionId}:${weatherTimerStartedAtMs}`

    if (settledWeatherTimerKeysRef.current.has(weatherTimerKey)) {
      return
    }

    settledWeatherTimerKeysRef.current.add(weatherTimerKey)

    if (activeWeatherCard.definitionId === 'weather-downpour') {
      const endingDefinition = cardDefinitionMap.get(FORCED_WEATHER_ENDING_DEFINITION_ID)
      const boardBounds = boardRef.current?.getBoundingClientRect()
      const boardWidth = boardBounds?.width ?? 1200
      const boardHeight = boardBounds?.height ?? 800

      if (!endingDefinition) {
        return
      }

      instanceSequenceRef.current += 1
      const centerX = clamp(boardWidth / 2 - CARD_WIDTH / 2, 0, Math.max(boardWidth - CARD_WIDTH, 0))
      const centerY = clamp(boardHeight / 2 - CARD_HEIGHT / 2, 0, Math.max(boardHeight - CARD_HEIGHT, 0))
      const endingCard = createTableCardFromDefinition(
        endingDefinition,
        `${endingDefinition.id}-${instanceSequenceRef.current}`,
        centerX,
        centerY,
        {
          spawnedAtMs: Date.now(),
          spawnOriginX: centerX,
          spawnOriginY: Math.max(centerY - 48, 0),
        },
      )

      dragRef.current = null
      suppressClickRef.current = false
      settledProductionIdsRef.current.clear()
      setDraggingStackIds(null)
      setSelectedCardId(null)
      setArchivedCards([])
      setProductions([])
      setCards([endingCard])
      void logGameEvent('weather', 'Forced imaginary ending after downpour countdown', {
        weatherDefinitionId: activeWeatherCard.definitionId,
      })
      return
    }

    const nextWeatherDefinitionId = getNextWeatherDefinitionId(activeWeatherCard.definitionId)

    if (!nextWeatherDefinitionId) {
      return
    }

    setCards((currentCards) =>
      currentCards.map((card) => {
        if (card.id !== activeWeatherCard.id) {
          return card
        }

        return {
          ...syncCardToDefinition(card, nextWeatherDefinitionId),
          refillStartedAtMs: Date.now(),
          refillDurationMs: WEATHER_STAGE_ADVANCE_MS,
        }
      }),
    )
    void logGameEvent('weather', 'Weather stage advanced', {
      from: activeWeatherCard.definitionId,
      to: nextWeatherDefinitionId,
    })
  }, [cards, nowMs])

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
      (run) =>
        run.status === 'active' &&
        nowMs - run.startedAtMs >= run.durationMs &&
        !settledProductionIdsRef.current.has(run.id),
    )

    const shrinkFinishedIds = new Set(
      productions
        .filter(
          (run) =>
            run.status === 'shrinking' &&
            typeof run.shrinkStartedAtMs === 'number' &&
            nowMs - run.shrinkStartedAtMs >= PRODUCTION_RING_SHRINK_MS &&
            !settledProductionIdsRef.current.has(run.id),
        )
        .map((run) => run.id),
    )

    if (
      finishedRuns.length === 0 &&
      shrinkFinishedIds.size === 0
    ) {
      return
    }

    const finishedIds = new Set(finishedRuns.map((run) => run.id))
    finishedIds.forEach((runId) => {
      settledProductionIdsRef.current.add(runId)
    })
    shrinkFinishedIds.forEach((runId) => {
      settledProductionIdsRef.current.add(runId)
    })

    const boardBounds = boardRef.current?.getBoundingClientRect()
    const boardWidth = boardBounds?.width ?? 1200
    const boardHeight = boardBounds?.height ?? 800

    queueMicrotask(() => {
      setProductions((currentRuns) => {
        return currentRuns.filter(
          (run) => !finishedIds.has(run.id) && !shrinkFinishedIds.has(run.id),
        )
      })
      setCards((currentCards) => {
        let nextCards = currentCards

        for (const run of finishedRuns) {
          void logGameEvent('production', 'Production finished', {
            ruleId: run.ruleId,
            inputs: run.inputCardIds,
            outputs: run.outputDefinitionIds,
          })
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
      const newlyUnlockedIds = unlockResult.nextUnlockedIds.filter(
        (unlockId) => !storyState.unlockedDefinitionIds.includes(unlockId),
      )
      const newlySpawnedDefinitionIds = unlockResult.nextCards
        .filter(
          (card) =>
            !cards.some((existingCard) => existingCard.id === card.id) &&
            !cards.some((existingCard) => existingCard.definitionId === card.definitionId),
        )
        .map((card) => card.definitionId)
      void logGameEvent('story', 'Story unlock triggered', {
        unlocks: newlyUnlockedIds,
        spawnedCards: newlySpawnedDefinitionIds,
      })
      setCards(unlockResult.nextCards)
    }

    if (!isSameStoryState(nextStoryState, storyState)) {
      void logGameEvent('story', 'Story state updated', nextStoryState)
      setStoryState(nextStoryState)
    }
  }, [cards, storyState])

  useEffect(() => {
    setCards((currentCards) => {
      let hasChanges = false

      const nextCards = currentCards.map((card) => {
        const definition = cardDefinitionMap.get(card.definitionId)

        if (!definition) {
          return card
        }

        if (
          card.name === definition.name &&
          card.kind === definition.kind &&
          card.kindLabel === definition.kindLabel &&
          card.note === definition.note &&
          card.accent === definition.accent
        ) {
          return card
        }

        hasChanges = true
        return {
          ...card,
          name: definition.name,
          kind: definition.kind,
          kindLabel: definition.kindLabel,
          note: definition.note,
          accent: definition.accent,
        }
      })

      return hasChanges ? nextCards : currentCards
    })
  }, [])

  const moveDraggedCard = (pointerId: number, clientX: number, clientY: number) => {
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
  }

  const removeCardPreservingChain = (currentCards: TableCard[], cardId: string) => {
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

  const finishDraggedCard = (pointerId: number, clientX: number, clientY: number) => {
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
  }

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
  }, [])

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
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
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
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
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    finishDraggedCard(event.pointerId, event.clientX, event.clientY)
  }

  const handleStoredCardPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
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

  const handleStartGame = () => {
    if (hasStarted || isStartingGame) {
      return
    }

    const revealStartedAtMs = Date.now()
    const boardBounds = boardRef.current?.getBoundingClientRect()
    const fallbackCenterX = boardBounds ? boardBounds.width / 2 : window.innerWidth / 2
    const fallbackCenterY = boardBounds ? boardBounds.height * 0.72 : window.innerHeight * 0.72

    setHasStarted(true)
    setIsStartingGame(true)
    setNowMs(revealStartedAtMs)
    setCards((currentCards) =>
      currentCards.map((card, index) => ({
        ...card,
        spawnedAtMs: revealStartedAtMs + index * 90,
        spawnOriginX: fallbackCenterX - 59,
        spawnOriginY: fallbackCenterY - 78,
      })),
    )
    void logGameEvent('ui', 'Start screen dismissed')

    startOverlayTimeoutRef.current = window.setTimeout(() => {
      setIsStartOverlayVisible(false)
      setIsStartingGame(false)
      startOverlayTimeoutRef.current = null
    }, 420)
  }

  const handleSelectLevel = (levelId: LevelId) => {
    setCurrentLevelId(levelId)
  }

  const handleBackToMenu = () => {
    setCurrentLevelId(null)
    setCards([])
    setHasStarted(false)
    setIsStartOverlayVisible(true)
    setIsStartingGame(false)
  }

  if (!currentLevelId) {
    return (
      <main className="playground is-waiting-start">
        <section className="start-screen" aria-label="关卡选择">
          <div className="start-screen-panel level-select-panel">
            <p className="start-screen-label">SOSimulator</p>
            <h1>选择关卡</h1>
            <div className="level-select-grid">
              {allLevels.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  className={`level-card${level.isLocked ? ' is-locked' : ''}`}
                  onClick={() => !level.isLocked && handleSelectLevel(level.id)}
                  disabled={level.isLocked}
                >
                  <span className="level-card-name">{level.name}</span>
                  <span className="level-card-desc">{level.description}</span>
                  {level.isLocked && <span className="level-card-lock">🔒 锁定</span>}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main
      className={`playground${!hasStarted ? ' is-waiting-start' : ''}${
        isStartingGame ? ' is-starting-game' : ''
      }`}
    >
      <button
        type="button"
        className="back-to-menu-button"
        onClick={handleBackToMenu}
        aria-label="返回关卡选择"
      >
        ← 返回
      </button>
      <CardBoard
        boardRef={boardRef}
        cards={cards}
        productions={productions}
        draggingStackIds={draggingStackIds}
        nowMs={nowMs}
        storyState={storyState}
        hasStarted={hasStarted}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onCardClick={handleCardClick}
      />
      <MainlineTray
        trayRef={trayRef}
        isOpen={isTrayOpen}
        archivedCards={archivedCards}
        onToggle={() => setIsTrayOpen((current) => !current)}
        onStoredCardPointerDown={handleStoredCardPointerDown}
      />

      {selectedCard && selectedCardDefinition ? (
        <EventCardDetail
          card={selectedCard}
          cards={cards}
          definition={selectedCardDefinition}
          seenDefinitionIds={seenDefinitionIds}
          nowMs={nowMs}
          onClose={() => setSelectedCardId(null)}
        />
      ) : null}

      {isStartOverlayVisible ? (
        <section
          className={`start-screen${isStartingGame ? ' is-leaving' : ''}`}
          aria-label="开始界面"
        >
          <div className="start-screen-panel">
            <p className="start-screen-label">SOSimulator</p>
            <h1>{levelConfig?.name ?? '失物招领室的神明'}</h1>
            <p className="start-screen-copy">
              {levelConfig?.description ?? '点下开始，让桌面上的线索一张张浮现。'}
            </p>
            <button type="button" className="start-screen-button" onClick={handleStartGame}>
              开始
            </button>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
