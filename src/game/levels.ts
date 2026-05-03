import type { TableCard } from './types'
import { cardDefinitionMap, createTableCardFromDefinition } from './cardData'

export type LevelId = 'main' | 'level-1' | 'level-2'

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
  name: 'SOS团的日常',
  description: '阿虚与春日的奇妙组合。',
  isLocked: false,
  initialCards: makeInitialCards([
    { definitionId: 'kyon', x: 300, y: 200 },
    { definitionId: 'haruhi', x: 500, y: 200 },
  ]),
}

export const level2: LevelConfig = {
  id: 'level-2',
  name: '未解锁的篇章',
  description: '更多故事，即将展开...',
  isLocked: false,
  initialCards: makeInitialCards([]),
}

export const allLevels: LevelConfig[] = [mainLevel, level1, level2]

export function getLevelConfig(levelId: LevelId): LevelConfig {
  return allLevels.find((l) => l.id === levelId) ?? mainLevel
}
