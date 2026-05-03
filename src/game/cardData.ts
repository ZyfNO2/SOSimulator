import cardKinds from '../data/CardKind.json'
import cardOutputs from '../data/CardOutput.json'
import type {
  CardDefinitionRecord,
  CardOutputRule,
  InitialTableCardRecord,
  OutputCardOverride,
  TableCard,
} from './types'
type RawCardOutputRuleRecord = {
  id: string
  durationMs: number
  event?: string
  inputDefinitionIds?: string[]
  allowedLevelIds?: ('main' | 'level-1' | 'level-2' | 'level-3' | 'level-4')[]
  requiresMissingDefinitionIds?: string[]
  outputDefinitionIds?: string[]
  consumeInputIndexes?: boolean[]
  allowUnorderedTail?: boolean
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

function normalizeDefinitionAccent(definition: CardDefinitionRecord): CardDefinitionRecord {
  switch (definition.kind) {
    case 'resource':
      return {
        ...definition,
        accent: 'resource',
      }
    case 'location':
      return {
        ...definition,
        accent: 'time',
      }
    case 'character':
      return {
        ...definition,
        accent: 'character',
      }
    case 'state':
    case 'ending':
    case 'event':
      return {
        ...definition,
        accent: 'event',
      }
    default:
      return definition
  }
}

function normalizeCardOutputRule(rule: RawCardOutputRuleRecord): CardOutputRule {
  const inputDefinitionIds = getRuleInputDefinitionIds(rule)

  return {
    id: rule.id,
    inputDefinitionIds,
    allowedLevelIds: rule.allowedLevelIds,
    requiresMissingDefinitionIds: rule.requiresMissingDefinitionIds,
    durationMs: rule.durationMs,
    event: rule.event ?? '',
    outputDefinitionIds: getRuleOutputDefinitionIds(rule),
    consumeInputIndexes: getRuleConsumeInputIndexes(rule, inputDefinitionIds),
    allowUnorderedTail: rule.allowUnorderedTail ?? false,
    outputCardOverrides: rule.outputCardOverrides,
  }
}

export const cardDefinitions = (cardKinds as CardDefinitionRecord[]).map(
  normalizeDefinitionAccent,
)

export const cardOutputRules = (cardOutputs as RawCardOutputRuleRecord[]).map(
  normalizeCardOutputRule,
)
export const cardDefinitionMap = new Map(cardDefinitions.map((card) => [card.id, card]))

export const initialTableCardKinds: InitialTableCardRecord[] = [
  {
    definitionId: 'haruhi-0',
    x: 200,
    y: 92,
  },
  {
    definitionId: 'shop',
    x: 700,
    y: 104,
  },
  {
    definitionId: 'weather-sunny',
    x: 858,
    y: 88,
  },
  {
    definitionId: 'energy',
    x: 24,
    y: 615,
    quantity: 2,
  },
  {
    definitionId: 'time',
    x: 164,
    y: 615,
    quantity: 2,
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
    isMother: false,
    isInteractionLocked: false,
    refillStartedAtMs: null,
    refillDurationMs: null,
  }
}

export const initialCards: TableCard[] = initialTableCardKinds
  .map((entry): TableCard | null => {
    const definition = cardDefinitionMap.get(entry.definitionId)

    if (!definition) {
      return null
    }

    return {
      ...createTableCardFromDefinition(
        definition,
        entry.definitionId,
        entry.x,
        entry.y,
      ),
      quantity: entry.quantity ?? 1,
      isMother: entry.definitionId === 'energy' || entry.definitionId === 'time',
    }
  })
  .filter((card): card is TableCard => card !== null)
