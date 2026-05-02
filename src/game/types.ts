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
  parentCardId: string | null
  childCardId: string | null
  spawnedAtMs?: number
  spawnOriginX?: number
  spawnOriginY?: number
}

export type DragState = {
  cardId: string
  pointerId: number
  offsetX: number
  offsetY: number
  startClientX: number
  startClientY: number
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

export type InitialTableCardRecord = {
  definitionId: string
  x: number
  y: number
}

export type CardOutputRule = {
  id: string
  parentDefinitionId: string
  childDefinitionId: string
  durationMs: number
  event: string
  outputDefinitionId?: string | null
  consumeChild: boolean
  consumeParent?: boolean
}

export type ProductionRun = {
  id: string
  ruleId: string
  pairKey: string
  parentCardId: string
  childCardId: string
  outputDefinitionId?: string | null
  event: string
  durationMs: number
  consumeChild: boolean
  consumeParent?: boolean
  startedAtMs: number
  status: 'active' | 'shrinking'
  nextQueued?: boolean
  shrinkStartedAtMs?: number
  cancelProgress?: number
}

export type ProductionMatch = {
  pairKey: string
  parentCard: TableCard
  childCard: TableCard
  rule: CardOutputRule
}
