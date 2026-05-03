import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { getLevelConfig, type LevelId } from '../levels'
import { logGameEvent } from '../log'
import { INITIAL_STORY_STATE, type StoryState } from '../story'
import type { DragState, ProductionRun, TableCard } from '../types'

type UseLevelSessionArgs = {
  boardRef: MutableRefObject<HTMLDivElement | null>
  cards: TableCard[]
  setCards: Dispatch<SetStateAction<TableCard[]>>
  setSeenDefinitionIds: Dispatch<SetStateAction<string[]>>
  setStoryState: Dispatch<SetStateAction<StoryState>>
  setProductions: Dispatch<SetStateAction<ProductionRun[]>>
  setSelectedCardId: Dispatch<SetStateAction<string | null>>
  setDraggingStackIds: Dispatch<SetStateAction<string[] | null>>
  setNowMs: Dispatch<SetStateAction<number>>
  settledProductionIdsRef: MutableRefObject<Set<string>>
  settledWeatherTimerKeysRef: MutableRefObject<Set<string>>
  productionSequenceRef: MutableRefObject<number>
  instanceSequenceRef: MutableRefObject<number>
  dragRef: MutableRefObject<DragState | null>
  suppressClickRef: MutableRefObject<boolean>
}

const SOS_CLEAR_RETURN_MS = 4200
const AUTO_RETURN_ENDING_DEFINITION_IDS = [
  'ending-sos',
  'ending-sos-ch3',
  'ending-sos-ch4',
  'ending-sos-unknown',
  'ending-sos-leak',
] as const
const AUTO_RETURN_MS_BY_ENDING: Partial<
  Record<(typeof AUTO_RETURN_ENDING_DEFINITION_IDS)[number], number>
> = {
  'ending-sos-ch3': 2600,
  'ending-sos-ch4': 2600,
}

export function useLevelSession({
  boardRef,
  cards,
  setCards,
  setSeenDefinitionIds,
  setStoryState,
  setProductions,
  setSelectedCardId,
  setDraggingStackIds,
  setNowMs,
  settledProductionIdsRef,
  settledWeatherTimerKeysRef,
  productionSequenceRef,
  instanceSequenceRef,
  dragRef,
  suppressClickRef,
}: UseLevelSessionArgs) {
  const startOverlayTimeoutRef = useRef<number | null>(null)
  const sosClearReturnTimeoutRef = useRef<number | null>(null)
  const armedSosClearCardIdRef = useRef<string | null>(null)
  const [currentLevelId, setCurrentLevelId] = useState<LevelId | null>(null)
  const [hasStarted, setHasStarted] = useState(false)
  const [isStartOverlayVisible, setIsStartOverlayVisible] = useState(true)
  const [isStartingGame, setIsStartingGame] = useState(false)
  const levelConfig = currentLevelId ? getLevelConfig(currentLevelId) : null

  useEffect(() => {
    if (currentLevelId) {
      const config = getLevelConfig(currentLevelId)
      setCards(config.initialCards)
      setSeenDefinitionIds([
        ...new Set(config.initialCards.map((card) => card.definitionId)),
      ])
      setStoryState(INITIAL_STORY_STATE)
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
  }, [
    currentLevelId,
    dragRef,
    instanceSequenceRef,
    productionSequenceRef,
    setCards,
    setDraggingStackIds,
    setProductions,
    setSeenDefinitionIds,
    setSelectedCardId,
    setStoryState,
    settledProductionIdsRef,
    settledWeatherTimerKeysRef,
    suppressClickRef,
  ])

  useEffect(() => {
    return () => {
      if (startOverlayTimeoutRef.current !== null) {
        window.clearTimeout(startOverlayTimeoutRef.current)
      }
      if (sosClearReturnTimeoutRef.current !== null) {
        window.clearTimeout(sosClearReturnTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const sosClearCard = cards.find((card) =>
      AUTO_RETURN_ENDING_DEFINITION_IDS.includes(
        card.definitionId as (typeof AUTO_RETURN_ENDING_DEFINITION_IDS)[number],
      ),
    )

    if (!currentLevelId || !sosClearCard) {
      armedSosClearCardIdRef.current = null
      if (sosClearReturnTimeoutRef.current !== null) {
        window.clearTimeout(sosClearReturnTimeoutRef.current)
        sosClearReturnTimeoutRef.current = null
      }
      return
    }

    if (armedSosClearCardIdRef.current === sosClearCard.id) {
      return
    }

    const startedAtMs = Date.now()
    const autoReturnMs =
      AUTO_RETURN_MS_BY_ENDING[
        sosClearCard.definitionId as (typeof AUTO_RETURN_ENDING_DEFINITION_IDS)[number]
      ] ?? SOS_CLEAR_RETURN_MS
    armedSosClearCardIdRef.current = sosClearCard.id
    setNowMs(startedAtMs)
    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === sosClearCard.id
          ? {
              ...card,
              refillStartedAtMs: startedAtMs,
              refillDurationMs: autoReturnMs,
            }
          : card,
      ),
    )
    void logGameEvent('ui', 'SOS clear card armed for auto return', {
      levelId: currentLevelId,
      cardId: sosClearCard.id,
      durationMs: autoReturnMs,
    })

    if (sosClearReturnTimeoutRef.current !== null) {
      window.clearTimeout(sosClearReturnTimeoutRef.current)
    }

    sosClearReturnTimeoutRef.current = window.setTimeout(() => {
      setCurrentLevelId(null)
      setCards([])
      setHasStarted(false)
      setIsStartOverlayVisible(true)
      setIsStartingGame(false)
      armedSosClearCardIdRef.current = null
      sosClearReturnTimeoutRef.current = null
      void logGameEvent('ui', 'Auto returned to level select after SOS clear')
    }, autoReturnMs)
  }, [cards, currentLevelId, setCards, setNowMs])

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
    if (sosClearReturnTimeoutRef.current !== null) {
      window.clearTimeout(sosClearReturnTimeoutRef.current)
      sosClearReturnTimeoutRef.current = null
    }
    armedSosClearCardIdRef.current = null
    setCurrentLevelId(null)
    setCards([])
    setHasStarted(false)
    setIsStartOverlayVisible(true)
    setIsStartingGame(false)
  }

  return {
    currentLevelId,
    levelConfig,
    hasStarted,
    isStartOverlayVisible,
    isStartingGame,
    handleStartGame,
    handleSelectLevel,
    handleBackToMenu,
  }
}
