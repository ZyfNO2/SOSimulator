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
  {
    definitionId: 'energy',
    x: 80,
    y: 92,
  },
  {
    definitionId: 'time',
    x: 220,
    y: 82,
  },
  {
    definitionId: 'poor-clue',
    x: 286,
    y: 146,
  },
  {
    definitionId: 'daily-work',
    x: 492,
    y: 108,
  },
  {
    definitionId: 'event-card',
    x: 660,
    y: 110,
  },
  {
    definitionId: 'money',
    x: 838,
    y: 92,
  },
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
  .map((entry) => {
    const definition = cardDefinitionMap.get(entry.definitionId)

    if (!definition) {
      return null
    }

    return createTableCardFromDefinition(
      definition,
      entry.definitionId,
      entry.x,
      entry.y,
    )
  })
  .filter((card): card is TableCard => card !== null)
