import levelConfigData from '../data/LevelConfig.json'
import type { TableCard } from './types'
import {
  createTableCardFromDefinition,
  getCardDefinitionForLevel,
} from './cardData'

export type LevelId = 'main' | 'level-1' | 'level-2' | 'level-3' | 'level-4'

export type LevelConfig = {
  id: LevelId
  name: string
  description: string
  isLocked: boolean
  initialCards: TableCard[]
}

type RawInitialCardRecord = {
  definitionId: string
  x: number
  y: number
  quantity?: number
  isMother?: boolean
}

type RawLevelConfigRecord = {
  id: LevelId
  name: string
  description: string
  isLocked: boolean
  initialCards: RawInitialCardRecord[]
}

function makeInitialCards(
  levelId: LevelId,
  entries: RawInitialCardRecord[],
): TableCard[] {
  return entries
    .map((entry): TableCard | null => {
      const definition = getCardDefinitionForLevel(levelId, entry.definitionId)
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

const rawLevels = levelConfigData as RawLevelConfigRecord[]

export const allLevels: LevelConfig[] = rawLevels.map((level) => ({
  ...level,
  initialCards: makeInitialCards(level.id, level.initialCards),
}))

function requireLevel(levelId: LevelId): LevelConfig {
  const level = allLevels.find((candidate) => candidate.id === levelId)

  if (!level) {
    throw new Error(`Missing level config for ${levelId}`)
  }

  return level
}

export const mainLevel = requireLevel('main')
export const level1 = requireLevel('level-1')
export const level2 = requireLevel('level-2')
export const level3 = requireLevel('level-3')
export const level4 = requireLevel('level-4')

export function getLevelConfig(levelId: LevelId): LevelConfig {
  return allLevels.find((l) => l.id === levelId) ?? mainLevel
}
