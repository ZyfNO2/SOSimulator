import { useEffect, useRef, useState } from 'react'
import './App.css'
import { CardBoard } from './components/CardBoard'
import { EventCardDetail } from './components/EventCardDetail'
import { MainlineTray } from './components/MainlineTray'
import {
  cardDefinitionMap,
} from './game/cardData'
import { allLevels } from './game/levels'
import { useDragController } from './game/interaction/useDragController'
import { logGameEvent } from './game/log'
import { useCardPresentationSync } from './game/runtime/useCardPresentationSync'
import { useGameRuntime } from './game/runtime/useGameRuntime'
import { useLevelSession } from './game/session/useLevelSession'
import type { DragState, ProductionRun, TableCard } from './game/types'
import {
  INITIAL_STORY_STATE,
  type StoryState,
} from './game/story'

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
  const [archivedCards, setArchivedCards] = useState<TableCard[]>([])
  const [isTrayOpen, setIsTrayOpen] = useState(false)
  const [draggingStackIds, setDraggingStackIds] = useState<string[] | null>(null)
  const [productions, setProductions] = useState<ProductionRun[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [storyState, setStoryState] = useState<StoryState>(INITIAL_STORY_STATE)
  const [seenDefinitionIds, setSeenDefinitionIds] = useState<string[]>([])
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
    setArchivedCards,
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

  useGameRuntime({
    currentLevelId,
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
  })

  useCardPresentationSync({
    boardRef,
    cards,
    archivedCards,
    hasStarted,
    setCards,
    setSeenDefinitionIds,
  })

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleStoredCardPointerDown,
  } = useDragController({
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
  const selectedCardDefinition = selectedCard
    ? cardDefinitionMap.get(selectedCard.definitionId) ?? null
    : null

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
