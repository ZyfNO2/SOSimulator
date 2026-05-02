import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'
import { EndingModal } from './components/EndingModal'
import type { LogEntry } from './components/LogPanel'
import { LogPanel } from './components/LogPanel'
import { ProductionEffect } from './components/ProductionEffect'
import { cardDefinitionMap, createTableCardFromDefinition, initialCards } from './game/cardData'
import {
  CARD_HEIGHT,
  CARD_SPAWN_ANIMATION_MS,
  CARD_WIDTH,
  CLOSED_SPACE_SPAWN_INTERVAL_MAX_MS,
  CLOSED_SPACE_SPAWN_INTERVAL_MIN_MS,
  ENERGY_REGEN_INTERVAL_MS,
  PRODUCTION_AUTO_REQUEUE_LEAD_MS,
  PRODUCTION_RING_SHRINK_MS,
} from './game/constants'
import {
  consumeChildCard,
  getProductionAnchor,
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

const CLOSED_SPACE_DEF_ID = 'closed-space'
const CLOSED_SPACE_MAX = 3

function App() {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const productionSequenceRef = useRef(0)
  const instanceSequenceRef = useRef(0)
  const logSequenceRef = useRef(0)
  const closedSpaceTimerRef = useRef<number | null>(null)
  const closedSpaceIntervalRef = useRef(
    CLOSED_SPACE_SPAWN_INTERVAL_MIN_MS +
      Math.random() * (CLOSED_SPACE_SPAWN_INTERVAL_MAX_MS - CLOSED_SPACE_SPAWN_INTERVAL_MIN_MS),
  )

  const [cards, setCards] = useState(initialCards)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [productions, setProductions] = useState<ProductionRun[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [energyRegenStartMs, setEnergyRegenStartMs] = useState(() => Date.now())
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [ending, setEnding] = useState<'victory' | 'failure' | null>(null)

  const addLog = useCallback((message: string) => {
    logSequenceRef.current += 1
    const entry: LogEntry = {
      id: logSequenceRef.current,
      message,
      timestampMs: Date.now(),
    }
    setLogs((prev) => {
      const next = [...prev, entry]
      return next.length > 50 ? next.slice(-50) : next
    })
  }, [])

  const spawnClosedSpace = useCallback(
    (boardWidth: number, boardHeight: number) => {
      const def = cardDefinitionMap.get(CLOSED_SPACE_DEF_ID)
      if (!def) return
      instanceSequenceRef.current += 1
      const margin = 60
      const x = margin + Math.random() * Math.max(boardWidth - CARD_WIDTH - margin * 2, 0)
      const y = margin + Math.random() * Math.max(boardHeight - CARD_HEIGHT - margin * 2, 0)
      const newCard = createTableCardFromDefinition(
        def,
        `closed-space-${instanceSequenceRef.current}`,
        x,
        y,
        { spawnedAtMs: Date.now(), spawnOriginX: x, spawnOriginY: y },
      )
      setCards((prev) => [...prev, newCard])
      addLog('凉宫的情绪产生了波动……闭锁空间正在扩散。')
    },
    [addLog],
  )

  const handleReset = useCallback(() => {
    setCards(initialCards)
    setProductions([])
    setNowMs(Date.now())
    setDraggingId(null)
    setEnding(null)
    setLogs([])
    setEnergyRegenStartMs(Date.now())
    productionSequenceRef.current = 0
    instanceSequenceRef.current = 0
    logSequenceRef.current = 0
    closedSpaceIntervalRef.current =
      CLOSED_SPACE_SPAWN_INTERVAL_MIN_MS +
      Math.random() * (CLOSED_SPACE_SPAWN_INTERVAL_MAX_MS - CLOSED_SPACE_SPAWN_INTERVAL_MIN_MS)
  }, [])

  useEffect(() => {
    const board = boardRef.current
    if (!board || ending) return

    function scheduleNext() {
      closedSpaceTimerRef.current = window.setTimeout(
        () => {
          const bounds = board?.getBoundingClientRect()
          if (bounds) {
            spawnClosedSpace(bounds.width, bounds.height)
          }
          closedSpaceIntervalRef.current =
            CLOSED_SPACE_SPAWN_INTERVAL_MIN_MS +
            Math.random() *
              (CLOSED_SPACE_SPAWN_INTERVAL_MAX_MS - CLOSED_SPACE_SPAWN_INTERVAL_MIN_MS)
          scheduleNext()
        },
        closedSpaceIntervalRef.current,
      )
    }

    scheduleNext()

    return () => {
      if (closedSpaceTimerRef.current !== null) {
        window.clearTimeout(closedSpaceTimerRef.current)
      }
    }
  }, [ending, spawnClosedSpace])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 16)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const matches = getProductionMatches(cards)
    const matchMap = new Map(matches.map((match) => [match.pairKey, match]))

    queueMicrotask(() => {
      setProductions((currentRuns) => {
        const nextRuns = currentRuns.map((run) => {
          if (run.status === 'shrinking') return run
          if (matchMap.has(run.pairKey)) return run
          return {
            ...run,
            status: 'shrinking' as const,
            shrinkStartedAtMs: Date.now(),
            cancelProgress: clamp((Date.now() - run.startedAtMs) / run.durationMs, 0, 1),
          }
        })

        const activeKeys = new Set(
          nextRuns.filter((run) => run.status === 'active').map((run) => run.pairKey),
        )

        for (const match of matches) {
          if (activeKeys.has(match.pairKey)) continue

          productionSequenceRef.current += 1
          const newRun: ProductionRun = {
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
          }
          nextRuns.push(newRun)

          const parentCard = cards.find((c) => c.id === match.parentCard.id)
          const childCard = cards.find((c) => c.id === match.childCard.id)
          if (parentCard && childCard) {
            addLog(`「${match.rule.event}」开始：${parentCard.name} + ${childCard.name}`)
          }
        }

        return nextRuns
      })
    })
  }, [cards, addLog])

  useEffect(() => {
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

    const energyRegenElapsed = nowMs - energyRegenStartMs
    const energyCycles = Math.floor(energyRegenElapsed / ENERGY_REGEN_INTERVAL_MS)
    const nextEnergyRegenStartMs = energyRegenStartMs + energyCycles * ENERGY_REGEN_INTERVAL_MS
    const shouldSpawnEnergy = energyCycles > 0

    if (
      finishedRuns.length === 0 &&
      requeueRuns.length === 0 &&
      shrinkFinishedIds.size === 0 &&
      !shouldSpawnEnergy
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
            if (needsRequeue) return { ...run, nextQueued: true }
            return run
          })

        for (const run of requeueRuns) {
          const match = activeMatchMap.get(run.pairKey)
          if (!match) continue
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
          const parentCard = nextCards.find((c) => c.id === run.parentCardId)
          const parentName = parentCard?.name ?? '???'

          if (run.ruleId === 'haruhi-kyon-calm') {
            const closedSpaceCard = nextCards.find(
              (c) => c.definitionId === CLOSED_SPACE_DEF_ID,
            )
            if (closedSpaceCard) {
              nextCards = nextCards.filter((c) => c.id !== closedSpaceCard.id)
              addLog('阿虚安抚了凉宫的情绪。一个闭锁空间消退了。')
            } else {
              addLog('凉宫暂时平静下来了。（当前没有闭锁空间）')
            }
            continue
          }

          if (run.ruleId === 'kyon-truth-ending') {
            addLog('阿虚直视了世界的真相——然后选择了沉默。')
            setEnding('victory')
            continue
          }

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

          const childCard = currentCards.find((c) => c.id === run.childCardId)
          const childName = childCard?.name ?? '???'
          const outputDef = run.outputDefinitionId
            ? cardDefinitionMap.get(run.outputDefinitionId)
            : null
          const outputName = outputDef?.name ?? '新的卡牌'

          if (run.consumeChild) {
            addLog(
              `「${run.event}」完成：${parentName} + ${childName} → 消耗${childName}，获得${outputName}`,
            )
          } else {
            addLog(`「${run.event}」完成：${parentName} + ${childName} → 获得${outputName}`)
          }
        }

        if (shouldSpawnEnergy) {
          const energyDef = cardDefinitionMap.get('energy')
          if (energyDef) {
            instanceSequenceRef.current += 1
            const centerX = boardWidth / 2
            const centerY = boardHeight / 2
            const angleSeed = instanceSequenceRef.current * 1.61803398875
            const angle = (angleSeed % 1) * Math.PI * 2
            const distance = 90 + ((instanceSequenceRef.current * 17) % 39)
            const targetX = clamp(
              centerX - CARD_WIDTH / 2 + Math.cos(angle) * distance,
              0,
              Math.max(boardWidth - CARD_WIDTH, 0),
            )
            const targetY = clamp(
              centerY - CARD_HEIGHT / 2 + Math.sin(angle) * distance,
              0,
              Math.max(boardHeight - CARD_HEIGHT, 0),
            )
            nextCards = [
              ...nextCards,
              createTableCardFromDefinition(energyDef, `energy-${instanceSequenceRef.current}`, targetX, targetY, {
                spawnedAtMs: nowMs,
                spawnOriginX: centerX - CARD_WIDTH / 2,
                spawnOriginY: centerY - CARD_HEIGHT / 2,
              }),
            ]
          }
        }

        const closedSpaceCount = nextCards.filter(
          (c) => c.definitionId === CLOSED_SPACE_DEF_ID,
        ).length
        if (closedSpaceCount >= CLOSED_SPACE_MAX) {
          addLog('闭锁空间侵蚀了整个世界——一切都结束了。')
          setEnding('failure')
        }

        return nextCards
      })

      if (shouldSpawnEnergy) {
        setEnergyRegenStartMs(nextEnergyRegenStartMs)
      }
    })
  }, [cards, nowMs, productions, energyRegenStartMs, addLog])

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    if (ending) return
    const board = boardRef.current
    const cardBounds = event.currentTarget.getBoundingClientRect()
    if (!board) return

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
    if (!dragState || !board || dragState.pointerId !== event.pointerId) return

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
      if (!movingCard) return currentCards

      const descendantIds = getDescendantIds(currentCards, dragState.cardId)
      const deltaX = snapResult.x - movingCard.x
      const deltaY = snapResult.y - movingCard.y

      let nextCards = currentCards.map((card) => {
        if (card.id === dragState.cardId) return { ...card, x: snapResult.x, y: snapResult.y }
        if (descendantIds.has(card.id))
          return { ...card, x: card.x + deltaX, y: card.y + deltaY }
        return card
      })

      nextCards = updateStackRelationship(nextCards, dragState.cardId, snapResult.parentCardId)
      return nextCards
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    setDraggingId(null)
  }

  return (
    <main className="playground">
      <header className="game-header">
        <h1 className="game-title">SOS团活动室</h1>
        <span className="game-subtitle">— 凉宫春日的奇妙冒险 —</span>
      </header>

      <div className="energy-regen-bar" aria-label="精力恢复进度">
        <div
          className="energy-regen-fill"
          style={{
            width: `${Math.min(((nowMs - energyRegenStartMs) / ENERGY_REGEN_INTERVAL_MS) * 100, 100)}%`,
          }}
        />
      </div>

      <section ref={boardRef} className="table" aria-label="SOS团活动室桌面">
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
              className={`card card-${card.accent}${isDragging ? ' is-dragging' : ''}${isSpawning ? ' is-spawning' : ''}`}
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
              aria-label={`${card.name} - ${card.kindLabel}`}
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

      <LogPanel logs={logs} />

      {ending ? <EndingModal type={ending} onReset={handleReset} /> : null}
    </main>
  )
}

export default App
