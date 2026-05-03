import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { CardBoard } from './components/CardBoard'
import { EventCardDetail } from './components/EventCardDetail'
import { MainlineTray } from './components/MainlineTray'
import {
  getCardDefinitionMapForLevel,
} from './game/cardData'
import { allLevels } from './game/levels'
import { useDragController } from './game/interaction/useDragController'
import { logGameEvent } from './game/log'
import { useCardPresentationSync } from './game/runtime/useCardPresentationSync'
import { useGameRuntime } from './game/runtime/useGameRuntime'
import { useLevelSession } from './game/session/useLevelSession'
import type { DragState, ProductionRun, TableCard } from './game/types'
import {
  getObservedDefinitionIds,
  normalizeStoredObservationCards,
} from './game/observation'
import {
  INITIAL_STORY_STATE,
  type StoryState,
} from './game/story'

const BGM_AUDIO_SRC = '/audio/Google%20Gemini.mp3'
const BGM_DEFAULT_VOLUME = 0.35

function App() {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const trayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const productionSequenceRef = useRef(0)
  const instanceSequenceRef = useRef(0)
  const settledProductionIdsRef = useRef<Set<string>>(new Set())
  const settledWeatherTimerKeysRef = useRef<Set<string>>(new Set())
  const [cards, setCards] = useState<TableCard[]>([])
  const [isTrayOpen, setIsTrayOpen] = useState(false)
  const [draggingStackIds, setDraggingStackIds] = useState<string[] | null>(null)
  const [productions, setProductions] = useState<ProductionRun[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [storyState, setStoryState] = useState<StoryState>(INITIAL_STORY_STATE)
  const [seenDefinitionIds, setSeenDefinitionIds] = useState<string[]>([])
  const [storedObservationCards, setStoredObservationCards] = useState<TableCard[]>([])
  const [bgmVolume, setBgmVolume] = useState(BGM_DEFAULT_VOLUME)
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null)
  const [portraitFlashUntilByDefinitionId, setPortraitFlashUntilByDefinitionId] = useState<
    Partial<Record<'kyon' | 'haruhi' | 'asahina' | 'nagato' | 'koizumi', number>>
  >({})
  const {
    currentLevelId,
    levelConfig,
    hasStarted,
    isStartOverlayVisible,
    isStartingGame,
    handleStartGame,
    handleSelectLevel,
    handleBackToMenu,
  } = useLevelSession({
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
  })

  useEffect(() => {
    void logGameEvent('app', 'Application started', {
      initialCards: cards.map((card) => ({
        definitionId: card.definitionId,
        quantity: card.quantity ?? 1,
      })),
    })
  }, [])

  useEffect(() => {
    setStoredObservationCards([])
  }, [currentLevelId])

  useEffect(() => {
    setStoredObservationCards((currentCards) => normalizeStoredObservationCards(currentCards))
  }, [setStoredObservationCards])

  useEffect(() => {
    const audio = new Audio(BGM_AUDIO_SRC)
    audio.loop = true
    audio.volume = bgmVolume
    bgmAudioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
      bgmAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!bgmAudioRef.current) {
      return
    }

    bgmAudioRef.current.volume = bgmVolume
  }, [bgmVolume])

  useEffect(() => {
    const audio = bgmAudioRef.current

    if (!audio) {
      return
    }

    if (!hasStarted || !currentLevelId) {
      audio.pause()
      audio.currentTime = 0
      return
    }

    let disposed = false
    const tryPlay = () => {
      void audio.play().catch(() => {
        // Ignore autoplay restrictions and wait for next interaction.
      })
    }

    const handlePointerDown = () => {
      if (disposed) {
        return
      }

      tryPlay()
    }

    tryPlay()
    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      disposed = true
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [currentLevelId, hasStarted])

  const triggerCharacterPortraitFlash = useCallback((definitionIds: string[]) => {
    const flashUntilMs = Date.now() + 5000
    setPortraitFlashUntilByDefinitionId((current) => {
      const next = { ...current }
      let hasChanges = false

      for (const definitionId of definitionIds) {
        if (
          definitionId !== 'kyon' &&
          definitionId !== 'haruhi' &&
          definitionId !== 'asahina' &&
          definitionId !== 'nagato' &&
          definitionId !== 'koizumi'
        ) {
          continue
        }

        if ((next[definitionId] ?? 0) >= flashUntilMs) {
          continue
        }

        next[definitionId] = flashUntilMs
        hasChanges = true
      }

      return hasChanges ? next : current
    })
  }, [])

  useGameRuntime({
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
  })

  useCardPresentationSync({
    currentLevelId,
    boardRef,
    cards,
    hasStarted,
    setCards,
    setSeenDefinitionIds,
  })

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleObservationCardPointerDown,
  } = useDragController({
    boardRef,
    trayRef,
    cards,
    storedCards: storedObservationCards,
    dragRef,
    suppressClickRef,
    instanceSequenceRef,
    setCards,
    setStoredCards: setStoredObservationCards,
    setDraggingStackIds,
  })

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
  const activeCardDefinitionMap = getCardDefinitionMapForLevel(currentLevelId)
  const selectedCardDefinition = selectedCard
    ? activeCardDefinitionMap.get(selectedCard.definitionId) ?? null
    : null
  const observedDefinitionIds = getObservedDefinitionIds(seenDefinitionIds).filter((definitionId) =>
    activeCardDefinitionMap.has(definitionId),
  )
  const observationEntries = observedDefinitionIds
    .map((definitionId) => {
      const storedCard = storedObservationCards.find((card) => card.definitionId === definitionId)
      const boardCard = cards.find((card) => card.definitionId === definitionId)
      const definition = activeCardDefinitionMap.get(definitionId)

      if (!definition) {
        return null
      }

      if (boardCard) {
        return {
          definitionId,
          name: boardCard.name,
          kindLabel: boardCard.kindLabel,
          accent: boardCard.accent,
          quantity: boardCard.quantity,
          isAvailable: false,
          statusLabel: '场上',
        }
      }

      if (storedCard) {
        return {
          definitionId,
          name: storedCard.name,
          kindLabel: storedCard.kindLabel,
          accent: storedCard.accent,
          quantity: storedCard.quantity,
          isAvailable: true,
          statusLabel: '观测中',
        }
      }

      return {
        definitionId,
        name: definition.name,
        kindLabel: definition.kindLabel,
        accent: definition.accent,
        quantity: undefined,
        isAvailable: true,
        statusLabel: '可取出',
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

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
      <section className="bgm-volume-control" aria-label="背景音乐音量控制">
        <span className="bgm-volume-label">BGM</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(bgmVolume * 100)}
          onChange={(event) => setBgmVolume(Number(event.target.value) / 100)}
        />
      </section>
      <CardBoard
        currentLevelId={currentLevelId}
        boardRef={boardRef}
        cards={cards}
        productions={productions}
        draggingStackIds={draggingStackIds}
        nowMs={nowMs}
        portraitFlashUntilByDefinitionId={portraitFlashUntilByDefinitionId}
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
        entries={observationEntries}
        onToggle={() => setIsTrayOpen((current) => !current)}
        onObservationCardPointerDown={handleObservationCardPointerDown}
      />

      {selectedCard && selectedCardDefinition ? (
        <EventCardDetail
          currentLevelId={currentLevelId}
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
