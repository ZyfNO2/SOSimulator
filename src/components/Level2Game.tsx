import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './Level2Game.css'
import { ProductionEffect } from './ProductionEffect'
import type { LogEntry } from './LogPanel'
import { LogPanel } from './LogPanel'
import { EndingModal } from './EndingModal'
import { cardDefinitionMap } from '../game/cardData'
import {
  CARD_SPAWN_ANIMATION_MS,
  HARUHI_BOREDOM_MAX_MS,
  HARUHI_BOREDOM_TICK_MS,
  PRODUCTION_AUTO_REQUEUE_LEAD_MS,
  PRODUCTION_RING_SHRINK_MS,
} from '../game/constants'
import { createLevel2Config } from '../game/levelData'
import {
  consumeChildCard,
  getProductionAnchor,
  getProductionMatches,
  spawnOutputCard,
} from '../game/production'
import {
  bringCardToFront,
  clamp,
  clampCardPosition,
  detachCardFromParent,
  getCardZIndex,
  getDescendantIds,
  getSnappedCardPosition,
  updateStackRelationship,
} from '../game/stacking'
import type { DragState, ProductionRun, TableCard } from '../game/types'

interface Level2GameProps {
  onBackToMenu: () => void
}

const CHARACTER_DEF_IDS = ['haruhi', 'kyon', 'yuki', 'mikuru']
const CONVENIENCE_STORE_DEF_ID = 'convenience-store'

export function Level2Game({ onBackToMenu }: Level2GameProps) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const productionSequenceRef = useRef(0)
  const instanceSequenceRef = useRef(0)
  const logSequenceRef = useRef(0)
  const shakeTimeoutRef = useRef<number | null>(null)

  const levelConfig = useMemo(() => createLevel2Config(), [])

  const canProduceCheck = useCallback(
    (rule: { id?: string; outputDefinitionId?: string | null; outputPool?: string[] }, parentCard: TableCard, _child: TableCard, allCards: TableCard[]) => {
      // 电脑唯一性检测
      if (rule.outputDefinitionId === 'computer') {
        // 电子城需要累计4个日元才能产出电脑
        if (rule.id === 'level2-electronics-store-yen-computer') {
          const descendantIds = getDescendantIds(allCards, parentCard.id)
          const yenCount = Array.from(descendantIds).filter((id) =>
            allCards.some((c) => c.id === id && c.definitionId === 'yen')
          ).length
          return yenCount >= 4 && !allCards.some((c) => c.definitionId === 'computer')
        }
        return !allCards.some((c) => c.definitionId === 'computer')
      }
      // 日元产出无限制
      return true
    },
    [],
  )

  const [cards, setCards] = useState<TableCard[]>(levelConfig.initialCards)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [productions, setProductions] = useState<ProductionRun[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [shakingCardId, setShakingCardId] = useState<string | null>(null)
  const [haruhiBoredomMs, setHaruhiBoredomMs] = useState(0)
  const haruhiBoredomRef = useRef(0)
  const [ending, setEnding] = useState<'victory' | 'failure' | null>(null)
  const [electronicsStoreYenCount, setElectronicsStoreYenCount] = useState(0)

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
  }, [setLogs])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 16)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  // Haruhi boredom meter (same as level 1)
  useEffect(() => {
    if (ending) return

    const haruhiCard = cards.find((c) => c.definitionId === 'haruhi')
    if (!haruhiCard) return

    const isHaruhiBusy = productions.some(
      (run) =>
        run.status === 'active' &&
        (run.parentCardId === haruhiCard.id || run.childCardId === haruhiCard.id),
    )

    if (isHaruhiBusy) {
      if (haruhiBoredomRef.current > 0) {
        haruhiBoredomRef.current = 0
        setHaruhiBoredomMs(0)
      }
      return
    }

    const intervalId = window.setInterval(() => {
      haruhiBoredomRef.current += HARUHI_BOREDOM_TICK_MS
      setHaruhiBoredomMs(haruhiBoredomRef.current)

      if (haruhiBoredomRef.current >= HARUHI_BOREDOM_MAX_MS) {
        haruhiBoredomRef.current = 0
        setHaruhiBoredomMs(0)

        const closedSpaceDef = cardDefinitionMap.get('closed-space')
        if (closedSpaceDef) {
          instanceSequenceRef.current += 1
          const boardBounds = boardRef.current?.getBoundingClientRect()
          const boardW = boardBounds?.width ?? 1200
          const boardH = boardBounds?.height ?? 800
          const centerX = boardW / 2
          const centerY = boardH / 2
          const angle = Math.random() * Math.PI * 2
          const distance = 80 + Math.random() * 100
          const targetX = clamp(centerX - 59 + Math.cos(angle) * distance, 0, Math.max(boardW - 118, 0))
          const targetY = clamp(centerY - 78 + Math.sin(angle) * distance, 0, Math.max(boardH - 157, 0))

          const newCard = {
            id: `closed-space-${instanceSequenceRef.current}`,
            definitionId: closedSpaceDef.id,
            name: closedSpaceDef.name,
            kind: closedSpaceDef.kind,
            kindLabel: closedSpaceDef.kindLabel,
            note: closedSpaceDef.note,
            accent: closedSpaceDef.accent,
            x: targetX,
            y: targetY,
            parentCardId: null,
            childCardId: null,
            spawnedAtMs: Date.now(),
            spawnOriginX: centerX - 59,
            spawnOriginY: centerY - 78,
          }
          setCards((prev) => {
            const next = [...prev, newCard]
            addLog('凉宫春日感到忧郁……闭锁空间出现了！')
            const closedSpaceCount = next.filter((c) => c.definitionId === 'closed-space').length
            if (closedSpaceCount >= 6) {
              addLog('闭锁空间吞噬了一切……世界终结了。')
              setEnding('failure')
            }
            return next
          })
        }
      }
    }, HARUHI_BOREDOM_TICK_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [cards, productions, addLog, ending])

  // Victory condition: electronics store consumed 4 yen
  useEffect(() => {
    if (electronicsStoreYenCount >= 4 && !ending) {
      addLog('攒够了钱！SOS团获得了新电脑！')
      queueMicrotask(() => setEnding('victory'))
    }
  }, [electronicsStoreYenCount, ending, addLog])

  // Recipe detection
  useEffect(() => {
    const matches = getProductionMatches(cards, canProduceCheck)
    const matchMap = new Map(matches.map((match) => [match.pairKey, match]))

    queueMicrotask(() => {
      setProductions((currentRuns) => {
        const nextRuns = currentRuns.map((run) => {
          if (run.status === 'shrinking') return run
          if (run.runType && run.runType !== 'stack') return run
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

          const existingRun = nextRuns.find(
            (run) =>
              run.status === 'active' &&
              (!run.runType || run.runType === 'stack') &&
              run.parentCardId === match.parentCard.id &&
              run.ruleId === match.rule.id,
          )

          if (existingRun) {
            const updatedRun = {
              ...existingRun,
              pairKey: match.pairKey,
              childCardId: match.childCard.id,
            }
            const idx = nextRuns.findIndex((r) => r.id === existingRun.id)
            if (idx !== -1) nextRuns[idx] = updatedRun
            continue
          }

          productionSequenceRef.current += 1
          const newRun: ProductionRun = {
            id: `production-${productionSequenceRef.current}`,
            ruleId: match.rule.id,
            pairKey: match.pairKey,
            parentCardId: match.parentCard.id,
            childCardId: match.childCard.id,
            outputDefinitionId: match.rule.outputDefinitionId,
            outputPool: match.rule.outputPool,
            event: match.rule.event,
            durationMs: match.rule.durationMs,
            consumeChild: match.rule.consumeChild,
            startedAtMs: Date.now(),
            status: 'active',
            runType: 'stack',
          }
          nextRuns.push(newRun)

          const parentCard = cards.find((c) => c.id === match.parentCard.id)
          const childCard = cards.find((c) => c.id === match.childCard.id)
          if (parentCard && childCard) {
            addLog(`「${match.rule.event}」开始：${parentCard.customName ?? parentCard.name} + ${childCard.customName ?? childCard.name}`)
          }
        }

        return nextRuns
      })
    })
  }, [cards, addLog, canProduceCheck])

  // Production completion
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
      getProductionMatches(cards, canProduceCheck).map((match) => [match.pairKey, match]),
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
            outputPool: match.rule.outputPool,
            event: match.rule.event,
            durationMs: match.rule.durationMs,
            consumeChild: match.rule.consumeChild,
            startedAtMs: nowMs,
            status: 'active',
            runType: 'stack',
          })
        }

        return nextRuns
      })

      setCards((currentCards) => {
        let nextCards = currentCards

        for (const run of finishedRuns) {
          const parentCard = nextCards.find((c) => c.id === run.parentCardId)
          const parentName = parentCard?.customName ?? parentCard?.name ?? '???'

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
          const childName = childCard?.customName ?? childCard?.name ?? '???'
          let outputName = '新的卡牌'
          if (run.outputDefinitionId) {
            outputName = cardDefinitionMap.get(run.outputDefinitionId)?.name ?? '新的卡牌'
          }

          if (run.consumeChild) {
            addLog(
              `「${run.event}」完成：${parentName} + ${childName} → 消耗${childName}，获得${outputName}`,
            )
          } else {
            addLog(`「${run.event}」完成：${parentName} + ${childName} → 获得${outputName}`)
          }

          // Electronics store yen consumption: increment counter instead of spawning computer
          if (parentCard?.definitionId === 'electronics-store' && childCard?.definitionId === 'yen') {
            setElectronicsStoreYenCount((prev) => {
              const newCount = prev + 1
              addLog(`电子城已支付 ${newCount}/4 日元……`)
              return newCount
            })
          }

          // After part-time job finishes: detach child, mark as working (gray + non-interactive), spawn closed spaces for Haruhi
          if (parentCard?.definitionId === CONVENIENCE_STORE_DEF_ID && CHARACTER_DEF_IDS.includes(childCard?.definitionId ?? '')) {
            // Detach the character from the convenience store (pop it out)
            nextCards = nextCards.map((c) => {
              if (c.id === childCard?.id) {
                return { ...c, parentCardId: null, isWorking: true }
              }
              if (c.id === run.parentCardId) {
                return { ...c, childCardId: null }
              }
              return c
            })
            addLog(`${childCard?.customName ?? childCard?.name}打工结束了，累得动弹不得……`)

            // Haruhi special punishment: spawn 5 closed spaces after job ends
            if (childCard?.definitionId === 'haruhi') {
              addLog('凉宫春日打工完毕，但她的忧郁引发了异变！')
              const closedSpaceDef = cardDefinitionMap.get('closed-space')
              if (closedSpaceDef) {
                const boardBounds = boardRef.current?.getBoundingClientRect()
                const boardW = boardBounds?.width ?? 1200
                const boardH = boardBounds?.height ?? 800
                const centerX = boardW / 2
                const centerY = boardH / 2

                for (let i = 0; i < 2; i++) {
                  instanceSequenceRef.current += 1
                  const angle = (Math.PI * 2 * i) / 2 + Math.random() * 0.5
                  const distance = 80 + Math.random() * 120
                  const targetX = clamp(centerX - 59 + Math.cos(angle) * distance, 0, Math.max(boardW - 118, 0))
                  const targetY = clamp(centerY - 78 + Math.sin(angle) * distance, 0, Math.max(boardH - 157, 0))

                  const newClosedSpace = {
                    id: `closed-space-${instanceSequenceRef.current}`,
                    definitionId: closedSpaceDef.id,
                    name: closedSpaceDef.name,
                    kind: closedSpaceDef.kind,
                    kindLabel: closedSpaceDef.kindLabel,
                    note: closedSpaceDef.note,
                    accent: closedSpaceDef.accent,
                    x: targetX,
                    y: targetY,
                    parentCardId: null,
                    childCardId: null,
                    spawnedAtMs: Date.now(),
                    spawnOriginX: centerX - 59,
                    spawnOriginY: centerY - 78,
                  }
                  nextCards = [...nextCards, newClosedSpace]
                }
                addLog('2个闭锁空间同时出现了！')

                const closedSpaceCount = nextCards.filter((c) => c.definitionId === 'closed-space').length
                if (closedSpaceCount >= 6) {
                  addLog('闭锁空间吞噬了一切……世界终结了。')
                  queueMicrotask(() => setEnding('failure'))
                }
              }
            }
          }
        }

        return nextCards
      })
    })
  }, [cards, nowMs, productions, addLog, canProduceCheck])

  const triggerShake = useCallback((cardId: string) => {
    if (shakeTimeoutRef.current) {
      window.clearTimeout(shakeTimeoutRef.current)
    }
    setShakingCardId(cardId)
    shakeTimeoutRef.current = window.setTimeout(() => {
      setShakingCardId(null)
    }, 400)
  }, [setShakingCardId])

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    const card = cards.find((c) => c.id === cardId)
    if (card?.isWorking) {
      triggerShake(cardId)
      addLog(`${card.customName ?? card.name}正在打工，无法行动。`)
      return
    }

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

      if (snapResult.parentCardId) {
        const parentCard = currentCards.find((c) => c.id === snapResult.parentCardId)
        if (parentCard) {
          // Reject if target is working
          if (parentCard.isWorking) {
            const descendantIds = getDescendantIds(currentCards, dragState.cardId)
            const deltaX = nextPosition.x - movingCard.x
            const deltaY = nextPosition.y - movingCard.y
            return currentCards.map((card) => {
              if (card.id === dragState.cardId) return { ...card, x: nextPosition.x, y: nextPosition.y }
              if (descendantIds.has(card.id))
                return { ...card, x: card.x + deltaX, y: card.y + deltaY }
              return card
            })
          }

          const testCards = currentCards.map((c) => {
            if (c.id === movingCard.id) return { ...c, parentCardId: parentCard.id }
            if (c.id === parentCard.id) return { ...c, childCardId: movingCard.id }
            return c
          })

          const matches = getProductionMatches(testCards, canProduceCheck)
          const isValidMatch = matches.some(
            (m) => m.parentCard.id === parentCard.id && m.childCard.id === movingCard.id,
          )

          if (!isValidMatch) {
            const descendantIds = getDescendantIds(currentCards, dragState.cardId)
            const deltaX = nextPosition.x - movingCard.x
            const deltaY = nextPosition.y - movingCard.y

            return currentCards.map((card) => {
              if (card.id === dragState.cardId) return { ...card, x: nextPosition.x, y: nextPosition.y }
              if (descendantIds.has(card.id))
                return { ...card, x: card.x + deltaX, y: card.y + deltaY }
              return card
            })
          }
        }
      }

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
        <h1 className="game-title">关卡2：电脑的获取</h1>
        <button type="button" className="back-btn" onClick={onBackToMenu}>
          返回
        </button>
      </header>

      <div className="level-hint">
        <p>
          提示：把凉宫拖入电脑研究部获得把柄，或把角色拖入便利店打工赚日元。4个日元可在电子城换电脑。
        </p>
      </div>

      {/* Haruhi boredom meter */}
      <div className="haruhi-boredom-bar">
        <span className="boredom-label">凉宫的忧郁度</span>
        <div className="boredom-track">
          <div
            className="boredom-fill"
            style={{ width: `${Math.min((haruhiBoredomMs / HARUHI_BOREDOM_MAX_MS) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Electronics store yen counter */}
      <div className="electronics-store-counter">
        <span className="counter-label">电子城存款</span>
        <span className="counter-value">{electronicsStoreYenCount} / 4 日元</span>
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
          const isShaking = shakingCardId === card.id
          const isWorking = card.isWorking
          const displayName = card.customName ?? card.name
          const displayNote = card.customNote ?? card.note
          const displayAccent = card.customAccent ?? card.accent

          return (
            <button
              key={card.id}
              type="button"
              className={`card card-${displayAccent}${isDragging ? ' is-dragging' : ''}${isSpawning ? ' is-spawning' : ''}${isShaking ? ' is-shaking' : ''}${isWorking ? ' is-working' : ''}`}
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
              aria-label={`${displayName} - ${card.kindLabel}`}
            >
              <strong className="card-name">{displayName}</strong>
              <span className="card-kind-band">
                <span className="card-kind">{card.kindLabel}</span>
              </span>
              <span className="card-note">{displayNote}</span>
            </button>
          )
        })}
      </section>

      <LogPanel logs={logs} />

      {ending === 'failure' && (
        <EndingModal
          type="failure"
          onReset={() => {
            setCards(levelConfig.initialCards)
            setProductions([])
            setNowMs(Date.now())
            setDraggingId(null)
            setLogs([])
            setShakingCardId(null)
            setHaruhiBoredomMs(0)
            haruhiBoredomRef.current = 0
            setElectronicsStoreYenCount(0)
            setEnding(null)
            productionSequenceRef.current = 0
            instanceSequenceRef.current = 0
            logSequenceRef.current = 0
          }}
          customMessages={{
            failure: {
              title: '世界被闭锁空间吞噬',
              body: '闭锁空间不断扩张，灰色的雾气吞没了社团活动室。\n\n凉宫春日的忧郁失控了。也许下一次，会出现一个更美好的世界吧。',
            },
          }}
        />
      )}

      {ending === 'victory' && (
        <EndingModal
          type="victory"
          onReset={() => {
            setCards(levelConfig.initialCards)
            setProductions([])
            setNowMs(Date.now())
            setDraggingId(null)
            setLogs([])
            setShakingCardId(null)
            setHaruhiBoredomMs(0)
            haruhiBoredomRef.current = 0
            setElectronicsStoreYenCount(0)
            setEnding(null)
            productionSequenceRef.current = 0
            instanceSequenceRef.current = 0
            logSequenceRef.current = 0
          }}
          customMessages={{
            victory: {
              title: 'SOS团获得了新电脑！',
              body: '无论是通过非正常手段还是辛苦打工，SOS团终于拥有了自己的电脑！\n\n「好，那就开始我们今天的社团活动吧！」\n\n凉宫春日露出了满意的笑容。',
            },
          }}
        />
      )}
    </main>
  )
}
