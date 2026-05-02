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
  /** 是否为SOS活动室（由文艺社活动室转化而来） */
  isSOSRoom?: boolean
  /** 自定义显示名称（覆盖definition的name） */
  customName?: string
  /** 自定义描述（覆盖definition的note） */
  customNote?: string
  /** 自定义样式标识 */
  customAccent?: string
  /** 是否正在工作中（如打工） */
  isWorking?: boolean
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
  isStackable?: boolean
}

export type InitialTableCardRecord = {
  definitionId: string
  x: number
  y: number
}

export type CardOutputRule = {
  id: string
  /** 父卡 definitionId（精确匹配，与 parentKind 互斥） */
  parentDefinitionId?: string
  /** 父卡 kind（类型匹配，与 parentDefinitionId 互斥） */
  parentKind?: string
  /** 子卡 definitionId（精确匹配，与 childKind 互斥） */
  childDefinitionId?: string
  /** 子卡 kind（类型匹配，与 childDefinitionId 互斥） */
  childKind?: string
  durationMs: number
  event: string
  /** 固定产出，与 outputPool 互斥 */
  outputDefinitionId?: string | null
  /** 随机产出池，与 outputPool 互斥 */
  outputPool?: string[]
  consumeChild: boolean
  consumeParent?: boolean
}

export type ProductionRunType = 'stack' | 'self-destruct' | 'auto-spawn'

export type ProductionRun = {
  id: string
  ruleId: string
  pairKey: string
  parentCardId: string
  childCardId: string
  outputDefinitionId?: string | null
  /** 随机产出池 */
  outputPool?: string[]
  event: string
  durationMs: number
  consumeChild: boolean
  consumeParent?: boolean
  startedAtMs: number
  status: 'active' | 'shrinking'
  nextQueued?: boolean
  shrinkStartedAtMs?: number
  cancelProgress?: number
  runType?: ProductionRunType
  /** 自消耗/自动生成的目标definitionId列表（用于auto-spawn） */
  spawnTargets?: string[]
}

export type ProductionMatch = {
  pairKey: string
  parentCard: TableCard
  childCard: TableCard
  rule: CardOutputRule
}

/** 自消耗计时器（地点卡自带的红圈） */
export type SelfDestructTimer = {
  id: string
  cardId: string
  startedAtMs: number
  durationMs: number
  status: 'active' | 'paused'
}
