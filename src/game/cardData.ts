import cardKinds from '../data/CardKind.json'
import cardOutputs from '../data/CardOutput.json'
import type {
  CardDefinitionRecord,
  CardOutputRule,
  InitialTableCardRecord,
  TableCard,
} from './types'

export const cardDefinitions = cardKinds as CardDefinitionRecord[]
export const cardOutputRules = cardOutputs as CardOutputRule[]
export const cardDefinitionMap = new Map(cardDefinitions.map((card) => [card.id, card]))

export const initialTableCardKinds: InitialTableCardRecord[] = [
  { definitionId: 'haruhi', x: 60, y: 80 },
  { definitionId: 'kyon', x: 210, y: 120 },
  { definitionId: 'yuki', x: 370, y: 80 },
  { definitionId: 'mikuru', x: 530, y: 110 },
  { definitionId: 'itsuki', x: 690, y: 80 },
  { definitionId: 'energy', x: 840, y: 100 },
  { definitionId: 'energy', x: 840, y: 280 },
  { definitionId: 'movie-script', x: 60, y: 280 },
]

export function createTableCardFromDefinition(
  definition: CardDefinitionRecord,
  instanceId: string,
  x: number,
  y: number,
  options?: {
    spawnedAtMs?: number
    spawnOriginX?: number
    spawnOriginY?: number
  },
): TableCard {
  return {
    id: instanceId,
    definitionId: definition.id,
    name: definition.name,
    kind: definition.kind,
    kindLabel: definition.kindLabel,
    note: definition.note,
    accent: definition.accent,
    x,
    y,
    parentCardId: null,
    childCardId: null,
    spawnedAtMs: options?.spawnedAtMs,
    spawnOriginX: options?.spawnOriginX,
    spawnOriginY: options?.spawnOriginY,
  }
}

export const initialCards: TableCard[] = initialTableCardKinds
  .map((entry, index) => {
    const definition = cardDefinitionMap.get(entry.definitionId)

    if (!definition) {
      return null
    }

    return createTableCardFromDefinition(
      definition,
      `${entry.definitionId}-${index}`,
      entry.x,
      entry.y,
    )
  })
  .filter((card): card is TableCard => card !== null)
