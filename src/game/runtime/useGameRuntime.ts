import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import {
  cardDefinitionMap,
  createTableCardFromDefinition,
} from '../cardData'
import {
  CARD_HEIGHT,
  CARD_SPAWN_ANIMATION_MS,
  CARD_WIDTH,
  PRODUCTION_RING_SHRINK_MS,
  RESOURCE_MOTHER_MAX_QUANTITY,
  RESOURCE_MOTHER_REFILL_MS,
  WEATHER_STAGE_ADVANCE_MS,
} from '../constants'
import { logGameEvent } from '../log'
import {
  consumeProductionCards,
  getProductionAnchor,
  getProductionMatches,
  resolveCardDecay,
  spawnOutputCards,
} from '../production'
import { clamp } from '../stacking'
import {
  getNextStoryState,
  isSameStoryState,
  unlockStoryCards,
  type StoryState,
} from '../story'
import type { DragState, ProductionRun, TableCard } from '../types'

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

function getTotalCopiesOnTable(cards: TableCard[], definitionId: string) {
  return cards.reduce((total, card) => {
    if (card.definitionId !== definitionId) {
      return total
    }

    return total + (card.quantity ?? 1)
  }, 0)
}

type UseGameRuntimeArgs = {
  boardRef: MutableRefObject<HTMLDivElement | null>
  cards: TableCard[]
  productions: ProductionRun[]
  storyState: StoryState
  hasStarted: boolean
  nowMs: number
  setCards: Dispatch<SetStateAction<TableCard[]>>
  setArchivedCards: Dispatch<SetStateAction<TableCard[]>>
  setProductions: Dispatch<SetStateAction<ProductionRun[]>>
  setStoryState: Dispatch<SetStateAction<StoryState>>
  setNowMs: Dispatch<SetStateAction<number>>
  setDraggingStackIds: Dispatch<SetStateAction<string[] | null>>
  setSelectedCardId: Dispatch<SetStateAction<string | null>>
  dragRef: MutableRefObject<DragState | null>
  suppressClickRef: MutableRefObject<boolean>
  instanceSequenceRef: MutableRefObject<number>
  productionSequenceRef: MutableRefObject<number>
  settledProductionIdsRef: MutableRefObject<Set<string>>
  settledWeatherTimerKeysRef: MutableRefObject<Set<string>>
}

export function useGameRuntime({
  boardRef,
  cards,
  productions,
  storyState,
  hasStarted,
  nowMs,
  setCards,
  setArchivedCards,
  setProductions,
  setStoryState,
  setNowMs,
  setDraggingStackIds,
  setSelectedCardId,
  dragRef,
  suppressClickRef,
  instanceSequenceRef,
  productionSequenceRef,
  settledProductionIdsRef,
  settledWeatherTimerKeysRef,
}: UseGameRuntimeArgs) {
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
  }, [hasCountdownCards, hasDecayingCards, hasSpawningCards, productions.length, setNowMs])

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
  }, [cards, setCards])

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
  }, [hasCountdownCards, nowMs, setCards])

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
  }, [cards, hasStarted, setCards, storyState.unlockedDefinitionIds])

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
  }, [
    boardRef,
    cards,
    dragRef,
    instanceSequenceRef,
    nowMs,
    setArchivedCards,
    setCards,
    setDraggingStackIds,
    setProductions,
    setSelectedCardId,
    settledProductionIdsRef,
    settledWeatherTimerKeysRef,
    suppressClickRef,
  ])

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
  }, [cards, productionSequenceRef, setProductions])

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
  }, [boardRef, cards, instanceSequenceRef, nowMs, productions, setCards, setProductions, settledProductionIdsRef])

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
  }, [boardRef, hasDecayingCards, instanceSequenceRef, nowMs, productions, setCards])

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
  }, [boardRef, cards, instanceSequenceRef, setCards, setStoryState, storyState])
}
