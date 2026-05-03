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
  name: '成立SOS社吧',
  description: '从阿虚和春日开始，把校园地点一口气摸透。',
  isLocked: false,
  initialCards: makeInitialCards([
    { definitionId: 'kyon', x: 360, y: 220 },
    { definitionId: 'haruhi', x: 540, y: 220 },
  ]),
}

export const level2: LevelConfig = {
  id: 'level-2',
  name: 'SOS社团再启动',
  description: '四位社员已就位，先从空空如也的活动室起步。',
  isLocked: false,
  initialCards: makeInitialCards([
    { definitionId: 'kyon', x: 260, y: 220 },
    { definitionId: 'haruhi', x: 420, y: 220 },
    { definitionId: 'nagato', x: 580, y: 220 },
    { definitionId: 'asahina', x: 740, y: 220 },
    { definitionId: 'sos-activity-room-empty', x: 500, y: 72 },
  ]),
}

export const allLevels: LevelConfig[] = [mainLevel, level1, level2]

export function getLevelConfig(levelId: LevelId): LevelConfig {
  return allLevels.find((l) => l.id === levelId) ?? mainLevel
}
