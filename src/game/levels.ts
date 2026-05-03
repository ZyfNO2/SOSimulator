import type { TableCard } from './types'
import { cardDefinitionMap, createTableCardFromDefinition } from './cardData'

export type LevelId = 'main' | 'level-1' | 'level-2' | 'level-3' | 'level-4'

export type LevelConfig = {
  id: LevelId
  name: string
  description: string
  isLocked: boolean
  initialCards: TableCard[]
}

function makeInitialCards(
  entries: { definitionId: string; x: number; y: number; quantity?: number; isMother?: boolean }[],
): TableCard[] {
  return entries
    .map((entry): TableCard | null => {
      const definition = cardDefinitionMap.get(entry.definitionId)
      if (!definition) return null
      return {
        ...createTableCardFromDefinition(
          definition,
          entry.definitionId,
          entry.x,
          entry.y,
        ),
        quantity: entry.quantity ?? 1,
        isMother: entry.isMother ?? false,
      }
    })
    .filter((card): card is TableCard => card !== null)
}

export const mainLevel: LevelConfig = {
  id: 'main',
  name: '失物招领室的神明',
  description: '一把无人认领的蓝伞，突然显得不再普通。',
  isLocked: false,
  initialCards: makeInitialCards([
    { definitionId: 'haruhi-0', x: 200, y: 92 },
    { definitionId: 'shop', x: 700, y: 104 },
    { definitionId: 'weather-sunny', x: 858, y: 88 },
    { definitionId: 'energy', x: 24, y: 615, quantity: 2, isMother: true },
    { definitionId: 'time', x: 164, y: 615, quantity: 2, isMother: true },
  ]),
}

export const level1: LevelConfig = {
  id: 'level-1',
  name: '成立SOS社吧',
  description: '团长宣言落地：把无聊校园改造成异常事件现场。',
  isLocked: false,
  initialCards: makeInitialCards([
    { definitionId: 'kyon', x: 360, y: 220 },
    { definitionId: 'haruhi', x: 540, y: 220 },
  ]),
}

export const level2: LevelConfig = {
  id: 'level-2',
  name: 'SOS社团再启动',
  description: '先搞到电脑，再用离谱企划把全校拖进SOS节奏。',
  isLocked: false,
  initialCards: makeInitialCards([
    { definitionId: 'kyon', x: 260, y: 220 },
    { definitionId: 'haruhi', x: 420, y: 220 },
    { definitionId: 'nagato', x: 580, y: 220 },
    { definitionId: 'asahina', x: 740, y: 220 },
    { definitionId: 'sos-activity-room-empty', x: 500, y: 72 },
  ]),
}

export const level3: LevelConfig = {
  id: 'level-3',
  name: '日常与忧郁之下是？',
  description: '真相一旦越线，春日会把日常直接推进终局。',
  isLocked: false,
  initialCards: makeInitialCards([
    { definitionId: 'haruhi', x: 300, y: 210 },
    { definitionId: 'kyon', x: 460, y: 210 },
    { definitionId: 'asahina', x: 620, y: 210 },
    { definitionId: 'nagato', x: 780, y: 210 },
    { definitionId: 'sos-activity-room', x: 520, y: 72 },
    { definitionId: 'transfer-student-rumor', x: 940, y: 210 },
  ]),
}

export const level4: LevelConfig = {
  id: 'level-4',
  name: '八月？',
  description: '同一段暑假不断重放。把既视感堆到阈值，才有资格结束循环。',
  isLocked: false,
  initialCards: makeInitialCards([
    { definitionId: 'haruhi', x: 240, y: 220 },
    { definitionId: 'kyon', x: 400, y: 220 },
    { definitionId: 'asahina', x: 560, y: 220 },
    { definitionId: 'nagato', x: 720, y: 220 },
    { definitionId: 'koizumi', x: 880, y: 220 },
    { definitionId: 'august-loop', x: 980, y: 72 },
  ]),
}

export const allLevels: LevelConfig[] = [mainLevel, level1, level2, level3, level4]

export function getLevelConfig(levelId: LevelId): LevelConfig {
  return allLevels.find((l) => l.id === levelId) ?? mainLevel
}
