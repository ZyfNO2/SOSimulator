export type TableCard = {
  id: string
  definitionId: string
  name: string
  kind: string
  kindLabel: string
  note: string
  accent: string
  x: number
  y: number
  quantity?: number
  parentCardId: string | null
  childCardId: string | null
  spawnedAtMs?: number
  spawnOriginX?: number
  spawnOriginY?: number
  decayAtMs?: number | null
  decayOutputDefinitionIds?: string[]
  isMother?: boolean
  refillStartedAtMs?: number | null
}

export type DragState = {
  cardId: string
  stackCardIds: string[]
  pointerId: number
  button: number
  offsetX: number
  offsetY: number
  startClientX: number
  startClientY: number
  source?: 'board' | 'tray' | 'mother'
}

export type CardDefinitionRecord = {
  id: string
  name: string
  kind: string
  kindLabel: string
  note: string
  accent: string
  details?: string
}

export type OutputCardOverride = {
  definitionId: string
  decayMs?: number | null
  decayOutputDefinitionIds?: string[]
}

export type InitialTableCardRecord = {
  definitionId: string
  x: number
  y: number
  quantity?: number
}

export type CardOutputRule = {
  id: string
  inputDefinitionIds: string[]
  durationMs: number
  event: string
  outputDefinitionIds: string[]
  consumeInputIndexes: boolean[]
  outputCardOverrides?: OutputCardOverride[]
}

export type ProductionRun = {
  id: string
  ruleId: string
  pairKey: string
  inputCardIds: string[]
  outputDefinitionIds: string[]
  outputCardOverrides?: OutputCardOverride[]
  event: string
  durationMs: number
  consumeInputIndexes: boolean[]
  startedAtMs: number
  status: 'active' | 'shrinking'
  nextQueued?: boolean
  shrinkStartedAtMs?: number
  cancelProgress?: number
}

export type ProductionMatch = {
  pairKey: string
  inputCards: TableCard[]
  rule: CardOutputRule
}
