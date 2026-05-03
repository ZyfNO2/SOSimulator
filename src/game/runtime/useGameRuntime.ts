import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
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
const CHAPTER3_INTEL_DEFINITION_IDS = ['intel-alien', 'intel-future', 'intel-esper'] as const
const CHAPTER3_REGION_DEFINITION_IDS = ['haruhi-area-school', 'haruhi-area-building'] as const
const CHAPTER3_HARUHI_TIMER_MS = 10000
const CHAPTER3_AUTO_CLEAR_MS = 2600
const CHAPTER3_FAIL_ENDING_DEFINITION_IDS = [
  'ending-sos-unknown',
  'ending-sos-leak',
  'ending-sos-ch3',
  'ending-sos',
] as const
const CHAPTER4_AUGUST_TIMER_MS = 60000
const CHAPTER4_AUGUST_FINAL_WINDOW_MS = 3000
const CHAPTER4_DEJAVU_TARGET = 6
const CHAPTER4_INTEL_DEFINITION_IDS = [
  'chapter4-intel-time',
  'chapter4-intel-loop',
  'chapter4-intel-world',
] as const
const CHAPTER1_FOUNDATION_RULE_ID = 'sos-foundation-kyon-haruhi'
const CHAPTER1_FOUNDATION_AUDIO_SRC = '/audio/1-凉宫.mp3'
const CHAPTER1_FOUNDATION_AUDIO_MAX_MS = 20000
const CHAPTER1_FOUNDATION_AUDIO_VOLUME = 0.1
const CHAPTER1_FOUNDATION_AUDIO_ENABLED = false

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

function detachCardPair(currentCards: TableCard[], firstCardId: string, secondCardId: string) {
  return currentCards.map((card) => {
    if (card.id === firstCardId && card.childCardId === secondCardId) {
      return {
        ...card,
        childCardId: null,
      }
    }

    if (card.id === secondCardId && card.parentCardId === firstCardId) {
      return {
        ...card,
        parentCardId: null,
      }
    }

    return card
  })
}

function playAudioEffect(src: string, maxPlayMs?: number, volume?: number) {
  const audio = new Audio(src)
  if (typeof volume === 'number') {
    audio.volume = Math.min(Math.max(volume, 0), 1)
  }

  if (typeof maxPlayMs === 'number' && maxPlayMs > 0) {
    const stopTimerId = window.setTimeout(() => {
      audio.pause()
      audio.currentTime = 0
    }, maxPlayMs)

    audio.addEventListener(
      'ended',
      () => {
        window.clearTimeout(stopTimerId)
      },
      { once: true },
    )
  }

  void audio.play().catch(() => {
    // Ignore autoplay policy failures; gameplay should continue.
  })
}

type UseGameRuntimeArgs = {
  currentLevelId: 'main' | 'level-1' | 'level-2' | 'level-3' | 'level-4' | null
  boardRef: MutableRefObject<HTMLDivElement | null>
  cards: TableCard[]
  productions: ProductionRun[]
  storyState: StoryState
  hasStarted: boolean
  nowMs: number
  setCards: Dispatch<SetStateAction<TableCard[]>>
  setProductions: Dispatch<SetStateAction<ProductionRun[]>>
  setStoryState: Dispatch<SetStateAction<StoryState>>
  setNowMs: Dispatch<SetStateAction<number>>
  setDraggingStackIds: Dispatch<SetStateAction<string[] | null>>
  setSelectedCardId: Dispatch<SetStateAction<string | null>>
  triggerCharacterPortraitFlash: (definitionIds: string[]) => void
  dragRef: MutableRefObject<DragState | null>
  suppressClickRef: MutableRefObject<boolean>
  instanceSequenceRef: MutableRefObject<number>
  productionSequenceRef: MutableRefObject<number>
  settledProductionIdsRef: MutableRefObject<Set<string>>
  settledWeatherTimerKeysRef: MutableRefObject<Set<string>>
}

export function useGameRuntime({
  currentLevelId,
  boardRef,
  cards,
  productions,
  storyState,
  hasStarted,
  nowMs,
  setCards,
  setProductions,
  setStoryState,
  setNowMs,
  setDraggingStackIds,
  setSelectedCardId,
  triggerCharacterPortraitFlash,
  dragRef,
  suppressClickRef,
  instanceSequenceRef,
  productionSequenceRef,
  settledProductionIdsRef,
  settledWeatherTimerKeysRef,
}: UseGameRuntimeArgs) {
  const chapter3InitializedRef = useRef(false)
  const chapter3SettledTimerKeysRef = useRef<Set<string>>(new Set())
  const chapter4SettledTimerKeysRef = useRef<Set<string>>(new Set())
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
    const hasChapter3Entry = cards.some((card) => card.definitionId === 'transfer-student-rumor')

    if (!hasChapter3Entry) {
      chapter3InitializedRef.current = false
      chapter3SettledTimerKeysRef.current.clear()
    }
  }, [cards])

  useEffect(() => {
    if (currentLevelId !== 'level-4') {
      chapter4SettledTimerKeysRef.current.clear()
    }
  }, [currentLevelId])

  useEffect(() => {
    const hasAllIntel = CHAPTER3_INTEL_DEFINITION_IDS.every((definitionId) =>
      cards.some((card) => card.definitionId === definitionId),
    )
    const hasAnyFailEnding = cards.some((card) =>
      CHAPTER3_FAIL_ENDING_DEFINITION_IDS.includes(
        card.definitionId as (typeof CHAPTER3_FAIL_ENDING_DEFINITION_IDS)[number],
      ),
    )

    if (!hasAllIntel || hasAnyFailEnding || chapter3InitializedRef.current) {
      return
    }

    const boardBounds = boardRef.current?.getBoundingClientRect()
    const boardWidth = boardBounds?.width ?? 1200
    const boardHeight = boardBounds?.height ?? 800
    const targetY = Math.max(boardHeight - CARD_HEIGHT - 16, 0)
    const spawnPlan: { definitionId: string; x: number; y: number }[] = []

    if (!cards.some((card) => card.definitionId === 'haruhi-area-school')) {
      spawnPlan.push({
        definitionId: 'haruhi-area-school',
        x: clamp(360, 0, Math.max(boardWidth - CARD_WIDTH, 0)),
        y: targetY,
      })
    }

    if (!cards.some((card) => card.definitionId === 'haruhi-area-building')) {
      spawnPlan.push({
        definitionId: 'haruhi-area-building',
        x: clamp(540, 0, Math.max(boardWidth - CARD_WIDTH, 0)),
        y: targetY,
      })
    }

    if (!cards.some((card) => card.definitionId === 'sos-activity-room')) {
      spawnPlan.push({
        definitionId: 'sos-activity-room',
        x: clamp(720, 0, Math.max(boardWidth - CARD_WIDTH, 0)),
        y: targetY,
      })
    }

    if (spawnPlan.length === 0) {
      chapter3InitializedRef.current = true
      return
    }

    setCards((currentCards) => {
      let nextCards = currentCards

      for (const plan of spawnPlan) {
        const definition = cardDefinitionMap.get(plan.definitionId)

        if (!definition) {
          continue
        }

        instanceSequenceRef.current += 1
        nextCards = [
          ...nextCards,
          createTableCardFromDefinition(
            definition,
            `${definition.id}-${instanceSequenceRef.current}`,
            plan.x,
            plan.y,
            {
              spawnedAtMs: Date.now(),
              spawnOriginX: plan.x,
              spawnOriginY: Math.max(plan.y - 42, 0),
            },
          ),
        ]
      }

      return nextCards
    })
    chapter3InitializedRef.current = true
    void logGameEvent('chapter3', 'Spawned chapter 3 region set', {
      spawnedDefinitionIds: spawnPlan.map((plan) => plan.definitionId),
    })
  }, [boardRef, cards, instanceSequenceRef, setCards])

  useEffect(() => {
    const hasAllIntel = CHAPTER3_INTEL_DEFINITION_IDS.every((definitionId) =>
      cards.some((card) => card.definitionId === definitionId),
    )
    const hasAnyFailEnding = cards.some((card) =>
      CHAPTER3_FAIL_ENDING_DEFINITION_IDS.includes(
        card.definitionId as (typeof CHAPTER3_FAIL_ENDING_DEFINITION_IDS)[number],
      ),
    )

    setCards((currentCards) => {
      let hasChanges = false

      const nextCards = currentCards.map((card) => {
        if (card.definitionId !== 'haruhi') {
          return card
        }

        const shouldCountDown = hasAllIntel && !hasAnyFailEnding

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
          refillDurationMs: CHAPTER3_HARUHI_TIMER_MS,
        }
      })

      return hasChanges ? nextCards : currentCards
    })
  }, [cards, setCards])

  useEffect(() => {
    const activeHaruhiCard = cards.find(
      (card) =>
        card.definitionId === 'haruhi' &&
        typeof card.refillStartedAtMs === 'number' &&
        typeof card.refillDurationMs === 'number',
    )
    const timerStartedAtMs = activeHaruhiCard?.refillStartedAtMs
    const timerDurationMs = activeHaruhiCard?.refillDurationMs

    if (
      !activeHaruhiCard ||
      typeof timerStartedAtMs !== 'number' ||
      typeof timerDurationMs !== 'number' ||
      nowMs - timerStartedAtMs < timerDurationMs
    ) {
      return
    }

    const timerKey = `${activeHaruhiCard.id}:${timerStartedAtMs}`

    if (chapter3SettledTimerKeysRef.current.has(timerKey)) {
      return
    }

    chapter3SettledTimerKeysRef.current.add(timerKey)

    setCards((currentCards) => {
      const hasAnyFailEnding = currentCards.some((card) =>
        CHAPTER3_FAIL_ENDING_DEFINITION_IDS.includes(
          card.definitionId as (typeof CHAPTER3_FAIL_ENDING_DEFINITION_IDS)[number],
        ),
      )

      if (hasAnyFailEnding) {
        return currentCards
      }

      const nextPulseMs = Date.now()
      let nextCards = currentCards.map((card) =>
        card.id === activeHaruhiCard.id
          ? {
              ...card,
              refillStartedAtMs: nextPulseMs,
              refillDurationMs: CHAPTER3_HARUHI_TIMER_MS,
            }
          : card,
      )

      const capturedRegion = nextCards.find((card) =>
        CHAPTER3_REGION_DEFINITION_IDS.includes(
          card.definitionId as (typeof CHAPTER3_REGION_DEFINITION_IDS)[number],
        ),
      )

      if (!capturedRegion) {
        return nextCards
      }

      const closedSpaceDefinition = cardDefinitionMap.get('closed-space-on-area')

      if (!closedSpaceDefinition) {
        return nextCards
      }

      nextCards = nextCards.map((card) =>
        card.id === capturedRegion.id
          ? {
              ...card,
              isInteractionLocked: true,
            }
          : card,
      )
      instanceSequenceRef.current += 1
      nextCards = [
        ...nextCards,
        createTableCardFromDefinition(
          closedSpaceDefinition,
          `${closedSpaceDefinition.id}-${instanceSequenceRef.current}`,
          capturedRegion.x,
          capturedRegion.y,
          {
            spawnedAtMs: nextPulseMs,
            spawnOriginX: capturedRegion.x,
            spawnOriginY: Math.max(capturedRegion.y - 36, 0),
          },
        ),
      ]

      return nextCards
    })
    triggerCharacterPortraitFlash(['haruhi'])
    void logGameEvent('chapter3', 'Haruhi pulse captured a region', {
      triggerCardId: activeHaruhiCard.id,
    })
  }, [cards, nowMs, setCards, instanceSequenceRef, triggerCharacterPortraitFlash])

  useEffect(() => {
    const hasBothResolves =
      cards.some((card) => card.definitionId === 'esper-resolve') &&
      cards.some((card) => card.definitionId === 'alien-carry')
    const hasAnyFailEnding = cards.some((card) =>
      CHAPTER3_FAIL_ENDING_DEFINITION_IDS.includes(
        card.definitionId as (typeof CHAPTER3_FAIL_ENDING_DEFINITION_IDS)[number],
      ),
    )
    const hasExistingClearEnding = cards.some((card) => card.definitionId === 'ending-sos-ch3')

    if (!hasBothResolves || hasAnyFailEnding || hasExistingClearEnding) {
      return
    }

    setCards((currentCards) => {
      const roomCard = currentCards.find((card) => card.definitionId === 'sos-activity-room')
      const memberDefinitionIds = ['kyon', 'haruhi', 'nagato', 'asahina'] as const
      const memberCards = memberDefinitionIds
        .map((definitionId) => currentCards.find((card) => card.definitionId === definitionId))
        .filter((card): card is TableCard => Boolean(card))
      const esperCard = currentCards.find((card) => card.definitionId === 'esper-resolve')
      const alienCard = currentCards.find((card) => card.definitionId === 'alien-carry')

      if (
        !roomCard ||
        memberCards.length !== memberDefinitionIds.length ||
        !esperCard ||
        !alienCard
      ) {
        return currentCards
      }

      const absorbedIds = new Set<string>([
        roomCard.id,
        esperCard.id,
        alienCard.id,
        ...memberCards.map((card) => card.id),
      ])
      let nextCards = currentCards

      for (const absorbedId of absorbedIds) {
        nextCards = removeCardPreservingChain(nextCards, absorbedId)
      }

      const endingDefinition = cardDefinitionMap.get('ending-sos-ch3')

      if (!endingDefinition) {
        return nextCards
      }

      const now = Date.now()
      instanceSequenceRef.current += 1
      const endingCard = createTableCardFromDefinition(
        endingDefinition,
        `${endingDefinition.id}-${instanceSequenceRef.current}`,
        roomCard.x,
        roomCard.y,
        {
          spawnedAtMs: now,
          spawnOriginX: roomCard.x,
          spawnOriginY: Math.max(roomCard.y - 42, 0),
        },
      )

      return [
        ...nextCards,
        {
          ...endingCard,
          refillStartedAtMs: now,
          refillDurationMs: CHAPTER3_AUTO_CLEAR_MS,
        },
      ]
    })
    setNowMs(Date.now())
    void logGameEvent('chapter3', 'SOS auto absorbed full team for clear', {
      requiredMembers: ['kyon', 'haruhi', 'nagato', 'asahina'],
    })
  }, [cards, instanceSequenceRef, setCards, setNowMs])

  useEffect(() => {
    if (currentLevelId !== 'level-4') {
      return
    }

    const hasChapter4Ending = cards.some((card) => card.definitionId === 'ending-sos-ch4')

    setCards((currentCards) => {
      let hasChanges = false

      const nextCards = currentCards.map((card) => {
        if (card.definitionId !== 'august-loop') {
          return card
        }

        const shouldCountDown = hasStarted && !hasChapter4Ending

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
          refillDurationMs: CHAPTER4_AUGUST_TIMER_MS,
        }
      })

      return hasChanges ? nextCards : currentCards
    })
  }, [cards, currentLevelId, hasStarted, setCards])

  useEffect(() => {
    if (currentLevelId !== 'level-4') {
      return
    }

    const activeAugustCard = cards.find(
      (card) =>
        card.definitionId === 'august-loop' &&
        typeof card.refillStartedAtMs === 'number' &&
        typeof card.refillDurationMs === 'number',
    )
    const timerStartedAtMs = activeAugustCard?.refillStartedAtMs
    const timerDurationMs = activeAugustCard?.refillDurationMs

    if (
      !activeAugustCard ||
      typeof timerStartedAtMs !== 'number' ||
      typeof timerDurationMs !== 'number' ||
      nowMs - timerStartedAtMs < timerDurationMs
    ) {
      return
    }

    const timerKey = `${activeAugustCard.id}:${timerStartedAtMs}`

    if (chapter4SettledTimerKeysRef.current.has(timerKey)) {
      return
    }

    chapter4SettledTimerKeysRef.current.add(timerKey)

    setCards((currentCards) => {
      const augustCard = currentCards.find((card) => card.id === activeAugustCard.id)

      if (!augustCard) {
        return currentCards
      }

      const dejaVuDefinition = cardDefinitionMap.get('chapter4-dejavu')

      if (!dejaVuDefinition) {
        return currentCards
      }

      const nextCycleStartedAtMs = Date.now()
      let nextCards = currentCards.map((card) => {
        const nextCard =
          card.id === augustCard.id
            ? {
                ...card,
                refillStartedAtMs: nextCycleStartedAtMs,
                refillDurationMs: CHAPTER4_AUGUST_TIMER_MS,
              }
            : card

        if (nextCard.kind === 'character' && nextCard.isInteractionLocked) {
          return {
            ...nextCard,
            isInteractionLocked: false,
          }
        }

        return nextCard
      })
      let convertedCopies = 0

      for (const intelDefinitionId of CHAPTER4_INTEL_DEFINITION_IDS) {
        const intelCards = nextCards.filter((card) => card.definitionId === intelDefinitionId)
        convertedCopies += intelCards.reduce((total, card) => total + (card.quantity ?? 1), 0)

        for (const intelCard of intelCards) {
          nextCards = removeCardPreservingChain(nextCards, intelCard.id)
        }
      }

      if (convertedCopies <= 0) {
        return nextCards
      }

      const existingDejaVuCard = nextCards.find((card) => card.definitionId === 'chapter4-dejavu')

      if (existingDejaVuCard) {
        return nextCards.map((card) =>
          card.id === existingDejaVuCard.id
            ? {
                ...card,
                quantity: (card.quantity ?? 1) + convertedCopies,
              }
            : card,
        )
      }

      instanceSequenceRef.current += 1
      return [
        ...nextCards,
        {
          ...createTableCardFromDefinition(
            dejaVuDefinition,
            `${dejaVuDefinition.id}-${instanceSequenceRef.current}`,
            augustCard.x,
            augustCard.y,
            {
              spawnedAtMs: Date.now(),
              spawnOriginX: augustCard.x,
              spawnOriginY: Math.max(augustCard.y - 42, 0),
            },
          ),
          quantity: convertedCopies,
        },
      ]
    })
    void logGameEvent('chapter4', 'August loop tick converted intel to deja vu')
  }, [cards, currentLevelId, instanceSequenceRef, nowMs, setCards])

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
    setCards,
    setDraggingStackIds,
    setProductions,
    setSelectedCardId,
    settledProductionIdsRef,
    settledWeatherTimerKeysRef,
    suppressClickRef,
  ])

  useEffect(() => {
    const matches = getProductionMatches(cards, currentLevelId)
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
  }, [cards, currentLevelId, productionSequenceRef, setProductions])

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
          if (CHAPTER1_FOUNDATION_AUDIO_ENABLED && run.ruleId === CHAPTER1_FOUNDATION_RULE_ID) {
            playAudioEffect(
              CHAPTER1_FOUNDATION_AUDIO_SRC,
              CHAPTER1_FOUNDATION_AUDIO_MAX_MS,
              CHAPTER1_FOUNDATION_AUDIO_VOLUME,
            )
          }
          const portraitDefinitionIds = run.inputCardIds
            .map((cardId) => nextCards.find((card) => card.id === cardId)?.definitionId ?? null)
            .filter((definitionId): definitionId is string => Boolean(definitionId))
          if (portraitDefinitionIds.length > 0) {
            triggerCharacterPortraitFlash(portraitDefinitionIds)
          }
          const anchor = getProductionAnchor(nextCards, run)
          if (run.ruleId === 'chapter4-kyon-nagato-loop') {
            const [kyonCardId, nagatoCardId] = run.inputCardIds
            const existingLoopCard = nextCards.find(
              (card) => card.definitionId === 'chapter4-intel-loop',
            )

            if (existingLoopCard) {
              nextCards = nextCards.map((card) =>
                card.id === existingLoopCard.id
                  ? {
                      ...card,
                      quantity: (card.quantity ?? 1) + 1,
                    }
                  : card,
              )
            } else {
              const loopDefinition = cardDefinitionMap.get('chapter4-intel-loop')

              if (loopDefinition) {
                instanceSequenceRef.current += 1
                nextCards = [
                  ...nextCards,
                  createTableCardFromDefinition(
                    loopDefinition,
                    `${loopDefinition.id}-${instanceSequenceRef.current}`,
                    clamp(anchor.centerX - CARD_WIDTH / 2, 0, Math.max(boardWidth - CARD_WIDTH, 0)),
                    clamp(
                      anchor.centerY - CARD_HEIGHT / 2,
                      0,
                      Math.max(boardHeight - CARD_HEIGHT, 0),
                    ),
                    {
                      spawnedAtMs: Date.now(),
                      spawnOriginX: anchor.centerX - CARD_WIDTH / 2,
                      spawnOriginY: anchor.centerY - CARD_HEIGHT / 2,
                    },
                  ),
                ]
              }
            }

            nextCards = detachCardPair(nextCards, kyonCardId, nagatoCardId)
            continue
          }

          if (run.ruleId === 'chapter4-kyon-haruhi-command') {
            const [kyonCardId, haruhiCardId] = run.inputCardIds
            const dejaVuCopies = nextCards.reduce((total, card) => {
              if (card.definitionId !== 'chapter4-dejavu') {
                return total
              }

              return total + (card.quantity ?? 1)
            }, 0)
            const augustCard = nextCards.find((card) => card.definitionId === 'august-loop')

            if (dejaVuCopies >= CHAPTER4_DEJAVU_TARGET) {
              const endingDefinition = cardDefinitionMap.get('ending-sos-ch4')
              const hasEnding = nextCards.some((card) => card.definitionId === 'ending-sos-ch4')

              if (endingDefinition && !hasEnding) {
                const spawnX = clamp(
                  anchor.centerX - CARD_WIDTH / 2,
                  0,
                  Math.max(boardWidth - CARD_WIDTH, 0),
                )
                const spawnY = clamp(
                  anchor.centerY - CARD_HEIGHT / 2,
                  0,
                  Math.max(boardHeight - CARD_HEIGHT, 0),
                )
                instanceSequenceRef.current += 1
                nextCards = [
                  ...nextCards,
                  createTableCardFromDefinition(
                    endingDefinition,
                    `${endingDefinition.id}-${instanceSequenceRef.current}`,
                    spawnX,
                    spawnY,
                    {
                      spawnedAtMs: Date.now(),
                      spawnOriginX: spawnX,
                      spawnOriginY: Math.max(spawnY - 48, 0),
                    },
                  ),
                ]
              }
            } else if (augustCard) {
              const nextStartedAtMs = Date.now() - (CHAPTER4_AUGUST_TIMER_MS - CHAPTER4_AUGUST_FINAL_WINDOW_MS)
              nextCards = nextCards.map((card) =>
                card.id === augustCard.id
                  ? {
                      ...card,
                      refillStartedAtMs: nextStartedAtMs,
                      refillDurationMs: CHAPTER4_AUGUST_TIMER_MS,
                    }
                  : card,
              )
            }

            nextCards = detachCardPair(nextCards, kyonCardId, haruhiCardId)
            continue
          }

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

          if (currentLevelId === 'level-4' && run.ruleId.startsWith('chapter4-kyon-')) {
            const [firstCardId, secondCardId] = run.inputCardIds

            if (firstCardId && secondCardId) {
              nextCards = detachCardPair(nextCards, firstCardId, secondCardId)
            }
          }

          if (
            run.ruleId === 'chapter3-koizumi-closed-space-resolve' ||
            run.ruleId === 'chapter3-nagato-closed-space-carry'
          ) {
            const swallowedRegionCard = nextCards.find(
              (card) =>
                CHAPTER3_REGION_DEFINITION_IDS.includes(
                  card.definitionId as (typeof CHAPTER3_REGION_DEFINITION_IDS)[number],
                ) && card.isInteractionLocked,
            )

            if (swallowedRegionCard) {
              nextCards = removeCardPreservingChain(nextCards, swallowedRegionCard.id)
            }
          }
        }

        return nextCards
      })
    })
  }, [
    boardRef,
    cards,
    instanceSequenceRef,
    nowMs,
    productions,
    setCards,
    setProductions,
    settledProductionIdsRef,
    triggerCharacterPortraitFlash,
  ])

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
