import { useEffect, useMemo, useRef, useState } from 'react'
import backTextData from '../data/Back_text.json'
import type { TableCard } from '../game/types'

type BackgroundTextStage = {
  Conditions: string
  max_txt_num?: number
  Slide_txt: string[]
}

type BackgroundTextData = Record<string, BackgroundTextStage>

type StoryState = {
  chapter: 'umbrella' | 'testimony' | 'missing-owner' | 'final-rain'
  obsessionLevel: number
  distortionLevel: number
  unlockedDefinitionIds: string[]
}

type SlotState = {
  text: string
  fontSize: number
  top: number
  left: number
  rotation: number
  runId: number
}

const SLOT_COUNT = 6
const CHARACTER_DELAY_MS = 200
const CHARACTER_ANIMATION_MS = 1600
const SLOT_GAP_MS = 250

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

function getRandomInt(min: number, max: number) {
  const start = Math.ceil(min)
  const end = Math.floor(max)

  return Math.floor(Math.random() * (end - start + 1)) + start
}

function createInitialSlotState(): SlotState {
  return {
    text: '',
    fontSize: 14,
    top: 50,
    left: 50,
    rotation: 0,
    runId: 0,
  }
}

function isSosQuoteMode(cards: TableCard[]) {
  const definitionIdSet = new Set(cards.map((card) => card.definitionId))
  const hasSosCoreMembers =
    definitionIdSet.has('kyon') && definitionIdSet.has('haruhi')
  const isSecondChapterStart = definitionIdSet.has('sos-activity-room-empty')

  return hasSosCoreMembers && !isSecondChapterStart
}

function getSosQuoteTexts() {
  return [
    '我对普通的人类没有兴趣。',
    '你们当中要是有外星人，',
    '未来人，',
    '异世界人，',
    '超能力者的话，',
    '就尽管来找我吧。',
    '普通的人类',
    '外星人',
    '未来人',
    '异世界人',
    '超能力者',
    '凉宫春日',
  ]
}

function getStoryTexts(storyState: StoryState, cards: TableCard[]) {
  if (isSosQuoteMode(cards)) {
    return getSosQuoteTexts()
  }

  const chapterTexts: Record<StoryState['chapter'], string[]> = {
    umbrella: ['只是失物。', '她停下来看了第二眼。'],
    testimony: ['传闻开始自己互相证明。', '每个人都记得一点点。'],
    'missing-owner': ['失主开始像真的存在。', '世界在给空白补名字。'],
    'final-rain': ['这场雨在等一个结尾。', '放学时刻被拖得太长了。'],
  }

  const obsessionTexts =
    storyState.obsessionLevel > 0
      ? ['这把伞不该被丢下。', '她越相信，世界越像在附和。']
      : []
  const distortionTexts =
    storyState.distortionLevel > 0
      ? ['答案不是被找到的。', '世界开始自动补证。']
      : []

  return [...chapterTexts[storyState.chapter], ...obsessionTexts, ...distortionTexts]
}

function getActiveBackgroundConfig(cards: TableCard[], storyState: StoryState) {
  const stageMap = backTextData as BackgroundTextData
  const availableKeys = new Set(
    cards.flatMap((card) => [normalizeValue(card.definitionId), normalizeValue(card.name)]),
  )
  const activeStages = Object.values(stageMap).filter((stage) =>
    availableKeys.has(normalizeValue(stage.Conditions)),
  )

  const activeTexts = activeStages.flatMap((stage) =>
    stage.Slide_txt.filter((entry) => entry.trim().length > 0),
  )
  const activeMaxValues = activeStages
    .map((stage) => stage.max_txt_num)
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value) && value > 0,
    )

  return {
    activeTexts: [...activeTexts, ...getStoryTexts(storyState, cards)],
    maxVisibleLines:
      activeMaxValues.length > 0 ? Math.min(...activeMaxValues, SLOT_COUNT) : SLOT_COUNT,
  }
}

function BackgroundSlideTextSlot({
  activeTexts,
  activeTextKey,
  slotIndex,
}: {
  activeTexts: string[]
  activeTextKey: string
  slotIndex: number
}) {
  const [slot, setSlot] = useState<SlotState>(() => createInitialSlotState())
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (activeTexts.length === 0) {
      setSlot(createInitialSlotState())
      return undefined
    }

    let disposed = false

    const scheduleNext = (delayMs: number) => {
      timeoutRef.current = window.setTimeout(() => {
        if (disposed) {
          return
        }

        const text = activeTexts[getRandomInt(0, activeTexts.length - 1)]
        const durationMs =
          Math.max(text.length - 1, 0) * CHARACTER_DELAY_MS +
          CHARACTER_ANIMATION_MS +
          SLOT_GAP_MS

        setSlot((current) => ({
          text,
          fontSize: getRandomInt(10, 22),
          top: getRandomInt(3, 99),
          left: getRandomInt(3, 99),
          rotation: getRandomInt(-90, 90),
          runId: current.runId + 1,
        }))

        scheduleNext(durationMs)
      }, delayMs)
    }

    scheduleNext(slotIndex * 500)

    return () => {
      disposed = true

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [activeTextKey, slotIndex])

  if (!slot.text) {
    return null
  }

  return (
    <div
      className="background-slide-text"
      style={{
        fontSize: `${slot.fontSize}px`,
        top: `${slot.top}%`,
        left: `${slot.left}%`,
        transform: `rotate(${slot.rotation}deg)`,
      }}
    >
      {slot.text.split('').map((char, index) => (
        <span
          key={`${slot.runId}-${index}-${char}`}
          className="background-slide-char"
          style={{
            animationDelay: `${(index * CHARACTER_DELAY_MS) / 1000}s`,
            animationDuration: `${CHARACTER_ANIMATION_MS / 1000}s`,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  )
}

export function BackgroundSlideText({
  cards,
  storyState,
}: {
  cards: TableCard[]
  storyState: StoryState
}) {
  const { activeTexts, maxVisibleLines } = useMemo(
    () => getActiveBackgroundConfig(cards, storyState),
    [cards, storyState],
  )
  const activeTextKey = useMemo(() => activeTexts.join('\u0000'), [activeTexts])

  return (
    <div className="background-slide-layer" aria-hidden="true">
      {Array.from({ length: maxVisibleLines }, (_, slotIndex) => (
        <BackgroundSlideTextSlot
          key={slotIndex}
          activeTexts={activeTexts}
          activeTextKey={activeTextKey}
          slotIndex={slotIndex}
        />
      ))}
    </div>
  )
}
