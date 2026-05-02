import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './Level1Game.css'
import { ProductionEffect } from './ProductionEffect'
import type { LogEntry } from './LogPanel'
import { LogPanel } from './LogPanel'
import { EndingModal } from './EndingModal'
import { cardDefinitionMap } from '../game/cardData'
import {
  CARD_SPAWN_ANIMATION_MS,
  HARUHI_BOREDOM_MAX_MS,
  HARUHI_BOREDOM_TICK_MS,
  LOCATION_SELF_DESTRUCT_MS,
  PRODUCTION_AUTO_REQUEUE_LEAD_MS,
  PRODUCTION_RING_SHRINK_MS,
} from '../game/constants'
import { createLevel1Config } from '../game/levelData'
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

interface Level1GameProps {
  onBackToMenu: () => void
}

const ALL_LOCATION_DEF_IDS = [
  'location-literature',
  'location-classroom-2',
  'location-playground',
  'location-classroom-1',
  'location-cafeteria',
  'location-library',
  'location-gate',
  'location-rooftop',
  'location-music-room',
  'location-infirmary',
  'location-computer-room',
  'location-gym',
  'location-pool',
  'location-shoe-locker',
]

const SOS_MEMBER_DEF_IDS = ['haruhi', 'kyon', 'yuki', 'mikuru']

/** 所有可通过地点探索产出的人物定义ID（去重检测用） */
const ALL_CHARACTER_DEF_IDS = [
  'yuki',
  'mikuru',
  'npc-taniguchi',
  'npc-kunikida',
  'npc-tsuruya',
  'npc-ryouko',
  'npc-shamisen',
  'npc-computer-club',
]

export function Level1Game({ onBackToMenu }: Level1GameProps) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const productionSequenceRef = useRef(0)
  const instanceSequenceRef = useRef(0)
  const logSequenceRef = useRef(0)
  const shakeTimeoutRef = useRef<number | null>(null)

  const levelConfig = useMemo(() => createLevel1Config(), [])

  const canProduceCheck = useCallback(
    (rule: { outputDefinitionId?: string | null; outputPool?: string[]; consumeParent?: boolean }, _parent: TableCard, _child: TableCard, _allCards: TableCard[]) => {
      // SOS宣言唯一性检测
      if (rule.outputDefinitionId === 'sos-declaration') {
        return !spawnedCharactersRef.current.has('sos-declaration') && !_allCards.some((c) => c.definitionId === 'sos-declaration')
      }

      // 校园探索：检测是否还有未产出的地点和可产出的人物
      if (rule.outputPool && rule.outputPool.some((id) => ALL_LOCATION_DEF_IDS.includes(id))) {
        const availableLocations = rule.outputPool.filter(
          (id) => !spawnedLocationsRef.current.has(id),
        )
        // 地点池空了就不探索了
        if (availableLocations.length === 0) return false
        // 检测是否还有可产出的人物（人物池空了就不再需要地点）
        const hasAvailableCharacters = ALL_CHARACTER_DEF_IDS.some(
          (id) => !spawnedCharactersRef.current.has(id),
        )
        return hasAvailableCharacters
      }

      // 地点产出人物：检测人物是否已产出（不能重复产出）
      if (rule.consumeParent && rule.outputDefinitionId) {
        if (spawnedCharactersRef.current.has(rule.outputDefinitionId)) return false
      }
      if (rule.consumeParent && rule.outputPool) {
        const availablePool = rule.outputPool.filter(
          (id) => !spawnedCharactersRef.current.has(id),
        )
        if (availablePool.length === 0) return false
      }

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
  const [haruhiUnlocked, setHaruhiUnlocked] = useState(false)
  const [phase, setPhase] = useState<'intro' | 'spawner' | 'done'>('intro')
  const [haruhiBoredomMs, setHaruhiBoredomMs] = useState(0)
  const haruhiBoredomRef = useRef(0)
  const [ending, setEnding] = useState<'victory' | 'failure' | null>(null)
  const spawnedLocationsRef = useRef<Set<string>>(new Set())
  const locationTimersRef = useRef<Map<string, number>>(new Map())
  /** 已产出的人物 definitionId（防止重复产出，人物消失后移除） */
  const spawnedCharactersRef = useRef<Set<string>>(new Set())

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

  // Location self-destruct timer
  useEffect(() => {
    const timers = locationTimersRef.current
    const toRemove: string[] = []

    for (const [cardId, spawnedAtMs] of timers) {
      const card = cards.find((c) => c.id === cardId)
      if (!card) continue
      // Skip if the location has a child (character placed inside)
      if (card.childCardId) continue
      if (nowMs - spawnedAtMs >= LOCATION_SELF_DESTRUCT_MS) {
        toRemove.push(cardId)
      }
    }

    if (toRemove.length > 0) {
      queueMicrotask(() => {
        setCards((prev) => {
          for (const cardId of toRemove) {
            const card = prev.find((c) => c.id === cardId)
            if (card) {
              addLog(`${card.customName ?? card.name}消失了……`)
              spawnedLocationsRef.current.delete(card.definitionId)
              // 如果消失的是人物卡，从人物产出池中移除，允许重新产出
              if (ALL_CHARACTER_DEF_IDS.includes(card.definitionId)) {
                spawnedCharactersRef.current.delete(card.definitionId)
              }
            }
          }
          return prev.filter((c) => !toRemove.includes(c.id))
        })
        for (const cardId of toRemove) {
          timers.delete(cardId)
        }
      })
    }
  }, [nowMs, cards, addLog])

  // Haruhi boredom meter
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

  // Check SOS room victory condition
  useEffect(() => {
    const sosRoom = cards.find((c) => c.isSOSRoom)
    if (!sosRoom || ending) return

    // Collect all descendant definitionIds in the SOS room chain
    const memberIds = new Set<string>()
    let currentId = sosRoom.childCardId
    while (currentId) {
      const card = cards.find((c) => c.id === currentId)
      if (!card) break
      memberIds.add(card.definitionId)
      currentId = card.childCardId
    }

    // Check if all SOS members are present
    const allMembersPresent = SOS_MEMBER_DEF_IDS.every((id) => memberIds.has(id))
    if (allMembersPresent) {
      addLog('SOS团全员集结！社团活动正式开始！')
      queueMicrotask(() => setEnding('victory'))
    }
  }, [cards, ending, addLog])

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

          // 记录消耗前的人物卡，用于后续从产出池中移除
          const childBefore = nextCards.find((c) => c.id === run.childCardId)
          const parentBefore = nextCards.find((c) => c.id === run.parentCardId)

          nextCards = consumeChildCard(nextCards, run)

          // 如果被消耗的是人物卡，从产出池中移除
          if (run.consumeChild && childBefore && ALL_CHARACTER_DEF_IDS.includes(childBefore.definitionId)) {
            spawnedCharactersRef.current.delete(childBefore.definitionId)
          }
          if (run.consumeParent && parentBefore && ALL_CHARACTER_DEF_IDS.includes(parentBefore.definitionId)) {
            spawnedCharactersRef.current.delete(parentBefore.definitionId)
          }

          const anchor = getProductionAnchor(nextCards, run)

          nextCards = spawnOutputCard(
            nextCards,
            run,
            anchor.centerX,
            anchor.centerY,
            boardWidth,
            boardHeight,
            instanceSequenceRef,
            run.outputPool,
            spawnedLocationsRef.current,
          )

          const childCard = currentCards.find((c) => c.id === run.childCardId)
          const childName = childCard?.customName ?? childCard?.name ?? '???'
          let outputName = '新的卡牌'
          if (run.outputDefinitionId) {
            outputName = cardDefinitionMap.get(run.outputDefinitionId)?.name ?? '新的卡牌'
          } else if (run.outputPool && run.outputPool.length > 0) {
            outputName = '随机卡牌'
          }

          if (run.consumeChild && run.consumeParent) {
            addLog(
              `「${run.event}」完成：${parentName} + ${childName} → 消耗${parentName}和${childName}，获得${outputName}`,
            )
          } else if (run.consumeChild) {
            addLog(
              `「${run.event}」完成：${parentName} + ${childName} → 消耗${childName}，获得${outputName}`,
            )
          } else if (run.consumeParent) {
            addLog(
              `「${run.event}」完成：${parentName} + ${childName} → 消耗${parentName}，获得${outputName}`,
            )
          } else {
            addLog(`「${run.event}」完成：${parentName} + ${childName} → 获得${outputName}`)
          }

          if (run.outputDefinitionId === 'sos-declaration') {
            addLog('SOS团正式成立！凉宫春日似乎有了什么想法……')
            setHaruhiUnlocked(true)
          }

          if (run.outputDefinitionId === 'sos-thought') {
            addLog('凉宫春日的思绪化作实体……校园探索开始了！')
            setPhase('spawner')
            const spawnerDef = cardDefinitionMap.get('location-spawner')
            if (spawnerDef) {
              instanceSequenceRef.current += 1
              const spawnerCard = {
                id: `location-spawner-${instanceSequenceRef.current}`,
                definitionId: spawnerDef.id,
                name: spawnerDef.name,
                kind: spawnerDef.kind,
                kindLabel: spawnerDef.kindLabel,
                note: spawnerDef.note,
                accent: spawnerDef.accent,
                x: 20,
                y: 80,
                parentCardId: null,
                childCardId: null,
                spawnedAtMs: Date.now(),
                spawnOriginX: 20,
                spawnOriginY: 80,
              }
              nextCards = [...nextCards, spawnerCard]
              addLog('校园探索卡出现了！把人物拖进去探索校园吧！')
            }
          }

          // Transform literature room to SOS room after spawning Yuki
          if (run.outputDefinitionId === 'yuki') {
            const literatureRoom = nextCards.find(
              (c) => c.definitionId === 'location-literature' && c.id === run.parentCardId,
            )
            if (literatureRoom) {
              nextCards = nextCards.map((c) =>
                c.id === literatureRoom.id
                  ? {
                      ...c,
                      isSOSRoom: true,
                      customName: 'SOS活动室',
                      customNote: 'SOS团的正式据点。全员集结之时，就是社团活动开始之日！',
                      customAccent: 'sos-room',
                    }
                  : c,
              )
              addLog('文艺社活动室变成了SOS活动室！')
            }
          }

          // Track spawned locations for deduplication
          if (run.outputPool && run.outputPool.some((id) => ALL_LOCATION_DEF_IDS.includes(id))) {
            const spawnedCard = nextCards[nextCards.length - 1]
            if (spawnedCard && ALL_LOCATION_DEF_IDS.includes(spawnedCard.definitionId)) {
              spawnedLocationsRef.current.add(spawnedCard.definitionId)
              locationTimersRef.current.set(spawnedCard.id, Date.now())
            }
          }

          // Track spawned characters for deduplication
          if (run.outputDefinitionId && ALL_CHARACTER_DEF_IDS.includes(run.outputDefinitionId)) {
            spawnedCharactersRef.current.add(run.outputDefinitionId)
          }
          if (run.outputPool) {
            const spawnedChar = nextCards[nextCards.length - 1]
            if (spawnedChar && ALL_CHARACTER_DEF_IDS.includes(spawnedChar.definitionId)) {
              spawnedCharactersRef.current.add(spawnedChar.definitionId)
            }
          }

          // If parent (location) was consumed, remove it from tracking
          if (run.consumeParent) {
            const consumedParent = currentCards.find((c) => c.id === run.parentCardId)
            if (consumedParent) {
              spawnedLocationsRef.current.delete(consumedParent.definitionId)
              locationTimersRef.current.delete(consumedParent.id)
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
    const isHaruhi = levelConfig.immovableCardIds.includes(cardId)
    if (isHaruhi && !haruhiUnlocked) {
      triggerShake(cardId)
      addLog('凉宫春日还没有发言')
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
          // Build test cards: for SOS room, attach to end of chain
          let testCards = currentCards.map((c) => {
            if (c.id === movingCard.id) return { ...c, parentCardId: parentCard.id }
            if (c.id === parentCard.id) return { ...c, childCardId: movingCard.id }
            return c
          })

          // For SOS room with existing child, simulate chain attachment
          if (parentCard.isSOSRoom && parentCard.childCardId && parentCard.childCardId !== movingCard.id) {
            let lastMemberId = parentCard.childCardId
            let lastMember = currentCards.find((c) => c.id === lastMemberId)
            while (lastMember?.childCardId) {
              lastMemberId = lastMember.childCardId
              lastMember = currentCards.find((c) => c.id === lastMemberId)
            }
            testCards = testCards.map((c) => {
              if (c.id === movingCard.id) return { ...c, parentCardId: lastMemberId }
              if (c.id === lastMemberId) return { ...c, childCardId: movingCard.id }
              return c
            })
          }

          const matches = getProductionMatches(testCards, canProduceCheck)
          const isValidMatch = matches.some(
            (m) => {
              // For SOS room, check if the moving card is part of the match
              if (parentCard.isSOSRoom) {
                return m.parentCard.id === parentCard.id && m.childCard.id === movingCard.id
              }
              return m.parentCard.id === parentCard.id && m.childCard.id === movingCard.id
            },
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
        <h1 className="game-title">关卡1：团长的召唤</h1>
        <button type="button" className="back-btn" onClick={onBackToMenu}>
          返回
        </button>
      </header>

      <div className="level-hint">
        <p>
          {phase === 'intro' && (haruhiUnlocked
            ? '凉宫春日已觉醒！将她拖入SOS团成立宣言，获得SOS（思绪）'
            : '提示：将阿虚拖入凉宫春日，触发SOS团成立！')}
          {phase === 'spawner' && '校园探索开始了！把人物拖入校园探索卡，发现地点吧！'}
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
          const isHaruhiLocked = levelConfig.immovableCardIds.includes(card.id) && !haruhiUnlocked
          const isShaking = shakingCardId === card.id
          const displayName = card.customName ?? card.name
          const displayNote = card.customNote ?? card.note
          const displayAccent = card.customAccent ?? card.accent

          return (
            <button
              key={card.id}
              type="button"
              className={`card card-${displayAccent}${isDragging ? ' is-dragging' : ''}${isSpawning ? ' is-spawning' : ''}${isHaruhiLocked ? ' is-immovable' : ''}${isShaking ? ' is-shaking' : ''}`}
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
            setHaruhiUnlocked(false)
            setPhase('intro')
            setHaruhiBoredomMs(0)
            haruhiBoredomRef.current = 0
            setEnding(null)
            spawnedLocationsRef.current.clear()
            spawnedCharactersRef.current.clear()
            locationTimersRef.current.clear()
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
            setHaruhiUnlocked(false)
            setPhase('intro')
            setHaruhiBoredomMs(0)
            haruhiBoredomRef.current = 0
            setEnding(null)
            spawnedLocationsRef.current.clear()
            locationTimersRef.current.clear()
            productionSequenceRef.current = 0
            instanceSequenceRef.current = 0
            logSequenceRef.current = 0
          }}
          customMessages={{
            victory: {
              title: 'SOS团全员集结！',
              body: '凉宫春日、阿虚、长门有希、朝比奈实玖瑠——SOS团全员到齐！\n\n「好，那就开始我们今天的社团活动吧！」\n\n凉宫春日露出了满意的笑容。',
            },
          }}
        />
      )}
    </main>
  )
}
