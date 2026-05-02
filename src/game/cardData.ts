import cardKinds from '../data/CardKind.json'
import cardOutputs from '../data/CardOutput.json'
import type {
  CardDefinitionRecord,
  CardOutputRule,
  InitialTableCardRecord,
  OutputCardOverride,
  TableCard,
} from './types'

export const cardDefinitions = cardKinds as CardDefinitionRecord[]
type RawCardOutputRuleRecord = {
  id: string
  durationMs: number
  event?: string
  inputDefinitionIds?: string[]
  outputDefinitionIds?: string[]
  consumeInputIndexes?: boolean[]
  outputCardOverrides?: OutputCardOverride[]
  parentDefinitionId?: string
  childDefinitionId?: string
  outputDefinitionId?: string | null
  consumeParent?: boolean
  consumeChild?: boolean
}

function getRuleInputDefinitionIds(rule: RawCardOutputRuleRecord) {
  if (rule.inputDefinitionIds && rule.inputDefinitionIds.length > 0) {
    return rule.inputDefinitionIds
  }

  if (rule.parentDefinitionId && rule.childDefinitionId) {
    return [rule.parentDefinitionId, rule.childDefinitionId]
  }

  return []
}

function getRuleOutputDefinitionIds(rule: RawCardOutputRuleRecord) {
  if (rule.outputDefinitionIds) {
    return rule.outputDefinitionIds
  }

  return typeof rule.outputDefinitionId === 'string' ? [rule.outputDefinitionId] : []
}

function getRuleConsumeInputIndexes(
  rule: RawCardOutputRuleRecord,
  inputDefinitionIds: string[],
) {
  if (rule.consumeInputIndexes && rule.consumeInputIndexes.length > 0) {
    return inputDefinitionIds.map((_, index) => rule.consumeInputIndexes?.[index] ?? false)
  }

  if (inputDefinitionIds.length === 2) {
    return [rule.consumeParent ?? false, rule.consumeChild ?? false]
  }

  return inputDefinitionIds.map(() => false)
}

function normalizeCardOutputRule(rule: RawCardOutputRuleRecord): CardOutputRule {
  const inputDefinitionIds = getRuleInputDefinitionIds(rule)

  return {
    id: rule.id,
    inputDefinitionIds,
    durationMs: rule.durationMs,
    event: rule.event ?? '',
    outputDefinitionIds: getRuleOutputDefinitionIds(rule),
    consumeInputIndexes: getRuleConsumeInputIndexes(rule, inputDefinitionIds),
    outputCardOverrides: rule.outputCardOverrides,
  }
}

export const cardOutputRules = (cardOutputs as RawCardOutputRuleRecord[]).map(
  normalizeCardOutputRule,
)
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
    decayAtMs?: number | null
    decayOutputDefinitionIds?: string[]
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
    quantity: 1,
    parentCardId: null,
    childCardId: null,
    spawnedAtMs: options?.spawnedAtMs,
    spawnOriginX: options?.spawnOriginX,
    spawnOriginY: options?.spawnOriginY,
    decayAtMs: options?.decayAtMs,
    decayOutputDefinitionIds: options?.decayOutputDefinitionIds,
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
